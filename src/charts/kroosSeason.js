// Section 01 - Chart B
// Area + line chart showing one selected stat for Kroos across all seasons.
// Data source: AppState.kroosData.kroos (kroos_stats.json), not players.csv.
// Field names match exactly what process_data.py writes.
// When only one season is loaded the chart renders a single-point summary
// with a nudge to add more season files.

const KroosSeasonChart = (() => {

  const METRICS = {
    progressive_passes_per90:  "Prog. passes / 90",
    key_passes_per90:          "Key passes / 90",
    xa_per90:                  "xA / 90",
    long_pass_pct:             "Long pass %",
    gca_per90:                 "GCA / 90",
    np_xg_per90:               "npxG / 90",
    goals_per90:               "Goals / 90",
    assists_per90:             "Assists / 90",
    tackles:                   "Tackles / 90",
    interceptions:             "Interceptions / 90",
  };

  const RETIREMENT_SEASON = "2023-24";

  let currentMetric = "progressive_passes_per90";

  function css(v) {
    return getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  }

  function init() {
    AppState.on("data:ready", () => requestAnimationFrame(() => draw()));

    document.getElementById("ctrl-01b-metric")?.addEventListener("change", e => {
      currentMetric = e.target.value;
      draw();
    });

    const observer = new MutationObserver(() => {
      if (AppState.get("kroosData")) draw();
    });
    observer.observe(document.documentElement, {
      attributes: true, attributeFilter: ["data-theme"],
    });
  }

  function getKroosRows() {
    const stored = AppState.get("kroosData");
    if (!stored?.kroos?.length) return [];
    return [...stored.kroos].sort((a, b) => a.season.localeCompare(b.season));
  }

  function draw() {
    const wrap = document.querySelector("[data-chart='kroos-season-line']");
    if (!wrap) return;

    const data = getKroosRows();
    if (!data.length) return;

    wrap.innerHTML = "";

    const metricLabel = METRICS[currentMetric] || currentMetric;

    const W  = wrap.clientWidth || 460;
    const H  = 220;
    const m  = { top: 24, right: 24, bottom: 50, left: 52 };
    const iw = W - m.left - m.right;
    const ih = H - m.top  - m.bottom;

    const svg = d3.select(wrap)
      .append("svg")
        .attr("width",   "100%")
        .attr("viewBox", `0 0 ${W} ${H}`)
        .style("overflow", "visible");

    const g = svg.append("g")
      .attr("transform", `translate(${m.left},${m.top})`);

    if (data.length === 1) {
      drawSinglePoint(g, data[0], metricLabel, iw, ih);
      return;
    }

    const values = data.map(d => +d[currentMetric] || 0);
    const yMax   = (d3.max(values) || 1) * 1.2;

    const xScale = d3.scalePoint()
      .domain(data.map(d => d.season))
      .range([0, iw])
      .padding(0.35);

    const yScale = d3.scaleLinear()
      .domain([0, yMax])
      .range([ih, 0]);

    drawGrid(g, yScale, iw);
    drawRetirementAnnotation(g, xScale, yScale, ih, data);
    drawAreaFill(g, data, xScale, yScale, ih);
    drawLineAndAnimate(g, data, xScale, yScale);
    drawDots(g, data, xScale, yScale, metricLabel);
    drawAxes(g, xScale, yScale, ih, metricLabel);
  }

  function drawGrid(g, yScale, iw) {
    g.selectAll(".grid-h")
      .data(yScale.ticks(4))
      .join("line")
        .attr("class",        "grid-h")
        .attr("x1",           0)
        .attr("x2",           iw)
        .attr("y1",           d => yScale(d))
        .attr("y2",           d => yScale(d))
        .attr("stroke",       css("--chart-grid-color"))
        .attr("stroke-width", 1);
  }

  function drawRetirementAnnotation(g, xScale, yScale, ih, data) {
    const rx = xScale(RETIREMENT_SEASON);
    if (rx === undefined) return;

    g.append("line")
      .attr("x1", rx).attr("x2", rx)
      .attr("y1", 0) .attr("y2", ih)
      .attr("stroke",           css("--kroos-color"))
      .attr("stroke-width",     1)
      .attr("stroke-dasharray", "4,3")
      .attr("opacity",          0.45);

    g.append("text")
      .attr("x",           rx + 6)
      .attr("y",           10)
      .attr("fill",        css("--kroos-color"))
      .attr("font-size",   "9px")
      .attr("font-family", css("--font-ui"))
      .attr("opacity",     0.75)
      .text("Retirement");
  }

  function drawAreaFill(g, data, xScale, yScale, ih) {
    const areaFn = d3.area()
      .x( d => xScale(d.season))
      .y0(ih)
      .y1(d => yScale(+d[currentMetric] || 0))
      .curve(d3.curveMonotoneX);

    g.append("path")
      .datum(data)
      .attr("d",      areaFn)
      .attr("fill",   css("--kroos-subtle"))
      .attr("stroke", "none");
  }

  function drawLineAndAnimate(g, data, xScale, yScale) {
    const lineFn = d3.line()
      .x( d => xScale(d.season))
      .y( d => yScale(+d[currentMetric] || 0))
      .curve(d3.curveMonotoneX);

    const path = g.append("path")
      .datum(data)
      .attr("d",               lineFn)
      .attr("fill",            "none")
      .attr("stroke",          css("--kroos-color"))
      .attr("stroke-width",    2.5)
      .attr("stroke-linejoin", "round");

    const totalLength = path.node().getTotalLength();
    path
      .attr("stroke-dasharray",  `${totalLength} ${totalLength}`)
      .attr("stroke-dashoffset", totalLength)
      .transition()
        .duration(900)
        .ease(d3.easeCubicOut)
        .attr("stroke-dashoffset", 0);
  }

  function drawDots(g, data, xScale, yScale, metricLabel) {
    const tooltip = d3.select("body").select(".d3-tooltip");

    g.selectAll(".dot")
      .data(data)
      .join("circle")
        .attr("class",        "dot")
        .attr("cx",           d => xScale(d.season))
        .attr("cy",           d => yScale(+d[currentMetric] || 0))
        .attr("r",            5)
        .attr("fill",         d => d.season === RETIREMENT_SEASON
          ? css("--kroos-color")
          : css("--bg-surface"))
        .attr("stroke",       css("--kroos-color"))
        .attr("stroke-width", 2)
        .style("cursor",      "default")
        .on("mouseover", (event, d) => {
          tooltip.classed("visible", true)
            .html(`
              <div class="tooltip-name">${d.season}</div>
              <div class="tooltip-row">
                <span>${metricLabel}</span>
                <span class="tooltip-val">${(+d[currentMetric] || 0).toFixed(2)}</span>
              </div>
              <div class="tooltip-row">
                <span>Minutes</span>
                <span class="tooltip-val">${(+d.minutes).toLocaleString()}</span>
              </div>
              <div class="tooltip-row">
                <span>Age</span>
                <span class="tooltip-val">${d.age}</span>
              </div>
            `);
        })
        .on("mousemove", event => {
          tooltip
            .style("left", (event.clientX + 14) + "px")
            .style("top",  (event.clientY - 32) + "px");
        })
        .on("mouseout", () => tooltip.classed("visible", false));

    // Value label above each dot
    g.selectAll(".dot-label")
      .data(data)
      .join("text")
        .attr("class",           "dot-label")
        .attr("x",               d => xScale(d.season))
        .attr("y",               d => yScale(+d[currentMetric] || 0) - 10)
        .attr("text-anchor",     "middle")
        .attr("fill",            css("--kroos-color"))
        .attr("font-size",       "9px")
        .attr("font-family",     css("--font-ui"))
        .attr("font-weight",     "500")
        .attr("opacity",         0)
        .text(d => (+d[currentMetric] || 0).toFixed(1))
        .transition()
          .delay(950)
          .attr("opacity", 0.85);
  }

  function drawAxes(g, xScale, yScale, ih, metricLabel) {
    const xAxisG = g.append("g")
      .attr("transform", `translate(0,${ih})`)
      .call(
        d3.axisBottom(xScale)
          .tickSize(4)
          .tickPadding(8)
      );

    xAxisG.select(".domain").attr("stroke", css("--chart-axis-color"));
    xAxisG.selectAll(".tick line").attr("stroke", css("--chart-axis-color"));
    xAxisG.selectAll("text")
      .attr("fill",         css("--chart-text-color"))
      .attr("font-size",    "10px")
      .attr("font-family",  css("--font-ui"))
      .attr("transform",    "rotate(-35)")
      .style("text-anchor", "end");

    const yAxisG = g.append("g")
      .call(
        d3.axisLeft(yScale)
          .ticks(4)
          .tickSize(4)
          .tickPadding(8)
      );

    yAxisG.select(".domain").attr("stroke", css("--chart-axis-color"));
    yAxisG.selectAll(".tick line").attr("stroke", css("--chart-axis-color"));
    yAxisG.selectAll("text")
      .attr("fill",        css("--chart-text-color"))
      .attr("font-size",   "10px")
      .attr("font-family", css("--font-ui"));

    g.append("text")
      .attr("transform",   "rotate(-90)")
      .attr("x",           -(ih / 2))
      .attr("y",           -40)
      .attr("text-anchor", "middle")
      .attr("fill",        css("--text-muted"))
      .attr("font-size",   "9px")
      .attr("font-family", css("--font-ui"))
      .text(metricLabel);
  }

  function drawSinglePoint(g, d, metricLabel, iw, ih) {
    const val = (+d[currentMetric] || 0).toFixed(2);

    g.append("text")
      .attr("x",               iw / 2)
      .attr("y",               ih / 2 - 28)
      .attr("text-anchor",     "middle")
      .attr("dominant-baseline","middle")
      .attr("fill",            css("--kroos-color"))
      .attr("font-size",       "36px")
      .attr("font-family",     css("--font-display"))
      .attr("font-weight",     "700")
      .text(val);

    g.append("text")
      .attr("x",               iw / 2)
      .attr("y",               ih / 2 + 12)
      .attr("text-anchor",     "middle")
      .attr("fill",            css("--text-secondary"))
      .attr("font-size",       "12px")
      .attr("font-family",     css("--font-ui"))
      .text(metricLabel);

    g.append("text")
      .attr("x",               iw / 2)
      .attr("y",               ih / 2 + 30)
      .attr("text-anchor",     "middle")
      .attr("fill",            css("--text-muted"))
      .attr("font-size",       "10px")
      .attr("font-family",     css("--font-ui"))
      .text(`${d.season}  ·  ${(+d.minutes).toLocaleString()} minutes`);

    g.append("text")
      .attr("x",               iw / 2)
      .attr("y",               ih - 6)
      .attr("text-anchor",     "middle")
      .attr("fill",            css("--text-muted"))
      .attr("font-size",       "9px")
      .attr("font-family",     css("--font-ui"))
      .text("Add more season files to data/raw/ to see the full trend");
  }

  return { init };
})();

window.KroosSeasonChart = KroosSeasonChart;
