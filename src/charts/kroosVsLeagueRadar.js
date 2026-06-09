// Section 04 - Chart B
// Radar comparing Kroos's profile against the La Liga top-10% average.
// Season: taken from the global header filter. When set to "all", uses
// the last season Kroos appears in the dataset.
// Reuses RadarLeaguesChart.drawRadarSVG().

const KroosVsLeagueRadarChart = (() => {

  function css(v) {
    return getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  }

  function init() {
    AppState.on("data:ready", ({ players }) =>
      requestAnimationFrame(() => draw(players))
    );

    AppState.on("filters:changed", () => {
      const players = AppState.get("rawData");
      if (players) draw(players);
    });

    const observer = new MutationObserver(() => {
      const players = AppState.get("rawData");
      if (players) draw(players);
    });
    observer.observe(document.documentElement, {
      attributes: true, attributeFilter: ["data-theme"],
    });
  }

  function resolveSeason(players) {
    const f = AppState.get("filters");
    if (f.season !== "all") return f.season;
    // Fall back to the last season Kroos appears in
    const kroosSeason = DataTransforms.kroosRows(players).map(d => d.season);
    return kroosSeason[kroosSeason.length - 1] || null;
  }

  function draw(players) {
    const wrap = document.querySelector("[data-chart='kroos-vs-league-radar']");
    if (!wrap) return;

    const season = resolveSeason(players);
    if (!season) {
      wrap.innerHTML = "";
      showEmpty(wrap, "No Kroos data available");
      return;
    }

    // Always look up Kroos across all raw data (not filtered by league)
    const kroosRow = players.find(d => d.name === "Toni Kroos" && d.season === season);
    if (!kroosRow) {
      wrap.innerHTML = "";
      showEmpty(wrap, `No Kroos data for ${season}`);
      return;
    }

    // La Liga top-10% for the same season, excluding Kroos
    const leaguePlayers = players.filter(d =>
      d.league  === "La Liga" &&
      d.season  === season    &&
      d.minutes >= 900        &&
      d.name    !== "Toni Kroos"
    );

    if (!leaguePlayers.length) {
      wrap.innerHTML = "";
      showEmpty(wrap, `No La Liga data for ${season}`);
      return;
    }

    const axes = DataTransforms.RADAR_AXES;

    const leagueMean = {};
    axes.forEach(ax => {
      leagueMean[ax.key] = d3.mean(leaguePlayers, d => d[ax.key]) ?? 0;
    });

    // Normalize both relative to each axis max (Kroos vs league mean)
    const maxPerAxis = {};
    axes.forEach(ax => {
      maxPerAxis[ax.key] = Math.max(kroosRow[ax.key] || 0, leagueMean[ax.key] || 0) || 1;
    });

    const kroosProfile = { label: "Toni Kroos" };
    axes.forEach(ax => {
      kroosProfile[ax.key] = Math.min(1, (kroosRow[ax.key] || 0) / maxPerAxis[ax.key]);
    });

    const leagueProfile = { label: `La Liga top 10% (${season})` };
    axes.forEach(ax => {
      leagueProfile[ax.key] = Math.min(1, (leagueMean[ax.key] || 0) / maxPerAxis[ax.key]);
    });

    const rawKroos  = { label: "Toni Kroos" };
    const rawLeague = { label: `La Liga top 10% (${season})` };
    axes.forEach(ax => {
      rawKroos[ax.key]  = kroosRow[ax.key] || 0;
      rawLeague[ax.key] = leagueMean[ax.key] || 0;
    });

    RadarLeaguesChart.drawRadarSVG(wrap, [kroosProfile, leagueProfile], {
      colors: {
        "Toni Kroos":                css("--kroos-color"),
        [`La Liga top 10% (${season})`]: css("--text-muted"),
      },
      labelKey:    "label",
      size:        Math.min(wrap.clientWidth || 320, 340),
      rawProfiles: [rawKroos, rawLeague],
    });
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

window.KroosVsLeagueRadarChart = KroosVsLeagueRadarChart;
