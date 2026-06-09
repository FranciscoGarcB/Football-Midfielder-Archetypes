// Pure data-shaping helpers consumed by chart modules.
// No D3 rendering here.

const DataTransforms = (() => {

  const FEATURE_GROUPS = {
    passing:  ["progressive_passes_per90", "key_passes_per90", "xa_per90", "long_pass_pct", "pass_completion_pct"],
    defense:  ["tackles", "interceptions", "fouls_committed_per90"],
    attack:   ["goals_per90", "np_xg_per90", "gca_per90", "shots"],
  };

  const RADAR_AXES = [
    { key: "progressive_passes_per90", label: "Prog. passes / 90"  },
    { key: "xa_per90",                 label: "xA / 90"            },
    { key: "long_pass_pct",            label: "Long pass %"        },
    { key: "gca_per90",               label: "GCA / 90"           },
    { key: "tackles",                  label: "Tackles / 90"       },
    { key: "interceptions",            label: "Interceptions"      },
  ];

  const LEAGUE_COLORS = {
    "Premier League": "#3b82f6",
    "La Liga":        "#e53e3e",
    "Serie A":        "#0ea5e9",
    "Bundesliga":     "#f59e0b",
    "Ligue 1":        "#8b5cf6",
  };

  // Cluster names are assigned manually after inspecting which players
  // and stat profiles fall into each group. Update these when more seasons
  // are added and clusters shift.
  const CLUSTER_NAMES  = {
    0: "Defensive Midfielder",
    1: "Attacker",
    2: "Ball-winning passer",
    3: "Playmaker",
    4: "Wide Player",
  };
  const CLUSTER_COLORS = {
    0: "#f87171",
    1: "#4ade80",
    2: "#f0c060",
    3: "#60a5fa",
    4: "#c084fc",
  };

  function applyFilters(data, filters) {
    const f = filters || AppState.get("filters");
    return data.filter(d => {
      if (f.league !== "all" && d.league !== f.league) return false;
      if (f.season !== "all" && d.season !== f.season) return false;
      if (d.minutes < f.minMinutes) return false;
      return true;
    });
  }

  // All metrics that leagueProfiles will average — superset of RADAR_AXES
  const ALL_METRICS = [
    "goals_per90", "assists_per90", "ga_nopk_per90",
    "shots", "shots_on_target", "goals_per_shot",
    "tackles", "interceptions", "fouls_drawn", "fouls_committed_per90", "crosses",
    "progressive_passes_per90", "key_passes_per90", "pass_completion_pct",
    "long_pass_pct", "gca_per90", "prog_carries_per90", "carries_final_third_per90",
    "sca_per90",
    "xa_per90", "np_xg_per90", "xg_chain", "xg_buildup",
  ];

  function leagueProfiles(data, topPct = 0.1) {
    const byLeague = d3.group(data, d => d.league);
    const result = [];
    byLeague.forEach((players, league) => {
      const minMin = d3.quantile(players.map(p => p.minutes).sort(d3.ascending), 1 - topPct) || 0;
      const top = players.filter(p => p.minutes >= minMin);
      const profile = { league };
      ALL_METRICS.forEach(k => { profile[k] = d3.mean(top, d => d[k]) ?? 0; });
      result.push(profile);
    });
    return result;
  }

  function normalizeProfiles(profiles, allPlayers) {
    const axes = RADAR_AXES.map(a => a.key);
    // Use 95th percentile of all players per axis as the ceiling.
    // This prevents a single outlier from compressing all league averages
    // toward zero, while still giving outlier leagues a value > 1 (clamped).
    const p95 = {};
    axes.forEach(k => {
      const vals = (allPlayers || profiles).map(d => d[k] ?? 0).sort(d3.ascending);
      p95[k] = d3.quantile(vals, 0.95) || d3.max(vals) || 1;
    });
    return profiles.map(p => {
      const norm = { league: p.league };
      axes.forEach(k => {
        norm[k] = Math.min(1, Math.max(0, (p[k] ?? 0) / (p95[k] || 1)));
      });
      return norm;
    });
  }

  function normalizePlayerProfile(player, referenceRows) {
    const axes = RADAR_AXES.map(a => a.key);
    const p95  = {};
    axes.forEach(k => {
      const vals = referenceRows.map(d => d[k] ?? 0).sort(d3.ascending);
      p95[k] = d3.quantile(vals, 0.95) || d3.max(vals) || 1;
    });
    const norm = { label: player.name };
    axes.forEach(k => {
      norm[k] = Math.min(1, Math.max(0, (player[k] ?? 0) / (p95[k] || 1)));
    });
    return norm;
  }

  function kroosRows(data) {
    return data
      .filter(d => d.name === "Toni Kroos")
      .sort((a, b) => a.season.localeCompare(b.season));
  }

  function successorRanking(data, weights, topN = 10, leagueFilter = "all") {
    const kroos = kroosRows(data);
    if (!kroos.length) return [];

    const allKeys = [...FEATURE_GROUPS.passing, ...FEATURE_GROUPS.defense, ...FEATURE_GROUPS.attack];
    const centroid = {};
    allKeys.forEach(k => { centroid[k] = d3.mean(kroos, d => d[k]) ?? 0; });

    const latest = latestSeasonPerPlayer(data).filter(d => d.name !== "Toni Kroos");
    let candidates = latest.filter(d => d.minutes >= 900);
    if (leagueFilter !== "all") candidates = candidates.filter(d => d.league === leagueFilter);

    const wTotal = (weights.passing + weights.defense + weights.attack) || 1;

    return candidates
      .map(d => {
        const dp = euclidean(d, centroid, FEATURE_GROUPS.passing);
        const dd = euclidean(d, centroid, FEATURE_GROUPS.defense);
        const da = euclidean(d, centroid, FEATURE_GROUPS.attack);
        const dist = (weights.passing * dp + weights.defense * dd + weights.attack * da) / wTotal;
        return { ...d, similarityDist: dist };
      })
      .sort((a, b) => a.similarityDist - b.similarityDist)
      .slice(0, topN);
  }

  function euclidean(a, b, keys) {
    return Math.sqrt(d3.sum(keys, k => Math.pow((a[k] || 0) - (b[k] || 0), 2)));
  }

  function latestSeasonPerPlayer(data) {
    const map = new Map();
    data.forEach(d => {
      const prev = map.get(d.name);
      if (!prev || d.season > prev.season) map.set(d.name, d);
    });
    return [...map.values()];
  }

  function centroid(rows, keys) {
    const c = {};
    keys.forEach(k => { c[k] = d3.mean(rows, d => d[k]) ?? 0; });
    return c;
  }

  return {
    FEATURE_GROUPS, RADAR_AXES, LEAGUE_COLORS,
    CLUSTER_NAMES, CLUSTER_COLORS,
    applyFilters, leagueProfiles, normalizeProfiles,
    normalizePlayerProfile, kroosRows,
    successorRanking, latestSeasonPerPlayer, centroid, euclidean,
  };
})();

window.DataTransforms = DataTransforms;
