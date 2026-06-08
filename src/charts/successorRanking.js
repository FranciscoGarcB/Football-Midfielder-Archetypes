// Section 05 - Chart A
// Lollipop chart ranking the top 10 midfielders by similarity to Kroos.
// Uses similarity_to_kroos pre-computed by process_data.py when weights
// are equal, and recomputes a weighted distance when sliders change.
// Clicking a row emits "successor:selected" to drive ComparisonRadarChart.

const SuccessorRankingChart = (() => {

  let selectedId = null;

  function css(v) {
    return getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  }

  function init() {
    AppState.on("data:ready", ({ players }) => requestAnimationFrame(() => requestAnimationFrame(() => draw(players))));
    AppState.on("weights:changed", () => redraw());

    ["passing", "defense", "attack"].forEach(dim => {
      const slider = document.getElementById(`w-${dim}`);
      const valEl  = document.getElementById(`w-${dim}-val`);
      slider?.addEventListener("input", e => {
        if (valEl) valEl.textContent = e.target.value;
        AppState.set(`weights.${dim}`, +e.target.value);
        AppState.emit("weights:changed");
      });
    });

    document.getElementById("ctrl-05a-league")?.addEventListener("change", e => {
      AppState.set("successorLeague", e.target.value);
      redraw();
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
    const weights      = AppState.get("weights")  || { passing: 5, defense: 3, attack: 2 };
    const leagueFilter = AppState.get("successorLeague") || "all";
    const latest       = DataTransforms.latestSeasonPerPlayer(data);

    // Define the last two active seasons in your dataset
    const lastTwoSeasons = ["2023-24", "2024-25"];

    // Apply the new filters: age < 30 and season must be one of the last two
    let candidates = latest.filter(d =>
      d.name !== "Toni Kroos" &&
      d.minutes >= 900 &&
      d.age < 30 &&
      lastTwoSeasons.includes(d.season)
    );

    if (leagueFilter !== "all") {
      candidates = candidates.filter(d => d.league === leagueFilter);
    }

    const wTotal = (weights.passing + weights.defense + weights.attack) || 1;

    // Kroos centroid from all available seasons
    const kroosRows = data.filter(d => d.name === "Toni Kroos");

    if (!kroosRows.length) {
      // Fall back to pre-computed similarity_to_kroos
      return candidates
        .filter(d => d.similarity_to_kroos != null)
        .map(d => ({ ...d, score: +d.similarity_to_kroos }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
    }

    const centroid = {};
    DataTransforms.RADAR_AXES.forEach(ax => {
      centroid[ax.key] = d3.mean(kroosRows, d => d[ax.key] || 0) || 0;
    });

    // Helper function to calculate dot product of weighted feature arrays
    function weightedCosine(player, kroosCentroid, currentWeights) {
      let dotProduct = 0;
      let normA = 0;
      let normB = 0;

      const groups = {
        passing: DataTransforms.FEATURE_GROUPS.passing,
        defense: DataTransforms.FEATURE_GROUPS.defense,
        attack:  DataTransforms.FEATURE_GROUPS.attack
      };

      Object.keys(groups).forEach(groupKey => {
        const weight = currentWeights[groupKey] || 0;
        const features = groups[groupKey];

        features.forEach(feat => {
          const valA = (player[feat] || 0) * weight;
          const valB = (kroosCentroid[feat] || 0) * weight;

          dotProduct += valA * valB;
          normA += valA * valA;
          normB += valB * valB;
        });
      });

      if (normA === 0 || normB === 0) return 0;
      return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    // Score players using the weighted cosine function
    return candidates
      .map(d => {
        const score = weightedCosine(d, centroid, weights);
        return { ...d, score: Math.max(0, score) }; // Clamp negative correlations to 0
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }

  function draw(data) {
    const wrap = document.querySelector("[data-chart='successor-ranking']");
    if (!wrap) return;

    const ranked = rankPlayers(data);
    if (!ranked.length) return;

    wrap.innerHTML = "";

    const W      = wrap.clientWidth  || 420;
    const H      = wrap.clientHeight || 280;
    const m      = { top: 12, right: 64, bottom: 32, left: 140 };
    const iw     = W - m.left - m.right;
    const ih     = H - m.top  - m.bottom;

    const xScale = d3.scaleLinear()
      .domain([0, 1])
      .range([0, iw]);

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
      const color   = DataTransforms.CLUSTER_COLORS[d.cluster] || "#888";
      const cy      = yScale(d.name) + yScale.bandwidth() / 2;
      const targetX = xScale(d.score);
      const isSelected = d.id === selectedId;

      // Invisible hit area for the full row
      g.append("rect")
        .attr("x",       -m.left)
        .attr("y",       yScale(d.name))
        .attr("width",   W)
        .attr("height",  yScale.bandwidth())
        .attr("fill",    "transparent")
        .style("cursor", "pointer")
        .on("click", () => selectPlayer(d))
        .on("mouseover", event => {
          tooltip.classed("visible", true)
            .html(`
              <div class="tooltip-name">${d.name}</div>
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

      // Stem
      g.append("line")
        .attr("x1",           0)
        .attr("x2",           0)
        .attr("y1",           cy)
        .attr("y2",           cy)
        .attr("stroke",       isSelected ? css("--text-primary") : color)
        .attr("stroke-width", isSelected ? 2 : 1.5)
        .attr("opacity",      0.7)
        .transition().duration(500).ease(d3.easeCubicOut)
        .attr("x2", targetX);

      // Head dot
      g.append("circle")
        .attr("cx",           0)
        .attr("cy",           cy)
        .attr("r",            isSelected ? 7 : 5)
        .attr("fill",         color)
        .attr("stroke",       isSelected ? css("--text-primary") : "none")
        .attr("stroke-width", 2)
        .transition().duration(500).ease(d3.easeCubicOut)
        .attr("cx", targetX);

      // Score label
      g.append("text")
        .attr("x",               targetX + 7)
        .attr("y",               cy)
        .attr("dominant-baseline","middle")
        .attr("fill",            css("--text-muted"))
        .attr("font-size",       "9px")
        .attr("font-family",     css("--font-ui"))
        .attr("opacity",         0)
        .text(`${(d.score * 100).toFixed(0)}%`)
        .transition().delay(520).attr("opacity", 1);
    });

    // Player name labels (y axis)
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
      .attr("x",           iw / 2)
      .attr("y",           ih + 28)
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
