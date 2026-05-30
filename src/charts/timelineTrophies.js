// Section 01 - Chart A
// Dot-plot timeline of Real Madrid trophies by season.
// Three rows: La Liga, Copa del Rey, Champions League.
// Filled circle = won, hollow = not won that season.
// Kroos seasons (2017-18 to 2023-24) are shaded in the background.
// A dashed annotation marks his retirement after 2023-24.
//
// Data source: trophy_timeline.json (static, not from players CSV)
// D3 features used: scaleBand, scalePoint, circle join, annotation text

const TimelineTrophiesChart = (() => {

  const ROWS = [
    { key: "ucl",    label: "Champions League" },
    { key: "laliga", label: "La Liga"           },
    { key: "copa",   label: "Copa del Rey"      },
  ];

  const KROOS_LAST_SEASON = "2023-24";

  function init() {
    AppState.on("data:ready", ({ trophies }) => draw(trophies));
  }

  function draw(data) {
    const wrap = document.querySelector("[data-chart='timeline-trophies']");
    if (!wrap || !data) return;

    // TODO: replace placeholder markup and render D3 dot-plot
    // Steps:
    // 1. Clear placeholder, measure wrap width
    // 2. Build xScale (scaleBand over seasons) and yScale (scaleBand over ROWS)
    // 3. Draw background shading rect for each Kroos-era season
    // 4. Draw dashed vertical line + label at retirement boundary
    // 5. For each (season, row) pair: append circle, filled if won else hollow
    // 6. Draw x-axis (season labels, rotated) and y-axis (trophy names)
    // 7. Attach tooltip on circle hover showing season + result
  }

  return { init };
})();

window.TimelineTrophiesChart = TimelineTrophiesChart;
