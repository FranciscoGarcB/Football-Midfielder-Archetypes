// Section 03 - Main chart
// 2D PCA scatter of all midfielders. Each point is one player-season.
// PC1/PC2 are pre-computed by process_data.py and stored in players.csv.
//
// Interactions:
//   Zoom + pan        d3.zoom, scaleExtent [0.5, 14]
//   Click dot         sets AppState.selectedPlayerId, triggers PlayerCardComponent
//   Color encoding    cluster (default) | league | continuous metric
//   Season filter     #ctrl-03a-season dropdown, independent from global season
//   Cluster highlight AppState "filter:cluster" dims all other clusters
//   Reset button      #ctrl-03a-reset restores d3.zoomIdentity

const PcaScatterChart = (() => {

  let gDots, zoomBehavior, xScale, yScale, colorFn;
  let allData    = [];
  let svgEl      = null;
  let rootG      = null;
  let currentZoom = d3.zoomIdentity;

  function css(v) {
    return getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  }

  // Tracks which player name is currently highlighted via search
  let highlightedName = null;

  function init() {
    AppState.on("data:ready", ({ players }) => {
      allData = players.filter(d => isFinite(d.pc1) && isFinite(d.pc2));
      populateSeasonDropdown();
      // Defer until the browser has completed layout so clientWidth/clientHeight
      // return real values, not 0.
      requestAnimationFrame(() => {
        buildSVG();
        update();
      });
    });

    AppState.on("filters:changed",       () => update());
    AppState.on("filter:cluster",        id  => highlightCluster(+id));
    AppState.on("change:scatterColorBy", ()  => updateColors());

    document.getElementById("ctrl-03a-season")
      ?.addEventListener("change", () => update());

    document.getElementById("ctrl-03a-color")
      ?.addEventListener("change", e => {
        AppState.set("scatterColorBy", e.target.value);
      });

    document.getElementById("ctrl-03a-reset")
      ?.addEventListener("click", () => {
        clearSearch();
        resetZoom();
      });

    initSearch();

    const observer = new MutationObserver(() => {
      if (svgEl) redrawAxes();
    });
    observer.observe(document.documentElement, {
      attributes: true, attributeFilter: ["data-theme"],
    });
  }

  function initSearch() {
    const input    = document.getElementById("scatter-search");
    const dropdown = document.getElementById("scatter-search-dropdown");
    if (!input || !dropdown) return;

    let activeIndex = -1;

    input.addEventListener("input", () => {
      const q = input.value.trim().toLowerCase();
      activeIndex = -1;

      if (q.length < 2) {
        closeDropdown();
        if (!q) clearSearch();
        return;
      }

      const names = [...new Set(allData.map(d => d.name))]
        .filter(n => n.toLowerCase().includes(q))
        .sort((a, b) => {
          const aStarts = a.toLowerCase().startsWith(q);
          const bStarts = b.toLowerCase().startsWith(q);
          if (aStarts && !bStarts) return -1;
          if (!aStarts && bStarts) return 1;
          return a.localeCompare(b);
        })
        .slice(0, 12);

      if (!names.length) {
        closeDropdown();
        return;
      }

      dropdown.innerHTML = "";
      names.forEach(name => {
        const sample = allData.find(d => d.name === name);
        const li = document.createElement("li");
        li.dataset.name = name;
        li.textContent = sample?.league ? `${name} — ${sample.league}` : name;
        li.addEventListener("mousedown", e => {
          e.preventDefault();
          selectSearchResult(name);
        });
        dropdown.appendChild(li);
      });

      // Position with fixed coords so the dropdown floats outside any
      // overflow:hidden ancestor (the card header).
      const rect = input.getBoundingClientRect();
      dropdown.style.top  = (rect.bottom + 4) + "px";
      dropdown.style.left = rect.left + "px";
      dropdown.hidden = false;
    });

    // Keyboard navigation
    input.addEventListener("keydown", e => {
      const items = dropdown.querySelectorAll("li");
      if (!items.length) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        activeIndex = Math.min(activeIndex + 1, items.length - 1);
        updateActiveItem(items, activeIndex);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        activeIndex = Math.max(activeIndex - 1, 0);
        updateActiveItem(items, activeIndex);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const active = dropdown.querySelector("li.active");
        if (active) selectSearchResult(active.dataset.name);
      } else if (e.key === "Escape") {
        clearSearch();
      }
    });

    input.addEventListener("blur", () => {
      // Small delay so mousedown on a list item fires first
      setTimeout(closeDropdown, 150);
    });
  }

  function updateActiveItem(items, index) {
    items.forEach((li, i) => li.classList.toggle("active", i === index));
    items[index]?.scrollIntoView({ block: "nearest" });
  }

  function selectSearchResult(name) {
    const input    = document.getElementById("scatter-search");
    const dropdown = document.getElementById("scatter-search-dropdown");
    if (input)    input.value = name;
    if (dropdown) dropdown.hidden = true;

    highlightedName = name;
    applySearchHighlight();
  }

  function applySearchHighlight() {
    if (!gDots) return;
    if (!highlightedName) {
      gDots.selectAll("circle")
        .attr("opacity",      d => d.name === "Toni Kroos" ? 1 : 0.72)
        .attr("stroke",       d => d.name === "Toni Kroos" ? "white" : "none")
        .attr("stroke-width", d => d.name === "Toni Kroos" ? 1.5 : 0)
        .attr("r",            d => d.name === "Toni Kroos" ? 8 : 4);
      return;
    }

    gDots.selectAll("circle")
      .attr("opacity", d => {
        if (d.name === highlightedName) return 1;
        if (d.name === "Toni Kroos")   return 0.6;
        return 0.06;
      })
      .attr("r", d => {
        if (d.name === highlightedName) return 7;
        if (d.name === "Toni Kroos")   return 8;
        return 4;
      })
      .attr("stroke", d => {
        if (d.name === highlightedName) return "white";
        if (d.name === "Toni Kroos")   return "white";
        return "none";
      })
      .attr("stroke-width", d =>
        (d.name === highlightedName || d.name === "Toni Kroos") ? 1.5 : 0
      );

    // Raise highlighted dots so they sit on top
    gDots.selectAll("circle")
      .filter(d => d.name === highlightedName)
      .raise();
  }

  function clearSearch() {
    highlightedName = null;
    const input    = document.getElementById("scatter-search");
    const dropdown = document.getElementById("scatter-search-dropdown");
    if (input)    input.value = "";
    if (dropdown) dropdown.hidden = true;
    applySearchHighlight();
  }

  function closeDropdown() {
    const dropdown = document.getElementById("scatter-search-dropdown");
    if (dropdown) dropdown.hidden = true;
  }

  function populateSeasonDropdown() {
    const sel = document.getElementById("ctrl-03a-season");
    if (!sel) return;
    (AppState.get("availableSeasons") || []).forEach(s => {
      const o = document.createElement("option");
      o.value = s;
      o.textContent = s;
      sel.appendChild(o);
    });
  }

  function filteredData() {
    const f      = AppState.get("filters");
    const season = document.getElementById("ctrl-03a-season")?.value || "all";
    return allData.filter(d => {
      if (f.league !== "all" && d.league !== f.league)  return false;
      if (season   !== "all" && d.season !== season)    return false;
      if (d.minutes < f.minMinutes)                     return false;
      return true;
    });
  }

  function makeColorFn() {
    const enc = AppState.get("scatterColorBy") || "cluster";
    if (enc === "cluster") {
      return d => DataTransforms.CLUSTER_COLORS[d.cluster] || "#888";
    }
    if (enc === "league") {
      return d => DataTransforms.LEAGUE_COLORS[d.league] || "#888";
    }
    const ext   = d3.extent(allData, d => +d[enc] || 0);
    const scale = d3.scaleSequential(d3.interpolateYlOrRd).domain(ext);
    return d => scale(+d[enc] || 0);
  }

  function buildSVG() {
    const container = document.getElementById("pca-scatter-container");
    if (!container) return;
    container.innerHTML = "";

    const W  = container.clientWidth  || 580;
    const H  = container.clientHeight || 460;
    const m  = { top: 16, right: 16, bottom: 40, left: 44 };
    const iw = W - m.left - m.right;
    const ih = H - m.top  - m.bottom;

    const pad1 = (d3.extent(allData, d => d.pc1)[1] - d3.extent(allData, d => d.pc1)[0]) * 0.06;
    const pad2 = (d3.extent(allData, d => d.pc2)[1] - d3.extent(allData, d => d.pc2)[0]) * 0.06;
    const [x0, x1] = d3.extent(allData, d => d.pc1);
    const [y0, y1] = d3.extent(allData, d => d.pc2);

    xScale = d3.scaleLinear().domain([x0 - pad1, x1 + pad1]).range([0, iw]);
    yScale = d3.scaleLinear().domain([y0 - pad2, y1 + pad2]).range([ih, 0]);
    colorFn = makeColorFn();

    const svg = d3.select(container)
      .append("svg")
        .attr("width",  "100%")
        .attr("height", "100%")
        .attr("viewBox", `0 0 ${W} ${H}`);

    svgEl = svg;

    svg.append("defs")
      .append("clipPath")
        .attr("id", "scatter-clip")
      .append("rect")
        .attr("width",  iw)
        .attr("height", ih);

    rootG = svg.append("g")
      .attr("transform", `translate(${m.left},${m.top})`);

    // Grid
    rootG.append("g").attr("class", "x-grid");
    rootG.append("g").attr("class", "y-grid");

    // Axes
    rootG.append("g").attr("class", "x-axis").attr("transform", `translate(0,${ih})`);
    rootG.append("g").attr("class", "y-axis");

    // Axis labels
    rootG.append("text")
      .attr("class",       "axis-label-x")
      .attr("x",           iw / 2)
      .attr("y",           ih + 34)
      .attr("text-anchor", "middle")
      .attr("fill",        css("--chart-text-color"))
      .attr("font-size",   "10px")
      .attr("font-family", css("--font-ui"))
      .text(`PC1 — ${(AppState.get("pcaData")?.variance_explained?.[0] * 100 || 0).toFixed(1)}% variance`);

    rootG.append("text")
      .attr("class",       "axis-label-y")
      .attr("transform",   "rotate(-90)")
      .attr("x",           -(ih / 2))
      .attr("y",           -34)
      .attr("text-anchor", "middle")
      .attr("fill",        css("--chart-text-color"))
      .attr("font-size",   "10px")
      .attr("font-family", css("--font-ui"))
      .text(`PC2 — ${(AppState.get("pcaData")?.variance_explained?.[1] * 100 || 0).toFixed(1)}% variance`);

    // Dots group (clipped)
    gDots = rootG.append("g")
      .attr("clip-path", "url(#scatter-clip)")
      .attr("class",     "dots-group");

    // Zoom
    zoomBehavior = d3.zoom()
      .scaleExtent([0.4, 14])
      .on("zoom", ({ transform }) => {
        currentZoom = transform;
        const nx = transform.rescaleX(xScale);
        const ny = transform.rescaleY(yScale);
        gDots.selectAll("circle")
          .attr("cx", d => nx(d.pc1))
          .attr("cy", d => ny(d.pc2));
        drawAxes(nx, ny, iw, ih);
      });

    svg.call(zoomBehavior);

    redrawAxes();
  }

  function drawAxes(xs, ys, iw, ih) {
    if (!rootG) return;
    const W = svgEl?.attr("viewBox")?.split(" ")[2] || 580;
    const m = { top: 16, right: 16, bottom: 40, left: 44 };
    const w = (iw !== undefined) ? iw : W - m.left - m.right;
    const h = (ih !== undefined) ? ih : (+svgEl.attr("viewBox").split(" ")[3] || 460) - m.top - m.bottom;

    const xGrid = d3.axisBottom(xs || xScale).ticks(6)
      .tickSize(h).tickFormat("");
    rootG.select(".x-grid").call(xGrid)
      .call(g => g.select(".domain").remove())
      .call(g => g.selectAll("line")
        .attr("stroke", css("--chart-grid-color"))
        .attr("stroke-width", 1));

    const yGrid = d3.axisLeft(ys || yScale).ticks(6)
      .tickSize(-w).tickFormat("");
    rootG.select(".y-grid").call(yGrid)
      .call(g => g.select(".domain").remove())
      .call(g => g.selectAll("line")
        .attr("stroke", css("--chart-grid-color"))
        .attr("stroke-width", 1));

    rootG.select(".x-axis")
      .call(d3.axisBottom(xs || xScale).ticks(5).tickSize(4).tickPadding(6))
      .call(g => g.select(".domain").attr("stroke", css("--chart-axis-color")))
      .call(g => g.selectAll(".tick line").attr("stroke", css("--chart-axis-color")))
      .call(g => g.selectAll("text")
        .attr("fill",        css("--chart-text-color"))
        .attr("font-size",   "9px")
        .attr("font-family", css("--font-ui")));

    rootG.select(".y-axis")
      .call(d3.axisLeft(ys || yScale).ticks(5).tickSize(4).tickPadding(6))
      .call(g => g.select(".domain").attr("stroke", css("--chart-axis-color")))
      .call(g => g.selectAll(".tick line").attr("stroke", css("--chart-axis-color")))
      .call(g => g.selectAll("text")
        .attr("fill",        css("--chart-text-color"))
        .attr("font-size",   "9px")
        .attr("font-family", css("--font-ui")));
  }

  function redrawAxes() {
    if (!rootG) return;
    const vb     = svgEl?.attr("viewBox")?.split(" ");
    const m      = { top: 16, right: 16, bottom: 40, left: 44 };
    const iw     = (vb ? +vb[2] : 580) - m.left - m.right;
    const ih     = (vb ? +vb[3] : 460) - m.top  - m.bottom;

    const nx = currentZoom.rescaleX(xScale);
    const ny = currentZoom.rescaleY(yScale);
    drawAxes(nx, ny, iw, ih);

    rootG.select(".axis-label-x").attr("fill", css("--chart-text-color"));
    rootG.select(".axis-label-y").attr("fill", css("--chart-text-color"));
  }

  function update() {
    if (!gDots) return;

    const data    = filteredData();
    colorFn       = makeColorFn();
    const tooltip = d3.select("body").select(".d3-tooltip");

    const nx = currentZoom.rescaleX(xScale);
    const ny = currentZoom.rescaleY(yScale);

    const isKroos = d => d.name === "Toni Kroos";

    gDots.selectAll("circle")
      .data(data, d => d.id + "_" + d.season)
      .join(
        enter => enter.append("circle")
          .attr("cx",           d => nx(d.pc1))
          .attr("cy",           d => ny(d.pc2))
          .attr("r",            0)
          .attr("fill",         d => isKroos(d) ? css("--kroos-color") : colorFn(d))
          .attr("stroke",       d => isKroos(d) ? "white" : "none")
          .attr("stroke-width", d => isKroos(d) ? 1.5 : 0)
          .attr("opacity",      d => isKroos(d) ? 1 : 0.72)
          .style("cursor",      "pointer")
          .call(e => e.transition().duration(350)
            .attr("r", d => isKroos(d) ? 8 : 4))
          .on("mouseover", (event, d) => {
            d3.select(event.currentTarget).attr("r", isKroos(d) ? 10 : 6);
            tooltip.classed("visible", true)
              .html(`
                <div class="tooltip-name">${d.name}</div>
                <div class="tooltip-row">
                  <span>Team</span>
                  <span class="tooltip-val">${d.team}</span>
                </div>
                <div class="tooltip-row">
                  <span>League</span>
                  <span class="tooltip-val">${d.league}</span>
                </div>
                <div class="tooltip-row">
                  <span>Season</span>
                  <span class="tooltip-val">${d.season}</span>
                </div>
                <div class="tooltip-row">
                  <span>Role</span>
                  <span class="tooltip-val">${DataTransforms.CLUSTER_NAMES[d.cluster] || "—"}</span>
                </div>
                <div class="tooltip-row">
                  <span>Prog. passes</span>
                  <span class="tooltip-val">${d.prog_passes?.toFixed(1) ?? "—"}</span>
                </div>
              `);
          })
          .on("mousemove", event => {
            tooltip
              .style("left", (event.clientX + 14) + "px")
              .style("top",  (event.clientY - 32) + "px");
          })
          .on("mouseout", (event, d) => {
            d3.select(event.currentTarget).attr("r", isKroos(d) ? 8 : 4);
            tooltip.classed("visible", false);
          })
          .on("click", (event, d) => {
            AppState.set("selectedPlayerId", d.id);
          }),

        update => update
          .transition().duration(350)
          .attr("cx",    d => nx(d.pc1))
          .attr("cy",    d => ny(d.pc2))
          .attr("fill",  d => isKroos(d) ? css("--kroos-color") : colorFn(d))
          .attr("r",     d => isKroos(d) ? 8 : 4)
          .attr("opacity", d => isKroos(d) ? 1 : 0.72),

        exit => exit
          .transition().duration(200)
          .attr("r", 0)
          .remove()
      );

    // Raise Kroos dots so they always sit on top
    gDots.selectAll("circle")
      .filter(d => isKroos(d))
      .raise();

    // Re-apply any active search highlight after the join
    applySearchHighlight();
  }

  function updateColors() {
    colorFn = makeColorFn();
    if (!gDots) return;
    gDots.selectAll("circle")
      .filter(d => d.name !== "Toni Kroos")
      .attr("fill", d => colorFn(d));
  }

  function highlightCluster(clusterId) {
    if (!gDots) return;
    const isAll = clusterId === -1;
    gDots.selectAll("circle")
      .attr("opacity", d => {
        if (d.name === "Toni Kroos") return 1;
        if (isAll) return 0.72;
        return d.cluster === clusterId ? 0.88 : 0.06;
      });
  }

  function resetZoom() {
    if (!svgEl) return;
    currentZoom = d3.zoomIdentity;
    svgEl.transition().duration(400)
      .call(zoomBehavior.transform, d3.zoomIdentity);
    gDots?.selectAll("circle")
      .filter(d => d.name !== "Toni Kroos")
      .attr("opacity", 0.72);
  }

  return { init };
})();

window.PcaScatterChart = PcaScatterChart;
