// Global header filter controls.
// Wires the four selects/inputs to AppState.setFilter() so every
// chart that listens to "filters:changed" reacts automatically.

const FiltersComponent = (() => {

  function init() {
    const leagueEl  = document.getElementById("filter-league");
    const seasonEl  = document.getElementById("filter-season");
    const minutesEl = document.getElementById("filter-min-minutes");
    const teamEl    = document.getElementById("filter-team"); // <-- 1. Added DOM selection

    AppState.on("data:ready", () => {
      const seasons = AppState.get("availableSeasons") || [];
      seasons.forEach(s => {
        const opt = document.createElement("option");
        opt.value = s;
        opt.textContent = s;
        seasonEl.appendChild(opt);
      });
    });

    leagueEl.addEventListener("change",  e => AppState.setFilter("league",     e.target.value));
    seasonEl.addEventListener("change",  e => AppState.setFilter("season",     e.target.value));
    minutesEl.addEventListener("change", e => AppState.setFilter("minMinutes", +e.target.value));
    teamEl.addEventListener("change",    e => AppState.setFilter("selectedTeam", e.target.value)); // <-- 2. Added event listener
  }

  return { init };
})();

window.FiltersComponent = FiltersComponent;
