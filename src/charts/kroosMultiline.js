// Section 04 - Chart A
// Multi-line chart of Kroos's key stats over all seasons.
// Each metric is normalized to [0, 1] across his career so all lines
// share a single y-axis, making trends comparable.
// Active metrics are controlled by checkboxes built dynamically in init().
// A vertical dashed line marks the retirement season (2023-24).
//
// Controls:
//   #ctrl-04a-metrics — checkbox group (built in JS, one per METRICS entry)
//
// D3 features used: scalePoint, scaleLinear, line, curveMonotoneX,
//                   stroke-dasharray animation, axisBottom, axisLeft

const KroosMultilineChart = (() => {

  const METRICS = [
    { key: "prog_passes", label: "Progressive passes", color: "#f0c060" },
    { key: "key_passes",  label: "Key passes",         color: "#60a5fa" },
    { key: "xA",          label: "xA",                 color: "#4ade80" },
    { key: "tackles",     label: "Tackles",            color: "#f87171" },
    { key: "pass_acc",    label: "Pass accuracy",      color: "#c084fc" },
  ];

  let activeKeys = new Set(METRICS.map(m => m.key));

  function init() {
    buildCheckboxes();
    AppState.on("data:ready", ({ players }) => {
      draw(DataTransforms.kroosRows(players));
    });
  }

  function buildCheckboxes() {
    const wrap = document.getElementById("ctrl-04a-metrics");
    if (!wrap) return;

    METRICS.forEach(m => {
      const label = document.createElement("label");
      label.className = "metric-checkbox-label";

      const cb = document.createElement("input");
      cb.type  = "checkbox";
      cb.value = m.key;
      cb.checked = true;
      cb.style.accentColor = m.color;
      cb.addEventListener("change", () => {
        if (cb.checked) activeKeys.add(m.key);
        else            activeKeys.delete(m.key);
        const players = AppState.get("rawData");
        if (players) draw(DataTransforms.kroosRows(players));
      });

      label.appendChild(cb);
      label.appendChild(document.createTextNode(" " + m.label));
      wrap.appendChild(label);
    });
  }

  function draw(data) {
    const wrap = document.querySelector("[data-chart='kroos-multiline']");
    if (!wrap || !data.length) return;

    // TODO: replace placeholder and render D3 multi-line chart
    // Steps:
    // 1. Normalize each active metric to [0,1] across the Kroos rows
    // 2. Build xScale (scalePoint over seasons) and yScale (scaleLinear [0,1])
    // 3. Draw horizontal grid lines from yScale ticks
    // 4. Draw dashed vertical line at "2023-24" with label
    // 5. For each active metric:
    //    a. Append line path with curveMonotoneX in met.color
    //    b. Animate with stroke-dasharray / dashoffset, duration 800ms
    //    c. Append dot circles per data point with tooltip on hover
    //       showing the raw (un-normalized) value for that season
    // 6. Draw x-axis (rotated season labels) and y-axis (% format, 4 ticks)
  }

  return { init };
})();

window.KroosMultilineChart = KroosMultilineChart;
