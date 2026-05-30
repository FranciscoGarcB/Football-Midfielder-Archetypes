// Section 02 - Chart A
// Overlapping radar showing the average profile of the top 10% of
// midfielders per league. One polygon per active league, all on the
// same normalized axes. League visibility is controlled by the
// LeagueTogglesComponent via AppState "leagues:changed".
//
// Also exposes drawRadarSVG() — a reusable renderer consumed by
// PlayerCardComponent (sidebar mini-radar) and KroosVsLeagueRadarChart.
//
// D3 features used: manual SVG construction (no d3.chord/arc),
//                   polygon path from angular coordinates, mouse events

const RadarLeaguesChart = (() => {

  function init() {
    AppState.on("data:ready", ({ players }) => draw(players));
    AppState.on("filters:changed",  () => redraw());
    AppState.on("leagues:changed",  () => redraw());
  }

  function redraw() {
    const data = AppState.get("rawData");
    if (data) draw(DataTransforms.applyFilters(data));
  }

  function draw(data) {
    const wrap = document.querySelector("[data-chart='radar-leagues']");
    if (!wrap) return;

    // TODO: replace placeholder and render radar
    // Steps:
    // 1. Compute leagueProfiles() and normalizeProfiles() from DataTransforms
    // 2. Filter to activeLeagues from AppState
    // 3. Call drawRadarSVG(wrap, profiles, { colors, labelKey, size })
  }

  // Shared radar renderer used by this chart, PlayerCardComponent,
  // KroosVsLeagueRadarChart, and ComparisonRadarChart.
  //
  // containerEl  — DOM element (or selector string) to render into
  // profiles     — array of objects; each has a labelKey property
  //                plus one numeric key per RADAR_AXES entry (0-1 normalized)
  // opts         — { colors: {label: hexColor}, labelKey: string, size: number }
  function drawRadarSVG(containerEl, profiles, opts) {
    const container = typeof containerEl === "string"
      ? document.querySelector(containerEl)
      : containerEl;
    if (!container) return;

    container.innerHTML = "";

    // TODO: render reusable radar SVG
    // Steps:
    // 1. Derive N axes from DataTransforms.RADAR_AXES
    // 2. Compute angle per axis: (2π * i / N) - π/2 so first axis is at top
    // 3. Helper pt(value, axisIndex) → { x, y } using cx, cy, r
    // 4. Draw N-polygon grid at levels 0.25, 0.5, 0.75, 1.0 (stroke only)
    // 5. Draw axis lines from center to each pt(1, i)
    // 6. Draw axis labels at pt(1.18, i) with DataTransforms.RADAR_AXES[i].label
    // 7. For each profile: build polygon from pts, fill + stroke in opts.colors[label]
    //    fill-opacity 0.12, stroke-opacity 0.85; raise on mouseover
  }

  return { init, drawRadarSVG };
})();

window.RadarLeaguesChart = RadarLeaguesChart;
