"""
process_data.py

Reads four CSV files produced by scrape.py, merges them, runs PCA and
k-means clustering, computes similarity_to_kroos, and writes the four
files the visualization expects.

Sources:
    standard_data.csv   — goals, assists, G+A no-pen per 90 (FBref)
    shooting_data.csv   — shots, shots on target, goals per shot (FBref)
    misc_data.csv       — tackles, interceptions, fouls drawn, crosses (FBref)
    understat_data.csv  — xG, np_xG, xA, key_passes, xg_chain, xg_buildup (Understat)

Run from the project root after scrape.py:
    python data/process_data.py

Output (written to data/processed/):
    players.csv
    pca_coords.json
    kroos_stats.json
    trophy_timeline.json
"""

import os
import json
import warnings
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
from sklearn.cluster import KMeans
import matplotlib.pyplot as plt  
from sklearn.metrics import silhouette_score

warnings.filterwarnings("ignore")

RAW_DIR       = os.path.join(os.path.dirname(__file__), "raw")
PROCESSED_DIR = os.path.join(os.path.dirname(__file__), "processed")

KROOS_NAME        = "Toni Kroos"
KROOS_PRIME_START = "2019-20"
KROOS_PRIME_END   = "2022-23"
MIN_MINUTES       = 900
N_CLUSTERS        = 4
PCA_COMPONENTS    = 2
RANDOM_SEED       = 42

VALID_LEAGUES = {
    "Premier League",
    "La Liga",
    "Serie A",
    "Bundesliga",
    "Ligue 1",
}

# Features for PCA, clustering, and similarity — all per-90 values.
# xa_per90 and key_passes_per90 come from Understat (joined after FBref merge).
# When Understat has no match for a player they default to 0.
FEATURE_COLS = [
    "goals_per90",         # Per 90 Minutes_Gls          (FBref standard)
    "assists_per90",       # Per 90 Minutes_Ast           (FBref standard)
    "np_xg_per90",         # np_xg / (minutes/90)         (Understat)
    "xa_per90",            # xa    / (minutes/90)         (Understat)
    "key_passes_per90",    # key_passes / (minutes/90)    (Understat)
    "shots_per90",         # Standard_Sh/90               (FBref shooting)
    "tackles_won",         # Performance_TklW / 90s       (FBref misc)
    "interceptions",       # Performance_Int  / 90s       (FBref misc)
    "fouls_drawn_per90",   # Performance_Fld  / 90s       (FBref misc)
]

TROPHY_TIMELINE = [
    {"season": "2019-20", "laliga": True,  "copa": False, "ucl": False},
    {"season": "2020-21", "laliga": False, "copa": True,  "ucl": False},
    {"season": "2021-22", "laliga": True,  "copa": False, "ucl": True},
    {"season": "2022-23", "laliga": False, "copa": True,  "ucl": False},
    {"season": "2023-24", "laliga": False, "copa": False, "ucl": True},
    {"season": "2024-25", "laliga": False, "copa": False, "ucl": False},
]

FBREF_MERGE_KEYS      = ["player", "team", "league", "season"]
UNDERSTAT_MERGE_KEYS  = ["player", "league", "season"]


def load_raw():
    def read(name, required=True):
        path = os.path.join(RAW_DIR, f"{name}.csv")
        if not os.path.exists(path):
            if required:
                raise FileNotFoundError(
                    f"Missing {path}. Run data/scrape.py first."
                )
            print(f"  {name}.csv not found — skipping (optional source).")
            return None
        df = pd.read_csv(path, encoding="utf-8")
        print(f"  {name}.csv: {len(df)} rows")
        return df

    standard  = read("standard_data")
    shooting  = read("shooting_data")
    misc      = read("misc_data")
    understat = read("understat_data", required=False)
    return standard, shooting, misc, understat


def extract_standard(df: pd.DataFrame) -> pd.DataFrame:
    col_map = {
        "player":                "player",
        "team":                  "team",
        "league":                "league",
        "season":                "season",
        "nation":                "nationality",
        "age":                   "age",
        "Playing Time_Min":      "minutes",
        "Per 90 Minutes_Gls":    "goals_per90",
        "Per 90 Minutes_Ast":    "assists_per90",
        "Per 90 Minutes_G+A-PK": "ga_nopk_per90",
    }
    if "Playing Time_90s" in df.columns:
        col_map["Playing Time_90s"] = "nineties"
    elif "90s" in df.columns:
        col_map["90s"] = "nineties"

    available = {k: v for k, v in col_map.items() if k in df.columns}
    return df[list(available.keys())].rename(columns=available).copy()


def extract_shooting(df: pd.DataFrame) -> pd.DataFrame:
    col_map = {
        "player":           "player",
        "team":             "team",
        "league":           "league",
        "season":           "season",
        "Standard_Sh/90":   "shots_per90",
        "Standard_SoT/90":  "shots_on_target_per90",
        "Standard_G/Sh":    "goals_per_shot",
    }
    available = {k: v for k, v in col_map.items() if k in df.columns}
    return df[list(available.keys())].rename(columns=available).copy()


def extract_misc(df: pd.DataFrame) -> pd.DataFrame:
    col_map = {
        "player":             "player",
        "team":               "team",
        "league":             "league",
        "season":             "season",
        "Performance_Int":    "interceptions_total",
        "Performance_TklW":   "tackles_won_total",
        "Performance_Fld":    "fouls_drawn_total",
        "Performance_Crs":    "crosses_total",
    }
    if "90s" in df.columns:
        col_map["90s"] = "nineties_misc"

    available = {k: v for k, v in col_map.items() if k in df.columns}
    return df[list(available.keys())].rename(columns=available).copy()


def extract_understat(df: pd.DataFrame) -> pd.DataFrame:
    """
    Understat totals (not per 90). Kept as totals here; converted to per-90
    after the join with FBref using the minutes column from standard_data.

    Columns used:
        xa          -> xa_total         (expected assists — quality of final passes)
        key_passes  -> key_passes_total (passes that ended in a shot)
        np_xg       -> np_xg_total      (non-penalty expected goals)
        xg_chain    -> xg_chain         (xG of all sequences player was involved in)
        xg_buildup  -> xg_buildup       (xG of sequences, excluding shot and assist)
    """
    col_map = {
        "player":      "player",
        "league":      "league",
        "season":      "season",
        "xa":          "xa_total",
        "key_passes":  "key_passes_total",
        "np_xg":       "np_xg_total",
        "xg_chain":    "xg_chain",
        "xg_buildup":  "xg_buildup",
    }
    available = {k: v for k, v in col_map.items() if k in df.columns}
    out = df[list(available.keys())].rename(columns=available).copy()

    # Understat may have multiple rows per player-season (different teams
    # after a transfer). Keep the row with the highest xa_total as it
    # corresponds to the longer stint.
    if "xa_total" in out.columns:
        out = out.sort_values("xa_total", ascending=False).drop_duplicates(
            subset=["player", "league", "season"]
        )
    return out


def merge_sources(std, sht, misc, understat=None) -> pd.DataFrame:
    df = std.merge(sht,  on=FBREF_MERGE_KEYS, how="left", suffixes=("", "_sht"))
    df = df.merge(misc, on=FBREF_MERGE_KEYS, how="left", suffixes=("", "_misc"))

    if understat is not None:
        df = df.merge(
            understat,
            on=UNDERSTAT_MERGE_KEYS,
            how="left",
            suffixes=("", "_us"),
        )
        print(f"  Understat join: {df['xa_total'].notna().sum()} rows matched "
              f"({df['xa_total'].isna().sum()} unmatched — will use 0)")
    return df


def derive_per90_cols(df: pd.DataFrame) -> pd.DataFrame:
    """
    Converts FBref misc totals and Understat totals to per-90 rates.
    Uses nineties (Playing Time_90s from standard_data) as the denominator.
    """
    n = df["nineties"].replace(0, np.nan)

    # FBref misc totals → per-90
    if "interceptions_total" in df.columns:
        df["interceptions"] = (df["interceptions_total"] / n).round(4)
    if "tackles_won_total" in df.columns:
        df["tackles_won"] = (df["tackles_won_total"] / n).round(4)
    if "fouls_drawn_total" in df.columns:
        df["fouls_drawn_per90"] = (df["fouls_drawn_total"] / n).round(4)
    if "crosses_total" in df.columns:
        df["crosses_per90"] = (df["crosses_total"] / n).round(4)

    # Understat totals → per-90
    if "xa_total" in df.columns:
        df["xa_per90"] = (df["xa_total"] / n).round(4)
    if "key_passes_total" in df.columns:
        df["key_passes_per90"] = (df["key_passes_total"] / n).round(4)
    if "np_xg_total" in df.columns:
        df["np_xg_per90"] = (df["np_xg_total"] / n).round(4)

    # Ensure all FEATURE_COLS exist, filling missing values with 0
    for col in FEATURE_COLS:
        if col not in df.columns:
            df[col] = 0.0
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    return df


def clean(df: pd.DataFrame) -> pd.DataFrame:
    df = df[df["league"].isin(VALID_LEAGUES)].copy()

    numeric_cols = [
        "minutes", "nineties", "age",
        "goals_per90", "assists_per90", "ga_nopk_per90",
        "shots_per90", "shots_on_target_per90", "goals_per_shot",
        "tackles_won", "interceptions", "fouls_drawn_per90",
        "xa_per90", "key_passes_per90", "np_xg_per90",
        "xg_chain", "xg_buildup",
    ]
    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    df["minutes"] = df["minutes"].astype(int)
    df["player_id"] = df["player"].str.strip() + "_" + df["season"].astype(str)

    df = df.sort_values("minutes", ascending=False).drop_duplicates(
        subset=["player", "league", "season"]
    )
    return df.reset_index(drop=True)

def optimize_k(X_scaled, max_k=10):
    """
    Tests different K values and prints Inertia and Silhouette metrics
    to find the optimal number of clusters.
    """
    print("\n" + "="*50)
    print("K OPTIMIZATION ANALYSIS (N_CLUSTERS)")
    print("="*50)
    print(f"{'K':<5}{'Inertia (Elbow)':<20}{'Silhouette Score':<20}")
    print("-"*50)
    
    inertias = []
    silhouette_scores = []
    k_range = range(2, max_k + 1)
    
    for k in k_range:
        kmeans = KMeans(n_clusters=k, random_state=RANDOM_SEED, n_init=12)
        cluster_labels = kmeans.fit_predict(X_scaled)
        
        inertia = kmeans.inertia_
        sil_score = silhouette_score(X_scaled, cluster_labels)
        
        inertias.append(inertia)
        silhouette_scores.append(sil_score)
        
        print(f"{k:<5}{inertia:<20.2f}{sil_score:<20.4f}")
    print("="*50)
    
    # Used to select the best K
    # fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 5))
    # ax1.plot(k_range, inertias, 'bx-')
    # ax1.set_title('Elbow Method (Inertia)')
    # ax2.plot(k_range, silhouette_scores, 'rx-')
    # ax2.set_title('Silhouette Score per K')
    # plt.show()


def run_pca_and_clustering(df: pd.DataFrame):
    df_active = df[df["minutes"] >= MIN_MINUTES].copy()

    missing = [c for c in FEATURE_COLS if c not in df_active.columns]
    if missing:
        print(f"  Warning: filling missing feature columns with 0: {missing}")
        for c in missing:
            df_active[c] = 0.0

    X = df_active[FEATURE_COLS].fillna(0).values
    scaler   = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    optimize_k(X_scaled, max_k=10) 

    pca    = PCA(n_components=PCA_COMPONENTS, random_state=RANDOM_SEED)
    coords = pca.fit_transform(X_scaled)
    df_active["pc1"] = coords[:, 0].round(4)
    df_active["pc2"] = coords[:, 1].round(4)

    kmeans = KMeans(n_clusters=N_CLUSTERS, random_state=RANDOM_SEED, n_init=12)
    df_active["cluster"] = kmeans.fit_predict(X_scaled)

    variance = pca.explained_variance_ratio_.tolist()
    print(f"  PCA variance explained: PC1={variance[0]:.3f}, PC2={variance[1]:.3f}")

    kroos_mask = (
        (df_active["player"] == KROOS_NAME) &
        (df_active["season"] >= KROOS_PRIME_START) &
        (df_active["season"] <= KROOS_PRIME_END)
    )
    kroos_prime = df_active[kroos_mask]

    if kroos_prime.empty:
        print(f"  Warning: Kroos not found for {KROOS_PRIME_START}–{KROOS_PRIME_END}.")
        df_active["similarity_to_kroos"] = 0.0
    else:
        centroid  = scaler.transform([kroos_prime[FEATURE_COLS].fillna(0).mean().values])[0]
        distances = np.linalg.norm(X_scaled - centroid, axis=1)
        df_active["similarity_to_kroos"] = (1 - distances / (distances.max() or 1)).round(4)

    pca_cols = ["player_id", "pc1", "pc2", "cluster", "similarity_to_kroos"]
    df = df.merge(df_active[pca_cols], on="player_id", how="inner")
    return df, variance


def build_players_csv(df: pd.DataFrame) -> pd.DataFrame:
    cols = [
        "player_id", "player", "team", "league", "season",
        "age", "nationality", "minutes",
        # FBref
        "goals_per90", "assists_per90", "ga_nopk_per90",
        "shots_per90", "shots_on_target_per90", "goals_per_shot",
        "tackles_won", "interceptions", "fouls_drawn_per90", "crosses_per90",
        # Understat
        "xa_per90", "key_passes_per90", "np_xg_per90",
        "xg_chain", "xg_buildup",
        # PCA + clustering
        "cluster", "pc1", "pc2", "similarity_to_kroos",
    ]
    cols = [c for c in cols if c in df.columns]
    out  = df[cols].sort_values(["season", "player"])
    out  = out.rename(columns={
        "tackles_won":          "tackles",
        "shots_per90":          "shots",
        "shots_on_target_per90":"shots_on_target",
        "fouls_drawn_per90":    "fouls_drawn",
    })
    return out


def build_pca_json(df: pd.DataFrame, variance: list) -> dict:
    active  = df[df["pc1"].notna()].copy()
    records = []
    for _, row in active.iterrows():
        def g(col):
            v = row.get(col, 0)
            return round(float(v), 4) if pd.notna(v) else 0.0

        records.append({
            "id":                  str(row["player_id"]),
            "player":              row["player"],
            "name":                row["player"],
            "team":                row["team"],
            "league":              row["league"],
            "season":              str(row["season"]),
            "age":                 int(row["age"]) if pd.notna(row.get("age")) else None,
            "minutes":             int(row["minutes"]),
            "cluster":             int(row["cluster"]),
            "pc1":                 round(float(row["pc1"]), 4),
            "pc2":                 round(float(row["pc2"]), 4),
            "similarity_to_kroos": round(float(row["similarity_to_kroos"]), 4),
            # FBref
            "goals_per90":         g("goals_per90"),
            "assists_per90":       g("assists_per90"),
            "ga_nopk_per90":       g("ga_nopk_per90"),
            "shots":               g("shots_per90"),
            "shots_on_target":     g("shots_on_target_per90"),
            "goals_per_shot":      g("goals_per_shot"),
            "tackles":             g("tackles_won"),
            "interceptions":       g("interceptions"),
            "fouls_drawn":         g("fouls_drawn_per90"),
            "crosses":             g("crosses_per90"),
            # Understat
            "xa_per90":            g("xa_per90"),
            "key_passes_per90":    g("key_passes_per90"),
            "np_xg_per90":         g("np_xg_per90"),
            "xg_chain":            g("xg_chain"),
            "xg_buildup":          g("xg_buildup"),
        })
    return {"players": records, "variance_explained": [round(v, 4) for v in variance]}


def build_kroos_json(df: pd.DataFrame) -> dict:
    kroos = df[df["player"] == KROOS_NAME].sort_values("season")
    if kroos.empty:
        print("  Warning: no Kroos rows found.")
        return {"kroos": []}

    records = []
    for _, row in kroos.iterrows():
        def f(col):
            v = row.get(col, 0.0)
            return round(float(v), 4) if pd.notna(v) else 0.0

        records.append({
            "id":                  str(row["player_id"]),
            "season":              str(row["season"]),
            "age":                 int(row["age"]) if pd.notna(row.get("age")) else None,
            "minutes":             int(row["minutes"]),
            # FBref
            "goals_per90":         f("goals_per90"),
            "assists_per90":       f("assists_per90"),
            "ga_nopk_per90":       f("ga_nopk_per90"),
            "shots":               f("shots_per90"),
            "shots_on_target":     f("shots_on_target_per90"),
            "goals_per_shot":      f("goals_per_shot"),
            "tackles":             f("tackles_won"),
            "interceptions":       f("interceptions"),
            "fouls_drawn":         f("fouls_drawn_per90"),
            "crosses":             f("crosses_per90"),
            # Understat
            "xa_per90":            f("xa_per90"),
            "key_passes_per90":    f("key_passes_per90"),
            "np_xg_per90":         f("np_xg_per90"),
            "xg_chain":            f("xg_chain"),
            "xg_buildup":          f("xg_buildup"),
            "cluster":    int(row["cluster"]) if pd.notna(row.get("cluster")) else None,
            "pc1":        round(float(row["pc1"]), 4) if pd.notna(row.get("pc1")) else None,
            "pc2":        round(float(row["pc2"]), 4) if pd.notna(row.get("pc2")) else None,
        })
    return {"kroos": records}


def print_cluster_profiles(df: pd.DataFrame) -> None:
    """
    Print a per-cluster summary to help assign archetype names in
    dataTransforms.js after running the pipeline.
    """
    # Normalize to internal column names (process_data names, before CSV rename)
    df = df.copy()
    rename_back = {
        "tackles":       "tackles_won",
        "shots":         "shots_per90",
        "shots_on_target": "shots_on_target_per90",
        "fouls_drawn":   "fouls_drawn_per90",
    }
    df.rename(columns={v: k for k, v in rename_back.items()}, errors="ignore", inplace=True)

    axes = [c for c in FEATURE_COLS if c in df.columns]

    print()
    print("=" * 70)
    print("CLUSTER PROFILES — use to assign names in dataTransforms.js")
    print("=" * 70)

    for cid in range(N_CLUSTERS):
        rows = df[df["cluster"] == cid]
        if rows.empty:
            print(f"\nCluster {cid}: [EMPTY]")
            continue

        print(f"\nCluster {cid}  ({len(rows)} players)")
        print("-" * 70)

        for label, col in [
            ("Top by xa_per90",        "xa_per90"),
            ("Top by key_passes_per90","key_passes_per90"),
            ("Top by tackles_won",     "tackles_won"),
        ]:
            if col not in rows.columns:
                continue
            top = rows.nlargest(4, col)[["player", "season", col]]
            print(f"  {label}:")
            for _, r in top.iterrows():
                print(f"    {r['player']:28s} ({r['season']})  {r[col]:6.2f}")

        print("  Mean profile:")
        for col in axes:
            if col in rows.columns:
                print(f"    {col:25s} {rows[col].mean():6.2f}")

    print()
    print("=" * 70)
    print("Update CLUSTER_NAMES in src/utils/dataTransforms.js accordingly.")
    print("=" * 70)


def main():
    os.makedirs(PROCESSED_DIR, exist_ok=True)

    print("Loading raw files from data/raw/ ...")
    standard_raw, shooting_raw, misc_raw, understat_raw = load_raw()

    print("Extracting relevant columns...")
    std  = extract_standard(standard_raw)
    sht  = extract_shooting(shooting_raw)
    misc = extract_misc(misc_raw)
    us   = extract_understat(understat_raw) if understat_raw is not None else None

    print("Merging sources...")
    df = merge_sources(std, sht, misc, us)

    print("Deriving per-90 columns...")
    df = derive_per90_cols(df)

    print("Cleaning and deduplicating...")
    df = clean(df)
    print(f"  {len(df)} rows after cleaning, {df['player'].nunique()} unique players")

    print("Running PCA and clustering...")
    df, variance = run_pca_and_clustering(df)

    print("Writing players.csv...")
    players_df = build_players_csv(df)
    players_df.to_csv(os.path.join(PROCESSED_DIR, "players.csv"), index=False, encoding="utf-8")
    print(f"  {len(players_df)} rows")

    print("Writing pca_coords.json...")
    pca_data = build_pca_json(df, variance)
    with open(os.path.join(PROCESSED_DIR, "pca_coords.json"), "w", encoding="utf-8") as f:
        json.dump(pca_data, f, separators=(",", ":"), ensure_ascii=False)
    print(f"  {len(pca_data['players'])} records")

    print("Writing kroos_stats.json...")
    kroos_data = build_kroos_json(df)
    with open(os.path.join(PROCESSED_DIR, "kroos_stats.json"), "w", encoding="utf-8") as f:
        json.dump(kroos_data, f, separators=(",", ":"), ensure_ascii=False)
    print(f"  {len(kroos_data['kroos'])} Kroos seasons")

    print("Writing trophy_timeline.json...")
    with open(os.path.join(PROCESSED_DIR, "trophy_timeline.json"), "w", encoding="utf-8") as f:
        json.dump(TROPHY_TIMELINE, f, separators=(",", ":"), indent=2)

    print()
    print(f"  Seasons:       {sorted(df['season'].unique())}")
    print(f"  Total players: {df['player'].nunique()}")
    print(f"  Kroos seasons: {sorted(df[df['player'] == KROOS_NAME]['season'].tolist())}")

    print_cluster_profiles(df)


if __name__ == "__main__":
    main()