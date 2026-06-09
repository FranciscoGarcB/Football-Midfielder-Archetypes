// Section 05 - Chart A
// Lollipop chart ranking the top 10 midfielders by similarity to Kroos.
// Responds to global filters: league, season, and minimum minutes.
// Clicking a row emits "successor:selected" to drive ComparisonRadarChart.

const SuccessorRankingChart = (() => {

  let selectedId = null;

  function css(v) {
    return getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  }

  function init() {
    AppState.on("data:ready", ({ players }) =>
      requestAnimationFrame(() => requestAnimationFrame(() => draw(players)))
    );

    AppState.on("filters:changed", () => redraw());

    document.getElementById("ctrl-05a-maxage")
      ?.addEventListener("change", () => redraw());

    document.getElementById("filter-team")
      ?.addEventListener("change", () => {
        AppState.trigger("filters:changed");
      });

    const observer = new MutationObserver(() => {
      const data = AppState.get("rawData");
      if (data) draw(data);
    });
    observer.observe(document.documentElement, {
      attributes: true, attributeFilter: ["data-theme"],
    });
  }

  function redraw() {
    const data = AppState.get("rawData");
    if (data) draw(data);
  }

  function rankPlayers(data) {
    // Apply the same global filters as every other chart
    const filtered = DataTransforms.applyFilters(data);

    const latest = DataTransforms.latestSeasonPerPlayer(filtered);

    const maxAge = +(document.getElementById("ctrl-05a-maxage")?.value || 99);
    const selectedTeam = document.getElementById("filter-team")?.value || "all";

    const candidates = latest.filter(d => {
      // Direct pull from your pre-calculated dataset column
      const currentAge = d.current_age || d['current_age']|| d.age;

      return d.name !== "Toni Kroos" &&
        d.similarity_to_kroos != null &&
        isFinite(+d.similarity_to_kroos) &&
        (currentAge <= maxAge) && // Connects age check directly to column
        (selectedTeam === "all" || d.team === selectedTeam)
    });

    return candidates
      .sort((a, b) => b.similarity_to_kroos - a.similarity_to_kroos)
      .slice(0, 10)
      .map(d => ({ ...d, score: +d.similarity_to_kroos }));
  }

  function draw(data) {
    const wrap = document.querySelector("[data-chart='successor-ranking']");
    if (!wrap) return;

    const ranked = rankPlayers(data);
    if (!ranked.length) {
      wrap.innerHTML = "";
      const p = document.createElement("p");
      p.textContent = "No players match the current filters.";
      p.style.cssText = "color:var(--text-muted);font-size:0.8rem;padding:1rem;font-family:var(--font-ui)";
      wrap.appendChild(p);
      return;
    }

    wrap.innerHTML = "";

    const W      = wrap.clientWidth  || 420;
    const H      = wrap.clientHeight || 280;
    const m      = { top: 12, right: 64, bottom: 32, left: 140 };
    const iw     = W - m.left - m.right;
    const ih     = H - m.top  - m.bottom;

    const xScale = d3.scaleLinear().domain([0, 1]).range([0, iw]);

    const yScale = d3.scaleBand()
      .domain(ranked.map(d => d.name))
      .range([0, ih])
      .padding(0.35);

    const svg = d3.select(wrap)
      .append("svg")
        .attr("width",   "100%")
        .attr("height",  "100%")
        .attr("viewBox", `0 0 ${W} ${H}`);

    const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);

    // Grid lines
    xScale.ticks(4).forEach(t => {
      g.append("line")
        .attr("x1", xScale(t)).attr("x2", xScale(t))
        .attr("y1", 0)         .attr("y2", ih)
        .attr("stroke",       css("--chart-grid-color"))
        .attr("stroke-width", 1);
    });

    const tooltip = d3.select("body").select(".d3-tooltip");

    ranked.forEach((d, i) => {
      const color      = DataTransforms.CLUSTER_COLORS[d.cluster] || "#888";
      const cy         = yScale(d.name) + yScale.bandwidth() / 2;
      const targetX    = xScale(d.score);
      const isSelected = d.id === selectedId;

      // Hit area for the full row
      g.append("rect")
        .attr("x",       -m.left)
        .attr("y",       yScale(d.name))
        .attr("width",   W)
        .attr("height",  yScale.bandwidth())
        .attr("fill",    "transparent")
        .style("cursor", "pointer")
        .on("click", () => selectPlayer(d))
        .on("mouseover", event => {
          // Point the tooltip directly to the column property
          const currentAge = d.current_age || d['current_age'] || d.age;

          tooltip.classed("visible", true)
            .html(`
              <div class="tooltip-name">${d.name}</div>
              <div class="tooltip-row">
                <span>Current Age</span>
                <span class="tooltip-val">${currentAge || "—"}</span>
              </div>
              <div class="tooltip-row">
                <span>League</span>
                <span class="tooltip-val">${d.league}</span>
              </div>
              <div class="tooltip-row">
                <span>Role</span>
                <span class="tooltip-val">${DataTransforms.CLUSTER_NAMES[d.cluster] || "—"}</span>
              </div>
              <div class="tooltip-row">
                <span>Similarity</span>
                <span class="tooltip-val">${(d.score * 100).toFixed(1)}%</span>
              </div>
            `);
        })
        .on("mousemove", event => {
          tooltip
            .style("left", (event.clientX + 14) + "px")
            .style("top",  (event.clientY - 32) + "px");
        })
        .on("mouseout", () => tooltip.classed("visible", false));

      // Rank number
      g.append("text")
        .attr("x",               -m.left + 4)
        .attr("y",               cy)
        .attr("dominant-baseline","middle")
        .attr("fill",            css("--text-muted"))
        .attr("font-size",       "9px")
        .attr("font-family",     css("--font-ui"))
        .text(i + 1);

      // Stem — pointer-events:none so rect handles all clicks
      g.append("line")
        .attr("x1", 0).attr("x2", targetX)
        .attr("y1", cy).attr("y2", cy)
        .attr("stroke",       isSelected ? css("--text-primary") : color)
        .attr("stroke-width", isSelected ? 2 : 1.5)
        .attr("opacity",      0.7)
        .style("pointer-events", "none");

      // Head dot
      g.append("circle")
        .attr("cx",           targetX)
        .attr("cy",           cy)
        .attr("r",            isSelected ? 7 : 5)
        .attr("fill",         color)
        .attr("stroke",       isSelected ? css("--text-primary") : "none")
        .attr("stroke-width", 2)
        .style("pointer-events", "none");

      // Score label
      g.append("text")
        .attr("x", targetX + 7).attr("y", cy)
        .attr("dominant-baseline", "middle")
        .attr("fill",        css("--text-muted"))
        .attr("font-size",   "9px")
        .attr("font-family", css("--font-ui"))
        .style("pointer-events", "none")
        .text(`${(d.score * 100).toFixed(0)}%`);
    });

    // Player name labels
    ranked.forEach(d => {
      const isSelected = d.id === selectedId;
      g.append("text")
        .attr("x",               -10)
        .attr("y",               yScale(d.name) + yScale.bandwidth() / 2)
        .attr("text-anchor",     "end")
        .attr("dominant-baseline","middle")
        .attr("fill",            isSelected ? css("--text-primary") : css("--text-secondary"))
        .attr("font-size",       "10px")
        .attr("font-family",     css("--font-ui"))
        .attr("font-weight",     isSelected ? "600" : "400")
        .style("cursor",         "pointer")
        .text(d.name)
        .on("click", () => selectPlayer(d));
    });

    // X axis
    const xAxisG = g.append("g")
      .attr("transform", `translate(0,${ih})`)
      .call(d3.axisBottom(xScale).ticks(4).tickFormat(d3.format(".0%")).tickSize(4).tickPadding(6));
    xAxisG.select(".domain").attr("stroke", css("--chart-axis-color"));
    xAxisG.selectAll(".tick line").attr("stroke", css("--chart-axis-color"));
    xAxisG.selectAll("text")
      .attr("fill",        css("--chart-text-color"))
      .attr("font-size",   "9px")
      .attr("font-family", css("--font-ui"));

    g.append("text")
      .attr("x", iw / 2).attr("y", ih + 28)
      .attr("text-anchor", "middle")
      .attr("fill",        css("--text-muted"))
      .attr("font-size",   "9px")
      .attr("font-family", css("--font-ui"))
      .text("Similarity to Kroos");
  }

  function selectPlayer(d) {
    selectedId = d.id;
    AppState.set("selectedSuccessor", d.id);
    AppState.emit("successor:selected", d);

    const hint = document.getElementById("ctrl-05b-hint");
    if (hint) hint.textContent = `Comparing vs ${d.name}`;

    redraw();
  }

  return { init };
})();

window.SuccessorRankingChart = SuccessorRankingChart;
