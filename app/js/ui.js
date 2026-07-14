// Screens + router for Picobra. Plain DOM, no framework.
import { store } from "./store.js";
import { getIndex, getLang } from "./data.js";
import { Game, INTENSITY_SIPS } from "./engine.js";

const MODE_META = {
  default: { icon: "😄", name: "Getting Started", desc: "The classic warm-up" },
  silly:   { icon: "🤪", name: "Getting Crazy",   desc: "Weird & wacky dares" },
  hot:     { icon: "🔥", name: "Caliente",        desc: "Spicy and flirty" },
  war:     { icon: "⚔️", name: "War (Teams)",     desc: "Two squads battle · 4+" },
  bar:     { icon: "🍺", name: "Bar",             desc: "Out on the town" },
  chaos:   { icon: "🌀", name: "Chaos",           desc: "Every pack except Teams" },
};
const MODES = ["default", "silly", "hot", "war", "bar", "chaos"];
const GRADIENTS = [
  ["#ff0f7b", "#f89b29"], ["#7b2ff7", "#f107a3"], ["#2ea6ff", "#0fd3a3"],
  ["#ff6a00", "#ee0979"], ["#00c9a7", "#2b6cb0"], ["#f9515b", "#a531dc"],
];

let root, catalog, game, deferredInstall = null;

export async function mount(el) {
  root = el;
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferredInstall = e; });
  try {
    catalog = await getIndex();
  } catch (e) {
    root.innerHTML = `<div class="loading">Couldn't load game data.<br><small>Serve this app over http:// (not file://) and reload.</small></div>`;
    return;
  }
  renderHome();
}

/* ---------- helpers ---------- */
const h = (html) => { root.innerHTML = html; };
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); // iPadOS reports as Mac
const isStandalone = () =>
  (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
  navigator.standalone === true; // iOS Safari

// iOS can't trigger an install prompt — show Add-to-Home-Screen instructions.
function showIOSInstall() {
  const share = `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M12 3l4 4-1.4 1.4L13 6.8V15h-2V6.8L9.4 8.4 8 7l4-4zM6 10h3v2H7v8h10v-8h-2v-2h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V11a1 1 0 0 1 1-1z"/></svg>`;
  const el = document.createElement("div");
  el.className = "sheet-backdrop";
  el.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">
      <h3>Add Picobra to your Home Screen</h3>
      <ol class="ios-steps">
        <li>Tap the <b>Share</b> button ${share} in the toolbar</li>
        <li>Scroll and choose <b>“Add to Home Screen”</b></li>
        <li>Tap <b>Add</b> — it launches full-screen and works offline</li>
      </ol>
      <p class="sheet-note">Tip: on iPhone this works in <b>Safari</b>.</p>
      <button class="ghost-btn" id="sheet-close">Got it</button>
    </div>`;
  document.body.appendChild(el);
  const close = () => el.remove();
  el.querySelector("#sheet-close").onclick = close;
  el.onclick = (e) => { if (e.target === el) close(); };
}

function cardHTML(card) {
  return esc(card.html)
    .replace(/\x00([pst])([\s\S]*?)\x01/g, (_, t, v) =>
      `<b class="hl ${t === "p" ? "player" : t === "s" ? "sips" : "team"}">${v}</b>`)
    .replace(/\n/g, "<br>");
}

/* ---------- HOME ---------- */
function renderHome() {
  const s = store.get();
  const langName = catalog.languages.find((l) => l.code === s.lang)?.name || s.lang;
  const m = MODE_META[s.mode] || MODE_META.default;
  h(`
    <main class="screen home" id="home">
      <button class="icon-btn settings-gear" id="to-settings" aria-label="Settings">⚙️</button>
      <div class="brand">
        <img src="./icons/icon-512.png" alt="" class="brand-logo" width="84" height="84">
        <h1 class="wordmark">picobra</h1>
        <p class="tagline">The offline party drinking game</p>
      </div>

      <div class="players-box">
        <div class="player-input">
          <input id="player-name" type="text" inputmode="text" autocomplete="off" enterkeyhint="done"
                 placeholder="Add a player…" maxlength="24" aria-label="Player name">
          <button id="add-player" class="add-btn" aria-label="Add player">＋</button>
        </div>
        <p class="hint" id="min-hint">Add at least 2 players to start.</p>
        <div class="chips" id="chips"></div>
      </div>

      <div class="home-actions" id="home-actions">
        <button id="install-btn" class="ghost-btn hidden"></button>
        <button id="play-btn" class="play-btn">Play ▸</button>
        <p class="active-packs">${m.icon} ${esc(m.name)} · ${esc(langName)}</p>
      </div>
    </main>`);

  const nameInput = root.querySelector("#player-name");
  const addBtn = root.querySelector("#add-player");
  const chipsEl = root.querySelector("#chips");
  const playBtn = root.querySelector("#play-btn");
  const minHint = root.querySelector("#min-hint");

  // Incremental updates (no full re-render) keep the keyboard up while typing.
  const refresh = () => {
    chipsEl.innerHTML = store.get().players.map(chip).join("");
    const can = store.get().players.length >= 2;
    playBtn.disabled = !can;
    minHint.classList.toggle("hidden", can);
  };
  const addName = () => {
    const v = nameInput.value.trim();
    if (!v) return;
    store.addPlayer(v);
    nameInput.value = "";
    refresh();
    nameInput.focus();
  };
  refresh();

  addBtn.addEventListener("pointerdown", (e) => e.preventDefault()); // don't steal focus from the input
  addBtn.onclick = addName;
  nameInput.onkeydown = (e) => { if (e.key === "Enter") addName(); };
  chipsEl.onclick = (e) => {
    const x = e.target.closest(".x");
    if (x) { store.removePlayer(x.dataset.name); refresh(); }
  };

  root.querySelector("#to-settings").onclick = renderSettings;
  playBtn.onclick = startGame;

  const ib = root.querySelector("#install-btn");
  if (deferredInstall) {                       // Chromium desktop / Android
    ib.textContent = "⬇️ Install app";
    ib.classList.remove("hidden");
    ib.onclick = async () => { deferredInstall.prompt(); deferredInstall = null; ib.classList.add("hidden"); };
  } else if (isIOS() && !isStandalone()) {     // iOS has no install prompt — guide instead
    ib.textContent = "📲 Add to Home Screen";
    ib.classList.remove("hidden");
    ib.onclick = showIOSInstall;
  }
}
const chip = (name) =>
  `<span class="chip">${esc(name)}<button class="x" data-name="${esc(name)}" aria-label="Remove ${esc(name)}">×</button></span>`;

/* ---------- SETTINGS ---------- */
function renderSettings() {
  const s = store.get();
  h(`
    <main class="screen settings">
      <header class="bar">
        <button class="icon-btn" id="back" aria-label="Back">←</button>
        <h2>Settings</h2>
      </header>

      <section class="setting">
        <label class="setting-label" for="lang-select">Language</label>
        <select id="lang-select" class="select">
          ${catalog.languages.map((l) => `<option value="${l.code}" ${l.code === s.lang ? "selected" : ""}>${esc(l.name)} · ${l.count}</option>`).join("")}
        </select>
      </section>

      <section class="setting">
        <span class="setting-label">Game mode</span>
        <div class="pack-grid" id="mode-grid">
          ${MODES.map((mode) => modeCard(mode, s.mode === mode)).join("")}
        </div>
      </section>

      <section class="setting">
        <label class="setting-label" for="intensity">Drink intensity</label>
        <input type="range" class="slider" id="intensity" min="1" max="5" step="1" value="${s.intensity}">
        <p class="slider-val" id="intensity-val"></p>
      </section>

      <section class="setting">
        <label class="setting-label" for="rulelen">Rule length</label>
        <input type="range" class="slider" id="rulelen" min="2" max="10" step="1" value="${s.ruleLength}">
        <p class="slider-val" id="rulelen-val"></p>
      </section>

      <p class="about">Picobra · fully offline PWA · ${catalog.languages.reduce((n, l) => n + l.count, 0).toLocaleString()} questions</p>
    </main>`);

  root.querySelector("#back").onclick = renderHome;
  root.querySelector("#lang-select").onchange = (e) => store.update({ lang: e.target.value, langPicked: true });
  root.querySelectorAll(".pack-card").forEach((c) =>
    (c.onclick = () => { store.setMode(c.dataset.mode); renderSettings(); }));

  const iSlider = root.querySelector("#intensity");
  const iVal = root.querySelector("#intensity-val");
  const setI = () => { iVal.textContent = intensityLabel(+iSlider.value); };
  iSlider.oninput = () => { store.update({ intensity: +iSlider.value }); setI(); };
  setI();

  const rSlider = root.querySelector("#rulelen");
  const rVal = root.querySelector("#rulelen-val");
  const setR = () => { rVal.textContent = `rules stay active ~${rSlider.value} cards`; };
  rSlider.oninput = () => { store.update({ ruleLength: +rSlider.value }); setR(); };
  setR();
}
function modeCard(id, on) {
  const m = MODE_META[id] || { icon: "🎲", name: id, desc: "" };
  return `<button class="pack-card ${on ? "on" : ""}" data-mode="${id}" aria-pressed="${!!on}">
      <span class="pack-icon">${m.icon}</span>
      <span class="pack-name">${m.name}</span>
      <span class="pack-desc">${m.desc}</span>
    </button>`;
}
function intensityLabel(v) {
  const [a, b] = INTENSITY_SIPS[v] || INTENSITY_SIPS[3];
  const names = { 1: "Gentle", 2: "Easy", 3: "Normal", 4: "Heavy", 5: "Wild" };
  return `${names[v]} · ${a}–${b} sips per dare`;
}

/* ---------- GAME ---------- */
async function startGame() {
  const s = store.get();
  h(`<div class="loading"><div class="spinner"></div>Shuffling the deck…</div>`);
  let data;
  try { data = await getLang(s.lang); }
  catch { h(`<div class="loading">Couldn't load “${s.lang}”.<br><button class="ghost-btn" id="back">← Back</button></div>`);
          root.querySelector("#back").onclick = renderHome; return; }

  game = new Game(data, {
    players: s.players, packs: store.activePacks(), teamMode: store.teamPlay(),
    intensity: s.intensity, ruleLength: s.ruleLength,
  });
  if (!game.playable) {
    h(`<div class="loading">No cards fit this setup.<br><small>Try more players or another pack.</small><br>
       <button class="ghost-btn" id="back">← Back</button></div>`);
    root.querySelector("#back").onclick = renderHome;
    return;
  }

  h(`
    <main class="screen game" id="game">
      <div class="game-top">
        <button class="icon-btn" id="quit" aria-label="Quit game">✕</button>
        <span class="rules-pill hidden" id="rules-pill"></span>
        <span class="counter" id="counter">1</span>
      </div>
      <div class="card-stage" id="stage" role="button" tabindex="0" aria-live="polite">
        <div class="qcard" id="qcard"></div>
      </div>
      <p class="tap-hint">tap for next ›</p>
    </main>`);

  const stage = root.querySelector("#stage");
  const advance = () => showCard();
  stage.onclick = advance;
  stage.onkeydown = (e) => { if ([" ", "Enter", "ArrowRight"].includes(e.key)) { e.preventDefault(); advance(); } };
  attachSwipe(stage, advance);
  root.querySelector("#quit").onclick = () => { if (confirm("Quit this game?")) renderHome(); };
  stage.focus();
  showCard();
}

let turnNo = 0;
function showCard() {
  const card = game.next();
  if (!card) return;
  turnNo++;
  const stage = root.querySelector("#stage");
  const qcard = root.querySelector("#qcard");
  const [c1, c2] = pick(GRADIENTS);
  const kind = card.meta.kind;

  const badge = kind === "rule-start" ? `<span class="badge">⚡ New rule</span>`
    : kind === "rule-end" ? `<span class="badge">✓ Rule lifted</span>` : "";
  const teamBanner = card.meta.team
    ? `<div class="team-banner" style="--team:${card.meta.team.color}">${esc(card.meta.team.name)} team</div>` : "";

  qcard.style.setProperty("--g1", c1);
  qcard.style.setProperty("--g2", c2);
  if (card.meta.team) qcard.style.setProperty("--team-color", card.meta.team.color);
  qcard.className = "qcard " + kind;
  qcard.innerHTML = `${teamBanner}${badge}<p class="qtext">${cardHTML(card)}</p>`;

  // retrigger enter animation
  qcard.classList.remove("in"); void qcard.offsetWidth; qcard.classList.add("in");

  root.querySelector("#counter").textContent = turnNo;
  const rp = root.querySelector("#rules-pill");
  if (card.meta.activeRules > 0) { rp.classList.remove("hidden"); rp.textContent = `⚡ ${card.meta.activeRules}`; }
  else rp.classList.add("hidden");
}

function attachSwipe(el, cb) {
  let x0 = null;
  el.addEventListener("touchstart", (e) => (x0 = e.touches[0].clientX), { passive: true });
  el.addEventListener("touchend", (e) => {
    if (x0 !== null && x0 - e.changedTouches[0].clientX > 60) cb();
    x0 = null;
  }, { passive: true });
}
