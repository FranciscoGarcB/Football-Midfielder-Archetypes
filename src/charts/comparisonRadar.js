// Section 05 - Chart B
// Radar overlay comparing the selected successor candidate
// against Kroos's average profile (2019-2023 prime seasons).
// Reacts to AppState "successor:selected" emitted by SuccessorRankingChart.
//
// Chart type: radar (reuses RadarLeaguesChart.drawRadarSVG)
// Two profiles: Kroos prime average (gold) vs selected player (blue)
// Axes: prog_passes, key_passes, xA, tackles, interceptions, xG

const ComparisonRadarChart = (() => {

  function init() {
    AppState.on("successor:selected", player => {
      const allData = AppState.get("rawData");
      if (!allData) return;
      draw(allData, player);
    });
  }

  function draw(allData, candidate) {
    const wrap = document.querySelector("[data-chart='comparison-radar']");
    if (!wrap) return;

    // Build Kroos prime centroid (seasons 2019-20 through 2022-23)
    const kroosPrime = allData.filter(d =>
      d.name === "Toni Kroos" &&
      d.season >= "2019-20" &&
      d.season <= "2022-23"
    );
    if (!kroosPrime.length) return;

    const axes = DataTransforms.RADAR_AXES;

    // Compute a shared maximum per axis across both subjects
    // so both polygons live on the same scale
    const allSubjects = [...kroosPrime, candidate];
    const maxPerAxis  = {};
    axes.forEach(ax => {
      maxPerAxis[ax.key] = d3.max(allSubjects, d => d[ax.key]) || 1;
    });

    const kroosProfile = { label: "Kroos (2019-23)" };
    axes.forEach(ax => {
      const avg = d3.mean(kroosPrime, d => d[ax.key]) ?? 0;
      kroosProfile[ax.key] = Math.min(1, avg / maxPerAxis[ax.key]);
    });

    const candidateProfile = { label: candidate.name };
    axes.forEach(ax => {
      candidateProfile[ax.key] = Math.min(1, (candidate[ax.key] ?? 0) / maxPerAxis[ax.key]);
    });

    RadarLeaguesChart.drawRadarSVG(wrap, [kroosProfile, candidateProfile], {
      colors:   { "Kroos (2019-23)": "#f0c060", [candidate.name]: "#60a5fa" },
      labelKey: "label",
      size:     Math.min(wrap.clientWidth || 320, 320),
    });

    // Legend appended to the SVG produced by drawRadarSVG
    const svg = d3.select(wrap).select("svg");
    if (svg.empty()) return;
    const size = +(svg.attr("viewBox").split(" ")[2]);

    [
      { label: "Kroos (2019-23)", color: "#f0c060" },
      { label: candidate.name,    color: "#60a5fa" },
    ].forEach((item, i) => {
      const g = svg.append("g")
        .attr("transform", `translate(8, ${size - 20 + i * 13})`);
      g.append("circle")
        .attr("r", 4)
        .attr("fill", item.color);
      g.append("text")
        .attr("x", 10)
        .attr("dominant-baseline", "middle")
        .attr("fill",        "var(--chart-text-color)")
        .attr("font-size",   "9px")
        .attr("font-family", "DM Sans, sans-serif")
        .text(item.label);
    });
  }

  return { init };
})();

window.ComparisonRadarChart = ComparisonRadarChart;
