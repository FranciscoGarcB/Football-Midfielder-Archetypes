"""
scrape.py

Downloads midfielder stats from FBref via soccerdata for the Big 5 European
Leagues across the relevant seasons, then saves the three stat tables to
data/raw/ for process_data.py to consume.

Run once (requires internet + soccerdata installed):
    pip install soccerdata pandas
    python data/scrape.py
"""

import os
import soccerdata as sd
import pandas as pd


def season_int_to_label(code) -> str:
    """
    Converts soccerdata season codes to readable labels.
    1920 -> '2019-20', 2223 -> '2022-23', 2526 -> '2025-26'
    """
    s = str(int(code))
    if len(s) == 4:
        start = 2000 + int(s[:2])
        end   = s[2:]
        return f"{start}-{end}"
    return str(code)


def flatten(df: pd.DataFrame) -> pd.DataFrame:
    """
    Converts a soccerdata DataFrame (MultiIndex columns + MultiIndex index)
    into a flat, clean DataFrame ready to save as CSV.

    Order of operations matters:
      1. reset_index() first — moves league/season/team/player from the index
         into regular columns while they still have their original string names.
      2. Flatten MultiIndex columns — at this point the index columns are
         already plain strings, so no truncation occurs.
      3. Strip trailing underscores left by unnamed top-level groups.
    """
    df = df.reset_index()

    if isinstance(df.columns, pd.MultiIndex):
        df.columns = [
            f"{top}_{bot}" if top and not top.startswith("Unnamed") else bot
            for top, bot in df.columns
        ]
    df.columns = [col.rstrip("_") for col in df.columns]

    return df


def process_df(df: pd.DataFrame) -> pd.DataFrame:
    """
    Post-flattening cleanup: normalize league names, filter to midfielders,
    convert season codes.
    """
    if "league" in df.columns:
        df["league"] = df["league"].fillna("Bundesliga")
        df["league"] = df["league"].astype(str).str.split("-").str[-1]

    if "pos" in df.columns:
        df = df[df["pos"].str.contains("MF", na=False)].copy()
        df.drop(columns=["pos"], inplace=True)

    if "season" in df.columns:
        df["season"] = df["season"].apply(season_int_to_label)

    return df


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
    dfs[name] = process_df(flatten(dfs[name]))

os.makedirs(OUTPUT_DIR, exist_ok=True)

print("Fetching Understat stats...")
understat = sd.Understat(
    leagues=["ENG-Premier League", "ESP-La Liga", "FRA-Ligue 1",
             "GER-Bundesliga", "ITA-Serie A"],
    seasons=SEASONS,
)
understat_data = understat.read_player_season_stats(force_cache=True)
understat_data = process_df(flatten(understat_data))

# Keep only the columns that add value over FBref
UNDERSTAT_KEEP = [
    "player", "league", "season",
    "xg", "np_xg", "xa", "key_passes",
    "xg_chain", "xg_buildup",
]
understat_data = understat_data[[c for c in UNDERSTAT_KEEP if c in understat_data.columns]]

path = os.path.join(OUTPUT_DIR, "understat_data.csv")
understat_data.to_csv(path, index=False, encoding="utf-8")
print(f"  Saved {path}  ({len(understat_data)} rows)")

for name, df in dfs.items():
    path = os.path.join(OUTPUT_DIR, f"{name}.csv")
    df.to_csv(path, index=False, encoding="utf-8")
    print(f"\n{name} columns ({len(df.columns)}):")
    print("  " + ", ".join(df.columns.tolist()))
    print(f"  Saved {path}  ({len(df)} rows)")