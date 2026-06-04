import soccerdata as sd
import pandas as pd
import os

output_dir = "data/raw"
os.makedirs(output_dir, exist_ok=True)

def process_df(dataframe: pd.DataFrame) -> pd.DataFrame:
    dataframe.columns = [
        f"{col[0]}_{col[1]}" if col[0] and not col[0].startswith("Unnamed") else col[1] 
        for col in dataframe.columns
    ]
    
    dataframe.columns = [col.rstrip('_') for col in dataframe.columns]
    
    dataframe = dataframe.reset_index()
    
    if 'league' in dataframe.columns:
        dataframe['league'] = dataframe['league'].fillna('Bundesliga')
        
        dataframe['league'] = dataframe['league'].astype(str).str.split('-').str[-1]

    # Filter to only midfielders
    if 'pos' in dataframe.columns:
        dataframe = dataframe[dataframe['pos'].str.contains('MF', na=False)]
        dataframe.drop("pos", axis=1, inplace=True)
        
    return dataframe

fbref = sd.FBref(leagues="Big 5 European Leagues Combined", seasons=[1920, 2021, 2122, 2223, 2324, 2425, 2526])

standard_data = fbref.read_player_season_stats(stat_type='standard')
shooting_data = fbref.read_player_season_stats(stat_type='shooting')
misc_data = fbref.read_player_season_stats(stat_type='misc')

dfs = {
    'standard_data': standard_data,
    'shooting_data': shooting_data,
    'misc_data': misc_data
}

for name, df in dfs.items():
    dfs[name] = process_df(df)

# Save files
dfs["standard_data"].to_csv(f"{output_dir}/standard_data.csv")
dfs["shooting_data"].to_csv(f"{output_dir}/shooting_data.csv")
dfs["misc_data"].to_csv(f"{output_dir}/misc_data.csv")