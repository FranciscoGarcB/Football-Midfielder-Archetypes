import os
import json
import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
from sklearn.cluster import KMeans

def clean_nation(nation):
    if pd.isna(nation):
        return ""
    nation = str(nation).strip()
    # Split by space and take the last element (e.g., "de GER" -> "GER", "eng ENG" -> "ENG")
    parts = nation.split()
    if len(parts) > 1:
        return parts[-1]
    return nation

def get_main_pos(pos):
    if pd.isna(pos):
        return ""
    pos = str(pos).strip()
    # Split by comma and take first part (e.g. "DF,MF" -> "DF")
    parts = pos.split(',')
    return parts[0]

def preprocess_and_analyze():
    print("Starting data preprocessing and analysis...")
    
    # 1. Load raw datasets
    df_22_raw = pd.read_csv('data/players_data-2022_2023.csv')
    df_24_raw = pd.read_csv('data/players_data-2024_2025.csv')
    
    print(f"Loaded 2022/23: {df_22_raw.shape[0]} players, 2024/25: {df_24_raw.shape[0]} players")
    
    # Clean positions and nations first
    df_22_raw['Nation'] = df_22_raw['Nation'].apply(clean_nation)
    df_22_raw['MainPos'] = df_22_raw['Pos'].apply(get_main_pos)
    df_22_raw = df_22_raw[(df_22_raw['MainPos'] != 'GK') & (df_22_raw['Min'] >= 450)].copy()
    
    df_24_raw['Nation'] = df_24_raw['Nation'].apply(clean_nation)
    df_24_raw['MainPos'] = df_24_raw['Pos'].apply(get_main_pos)
    df_24_raw = df_24_raw[(df_24_raw['MainPos'] != 'GK') & (df_24_raw['Min'] >= 450)].copy()
    
    # 2. Extract and scale per-90 stats
    # CRITICAL: 2022-2023 has almost all stats (except Goals/SoT) already per 90!
    # 2024-2025 has all stats as raw counts!
    
    # 2022-2023 processing
    p90_22 = pd.DataFrame()
    p90_22['Player'] = df_22_raw['Player']
    p90_22['Nation'] = df_22_raw['Nation']
    p90_22['Pos'] = df_22_raw['Pos']
    p90_22['MainPos'] = df_22_raw['MainPos']
    p90_22['Squad'] = df_22_raw['Squad']
    p90_22['Comp'] = df_22_raw['Comp']
    p90_22['Age'] = df_22_raw['Age']
    p90_22['Min'] = df_22_raw['Min']
    p90_22['90s'] = df_22_raw['90s']
    p90_22['Season'] = '2022-2023'
    
    # Per-90 mapping for 2022-23
    p90_22['Gls_90'] = df_22_raw['Goals'] / df_22_raw['90s']
    p90_22['Ast_90'] = df_22_raw['Assists'] # Already per 90
    p90_22['PrgP_90'] = df_22_raw['PasProg'] # Already per 90
    p90_22['PrgC_90'] = df_22_raw['CarProg'] # Already per 90
    p90_22['PPA_90'] = df_22_raw['PPA'] # Already per 90
    p90_22['SCA_90'] = df_22_raw['SCA'] # Already per 90
    p90_22['Touches_90'] = df_22_raw['Touches'] # Already per 90
    p90_22['Tkl_90'] = df_22_raw['Tkl'] # Already per 90
    p90_22['Int_90'] = df_22_raw['Int'] # Already per 90
    p90_22['Recov_90'] = df_22_raw['Recov'] # Already per 90
    p90_22['Blocks_90'] = df_22_raw['Blocks'] # Already per 90
    p90_22['SoT_90'] = df_22_raw['SoT'] # Already per 90
    
    # Reconstruct raw counts for 2022-23 card display
    p90_22['Gls'] = df_22_raw['Goals']
    p90_22['Ast'] = (df_22_raw['Assists'] * df_22_raw['90s']).round().astype(int)
    p90_22['PrgP'] = (df_22_raw['PasProg'] * df_22_raw['90s']).round().astype(int)
    p90_22['PrgC'] = (df_22_raw['CarProg'] * df_22_raw['90s']).round().astype(int)
    p90_22['PPA'] = (df_22_raw['PPA'] * df_22_raw['90s']).round().astype(int)
    p90_22['SCA'] = (df_22_raw['SCA'] * df_22_raw['90s']).round().astype(int)
    p90_22['Touches'] = (df_22_raw['Touches'] * df_22_raw['90s']).round().astype(int)
    p90_22['Tkl'] = (df_22_raw['Tkl'] * df_22_raw['90s']).round().astype(int)
    p90_22['Int'] = (df_22_raw['Int'] * df_22_raw['90s']).round().astype(int)
    p90_22['Recov'] = (df_22_raw['Recov'] * df_22_raw['90s']).round().astype(int)
    p90_22['Blocks'] = (df_22_raw['Blocks'] * df_22_raw['90s']).round().astype(int)
    p90_22['SoT'] = (df_22_raw['SoT'] * df_22_raw['90s']).round().astype(int)
    
    # 2024-2025 processing (all are raw counts)
    p90_24 = pd.DataFrame()
    p90_24['Player'] = df_24_raw['Player']
    p90_24['Nation'] = df_24_raw['Nation']
    p90_24['Pos'] = df_24_raw['Pos']
    p90_24['MainPos'] = df_24_raw['MainPos']
    p90_24['Squad'] = df_24_raw['Squad']
    p90_24['Comp'] = df_24_raw['Comp']
    p90_24['Age'] = df_24_raw['Age']
    p90_24['Min'] = df_24_raw['Min']
    p90_24['90s'] = df_24_raw['90s']
    p90_24['Season'] = '2024-2025'
    
    # Raw counts for 24-25
    p90_24['Gls'] = df_24_raw['Gls']
    p90_24['Ast'] = df_24_raw['Ast']
    p90_24['PrgP'] = df_24_raw['PrgP']
    p90_24['PrgC'] = df_24_raw['PrgC']
    p90_24['PPA'] = df_24_raw['PPA']
    p90_24['SCA'] = df_24_raw['SCA']
    p90_24['Touches'] = df_24_raw['Touches']
    p90_24['Tkl'] = df_24_raw['Tkl']
    p90_24['Int'] = df_24_raw['Int']
    p90_24['Recov'] = df_24_raw['Recov']
    p90_24['Blocks'] = df_24_raw['Blocks']
    p90_24['SoT'] = df_24_raw['SoT']
    
    # Per-90 scaling for 24-25
    p90_24['Gls_90'] = df_24_raw['Gls'] / df_24_raw['90s']
    p90_24['Ast_90'] = df_24_raw['Ast'] / df_24_raw['90s']
    p90_24['PrgP_90'] = df_24_raw['PrgP'] / df_24_raw['90s']
    p90_24['PrgC_90'] = df_24_raw['PrgC'] / df_24_raw['90s']
    p90_24['PPA_90'] = df_24_raw['PPA'] / df_24_raw['90s']
    p90_24['SCA_90'] = df_24_raw['SCA'] / df_24_raw['90s']
    p90_24['Touches_90'] = df_24_raw['Touches'] / df_24_raw['90s']
    p90_24['Tkl_90'] = df_24_raw['Tkl'] / df_24_raw['90s']
    p90_24['Int_90'] = df_24_raw['Int'] / df_24_raw['90s']
    p90_24['Recov_90'] = df_24_raw['Recov'] / df_24_raw['90s']
    p90_24['Blocks_90'] = df_24_raw['Blocks'] / df_24_raw['90s']
    p90_24['SoT_90'] = df_24_raw['SoT'] / df_24_raw['90s']
    
    # Combine datasets
    df = pd.concat([p90_22, p90_24], ignore_index=True)
    
    # Fill any NaNs with 0 and convert types
    num_cols = ['Age', 'Min', '90s', 'Gls', 'Ast', 'PrgP', 'PrgC', 'PPA', 'SCA', 'Touches', 'Tkl', 'Int', 'Recov', 'Blocks', 'SoT']
    for col in num_cols:
        if col == '90s':
            df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0.0).astype(float)
        else:
            df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0).round().astype(int)
            
    feature_cols = [
        'Gls_90', 'Ast_90', 'PrgP_90', 'PrgC_90', 'PPA_90', 'SCA_90',
        'Touches_90', 'Tkl_90', 'Int_90', 'Recov_90', 'Blocks_90', 'SoT_90'
    ]
    df[feature_cols] = df[feature_cols].fillna(0.0).astype(float)
    df_features = df[feature_cols]
    
    print(f"Combined dataset: {df.shape[0]} total players (Min >= 450, no GK)")
    
    # 3. Scale features and run PCA
    scaler = StandardScaler()
    scaled_features = scaler.fit_transform(df_features)
    
    pca = PCA(n_components=2)
    pca_coords = pca.fit_transform(scaled_features)
    
    df['pca_x'] = pca_coords[:, 0]
    df['pca_y'] = pca_coords[:, 1]
    
    print(f"PCA explained variance ratio: {pca.explained_variance_ratio_}")
    print(f"Total variance explained: {sum(pca.explained_variance_ratio_):.2%}")
    
    # 4. K-Means Clustering (5 clusters)
    kmeans = KMeans(n_clusters=5, random_state=42, n_init=10)
    df['Cluster'] = kmeans.fit_predict(scaled_features)
    
    cluster_means = df_features.groupby(df['Cluster']).mean()
    print("Cluster Averages (Per 90):")
    print(cluster_means)
    
    # Let's classify the clusters to help the user:
    # Cluster averages analysis:
    # We will identify which cluster represents what by looking at their metrics.
    # Usually:
    # - Playmakers: High Touches_90, PrgP_90, PPA_90
    # - Wingers/Attacking Midfielders: High SCA_90, Ast_90, Gls_90, SoT_90
    # - Defensive Midfielders: High Tkl_90, Int_90, Recov_90, Blocks_90
    # - Box-to-Box: Moderate values all around
    # - Progressive Carriers: High PrgC_90, moderate SCA/Touches
    
    # 5. Toni Kroos Similarity Calculation
    kroos_mask = (df['Player'] == 'Toni Kroos') & (df['Season'] == '2022-2023')
    if kroos_mask.any():
        kroos_idx = df[kroos_mask].index[0]
        # Get scaled vector for Kroos
        kroos_vector = scaled_features[df.index.get_loc(kroos_idx)]
        
        # Compute distances
        distances = np.linalg.norm(scaled_features - kroos_vector, axis=1)
        
        # Similarity score scaling (0 to 100)
        # We can map it relative to the maximum distance from Kroos
        max_dist = np.max(distances)
        similarities = 100.0 * (1.0 - (distances / max_dist))
        df['Similarity'] = similarities
        
        # Sort and rank
        df = df.sort_values(by='Similarity', ascending=False)
        df['SimilarityRank'] = range(1, len(df) + 1)
        
        print("\nTop 10 overall similar players to Toni Kroos:")
        for r, row in df.head(10).iterrows():
            print(f"- {row['Player']} ({row['Squad']}, {row['Season']}) - Similarity: {row['Similarity']:.2f}% (Cluster {row['Cluster']})")
    else:
        print("Error: Toni Kroos 22/23 not found in combined data.")
        df['Similarity'] = 0.0
        df['SimilarityRank'] = 0
        
    # Serialize to JSON
    players_list = []
    for _, row in df.iterrows():
        players_list.append({
            'name': row['Player'],
            'nation': row['Nation'],
            'pos': row['Pos'],
            'main_pos': row['MainPos'],
            'squad': row['Squad'],
            'comp': row['Comp'],
            'age': int(row['Age']),
            'min': int(row['Min']),
            '90s': float(row['90s']),
            'season': row['Season'],
            'pca_x': float(row['pca_x']),
            'pca_y': float(row['pca_y']),
            'cluster': int(row['Cluster']),
            'similarity': float(row['Similarity']),
            'rank': int(row['SimilarityRank']),
            'stats': {
                'gls': int(row['Gls']),
                'ast': int(row['Ast']),
                'prgp': int(row['PrgP']),
                'prgc': int(row['PrgC']),
                'ppa': int(row['PPA']),
                'sca': int(row['SCA']),
                'touches': int(row['Touches']),
                'tkl': int(row['Tkl']),
                'int': int(row['Int']),
                'recov': int(row['Recov']),
                'blocks': int(row['Blocks']),
                'sot': int(row['SoT'])
            },
            'stats_per_90': {
                'gls_90': float(row['Gls_90']),
                'ast_90': float(row['Ast_90']),
                'prgp_90': float(row['PrgP_90']),
                'prgc_90': float(row['PrgC_90']),
                'ppa_90': float(row['PPA_90']),
                'sca_90': float(row['SCA_90']),
                'touches_90': float(row['Touches_90']),
                'tkl_90': float(row['Tkl_90']),
                'int_90': float(row['Int_90']),
                'recov_90': float(row['Recov_90']),
                'blocks_90': float(row['Blocks_90']),
                'sot_90': float(row['SoT_90'])
            }
        })
        
    out_path = 'data/processed_players.json'
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(players_list, f, indent=2, ensure_ascii=False)
        
    print(f"\nSaved processed players data to: {out_path}")

if __name__ == "__main__":
    preprocess_and_analyze()
