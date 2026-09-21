#!/usr/bin/env python3
"""Lay the store assets out the way Play Console asks for them, and zip it.

    python3 tools/play_bundle.py

Play Console's listing form is per language: for each one you paste a title, a
short description and a full description, then drag in screenshots. Reading
those out of a JSON file while clicking through a browser is miserable, so this
writes one self contained folder per language with the text in separate files,
ready to select-all and copy, and the screenshots numbered in the order they
should appear.

Output: play/upload/ and play/xurface-discern-store-assets.zip
"""
import json, shutil, zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PLAY = ROOT / "play"
OUT = PLAY / "upload"
ZIP = PLAY / "xurface-discern-store-assets.zip"

LOCALES = {"en": "en-US", "zh": "zh-CN", "hi": "hi-IN", "es": "es-ES", "fr": "fr-FR",
           "ar": "ar", "pt": "pt-BR", "ru": "ru-RU", "ja": "ja-JP", "de": "de-DE"}
NAMES = {"en-US": "English (United States)", "zh-CN": "Chinese (Simplified)",
         "hi-IN": "Hindi", "es-ES": "Spanish (Spain)", "fr-FR": "French (France)",
         "ar": "Arabic", "pt-BR": "Portuguese (Brazil)", "ru-RU": "Russian",
         "ja-JP": "Japanese", "de-DE": "German"}
SHOT_NAMES = {"1-discern": "01-decide", "2-label": "02-permission-label",
              "3-appetite": "03-your-limits", "4-activity": "04-audit-record",
              "5-settings": "05-settings"}

README = """XURFACE DISCERN - GOOGLE PLAY STORE ASSETS
==========================================

Package: com.xurface.discern.app
Privacy policy URL: https://xurface.500xlaunch.com/privacy

WHAT IS HERE
------------
_store/          the icon and feature graphic. Used once, on the default
                 language (English) only.
en-US/ ... de-DE/  one folder per language. Each holds three text files and
                 five screenshots.

HOW TO USE IT IN PLAY CONSOLE
-----------------------------
Go to: Play Console > your app > Grow > Store presence > Main store listing.

1. Start on English (United States), the default language.
   - App name            <- en-US/title.txt
   - Short description   <- en-US/short-description.txt
   - Full description    <- en-US/full-description.txt
   - App icon            <- _store/icon-512.png
   - Feature graphic     <- _store/feature-graphic.png
   - Phone screenshots   <- drag all five files from en-US/, in number order
   Save.

2. Add the other nine languages.
   Use "Manage translations" > "Add your own translation text", pick the
   language, then paste that language's three text files and drag its five
   screenshots. The icon and feature graphic are shared, so you only upload
   them once, on English.

Each language folder is self contained. Work through them one at a time; there
is no ordering requirement between them.

REGENERATING
------------
These files are generated, never hand edited. After a UI change:
    python3 tools/brand.py
    LANGS=en,zh,hi,es,fr,ar,pt,ru,ja,de node tools/screenshots.mjs
    python3 play/publish.py --dry-run
    python3 tools/play_bundle.py
"""


def main():
    listing = json.loads((PLAY / "listing.i18n.json").read_text(encoding="utf-8"))
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)

    store = OUT / "_store"
    store.mkdir()
    for f in ("icon-512.png", "feature-graphic.png"):
        shutil.copy2(PLAY / f, store / f)

    (OUT / "README.txt").write_text(README)

    rows = []
    for code, locale in LOCALES.items():
        d = OUT / locale
        d.mkdir()
        fields = listing[locale]
        (d / "title.txt").write_text(fields["title"], encoding="utf-8")
        (d / "short-description.txt").write_text(fields["shortDescription"], encoding="utf-8")
        (d / "full-description.txt").write_text(fields["fullDescription"], encoding="utf-8")

        n = 0
        for src_stem, nice in sorted(SHOT_NAMES.items()):
            src = PLAY / "screenshots" / code / f"{src_stem}.png"
            if src.exists():
                shutil.copy2(src, d / f"{nice}.png")
                n += 1
        rows.append((locale, NAMES[locale], len(fields["title"]),
                     len(fields["shortDescription"]), len(fields["fullDescription"]), n))

    with zipfile.ZipFile(ZIP, "w", zipfile.ZIP_DEFLATED) as z:
        for p in sorted(OUT.rglob("*")):
            if p.is_file():
                z.write(p, p.relative_to(OUT))

    print(f"{'locale':7} {'language':26} {'title':>5} {'short':>6} {'full':>6} {'shots':>6}")
    for r in rows:
        print(f"{r[0]:7} {r[1]:26} {r[2]:>5} {r[3]:>6} {r[4]:>6} {r[5]:>6}")
    size = ZIP.stat().st_size / 1e6
    print(f"\n{OUT.relative_to(ROOT)}/   ({len(rows)} languages, "
          f"{sum(r[5] for r in rows)} screenshots, icon, feature graphic)")
    print(f"{ZIP.relative_to(ROOT)}   {size:.1f} MB")


if __name__ == "__main__":
    main()
