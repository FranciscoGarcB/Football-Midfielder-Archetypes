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
      age:          +d.age,
      nationality:  d.nationality,
      minutes:      +d.minutes,

      goals_per90:        +d.goals_per90         || 0,
      assists_per90:      +d.assists_per90       || 0,
      ga_nopk_per90:      +d.ga_nopk_per90       || 0,
      shots:              +d.shots               || 0,
      shots_on_target:    +d.shots_on_target     || 0,
      goals_per_shot:     +d.goals_per_shot      || 0,
      tackles:            +d.tackles             || 0,
      interceptions:      +d.interceptions       || 0,
      fouls_drawn:        +d.fouls_drawn         || 0,
      crosses:            +d.crosses             || 0,
      xa_per90:           +d.xa_per90            || 0,
      key_passes_per90:   +d.key_passes_per90    || 0,
      np_xg_per90:        +d.np_xg_per90         || 0,
      xg_chain:           +d.xg_chain            || 0,
      xg_buildup:         +d.xg_buildup          || 0,

      cluster:             +d.cluster,
      pc1:                 +d.pc1,
      pc2:                 +d.pc2,
      similarity_to_kroos: d.similarity_to_kroos ? +d.similarity_to_kroos : null,
    };
  }

  return { loadAll };
})();

window.DataLoader = DataLoader;
