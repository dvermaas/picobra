// Persistent app state (players + settings) backed by localStorage.
const KEY = "picobra:v1";

const defaults = {
  players: [],
  lang: "en",
  // "war" is the team-battle pack: selecting it forms two squads.
  packs: { default: true, silly: false, hot: false, war: false, bar: false },
};

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY)) || {};
    return { ...defaults, ...saved, packs: { ...defaults.packs, ...(saved.packs || {}) } };
  } catch {
    return structuredClone(defaults);
  }
}

let state = load();
const save = () => localStorage.setItem(KEY, JSON.stringify(state));

export const store = {
  get: () => state,
  update(patch) { Object.assign(state, patch); save(); return state; },

  addPlayer(name) {
    name = name.trim();
    if (name && !state.players.some((p) => p.toLowerCase() === name.toLowerCase())) {
      state.players.push(name);
      save();
    }
  },
  removePlayer(name) {
    state.players = state.players.filter((p) => p !== name);
    save();
  },
  togglePack(id) {
    state.packs = { ...state.packs, [id]: !state.packs[id] };
    if (!Object.values(state.packs).some(Boolean)) state.packs[id] = true; // keep >=1
    save();
  },
  activePacks: () => Object.keys(state.packs).filter((p) => state.packs[p]),
  teamPlay: () => !!state.packs.war, // war pack == team battles
};
