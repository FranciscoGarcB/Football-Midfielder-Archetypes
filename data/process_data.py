"""
process_data.py

Reads four CSV files produced by scrape.py, merges them, runs PCA and
k-means clustering, computes similarity_to_kroos, and writes the four
files the visualization expects.

Sources:
    standard_data.csv          — goals, assists, G+A no-pen per 90 (FBref via soccerdata)
    shooting_data.csv          — shots, shots on target, goals per shot (FBref via soccerdata)
    misc_data.csv              — tackles, interceptions, fouls drawn, crosses (FBref via soccerdata)
    understat_data.csv         — xG, np_xG, xA, key_passes, xg_chain, xg_buildup (Understat)
    player_data/cleaned_*.csv  — progressive passes, key passes, pass completion %,
                                 shot-creating actions (FBref season CSVs — one file per season)

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
PROCESSED_DIR    = os.path.join(os.path.dirname(__file__), "processed")
PLAYER_DATA_DIR  = os.path.join(RAW_DIR, "player_data")

KROOS_NAME        = "Toni Kroos"
KROOS_PRIME_START = "2019-20"
KROOS_PRIME_END   = "2022-23"
MIN_MINUTES       = 900
N_CLUSTERS        = 5
PCA_COMPONENTS    = 4
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
# Features for PCA, clustering, and similarity_to_kroos.
# PCA is restricted to players that have all of these populated (i.e. matched
# in player_data). This guarantees no zeros from missing joins distort the space.
FEATURE_COLS = [
    "goals_per90",              # Per 90 Minutes_Gls           (FBref standard)
    "assists_per90",            # Per 90 Minutes_Ast           (FBref standard)
    "np_xg_per90",              # np_xg / (minutes/90)         (Understat)
    "xa_per90",                 # xa / (minutes/90)            (Understat)
    "progressive_passes_per90", # Progressive Passes / 90s     (player_data)
    "key_passes_per90",         # Key passes / 90s             (player_data)
    "pass_completion_pct",      # Pass completion %            (player_data)
    "long_pass_pct",            # % Long passes completed      (player_data) — Kroos signature
    "gca_per90",                # Goal creating actions / 90   (player_data) — builder vs finisher
    "prog_carries_per90",       # Progressive carries / 90     (player_data) — carrier vs passer
    "carries_final_third_per90",# Carries into final third / 90 (player_data) — vertical threat
    "shots_per90",              # Standard_Sh/90               (FBref shooting)
    "tackles_won",              # Performance_TklW / 90s       (FBref misc)
    "interceptions",            # Performance_Int / 90s        (FBref misc)
    "fouls_committed_per90",    # Performance_Fls / 90s        (FBref misc) — defensive intensity
]

TROPHY_TIMELINE = [
    {"season": "2019-20", "laliga": True,  "copa": False, "ucl": False},
    {"season": "2020-21", "laliga": False, "copa": True,  "ucl": False},
    {"season": "2021-22", "laliga": True,  "copa": False, "ucl": True},
    {"season": "2022-23", "laliga": False, "copa": True,  "ucl": False},
    {"season": "2023-24", "laliga": False, "copa": False, "ucl": True},
    {"season": "2024-25", "laliga": False, "copa": False, "ucl": False},
    {"season": "2025-25", "laliga": False, "copa": False, "ucl": False}
]

FBREF_MERGE_KEYS      = ["player", "team", "league", "season"]
UNDERSTAT_MERGE_KEYS  = ["player", "league", "season"]
PLAYER_DATA_MERGE_KEYS = ["player", "league", "season"]


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
    player_data_raw = load_player_data()
    return standard, shooting, misc, understat, player_data_raw


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
        "Performance_Fls":    "fouls_committed_total",
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

def load_player_data() -> pd.DataFrame | None:
    """
    Reads all cleaned_YYYY-YY.csv files from data/raw/player_data/ and
    concatenates them into a single DataFrame.
    Returns None if the directory does not exist or is empty.

    Season label in the files matches the format used throughout the pipeline
    (e.g. "2022-23"), so no conversion is needed — the column is already a
    string in that format.
    """
    if not os.path.isdir(PLAYER_DATA_DIR):
        print("  player_data/ directory not found — skipping.")
        return None

    files = sorted(
        f for f in os.listdir(PLAYER_DATA_DIR)
        if f.startswith("cleaned_") and f.endswith(".csv")
    )
    if not files:
        print("  No cleaned_*.csv files found in player_data/ — skipping.")
        return None

    dfs = []
    for fname in files:
        path = os.path.join(PLAYER_DATA_DIR, fname)
        try:
            df = pd.read_csv(path, encoding="utf-8")
            dfs.append(df)
        except Exception as e:
            print(f"  Warning: could not read {fname}: {e}")

    if not dfs:
        return None

    combined = pd.concat(dfs, ignore_index=True)
    print(f"  player_data/: {len(files)} files, {len(combined)} rows total")
    return combined


def _normalize_league(raw: str) -> str:
    """
    Maps any realistic FBref league name variant to the canonical VALID_LEAGUES name.
    Covers prefixed forms (e.g. "de Bundesliga", "eng Premier League"),
    plain forms, and lowercase variants.
    """
    KEYWORDS = {
        "premier league": "Premier League",
        "la liga":        "La Liga",
        "serie a":        "Serie A",
        "bundesliga":     "Bundesliga",
        "ligue 1":        "Ligue 1",
    }
    s = raw.strip().lower()
    for kw, canonical in KEYWORDS.items():
        if kw in s:
            return canonical
    return raw.strip()


def extract_player_data(df: pd.DataFrame) -> pd.DataFrame:
    """
    Extracts passing and creativity metrics from the cleaned season CSVs.

    Relevant columns (original name -> internal name):
        player                     -> player
        comp                       -> league  (normalized via _normalize_league)
        season                     -> season
        Progressive Passes         -> prog_passes_total   (total — divided by 90s)
        Key passes                 -> key_passes_total_pd (total — divided by 90s)
        Pass completion %          -> pass_completion_pct (already %, keep as-is)
        Shot creating actions p 90 -> sca_per90           (already per-90)
        1/3                        -> passes_final_third_total
    Totals are divided by Playing Time_90s from standard_data (column "nineties"
    after the merge), which is the authoritative per-90 denominator for all sources.
    """
    col_map = {
        "player":                      "player",
        "comp":                        "league",
        "season":                      "season",
        "Current Age":                 "current_age",
        "Progressive Passes":          "prog_passes_total",
        "Key passes":                  "key_passes_total_pd",
        "Pass completion %":           "pass_completion_pct",
        "% Long passes completed":     "long_pass_pct",
        "Shot creating actions p 90":  "sca_per90",
        "Goal creating actions p 90":  "gca_per90",
        "Progressive Carries":         "prog_carries_total",
        "carries final 3rd":           "carries_final_third_total",
        "1/3":                         "passes_final_third_total",
    }
    available = {k: v for k, v in col_map.items() if k in df.columns}
    out = df[list(available.keys())].rename(columns=available).copy()

    # Normalize league names using keyword matching — handles any prefix/case variant
    if "league" in out.columns:
        raw_leagues = out["league"].astype(str).str.strip().unique().tolist()
        print(f"  player_data raw league values: {raw_leagues}")
        out["league"] = out["league"].astype(str).apply(_normalize_league)
        normalized = out["league"].unique().tolist()
        print(f"  player_data normalized leagues: {normalized}")

    # Normalize season format: "2019-2020" -> "2019-20"
    if "season" in out.columns:
        def _short_season(s):
            s = str(s).strip()
            if len(s) == 9 and s[4] == "-":  # "2019-2020"
                return s[:4] + "-" + s[7:]   # "2019-20"
            return s
        out["season"] = out["season"].apply(_short_season)

    out = out.dropna(subset=["player", "league", "season"])

    # Deduplicate: keep the row with the most progressive passes for each
    # player-league-season combo (handles mid-season transfers)
    sort_col = "prog_passes_total" if "prog_passes_total" in out.columns else "player"
    out = (
        out
        .assign(**{sort_col: pd.to_numeric(out[sort_col], errors="coerce").fillna(0)})
        .sort_values(sort_col, ascending=False)
        .drop_duplicates(subset=["player", "league", "season"])
        .reset_index(drop=True)
    )
    return out


def merge_sources(std, sht, misc, understat=None, player_data=None) -> pd.DataFrame:
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

    if player_data is not None:
        before = len(df)
        df = df.merge(
            player_data,
            on=PLAYER_DATA_MERGE_KEYS,
            how="left",
            suffixes=("", "_pd"),
        )
        matched   = int(df["prog_passes_total"].notna().sum()) if "prog_passes_total" in df.columns else 0
        unmatched = before - matched
        print(f"  player_data join: {matched}/{before} rows matched ({unmatched} unmatched)")
        if unmatched > 0 and matched == 0:
            # Diagnose: show sample keys from both sides
            print("  WARNING: 0 matches — checking key overlap:")
            print(f"    FBref leagues:       {sorted(df['league'].unique())}")
            print(f"    player_data leagues: {sorted(player_data['league'].unique())}")
            print(f"    FBref seasons:       {sorted(df['season'].unique())[:5]}")
            print(f"    player_data seasons: {sorted(player_data['season'].unique())[:5]}")
            print(f"    FBref sample player: {df['player'].iloc[0]!r}")
            print(f"    player_data sample:  {player_data['player'].iloc[0]!r}")

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
    if "np_xg_total" in df.columns:
        df["np_xg_per90"] = (df["np_xg_total"] / n).round(4)

    # player_data totals → per-90
    # All totals are divided by n = Playing Time_90s from standard_data.
    # This is the correct denominator — it is already cleaned and available
    # for every player. The previous approach of deriving nineties from
    # "Avg Mins per Match × Matches Played" was wrong because that column
    # contains the season total minutes, not the per-match average.
    if "prog_passes_total" in df.columns:
        df["progressive_passes_per90"] = (
            pd.to_numeric(df["prog_passes_total"], errors="coerce") / n
        ).round(4)

    if "key_passes_total_pd" in df.columns:
        df["key_passes_per90"] = (
            pd.to_numeric(df["key_passes_total_pd"], errors="coerce") / n
        ).round(4)
    elif "key_passes_total" in df.columns:
        df["key_passes_per90"] = (
            pd.to_numeric(df["key_passes_total"], errors="coerce") / n
        ).round(4)

    # pass_completion_pct and long_pass_pct are already percentages — no division
    for pct_col in ["pass_completion_pct", "long_pass_pct"]:
        if pct_col in df.columns:
            df[pct_col] = pd.to_numeric(df[pct_col], errors="coerce").fillna(0)

    # gca_per90 and sca_per90 already arrive as per-90 values from the CSV
    if "gca_per90" in df.columns:
        df["gca_per90"] = pd.to_numeric(df["gca_per90"], errors="coerce").fillna(0)

    if "prog_carries_total" in df.columns:
        df["prog_carries_per90"] = (
            pd.to_numeric(df["prog_carries_total"], errors="coerce") / n
        ).round(4)

    if "carries_final_third_total" in df.columns:
        df["carries_final_third_per90"] = (
            pd.to_numeric(df["carries_final_third_total"], errors="coerce") / n
        ).round(4)

    # FBref misc fouls committed → per-90
    if "fouls_committed_total" in df.columns:
        df["fouls_committed_per90"] = (df["fouls_committed_total"] / n).round(4)

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
        "progressive_passes_per90", "pass_completion_pct", "long_pass_pct",
        "gca_per90", "prog_carries_per90", "carries_final_third_per90",
        "sca_per90", "passes_final_third_total", "fouls_committed_per90",
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


def run_pca_and_clustering(df: pd.DataFrame):
    df_active = df[df["minutes"] >= MIN_MINUTES].copy()

    # Restrict PCA fitting to players that have all player_data columns populated.
    # This ensures pass_completion_pct, progressive_passes_per90, etc. are real
    # values and not zeros from unmatched joins.
    pd_cols = [
        "progressive_passes_per90", "key_passes_per90", "pass_completion_pct",
        "long_pass_pct", "gca_per90", "prog_carries_per90", "carries_final_third_per90",
    ]
    has_pd  = df_active[pd_cols].notna().all(axis=1) & df_active[pd_cols].gt(0).any(axis=1)
    n_with    = has_pd.sum()
    n_without = (~has_pd).sum()
    print(f"  PCA subset: {n_with} players with full features, "
          f"{n_without} excluded from scatter (no player_data match)")

    df_pca = df_active[has_pd].copy()

    for c in FEATURE_COLS:
        if c not in df_active.columns:
            df_active[c] = 0.0
        if c not in df_pca.columns:
            df_pca[c] = 0.0

    # Fit scaler and PCA on the full-feature subset
    X_pca = df_pca[FEATURE_COLS].fillna(0).values
    scaler = StandardScaler()
    X_pca_scaled = scaler.fit_transform(X_pca)

    pca    = PCA(n_components=PCA_COMPONENTS, random_state=RANDOM_SEED)
    coords = pca.fit_transform(X_pca_scaled)

    for i in range(PCA_COMPONENTS):
        df_pca[f"pc{i+1}"] = coords[:, i].round(4)

    kmeans = KMeans(n_clusters=N_CLUSTERS, random_state=RANDOM_SEED, n_init=12)
    df_pca["cluster"] = kmeans.fit_predict(coords)

    variance = pca.explained_variance_ratio_.tolist()
    cumvar   = sum(variance)
    print(f"  PCA variance explained: " +
          " ".join(f"PC{i+1}={v:.3f}" for i,v in enumerate(variance)) +
          f"  (cumulative: {cumvar:.3f})")

    # Build Kroos centroid in PCA space from prime seasons
    kroos_mask_pca = (
        (df_pca["player"] == KROOS_NAME) &
        (df_pca["season"] >= KROOS_PRIME_START) &
        (df_pca["season"] <= KROOS_PRIME_END)
    )
    kroos_prime = df_pca[kroos_mask_pca]

    if kroos_prime.empty:
        print(f"  Warning: Kroos not found in PCA subset for "
              f"{KROOS_PRIME_START}–{KROOS_PRIME_END}. "
              f"Using feature-space centroid instead.")
        # Fall back: build centroid in raw feature space from all Kroos rows
        kroos_all = df_active[df_active["player"] == KROOS_NAME]
        if kroos_all.empty:
            df_pca["similarity_to_kroos"] = 0.0
            kroos_centroid_pca = None
        else:
            kroos_feat = scaler.transform(kroos_all[FEATURE_COLS].fillna(0).values)
            kroos_centroid_pca = pca.transform(kroos_feat).mean(axis=0)
    else:
        pc_cols = [f"pc{i+1}" for i in range(PCA_COMPONENTS)]
        kroos_centroid_pca = kroos_prime[pc_cols].mean().values

    # Features always available regardless of player_data match.
    # Used to compute similarity for players missing the player_data columns.
    CORE_FEATURE_COLS = [
        "goals_per90", "assists_per90", "np_xg_per90", "xa_per90",
        "shots_per90", "tackles_won", "interceptions",
    ]

    if kroos_centroid_pca is not None:
        # Similarity for full-feature players (in PCA space, all 4 components)
        distances = np.linalg.norm(coords - kroos_centroid_pca, axis=1)
        max_dist  = distances.max() or 1
        df_pca["similarity_to_kroos"] = (1 - distances / max_dist).round(4)

        # Similarity for players WITHOUT player_data: compute in the sub-space
        # of core features only, using a separate scaler fitted on the same
        # full-feature subset (so the scale is consistent).
        core_scaler = StandardScaler()
        X_core_pca = df_pca[CORE_FEATURE_COLS].fillna(0).values
        core_scaler.fit(X_core_pca)

        # Kroos centroid in core feature space
        kroos_core = df_pca[df_pca["player"] == KROOS_NAME][CORE_FEATURE_COLS].fillna(0).values
        if len(kroos_core):
            kroos_core_centroid = core_scaler.transform(kroos_core).mean(axis=0)
        else:
            # Fall back: use all Kroos rows in df_active
            kroos_all_core = df_active[df_active["player"] == KROOS_NAME][CORE_FEATURE_COLS].fillna(0).values
            kroos_core_centroid = core_scaler.transform(kroos_all_core).mean(axis=0) if len(kroos_all_core) else np.zeros(len(CORE_FEATURE_COLS))

        # Max distance in core space (calibrated on full-feature players so scale matches)
        X_core_all_pca = core_scaler.transform(df_pca[CORE_FEATURE_COLS].fillna(0).values)
        core_dists_pca  = np.linalg.norm(X_core_all_pca - kroos_core_centroid, axis=1)
        core_max_dist   = core_dists_pca.max() or 1

        # Now compute for players without player_data
        no_pd_mask = ~has_pd
        if no_pd_mask.sum() > 0:
            df_no_pd = df_active[no_pd_mask].copy()
            X_core_no_pd = core_scaler.transform(df_no_pd[CORE_FEATURE_COLS].fillna(0).values)
            dists_no_pd  = np.linalg.norm(X_core_no_pd - kroos_core_centroid, axis=1)
            df_no_pd["similarity_to_kroos"] = (1 - dists_no_pd / core_max_dist).round(4).clip(0, 1)

            # Combine: full-feature players from df_pca, rest from df_no_pd
            sim_full  = df_pca[["player_id", "similarity_to_kroos"]]
            sim_nopd  = df_no_pd[["player_id", "similarity_to_kroos"]]
            sim_all   = pd.concat([sim_full, sim_nopd], ignore_index=True)
        else:
            sim_all = df_pca[["player_id", "similarity_to_kroos"]]

        df_active = df_active.merge(sim_all, on="player_id", how="left")

    # Merge PCA coords + cluster back (only full-feature players get pc1-pc4)
    pca_cols = ["player_id", "pc1", "pc2", "pc3", "pc4", "cluster"]
    df = df.merge(df_pca[pca_cols], on="player_id", how="left")

    # Merge similarity for ALL players (including those without player_data)
    sim_cols = ["player_id", "similarity_to_kroos"]
    df = df.merge(df_active[sim_cols], on="player_id", how="left")

    return df, variance


def build_players_csv(df: pd.DataFrame) -> pd.DataFrame:
    cols = [
        "player_id", "player", "team", "league", "season",
        "age", "current_age", "nationality", "minutes",
        # FBref standard + shooting + misc
        "goals_per90", "assists_per90", "ga_nopk_per90",
        "shots_per90", "shots_on_target_per90", "goals_per_shot",
        "tackles_won", "interceptions", "fouls_drawn_per90", "crosses_per90",
        # player_data season CSVs
        "progressive_passes_per90", "key_passes_per90", "pass_completion_pct",
        "long_pass_pct", "gca_per90", "prog_carries_per90", "carries_final_third_per90",
        "sca_per90", "passes_final_third_total",
        # FBref misc (additional)
        "fouls_committed_per90",
        # Understat
        "xa_per90", "np_xg_per90", "xg_chain", "xg_buildup",
        # PCA + clustering
        "cluster", "pc1", "pc2", "pc3", "pc4", "similarity_to_kroos",
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
            "current_age":         int(row["current_age"]) if pd.notna(row.get("current_age")) else None,
            "minutes":             int(row["minutes"]),
            "cluster":             int(row["cluster"]),
            "pc1":                 round(float(row["pc1"]), 4),
            "pc2":                 round(float(row["pc2"]), 4),
            "pc3":                 round(float(row["pc3"]), 4) if pd.notna(row.get("pc3")) else None,
            "pc4":                 round(float(row["pc4"]), 4) if pd.notna(row.get("pc4")) else None,
            "similarity_to_kroos": round(float(row["similarity_to_kroos"]), 4),
            # FBref standard + shooting + misc
            "goals_per90":              g("goals_per90"),
            "assists_per90":            g("assists_per90"),
            "ga_nopk_per90":            g("ga_nopk_per90"),
            "shots":                    g("shots_per90"),
            "shots_on_target":          g("shots_on_target_per90"),
            "goals_per_shot":           g("goals_per_shot"),
            "tackles":                  g("tackles_won"),
            "interceptions":            g("interceptions"),
            "fouls_drawn":              g("fouls_drawn_per90"),
            "crosses":                  g("crosses_per90"),
            # player_data season CSVs
            "progressive_passes_per90":  g("progressive_passes_per90"),
            "key_passes_per90":          g("key_passes_per90"),
            "pass_completion_pct":       g("pass_completion_pct"),
            "long_pass_pct":             g("long_pass_pct"),
            "gca_per90":                 g("gca_per90"),
            "prog_carries_per90":        g("prog_carries_per90"),
            "carries_final_third_per90": g("carries_final_third_per90"),
            "sca_per90":                 g("sca_per90"),
            "fouls_committed_per90":     g("fouls_committed_per90"),
            # Understat
            "xa_per90":                 g("xa_per90"),
            "np_xg_per90":              g("np_xg_per90"),
            "xg_chain":                 g("xg_chain"),
            "xg_buildup":               g("xg_buildup"),
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
            # FBref standard + shooting + misc
            "goals_per90":              f("goals_per90"),
            "assists_per90":            f("assists_per90"),
            "ga_nopk_per90":            f("ga_nopk_per90"),
            "shots":                    f("shots_per90"),
            "shots_on_target":          f("shots_on_target_per90"),
            "goals_per_shot":           f("goals_per_shot"),
            "tackles":                  f("tackles_won"),
            "interceptions":            f("interceptions"),
            "fouls_drawn":              f("fouls_drawn_per90"),
            "crosses":                  f("crosses_per90"),
            # player_data season CSVs
            "progressive_passes_per90":  f("progressive_passes_per90"),
            "key_passes_per90":          f("key_passes_per90"),
            "pass_completion_pct":       f("pass_completion_pct"),
            "long_pass_pct":             f("long_pass_pct"),
            "gca_per90":                 f("gca_per90"),
            "prog_carries_per90":        f("prog_carries_per90"),
            "carries_final_third_per90": f("carries_final_third_per90"),
            "sca_per90":                 f("sca_per90"),
            "fouls_committed_per90":     f("fouls_committed_per90"),
            # Understat
            "xa_per90":                 f("xa_per90"),
            "np_xg_per90":              f("np_xg_per90"),
            "xg_chain":                 f("xg_chain"),
            "xg_buildup":               f("xg_buildup"),
            "cluster":    int(row["cluster"]) if pd.notna(row.get("cluster")) else None,
            "pc1":        round(float(row["pc1"]), 4) if pd.notna(row.get("pc1")) else None,
            "pc2":        round(float(row["pc2"]), 4) if pd.notna(row.get("pc2")) else None,
            "pc3":        round(float(row["pc3"]), 4) if pd.notna(row.get("pc3")) else None,
            "pc4":        round(float(row["pc4"]), 4) if pd.notna(row.get("pc4")) else None,
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
    standard_raw, shooting_raw, misc_raw, understat_raw, player_data_raw = load_raw()

    print("Extracting relevant columns...")
    std  = extract_standard(standard_raw)
    sht  = extract_shooting(shooting_raw)
    misc = extract_misc(misc_raw)
    us   = extract_understat(understat_raw) if understat_raw is not None else None
    pd_  = extract_player_data(player_data_raw) if player_data_raw is not None else None

    print("Merging sources...")
    df = merge_sources(std, sht, misc, us, pd_)

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
