// Loads the question catalog and per-language question banks.
// Language files are fetched on demand and cached in memory; the service
// worker additionally persists them for offline use.
const langCache = new Map();
let indexPromise = null;

export function getIndex() {
  if (!indexPromise) {
    indexPromise = fetch("./data/index.json").then((r) => {
      if (!r.ok) throw new Error("index " + r.status);
      return r.json();
    });
  }
  return indexPromise;
}

export function getLang(code) {
  if (!langCache.has(code)) {
    const p = fetch(`./data/${code}.json`).then((r) => {
      if (!r.ok) throw new Error(`lang ${code} ${r.status}`);
      return r.json();
    });
    langCache.set(code, p);
  }
  return langCache.get(code);
}
