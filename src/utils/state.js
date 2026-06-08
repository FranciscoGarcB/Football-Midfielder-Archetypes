// Global application state and event bus.
// All charts read from and write to this single object.

const AppState = (() => {

  const _state = {
    rawData:           null,
    pcaData:           null,
    kroosData:         null,
    trophyData:        null,
    availableSeasons:  [],

    filters: {
      league:     "all",
      season:     "all",
      minMinutes: 900,
    },

    selectedPlayerId:  null,
    hoveredPlayerId:   null,
    selectedSuccessor: null,
    activeLeagues: new Set(["Premier League", "La Liga", "Serie A", "Bundesliga", "Ligue 1"]),
    scatterColorBy: "cluster",
    kroosYear:  2017,
    kroosPlaying: false,
    weights: { passing: 5, defense: 5, attack: 5 },
    successorLeague: "all",
  };

  const _listeners = {};

  function on(event, callback) {
    if (!_listeners[event]) _listeners[event] = new Set();
    _listeners[event].add(callback);
    return () => _listeners[event].delete(callback);
  }

  function emit(event, payload) {
    (_listeners[event] || new Set()).forEach(cb => cb(payload));
  }

  function set(path, value) {
    const keys = path.split(".");
    let obj = _state;
    for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
    obj[keys[keys.length - 1]] = value;
    emit("change:" + path, value);
    emit("change", { path, value });
  }

  function get(path) {
    if (!path) return _state;
    return path.split(".").reduce((o, k) => o?.[k], _state);
  }

  function setFilter(key, value) {
    set("filters." + key, value);
    emit("filters:changed", _state.filters);
  }

  return { on, emit, set, get, setFilter };
})();

window.AppState = AppState;
