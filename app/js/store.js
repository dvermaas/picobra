// Persistent app state (players + settings) backed by localStorage.
const KEY = "picobra:v1";

// Keep in sync with the language codes emitted by extraction/build_data.py.
const SUPPORTED = ["da", "de", "en", "es", "fi", "fr", "it", "ja", "ko", "nb", "nl", "pt", "ru", "sv"];

// Pick the browser's preferred language if we ship it, else English.
function detectLang() {
  try {
    const nav = typeof navigator !== "undefined" ? navigator : {};
    const prefs = nav.languages && nav.languages.length ? nav.languages : [nav.language || "en"];
    for (const p of prefs) {
      if (!p) continue;
      let code = p.toLowerCase().split("-")[0];
      if (code === "no" || code === "nn") code = "nb"; // Norwegian variants -> Bokmål
      if (SUPPORTED.includes(code)) return code;
    }
  } catch { /* fall through */ }
  return "en";
}

const defaults = {
  players: [],
  lang: "en",
  langPicked: false, // until the user explicitly chooses, follow the browser
  mode: "default",   // single game mode; "chaos" = every pack except War (Teams)
  intensity: 3,      // 1..5 -> sip range for the `$` placeholder (see engine.js)
  ruleLength: 4,     // avg cards a persistent rule stays active before it's lifted
};

function load() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY)) || {}; } catch { saved = {}; }
  const state = { ...defaults, ...saved };
  if (!state.langPicked) state.lang = detectLang(); // follow browser default until picked
  if (!saved.mode && saved.packs) { // migrate the old multi-select packs to one mode
    const on = Object.keys(saved.packs).filter((p) => saved.packs[p]);
    state.mode = on.length > 1 ? "chaos" : on[0] || "default";
  }
  delete state.packs;
  return state;
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
  setMode(id) { state.mode = id; save(); },
  // Which data packs feed the deck for the current mode.
  activePacks: () => (state.mode === "chaos" ? ["default", "silly", "hot", "bar"] : [state.mode]),
  teamPlay: () => state.mode === "war", // War mode splits players into two squads
};
