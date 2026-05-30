// Section 03 - Main chart
// 2D scatter plot of all midfielders projected onto PCA space.
// PC1 and PC2 are pre-computed in Python (players.csv columns).
//
// Interactions:
//   Zoom + pan         — d3.zoom, scaleExtent [0.5, 12]
//   Click on dot       — sets AppState.selectedPlayerId, triggers PlayerCardComponent
//   Color encoding     — cluster (default), league, or continuous metric via dropdown
//   Season filter      — #ctrl-03a-season dropdown (independent from global season)
//   Cluster highlight  — AppState "filter:cluster" dims all other clusters
//   Reset zoom button  — #ctrl-03a-reset restores d3.zoomIdentity
//
// Kroos dots are rendered larger (r=7) with a gold stroke ring.
// All other dots r=4, fill from colorFn, opacity 0.65.
//
// D3 features used: scaleLinear, zoom, circle join with enter/update/exit,
//                   axisBottom, axisLeft, clip-path

const PcaScatterChart = (() => {

  let svg, gDots, zoomBehavior, xScale, yScale, colorFn;
  let allData = [];

  function init() {
    AppState.on("data:ready", ({ players }) => {
      allData = players.filter(d => !isNaN(d.pc1) && !isNaN(d.pc2));
      draw();
    });

    AppState.on("filters:changed",       () => update());
    AppState.on("filter:cluster",        id  => highlightCluster(+id));
    AppState.on("change:scatterColorBy", ()  => updateColors());

    document.getElementById("ctrl-03a-season")?.addEventListener("change", () => update());
    document.getElementById("ctrl-03a-color")?.addEventListener("change", e => {
      AppState.set("scatterColorBy", e.target.value);
    });
    document.getElementById("ctrl-03a-reset")?.addEventListener("click", resetZoom);

    AppState.on("data:ready", () => {
      const sel = document.getElementById("ctrl-03a-season");
      if (!sel) return;
      (AppState.get("availableSeasons") || []).forEach(s => {
        const o = document.createElement("option");
        o.value = s;
        o.textContent = s;
        sel.appendChild(o);
      });
    });
  }

  function filteredData() {
    const f      = AppState.get("filters");
    const season = document.getElementById("ctrl-03a-season")?.value || "all";
    return allData.filter(d => {
      if (f.league !== "all" && d.league !== f.league)   return false;
      if (season   !== "all" && d.season !== season)     return false;
      if (d.minutes < f.minMinutes)                      return false;
      return true;
    });
  }

  function makeColorFn(encoding) {
    if (encoding === "cluster") {
      return d => DataTransforms.CLUSTER_COLORS[d.cluster] || "#888";
    }
    if (encoding === "league") {
      return d => DataTransforms.LEAGUE_COLORS[d.league] || "#888";
    }
    const ext   = d3.extent(allData, d => d[encoding] || 0);
    const scale = d3.scaleSequential(d3.interpolatePlasma).domain(ext);
    return d => scale(d[encoding] || 0);
  }

  function draw() {
    const container = document.getElementById("pca-scatter-container");
    if (!container) return;

    // TODO: replace placeholder and build D3 scatter
    // Steps:
    // 1. Measure container dimensions
    // 2. Create SVG with a <defs><clipPath id="scatter-clip"> bounding the plot area
    // 3. Build xScale, yScale from d3.extent of pc1/pc2 with 0.5 padding
    // 4. Assign colorFn = makeColorFn(AppState.get("scatterColorBy"))
    // 5. Draw subtle grid: axisBottom + axisLeft with tickSize matching plot area
    // 6. Append gDots group clipped to "scatter-clip"
    // 7. Attach d3.zoom with scaleExtent; on zoom rescale x/y and reposition circles
    // 8. Draw PC1 and PC2 axis labels
    // 9. Call update() to populate dots
  }

  function update() {
    // TODO: data join on filteredData()
    // enter: circle r=0 → r (transition 400ms), fill colorFn, Kroos r=7 gold stroke
    //        attach mouseover tooltip, click → AppState.set("selectedPlayerId", d.id)
    // update: transition cx/cy/fill
    // exit: transition r=0, remove
  }

  function updateColors() {
    // TODO: reassign colorFn, update all circle fills without full redraw
  }

  function highlightCluster(clusterId) {
    // TODO: set circle opacity to 0.08 for non-matching clusters, 0.85 for matching
    //       clusterId === -1 means reset all to 0.65
  }

  function resetZoom() {
    // TODO: svg.transition().call(zoomBehavior.transform, d3.zoomIdentity)
    //       reset all circle opacities to 0.65
  }

  return { init };
})();

window.PcaScatterChart = PcaScatterChart;
