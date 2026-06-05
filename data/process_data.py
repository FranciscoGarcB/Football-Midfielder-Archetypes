"""
process_data.py

Reads the three CSV files produced by scrape.py (standard_data.csv,
shooting_data.csv, misc_data.csv), merges them, runs PCA and k-means
clustering, computes similarity_to_kroos, and writes the four files
the visualization expects.

Column names follow the glosary.md naming convention produced by
soccerdata's process_df() transformation.

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

warnings.filterwarnings("ignore")

RAW_DIR       = os.path.join(os.path.dirname(__file__), "raw")
PROCESSED_DIR = os.path.join(os.path.dirname(__file__), "processed")

KROOS_NAME        = "Toni Kroos"
KROOS_PRIME_START = "2019-20"
KROOS_PRIME_END   = "2022-23"
MIN_MINUTES       = 900
N_CLUSTERS        = 5
PCA_COMPONENTS    = 2
RANDOM_SEED       = 42

VALID_LEAGUES = {
    "Premier League",
    "La Liga",
    "Serie A",
    "Bundesliga",
    "Ligue 1",
}

# Features used for PCA, clustering, and similarity.
# These are the internal names after the column mapping below.
# All values must be per-90 minutes.
FEATURE_COLS = [
    "progressive_passes",
    "key_passes",
    "tackles_won",
    "interceptions",
    "goals_per90",
    "assists_per90",
    "shots_per90",
]

TROPHY_TIMELINE = [
    {"season": "2019-20", "laliga": True,  "copa": False, "ucl": False},
    {"season": "2020-21", "laliga": False, "copa": True,  "ucl": False},
    {"season": "2021-22", "laliga": True,  "copa": False, "ucl": True},
    {"season": "2022-23", "laliga": False, "copa": True,  "ucl": False},
    {"season": "2023-24", "laliga": False, "copa": False, "ucl": True},
    {"season": "2024-25", "laliga": False, "copa": False, "ucl": False},
]

# Keys used to merge the three DataFrames
MERGE_KEYS = ["player", "team", "league", "season"]


def load_raw() -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    def read(name):
        path = os.path.join(RAW_DIR, f"{name}.csv")
        if not os.path.exists(path):
            raise FileNotFoundError(
                f"Missing {path}. Run data/scrape.py first."
            )
        df = pd.read_csv(path, encoding="utf-8")
        print(f"  {name}.csv: {len(df)} rows, {df.columns.tolist()[:6]}...")
        return df

    return read("standard_data"), read("shooting_data"), read("misc_data")


def extract_standard(df: pd.DataFrame) -> pd.DataFrame:
    """
    From standard_data, extract minutes, 90s, goals/90, assists/90,
    and G+A-PK/90 (non-penalty combined production).

    Relevant glosary.md columns:
        Playing Time_Min       -> minutes (total)
        Playing Time_90s / 90s -> nineties
        Per 90 Minutes_Gls     -> goals_per90
        Per 90 Minutes_Ast     -> assists_per90
        Per 90 Minutes_G+A-PK  -> ga_nopk_per90
        Performance_CrdY       -> yellow_cards
        Performance_CrdR       -> red_cards
    """
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
        "Performance_CrdY":      "yellow_cards",
        "Performance_CrdR":      "red_cards",
    }

    if "Playing Time_90s" in df.columns:
        col_map["Playing Time_90s"] = "nineties"
    elif "90s" in df.columns:
        col_map["90s"] = "nineties"

    available = {k: v for k, v in col_map.items() if k in df.columns}
    out = df[list(available.keys())].rename(columns=available).copy()
    return out


def extract_shooting(df: pd.DataFrame) -> pd.DataFrame:
    """
    From shooting_data, extract shots per 90 and shots on target per 90.

    Relevant glosary.md columns:
        Standard_Sh/90    -> shots_per90
        Standard_SoT/90   -> shots_on_target_per90
        Standard_G/Sh     -> goals_per_shot
    """
    col_map = {
        "player":              "player",
        "team":                "team",
        "league":              "league",
        "season":              "season",
        "Standard_Sh/90":      "shots_per90",
        "Standard_SoT/90":     "shots_on_target_per90",
        "Standard_G/Sh":       "goals_per_shot",
    }
    available = {k: v for k, v in col_map.items() if k in df.columns}
    out = df[list(available.keys())].rename(columns=available).copy()
    return out


def extract_misc(df: pd.DataFrame) -> pd.DataFrame:
    """
    From misc_data, extract defensive and creative metrics per 90.

    Relevant glosary.md columns:
        Performance_Int     -> interceptions (total — divide by 90s)
        Performance_TklW    -> tackles_won   (total — divide by 90s)
        Performance_Fls     -> fouls_committed (total — divide by 90s)
        Performance_Crs     -> crosses        (total — divide by 90s)

    Note: misc_data contains totals, not per-90 values, so we keep the
    raw totals and divide by nineties after the merge.
    """
    col_map = {
        "player":               "player",
        "team":                 "team",
        "league":               "league",
        "season":               "season",
        "Performance_Int":      "interceptions_total",
        "Performance_TklW":     "tackles_won_total",
        "Performance_Fls":      "fouls_committed_total",
        "Performance_Crs":      "crosses_total",
    }
    available = {k: v for k, v in col_map.items() if k in df.columns}
    out = df[list(available.keys())].rename(columns=available).copy()
    return out


def merge_sources(std, sht, misc) -> pd.DataFrame:
    df = std.merge(sht,  on=MERGE_KEYS, how="left", suffixes=("", "_sht"))
    df = df.merge(misc, on=MERGE_KEYS, how="left", suffixes=("", "_misc"))
    return df


def derive_per90_cols(df: pd.DataFrame) -> pd.DataFrame:
    """
    Converts total counts from misc_data to per-90 rates using nineties.
    Also derives pass_completion_pct as a proxy from goals+assists production
    since soccerdata's standard table does not always include it directly.
    """
    n = df["nineties"].replace(0, np.nan)

    if "interceptions_total" in df.columns:
        df["interceptions"] = (df["interceptions_total"] / n).round(4)

    if "tackles_won_total" in df.columns:
        df["tackles_won"] = (df["tackles_won_total"] / n).round(4)

    if "fouls_committed_total" in df.columns:
        df["fouls_committed_per90"] = (df["fouls_committed_total"] / n).round(4)

    if "crosses_total" in df.columns:
        df["crosses_per90"] = (df["crosses_total"] / n).round(4)

    df["interceptions"] = df.get("interceptions",  pd.Series(0, index=df.index)).fillna(0)
    df["tackles_won"]   = df.get("tackles_won",    pd.Series(0, index=df.index)).fillna(0)
    df["goals_per90"]   = df.get("goals_per90",    pd.Series(0, index=df.index)).fillna(0)
    df["assists_per90"] = df.get("assists_per90",  pd.Series(0, index=df.index)).fillna(0)
    df["shots_per90"]   = df.get("shots_per90",    pd.Series(0, index=df.index)).fillna(0)

    return df


def clean(df: pd.DataFrame) -> pd.DataFrame:
    df = df[df["league"].isin(VALID_LEAGUES)].copy()

    numeric_cols = [
        "minutes", "nineties", "age",
        "goals_per90", "assists_per90", "shots_per90",
        "progressive_passes", "key_passes", "pass_completion_pct",
        "tackles_won", "interceptions",
    ]
    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    df["minutes"] = df["minutes"].astype(int)

    df["player_id"] = df["player"].str.strip() + "_" + df["season"].astype(str)

    # Deduplicate: a player can appear in both halves of a season if transferred.
    # Keep the row with the most minutes.
    df = df.sort_values("minutes", ascending=False).drop_duplicates(
        subset=["player", "league", "season"]
    )

    return df.reset_index(drop=True)


def run_pca_and_clustering(df: pd.DataFrame):
    df_active = df[df["minutes"] >= MIN_MINUTES].copy()

    missing = [c for c in FEATURE_COLS if c not in df_active.columns]
    if missing:
        print(f"  Warning: feature columns missing, filling with 0: {missing}")
        for c in missing:
            df_active[c] = 0.0

    X = df_active[FEATURE_COLS].fillna(0).values

    scaler   = StandardScaler()
    X_scaled = scaler.fit_transform(X)

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
        print(f"  Warning: Kroos not found in {KROOS_PRIME_START}–{KROOS_PRIME_END}. "
              f"similarity_to_kroos will be 0.")
        df_active["similarity_to_kroos"] = 0.0
    else:
        centroid        = scaler.transform([kroos_prime[FEATURE_COLS].fillna(0).mean().values])[0]
        distances       = np.linalg.norm(X_scaled - centroid, axis=1)
        df_active["similarity_to_kroos"] = (1 - distances / (distances.max() or 1)).round(4)

    pca_cols = ["player_id", "pc1", "pc2", "cluster", "similarity_to_kroos"]
    df = df.merge(df_active[pca_cols], on="player_id", how="left")
    return df, variance


def build_players_csv(df: pd.DataFrame) -> pd.DataFrame:
    cols = [
        "player_id", "player", "team", "league", "season",
        "age", "nationality", "minutes",
        "progressive_passes", "key_passes",
        "tackles_won", "interceptions",
        "goals_per90", "assists_per90", "shots_per90",
        "cluster", "pc1", "pc2", "similarity_to_kroos",
    ]
    cols = [c for c in cols if c in df.columns]
    out  = df[cols].sort_values(["season", "player"])
    out  = out.rename(columns={"tackles_won": "tackles", "shots_per90": "shots"})
    return out


def build_pca_json(df: pd.DataFrame, variance: list) -> dict:
    active = df[df["pc1"].notna()].copy()
    records = []
    for _, row in active.iterrows():
        records.append({
            "id":                  str(row["player_id"]),
            "player":              row["player"],
            "name":                row["player"],
            "team":                row["team"],
            "league":              row["league"],
            "season":              str(row["season"]),
            "age":                 int(row["age"])  if pd.notna(row.get("age"))  else None,
            "minutes":             int(row["minutes"]),
            "cluster":             int(row["cluster"]),
            "pc1":                 round(float(row["pc1"]), 4),
            "pc2":                 round(float(row["pc2"]), 4),
            "similarity_to_kroos": round(float(row["similarity_to_kroos"]), 4),
            "prog_passes":         round(float(row.get("progressive_passes", 0)), 4),
            "key_passes":          round(float(row.get("key_passes", 0)), 4),
            "tackles":             round(float(row.get("tackles_won", 0)), 4),
            "interceptions":       round(float(row.get("interceptions", 0)), 4),
            "goals_per90":         round(float(row.get("goals_per90", 0)), 4),
            "assists_per90":       round(float(row.get("assists_per90", 0)), 4),
            "shots":               round(float(row.get("shots_per90", 0)), 4),
        })
    return {"players": records, "variance_explained": [round(v, 4) for v in variance]}


def build_kroos_json(df: pd.DataFrame) -> dict:
    kroos = df[df["player"] == KROOS_NAME].sort_values("season")
    if kroos.empty:
        print("  Warning: no Kroos rows found.")
        return {"kroos": []}

    records = []
    for _, row in kroos.iterrows():
        def f(col, fallback=0.0):
            val = row.get(col, fallback)
            return round(float(val), 4) if pd.notna(val) else fallback

        records.append({
            "id":                  str(row["player_id"]),
            "season":              str(row["season"]),
            "age":                 int(row["age"]) if pd.notna(row.get("age")) else None,
            "minutes":             int(row["minutes"]),
            "progressive_passes":  f("progressive_passes"),
            "key_passes":          f("key_passes"),
            "pass_completion_pct": f("pass_completion_pct"),
            "tackles":             f("tackles_won"),
            "interceptions":       f("interceptions"),
            "goals_per90":         f("goals_per90"),
            "assists_per90":       f("assists_per90"),
            "shots":               f("shots_per90"),
            "cluster":    int(row["cluster"])    if pd.notna(row.get("cluster"))    else None,
            "pc1":        round(float(row["pc1"]), 4) if pd.notna(row.get("pc1")) else None,
            "pc2":        round(float(row["pc2"]), 4) if pd.notna(row.get("pc2")) else None,
        })
    return {"kroos": records}


def main():
    os.makedirs(PROCESSED_DIR, exist_ok=True)

    print("Loading raw files from data/raw/ ...")
    standard_raw, shooting_raw, misc_raw = load_raw()

    print("Extracting relevant columns...")
    std  = extract_standard(standard_raw)
    sht  = extract_shooting(shooting_raw)
    misc = extract_misc(misc_raw)

    print("Merging sources...")
    df = merge_sources(std, sht, misc)

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
    print("Done.")
    print(f"  Seasons:       {sorted(df['season'].unique())}")
    print(f"  Total players: {df['player'].nunique()}")
    print(f"  Kroos seasons: {sorted(df[df['player'] == KROOS_NAME]['season'].tolist())}")


if __name__ == "__main__":
    main()
