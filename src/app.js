// Global Application State
const state = {
    players: [],
    filteredPlayers: [],
    selectedPlayer: null, // Kroos is the baseline
    activeCandidate: null, // Currently selected candidate for comparison
    rmHistory: [],
    filters: {
        season: '2024-2025', // Default season to explore replacements
        league: 'all',
        position: 'MF',
        search: ''
    },
    clusterNames: {
        0: 'Deep Playmakers',
        1: 'Ball Winners',
        2: 'Progressive Carriers',
        3: 'Attacking Midfielders',
        4: 'Box-to-Box Midfielders'
    },
    clusterColors: {
        0: '#eab308', // Gold
        1: '#10b981', // Green
        2: '#0ea5e9', // Blue
        3: '#8b5cf6', // Purple
        4: '#64748b'  // Grey/Muted
    }
};

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    try {
        console.log("Loading datasets...");
        // Load the processed JSON data files
        const [playersData, rmData] = await Promise.all([
            d3.json('data/processed_players.json'),
            d3.json('data/real_madrid_history.json')
        ]);
        
        state.players = playersData;
        state.rmHistory = rmData;
        
        console.log(`Loaded ${state.players.length} player records and ${state.rmHistory.length} Real Madrid seasons.`);
        
        // Find Toni Kroos 22/23 to set as baseline
        state.selectedPlayer = state.players.find(p => p.name === 'Toni Kroos' && p.season === '2022-2023');
        if (!state.selectedPlayer) {
            state.selectedPlayer = state.players[0]; // fallback
        }
        
        // Set default candidate to the first non-Kroos player with high similarity in 2024-25
        state.activeCandidate = state.players.find(p => p.name !== 'Toni Kroos' && p.season === '2024-2025');
        
        // Initialize UI event listeners
        initEventListeners();
        
        // Perform initial filtering and render
        applyFilters();
        renderStaticVisualizations();
        renderDynamicVisualizations();
        populateCandidateList();
        updateComparisonProfile();
        
    } catch (error) {
        console.error("Error loading application data:", error);
        // Display user-friendly error message on dashboard
        document.querySelectorAll('.viz-container').forEach(el => {
            el.innerHTML = `<div style="color: var(--accent-red); text-align: center;"><i class="fa-solid fa-triangle-exclamation"></i> Error loading visualization data. Please verify files are present.</div>`;
        });
    }
}

// Set up UI Event Listeners
function initEventListeners() {
    // Select Filters
    document.getElementById('season-select').addEventListener('change', (e) => {
        state.filters.season = e.target.value;
        applyFilters();
        renderDynamicVisualizations();
        populateCandidateList();
    });

    document.getElementById('league-select').addEventListener('change', (e) => {
        state.filters.league = e.target.value;
        applyFilters();
        renderDynamicVisualizations();
        populateCandidateList();
    });

    document.getElementById('position-select').addEventListener('change', (e) => {
        state.filters.position = e.target.value;
        applyFilters();
        renderDynamicVisualizations();
        populateCandidateList();
    });

    // Player Search Input with Debouncing
    let searchTimeout;
    document.getElementById('player-search').addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            state.filters.search = e.target.value.trim().toLowerCase();
            applyFilters();
            highlightSearchedPlayers();
        }, 250);
    });

    // Tabs System for Successor Matcher
    const tabCandidatesBtn = document.getElementById('tab-candidates-btn');
    const tabCompareBtn = document.getElementById('tab-compare-btn');
    const tabCandidates = document.getElementById('tab-candidates');
    const tabComparison = document.getElementById('tab-comparison');

    tabCandidatesBtn.addEventListener('click', () => {
        tabCandidatesBtn.classList.add('active');
        tabCompareBtn.classList.remove('active');
        tabCandidates.classList.add('active');
        tabComparison.classList.remove('active');
    });

    tabCompareBtn.addEventListener('click', () => {
        tabCompareBtn.classList.add('active');
        tabCandidatesBtn.classList.remove('active');
        tabComparison.classList.add('active');
        tabCandidates.classList.remove('active');
        // Render comparison chart when tab becomes active to ensure correct sizing
        if (state.activeCandidate) {
            renderComparisonChart(state.selectedPlayer, state.activeCandidate);
        }
    });
}

// Filter dataset based on selected criteria
function applyFilters() {
    state.filteredPlayers = state.players.filter(player => {
        // Season Filter
        const seasonMatch = state.filters.season === 'all' || player.season === state.filters.season;
        
        // League Filter
        const leagueMatch = state.filters.league === 'all' || player.comp === state.filters.league;
        
        // Position Filter
        const positionMatch = state.filters.position === 'all' || player.main_pos === state.filters.position;
        
        // We always exclude Toni Kroos himself from the general exploratory list of replacements (but keep him in the master dataset)
        const isNotKroos = player.name !== 'Toni Kroos';

        return seasonMatch && leagueMatch && positionMatch && isNotKroos;
    });
    
    // Always append baseline Toni Kroos to the filtered list so he appears on the scatter plot
    if (state.selectedPlayer && !state.filteredPlayers.includes(state.selectedPlayer)) {
        state.filteredPlayers.push(state.selectedPlayer);
    }
}

// Populates the list of potential successors in Tab 1
function populateCandidateList() {
    const listContainer = document.getElementById('successor-list');
    
    // Get top candidates in the filtered dataset
    // We sort the filtered list by similarity percentage
    const candidates = state.filteredPlayers
        .filter(p => p.name !== 'Toni Kroos')
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 10);
        
    if (candidates.length === 0) {
        listContainer.innerHTML = `<div style="color: var(--text-muted); text-align: center; padding: 2rem;">No candidates matching the current filters.</div>`;
        return;
    }
    
    listContainer.innerHTML = '';
    
    candidates.forEach((cand, idx) => {
        const isActive = state.activeCandidate && state.activeCandidate.name === cand.name && state.activeCandidate.season === cand.season;
        
        const item = document.createElement('div');
        item.className = `successor-item ${isActive ? 'active' : ''}`;
        item.setAttribute('id', `candidate-item-${idx}`);
        
        // League name formatting (cleaner display)
        const leagueParts = cand.comp.split(' ');
        const leagueDisplay = leagueParts.length > 1 ? leagueParts.slice(1).join(' ') : cand.comp;
        
        item.innerHTML = `
            <div class="successor-item-info">
                <div class="successor-item-name">${cand.name}</div>
                <div class="successor-item-meta">${cand.squad} (${leagueDisplay}) | Age ${cand.age}</div>
            </div>
            <div class="successor-score-badge">
                <span class="similarity-pct">${cand.similarity.toFixed(1)}%</span>
                <span class="similarity-rank">Similarity Match</span>
            </div>
        `;
        
        item.addEventListener('click', () => {
            // Update active candidate
            state.activeCandidate = cand;
            
            // Highlight selected in list
            document.querySelectorAll('.successor-item').forEach(el => el.classList.remove('active'));
            item.classList.add('active');
            
            // Highlight player dot in PCA Scatter Plot
            highlightPcaDot(cand.name);
            
            // Update Comparison Details
            updateComparisonProfile();
            
            // Switch to detailed comparison tab
            const tabCompareBtn = document.getElementById('tab-compare-btn');
            tabCompareBtn.click();
        });
        
        listContainer.appendChild(item);
    });
}

// Update profiles text on Tab 2
function updateComparisonProfile() {
    const nameBox = document.getElementById('comp-player-name');
    const squadBox = document.getElementById('comp-player-squad');
    const ageBox = document.getElementById('comp-player-age');
    const simBox = document.getElementById('comp-player-similarity');
    
    if (state.activeCandidate) {
        nameBox.textContent = state.activeCandidate.name;
        squadBox.textContent = `${state.activeCandidate.squad} (${state.activeCandidate.season})`;
        ageBox.textContent = state.activeCandidate.age;
        simBox.textContent = `${state.activeCandidate.similarity.toFixed(1)}%`;
        
        // Render comparison bar chart
        renderComparisonChart(state.selectedPlayer, state.activeCandidate);
    } else {
        nameBox.textContent = "Select Player";
        squadBox.textContent = "-";
        ageBox.textContent = "-";
        simBox.textContent = "-";
        document.getElementById('comparison-chart-container').innerHTML = `<div style="color: var(--text-muted);">Select a player from the candidates list.</div>`;
    }
}

// Renders static charts (drawn once, or on load)
function renderStaticVisualizations() {
    // 1. Real Madrid Historic Performance Line Chart
    if (state.rmHistory && state.rmHistory.length > 0) {
        renderRealMadridChart(state.rmHistory);
    }
    
    // 2. League Archetype distribution stacked bar chart
    renderLeagueArchetypeChart(state.players);
}

// Renders visualizations that update with filter selection
function renderDynamicVisualizations() {
    // 1. PCA Scatter Plot
    renderPcaScatterPlot(state.filteredPlayers, state.selectedPlayer);
}

// Highlights players matching search term
function highlightSearchedPlayers() {
    const searchStr = state.filters.search;
    
    const svg = d3.select('#pca-plot-container svg');
    if (!svg.node()) return;
    
    if (!searchStr) {
        // Reset classes
        svg.selectAll('.dot').classList = 'dot';
        svg.selectAll('.dot').classed('dimmed', false).classed('highlighted', false);
        return;
    }
    
    svg.selectAll('.dot')
        .classed('highlighted', d => d.name.toLowerCase().includes(searchStr))
        .classed('dimmed', d => !d.name.toLowerCase().includes(searchStr));
}

// API for visualizer to select candidate
function selectCandidateFromChart(player) {
    state.activeCandidate = player;
    
    // Select detailed comparison tab
    const tabCompareBtn = document.getElementById('tab-compare-btn');
    tabCompareBtn.click();
    
    // Update active list elements if they exist
    populateCandidateList();
    updateComparisonProfile();
}
