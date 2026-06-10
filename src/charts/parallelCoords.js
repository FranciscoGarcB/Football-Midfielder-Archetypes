// Section 05 - Chart C
// Parallel coordinates of all filtered midfielders.
// Background lines: all players in the filtered dataset (dim gray).
// Kroos: always rendered in amber on top.
// Selected successor: rendered in their cluster color, thicker, on top of all.
// Listens to: data:ready, filters:changed, successor:selected, theme change.

const ParallelCoordsChart = (() => {

  const AXES = [
    { key: "progressive_passes_per90", label: "Prog. passes", unit: "/ 90" },
    { key: "key_passes_per90",         label: "Key passes",   unit: "/ 90" },
    { key: "xa_per90",                 label: "xA",           unit: "/ 90" },
    { key: "pass_completion_pct",      label: "Pass %",       unit: "%"    },
    { key: "np_xg_per90",              label: "npxG",         unit: "/ 90" },
    { key: "goals_per90",              label: "Goals",        unit: "/ 90" },
    { key: "tackles",                  label: "Tackles",      unit: "/ 90" },
    { key: "interceptions",            label: "Interceptions",unit: "/ 90" },
  ];

  let selectedId     = null;
  let hiddenClusters = new Set();
  let realMadridOnly = false;

  function css(v) {
    return getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  }

  function init() {
    AppState.on("data:ready", ({ players }) =>
      requestAnimationFrame(() => requestAnimationFrame(() => draw(players)))
    );
    AppState.on("filters:changed", () => redraw());
    AppState.on("filter:realmadrid", active => {
      realMadridOnly = active;
      redraw();
    });

    AppState.on("successor:selected", player => {
      selectedId = player?.id || null;
      redraw();
    });

    const observer = new MutationObserver(() => {
      if (AppState.get("rawData")) redraw();
    });
    observer.observe(document.documentElement, {
      attributes: true, attributeFilter: ["data-theme"],
    });
  }

  function redraw() {
    const data = AppState.get("rawData");
    if (data) draw(data);
  }

  function draw(rawData) {
    const wrap = document.querySelector("[data-chart='parallel-coords']");
    if (!wrap) return;

    const data = DataTransforms.applyFilters(rawData);
    if (!data.length) return;

    // Use latest season per player to avoid visual clutter from multi-season duplicates
    const latestFiltered = DataTransforms.latestSeasonPerPlayer(data);

    // Always include Kroos even if his league is filtered out
    const kroosAll = DataTransforms.latestSeasonPerPlayer(rawData)
      .filter(d => d.name === "Toni Kroos");
    const kroosIds = new Set(kroosAll.map(d => d.id));
    const latest   = [
      ...latestFiltered.filter(d => !kroosIds.has(d.id)),
      ...kroosAll,
    ];

    wrap.innerHTML = "";

    // Build cluster legend above SVG
    buildLegend(wrap);

    const W  = wrap.clientWidth  || 800;
    const H  = wrap.clientHeight || 360;
    const m  = { top: 36, right: 32, bottom: 16, left: 32 };
    const iw = W - m.left - m.right;
    const ih = H - m.top  - m.bottom;

    // Filter to axes that have actual data (player_data may be missing for some)
    const activeAxes = AXES.filter(ax =>
      latest.some(d => d[ax.key] > 0)
    );
    if (!activeAxes.length) return;

    // Per-axis scales: 0 to 98th percentile to avoid outlier compression
    const yScales = {};
    activeAxes.forEach(ax => {
      const vals = latest.map(d => +d[ax.key] || 0).sort(d3.ascending);
      const hi   = d3.quantile(vals, 0.98) || d3.max(vals) || 1;
      yScales[ax.key] = d3.scaleLinear().domain([0, hi]).range([ih, 0]).clamp(true);
    });

    const xScale = d3.scalePoint()
      .domain(activeAxes.map(a => a.key))
      .range([0, iw])
      .padding(0);

    const svg = d3.select(wrap)
      .append("svg")
        .attr("width",   "100%")
        .attr("height",  "100%")
        .attr("viewBox", `0 0 ${W} ${H}`)
        .style("overflow", "visible");

    const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);

    // Line generator
    function line(d) {
      return d3.line()(
        activeAxes.map(ax => [xScale(ax.key), yScales[ax.key](+d[ax.key] || 0)])
      );
    }

    const tooltip = d3.select("body").select(".d3-tooltip");

    // Background: all players except Kroos and selected
    const kroosColor    = css("--kroos-color");
    const bgPlayers     = latest.filter(d =>
      d.name !== "Toni Kroos" &&
      d.id   !== selectedId   &&
      !hiddenClusters.has(d.cluster) &&
      (!realMadridOnly || (d.team || "").toLowerCase().includes("real madrid"))
    );
    const selectedPlayer = latest.find(d => d.id === selectedId);
    const kroosPlayer    = latest.find(d => d.name === "Toni Kroos");

    // Layer 1: background lines
    g.append("g").attr("class", "pc-bg")
      .selectAll("path")
      .data(bgPlayers)
      .join("path")
        .attr("d",               d => line(d))
        .attr("fill",            "none")
        .attr("stroke",          css("--chart-grid-color"))
        .attr("stroke-width",    1)
        .attr("opacity",         selectedId ? 0.25 : 0.45)
        .on("mouseover", (event, d) => {
          d3.select(event.currentTarget)
            .attr("stroke",       DataTransforms.CLUSTER_COLORS[d.cluster] || "#888")
            .attr("stroke-width", 1.5)
            .attr("opacity",      0.85);
          tooltip.classed("visible", true)
            .html(`
              <div class="tooltip-name">${d.name}</div>
              <div class="tooltip-row"><span>League</span><span class="tooltip-val">${d.league}</span></div>
              <div class="tooltip-row"><span>Season</span><span class="tooltip-val">${d.season}</span></div>
              <div class="tooltip-row"><span>Role</span><span class="tooltip-val">${DataTransforms.CLUSTER_NAMES[d.cluster] || "—"}</span></div>
              <div class="tooltip-divider"></div>
              ${activeAxes.map(ax => `
              <div class="tooltip-row">
                <span>${ax.label} <span style="opacity:.55;font-size:.85em">${ax.unit}</span></span>
                <span class="tooltip-val">${(+d[ax.key] || 0).toFixed(ax.key === "pass_completion_pct" || ax.key === "long_pass_pct" ? 1 : 2)}</span>
              </div>`).join("")}
            `);
        })
        .on("mousemove", event => {
          tooltip.style("left", (event.clientX + 14) + "px")
                 .style("top",  (event.clientY - 32) + "px");
        })
        .on("mouseout", (event) => {
          d3.select(event.currentTarget)
            .attr("stroke",       css("--chart-grid-color"))
            .attr("stroke-width", 1)
            .attr("opacity",      selectedId ? 0.25 : 0.45);
          tooltip.classed("visible", false);
        });

    // Layer 2: selected successor
    if (selectedPlayer) {
      const selColor = DataTransforms.CLUSTER_COLORS[selectedPlayer.cluster] || "#60a5fa";
      g.append("path")
        .datum(selectedPlayer)
        .attr("d",            line(selectedPlayer))
        .attr("fill",         "none")
        .attr("stroke",       selColor)
        .attr("stroke-width", 2.5)
        .attr("opacity",      0.95)
        .on("mouseover", (event) => {
          tooltip.classed("visible", true)
            .html(`
              <div class="tooltip-name">${selectedPlayer.name}</div>
              <div class="tooltip-row"><span>League</span><span class="tooltip-val">${selectedPlayer.league}</span></div>
              <div class="tooltip-row"><span>Season</span><span class="tooltip-val">${selectedPlayer.season}</span></div>
              <div class="tooltip-divider"></div>
              ${activeAxes.map(ax => `
              <div class="tooltip-row">
                <span>${ax.label} <span style="opacity:.55;font-size:.85em">${ax.unit}</span></span>
                <span class="tooltip-val">${(+selectedPlayer[ax.key] || 0).toFixed(ax.key === "pass_completion_pct" || ax.key === "long_pass_pct" ? 1 : 2)}</span>
              </div>`).join("")}
            `);
        })
        .on("mousemove", event => {
          tooltip.style("left", (event.clientX + 14) + "px")
                 .style("top",  (event.clientY - 32) + "px");
        })
        .on("mouseout", () => tooltip.classed("visible", false));
    }

    // Layer 3: Kroos (always on top)
    if (kroosPlayer) {
      g.append("path")
        .datum(kroosPlayer)
        .attr("d",            line(kroosPlayer))
        .attr("fill",         "none")
        .attr("stroke",       kroosColor)
        .attr("stroke-width", 2.5)
        .attr("opacity",      1)
        .on("mouseover", event => {
          tooltip.classed("visible", true)
            .html(`
              <div class="tooltip-name">Toni Kroos</div>
              <div class="tooltip-row"><span>Season</span><span class="tooltip-val">${kroosPlayer.season}</span></div>
              <div class="tooltip-divider"></div>
              ${activeAxes.map(ax => `
              <div class="tooltip-row">
                <span>${ax.label} <span style="opacity:.55;font-size:.85em">${ax.unit}</span></span>
                <span class="tooltip-val">${(+kroosPlayer[ax.key] || 0).toFixed(ax.key === "pass_completion_pct" || ax.key === "long_pass_pct" ? 1 : 2)}</span>
              </div>`).join("")}
            `);
        })
        .on("mousemove", event => {
          tooltip.style("left", (event.clientX + 14) + "px")
                 .style("top",  (event.clientY - 32) + "px");
        })
        .on("mouseout", () => tooltip.classed("visible", false));
    }

    // Axis lines + labels
    activeAxes.forEach(ax => {
      const x = xScale(ax.key);

      // Axis line
      g.append("line")
        .attr("x1", x).attr("x2", x)
        .attr("y1", 0).attr("y2", ih)
        .attr("stroke",       css("--chart-axis-color"))
        .attr("stroke-width", 1.5);

      // Axis label at top
      g.append("text")
        .attr("x",           x)
        .attr("y",           -14)
        .attr("text-anchor", "middle")
        .attr("fill",        css("--text-secondary"))
        .attr("font-size",   "10px")
        .attr("font-family", css("--font-ui"))
        .text(ax.label);

      // Top tick value (p98)
      const hi = yScales[ax.key].domain()[1];
      g.append("text")
        .attr("x",           x + 4)
        .attr("y",           2)
        .attr("fill",        css("--text-muted"))
        .attr("font-size",   "8px")
        .attr("font-family", css("--font-ui"))
        .text(hi >= 10 ? hi.toFixed(0) : hi.toFixed(1));

      // Bottom tick value (0)
      g.append("text")
        .attr("x",           x + 4)
        .attr("y",           ih - 2)
        .attr("dominant-baseline", "auto")
        .attr("fill",        css("--text-muted"))
        .attr("font-size",   "8px")
        .attr("font-family", css("--font-ui"))
        .text("0");
    });

    // Inline line legend at bottom: Kroos + selected
    const lineItems = [];
    if (kroosPlayer)    lineItems.push({ label: "Toni Kroos", color: kroosColor, w: 2.5 });
    if (selectedPlayer) lineItems.push({ label: selectedPlayer.name, color: DataTransforms.CLUSTER_COLORS[selectedPlayer.cluster] || "#60a5fa", w: 2.5 });

    if (lineItems.length) {
      let lx = 0;
      const legG = svg.append("g").attr("transform", `translate(${m.left},${H - 4})`);
      lineItems.forEach(item => {
        legG.append("line")
          .attr("x1", lx).attr("x2", lx + 18)
          .attr("y1", 0).attr("y2", 0)
          .attr("stroke", item.color).attr("stroke-width", item.w);
        legG.append("text")
          .attr("x", lx + 22).attr("y", 0)
          .attr("dominant-baseline", "middle")
          .attr("fill",        css("--text-muted"))
          .attr("font-size",   "9px")
          .attr("font-family", css("--font-ui"))
          .text(item.label);
        lx += item.label.length * 6.2 + 34;
      });
    }
  }

  function buildLegend(wrap) {
    const div = document.createElement("div");
    div.className = "pc-cluster-legend";
    div.style.cssText = [
      "display:flex", "flex-wrap:wrap", "gap:6px 14px",
      "padding:6px 12px 4px", "font-family:var(--font-ui)",
      "font-size:0.72rem",
    ].join(";");

    Object.entries(DataTransforms.CLUSTER_NAMES).forEach(([id, name]) => {
      const cid   = +id;
      const color = DataTransforms.CLUSTER_COLORS[cid] || "#888";
      const item  = document.createElement("span");
      item.style.cssText = "display:flex;align-items:center;gap:5px;cursor:pointer;user-select:none";

      const swatch = document.createElement("span");
      swatch.style.cssText = `width:10px;height:10px;border-radius:50%;background:${color};flex-shrink:0;transition:opacity .15s`;

      const label = document.createElement("span");
      label.textContent = name;
      label.style.color = "var(--text-secondary)";
      label.style.transition = "opacity .15s";

      const setActive = () => {
        const hidden = hiddenClusters.has(cid);
        swatch.style.opacity = hidden ? "0.25" : "1";
        label.style.opacity  = hidden ? "0.35" : "1";
      };
      setActive();

      item.addEventListener("click", () => {
        if (hiddenClusters.has(cid)) hiddenClusters.delete(cid);
        else hiddenClusters.add(cid);
        setActive();
        redraw();
      });

      item.appendChild(swatch);
      item.appendChild(label);
      div.appendChild(item);
    });

    wrap.appendChild(div);
  }

  return { init };
})();

window.ParallelCoordsChart = ParallelCoordsChart;
