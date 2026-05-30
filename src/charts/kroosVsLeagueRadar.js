// Section 04 - Chart B
// Radar comparing Kroos's profile in a selected season against
// the La Liga top-10% average that same season.
// Reuses RadarLeaguesChart.drawRadarSVG() with two profiles.
//
// Profiles:
//   Kroos (gold)          — single row for the selected season
//   La Liga top 10% (gray) — mean of players above the 90th percentile
//                            by minutes, in La Liga, same season
//
// Both profiles are normalized to [0, 1] relative to the maximum
// value across both subjects per axis so the comparison is fair.
//
// Controls:
//   #ctrl-04b-season — dropdown; options populated from Kroos seasons

const KroosVsLeagueRadarChart = (() => {

  let currentSeason = "2022-23";

  function init() {
    AppState.on("data:ready", ({ players }) => {
      populateSeasonDropdown(players);
      draw(players, currentSeason);
    });

    document.getElementById("ctrl-04b-season")?.addEventListener("change", e => {
      currentSeason = e.target.value;
      const players = AppState.get("rawData");
      if (players) draw(players, currentSeason);
    });
  }

  function populateSeasonDropdown(players) {
    const sel = document.getElementById("ctrl-04b-season");
    if (!sel) return;
    sel.innerHTML = "";
    DataTransforms.kroosRows(players).forEach(d => {
      const o = document.createElement("option");
      o.value = d.season;
      o.textContent = d.season;
      if (d.season === currentSeason) o.selected = true;
      sel.appendChild(o);
    });
  }

  function draw(players, season) {
    const wrap = document.querySelector("[data-chart='kroos-vs-league-radar']");
    if (!wrap) return;

    // TODO: render radar with two profiles
    // Steps:
    // 1. Find the Kroos row for the given season
    // 2. Collect La Liga players that season with minutes >= 900, excluding Kroos
    // 3. Compute the league profile as mean per RADAR_AXES key
    // 4. Normalize both profiles: maxPerAxis = d3.max([kroosRow, leagueProfile], d => d[key])
    // 5. Build kroosProfile and leagueProfile objects with label keys
    // 6. Call RadarLeaguesChart.drawRadarSVG(wrap, [kroos, league], opts)
    // 7. Append a two-item legend at the bottom of the SVG
  }

  return { init };
})();

window.KroosVsLeagueRadarChart = KroosVsLeagueRadarChart;
