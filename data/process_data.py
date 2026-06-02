"""
process_data.py

Reads one CSV per season exported from FBref (same format as players_data-2022_2023.csv),
processes and combines them, runs PCA and k-means clustering, computes
similarity_to_kroos, and writes the four files the visualization expects.

Usage:
    Place all season CSVs inside data/raw/ following this naming convention:
        players_data-YYYY_YYYY.csv   e.g. players_data-2022_2023.csv

    Then run from the project root:
        python data/process_data.py

Output (written to data/processed/):
    players.csv
    pca_coords.json
    kroos_stats.json
    trophy_timeline.json   (stub — edit manually with real trophy data)
"""

import os
import re
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
MIN_MINUTES       = 500
N_CLUSTERS        = 5
PCA_COMPONENTS    = 2
RANDOM_SEED       = 42

# Positions that qualify as midfielders
MF_POSITIONS = {"MF", "MFFW", "MFDF"}

# Feature columns used for PCA, clustering, and similarity.
# All of these must be per-90 values in the final dataframe.
FEATURE_COLS = [
    "progressive_passes",
    "key_passes",
    "pass_completion_pct",
    "tackles",
    "interceptions",
    "goals_per90",
    "assists_per90",
    "shots",
]

# Mapping from FBref column names to internal names.
# Goals and Assists in FBref are season totals; everything else is already per 90.
COLUMN_MAP = {
    "Player":       "player",
    "Nation":       "nationality",
    "Pos":          "position",
    "Squad":        "team",
    "Comp":         "league",
    "Age":          "age",
    "Min":          "minutes",
    "90s":          "nineties",
    "Goals":        "goals_total",
    "Assists":      "assists_per90",
    "Shots":        "shots",
    "PasProg":      "progressive_passes",
    "PasAss":       "key_passes",
    "PasTotCmp%":   "pass_completion_pct",
    "Tkl":          "tackles",
    "Int":          "interceptions",
}

VALID_LEAGUES = {
    "Premier League",
    "La Liga",
    "Serie A",
    "Bundesliga",
    "Ligue 1",
}

# Real Madrid trophy data — edit this manually if needed.
# true = won, false = did not win that competition that season.
TROPHY_TIMELINE = [
    {"season": "2017-18", "laliga": False, "copa": False, "ucl": True},
    {"season": "2018-19", "laliga": True,  "copa": False, "ucl": False},
    {"season": "2019-20", "laliga": True,  "copa": False, "ucl": False},
    {"season": "2020-21", "laliga": False, "copa": True,  "ucl": False},
    {"season": "2021-22", "laliga": True,  "copa": False, "ucl": True},
    {"season": "2022-23", "laliga": False, "copa": True,  "ucl": False},
    {"season": "2023-24", "laliga": False, "copa": False, "ucl": True},
    {"season": "2024-25", "laliga": False, "copa": False, "ucl": False},
]


def season_label_from_filename(filename):
    """
    Extracts the season string from the filename convention.
    players_data-2022_2023.csv  ->  '2022-23'
    """
    match = re.search(r"(\d{4})_(\d{4})", filename)
    if not match:
        raise ValueError(
            f"Cannot extract season from filename: {filename}\n"
            f"Expected format: players_data-YYYY_YYYY.csv"
        )
    start = match.group(1)
    end   = match.group(2)[-2:]
    return f"{start}-{end}"


def load_season(filepath, season):
    df = pd.read_csv(filepath)

    # Keep only columns we need
    available = {k: v for k, v in COLUMN_MAP.items() if k in df.columns}
    missing   = [k for k in COLUMN_MAP if k not in df.columns]
    if missing:
        print(f"  Warning: columns not found in {os.path.basename(filepath)}: {missing}")

    df = df[list(available.keys())].rename(columns=available)

    # Filter to midfielders in the five target leagues
    df = df[df["position"].isin(MF_POSITIONS)]
    df = df[df["league"].isin(VALID_LEAGUES)]

    # Convert numeric columns
    numeric = [
        "age", "minutes", "nineties", "goals_total", "assists_per90",
        "shots", "progressive_passes", "key_passes",
        "pass_completion_pct", "tackles", "interceptions",
    ]
    for col in numeric:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    # Goals is a season total — convert to per 90
    if "goals_total" in df.columns and "nineties" in df.columns:
        df["goals_per90"] = np.where(
            df["nineties"] > 0,
            df["goals_total"] / df["nineties"],
            0.0,
        ).round(4)
    else:
        df["goals_per90"] = 0.0

    # Add season identifier and a unique row id
    df["season"] = season
    df["player_id"] = df["player"].str.strip() + "_" + season

    # Drop duplicates — keep the row with more minutes if a player appears twice
    df = df.sort_values("minutes", ascending=False).drop_duplicates(
        subset=["player", "league", "season"]
    )

    return df


def load_all_seasons():
    files = sorted(f for f in os.listdir(RAW_DIR) if f.endswith(".csv"))
    if not files:
        raise FileNotFoundError(
            f"No CSV files found in {RAW_DIR}.\n"
            f"Place your season files there following the naming convention:\n"
            f"  players_data-2022_2023.csv"
        )

    frames = []
    for filename in files:
        season = season_label_from_filename(filename)
        path   = os.path.join(RAW_DIR, filename)
        print(f"  Loading {filename}  ->  season {season}")
        frames.append(load_season(path, season))

    df = pd.concat(frames, ignore_index=True)
    print(f"  Combined: {len(df)} rows, {df['player'].nunique()} unique players")
    return df


def run_pca_and_clustering(df):
    """
    Runs PCA (2 components) and k-means clustering on midfielders with
    enough minutes. Writes pc1, pc2, cluster, and similarity_to_kroos
    back onto the full dataframe.
    """
    df_active = df[df["minutes"] >= MIN_MINUTES].copy()

    X = df_active[FEATURE_COLS].fillna(0).values

    scaler  = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    pca    = PCA(n_components=PCA_COMPONENTS, random_state=RANDOM_SEED)
    coords = pca.fit_transform(X_scaled)

    df_active = df_active.copy()
    df_active["pc1"] = coords[:, 0].round(4)
    df_active["pc2"] = coords[:, 1].round(4)

    kmeans = KMeans(n_clusters=N_CLUSTERS, random_state=RANDOM_SEED, n_init=12)
    df_active["cluster"] = kmeans.fit_predict(X_scaled)

    variance_explained = pca.explained_variance_ratio_.tolist()
    print(f"  PCA variance explained: PC1={variance_explained[0]:.3f}, PC2={variance_explained[1]:.3f}")

    # Compute similarity to Kroos using his prime seasons
    kroos_mask = (
        (df_active["player"] == KROOS_NAME) &
        (df_active["season"] >= KROOS_PRIME_START) &
        (df_active["season"] <= KROOS_PRIME_END)
    )
    kroos_prime = df_active[kroos_mask]

    if kroos_prime.empty:
        print(f"  Warning: no Kroos rows found for seasons {KROOS_PRIME_START}–{KROOS_PRIME_END}.")
        print(f"  similarity_to_kroos will be 0 for all players.")
        df_active["similarity_to_kroos"] = 0.0
    else:
        kroos_centroid_raw    = kroos_prime[FEATURE_COLS].fillna(0).mean().values
        kroos_centroid_scaled = scaler.transform([kroos_centroid_raw])[0]

        distances = np.linalg.norm(X_scaled - kroos_centroid_scaled, axis=1)
        max_dist  = distances.max() or 1.0
        df_active["similarity_to_kroos"] = (1 - distances / max_dist).round(4)

    # Merge PCA results back into the full dataframe (low-minute players get NaN)
    pca_cols = ["player_id", "pc1", "pc2", "cluster", "similarity_to_kroos"]
    df = df.merge(df_active[pca_cols], on="player_id", how="left")

    return df, variance_explained


def build_players_csv(df):
    cols = [
        "player_id", "player", "team", "league", "season", "position",
        "age", "nationality", "minutes",
        "progressive_passes", "key_passes", "pass_completion_pct",
        "tackles", "interceptions",
        "goals_per90", "assists_per90", "shots",
        "cluster", "pc1", "pc2", "similarity_to_kroos",
    ]
    # Keep only columns that exist
    cols = [c for c in cols if c in df.columns]
    return df[cols].sort_values(["season", "player"])


def build_pca_json(df, variance_explained):
    active = df[df["pc1"].notna()].copy()

    records = []
    for _, row in active.iterrows():
        records.append({
            "id":                  str(row["player_id"]),
            "player":              row["player"],
            "team":                row["team"],
            "league":              row["league"],
            "season":              row["season"],
            "age":                 int(row["age"]) if not pd.isna(row["age"]) else None,
            "minutes":             int(row["minutes"]),
            "cluster":             int(row["cluster"]),
            "pc1":                 round(float(row["pc1"]), 4),
            "pc2":                 round(float(row["pc2"]), 4),
            "similarity_to_kroos": round(float(row["similarity_to_kroos"]), 4),
            "prog_passes":         round(float(row["progressive_passes"]), 4),
            "key_passes":          round(float(row["key_passes"]), 4),
            "tackles":             round(float(row["tackles"]), 4),
            "interceptions":       round(float(row["interceptions"]), 4),
            "goals_per90":         round(float(row["goals_per90"]), 4),
            "assists_per90":       round(float(row["assists_per90"]), 4),
            "shots":               round(float(row["shots"]), 4),
        })

    return {
        "players":            records,
        "variance_explained": [round(v, 4) for v in variance_explained],
    }


def build_kroos_json(df):
    kroos = df[df["player"] == KROOS_NAME].sort_values("season")

    if kroos.empty:
        print("  Warning: no Kroos data found. kroos_stats.json will be empty.")
        return {"kroos": []}

    records = []
    for _, row in kroos.iterrows():
        records.append({
            "id":                  str(row["player_id"]),
            "season":              row["season"],
            "age":                 int(row["age"]) if not pd.isna(row["age"]) else None,
            "minutes":             int(row["minutes"]),
            "progressive_passes":  round(float(row.get("progressive_passes", 0)), 4),
            "key_passes":          round(float(row.get("key_passes", 0)), 4),
            "pass_completion_pct": round(float(row.get("pass_completion_pct", 0)), 4),
            "tackles":             round(float(row.get("tackles", 0)), 4),
            "interceptions":       round(float(row.get("interceptions", 0)), 4),
            "goals_per90":         round(float(row.get("goals_per90", 0)), 4),
            "assists_per90":       round(float(row.get("assists_per90", 0)), 4),
            "shots":               round(float(row.get("shots", 0)), 4),
            "cluster":             int(row["cluster"]) if not pd.isna(row.get("cluster", float("nan"))) else None,
            "pc1":                 round(float(row["pc1"]), 4) if not pd.isna(row.get("pc1", float("nan"))) else None,
            "pc2":                 round(float(row["pc2"]), 4) if not pd.isna(row.get("pc2", float("nan"))) else None,
        })

    return {"kroos": records}


def main():
    os.makedirs(PROCESSED_DIR, exist_ok=True)
    os.makedirs(RAW_DIR,       exist_ok=True)

    print("Loading season files...")
    df = load_all_seasons()

    print("Running PCA and clustering...")
    df, variance = run_pca_and_clustering(df)

    print("Writing players.csv...")
    players_df = build_players_csv(df)
    players_df.to_csv(os.path.join(PROCESSED_DIR, "players.csv"), index=False)
    print(f"  {len(players_df)} rows written")

    print("Writing pca_coords.json...")
    pca_data = build_pca_json(df, variance)
    with open(os.path.join(PROCESSED_DIR, "pca_coords.json"), "w") as f:
        json.dump(pca_data, f, separators=(",", ":"))
    print(f"  {len(pca_data['players'])} player-season records")

    print("Writing kroos_stats.json...")
    kroos_data = build_kroos_json(df)
    with open(os.path.join(PROCESSED_DIR, "kroos_stats.json"), "w") as f:
        json.dump(kroos_data, f, separators=(",", ":"))
    print(f"  {len(kroos_data['kroos'])} Kroos seasons")

    print("Writing trophy_timeline.json...")
    with open(os.path.join(PROCESSED_DIR, "trophy_timeline.json"), "w") as f:
        json.dump(TROPHY_TIMELINE, f, separators=(",", ":"), indent=2)

    print()
    print("Done. Files written to data/processed/")
    print(f"  Seasons found: {sorted(df['season'].unique())}")
    print(f"  Total players: {df['player'].nunique()}")
    print(f"  Kroos seasons: {sorted(df[df['player'] == KROOS_NAME]['season'].tolist())}")


if __name__ == "__main__":
    main()
