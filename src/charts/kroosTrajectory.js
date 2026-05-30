// Section 04 - Chart C
// Animated PCA trajectory showing where Kroos moved in the archetype
// space from 2017-18 to 2023-24.
//
// Background: all non-Kroos midfielders as small static gray dots,
//             cluster centroid labels rendered at low opacity.
// Foreground: a growing dashed path connecting Kroos season positions,
//             past positions shown as small gold dots,
//             current position as a larger gold dot with a label.
//
// Controls:
//   #ctrl-04c-play   — button toggling play / pause, auto-advances year every 800ms
//   #ctrl-04c-year   — range input 2017-2023, manually scrubs the frame
//   #ctrl-04c-reset  — resets to 2017, stops playback
//
// D3 features used: scaleLinear, line, curveMonotoneX, circle join,
//                   d3.rollup for cluster centroid computation

const KroosTrajectoryChart = (() => {

  const SEASONS_RANGE = { min: 2017, max: 2023 };

  let playing   = false;
  let interval  = null;
  let gKroos    = null;
  let xScale, yScale;
  let allData   = [];
  let kroosData = [];

  function init() {
    AppState.on("data:ready", ({ players }) => {
      allData   = players.filter(d => !isNaN(d.pc1) && !isNaN(d.pc2));
      kroosData = allData
        .filter(d => d.name === "Toni Kroos")
        .sort((a, b) => a.season.localeCompare(b.season));
      draw();
    });

    document.getElementById("ctrl-04c-play")?.addEventListener("click",  togglePlay);
    document.getElementById("ctrl-04c-reset")?.addEventListener("click", resetAnim);
    document.getElementById("ctrl-04c-year")?.addEventListener("input",  e => {
      const y = +e.target.value;
      AppState.set("kroosYear", y);
      setYearLabel(y);
      renderFrame(y);
    });
  }

  function draw() {
    const wrap = document.querySelector("[data-chart='kroos-pca-trajectory']");
    if (!wrap) return;

    // TODO: replace placeholder and build the trajectory chart
    // Steps:
    // 1. Measure wrap dimensions, define margins
    // 2. Build xScale, yScale from d3.extent over all allData pc1/pc2 + 0.5 padding
    // 3. Draw background gray dots for all non-Kroos players (r=2.5, opacity 0.4)
    // 4. Compute cluster centroids with d3.rollup; label each at low opacity
    //    using DataTransforms.CLUSTER_NAMES and CLUSTER_COLORS
    // 5. Draw x and y axes
    // 6. Append gKroos = g.append("g") — all animated elements live here
    // 7. Call renderFrame(AppState.get("kroosYear") || 2017)
  }

  function renderFrame(upToYear) {
    // TODO: update gKroos contents for the given year
    // Steps:
    // 1. gKroos.selectAll("*").remove() to clear previous frame
    // 2. Filter kroosData to seasons where season year <= upToYear
    // 3. If more than one visible season: draw dashed path with curveMonotoneX
    // 4. Draw small gold circles for all past seasons (not current)
    // 5. Draw the current season dot larger (r=8) with gold fill and white stroke
    // 6. Append season label text next to the current dot
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

    let cur = AppState.get("kroosYear") || SEASONS_RANGE.min;
    if (cur >= SEASONS_RANGE.max) cur = SEASONS_RANGE.min;

    interval = setInterval(() => {
      cur++;
      AppState.set("kroosYear", cur);
      const slider = document.getElementById("ctrl-04c-year");
      if (slider) slider.value = cur;
      setYearLabel(cur);
      renderFrame(cur);

      if (cur >= SEASONS_RANGE.max) {
        clearInterval(interval);
        playing = false;
        document.getElementById("ctrl-04c-play").textContent = "Play";
      }
    }, 800);
  }

  function resetAnim() {
    clearInterval(interval);
    playing = false;
    document.getElementById("ctrl-04c-play").textContent = "Play";

    const slider = document.getElementById("ctrl-04c-year");
    if (slider) slider.value = SEASONS_RANGE.min;
    AppState.set("kroosYear", SEASONS_RANGE.min);
    setYearLabel(SEASONS_RANGE.min);
    renderFrame(SEASONS_RANGE.min);
  }

  return { init };
})();

window.KroosTrajectoryChart = KroosTrajectoryChart;
