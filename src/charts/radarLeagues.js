// Section 02 - Chart A
// Overlapping radar showing the average profile of the top 10% of
// midfielders per league. One polygon per active league.
// League visibility toggled by LeagueTogglesComponent via "leagues:changed".
//
// drawRadarSVG() is the shared renderer reused by PlayerCardComponent,
// KroosVsLeagueRadarChart, and ComparisonRadarChart.

const RadarLeaguesChart = (() => {

  function css(v) {
    return getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  }

  function init() {
    AppState.on("data:ready", ({ players }) => draw(players));
    AppState.on("filters:changed", () => redraw());
    AppState.on("leagues:changed", () => redraw());

    const observer = new MutationObserver(() => {
      const data = AppState.get("rawData");
      if (data) draw(DataTransforms.applyFilters(data));
    });
    observer.observe(document.documentElement, {
      attributes: true, attributeFilter: ["data-theme"],
    });
  }

  function redraw() {
    const data = AppState.get("rawData");
    if (data) draw(DataTransforms.applyFilters(data));
  }

  function draw(data) {
    const wrap = document.querySelector("[data-chart='radar-leagues']");
    if (!wrap) return;

    const profiles = DataTransforms.leagueProfiles(data);
    const normed   = DataTransforms.normalizeProfiles(profiles);
    const active   = AppState.get("activeLeagues");
    const visible  = normed.filter(p => active.has(p.league));

    drawRadarSVG(wrap, visible, {
      colors:   DataTransforms.LEAGUE_COLORS,
      labelKey: "league",
      size:     wrap.clientWidth || 340,
      rawProfiles: profiles,
    });
  }

  // Shared reusable radar renderer.
  // containerEl  — DOM element to render into (cleared on each call)
  // profiles     — array of objects; each has opts.labelKey plus one
  //                key per RADAR_AXES entry, normalized 0-1
  // opts:
  //   colors     — { label: hexColor }
  //   labelKey   — which property holds the legend label
  //   size       — SVG width/height (square)
  //   rawProfiles — optional original (un-normalized) profiles for tooltip values
  function drawRadarSVG(containerEl, profiles, opts = {}) {
    const container = typeof containerEl === "string"
      ? document.querySelector(containerEl)
      : containerEl;
    if (!container || !profiles.length) return;

    container.innerHTML = "";

    const axes     = DataTransforms.RADAR_AXES;
    const N        = axes.length;
    const size     = Math.min(opts.size || 340, 420);
    const cx       = size / 2;
    const cy       = size / 2;
    const radius   = size * 0.34;
    const labelR   = radius + 22;
    const labelKey = opts.labelKey || "league";
    const colors   = opts.colors || DataTransforms.LEAGUE_COLORS;
    const raw      = opts.rawProfiles || [];
    const LEVELS   = [0.25, 0.5, 0.75, 1.0];

    // angle(i): first axis at top, rotate counter-clockwise
    const angle = i => (2 * Math.PI * i) / N - Math.PI / 2;
    const pt = (val, i) => ({
      x: cx + radius * val * Math.cos(angle(i)),
      y: cy + radius * val * Math.sin(angle(i)),
    });

    const svg = d3.select(container)
      .append("svg")
        .attr("viewBox", `0 0 ${size} ${size}`)
        .attr("width",  "100%")
        .style("overflow", "visible");

    // Background grid polygons
    LEVELS.forEach(level => {
      const pts = axes.map((_, i) => pt(level, i));
      svg.append("polygon")
        .attr("points", pts.map(p => `${p.x},${p.y}`).join(" "))
        .attr("fill",         "none")
        .attr("stroke",       css("--chart-grid-color"))
        .attr("stroke-width", level === 1.0 ? 1.2 : 0.8);
    });

    // Level value labels (0.25 → 0.5 → 0.75 → 1.0) on the first axis
    LEVELS.forEach(level => {
      const p = pt(level, 0);
      svg.append("text")
        .attr("x",               p.x + 5)
        .attr("y",               p.y)
        .attr("dominant-baseline", "middle")
        .attr("fill",            css("--text-muted"))
        .attr("font-size",       "8px")
        .attr("font-family",     css("--font-ui"))
        .text(level.toFixed(2));
    });

    // Axis spokes
    axes.forEach((ax, i) => {
      const end = pt(1, i);
      svg.append("line")
        .attr("x1", cx).attr("y1", cy)
        .attr("x2", end.x).attr("y2", end.y)
        .attr("stroke",       css("--chart-axis-color"))
        .attr("stroke-width", 1);

      // Axis labels — nudge away from the center
      const lp  = pt(1.22, i);
      const anchor = lp.x < cx - 4 ? "end"
                   : lp.x > cx + 4 ? "start"
                   : "middle";

      svg.append("text")
        .attr("x",             lp.x)
        .attr("y",             lp.y)
        .attr("text-anchor",   anchor)
        .attr("dominant-baseline", "middle")
        .attr("fill",          css("--text-secondary"))
        .attr("font-size",     "10px")
        .attr("font-family",   css("--font-ui"))
        .text(ax.label);
    });

    // Tooltip
    const tooltip = d3.select("body").select(".d3-tooltip");

    // League polygons
    profiles.forEach(profile => {
      const label = profile[labelKey];
      const color = colors[label] || "#888";
      const pts   = axes.map((ax, i) => pt(profile[ax.key] ?? 0, i));
      const rawP  = raw.find(r => r[labelKey] === label);

      svg.append("polygon")
        .attr("points",        pts.map(p => `${p.x},${p.y}`).join(" "))
        .attr("fill",          "none")
        .attr("stroke",        color)
        .attr("stroke-width",  2)
        .attr("stroke-linejoin", "round")
        .style("cursor",       "default")
        .on("mouseover", function (event) {
          d3.select(this).raise()
            .attr("stroke-width", 3);

          if (rawP) {
            const rows = axes
              .map(ax => `<div class="tooltip-row">
                <span>${ax.label}</span>
                <span class="tooltip-val">${(rawP[ax.key] || 0).toFixed(2)}</span>
              </div>`)
              .join("");
            tooltip.classed("visible", true)
              .html(`<div class="tooltip-name">${label}</div>${rows}`);
          }
        })
        .on("mousemove", event => {
          tooltip
            .style("left", (event.clientX + 14) + "px")
            .style("top",  (event.clientY - 32) + "px");
        })
        .on("mouseout", function () {
          d3.select(this).attr("stroke-width", 2);
          tooltip.classed("visible", false);
        });

      // Vertex dots
      pts.forEach(p => {
        svg.append("circle")
          .attr("cx",    p.x)
          .attr("cy",    p.y)
          .attr("r",     3)
          .attr("fill",  color)
          .attr("opacity", 0.7)
          .style("pointer-events", "none");
      });
    });

    // Legend
    const legendY = size - 14 - (profiles.length - 1) * 16;
    profiles.forEach((profile, i) => {
      const label = profile[labelKey];
      const color = colors[label] || "#888";
      const g = svg.append("g")
        .attr("transform", `translate(8, ${legendY + i * 16})`);

      g.append("circle")
        .attr("r",    5)
        .attr("fill", color)
        .attr("opacity", 0.85);

      g.append("text")
        .attr("x",                 12)
        .attr("dominant-baseline", "middle")
        .attr("fill",              css("--text-secondary"))
        .attr("font-size",         "10px")
        .attr("font-family",       css("--font-ui"))
        .text(label);
    });
  }

  return { init, drawRadarSVG };
})();

window.RadarLeaguesChart = RadarLeaguesChart;
