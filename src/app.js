// Application entry point.
// Initializes all components and charts in dependency order,
// then triggers data loading to kick off the render pipeline.
// Every module exposes an init() function; rendering happens
// reactively via AppState events once data is available.

document.addEventListener("DOMContentLoaded", () => {

  // Global tooltip node shared by all D3 charts
  const tooltip = document.createElement("div");
  tooltip.className = "d3-tooltip";
  document.body.appendChild(tooltip);

  // UI components first — they register event listeners that
  // chart modules may emit before data arrives
  ScrollNavComponent.init();
  FiltersComponent.init();
  LeagueTogglesComponent.init();
  ClusterLegendComponent.init();
  PlayerCardComponent.init();

  // Charts — order does not matter because each waits for
  // "data:ready" before rendering
  TimelineTrophiesChart.init();
  KroosSeasonChart.init();
  RadarLeaguesChart.init();
  BarLeaguesChart.init();
  PcaScatterChart.init();
  KroosVsLeagueRadarChart.init();
  KroosTrajectoryChart.init();
  SuccessorRankingChart.init();
  ParallelCoordsChart.init();
  ComparisonRadarChart.init();

  // Start loading data — emits "data:ready" when complete
  DataLoader.loadAll();

  // Show a loading state on chart placeholders until data arrives
  AppState.on("data:loading", () => {
    document.querySelectorAll(".chart-placeholder").forEach(el => {
      el.classList.add("loading");
    });
  });

  AppState.on("data:ready", () => {
    document.querySelectorAll(".chart-placeholder").forEach(el => {
      el.classList.remove("loading");
    });
  });

  AppState.on("data:error", err => {
    console.error("Data failed to load:", err);
  });
});
