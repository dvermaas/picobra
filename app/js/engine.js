// Picobra game engine.
//
// A language file groups questions by pack. Each question is a positional array:
//   [type, nb_players, text]                 standalone card
//   [type, nb_players, text, thread, 1]      rule "setter"  (starts a persistent rule)
//   [type, nb_players, text, thread, 0]      rule "ender"   (cancels that rule later)
//
// Placeholders inside `text`:
//   %s  -> a distinct random player
//   $   -> a sip count (same value everywhere in the card)
//   %t  -> the team whose turn it is (team mode only)
//   #picoloapp -> left as-is (literal hashtag)

const TEAM_TOKEN = "%t";
const SIP_MIN = 2, SIP_MAX = 5;
const ENDER_MIN_DELAY = 2, ENDER_MAX_DELAY = 6; // cards between a rule and its end

const TEAMS = [
  { name: "Red", color: "#ff3b6b" },
  { name: "Blue", color: "#2ea6ff" },
];

const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
function shuffle(a) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function parse(arr, pack) {
  return { type: arr[0], np: arr[1], text: arr[2], thread: arr[3] || null, role: arr[4], pack };
}

export class Game {
  constructor(langData, { players, packs, teamMode }) {
    this.players = players.slice();
    this.teamMode = !!teamMode && players.length >= 2;
    this.teams = this.teamMode ? this._makeTeams() : null;
    this.turnTeam = 0;

    const banks = langData.p || {};
    // Enders are indexed from every pack so a setter always finds its cancel card.
    this.enders = new Map();
    for (const pack of Object.keys(banks)) {
      for (const raw of banks[pack]) {
        if (raw[4] === 0) {
          const q = parse(raw, pack);
          if (!this.enders.has(q.thread)) this.enders.set(q.thread, []);
          this.enders.get(q.thread).push(q);
        }
      }
    }
    // Draw pool: selected packs, excludes standalone enders, respects player count
    // and whether team cards are allowed.
    this.pool = [];
    for (const pack of packs) {
      for (const raw of banks[pack] || []) {
        if (raw[4] === 0) continue; // enders enter only via scheduling
        const q = parse(raw, pack);
        if (q.np > this.players.length) continue;
        if (q.text.includes(TEAM_TOKEN) && !this.teamMode) continue;
        this.pool.push(q);
      }
    }

    this.queue = [];
    this.scheduled = []; // { ender, turnsLeft }
    this.activeRules = [];
    this.turn = 0;
    this._refill();
  }

  get playable() { return this.pool.length > 0; }

  _makeTeams() {
    const shuffled = shuffle(this.players);
    const mid = Math.ceil(shuffled.length / 2);
    return TEAMS.map((t, i) => ({
      ...t,
      players: i === 0 ? shuffled.slice(0, mid) : shuffled.slice(mid),
    }));
  }

  _refill() { this.queue = shuffle(this.pool); }

  // Advance to the next card and return a render descriptor.
  next() {
    this.turn++;
    // A scheduled rule-end takes priority when its countdown elapses.
    for (let i = 0; i < this.scheduled.length; i++) {
      if (--this.scheduled[i].turnsLeft <= 0) {
        const { ender } = this.scheduled.splice(i, 1)[0];
        this.activeRules = this.activeRules.filter((r) => r.thread !== ender.thread);
        return this._render(ender, "rule-end");
      }
    }
    if (!this.queue.length) this._refill();
    const q = this.queue.pop();
    if (!q) return null;

    if (q.role === 1) {
      const options = this.enders.get(q.thread);
      if (options) {
        this.scheduled.push({
          ender: options[randInt(0, options.length - 1)],
          turnsLeft: randInt(ENDER_MIN_DELAY, ENDER_MAX_DELAY),
        });
        this.activeRules.push({ thread: q.thread, label: q.text });
      }
      return this._render(q, "rule-start");
    }
    return this._render(q, "normal");
  }

  _render(q, kind) {
    let team = null;
    if (q.text.includes(TEAM_TOKEN) && this.teams) {
      team = this.teams[this.turnTeam];
      this.turnTeam = (this.turnTeam + 1) % this.teams.length;
    }
    const sips = randInt(SIP_MIN, SIP_MAX);
    const bag = shuffle(this.players);
    let bi = 0;
    const chosen = [];
    const teamName = team ? team.name : "";
    const plain = q.text
      .replaceAll(TEAM_TOKEN, teamName)
      .replace(/%s/g, () => { const p = bag[bi++ % bag.length]; chosen.push(p); return p; })
      .replace(/\$/g, String(sips));

    // Parallel pass producing HTML markers (\x00<type>value\x01) that the UI
    // turns into <b> emphasis. Reuses `chosen` so player order stays aligned.
    let ci = 0;
    const html = q.text
      .replaceAll(TEAM_TOKEN, teamName ? `\x00t${teamName}\x01` : "")
      .replace(/%s/g, () => `\x00p${chosen[ci++]}\x01`)
      .replace(/\$/g, `\x00s${sips}\x01`);

    return {
      text: plain, html,
      meta: { type: q.type, pack: q.pack, kind, players: chosen, team, sips,
        activeRules: this.activeRules.length },
    };
  }
}

export { TEAMS };
