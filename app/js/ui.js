// Screens + router for Picobra. Plain DOM, no framework.
import { store } from "./store.js";
import { getIndex, getLang } from "./data.js";
import { Game } from "./engine.js";

const PACK_META = {
  default: { icon: "😄", name: "Getting Started", desc: "The classic warm-up" },
  silly:   { icon: "🤪", name: "Getting Crazy",   desc: "Weird & wacky dares" },
  hot:     { icon: "🔥", name: "Caliente",        desc: "Spicy and flirty" },
  war:     { icon: "⚔️", name: "War (Teams)",     desc: "Two squads battle · 4+ players" },
  bar:     { icon: "🍺", name: "Bar",             desc: "Out on the town" },
};
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

function cardHTML(card) {
  return esc(card.html)
    .replace(/\x00([pst])([\s\S]*?)\x01/g, (_, t, v) =>
      `<b class="hl ${t === "p" ? "player" : t === "s" ? "sips" : "team"}">${v}</b>`)
    .replace(/\n/g, "<br>");
}

/* ---------- HOME ---------- */
function renderHome() {
  const s = store.get();
  const canPlay = s.players.length >= 2;
  h(`
    <main class="screen home">
      <button class="icon-btn settings-gear" id="to-settings" aria-label="Settings">⚙️</button>
      <div class="brand">
        <img src="./icons/icon-512.png" alt="" class="brand-logo" width="88" height="88">
        <h1 class="wordmark">picobra</h1>
        <p class="tagline">The offline party drinking game</p>
      </div>

      <div class="players-box">
        <div class="player-input">
          <input id="player-name" type="text" inputmode="text" autocomplete="off"
                 placeholder="Add a player…" maxlength="24" aria-label="Player name">
          <button id="add-player" class="add-btn" aria-label="Add player">＋</button>
        </div>
        <div class="chips" id="chips">${s.players.map(chip).join("")}</div>
        <p class="hint ${canPlay ? "hidden" : ""}" id="min-hint">Add at least 2 players to start.</p>
      </div>

      <div class="home-actions">
        <button id="install-btn" class="ghost-btn hidden">⬇️ Install app</button>
        <button id="play-btn" class="play-btn" ${canPlay ? "" : "disabled"}>Play ▸</button>
        <p class="active-packs">${store.activePacks().map((p) => PACK_META[p]?.icon || "").join(" ")} · ${catalog.languages.find((l) => l.code === s.lang)?.name || s.lang}</p>
      </div>
    </main>`);

  const nameInput = root.querySelector("#player-name");
  const addName = () => {
    store.addPlayer(nameInput.value);
    nameInput.value = "";
    renderHome();
    root.querySelector("#player-name")?.focus();
  };
  root.querySelector("#add-player").onclick = addName;
  nameInput.onkeydown = (e) => { if (e.key === "Enter") addName(); };
  root.querySelectorAll(".chip .x").forEach((b) =>
    (b.onclick = () => { store.removePlayer(b.dataset.name); renderHome(); }));
  root.querySelector("#to-settings").onclick = renderSettings;
  root.querySelector("#play-btn").onclick = startGame;

  if (deferredInstall) {
    const ib = root.querySelector("#install-btn");
    ib.classList.remove("hidden");
    ib.onclick = async () => { deferredInstall.prompt(); deferredInstall = null; ib.classList.add("hidden"); };
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
        <span class="setting-label">Question packs</span>
        <div class="pack-grid">
          ${catalog.packs.map((p) => packCard(p, s.packs[p])).join("")}
        </div>
        <p class="hint">Pick one or more. <b>War (Teams)</b> splits everyone into two squads.</p>
      </section>

      <p class="about">Picobra · fully offline PWA · ${catalog.languages.reduce((n, l) => n + l.count, 0).toLocaleString()} questions</p>
    </main>`);

  root.querySelector("#back").onclick = renderHome;
  root.querySelector("#lang-select").onchange = (e) => store.update({ lang: e.target.value });
  root.querySelectorAll(".pack-card").forEach((c) =>
    (c.onclick = () => { store.togglePack(c.dataset.pack); renderSettings(); }));
}
function packCard(id, on) {
  const m = PACK_META[id] || { icon: "🎲", name: id, desc: "" };
  return `<button class="pack-card ${on ? "on" : ""}" data-pack="${id}" aria-pressed="${!!on}">
      <span class="pack-icon">${m.icon}</span>
      <span class="pack-name">${m.name}</span>
      <span class="pack-desc">${m.desc}</span>
    </button>`;
}

/* ---------- GAME ---------- */
async function startGame() {
  const s = store.get();
  h(`<div class="loading"><div class="spinner"></div>Shuffling the deck…</div>`);
  let data;
  try { data = await getLang(s.lang); }
  catch { h(`<div class="loading">Couldn't load “${s.lang}”.<br><button class="ghost-btn" id="back">← Back</button></div>`);
          root.querySelector("#back").onclick = renderHome; return; }

  game = new Game(data, { players: s.players, packs: store.activePacks(), teamMode: store.teamPlay() });
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
