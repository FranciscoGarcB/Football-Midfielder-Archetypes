// Section 05 - Chart A
// Lollipop chart ranking the top 10 midfielders by their weighted
// similarity to Kroos's prime profile (centroid of 2019-23 seasons).
//
// Similarity is computed in DataTransforms.successorRanking() as a
// weighted Euclidean distance across three feature groups.
// Higher score = more similar (distance inverted to [0, 1]).
//
// The ranking re-orders with a smooth D3 transition whenever any
// weight slider changes. Clicking a row sets AppState.selectedSuccessor
// and emits "successor:selected", which triggers ComparisonRadarChart.
//
// Controls:
//   #w-passing, #w-defense, #w-attack — range sliders (0-10)
//   #w-passing-val, etc.              — live value labels next to sliders
//   #ctrl-05a-league                  — league filter dropdown
//
// D3 features used: scaleBand, scaleLinear, line + circle for lollipop,
//                   transition for re-ranking, axisLeft, axisBottom

const SuccessorRankingChart = (() => {

  function init() {
    AppState.on("data:ready", ({ players }) => draw(players));
    AppState.on("weights:changed",  () => redraw());

    ["passing", "defense", "attack"].forEach(dim => {
      const slider = document.getElementById(`w-${dim}`);
      const valEl  = document.getElementById(`w-${dim}-val`);
      slider?.addEventListener("input", e => {
        valEl.textContent = e.target.value;
        AppState.set(`weights.${dim}`, +e.target.value);
        AppState.emit("weights:changed");
      });
    });

    document.getElementById("ctrl-05a-league")?.addEventListener("change", e => {
      AppState.set("successorLeague", e.target.value);
      redraw();
    });
  }

  function redraw() {
    const data = AppState.get("rawData");
    if (data) draw(data);
  }

  function draw(data) {
    const wrap = document.querySelector("[data-chart='successor-ranking']");
    if (!wrap) return;

    // TODO: replace placeholder and render D3 lollipop chart
    // Steps:
    // 1. Call DataTransforms.successorRanking(data, weights, 10, leagueFilter)
    // 2. Invert distance to similarity score: score = 1 - dist / maxDist
    // 3. Measure wrap width; compute height from scored.length * rowHeight
    // 4. Build xScale (scaleLinear [0,1]) and yScale (scaleBand over player names)
    // 5. Draw vertical grid lines from xScale ticks
    // 6. For each player:
    //    a. Append line (stem) from x=0 to x=xScale(score), stroke = cluster color
    //    b. Append circle (head) at x=xScale(score), fill = cluster color
    //    c. Append score label text after transition
    //    d. Append transparent full-row rect for hover/click hit area
    //       on click: AppState.set("selectedSuccessor", d.id)
    //                 AppState.emit("successor:selected", d)
    //                 update #ctrl-05b-hint text
    // 7. Draw y-axis (player names) and x-axis (percentage format)
    // 8. Tooltip on hover showing name, league, cluster, similarity score
  }

  return { init };
})();

window.SuccessorRankingChart = SuccessorRankingChart;
