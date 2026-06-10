// Section 05 - Chart B
// Radar overlaying the selected successor candidate against
// Kroos's average profile across all available seasons.
// Listens to AppState "successor:selected" from SuccessorRankingChart.
// Falls back to a prompt state until a player is selected.

const ComparisonRadarChart = (() => {

  function css(v) {
    return getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  }

  function init() {
    AppState.on("successor:selected", player => {
      const allData = AppState.get("rawData");
      if (!allData) return;
      draw(allData, player);
    });

    const observer = new MutationObserver(() => {
      const successor = AppState.get("selectedSuccessor");
      if (!successor) return;
      const allData = AppState.get("rawData");
      if (!allData) return;
      const player = DataTransforms.latestSeasonPerPlayer(allData)
        .find(d => d.id === successor);
      if (player) draw(allData, player);
    });
    observer.observe(document.documentElement, {
      attributes: true, attributeFilter: ["data-theme"],
    });
  }

  function draw(allData, candidate) {
    const wrap = document.querySelector("[data-chart='comparison-radar']");
    if (!wrap) return;

    const kroosRows = allData.filter(d => d.name === "Toni Kroos");

    if (!kroosRows.length) {
      showEmpty(wrap, "No Kroos data available");
      return;
    }

    const axes = DataTransforms.RADAR_AXES;

    // Kroos average across all available seasons
    const kroosAvg = {};
    axes.forEach(ax => {
      kroosAvg[ax.key] = d3.mean(kroosRows, d => d[ax.key] || 0) || 0;
    });

    // Shared max per axis for fair normalization
    const maxPerAxis = {};
    axes.forEach(ax => {
      maxPerAxis[ax.key] = Math.max(kroosAvg[ax.key], candidate[ax.key] || 0) || 1;
    });

    const kroosLabel     = "Kroos";
    const candidateLabel = candidate.name;

    const kroosProfile = { label: kroosLabel };
    axes.forEach(ax => {
      kroosProfile[ax.key] = Math.min(1, kroosAvg[ax.key] / maxPerAxis[ax.key]);
    });

    const candidateProfile = { label: candidateLabel };
    axes.forEach(ax => {
      candidateProfile[ax.key] = Math.min(1, (candidate[ax.key] || 0) / maxPerAxis[ax.key]);
    });

    // Raw (un-normalized) values for tooltip
    const rawKroos = { label: kroosLabel };
    const rawCand  = { label: candidateLabel };
    axes.forEach(ax => {
      rawKroos[ax.key] = kroosAvg[ax.key];
      rawCand[ax.key]  = candidate[ax.key] || 0;
    });

    const candColor = "#D3D3D3";

    RadarLeaguesChart.drawRadarSVG(wrap, [kroosProfile, candidateProfile], {
      colors:   {
        [kroosLabel]:     css("--kroos-color"),
        [candidateLabel]: "#5c5750",
      },
      labelKey:    "label",
      size:        Math.min(wrap.clientWidth || 320, 340),
      rawProfiles: [rawKroos, rawCand],
    });

    // Subtitle showing candidate info
    const svg  = d3.select(wrap).select("svg");
    if (svg.empty()) return;
    const size = +(svg.attr("viewBox").split(" ")[2]);

    svg.append("text")
      .attr("x",           size / 2)
      .attr("y",           12)
      .attr("text-anchor", "middle")
      .attr("fill",        css("--text-muted"))
      .attr("font-size",   "9px")
      .attr("font-family", css("--font-ui"))
      .text(`${candidate.team} · ${candidate.league} · ${candidate.season}`);
  }

  function showEmpty(wrap, msg) {
    wrap.innerHTML = "";
    const p = document.createElement("p");
    p.textContent = msg;
    p.style.cssText = "color:var(--text-muted);font-size:0.8rem;padding:1rem;font-family:var(--font-ui)";
    wrap.appendChild(p);
  }

  return { init };
})();

window.ComparisonRadarChart = ComparisonRadarChart;
