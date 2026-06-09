// Section 01 - Chart A
// Dot-plot timeline of Real Madrid trophies by season (2017-18 to 2024-25).
// Three rows: Champions League, La Liga, Copa del Rey.
// Filled circle = won. Hollow circle = not won.
// Kroos era seasons are shaded in the background.
// A vertical annotation marks the season after his retirement.
// Responds to theme changes via CSS variables read at draw time.

const TimelineTrophiesChart = (() => {

  const ROWS = [
    { key: "ucl",    label: "Champions League" },
    { key: "laliga", label: "La Liga"           },
    { key: "copa",   label: "Copa del Rey"      },
  ];

  const KROOS_ERA_END  = "2023-24";
  const POST_KROOS     = "2024-25";

  function css(variable) {
    return getComputedStyle(document.documentElement)
      .getPropertyValue(variable).trim();
  }

  function init() {
    AppState.on("data:ready", ({ trophies }) => requestAnimationFrame(() => draw(trophies)));

    // Redraw when theme changes so colors update
    const observer = new MutationObserver(() => {
      const trophies = AppState.get("trophyData");
      if (trophies) draw(trophies);
    });
    observer.observe(document.documentElement, {
      attributes: true, attributeFilter: ["data-theme"],
    });
  }

  function draw(data) {
    const wrap = document.querySelector("[data-chart='timeline-trophies']");
    if (!wrap || !data || !data.length) return;

    wrap.innerHTML = "";

    const totalW = wrap.clientWidth || 520;
    const m      = { top: 28, right: 24, bottom: 44, left: 136 };
    const iw     = totalW - m.left - m.right;

    const ROW_H    = 52;
    const totalH   = m.top + ROWS.length * ROW_H + m.bottom;

    const seasons = data.map(d => d.season);

    const xScale = d3.scaleBand()
      .domain(seasons)
      .range([0, iw])
      .padding(0.18);

    const DOT_R      = Math.min(xScale.bandwidth() / 2 - 2, 11);
    const rowCenterY = i => m.top + i * ROW_H + ROW_H / 2;

    const svg = d3.select(wrap)
      .append("svg")
        .attr("width",   "100%")
        .attr("viewBox", `0 0 ${totalW} ${totalH}`)
        .style("overflow", "visible");

    // Kroos era background shading
    const kroosSeasons = seasons.filter(s => s <= KROOS_ERA_END);
    const shadeX1 = xScale(kroosSeasons[0]);
    const shadeX2 = xScale(kroosSeasons[kroosSeasons.length - 1]) + xScale.bandwidth();

    svg.append("rect")
      .attr("x",      shadeX1 + m.left)
      .attr("y",      m.top - 14)
      .attr("width",  shadeX2 - shadeX1)
      .attr("height", ROWS.length * ROW_H + 10)
      .attr("fill",   css("--kroos-subtle"))
      .attr("rx",     4);

    // "Kroos era" label above the shaded region
    svg.append("text")
      .attr("x",           shadeX1 + m.left + (shadeX2 - shadeX1) / 2)
      .attr("y",           m.top - 18)
      .attr("text-anchor", "middle")
      .attr("fill",        css("--kroos-color"))
      .attr("font-size",   "9px")
      .attr("font-family", css("--font-ui"))
      .attr("font-weight", "500")
      .attr("letter-spacing", "0.06em")
      .text("KROOS ERA");

    // Vertical line separating post-Kroos season
    const postX = xScale(POST_KROOS);
    if (postX !== undefined) {
      svg.append("line")
        .attr("x1", postX + m.left - xScale.padding() * xScale.step() / 2)
        .attr("x2", postX + m.left - xScale.padding() * xScale.step() / 2)
        .attr("y1", m.top - 14)
        .attr("y2", m.top + ROWS.length * ROW_H - 4)
        .attr("stroke",       css("--kroos-color"))
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "3,3")
        .attr("opacity", 0.55);
    }

    // Horizontal row dividers
    ROWS.forEach((_, i) => {
      if (i === 0) return;
      svg.append("line")
        .attr("x1", m.left)
        .attr("x2", m.left + iw)
        .attr("y1", m.top + i * ROW_H)
        .attr("y2", m.top + i * ROW_H)
        .attr("stroke",       css("--chart-grid-color"))
        .attr("stroke-width", 1);
    });

    // Tooltip
    const tooltip = d3.select("body").select(".d3-tooltip");

    // Dots per trophy row
    ROWS.forEach((row, ri) => {
      const cy = rowCenterY(ri);

      data.forEach(d => {
        const won = !!d[row.key];
        const cx  = m.left + xScale(d.season) + xScale.bandwidth() / 2;

        // Won: filled gold circle. Not won: hollow muted circle.
        svg.append("circle")
          .attr("cx",           cx)
          .attr("cy",           cy)
          .attr("r",            won ? DOT_R : DOT_R - 1)
          .attr("fill",         won ? css("--kroos-color") : "none")
          .attr("stroke",       won ? css("--kroos-color") : css("--border-default"))
          .attr("stroke-width", won ? 0 : 1.5)
          .attr("opacity",      won ? 1 : 0.5)
          .style("cursor",      "default")
          .on("mouseover", (event) => {
            const result = won ? "Won" : "Not won";
            tooltip.classed("visible", true)
              .html(`
                <div class="tooltip-name">${row.label}</div>
                <div class="tooltip-row">
                  <span>${d.season}</span>
                  <span class="tooltip-val" style="color:${won ? css("--kroos-color") : css("--text-muted")}">${result}</span>
                </div>
              `);
          })
          .on("mousemove", (event) => {
            tooltip
              .style("left", (event.clientX + 14) + "px")
              .style("top",  (event.clientY - 32) + "px");
          })
          .on("mouseout", () => tooltip.classed("visible", false));

        // Winning season: subtle glow ring
        if (won) {
          svg.append("circle")
            .attr("cx",           cx)
            .attr("cy",           cy)
            .attr("r",            DOT_R + 4)
            .attr("fill",         "none")
            .attr("stroke",       css("--kroos-color"))
            .attr("stroke-width", 1)
            .attr("opacity",      0.18)
            .style("pointer-events", "none");
        }
      });
    });

    // X axis — season labels
    const xAxisG = svg.append("g")
      .attr("transform", `translate(${m.left}, ${m.top + ROWS.length * ROW_H + 10})`);

    seasons.forEach(s => {
      xAxisG.append("text")
        .attr("x",           xScale(s) + xScale.bandwidth() / 2)
        .attr("y",           0)
        .attr("text-anchor", "middle")
        .attr("fill",        s === POST_KROOS
          ? css("--text-secondary")
          : css("--chart-text-color"))
        .attr("font-size",   "10px")
        .attr("font-family", css("--font-ui"))
        .attr("font-weight", s === POST_KROOS ? "500" : "400")
        .text(s);
    });

    // Post-Kroos label below the separator
    if (postX !== undefined) {
      xAxisG.append("text")
        .attr("x",           postX + xScale.bandwidth() / 2)
        .attr("y",           14)
        .attr("text-anchor", "middle")
        .attr("fill",        css("--text-muted"))
        .attr("font-size",   "8px")
        .attr("font-family", css("--font-ui"))
        .text("post-Kroos");
    }

    // Y axis — trophy row labels
    ROWS.forEach((row, i) => {
      svg.append("text")
        .attr("x",               m.left - 12)
        .attr("y",               rowCenterY(i))
        .attr("text-anchor",     "end")
        .attr("dominant-baseline", "middle")
        .attr("fill",            css("--text-secondary"))
        .attr("font-size",       "11px")
        .attr("font-family",     css("--font-ui"))
        .text(row.label);
    });

    // Trophy count summary per competition
    ROWS.forEach((row, i) => {
      const total = data.filter(d => d[row.key]).length;
      svg.append("text")
        .attr("x",               m.left - 12)
        .attr("y",               rowCenterY(i) + 13)
        .attr("text-anchor",     "end")
        .attr("dominant-baseline", "middle")
        .attr("fill",            css("--text-muted"))
        .attr("font-size",       "9px")
        .attr("font-family",     css("--font-ui"))
        .text(`${total} of ${data.length}`);
    });
  }

  return { init };
})();

window.TimelineTrophiesChart = TimelineTrophiesChart;
