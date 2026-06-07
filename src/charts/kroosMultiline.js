// Section 04 - Chart A
// Multi-line chart of Kroos stats normalized to [0,1] per metric so all
// lines share a single y-axis and trends are comparable.
// Data comes from AppState.kroosData.kroos (kroos_stats.json).
// With a single season loaded the chart shows a stat summary card instead.

const KroosMultilineChart = (() => {

  const METRICS = [
    { key: "progressive_passes_per90", label: "Prog. passes / 90", color: "#f0c060" },
    { key: "xa_per90",                 label: "xA / 90",           color: "#60a5fa" },
    { key: "long_pass_pct",            label: "Long pass %",       color: "#a78bfa" },
    { key: "gca_per90",                label: "GCA / 90",          color: "#fb923c" },
    { key: "tackles",                  label: "Tackles / 90",      color: "#4ade80" },
    { key: "interceptions",            label: "Interceptions / 90",color: "#f87171" },
  ];

  const RETIREMENT_SEASON = "2023-24";
  let activeKeys = new Set(METRICS.map(m => m.key));

  function css(v) {
    return getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  }

  function init() {
    buildCheckboxes();

    AppState.on("data:ready", () => requestAnimationFrame(() => draw()));

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
        draw();
      });

      label.appendChild(cb);
      label.appendChild(document.createTextNode(" " + m.label));
      wrap.appendChild(label);
    });
  }

  function draw() {
    const wrap = document.querySelector("[data-chart='kroos-multiline']");
    if (!wrap) return;

    const data = getKroosRows();
    if (!data.length) return;

    wrap.innerHTML = "";

    if (data.length === 1) {
      drawSingleSeason(wrap, data[0]);
      return;
    }

    drawMultiline(wrap, data);
  }

  function drawMultiline(wrap, data) {
    const W  = wrap.clientWidth  || 460;
    const H  = wrap.clientHeight || 220;
    const m  = { top: 20, right: 24, bottom: 52, left: 36 };
    const iw = W - m.left - m.right;
    const ih = H - m.top  - m.bottom;

    const xScale = d3.scalePoint()
      .domain(data.map(d => d.season))
      .range([0, iw])
      .padding(0.3);

    const yScale = d3.scaleLinear().domain([0, 1]).range([ih, 0]);

    // Normalize each metric to [0,1] across all Kroos seasons
    const normed = data.map(row => {
      const out = { season: row.season };
      METRICS.forEach(met => {
        const vals = data.map(d => +d[met.key] || 0);
        const lo   = d3.min(vals);
        const hi   = d3.max(vals);
        out[met.key] = hi === lo ? 0.5 : ((+row[met.key] || 0) - lo) / (hi - lo);
      });
      return out;
    });

    const svg = d3.select(wrap)
      .append("svg")
        .attr("width",   "100%")
        .attr("viewBox", `0 0 ${W} ${H}`)
        .style("overflow", "visible");

    const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);

    // Grid
    yScale.ticks(4).forEach(t => {
      g.append("line")
        .attr("x1", 0).attr("x2", iw)
        .attr("y1", yScale(t)).attr("y2", yScale(t))
        .attr("stroke",       css("--chart-grid-color"))
        .attr("stroke-width", 1);
    });

    // Retirement annotation
    const retX = xScale(RETIREMENT_SEASON);
    if (retX !== undefined) {
      g.append("line")
        .attr("x1", retX).attr("x2", retX)
        .attr("y1", 0)    .attr("y2", ih)
        .attr("stroke",           css("--kroos-color"))
        .attr("stroke-width",     1)
        .attr("stroke-dasharray", "4,3")
        .attr("opacity",          0.45);

      g.append("text")
        .attr("x",           retX + 5)
        .attr("y",           10)
        .attr("fill",        css("--kroos-color"))
        .attr("font-size",   "9px")
        .attr("font-family", css("--font-ui"))
        .attr("opacity",     0.7)
        .text("Retirement");
    }

    const tooltip = d3.select("body").select(".d3-tooltip");
    const active  = METRICS.filter(m => activeKeys.has(m.key));

    active.forEach(met => {
      const lineFn = d3.line()
        .x( d => xScale(d.season))
        .y( d => yScale(d[met.key]))
        .curve(d3.curveMonotoneX);

      const path = g.append("path")
        .datum(normed)
        .attr("d",               lineFn)
        .attr("fill",            "none")
        .attr("stroke",          met.color)
        .attr("stroke-width",    2)
        .attr("stroke-linejoin", "round");

      const len = path.node().getTotalLength();
      path
        .attr("stroke-dasharray",  `${len} ${len}`)
        .attr("stroke-dashoffset", len)
        .transition().duration(800).ease(d3.easeCubicOut)
        .attr("stroke-dashoffset", 0);

      g.selectAll(`.dot-${met.key}`)
        .data(normed)
        .join("circle")
          .attr("cx",    d => xScale(d.season))
          .attr("cy",    d => yScale(d[met.key]))
          .attr("r",     4)
          .attr("fill",   met.color)
          .attr("stroke", css("--bg-surface"))
          .attr("stroke-width", 1.5)
          .on("mouseover", (event, d) => {
            const raw = data.find(r => r.season === d.season);
            tooltip.classed("visible", true)
              .html(`
                <div class="tooltip-name">${d.season}</div>
                <div class="tooltip-row">
                  <span>${met.label}</span>
                  <span class="tooltip-val">${(+raw?.[met.key] || 0).toFixed(2)}</span>
                </div>
              `);
          })
          .on("mousemove", event => {
            tooltip
              .style("left", (event.clientX + 14) + "px")
              .style("top",  (event.clientY - 32) + "px");
          })
          .on("mouseout", () => tooltip.classed("visible", false));
    });

    // X axis
    const xAxisG = g.append("g")
      .attr("transform", `translate(0,${ih})`)
      .call(d3.axisBottom(xScale).tickSize(4).tickPadding(8));
    xAxisG.select(".domain").attr("stroke", css("--chart-axis-color"));
    xAxisG.selectAll(".tick line").attr("stroke", css("--chart-axis-color"));
    xAxisG.selectAll("text")
      .attr("fill",         css("--chart-text-color"))
      .attr("font-size",    "9px")
      .attr("font-family",  css("--font-ui"))
      .attr("transform",    "rotate(-35)")
      .style("text-anchor", "end");

    // Y axis
    const yAxisG = g.append("g")
      .call(d3.axisLeft(yScale).ticks(4).tickFormat(d3.format(".0%")).tickSize(4).tickPadding(6));
    yAxisG.select(".domain").attr("stroke", css("--chart-axis-color"));
    yAxisG.selectAll(".tick line").attr("stroke", css("--chart-axis-color"));
    yAxisG.selectAll("text")
      .attr("fill",        css("--chart-text-color"))
      .attr("font-size",   "9px")
      .attr("font-family", css("--font-ui"));

    // Inline legend at bottom
    const legendG = svg.append("g")
      .attr("transform", `translate(${m.left}, ${H - 12})`);

    let lx = 0;
    active.forEach(met => {
      legendG.append("circle")
        .attr("cx", lx + 5).attr("cy", 0).attr("r", 4)
        .attr("fill", met.color);
      legendG.append("text")
        .attr("x",               lx + 13)
        .attr("dominant-baseline", "middle")
        .attr("fill",            css("--text-muted"))
        .attr("font-size",       "9px")
        .attr("font-family",     css("--font-ui"))
        .text(met.label);
      lx += met.label.length * 5.8 + 22;
    });
  }

  function drawSingleSeason(wrap, d) {
    const W  = wrap.clientWidth  || 460;
    const H  = wrap.clientHeight || 220;

    const svg = d3.select(wrap)
      .append("svg")
        .attr("width",   "100%")
        .attr("viewBox", `0 0 ${W} ${H}`);

    const active = METRICS.filter(m => activeKeys.has(m.key));
    const cols   = Math.min(active.length, 3);
    const rows   = Math.ceil(active.length / cols);
    const cellW  = W / cols;
    const cellH  = (H - 32) / rows;

    active.forEach((met, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx  = col * cellW + cellW / 2;
      const cy  = row * cellH + cellH / 2;

      svg.append("text")
        .attr("x",               cx)
        .attr("y",               cy - 10)
        .attr("text-anchor",     "middle")
        .attr("dominant-baseline","middle")
        .attr("fill",            met.color)
        .attr("font-size",       "22px")
        .attr("font-family",     css("--font-display"))
        .attr("font-weight",     "700")
        .text((+d[met.key] || 0).toFixed(2));

      svg.append("text")
        .attr("x",               cx)
        .attr("y",               cy + 14)
        .attr("text-anchor",     "middle")
        .attr("fill",            css("--text-muted"))
        .attr("font-size",       "9px")
        .attr("font-family",     css("--font-ui"))
        .text(met.label);
    });

    svg.append("text")
      .attr("x",           W / 2)
      .attr("y",           H - 8)
      .attr("text-anchor", "middle")
      .attr("fill",        css("--text-muted"))
      .attr("font-size",   "9px")
      .attr("font-family", css("--font-ui"))
      .text(`${d.season}  ·  Add more seasons to data/raw/ to see trends`);
  }

  return { init };
})();

window.KroosMultilineChart = KroosMultilineChart;
