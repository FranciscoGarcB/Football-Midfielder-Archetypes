import pandas as pd
import os

# Load data
df_top5 = pd.read_csv("raw/player_data/Top5_League_Players_2017to2024_dataset.csv", sep=";", decimal=",")

# Define the mapping
col_mapping = {
    "player": "player",
    "nation_": "nation",
    "pos_": "pos",
    "team": "squad",
    "league": "comp",
    "age_": "age",
    "born_": "born",
    "Playing Time_MP": "Matches Played",
    "Playing Time_Min": "Avg Mins per Match",
    "Performance_Gls": "Goals",
    "Performance_Ast": "Assists",
    "Performance_G+A": "Goals & Assists",
    "Performance_G-PK": "Non Penalty Goals",
    "Performance_PK": "Penalty Kicks Made",
    "Expected_xG": "Expected Goals",
    "Expected_npxG": "Exp NPG",
    "Progression_PrgC": "Progressive Carries",
    "Progression_PrgP": "Progressive Passes",
    "Per 90 Minutes_Gls": "Goals p 90",
    "Per 90 Minutes_Ast": "Assists p 90",
    "Tackles_Tkl": "Tackles attempted",
    "Tackles_TklW": "Tackles Won",
    "Challenges_Tkl%": "% Dribbles tackled",
    "Blocks_Sh": "Shots blocked",
    "Blocks_Pass": "Passes blocked",
    "Int_": "Interceptions",
    "Clr_": "Clearances",
    "Err_": "Errors made",
    "Total_Cmp": "Passes Completed",
    "Total_Att": "Passes Attempted",
    "Total_Cmp%": "Pass completion %",
    "Total_PrgDist": "Progressive passes distance",
    "Short_Cmp%": "% Short pass completed",
    "Medium_Cmp%": "% Medium passes completed",
    "Long_Cmp%": "% Long passes completed",
    "KP_": "Key passes",
    "1/3_": "1/3",
    "PPA_": "Passes into penalty area",
    "Touches_Def Pen": "touches_def_pen",
    "Take-Ons_Att": "Take ons attempted",
    "Take-Ons_Succ%": "% Successful take-ons",
    "Take-Ons_Tkld": "Times tackled during take-on",
    "Carries_PrgC": "carries_prgc",
    "Carries_1/3": "carries final 3rd",
    "Carries_CPA": "carries penalty area",
    "Carries_Mis": "Possessions lost",
    "Standard_Sh": "Total Shots",
    "Standard_SoT%": "% Shots on target",
    "Standard_Sh/90": "Shots p 90",
    "Standard_G/Sh": "Goals per shot",
    "Standard_G/SoT": "Goals per shot on target",
    "Aerial Duels_Won%": "% Aerial Duels won",
    "SCA_SCA90": "Shot creating actions p 90",
    "GCA_GCA90": "Goal creating actions p 90"
}

target_cols = [
    "rk", "player", "nation", "pos", "squad", "comp", "age", "born",
    "Matches Played", "Avg Mins per Match", "Goals", "Assists", "Goals & Assists",
    "Non Penalty Goals", "Penalty Kicks Made", "Expected Goals", "Exp NPG",
    "Progressive Carries", "Progressive Passes", "Goals p 90", "Assists p 90",
    "Tackles attempted", "Tackles Won", "% Dribbles tackled", "Shots blocked",
    "Passes blocked", "Interceptions", "Clearances", "Errors made", "Goals Against",
    "Goals against p 90", "Saves", "Saves %", "Clean Sheets", "% Clean sheets",
    "% Penalty saves", "Passes Completed", "Passes Attempted", "Pass completion %",
    "Progressive passes distance", "% Short pass completed", "% Medium passes completed",
    "% Long passes completed", "Key passes", "1/3", "Passes into penalty area",
    "touches_def_pen", "Take ons attempted", "% Successful take-ons",
    "Times tackled during take-on", "carries_prgc", "carries final 3rd",
    "carries penalty area", "Possessions lost", "Goals Scored", "Total Shots",
    "% Shots on target", "Shots p 90", "Goals per shot", "Goals per shot on target",
    "% Aerial Duels won", "Shot creating actions p 90", "Goal creating actions p 90",
    "Crosses Stopped", "season"
]

# Fill defaults for Goalkeeper stats / Columns missing from raw data
missing_or_default = {
    "Goals Against": 0, "Goals against p 90": 0.0, "Saves": 0, "Saves %": 0.0,
    "Clean Sheets": 0, "% Clean sheets": 0.0, "% Penalty saves": 0.0, "Crosses Stopped": 0
}

# Create the target directory if it does not exist already
output_dir = "raw/player_data"
os.makedirs(output_dir, exist_ok=True)

# Group by season and export
for season_id, group in df_top5.groupby("season"):
    # Initialize an empty DataFrame for the target layout
    df_out = pd.DataFrame(columns=target_cols)

    # Map the columns that exist
    for top_col, target_col in col_mapping.items():
        if top_col in group.columns:
            df_out[target_col] = group[top_col]

    # "Goals Scored" and "Goals" are technically duplicates in the cleaned sheet
    if "Performance_Gls" in group.columns:
        df_out["Goals Scored"] = group["Performance_Gls"]

    # Populate missing (Goalkeeper) stats with 0
    for col, default_val in missing_or_default.items():
        df_out[col] = default_val

    # Generate the "rk" (rank/index)
    df_out["rk"] = range(1, len(group) + 1)
    
    # Format the season name (e.g. 1718 -> 2017-2018)
    season_str = str(season_id)
    if len(season_str) == 4:
        formatted_season = f"20{season_str[:2]}-{season_str[2:]}"
    else:
        formatted_season = season_str 
        
    df_out["season"] = formatted_season

    df_out["Current Age"] = 2026 - pd.to_numeric(df_out["born"], errors="coerce")

    # Save to the new directory
    out_filename = f"cleaned_{formatted_season}.csv"
    out_filepath = os.path.join(output_dir, out_filename)

    df_out.to_csv(out_filepath, index=False)
    print(f"Successfully generated: {out_filepath} with {len(df_out)} rows.")