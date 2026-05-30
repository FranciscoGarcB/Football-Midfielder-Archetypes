// Section 02 - Chart B
// Horizontal bar chart comparing the top-10% average of a chosen metric
// across the five leagues. Bars animate in on load and re-animate
// with a smooth transition when the metric or sort order changes.
//
// Controls:
//   #ctrl-02b-metric  — dropdown selecting the stat to display
//   #ctrl-02b-sort    — sort by value (desc) or alphabetically
//
// D3 features used: scaleBand, scaleLinear, rect join with transition,
//                   axisLeft, axisBottom, tooltip

const BarLeaguesChart = (() => {

  const METRIC_LABELS = {
    prog_passes:   "Progressive passes / 90",
    key_passes:    "Key passes / 90",
    xA:            "xA / 90",
    tackles:       "Tackles / 90",
    interceptions: "Interceptions / 90",
    xG:            "xG / 90",
  };

  let currentMetric = "prog_passes";
  let currentSort   = "value";

  function init() {
    AppState.on("data:ready", ({ players }) => draw(players));
    AppState.on("filters:changed", () => redraw());

    document.getElementById("ctrl-02b-metric")?.addEventListener("change", e => {
      currentMetric = e.target.value;
      redraw();
    });
    document.getElementById("ctrl-02b-sort")?.addEventListener("change", e => {
      currentSort = e.target.value;
      redraw();
    });
  }

  function redraw() {
    const data = AppState.get("rawData");
    if (data) draw(DataTransforms.applyFilters(data));
  }

  function draw(data) {
    const wrap = document.querySelector("[data-chart='bar-leagues']");
    if (!wrap) return;

    // TODO: replace placeholder and render D3 bar chart
    // Steps:
    // 1. Compute leagueProfiles() from DataTransforms; sort by currentSort
    // 2. Measure wrap width; compute H from number of bars * row height
    // 3. Build xScale (scaleLinear, domain [0, max*1.12]) and yScale (scaleBand)
    // 4. Draw subtle vertical grid lines from xScale ticks
    // 5. For each league: append rect starting at width 0, transition to full width
    // 6. Append numeric value label after transition (opacity 0 → 1 after delay)
    // 7. Draw y-axis (league names) and x-axis (value ticks)
    // 8. Append x-axis label with METRIC_LABELS[currentMetric]
    // 9. Tooltip on rect mouseover showing exact value
  }

  return { init };
})();

window.BarLeaguesChart = BarLeaguesChart;
