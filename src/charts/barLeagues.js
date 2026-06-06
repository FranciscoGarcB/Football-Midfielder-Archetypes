// Section 02 - Chart B
// Horizontal bar chart comparing one metric across all five leagues,
// averaged over the top 10% of midfielders by minutes per league.
// Bars animate in on first draw and transition smoothly when the
// metric or sort order changes.

const BarLeaguesChart = (() => {

  const METRIC_LABELS = {
    xa_per90:         "xA / 90",
    key_passes_per90: "Key passes / 90",
    np_xg_per90:      "npxG / 90",
    goals_per90:      "Goals / 90",
    tackles:          "Tackles / 90",
    interceptions:    "Interceptions / 90",
  };

  let currentMetric = "xa_per90";
  let currentSort   = "value";

  function css(v) {
    return getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  }

  function init() {
    AppState.on("data:ready", ({ players }) => requestAnimationFrame(() => draw(players)));
    AppState.on("filters:changed", () => redraw());

    document.getElementById("ctrl-02b-metric")?.addEventListener("change", e => {
      currentMetric = e.target.value;
      redraw();
    });
    document.getElementById("ctrl-02b-sort")?.addEventListener("change", e => {
      currentSort = e.target.value;
      redraw();
    });

    const observer = new MutationObserver(() => {
      const data = AppState.get("rawData");
      if (data) draw(DataTransforms.applyFilters(data));
    });
    observer.observe(document.documentElement, {
      attributes: true, attributeFilter: ["data-theme"],
    });
  }

  function redraw() {
    const data = AppState.get("rawData");
    if (data) draw(DataTransforms.applyFilters(data));
  }

  function sorted(profiles) {
    const copy = [...profiles];
    if (currentSort === "value") {
      copy.sort((a, b) => b[currentMetric] - a[currentMetric]);
    } else {
      copy.sort((a, b) => a.league.localeCompare(b.league));
    }
    return copy;
  }

  function draw(data) {
    const wrap = document.querySelector("[data-chart='bar-leagues']");
    if (!wrap) return;

    const profiles = sorted(DataTransforms.leagueProfiles(data));
    if (!profiles.length) return;

    const W      = wrap.clientWidth  || 420;
    const H      = wrap.clientHeight || 280;
    const m      = { top: 12, right: 56, bottom: 34, left: 116 };
    const iw     = W - m.left - m.right;
    const ih     = H - m.top  - m.bottom;

    const xMax   = (d3.max(profiles, d => d[currentMetric]) || 1) * 1.15;
    const xScale = d3.scaleLinear().domain([0, xMax]).range([0, iw]);
    const yScale = d3.scaleBand()
      .domain(profiles.map(d => d.league))
      .range([0, ih])
      .padding(0.38);

    const tooltip = d3.select("body").select(".d3-tooltip");

    wrap.innerHTML = "";

    const svg = d3.select(wrap)
      .append("svg")
        .attr("width",   "100%")
        .attr("height",  "100%")
        .attr("viewBox", `0 0 ${W} ${H}`);

    // Remove old content and redraw — simpler than a full enter/update/exit
    // because axes and grid need to move together with the bars on sort change
    svg.selectAll("*").remove();

    const g = svg.append("g")
      .attr("transform", `translate(${m.left},${m.top})`);

    // Vertical grid lines
    xScale.ticks(5).forEach(t => {
      g.append("line")
        .attr("x1", xScale(t)).attr("x2", xScale(t))
        .attr("y1", 0)         .attr("y2", ih)
        .attr("stroke",       css("--chart-grid-color"))
        .attr("stroke-width", 1);
    });

    // Bars
    profiles.forEach(d => {
      const color  = DataTransforms.LEAGUE_COLORS[d.league] || "#888";
      const y      = yScale(d.league);
      const bh     = yScale.bandwidth();
      const target = xScale(d[currentMetric]);

      // Bar
      g.append("rect")
        .attr("x",      0)
        .attr("y",      y)
        .attr("height", bh)
        .attr("width",  0)
        .attr("fill",   color)
        .attr("rx",     3)
        .attr("opacity", 0.82)
        .style("cursor", "default")
        .on("mouseover", function (event) {
          d3.select(this).attr("opacity", 1);
          const metricLabel = METRIC_LABELS[currentMetric] || currentMetric;
          tooltip.classed("visible", true)
            .html(`
              <div class="tooltip-name">${d.league}</div>
              <div class="tooltip-row">
                <span>${metricLabel}</span>
                <span class="tooltip-val">${d[currentMetric].toFixed(2)}</span>
              </div>
              <div class="tooltip-row">
                <span>Top 10% avg</span>
                <span class="tooltip-val"></span>
              </div>
            `);
        })
        .on("mousemove", event => {
          tooltip
            .style("left", (event.clientX + 14) + "px")
            .style("top",  (event.clientY - 32) + "px");
        })
        .on("mouseout", function () {
          d3.select(this).attr("opacity", 0.82);
          tooltip.classed("visible", false);
        })
        .transition()
          .duration(550)
          .ease(d3.easeCubicOut)
          .attr("width", target);

      // Value label — appears after bar has animated
      g.append("text")
        .attr("x",               target + 5)
        .attr("y",               y + bh / 2)
        .attr("dominant-baseline", "middle")
        .attr("fill",            css("--text-muted"))
        .attr("font-size",       "10px")
        .attr("font-family",     css("--font-ui"))
        .attr("opacity",         0)
        .text(d[currentMetric].toFixed(2))
        .transition()
          .delay(560)
          .duration(140)
          .attr("opacity", 1);
    });

    // League name labels (y axis)
    profiles.forEach(d => {
      const color = DataTransforms.LEAGUE_COLORS[d.league] || css("--text-secondary");
      g.append("text")
        .attr("x",               -10)
        .attr("y",               yScale(d.league) + yScale.bandwidth() / 2)
        .attr("text-anchor",     "end")
        .attr("dominant-baseline", "middle")
        .attr("fill",            color)
        .attr("font-size",       "11px")
        .attr("font-family",     css("--font-ui"))
        .attr("font-weight",     "500")
        .text(d.league);
    });

    // X axis
    const xAxisG = g.append("g")
      .attr("transform", `translate(0,${ih})`)
      .call(
        d3.axisBottom(xScale)
          .ticks(5)
          .tickSize(4)
          .tickPadding(6)
      );

    xAxisG.select(".domain").attr("stroke", css("--chart-axis-color"));
    xAxisG.selectAll(".tick line").attr("stroke", css("--chart-axis-color"));
    xAxisG.selectAll("text")
      .attr("fill",        css("--chart-text-color"))
      .attr("font-size",   "10px")
      .attr("font-family", css("--font-ui"));

    // X axis label
    g.append("text")
      .attr("x",           iw / 2)
      .attr("y",           ih + 30)
      .attr("text-anchor", "middle")
      .attr("fill",        css("--text-muted"))
      .attr("font-size",   "9px")
      .attr("font-family", css("--font-ui"))
      .text(METRIC_LABELS[currentMetric] || currentMetric);
  }

  return { init };
})();

window.BarLeaguesChart = BarLeaguesChart;
