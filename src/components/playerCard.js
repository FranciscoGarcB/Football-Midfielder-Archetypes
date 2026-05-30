// Player card sidebar component.
// Listens to AppState selectedPlayerId and renders the name, meta,
// a small radar (via RadarLeaguesChart.drawRadarSVG), and a list
// of the five nearest players in feature space.

const PlayerCardComponent = (() => {

  function init() {
    AppState.on("change:selectedPlayerId", playerId => {
      if (!playerId) return hide();
      const data = AppState.get("rawData");
      if (!data) return;
      const rows = data.filter(d => d.id === playerId);
      if (!rows.length) return;
      const player = rows.sort((a, b) => b.season.localeCompare(a.season))[0];
      render(player, data);
    });
  }

  function hide() {
    document.getElementById("player-card-content").hidden = true;
    document.querySelector(".player-card__empty").style.display = "";
  }

  function render(player, allData) {
    document.querySelector(".player-card__empty").style.display = "none";
    document.getElementById("player-card-content").hidden = false;

    document.getElementById("pc-name").textContent = player.name;
    document.getElementById("pc-meta").textContent =
      `${player.team} · ${player.league} · ${player.season} · ${player.minutes} min`;

    renderRadar(player, allData);
    renderSimilarList(player, allData);
  }

  function renderRadar(player, allData) {
    const container = document.getElementById("pc-radar");
    if (!container || typeof RadarLeaguesChart === "undefined") return;

    const leaguePeers = allData.filter(d =>
      d.league === player.league && d.season === player.season && d.minutes >= 900
    );
    if (!leaguePeers.length) return;

    const axes = DataTransforms.RADAR_AXES;
    const maxPerAxis = {};
    axes.forEach(ax => {
      maxPerAxis[ax.key] = d3.max(leaguePeers, d => d[ax.key]) || 1;
    });

    const playerProfile = { label: player.name };
    axes.forEach(ax => {
      playerProfile[ax.key] = Math.min(1, (player[ax.key] || 0) / maxPerAxis[ax.key]);
    });

    const avgProfile = { label: "League avg" };
    axes.forEach(ax => {
      const avg = d3.mean(leaguePeers, d => d[ax.key]) || 0;
      avgProfile[ax.key] = Math.min(1, avg / maxPerAxis[ax.key]);
    });

    const color = player.name === "Toni Kroos"
      ? "var(--kroos-color)"
      : (DataTransforms.CLUSTER_COLORS[player.cluster] || "#60a5fa");

    RadarLeaguesChart.drawRadarSVG(container, [playerProfile, avgProfile], {
      colors:   { [player.name]: color, "League avg": "#6b7280" },
      labelKey: "label",
      size:     220,
    });
  }

  function renderSimilarList(player, allData) {
    const latest = DataTransforms.latestSeasonPerPlayer(allData);
    const axes   = DataTransforms.RADAR_AXES.map(a => a.key);
    const ranked = latest
      .filter(d => d.id !== player.id)
      .map(d => ({ ...d, dist: DataTransforms.euclidean(player, d, axes) }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 5);

    const list = document.getElementById("pc-similar-list");
    list.innerHTML = "";
    ranked.forEach((p, i) => {
      const li = document.createElement("li");
      li.textContent = `${i + 1}. ${p.name} (${p.league})`;
      li.addEventListener("click", () => AppState.set("selectedPlayerId", p.id));
      list.appendChild(li);
    });
  }

  return { init };
})();

window.PlayerCardComponent = PlayerCardComponent;
