// Section 04 - Chart C
// Animated PCA trajectory of Kroos across all seasons in the archetype space.
// Background: all other midfielders as static muted dots + cluster labels.
// Foreground: growing dashed path + dots tracing his position each season.
// With a single season, shows a static snapshot with an explanatory note.
//
// Data: allData from AppState.rawData (parsed players.csv via dataLoader).
// PCA coords: d.pc1, d.pc2 (pre-computed by process_data.py).

const KroosTrajectoryChart = (() => {

  let playing   = false;
  let interval  = null;
  let gKroos    = null;
  let xScale, yScale, svgRef;
  let allData   = [];
  let kroosData = [];

  const SEASON_START_YEAR = d => +d.season.split("-")[0];

  function css(v) {
    return getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  }

  function init() {
    AppState.on("data:ready", ({ players }) => {
      allData   = players.filter(d => isFinite(d.pc1) && isFinite(d.pc2));
      kroosData = allData
        .filter(d => d.name === "Toni Kroos")
        .sort((a, b) => a.season.localeCompare(b.season));
      draw();
    });

    document.getElementById("ctrl-04c-play")?.addEventListener("click",  togglePlay);
    document.getElementById("ctrl-04c-reset")?.addEventListener("click", resetAnim);
    document.getElementById("ctrl-04c-year")?.addEventListener("input", e => {
      const y = +e.target.value;
      AppState.set("kroosYear", y);
      setYearLabel(y);
      renderFrame(y);
    });

    const observer = new MutationObserver(() => {
      if (allData.length) {
        draw();
        renderFrame(AppState.get("kroosYear") || minYear());
      }
    });
    observer.observe(document.documentElement, {
      attributes: true, attributeFilter: ["data-theme"],
    });
  }

  function minYear() {
    if (!kroosData.length) return 2017;
    return SEASON_START_YEAR(kroosData[0]);
  }

  function maxYear() {
    if (!kroosData.length) return 2017;
    return SEASON_START_YEAR(kroosData[kroosData.length - 1]);
  }

  function draw() {
    const wrap = document.querySelector("[data-chart='kroos-pca-trajectory']");
    if (!wrap || !allData.length) return;

    wrap.innerHTML = "";
    gKroos = null;

    // Single season: show snapshot
    if (kroosData.length === 1) {
      drawSnapshot(wrap);
      return;
    }

    const W  = wrap.clientWidth  || 680;
    const H  = wrap.clientHeight || 300;
    const m  = { top: 20, right: 20, bottom: 40, left: 44 };
    const iw = W - m.left - m.right;
    const ih = H - m.top  - m.bottom;

    const [x0, x1] = d3.extent(allData, d => d.pc1);
    const [y0, y1] = d3.extent(allData, d => d.pc2);
    const px = (x1 - x0) * 0.05;
    const py = (y1 - y0) * 0.05;

    xScale = d3.scaleLinear().domain([x0 - px, x1 + px]).range([0, iw]);
    yScale = d3.scaleLinear().domain([y0 - py, y1 + py]).range([ih, 0]);

    const svg = d3.select(wrap)
      .append("svg")
        .attr("width",   "100%")
        .attr("height",  "100%")
        .attr("viewBox", `0 0 ${W} ${H}`);

    svgRef = svg;
    const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);

    // Background: all non-Kroos players, colored by cluster at low opacity
    g.selectAll(".bg-dot")
      .data(allData.filter(d => d.name !== "Toni Kroos"))
      .join("circle")
        .attr("class",   "bg-dot")
        .attr("cx",      d => xScale(d.pc1))
        .attr("cy",      d => yScale(d.pc2))
        .attr("r",       2.5)
        .attr("fill",    d => DataTransforms.CLUSTER_COLORS[d.cluster] || "#888")
        .attr("opacity", 0.18)
        .style("pointer-events", "none");

    // Cluster centroid labels
    const centroids = d3.rollup(
      allData.filter(d => d.name !== "Toni Kroos"),
      v => ({ x: d3.mean(v, d => d.pc1), y: d3.mean(v, d => d.pc2) }),
      d => d.cluster
    );

    centroids.forEach((c, cid) => {
      g.append("text")
        .attr("x",           xScale(c.x))
        .attr("y",           yScale(c.y))
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("fill",        DataTransforms.CLUSTER_COLORS[cid] || "#888")
        .attr("font-size",   "9px")
        .attr("font-family", css("--font-ui"))
        .attr("font-weight", "500")
        .attr("opacity",     0.45)
        .style("pointer-events", "none")
        .text(DataTransforms.CLUSTER_NAMES[cid] || "");
    });

    // Axes
    const xAxisG = g.append("g")
      .attr("transform", `translate(0,${ih})`)
      .call(d3.axisBottom(xScale).ticks(5).tickSize(4).tickPadding(6));
    xAxisG.select(".domain").attr("stroke", css("--chart-axis-color"));
    xAxisG.selectAll(".tick line").attr("stroke", css("--chart-axis-color"));
    xAxisG.selectAll("text")
      .attr("fill",        css("--chart-text-color"))
      .attr("font-size",   "9px")
      .attr("font-family", css("--font-ui"));

    const yAxisG = g.append("g")
      .call(d3.axisLeft(yScale).ticks(5).tickSize(4).tickPadding(6));
    yAxisG.select(".domain").attr("stroke", css("--chart-axis-color"));
    yAxisG.selectAll(".tick line").attr("stroke", css("--chart-axis-color"));
    yAxisG.selectAll("text")
      .attr("fill",        css("--chart-text-color"))
      .attr("font-size",   "9px")
      .attr("font-family", css("--font-ui"));

    // Axis labels
    g.append("text")
      .attr("x", iw / 2).attr("y", ih + 34)
      .attr("text-anchor", "middle")
      .attr("fill",        css("--chart-text-color"))
      .attr("font-size",   "9px")
      .attr("font-family", css("--font-ui"))
      .text("PC1");

    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -(ih / 2)).attr("y", -34)
      .attr("text-anchor", "middle")
      .attr("fill",        css("--chart-text-color"))
      .attr("font-size",   "9px")
      .attr("font-family", css("--font-ui"))
      .text("PC2");

    // Kroos trajectory group (all animated elements go here)
    gKroos = g.append("g").attr("class", "kroos-traj");

    // Init slider range
    const slider = document.getElementById("ctrl-04c-year");
    if (slider) {
      slider.min   = minYear();
      slider.max   = maxYear();
      slider.value = minYear();
    }

    AppState.set("kroosYear", minYear());
    setYearLabel(minYear());
    renderFrame(minYear());
  }

  function renderFrame(upToYear) {
    if (!gKroos) return;
    gKroos.selectAll("*").remove();

    const visible = kroosData.filter(d => SEASON_START_YEAR(d) <= upToYear);
    if (!visible.length) return;

    // Dashed trail path connecting all visible positions
    if (visible.length > 1) {
      const lineFn = d3.line()
        .x(d => xScale(d.pc1))
        .y(d => yScale(d.pc2))
        .curve(d3.curveCatmullRom.alpha(0.5));

      gKroos.append("path")
        .datum(visible)
        .attr("d",            lineFn)
        .attr("fill",         "none")
        .attr("stroke",       css("--kroos-color"))
        .attr("stroke-width", 1.5)
        .attr("stroke-dasharray", "6,3")
        .attr("opacity",      0.6)
        .style("pointer-events", "none");
    }

    const tooltip = d3.select("body").select(".d3-tooltip");

    // Past season dots (smaller, hollow)
    visible.slice(0, -1).forEach(d => {
      gKroos.append("circle")
        .attr("cx",           xScale(d.pc1))
        .attr("cy",           yScale(d.pc2))
        .attr("r",            5)
        .attr("fill",         css("--bg-surface"))
        .attr("stroke",       css("--kroos-color"))
        .attr("stroke-width", 1.5)
        .attr("opacity",      0.7)
        .style("cursor",      "default")
        .on("mouseover", (event) => {
          tooltip.classed("visible", true)
            .html(`
              <div class="tooltip-name">Toni Kroos</div>
              <div class="tooltip-row">
                <span>Season</span>
                <span class="tooltip-val">${d.season}</span>
              </div>
              <div class="tooltip-row">
                <span>Role</span>
                <span class="tooltip-val">${DataTransforms.CLUSTER_NAMES[d.cluster] || "—"}</span>
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

    // Current season: large filled dot
    const cur = visible[visible.length - 1];

    // Outer glow ring
    gKroos.append("circle")
      .attr("cx",           xScale(cur.pc1))
      .attr("cy",           yScale(cur.pc2))
      .attr("r",            14)
      .attr("fill",         "none")
      .attr("stroke",       css("--kroos-color"))
      .attr("stroke-width", 1)
      .attr("opacity",      0.18)
      .style("pointer-events", "none");

    gKroos.append("circle")
      .attr("cx",           xScale(cur.pc1))
      .attr("cy",           yScale(cur.pc2))
      .attr("r",            8)
      .attr("fill",         css("--kroos-color"))
      .attr("stroke",       css("--bg-surface"))
      .attr("stroke-width", 1.5)
      .style("cursor",      "default")
      .on("mouseover", event => {
        tooltip.classed("visible", true)
          .html(`
            <div class="tooltip-name">Toni Kroos</div>
            <div class="tooltip-row">
              <span>Season</span>
              <span class="tooltip-val">${cur.season}</span>
            </div>
            <div class="tooltip-row">
              <span>Role</span>
              <span class="tooltip-val">${DataTransforms.CLUSTER_NAMES[cur.cluster] || "—"}</span>
            </div>
            <div class="tooltip-row">
              <span>Prog. passes</span>
              <span class="tooltip-val">${(cur.prog_passes || 0).toFixed(1)}</span>
            </div>
          `);
      })
      .on("mousemove", event => {
        tooltip
          .style("left", (event.clientX + 14) + "px")
          .style("top",  (event.clientY - 32) + "px");
      })
      .on("mouseout", () => tooltip.classed("visible", false));

    // Season label next to current dot
    const labelX = xScale(cur.pc1) + 13;
    const labelY = yScale(cur.pc2);
    gKroos.append("text")
      .attr("x",               labelX)
      .attr("y",               labelY)
      .attr("dominant-baseline", "middle")
      .attr("fill",            css("--kroos-color"))
      .attr("font-size",       "11px")
      .attr("font-family",     css("--font-ui"))
      .attr("font-weight",     "500")
      .style("pointer-events", "none")
      .text(cur.season);
  }

  function setYearLabel(year) {
    const lbl = document.getElementById("ctrl-04c-year-label");
    if (lbl) lbl.textContent = `${year}/${String(year + 1).slice(-2)}`;
  }

  function togglePlay() {
    if (playing) {
      clearInterval(interval);
      playing = false;
      document.getElementById("ctrl-04c-play").textContent = "Play";
      return;
    }

    playing = true;
    document.getElementById("ctrl-04c-play").textContent = "Pause";

    let cur = AppState.get("kroosYear") || minYear();
    if (cur >= maxYear()) cur = minYear();

    interval = setInterval(() => {
      cur++;
      AppState.set("kroosYear", cur);
      const slider = document.getElementById("ctrl-04c-year");
      if (slider) slider.value = cur;
      setYearLabel(cur);
      renderFrame(cur);

      if (cur >= maxYear()) {
        clearInterval(interval);
        playing = false;
        document.getElementById("ctrl-04c-play").textContent = "Play";
      }
    }, 900);
  }

  function resetAnim() {
    clearInterval(interval);
    playing = false;
    document.getElementById("ctrl-04c-play").textContent = "Play";
    const y = minYear();
    const slider = document.getElementById("ctrl-04c-year");
    if (slider) slider.value = y;
    AppState.set("kroosYear", y);
    setYearLabel(y);
    renderFrame(y);
  }

  function drawSnapshot(wrap) {
    const W = wrap.clientWidth  || 680;
    const H = wrap.clientHeight || 300;

    const svg = d3.select(wrap)
      .append("svg")
        .attr("width",   "100%")
        .attr("viewBox", `0 0 ${W} ${H}`);

    const d   = kroosData[0];
    const m   = { top: 20, right: 20, bottom: 40, left: 44 };
    const iw  = W - m.left - m.right;
    const ih  = H - m.top  - m.bottom;

    const pad1 = (d3.extent(allData, p => p.pc1)[1] - d3.extent(allData, p => p.pc1)[0]) * 0.05;
    const pad2 = (d3.extent(allData, p => p.pc2)[1] - d3.extent(allData, p => p.pc2)[0]) * 0.05;
    const [x0, x1] = d3.extent(allData, p => p.pc1);
    const [y0, y1] = d3.extent(allData, p => p.pc2);

    xScale = d3.scaleLinear().domain([x0 - pad1, x1 + pad1]).range([0, iw]);
    yScale = d3.scaleLinear().domain([y0 - pad2, y1 + pad2]).range([ih, 0]);

    const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);

    g.selectAll(".bg-dot")
      .data(allData.filter(p => p.name !== "Toni Kroos"))
      .join("circle")
        .attr("cx",      p => xScale(p.pc1))
        .attr("cy",      p => yScale(p.pc2))
        .attr("r",       2.5)
        .attr("fill",    p => DataTransforms.CLUSTER_COLORS[p.cluster] || "#888")
        .attr("opacity", 0.18)
        .style("pointer-events", "none");

    // Glow + dot for Kroos
    g.append("circle")
      .attr("cx", xScale(d.pc1)).attr("cy", yScale(d.pc2))
      .attr("r",  16)
      .attr("fill", "none")
      .attr("stroke", css("--kroos-color"))
      .attr("stroke-width", 1)
      .attr("opacity", 0.18)
      .style("pointer-events", "none");

    g.append("circle")
      .attr("cx", xScale(d.pc1)).attr("cy", yScale(d.pc2))
      .attr("r",  9)
      .attr("fill",   css("--kroos-color"))
      .attr("stroke", css("--bg-surface"))
      .attr("stroke-width", 1.5);

    g.append("text")
      .attr("x",  xScale(d.pc1) + 14)
      .attr("y",  yScale(d.pc2))
      .attr("dominant-baseline", "middle")
      .attr("fill",        css("--kroos-color"))
      .attr("font-size",   "11px")
      .attr("font-family", css("--font-ui"))
      .attr("font-weight", "500")
      .text(d.season);

    svg.append("text")
      .attr("x",           W / 2)
      .attr("y",           H - 6)
      .attr("text-anchor", "middle")
      .attr("fill",        css("--text-muted"))
      .attr("font-size",   "9px")
      .attr("font-family", css("--font-ui"))
      .text("Add more seasons to data/raw/ to animate the trajectory");
  }

  return { init };
})();

window.KroosTrajectoryChart = KroosTrajectoryChart;
