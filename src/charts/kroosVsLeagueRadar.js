// Section 04 - Chart B
// Radar comparing Kroos's profile for a selected season against
// the La Liga top-10% average that same season.
// Reuses RadarLeaguesChart.drawRadarSVG() with two profiles.
// Field names match the parsed rawData fields from dataLoader.js.

const KroosVsLeagueRadarChart = (() => {

  let currentSeason = null;

  function css(v) {
    return getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  }

  function init() {
    AppState.on("data:ready", ({ players }) => {
      const seasons = DataTransforms.kroosRows(players).map(d => d.season);
      currentSeason = seasons[seasons.length - 1] || null;
      populateSeasonDropdown(seasons);
      if (currentSeason) draw(players, currentSeason);
    });

    AppState.on("filters:changed", () => {
      const players = AppState.get("rawData");
      if (players && currentSeason) draw(players, currentSeason);
    });

    document.getElementById("ctrl-04b-season")?.addEventListener("change", e => {
      currentSeason = e.target.value;
      const players = AppState.get("rawData");
      if (players) draw(players, currentSeason);
    });

    const observer = new MutationObserver(() => {
      const players = AppState.get("rawData");
      if (players && currentSeason) draw(players, currentSeason);
    });
    observer.observe(document.documentElement, {
      attributes: true, attributeFilter: ["data-theme"],
    });
  }

  function populateSeasonDropdown(seasons) {
    const sel = document.getElementById("ctrl-04b-season");
    if (!sel) return;
    sel.innerHTML = "";
    seasons.forEach(s => {
      const o = document.createElement("option");
      o.value = s;
      o.textContent = s;
      if (s === currentSeason) o.selected = true;
      sel.appendChild(o);
    });
  }

  function draw(players, season) {
    const wrap = document.querySelector("[data-chart='kroos-vs-league-radar']");
    if (!wrap) return;

    // Kroos row for this season
    const kroosRow = players.find(d => d.name === "Toni Kroos" && d.season === season);
    if (!kroosRow) {
      wrap.innerHTML = "";
      showEmpty(wrap, `No Kroos data for ${season}`);
      return;
    }

    // La Liga top-10% for this season (excluding Kroos)
    const leaguePlayers = players.filter(d =>
      d.league   === "La Liga" &&
      d.season   === season    &&
      d.minutes  >= 900        &&
      d.name     !== "Toni Kroos"
    );

    if (!leaguePlayers.length) {
      wrap.innerHTML = "";
      showEmpty(wrap, `No La Liga data for ${season}`);
      return;
    }

    const axes = DataTransforms.RADAR_AXES;

    // Compute league mean profile
    const leagueMean = {};
    axes.forEach(ax => {
      leagueMean[ax.key] = d3.mean(leaguePlayers, d => d[ax.key]) ?? 0;
    });

    // Normalize both profiles to [0,1] relative to the maximum per axis
    const maxPerAxis = {};
    axes.forEach(ax => {
      maxPerAxis[ax.key] = Math.max(kroosRow[ax.key] || 0, leagueMean[ax.key] || 0) || 1;
    });

    const kroosProfile = { label: "Toni Kroos" };
    axes.forEach(ax => {
      kroosProfile[ax.key] = Math.min(1, (kroosRow[ax.key] || 0) / maxPerAxis[ax.key]);
    });

    const leagueProfile = { label: "La Liga top 10%" };
    axes.forEach(ax => {
      leagueProfile[ax.key] = Math.min(1, (leagueMean[ax.key] || 0) / maxPerAxis[ax.key]);
    });

    // Raw profiles passed for tooltip display (un-normalized)
    const rawKroos  = { label: "Toni Kroos" };
    const rawLeague = { label: "La Liga top 10%" };
    axes.forEach(ax => {
      rawKroos[ax.key]  = kroosRow[ax.key] || 0;
      rawLeague[ax.key] = leagueMean[ax.key] || 0;
    });

    RadarLeaguesChart.drawRadarSVG(wrap, [kroosProfile, leagueProfile], {
      colors:      { "Toni Kroos": css("--kroos-color"), "La Liga top 10%": css("--text-muted") },
      labelKey:    "label",
      size:        Math.min(wrap.clientWidth || 320, 340),
      rawProfiles: [rawKroos, rawLeague],
    });
  }

  function showEmpty(wrap, msg) {
    const p = document.createElement("p");
    p.textContent = msg;
    p.style.cssText = "color:var(--text-muted);font-size:0.8rem;padding:1rem;font-family:var(--font-ui)";
    wrap.appendChild(p);
  }

  return { init };
})();

window.KroosVsLeagueRadarChart = KroosVsLeagueRadarChart;
