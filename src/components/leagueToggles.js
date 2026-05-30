// League toggle buttons in section 02.
// Controls which league polygons are drawn in the radar chart.
// On change, emits "leagues:changed" with the updated Set.

const LeagueTogglesComponent = (() => {

  const LEAGUES = ["Premier League", "La Liga", "Serie A", "Bundesliga", "Ligue 1"];

  const SHORT = {
    "Premier League": "EPL",
    "La Liga":        "ESP",
    "Serie A":        "ITA",
    "Bundesliga":     "GER",
    "Ligue 1":        "FRA",
  };

  function init() {
    const container = document.getElementById("league-toggles");
    if (!container) return;

    LEAGUES.forEach(league => {
      const btn = document.createElement("button");
      btn.className        = "league-toggle-btn active";
      btn.dataset.league   = league;
      btn.textContent      = SHORT[league] || league;
      btn.addEventListener("click", () => toggle(btn, league));
      container.appendChild(btn);
    });
  }

  function toggle(btn, league) {
    const active = AppState.get("activeLeagues");
    if (active.has(league)) {
      active.delete(league);
      btn.classList.remove("active");
    } else {
      active.add(league);
      btn.classList.add("active");
    }
    AppState.emit("leagues:changed", active);
  }

  return { init };
})();

window.LeagueTogglesComponent = LeagueTogglesComponent;
