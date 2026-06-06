# Football Midfielders Archetypes

An interactive data visualization exploring midfielder archetypes across the top 5 European football leagues (2017–2025), centered around the question: what made Toni Kroos irreplaceable, and who comes closest to filling that role today?

---

## Research Questions

1. How do the top midfielder archetypes differ across the Premier League, La Liga, Serie A, Bundesliga, and Ligue 1?
2. Which active players share a statistical profile closest to Toni Kroos?

The motivation: after Kroos retired in June 2024, Real Madrid went two consecutive seasons without a major trophy - an almost unprecedented outcome in the club's modern history.

---

## Live Demo

Open `index.html` in a browser after running the data pipeline. No server required — the page loads all data from local JSON/CSV files.

---

## Project Structure

```
football-viz/
├── index.html              # Single-page application entry point
│
├── data/
│   ├── scrape.py           # Downloads stats from FBref via soccerdata
│   ├── process_data.py     # Merges sources, runs PCA + clustering, writes output files
│   ├── generate_data.py    # Generates synthetic data for offline testing
│   ├── raw/                # Place scraped CSVs here (git-ignored)
│   └── processed/          # Output files consumed by the visualization (git-ignored)
│
├── src/
│   ├── app.js              # Entry point: initializes all modules, triggers data load
│   ├── utils/
│   │   ├── state.js        # Global application state and event bus
│   │   ├── dataLoader.js   # Loads and parses processed CSV/JSON files
│   │   └── dataTransforms.js  # Pure data helpers (filtering, aggregation, normalization)
│   ├── components/
│   │   ├── filters.js      # Global filter controls (league, season, minutes)
│   │   ├── playerCard.js   # Sidebar detail card for a selected player
│   │   ├── clusterLegend.js   # Cluster color legend below the PCA scatter
│   │   ├── leagueToggles.js   # League toggle buttons for the radar chart
│   │   └── scrollNav.js    # Highlights the active section nav link on scroll
│   └── charts/
│       ├── timelineTrophies.js    # 01 Real Madrid trophy dot-plot
│       ├── kroosSeason.js         # 01 Kroos stat trend (area + line)
│       ├── radarLeagues.js        # 02 League profile radar (shared renderer)
│       ├── barLeagues.js          # 02 Metric comparison bar chart
│       ├── pcaScatter.js          # 03 PCA archetype scatter with search
│       ├── kroosMultiline.js      # 04 Kroos multi-metric evolution
│       ├── kroosVsLeagueRadar.js  # 04 Kroos vs La Liga average radar
│       ├── kroosTrajectory.js     # 04 Animated PCA trajectory
│       ├── successorRanking.js    # 05 Weighted similarity lollipop chart
│       └── comparisonRadar.js     # 05 Kroos vs successor radar overlay
│
└── styles/
    ├── tokens.css      # CSS custom properties: colors, fonts, spacing (dark + light theme)
    ├── base.css        # Resets and typography
    ├── layout.css      # Header, hero, sections, footer
    ├── components.css  # Chart cards, controls, tooltips, search dropdown
    └── sections.css    # Per-section accent overrides and league button colors
```

---

## Data Pipeline

The visualization requires four files in `data/processed/`. Generate them by running the pipeline below.

### 1. Scrape

Downloads midfielder stats from FBref for the Big 5 European Leagues across seasons 2019–20 to 2025–26 using [soccerdata](https://github.com/probberechts/soccerdata).

```bash
pip install soccerdata pandas
python data/scrape.py
```

This writes three files to `data/raw/`:

| File | Contents |
|---|---|
| `standard_data.csv` | Goals, assists, G+A per 90, cards |
| `shooting_data.csv` | Shots per 90, shots on target per 90 |
| `misc_data.csv` | Tackles won, interceptions, fouls, crosses |

### 2. Process

Merges the three source files, runs PCA (2 components) and k-means clustering (5 clusters), and computes similarity to Kroos for every player.

```bash
pip install scikit-learn numpy
python data/process_data.py
```

This writes four files to `data/processed/`:

| File | Consumed by |
|---|---|
| `players.csv` | All charts via `dataLoader.js` |
| `pca_coords.json` | PCA scatter, trajectory |
| `kroos_stats.json` | All Kroos-specific charts |
| `trophy_timeline.json` | Trophy dot-plot (edit manually to update results) |

### Offline testing (no FBref access)

```bash
python data/generate_data.py
```

Generates realistic synthetic data for all seasons and writes directly to `data/processed/`. Useful for development without network access.

---

## Features

### Visualization sections

| Section | Chart | Interaction |
|---|---|---|
| 01 Context | Trophy dot-plot | Hover for season details |
| 01 Context | Kroos stat trend | Dropdown to switch metric |
| 02 Leagues | Overlapping radar | Toggle leagues on/off |
| 02 Leagues | Horizontal bar chart | Switch metric, sort order |
| 03 Archetypes | PCA scatter | Zoom, pan, click to inspect, search by name |
| 04 Kroos | Multi-line evolution | Toggle metrics via checkboxes |
| 04 Kroos | Kroos vs La Liga radar | Season selector |
| 04 Kroos | Animated PCA trajectory | Play/pause, manual scrub |
| 05 Successor | Weighted lollipop ranking | Sliders adjust feature group weights |
| 05 Successor | Comparison radar overlay | Updates on row click |

### Global controls

- **League filter** — applies to all charts simultaneously
- **Season filter** — applies to all charts simultaneously
- **Minimum minutes** — excludes low-sample players
- **Light / dark theme** — persists to `localStorage`

---

## Technical Notes

**Architecture** — no framework, no build step. Plain HTML, CSS, and JavaScript modules loaded in dependency order via `<script>` tags. State is managed through a single `AppState` event bus; charts subscribe to `data:ready` and `filters:changed` and render reactively.

**PCA and clustering** — computed in Python (`scikit-learn`) and stored as pre-computed coordinates in the CSV. The browser only reads and visualizes these values; it does not run any ML.

**Cluster names** — assigned manually after inspecting which players and stat profiles fall into each group. 

**`similarity_to_kroos`** — Euclidean distance in standardized feature space from each player to the centroid of Kroos's prime seasons (2019–20 to 2022–23), inverted to a [0, 1] similarity score. Recomputed every time `process_data.py` runs.

**Feature proxies** — soccerdata's available stat types (`standard`, `shooting`, `misc`) do not expose progressive passes or key passes directly. The pipeline uses `Per 90 Minutes_G+A-PK` (non-penalty goal involvement) and `Per 90 Minutes_Ast` as proxies. If a passing table becomes available, replace those columns in `FEATURE_COLS` inside `process_data.py`.

---

## Dependencies

### Python (data pipeline)

```
soccerdata
pandas
scikit-learn
numpy
```

### JavaScript (visualization, loaded via CDN)

```
d3 v7   https://cdn.jsdelivr.net/npm/d3@7
```

---

## Data Source

Player statistics scraped from [FBref](https://fbref.com) via the [soccerdata](https://github.com/probberechts/soccerdata) library. FBref data is originally sourced from StatsBomb.

Trophy results for Real Madrid compiled manually from public records.
