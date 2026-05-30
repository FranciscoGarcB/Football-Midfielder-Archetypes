// Cluster color legend below the PCA scatter.
// Clicking an item highlights that cluster in the scatter;
// clicking the same item again resets the highlight.

const ClusterLegendComponent = (() => {

  let activeCluster = null;

  function init() {
    AppState.on("data:ready", () => render());
  }

  function render() {
    const container = document.getElementById("cluster-legend");
    if (!container) return;
    container.innerHTML = "";

    Object.entries(DataTransforms.CLUSTER_NAMES).forEach(([id, name]) => {
      const color = DataTransforms.CLUSTER_COLORS[id];
      const item  = document.createElement("div");
      item.className       = "cluster-legend-item";
      item.dataset.cluster = id;

      const dot  = document.createElement("span");
      dot.className = "cluster-legend-dot";
      dot.style.background = color;

      const label = document.createElement("span");
      label.textContent = name;

      item.appendChild(dot);
      item.appendChild(label);

      item.addEventListener("click", () => {
        if (activeCluster === +id) {
          activeCluster = null;
          AppState.emit("filter:cluster", -1);
          container.querySelectorAll(".cluster-legend-item").forEach(el => {
            el.classList.remove("active", "dimmed");
          });
        } else {
          activeCluster = +id;
          AppState.emit("filter:cluster", id);
          container.querySelectorAll(".cluster-legend-item").forEach(el => {
            const isActive = +el.dataset.cluster === +id;
            el.classList.toggle("active",  isActive);
            el.classList.toggle("dimmed", !isActive);
          });
        }
      });

      container.appendChild(item);
    });
  }

  return { init };
})();

window.ClusterLegendComponent = ClusterLegendComponent;
