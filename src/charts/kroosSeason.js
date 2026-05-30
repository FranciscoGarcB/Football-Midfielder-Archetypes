// Section 01 - Chart B
// Area + line chart showing one selected stat for Kroos across all seasons.
// The active metric is driven by the #ctrl-01b-metric dropdown.
// A vertical dashed line marks his final season (2023-24).
//
// D3 features used: scalePoint, scaleLinear, area, line, curveMonotoneX,
//                   axisBottom, axisLeft, transition, tooltip

const KroosSeasonChart = (() => {

  const METRIC_LABELS = {
    prog_passes: "Progressive passes per 90",
    key_passes:  "Key passes per 90",
    xA:          "Expected assists (xA) per 90",
  };

  let currentMetric = "prog_passes";

  function init() {
    AppState.on("data:ready", ({ players }) => {
      draw(DataTransforms.kroosRows(players), currentMetric);
    });

    document.getElementById("ctrl-01b-metric")?.addEventListener("change", e => {
      currentMetric = e.target.value;
      const players = AppState.get("rawData");
      if (players) draw(DataTransforms.kroosRows(players), currentMetric);
    });
  }

  function draw(data, metric) {
    const wrap = document.querySelector("[data-chart='kroos-season-line']");
    if (!wrap || !data.length) return;

    // TODO: replace placeholder and render D3 area + line chart
    // Steps:
    // 1. Clear placeholder, measure wrap dimensions
    // 2. Build xScale (scalePoint over seasons) and yScale (scaleLinear, domain [0, max*1.15])
    // 3. Draw horizontal grid lines from yScale ticks
    // 4. Append area path (fill rgba gold at low opacity) using d3.area with curveMonotoneX
    // 5. Append line path (stroke gold, stroke-width 2) using d3.line
    // 6. Animate line in with stroke-dasharray/dashoffset trick, duration 900ms
    // 7. Append dashed vertical line at "2023-24" with "Retirement" label
    // 8. Append circle dots per data point; show tooltip on hover
    // 9. Draw x-axis (rotated season labels) and y-axis (4 ticks)
  }

  return { init };
})();

window.KroosSeasonChart = KroosSeasonChart;
