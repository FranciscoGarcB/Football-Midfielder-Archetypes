"""
scrape.py

Downloads midfielder stats from FBref via soccerdata for the Big 5 European
Leagues across the relevant seasons, then saves the three stat tables to
data/raw/ for process_data.py to consume.

Run once (requires internet + soccerdata library):
    pip install soccerdata
    python data/scrape.py
"""

import os
import soccerdata as sd
import pandas as pd


def process_df(dataframe: pd.DataFrame) -> pd.DataFrame:
    dataframe.columns = [
        f"{col[0]}_{col[1]}" if col[0] and not col[0].startswith("Unnamed") else col[1]
        for col in dataframe.columns
    ]
    dataframe.columns = [col.rstrip("_") for col in dataframe.columns]
    dataframe = dataframe.reset_index()

    if "league" in dataframe.columns:
        dataframe["league"] = dataframe["league"].fillna("Bundesliga")
        dataframe["league"] = dataframe["league"].astype(str).str.split("-").str[-1]

    # Filter to midfielders only
    if "pos" in dataframe.columns:
        dataframe = dataframe[dataframe["pos"].str.contains("MF", na=False)]
        dataframe.drop("pos", axis=1, inplace=True)

    # Normalize season codes: soccerdata uses integers like 1920, 2122, etc.
    # Convert to the "YYYY-YY" string format used throughout the project.
    if "season" in dataframe.columns:
        dataframe["season"] = dataframe["season"].apply(season_int_to_label)

    return dataframe


def season_int_to_label(code) -> str:
    """
    Converts soccerdata season codes to readable labels.
    1920  ->  '2019-20'
    2223  ->  '2022-23'
    2526  ->  '2025-26'
    """
    s = str(int(code))
    if len(s) == 4:
        start = 2000 + int(s[:2])
        end   = s[2:]
        return f"{start}-{end}"
    return str(code)


OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "raw")

SEASONS = [1920, 2021, 2122, 2223, 2324, 2425, 2526]

fbref = sd.FBref(
    leagues="Big 5 European Leagues Combined",
    seasons=SEASONS,
)

print("Fetching standard stats...")
standard_data = fbref.read_player_season_stats(stat_type="standard")

print("Fetching shooting stats...")
shooting_data = fbref.read_player_season_stats(stat_type="shooting")

print("Fetching misc stats...")
misc_data = fbref.read_player_season_stats(stat_type="misc")

dfs = {
    "standard_data": standard_data,
    "shooting_data": shooting_data,
    "misc_data":     misc_data,
}

for name in dfs:
    dfs[name] = process_df(dfs[name])

os.makedirs(OUTPUT_DIR, exist_ok=True)

for name, df in dfs.items():
    path = os.path.join(OUTPUT_DIR, f"{name}.csv")
    df.to_csv(path, index=False, encoding="utf-8")
    print(f"  Saved {path}  ({len(df)} rows)")