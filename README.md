# Midfielder Football Player Archetypes

An interactive data visualization exploring midfielder archetypes across the top 5 European football leagues (2017–2023), centered around the question: **what made Toni Kroos irreplaceable, and who comes closest to filling that role today?**

---

## Research Questions

1. How do midfielder archetypes differ across the Premier League, La Liga, Serie A, Bundesliga, and Ligue 1?
2. Which active players share a statistical profile closest to Toni Kroos?

**Motivation:** After Kroos retired in June 2024, Real Madrid went consecutive seasons without a major trophy — an almost unprecedented outcome in the club's modern history. The visualization investigates whether that gap is explainable statistically and who, if anyone, could fill it.

---

## Live Demo

Open `index.html` in a browser after running the data pipeline. No server required — the page loads all data from local JSON/CSV files via `fetch`.

---

## Project Structure

```
football-viz/
├── index.html
├── data/
│   ├── scrape.py              # Downloads FBref + Understat stats via soccerdata
│   ├── process_data.py        # Merges sources, PCA, clustering, similarity
│   ├── raw/
│   │   ├── standard_data.csv
│   │   ├── shooting_data.csv
│   │   ├── misc_data.csv
│   │   ├── understat_data.csv
│   │   └── player_data/
│   │       └── cleaned_YYYY-YY.csv   # One file per season (FBref passing stats)
│   └── processed/
│       ├── players.csv
│       ├── pca_coords.json
│       ├── kroos_stats.json
│       └── trophy_timeline.json
├── src/
│   ├── app.js
│   ├── utils/
│   │   ├── state.js
│   │   ├── dataLoader.js
│   │   └── dataTransforms.js
│   ├── components/
│   │   ├── filters.js
│   │   ├── playerCard.js
│   │   ├── clusterLegend.js
│   │   ├── leagueToggles.js
│   │   └── scrollNav.js
│   └── charts/
│       ├── timelineTrophies.js
│       ├── kroosSeason.js
│       ├── radarLeagues.js
│       ├── barLeagues.js
│       ├── pcaScatter.js
│       ├── kroosVsLeagueRadar.js
│       ├── kroosTrajectory.js
│       ├── successorRanking.js
│       ├── comparisonRadar.js
│       └── parallelCoords.js
└── styles/
    ├── tokens.css
    ├── base.css
    ├── layout.css
    ├── components.css
    └── sections.css
```

---

## Data Sources

The visualization merges four data sources:

| Source | Fetched via | Covers |
|--------|-------------|--------|
| FBref standard stats | `soccerdata` `stat_type="standard"` | Goals, assists, G+A no-pen per 90 |
| FBref shooting stats | `soccerdata` `stat_type="shooting"` | Shots/90, shots on target/90, goals per shot |
| FBref misc stats | `soccerdata` `stat_type="misc"` | Tackles won, interceptions, fouls drawn/committed, crosses |
| Understat | `soccerdata` `sd.Understat` | xG, np_xG, xA, key passes, xG chain, xG buildup |
| FBref season CSVs | Manual export → `data/raw/player_data/` | Progressive passes, key passes, pass completion %, long pass %, GCA, progressive carries |

All sources cover the **Big 5 European Leagues** for seasons **2017-20 through 2023-24**. Only midfielders (position containing `MF`) are retained.

---

## Data Pipeline

### Step 1 — Scrape

```bash
pip install soccerdata pandas
python data/scrape.py
```

Downloads FBref and Understat stats and writes four CSVs to `data/raw/`. Prints the column names of each file on completion so you can verify the schema matches what `process_data.py` expects.

Season codes use soccerdata's format: `1920` = 2019-20, `2526` = 2025-26. `scrape.py` converts these to the `"YYYY-YY"` string format used throughout the project.

### Step 2 — Place season CSVs

Place manually-exported FBref passing CSVs in `data/raw/player_data/` named `cleaned_YYYY-YY.csv`. These files must contain at minimum:

```
player, comp, season, squad,
Progressive Passes, Key passes, Pass completion %,
% Long passes completed, Shot creating actions p 90,
Goal creating actions p 90, Progressive Carries,
carries final 3rd, Avg Mins per Match, Matches Played
```

The `season` column in these files uses `"YYYY-YYYY"` format (e.g. `"2022-2023"`). `process_data.py` converts this to `"YYYY-YY"` automatically before joining.

### Step 3 — Process

```bash
pip install scikit-learn numpy
python data/process_data.py
```

Merges all sources, runs PCA and clustering, computes similarity scores, and writes four files to `data/processed/`. Prints match rates for each join and a full cluster diagnostic at the end.

---

## Data Processing Details

### Join strategy

All joins use `[player, league, season]` as keys — not `team` — to handle mid-season transfers and naming differences between sources.

- FBref `standard`, `shooting`, `misc`: joined together on `[player, team, league, season]` first, then Understat and player_data join on `[player, league, season]`
- Understat: left join; unmatched rows fill with 0
- player_data CSVs: left join; league names normalized via keyword matching (e.g. `"de Bundesliga"` → `"Bundesliga"`, `"eng Premier League"` → `"Premier League"`)

The pipeline prints match rates so you can detect issues:

```
Understat join: 8814 rows matched (1950 unmatched — will use 0)
player_data join: 7195/10764 rows matched (3569 unmatched)
```

### Per-90 conversions

FBref misc stats (`Performance_TklW`, `Performance_Int`, etc.) and player_data stats (`Progressive Passes`, `Key passes`, etc.) are raw totals. They are divided by `Playing Time_90s` from the standard table.

Understat totals (`xa`, `np_xg`, `key_passes`) are divided by the same FBref `Playing Time_90s` denominator.

Some columns arrive pre-computed (`Pass completion %`, `% Long passes completed`, `Goal creating actions p 90`) and are used as-is without division.

### Deduplication

Players with multiple rows for the same `[player, league, season]` (transfers) are deduplicated by keeping the row with the most minutes.

### Minimum minutes filter

Players with fewer than **900 minutes** (`MIN_MINUTES`) are excluded from PCA and clustering but remain in the dataset for other charts.

---

## PCA and Clustering

### Feature set (15 features)

| Feature | Source | Notes |
|---------|--------|-------|
| `goals_per90` | FBref standard | |
| `assists_per90` | FBref standard | |
| `np_xg_per90` | Understat | Non-penalty expected goals |
| `xa_per90` | Understat | Expected assists — quality of final passes |
| `progressive_passes_per90` | player_data | Passes moving ball 10+ yards toward goal |
| `key_passes_per90` | player_data | Passes directly creating a shot |
| `pass_completion_pct` | player_data | Overall pass accuracy |
| `long_pass_pct` | player_data | Kroos's signature — ~42% vs ~20% avg |
| `gca_per90` | player_data | Goal-creating actions — builders vs finishers |
| `prog_carries_per90` | player_data | Separates carriers from distributors |
| `carries_final_third_per90` | player_data | Vertical threat dimension |
| `shots_per90` | FBref shooting | |
| `tackles_won` | FBref misc | Per 90 |
| `interceptions` | FBref misc | Per 90 |
| `fouls_committed_per90` | FBref misc | Defensive intensity proxy |

### PCA subset restriction

PCA is **fitted only on players that have all player_data columns populated** (non-zero values for `progressive_passes_per90`, `key_passes_per90`, `pass_completion_pct`, `long_pass_pct`, `gca_per90`, `prog_carries_per90`, `carries_final_third_per90`). This prevents players missing from the `player_data/` join from defaulting to zero and distorting the principal component directions.

### PCA parameters

| Parameter | Value |
|-----------|-------|
| Components | 4 (`PCA_COMPONENTS`) |
| Algorithm | scikit-learn `PCA` |
| Random seed | 42 |
| Preprocessing | `StandardScaler` (zero mean, unit variance per feature) |

PC1 and PC2 are used for the 2D scatter plot axis positions. All 4 components are used for clustering and similarity distance. Cumulative variance explained with 4 components is typically ~75–80%.

### Clustering

| Parameter | Value |
|-----------|-------|
| Algorithm | k-means |
| Clusters | 5 (`N_CLUSTERS`) |
| Input space | 4 PCA components (not raw features) |
| `n_init` | 12 |
| Random seed | 42 |

Clustering in PCA space ensures that distances reflect the variance structure captured by the components, not raw feature scale.

Cluster names are assigned manually after inspecting which players fall into each group. Update `CLUSTER_NAMES` in `src/utils/dataTransforms.js` after re-running with new data. The `print_cluster_profiles()` function at the bottom of `process_data.py` prints a diagnostic automatically at the end of each run.

Current assignments:

| ID | Name | Typical profile |
|----|------|----------------|
| 0 | Defensive Midfielder | High tackles and interceptions, strong defensive contribution, limited attacking output |
| 1 | Attacker | High goals, shots, and expected goals (xG), focused on final-third actions and scoring |
| 2 | Ball-winning passer | High tackles, ball recoveries, and progressive passes, combines defensive work with ball progression |
| 3 | Playmaker | High progressive passes, key passes, and expected assists (xA), primary creator in possession |
| 4 | Wide Player | High carries, dribbles, and progressive runs, operates mainly in wide areas and contributes to chance creation |

### Similarity to Kroos

**Prime seasons:** `KROOS_PRIME_START = "2019-20"` to `KROOS_PRIME_END = "2022-23"`. These are used to build the reference centroid — Kroos's peak statistical profile, excluding his partial 2023-24 comeback season.

**Players with full player_data coverage** (appear in the scatter plot):
1. All 15 features are scaled with the fitted `StandardScaler`
2. 4 PCA components are computed with the fitted `PCA`
3. The centroid of Kroos's prime-season PCA coordinates (mean of the 4 PC values across 2019-20 to 2022-23) is computed
4. Euclidean distance from each player to that centroid is computed
5. Similarity is normalized: `1 - distance / max_distance`, clipped to [0, 1]

---

## Visualization Sections

### 01 — Context: Why does it matter?

| Chart | Description | Interaction |
|-------|-------------|-------------|
| Real Madrid trophy timeline | Dot-plot: UCL, La Liga, Copa del Rey across seasons; filled = won, hollow = lost | Hover for season detail |
| Kroos stats by season | Line chart of a single Kroos metric across seasons | Dropdown switches metric |

### 02 — Landscape: How do leagues compare?

| Chart | Description | Interaction |
|-------|-------------|-------------|
| Average profile by league | Overlapping radar of top-10% per league; 6 axes normalized to p95 to prevent outlier compression | Toggle leagues on/off |
| Metric comparison | Horizontal bars, one per league, top-10% average of selected metric | Switch metric; sort by value or alphabetically |

Radar normalization uses the **95th percentile** (not the max) as the ceiling per axis. This prevents a single outlier from compressing all other values toward zero, while keeping the shape differences between leagues legible.

### 03 — Archetypes: The midfielder space

| Chart | Description | Interaction |
|-------|-------------|-------------|
| Midfielder PCA space | 2D scatter (PC1 × PC2) of all players with full features; colored by cluster; Kroos in gold | Zoom/pan; click dot to open player card sidebar; search by name with dropdown; cluster legend to highlight/dim groups; global league/season/minutes filters apply |

### 04 — Anatomy of Toni Kroos

| Chart | Description | Interaction |
|-------|-------------|-------------|
| Kroos vs La Liga average | Radar overlay: Kroos career average across all seasons vs La Liga top-10% average across same seasons | Static — not affected by any global filter |
| Trajectory in archetype space | Animated path of Kroos's PCA position from 2017 to 2023 over the background of all midfielders | Play/pause button; manual year scrub slider |

### 05 — Who can replace Kroos?

| Chart | Description | Interaction |
|-------|-------------|-------------|
| Top 10 potential successors | Lollipop chart ranked by `similarity_to_kroos`; score shown as percentage | Max-age dropdown and Real Madrid Only filters; respects global league/season/minutes filters; click any row to select for comparison |
| Profile comparison | Radar overlay: Kroos career average vs selected successor's latest season | Updates on successor row click |
| Parallel coordinates | All filtered midfielders as background lines; Kroos always shown in gold; selected successor highlighted in cluster color | Cluster color legend toggles archetype visibility; hover any line for name/role; Kroos persists even when his league is filtered |

### Global filters (top header)

All charts except "Kroos vs La Liga average" respond to three header-level filters:

| Filter | Effect |
|--------|--------|
| League | Shows only players from that league (Kroos remains visible in parallel coords regardless) |
| Season | Shows only that season; charts that need a specific Kroos season fall back to his last available season when set to "All" |
| Min. minutes | Excludes players below the threshold from all charts |

---

## Technical Architecture

**No framework, no build step.** Plain HTML, CSS, and JavaScript loaded via `<script>` tags in dependency order. State is managed through a single `AppState` event bus (`src/utils/state.js`). Charts subscribe to `data:ready` and `filters:changed` and re-render reactively on any state change.

All `data:ready` handlers are wrapped in `requestAnimationFrame()` to ensure the browser has completed layout before charts attempt to read `clientWidth` / `clientHeight`. Some charts use a double `requestAnimationFrame` for complex flex layouts.

The visualization has two themes (dark/light) toggled by a button in the header. The preference is persisted in `localStorage`. All D3 charts read CSS custom properties at render time using `getComputedStyle`, so they respond to theme switches correctly.

PCA and clustering are pre-computed in Python and stored as flat files. No ML code runs in the browser.

---

## Dependencies

### Python

```
soccerdata
pandas
scikit-learn
numpy
```

### JavaScript (CDN)

```
d3 v7   https://cdn.jsdelivr.net/npm/d3@7
```

---

## Data Source Credits

- Player statistics: [FBref](https://fbref.com) via [soccerdata](https://github.com/probberechts/soccerdata) (original data from StatsBomb)
- Expected stats (xG, xA): [Understat](https://understat.com) via soccerdata
- Trophy results: compiled manually from public records
