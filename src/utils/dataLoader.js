// Loads all processed data files and stores them in AppState.
//
// Expected files under data/processed/:
//   players.csv           one row per player-season
//   pca_coords.json       { players: [...], variance_explained: [...] }
//   kroos_stats.json      { kroos: [...] }
//   trophy_timeline.json  [ { season, laliga, copa, ucl }, ... ]

const DataLoader = (() => {

  const BASE = "./data/processed/";

  async function loadAll() {
    try {
      AppState.emit("data:loading");

      const [players, pca, kroosJson, trophies] = await Promise.all([
        d3.csv(BASE + "players.csv",          parseRow),
        d3.json(BASE + "pca_coords.json"),
        d3.json(BASE + "kroos_stats.json"),
        d3.json(BASE + "trophy_timeline.json"),
      ]);

      const seasons = [...new Set(players.map(d => d.season))].sort();

      AppState.set("rawData",          players);
      AppState.set("pcaData",          pca);
      AppState.set("kroosData",        kroosJson);
      AppState.set("trophyData",       trophies);
      AppState.set("availableSeasons", seasons);

      AppState.emit("data:ready", { players, pca, kroos: kroosJson.kroos, trophies });

    } catch (err) {
      console.error("[DataLoader] load failed:", err);
      AppState.emit("data:error", err);
    }
  }

  function parseRow(d) {
    return {
      id:           d.player_id,
      name:         d.player,
      team:         d.team,
      league:       d.league,
      season:       d.season,
      position:     d.position,
      age:          +d.age,
      nationality:  d.nationality,
      minutes:      +d.minutes,

      prog_passes:  +d.progressive_passes || 0,
      key_passes:   +d.key_passes          || 0,

      tackles:       +d.tackles        || 0,
      interceptions: +d.interceptions  || 0,

      goals_per90:   +d.goals_per90    || 0,
      assists_per90: +d.assists_per90  || 0,
      shots:         +d.shots          || 0,

      cluster: +d.cluster,
      pc1:     +d.pc1,
      pc2:     +d.pc2,
      similarity_to_kroos: d.similarity_to_kroos ? +d.similarity_to_kroos : null,
    };
  }

  return { loadAll };
})();

window.DataLoader = DataLoader;
