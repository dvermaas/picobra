# Picobra 🐍

Picobra is a fully-offline **Progressive Web App** reimplementation of the party game
*Picolo*. Add your friends, choose your question packs, and the app deals endless dares,
rules, votes, and team battles — right in the browser, installable, no network required.

It was rebuilt from the decompiled Android app: the original game database (a Realm file)
was extracted to JSON, converted into compact per-language question banks, and paired with a
brand-new vanilla-JS front end.

## Play it

The front end is plain static files — **no build step**. It does need to be served over
`http://` (service workers and the data files don't load from `file://`):

```sh
cd app
python -m http.server 8000
# then open http://localhost:8000
```

Any static server works (`npx serve`, etc.). Once loaded you can **Install** it from your
browser to get a home-screen app that runs completely offline.

## Features

- **62,000+ questions** across **14 languages** and **5 packs** — Getting Started, Getting
  Crazy, Caliente, War (Teams), and Bar.
- Faithful mechanics reverse-engineered from the original: random player / sip / team
  substitution, persistent **rule cards** that switch on and later get lifted, and
  **team-vs-team** battles.
- Endless, no-repeat deck · vibrant installable UI · **100% offline** after first load.

## Repository layout

| Path | What it is |
|------|------------|
| `app/` | The PWA (vanilla ES-module JS, no framework, no build). Architecture in [CLAUDE.md](CLAUDE.md). |
| `app/data/` | Generated question banks, one JSON per language. |
| `extraction/` | Tooling that turns the decompiled game DB into `app/data/` and generates the icons. |
| `picolo_v2.5.0/` | The decompiled reference APK — read-only source material (not tracked in git). |

The loose `index.html` / `game.html` / `options.html` / `webapp/` at the repo root are an
earlier prototype, superseded by `app/`.

## Regenerating data & icons

Both are already checked in; regenerate only if you change the pipeline:

```sh
python extraction/build_data.py   # extraction/questions.json -> app/data/*.json
node   extraction/make_icons.js   # -> app/icons/*.png
```

## Credits

Game concept and question content belong to the original *Picolo* app. This is a personal,
offline reimplementation for learning; it is branded "Picobra" to keep it distinct.
