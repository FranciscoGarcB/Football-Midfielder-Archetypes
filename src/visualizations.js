// Global Variables for D3 Charts
let pcaSvg, pcaXScale, pcaYScale, pcaZoom;

// ==========================================
// 1. Real Madrid Historic Performance Chart
// ==========================================
function renderRealMadridChart(rmHistory) {
    const container = d3.select("#rm-history-chart-container");
    container.html(""); // Clear loader
    
    // Set up dimensions
    const width = container.node().clientWidth;
    const height = container.node().clientHeight || 250;
    const margin = { top: 30, right: 30, bottom: 40, left: 45 };
    
    const svg = container.append("svg")
        .attr("width", width)
        .attr("height", height);
        
    // Reverse history to chronological order (2017 to 2026)
    const data = [...rmHistory].reverse();
    
    // Scales
    const xScale = d3.scalePoint()
        .domain(data.map(d => d.season))
        .range([margin.left, width - margin.right]);
        
    const yScale = d3.scaleLinear()
        .domain([1.5, 2.7]) // Points per match domain
        .range([height - margin.bottom, margin.top]);
        
    // Axes
    const xAxis = d3.axisBottom(xScale);
    const yAxis = d3.axisLeft(yScale).ticks(5).tickFormat(d3.format(".2f"));
    
    // Gridlines
    svg.append("g")
        .attr("class", "grid-line")
        .attr("transform", `translate(0, 0)`)
        .selectAll("line")
        .data(yScale.ticks(5))
        .enter()
        .append("line")
        .attr("x1", margin.left)
        .attr("x2", width - margin.right)
        .attr("y1", d => yScale(d))
        .attr("y2", d => yScale(d));

    svg.append("g")
        .attr("class", "axis")
        .attr("transform", `translate(0, ${height - margin.bottom})`)
        .call(xAxis)
        .selectAll("text")
        .style("text-anchor", "middle");
        
    svg.append("g")
        .attr("class", "axis")
        .attr("transform", `translate(${margin.left}, 0)`)
        .call(yAxis);
        
    // Y-Axis label
    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 12)
        .attr("x", -height/2)
        .attr("text-anchor", "middle")
        .attr("fill", "var(--text-muted)")
        .style("font-size", "10px")
        .text("Points Per Match");

    // Add Highlight Regions (Before/After Kroos Departure)
    // Kroos retired after 2023-2024 season
    const kroosSeasons = data.filter(d => d.season !== "2024-2025" && d.season !== "2025-2026");
    const postKroosSeasons = data.filter(d => d.season === "2024-2025" || d.season === "2025-2026");
    
    // Points Line Generator
    const lineGenerator = d3.line()
        .x(d => xScale(d.season))
        .y(d => yScale(d.pts_per_mp))
        .curve(d3.curveMonotoneX);
        
    // Area Generator for background shading
    const areaGenerator = d3.area()
        .x(d => xScale(d.season))
        .y0(height - margin.bottom)
        .y1(d => yScale(d.pts_per_mp))
        .curve(d3.curveMonotoneX);

    // Draw Shaded Area Under Curve
    svg.append("path")
        .datum(data)
        .attr("class", "real-madrid-area")
        .attr("d", areaGenerator)
        .attr("fill", "url(#rm-area-gradient)");
        
    // Define Gradients
    const defs = svg.append("defs");
    const areaGrad = defs.append("linearGradient")
        .attr("id", "rm-area-gradient")
        .attr("x1", "0%").attr("y1", "0%")
        .attr("x2", "0%").attr("y2", "100%");
        
    areaGrad.append("stop").attr("offset", "0%").attr("stop-color", "var(--accent-blue)").attr("stop-opacity", 0.2);
    areaGrad.append("stop").attr("offset", "100%").attr("stop-color", "var(--accent-blue)").attr("stop-opacity", 0);

    // Draw Points Line
    svg.append("path")
        .datum(data)
        .attr("class", "real-madrid-line")
        .attr("d", lineGenerator)
        .attr("stroke", "var(--accent-blue)");
        
    // Draw Vertical Transition Line (Kroos Retires)
    const transitionX = xScale("2023-2024");
    
    svg.append("line")
        .attr("class", "transition-marker")
        .attr("x1", transitionX)
        .attr("x2", transitionX)
        .attr("y1", margin.top)
        .attr("y2", height - margin.bottom);
        
    svg.append("text")
        .attr("class", "transition-label")
        .attr("x", transitionX - 6)
        .attr("y", margin.top + 10)
        .attr("text-anchor", "end")
        .text("KROOS RETIRES");
        
    svg.append("text")
        .attr("class", "transition-label")
        .attr("x", transitionX + 6)
        .attr("y", margin.top + 10)
        .attr("text-anchor", "start")
        .attr("fill", "var(--text-muted)")
        .text("POST-KROOS ERA");

    // Add Dots for Season Data Points
    const tooltip = d3.select("body").append("div")
        .attr("class", "d3-tooltip")
        .style("position", "absolute")
        .style("visibility", "hidden");
        
    svg.selectAll(".rm-dot")
        .data(data)
        .enter()
        .append("circle")
        .attr("cx", d => xScale(d.season))
        .attr("cy", d => yScale(d.pts_per_mp))
        .attr("r", 5)
        .attr("fill", d => (d.season === "2024-2025" || d.season === "2025-2026") ? "var(--accent-red)" : "var(--accent-blue)")
        .attr("stroke", varName => "#ffffff")
        .attr("stroke-width", 1.5)
        .style("cursor", "pointer")
        .on("mouseover", (event, d) => {
            const isPost = d.season === "2024-2025" || d.season === "2025-2026";
            tooltip.style("visibility", "visible")
                .html(`
                    <div class="tooltip-header">
                        <span class="tooltip-name">Season ${d.season}</span>
                    </div>
                    <div class="tooltip-meta">Real Madrid League Standings</div>
                    <div class="tooltip-stat"><span>Rank:</span> <span class="tooltip-stat-val">#${d.rank}</span></div>
                    <div class="tooltip-stat"><span>Points per Game:</span> <span class="tooltip-stat-val" style="color: ${isPost ? 'var(--accent-red)' : 'var(--accent-blue)'}">${d.pts_per_mp.toFixed(2)}</span></div>
                    <div class="tooltip-stat"><span>Goal Difference:</span> <span class="tooltip-stat-val">${d.gd > 0 ? '+' : ''}${d.gd}</span></div>
                    <div class="tooltip-stat"><span>Expected Goals (xG):</span> <span class="tooltip-stat-val">${d.xg ? d.xg.toFixed(1) : 'N/A'}</span></div>
                `);
        })
        .on("mousemove", (event) => {
            tooltip.style("top", (event.pageY - 10) + "px")
                .style("left", (event.pageX + 15) + "px")
                .style("opacity", 1);
        })
        .on("mouseout", () => {
            tooltip.style("visibility", "hidden")
                .style("opacity", 0);
        });
}

// ==========================================
// 2. Interactive PCA Scatter Plot
// ==========================================
function renderPcaScatterPlot(filteredPlayers, selectedKroos) {
    const container = d3.select("#pca-plot-container");
    container.html(""); // Clear loader
    
    const width = container.node().clientWidth;
    const height = container.node().clientHeight || 500;
    const margin = { top: 20, right: 20, bottom: 40, left: 40 };
    
    // Set up Tooltip
    const tooltip = d3.select("body").append("div")
        .attr("class", "d3-tooltip")
        .style("position", "absolute")
        .style("visibility", "hidden");
        
    // Root SVG
    const svg = container.append("svg")
        .attr("width", width)
        .attr("height", height);
        
    // Plot Area Group (supports zoom/pan)
    const plotArea = svg.append("g")
        .attr("class", "plot-area");
        
    // Scales
    // Add margins to data extent so dots aren't cut off at edges
    const xExtent = d3.extent(state.players, d => d.pca_x);
    const yExtent = d3.extent(state.players, d => d.pca_y);
    const xPad = (xExtent[1] - xExtent[0]) * 0.05;
    const yPad = (yExtent[1] - yExtent[0]) * 0.05;
    
    pcaXScale = d3.scaleLinear()
        .domain([xExtent[0] - xPad, xExtent[1] + xPad])
        .range([margin.left, width - margin.right]);
        
    pcaYScale = d3.scaleLinear()
        .domain([yExtent[0] - yPad, yExtent[1] + yPad])
        .range([height - margin.bottom, margin.top]);
        
    // Axes Groups
    const xAxisGroup = svg.append("g")
        .attr("class", "axis")
        .attr("transform", `translate(0, ${height - margin.bottom})`);
        
    const yAxisGroup = svg.append("g")
        .attr("class", "axis")
        .attr("transform", `translate(${margin.left}, 0)`);
        
    // Draw initial axes
    const xAxis = d3.axisBottom(pcaXScale);
    const yAxis = d3.axisLeft(pcaYScale);
    xAxisGroup.call(xAxis);
    yAxisGroup.call(yAxis);
    
    // Gridlines Group
    const gridGroup = plotArea.append("g").attr("class", "gridlines");
    
    const drawGridlines = (xScale, yScale) => {
        gridGroup.html("");
        
        // Vertical grid lines
        gridGroup.selectAll(".x-grid")
            .data(xScale.ticks(10))
            .enter()
            .append("line")
            .attr("class", "grid-line")
            .attr("x1", d => xScale(d))
            .attr("x2", d => xScale(d))
            .attr("y1", margin.top)
            .attr("y2", height - margin.bottom);
            
        // Horizontal grid lines
        gridGroup.selectAll(".y-grid")
            .data(yScale.ticks(10))
            .enter()
            .append("line")
            .attr("class", "grid-line")
            .attr("x1", margin.left)
            .attr("x2", width - margin.right)
            .attr("y1", d => yScale(d))
            .attr("y2", d => yScale(d));
    };
    
    drawGridlines(pcaXScale, pcaYScale);

    // Zooming and Panning Behavior
    pcaZoom = d3.zoom()
        .scaleExtent([0.5, 10])
        .extent([[0, 0], [width, height]])
        .on("zoom", (event) => {
            const newXScale = event.transform.rescaleX(pcaXScale);
            const newYScale = event.transform.rescaleY(pcaYScale);
            
            // Update axes
            xAxisGroup.call(xAxis.scale(newXScale));
            yAxisGroup.call(yAxis.scale(newYScale));
            
            // Re-draw gridlines
            drawGridlines(newXScale, newYScale);
            
            // Reposition dots
            plotArea.selectAll(".dot")
                .attr("cx", d => newXScale(d.pca_x))
                .attr("cy", d => newYScale(d.pca_y));
                
            // Reposition pulsing halos
            plotArea.selectAll(".halo")
                .attr("cx", d => newXScale(d.pca_x))
                .attr("cy", d => newYScale(d.pca_y));
        });
        
    svg.call(pcaZoom);

    // Draw Player Dots
    const dots = plotArea.selectAll(".dot")
        .data(filteredPlayers, d => `${d.name}-${d.season}`);
        
    dots.exit().remove();
    
    const dotsEnter = dots.enter()
        .append("circle")
        .attr("class", "dot")
        .attr("r", d => d.name === "Toni Kroos" ? 8 : 4.5)
        .attr("cx", d => pcaXScale(d.pca_x))
        .attr("cy", d => pcaYScale(d.pca_y))
        .attr("fill", d => d.name === "Toni Kroos" ? "var(--accent-gold)" : state.clusterColors[d.cluster])
        .style("opacity", d => d.name === "Toni Kroos" ? 1.0 : 0.75)
        .on("mouseover", (event, d) => {
            const clusterName = state.clusterNames[d.cluster];
            tooltip.style("visibility", "visible")
                .html(`
                    <div class="tooltip-header">
                        <span class="tooltip-name">${d.name}</span>
                        <span class="highlight-badge" style="background-color: ${state.clusterColors[d.cluster]}1A; color: ${state.clusterColors[d.cluster]}; border-color: ${state.clusterColors[d.cluster]};">${d.pos}</span>
                    </div>
                    <div class="tooltip-meta">${d.squad} (${d.season}) | Age ${d.age}</div>
                    <div class="tooltip-stat"><span>Archetype:</span> <span style="font-weight:700; color:${state.clusterColors[d.cluster]}">${clusterName}</span></div>
                    <div class="tooltip-stat"><span>Similarity to Kroos:</span> <span class="tooltip-stat-val" style="color:var(--accent-green)">${d.similarity.toFixed(1)}%</span></div>
                    <div class="tooltip-stat"><span>Prog. Passes / 90:</span> <span class="tooltip-stat-val">${d.stats_per_90.prgp_90.toFixed(2)}</span></div>
                    <div class="tooltip-stat"><span>Touches / 90:</span> <span class="tooltip-stat-val">${d.stats_per_90.touches_90.toFixed(1)}</span></div>
                    <div class="tooltip-stat"><span>Tkl+Int / 90:</span> <span class="tooltip-stat-val">${(d.stats_per_90.tkl_90 + d.stats_per_90.int_90).toFixed(2)}</span></div>
                `);
        })
        .on("mousemove", (event) => {
            tooltip.style("top", (event.pageY - 10) + "px")
                .style("left", (event.pageX + 15) + "px")
                .style("opacity", 1);
        })
        .on("mouseout", () => {
            tooltip.style("visibility", "hidden")
                .style("opacity", 0);
        })
        .on("click", (event, d) => {
            if (d.name === "Toni Kroos") return;
            selectCandidateFromChart(d);
        });
        
    // Highlight Toni Kroos with a pulsing ring
    if (selectedKroos && filteredPlayers.includes(selectedKroos)) {
        plotArea.append("circle")
            .datum(selectedKroos)
            .attr("class", "halo kroos-pulse")
            .attr("cx", pcaXScale(selectedKroos.pca_x))
            .attr("cy", pcaYScale(selectedKroos.pca_y))
            .attr("r", 12)
            .attr("fill", "none")
            .attr("stroke", "var(--accent-gold)")
            .attr("stroke-width", 2);
    }
}

// API: Highlight specific player's dot (e.g. from table click)
function highlightPcaDot(playerName) {
    const svg = d3.select('#pca-plot-container svg');
    if (!svg.node()) return;
    
    // Highlight matching dot, dim others
    svg.selectAll('.dot')
        .classed('highlighted', d => d.name === playerName)
        .classed('dimmed', d => d.name !== playerName && d.name !== 'Toni Kroos');
        
    // Reset zoom and center around selected player's dot
    const targetPlayer = state.players.find(p => p.name === playerName && p.season === state.filters.season);
    if (targetPlayer && pcaZoom) {
        const width = d3.select("#pca-plot-container").node().clientWidth;
        const height = d3.select("#pca-plot-container").node().clientHeight || 500;
        
        // Calculate transition transform to center dot
        const dx = width / 2 - pcaXScale(targetPlayer.pca_x);
        const dy = height / 2 - pcaYScale(targetPlayer.pca_y);
        
        svg.transition()
            .duration(750)
            .call(pcaZoom.transform, d3.zoomIdentity.translate(dx, dy).scale(1));
    }
}

// ==========================================
// 3. Player Detailed Comparison Chart
// ==========================================
function renderComparisonChart(kroos, candidate) {
    const container = d3.select("#comparison-chart-container");
    container.html(""); // Clear loader
    
    const width = container.node().clientWidth;
    const height = container.node().clientHeight || 300;
    const margin = { top: 20, right: 30, bottom: 40, left: 110 };
    
    const svg = container.append("svg")
        .attr("width", width)
        .attr("height", height);
        
    // Define metrics to compare
    const metrics = [
        { key: 'touches_90', label: 'Touches /90', max: 100 },
        { key: 'prgp_90', label: 'Prog. Passes /90', max: 10 },
        { key: 'prgc_90', label: 'Prog. Carries /90', max: 4.5 },
        { key: 'ppa_90', label: 'Passes to Box /90', max: 2 },
        { key: 'sca_90', label: 'Shot Creation /90', max: 5 },
        { key: 'tkl_90', label: 'Tackles /90', max: 3.5 },
        { key: 'int_90', label: 'Interceptions /90', max: 2.5 },
        { key: 'recov_90', label: 'Recoveries /90', max: 8.5 }
    ];
    
    // Map comparison values (scaled relative to metrics 95th percentile max)
    const comparisonData = metrics.map(m => {
        const kroosVal = kroos.stats_per_90[m.key] || 0;
        const candidateVal = candidate.stats_per_90[m.key] || 0;
        
        // Normalize to percentages (cap at 100%)
        return {
            metric: m.label,
            kroosScore: Math.min(100, (kroosVal / m.max) * 100),
            kroosRaw: kroosVal,
            candidateScore: Math.min(100, (candidateVal / m.max) * 100),
            candidateRaw: candidateVal
        };
    });
    
    // Scales
    const yScale = d3.scaleBand()
        .domain(comparisonData.map(d => d.metric))
        .range([margin.top, height - margin.bottom])
        .padding(0.25);
        
    const xScale = d3.scaleLinear()
        .domain([0, 100])
        .range([margin.left, width - margin.right]);
        
    // Axes
    const xAxis = d3.axisBottom(xScale).ticks(5).tickFormat(d => `${d}%`);
    const yAxis = d3.axisLeft(yScale);
    
    svg.append("g")
        .attr("class", "comp-axis")
        .attr("transform", `translate(0, ${height - margin.bottom})`)
        .call(xAxis);
        
    svg.append("g")
        .attr("class", "comp-axis")
        .attr("transform", `translate(${margin.left}, 0)`)
        .call(yAxis);
        
    // Gridlines
    svg.append("g")
        .attr("class", "grid-line")
        .selectAll("line")
        .data(xScale.ticks(5))
        .enter()
        .append("line")
        .attr("x1", d => xScale(d))
        .attr("x2", d => xScale(d))
        .attr("y1", margin.top)
        .attr("y2", height - margin.bottom);
        
    // Render Bars
    const groupHeight = yScale.bandwidth();
    const barHeight = groupHeight / 2 - 1.5;
    
    // Tooltip
    const tooltip = d3.select("body").append("div")
        .attr("class", "d3-tooltip")
        .style("position", "absolute")
        .style("visibility", "hidden");

    // Draw Kroos Bars (Gold)
    svg.selectAll(".bar-kroos")
        .data(comparisonData)
        .enter()
        .append("rect")
        .attr("class", "comp-bar")
        .attr("x", margin.left)
        .attr("y", d => yScale(d.metric))
        .attr("width", d => xScale(d.kroosScore) - margin.left)
        .attr("height", barHeight)
        .attr("fill", "var(--accent-gold)")
        .on("mouseover", (event, d) => {
            tooltip.style("visibility", "visible")
                .html(`<strong>Toni Kroos</strong>: ${d.kroosRaw.toFixed(2)} per 90 (${d.kroosScore.toFixed(0)}% score)`);
        })
        .on("mousemove", (event) => {
            tooltip.style("top", (event.pageY - 10) + "px").style("left", (event.pageX + 15) + "px");
        })
        .on("mouseout", () => tooltip.style("visibility", "hidden"));
        
    // Draw Candidate Bars (Blue)
    svg.selectAll(".bar-candidate")
        .data(comparisonData)
        .enter()
        .append("rect")
        .attr("class", "comp-bar")
        .attr("x", margin.left)
        .attr("y", d => yScale(d.metric) + barHeight + 3)
        .attr("width", d => xScale(d.candidateScore) - margin.left)
        .attr("height", barHeight)
        .attr("fill", "var(--accent-blue)")
        .on("mouseover", (event, d) => {
            tooltip.style("visibility", "visible")
                .html(`<strong>${candidate.name}</strong>: ${d.candidateRaw.toFixed(2)} per 90 (${d.candidateScore.toFixed(0)}% score)`);
        })
        .on("mousemove", (event) => {
            tooltip.style("top", (event.pageY - 10) + "px").style("left", (event.pageX + 15) + "px");
        })
        .on("mouseout", () => tooltip.style("visibility", "hidden"));
}

// ==========================================
// 4. League Archetype Distribution Stacked Bar Chart
// ==========================================
function renderLeagueArchetypeChart(players) {
    const container = d3.select("#league-distribution-chart-container");
    container.html(""); // Clear loader
    
    const width = container.node().clientWidth;
    const height = container.node().clientHeight || 350;
    const margin = { top: 20, right: 120, bottom: 40, left: 110 }; // extra space on right for legend
    
    const svg = container.append("svg")
        .attr("width", width)
        .attr("height", height);
        
    // Filter out Goalkeepers and keep only players from selected season
    // We can aggregate all midfielders in the dataset
    const mfs = players.filter(p => p.main_pos === 'MF' && p.season === '2024-2025');
    
    // Group by competition
    const leagues = ['eng Premier League', 'es La Liga', 'de Bundesliga', 'it Serie A', 'fr Ligue 1'];
    const leagueDisplay = {
        'eng Premier League': 'Premier League',
        'es La Liga': 'La Liga',
        'de Bundesliga': 'Bundesliga',
        'it Serie A': 'Serie A',
        'fr Ligue 1': 'Ligue 1'
    };
    
    // Aggregate data: calculate cluster counts and percentages per league
    const aggregatedData = leagues.map(lg => {
        const lgPlayers = mfs.filter(p => p.comp === lg);
        const total = lgPlayers.length;
        
        const counts = { '0': 0, '1': 0, '2': 0, '3': 0, '4': 0 };
        lgPlayers.forEach(p => {
            counts[p.cluster] = (counts[p.cluster] || 0) + 1;
        });
        
        const percentages = {};
        for (let key in counts) {
            percentages[key] = total > 0 ? (counts[key] / total) * 100 : 0;
        }
        
        return {
            league: lg,
            displayName: leagueDisplay[lg],
            total: total,
            percentages: percentages,
            counts: counts
        };
    });
    
    // Keys for stack generator
    const keys = ['0', '1', '2', '3', '4'];
    
    // Format data for stack generator
    const stackData = aggregatedData.map(d => {
        const item = { league: d.displayName };
        keys.forEach(k => {
            item[k] = d.percentages[k];
        });
        return item;
    });
    
    const series = d3.stack().keys(keys)(stackData);
    
    // Scales
    const yScale = d3.scaleBand()
        .domain(aggregatedData.map(d => d.displayName))
        .range([margin.top, height - margin.bottom])
        .padding(0.35);
        
    const xScale = d3.scaleLinear()
        .domain([0, 100])
        .range([margin.left, width - margin.right]);
        
    // Axes
    const xAxis = d3.axisBottom(xScale).tickFormat(d => `${d}%`);
    const yAxis = d3.axisLeft(yScale);
    
    svg.append("g")
        .attr("class", "comp-axis")
        .attr("transform", `translate(0, ${height - margin.bottom})`)
        .call(xAxis);
        
    svg.append("g")
        .attr("class", "comp-axis")
        .attr("transform", `translate(${margin.left}, 0)`)
        .call(yAxis);
        
    // Tooltip
    const tooltip = d3.select("body").append("div")
        .attr("class", "d3-tooltip")
        .style("position", "absolute")
        .style("visibility", "hidden");

    // Draw Stacked Bars
    svg.append("g")
        .selectAll("g")
        .data(series)
        .enter()
        .append("g")
        .attr("fill", d => state.clusterColors[d.key])
        .selectAll("rect")
        .data(d => d)
        .enter()
        .append("rect")
        .attr("y", d => yScale(d.data.league))
        .attr("x", d => xScale(d[0]))
        .attr("width", d => xScale(d[1]) - xScale(d[0]))
        .attr("height", yScale.bandwidth())
        .attr("opacity", 0.85)
        .style("cursor", "pointer")
        .on("mouseover", (event, d) => {
            // Find which cluster we are hovering over
            const rect = event.target;
            const groupNode = rect.parentNode;
            const clusterId = d3.select(groupNode).datum().key;
            const pctVal = d[1] - d[0];
            
            // Find raw count
            const rawLg = aggregatedData.find(item => item.displayName === d.data.league);
            const count = rawLg ? rawLg.counts[clusterId] : 0;
            
            tooltip.style("visibility", "visible")
                .html(`
                    <strong>${d.data.league}</strong><br/>
                    Archetype: <strong>${state.clusterNames[clusterId]}</strong><br/>
                    Percentage: <span style="color:var(--accent-blue)">${pctVal.toFixed(1)}%</span> (${count} players)
                `);
        })
        .on("mousemove", (event) => {
            tooltip.style("top", (event.pageY - 10) + "px").style("left", (event.pageX + 15) + "px");
        })
        .on("mouseout", () => tooltip.style("visibility", "hidden"));
        
    // Draw Custom Legend on the right side
    const legend = svg.append("g")
        .attr("transform", `translate(${width - margin.right + 15}, ${margin.top + 10})`);
        
    keys.forEach((key, idx) => {
        const legItem = legend.append("g")
            .attr("transform", `translate(0, ${idx * 22})`);
            
        legItem.append("circle")
            .attr("cx", 0)
            .attr("cy", 0)
            .attr("r", 6)
            .attr("fill", state.clusterColors[key]);
            
        legItem.append("text")
            .attr("x", 12)
            .attr("y", 4)
            .attr("fill", "var(--text-secondary)")
            .style("font-size", "11px")
            .text(state.clusterNames[key]);
    });
}
