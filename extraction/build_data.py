"""Convert the decompiled Realm export (questions.json) into compact,
app-ready per-language JSON files consumed by the Picobra PWA.

Input : extraction/questions.json  (index-addressed heap dump of default-7.realm)
Output: app/data/index.json         (language + pack catalog)
        app/data/<lang>.json        (questions for one language, grouped by pack)

Question encoding (positional arrays keep the payload small):
    standalone : [type, nb_players, text]
    rule setter: [type, nb_players, text, thread, 1]
    rule ender : [type, nb_players, text, thread, 0]
`thread` links a persistent-rule setter to the ender card(s) that cancel it.
"""
import json, os, re, collections

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(HERE, "questions.json")
OUT = os.path.join(ROOT, "app", "data")

LANG_NAMES = {
    "da": "Dansk", "de": "Deutsch", "en": "English", "es": "Español",
    "fi": "Suomi", "fr": "Français", "it": "Italiano", "ja": "日本語",
    "ko": "한국어", "nb": "Norsk", "nl": "Nederlands", "pt": "Português",
    "ru": "Русский", "sv": "Svenska",
}
PACK_ORDER = ["default", "silly", "hot", "war", "bar"]

# Best-effort repair of a few mojibake artifacts already present in the dump.
FIXES = {"�": ""}


def clean(t):
    for a, b in FIXES.items():
        t = t.replace(a, b)
    return t.strip()


def main():
    data = json.load(open(SRC, encoding="utf-8"))
    idx = [int(i) for i in data[1]]

    def deref(v):
        try:
            i = int(v)
            if i < len(data) and not isinstance(data[i], (dict, list)):
                return data[i]
        except (ValueError, TypeError):
            pass
        return v

    rows = []
    for i in idx:
        e = data[i]
        rows.append({
            "type": e["type"],
            "np": e["nb_players"],
            "text": clean(deref(e["text"])),
            "key": deref(e["key"]) or "",
            "parent": deref(e["parent_key"]) or "",
            "pack": deref(e["pack_name"]) or "default",
            "lang": deref(e["language"]),
        })

    os.makedirs(OUT, exist_ok=True)
    catalog = []
    by_lang = collections.defaultdict(list)
    for r in rows:
        by_lang[r["lang"]].append(r)

    for lang in sorted(by_lang):
        packs = collections.OrderedDict()
        seen_packs = {r["pack"] for r in by_lang[lang]}
        ordered = [p for p in PACK_ORDER if p in seen_packs] + \
                  sorted(seen_packs - set(PACK_ORDER))
        for p in ordered:
            packs[p] = []
        for r in by_lang[lang]:
            if not r["text"]:
                continue
            if r["key"]:           # setter: key == parent == thread name
                q = [r["type"], r["np"], r["text"], r["key"], 1]
            elif r["parent"]:      # ender: cancels the thread named by parent
                q = [r["type"], r["np"], r["text"], r["parent"], 0]
            else:                  # standalone
                q = [r["type"], r["np"], r["text"]]
            packs[r["pack"]].append(q)
        total = sum(len(v) for v in packs.values())
        with open(os.path.join(OUT, f"{lang}.json"), "w", encoding="utf-8") as f:
            json.dump({"l": lang, "p": packs}, f, ensure_ascii=False,
                      separators=(",", ":"))
        catalog.append({"code": lang,
                        "name": LANG_NAMES.get(lang, lang),
                        "count": total})
        print(f"  {lang}: {total} questions across {len(packs)} packs")

    catalog.sort(key=lambda c: c["name"])
    packs_all = [p for p in PACK_ORDER]
    with open(os.path.join(OUT, "index.json"), "w", encoding="utf-8") as f:
        json.dump({"languages": catalog, "packs": packs_all}, f,
                  ensure_ascii=False, indent=1)
    print(f"\nWrote {len(catalog)} languages + index.json to {OUT}")


if __name__ == "__main__":
    main()
