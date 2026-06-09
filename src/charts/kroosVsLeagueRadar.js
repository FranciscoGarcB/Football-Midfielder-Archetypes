// Section 04 - Chart B
// Radar comparing Kroos's average profile (across all available seasons)
// against the La Liga top-10% average across the same seasons.
// Not affected by any header filter — uses all Kroos data always.

const KroosVsLeagueRadarChart = (() => {

  function css(v) {
    return getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  }

  function init() {
    AppState.on("data:ready", ({ players }) =>
      requestAnimationFrame(() => draw(players))
    );

    const observer = new MutationObserver(() => {
      const players = AppState.get("rawData");
      if (players) draw(players);
    });
    observer.observe(document.documentElement, {
      attributes: true, attributeFilter: ["data-theme"],
    });
  }

  function draw(players) {
    const wrap = document.querySelector("[data-chart='kroos-vs-league-radar']");
    if (!wrap) return;

    const kroosRows = DataTransforms.kroosRows(players);
    if (!kroosRows.length) {
      showEmpty(wrap, "No Kroos data available");
      return;
    }

    const seasons = kroosRows.map(d => d.season);

    // La Liga midfielders across the same seasons Kroos played, excluding Kroos
    const leaguePlayers = players.filter(d =>
      d.league  === "La Liga" &&
      seasons.includes(d.season) &&
      d.minutes >= 900 &&
      d.name    !== "Toni Kroos"
    );

    if (!leaguePlayers.length) {
      showEmpty(wrap, "No La Liga data available");
      return;
    }

    const axes = DataTransforms.RADAR_AXES;

    // Kroos mean across all his seasons
    const kroosMean = {};
    axes.forEach(ax => {
      kroosMean[ax.key] = d3.mean(kroosRows, d => d[ax.key] ?? 0) || 0;
    });

    // La Liga mean across those same seasons
    const leagueMean = {};
    axes.forEach(ax => {
      leagueMean[ax.key] = d3.mean(leaguePlayers, d => d[ax.key] ?? 0) || 0;
    });

    // Normalize both relative to each axis max
    const maxPerAxis = {};
    axes.forEach(ax => {
      maxPerAxis[ax.key] = Math.max(kroosMean[ax.key], leagueMean[ax.key]) || 1;
    });

    const kroosProfile = { label: "Toni Kroos (avg)" };
    axes.forEach(ax => {
      kroosProfile[ax.key] = Math.min(1, kroosMean[ax.key] / maxPerAxis[ax.key]);
    });

    const leagueProfile = { label: "La Liga top 10% (avg)" };
    axes.forEach(ax => {
      leagueProfile[ax.key] = Math.min(1, leagueMean[ax.key] / maxPerAxis[ax.key]);
    });

    const rawKroos  = { label: "Toni Kroos (avg)",       ...kroosMean  };
    const rawLeague = { label: "La Liga top 10% (avg)",  ...leagueMean };

    RadarLeaguesChart.drawRadarSVG(wrap, [kroosProfile, leagueProfile], {
      colors: {
        "Toni Kroos (avg)":      css("--kroos-color"),
        "La Liga top 10% (avg)": css("--text-muted"),
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
