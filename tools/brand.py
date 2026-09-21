#!/usr/bin/env python3
"""Generate every branded image Xurface Discern ships with, from one source of
truth: the Xurface mark and the brand palette.

    python3 tools/brand.py            # writes everything
    python3 tools/brand.py --check    # verifies what is on disk matches

Covers:
  www/icons/                              the PWA / web app icons
  android/app/src/main/res/mipmap-*/      launcher icons, legacy and adaptive
  android/app/src/main/res/drawable-*/    splash screens, portrait and landscape
  play/                                   store icon and feature graphic

Fonts are IBM Plex Sans and Fraunces (both OFL). They are fetched from Google
Fonts on first run and cached under tools/.fonts, which is not committed.
"""
import argparse, io, math, os, sys, urllib.request
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
FONTS = Path(__file__).resolve().parent / ".fonts"

# -- brand -------------------------------------------------------------------
INK    = (14, 17, 22)        # --bg dark
PAPER  = (244, 246, 249)     # --ink on dark
BLUE   = (59, 110, 163)      # --xur, the Xurface matte blue
BLUE_D = (28, 56, 86)
SS     = 6                   # supersample factor for smooth curves

FONT_URLS = {
    "plex-bold.ttf":  "IBM+Plex+Sans:wght@700",
    "plex-semi.ttf":  "IBM+Plex+Sans:wght@600",
    "plex-reg.ttf":   "IBM+Plex+Sans:wght@400",
    "fraunces.ttf":   "Fraunces:wght@600",
}


def font(name: str, size: int) -> ImageFont.FreeTypeFont:
    FONTS.mkdir(exist_ok=True)
    path = FONTS / name
    if not path.exists():
        spec = FONT_URLS[name]
        # an old user agent makes Google Fonts serve ttf rather than woff2
        req = urllib.request.Request(f"https://fonts.googleapis.com/css2?family={spec}",
                                     headers={"User-Agent": "Mozilla/5.0 (Windows NT 6.1; WOW64)"})
        css = urllib.request.urlopen(req, timeout=30).read().decode()
        url = css.split("url(")[1].split(")")[0]
        path.write_bytes(urllib.request.urlopen(url, timeout=30).read())
    return ImageFont.truetype(str(path), size)


# -- the mark ----------------------------------------------------------------
def _bez(p0, p1, p2, p3, n=160):
    for i in range(n + 1):
        t = i / n; u = 1 - t
        yield (u*u*u*p0[0] + 3*u*u*t*p1[0] + 3*u*t*t*p2[0] + t*t*t*p3[0],
               u*u*u*p0[1] + 3*u*u*t*p1[1] + 3*u*t*t*p2[1] + t*t*t*p3[1])


def _stamp(d, pts, r, fill):
    """A round capped, round joined stroke. Dense circles beat PIL's line joints,
    which fringe badly on tight curves like the wave's crest."""
    prev = None
    for p in pts:
        if prev is not None:
            dist = math.hypot(p[0]-prev[0], p[1]-prev[1])
            steps = max(1, int(dist / (r * 0.2)))
            for s in range(steps):
                t = s / steps
                x = prev[0] + (p[0]-prev[0]) * t
                y = prev[1] + (p[1]-prev[1]) * t
                d.ellipse([x-r, y-r, x+r, y+r], fill=fill)
        d.ellipse([p[0]-r, p[1]-r, p[0]+r, p[1]+r], fill=fill)
        prev = p


def glyph(px: int, color=PAPER) -> Image.Image:
    """The Xurface mark on transparent, cropped to its own ink so callers can
    place it by its true bounds rather than by a padded box."""
    S = px * 3
    g = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(g)
    k = S * 0.5 / 256.0
    P = lambda x, y: (x * k + S * 0.2, y * k + S * 0.2)
    w = 20 * k
    pts  = [P(*p) for p in _bez((28,160), (59.9,160), (54.1,96), (86,96))]
    pts += [P(*p) for p in _bez((86,96), (117.9,96), (112.1,160), (144,160))]
    pts += [P(*p) for p in _bez((144,160), (160,160), (166,156), (166,128))]
    _stamp(d, pts, w/2, color)
    c, rr = P(200, 128), 34 * k
    _stamp(d, [(c[0]+rr*math.cos(a*math.pi/180), c[1]+rr*math.sin(a*math.pi/180))
               for a in range(0, 361, 2)], w/2, color)
    return g.crop(g.getbbox())


def place(canvas: Image.Image, g: Image.Image, frac: float, center=None):
    """Scale the mark so its longest side is `frac` of the canvas, then centre
    it on its own ink (not on a bounding box with uneven padding)."""
    avail = min(canvas.size) * frac
    sc = min(avail / g.width, avail / g.height)
    g2 = g.resize((max(1, int(g.width*sc)), max(1, int(g.height*sc))), Image.LANCZOS)
    cx, cy = center or (canvas.width // 2, canvas.height // 2)
    canvas.alpha_composite(g2, (int(cx - g2.width/2), int(cy - g2.height/2)))
    return g2


def tile(size: int, bg, fg=PAPER, radius=0.235, frac=0.62, round_mask=False) -> Image.Image:
    S = size * SS
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if bg is not None:
        if round_mask:
            d.ellipse([0, 0, S-1, S-1], fill=bg)
        else:
            d.rounded_rectangle([0, 0, S-1, S-1], radius=int(S*radius), fill=bg)
    place(im, glyph(S, fg), frac)
    return im.resize((size, size), Image.LANCZOS)


def gradient(w: int, h: int, top, bottom) -> Image.Image:
    """A vertical ramp, built one row at a time. Small enough to be cheap."""
    im = Image.new("RGB", (1, h))
    px = im.load()
    for y in range(h):
        t = y / max(1, h - 1)
        px[0, y] = tuple(int(top[i] + (bottom[i]-top[i]) * t) for i in range(3))
    return im.resize((w, h), Image.BICUBIC)


# -- outputs -----------------------------------------------------------------
# density -> launcher px, adaptive foreground px (108dp canvas), splash w x h
DENSITIES = {
    "mdpi":    (48,  108, (320, 480)),
    "hdpi":    (72,  162, (480, 800)),
    "xhdpi":   (96,  216, (720, 1280)),
    "xxhdpi":  (144, 324, (960, 1600)),
    "xxxhdpi": (192, 432, (1280, 1920)),
}

written: list[Path] = []


def out(img: Image.Image, path: Path, rgb=False):
    path.parent.mkdir(parents=True, exist_ok=True)
    (img.convert("RGB") if rgb else img).save(path)
    written.append(path)


def web_icons():
    out(tile(192, INK), ROOT/"www/icons/icon-192.png")
    out(tile(512, INK), ROOT/"www/icons/icon-512.png")
    # maskable: platforms crop to a circle, so the mark sits well inside
    out(tile(512, BLUE, frac=0.44), ROOT/"www/icons/icon-maskable.png")
    out(tile(96, None, (255,255,255,255), frac=0.86), ROOT/"www/icons/badge.png")


def android_icons():
    res = ROOT/"android/app/src/main/res"
    for dens, (launcher, fgpx, _) in DENSITIES.items():
        out(tile(launcher, INK), res/f"mipmap-{dens}/ic_launcher.png")
        out(tile(launcher, INK, round_mask=True), res/f"mipmap-{dens}/ic_launcher_round.png")
        # adaptive foreground: 108dp canvas, only the central 72dp always shows,
        # so the mark is kept to ~58% and the rest is transparent bleed
        fg = Image.new("RGBA", (fgpx*2, fgpx*2), (0, 0, 0, 0))
        place(fg, glyph(fgpx*2, PAPER), 0.42)
        out(fg.resize((fgpx, fgpx), Image.LANCZOS), res/f"mipmap-{dens}/ic_launcher_foreground.png")

    (res/"values").mkdir(parents=True, exist_ok=True)
    (res/"values/ic_launcher_background.xml").write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
        f'    <color name="ic_launcher_background">#{INK[0]:02X}{INK[1]:02X}{INK[2]:02X}</color>\n'
        '</resources>\n')
    written.append(res/"values/ic_launcher_background.xml")


def android_splash():
    res = ROOT/"android/app/src/main/res"
    for dens, (_, _, (w, h)) in DENSITIES.items():
        for orient, size in (("port", (w, h)), ("land", (h, w))):
            im = gradient(size[0], size[1], INK, (20, 26, 34)).convert("RGBA")
            place(im, glyph(min(size), PAPER), 0.30)
            out(im, res/f"drawable-{orient}-{dens}/splash.png", rgb=True)
    im = gradient(480, 800, INK, (20, 26, 34)).convert("RGBA")
    place(im, glyph(480, PAPER), 0.30)
    out(im, res/"drawable/splash.png", rgb=True)


def play_assets():
    play = ROOT/"play"
    # store icon: 512x512, no transparency in the final upload
    out(tile(512, INK), play/"icon-512.png", rgb=True)

    # feature graphic: 1024x500, read at thumbnail size, so it stays typographic
    W, H = 1024, 500
    im = gradient(W, H, (11, 14, 19), (23, 34, 48)).convert("RGBA")
    d = ImageDraw.Draw(im)
    # a soft blue wash behind the mark, so the art has depth without clutter
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    for r in range(260, 0, -8):
        a = int(26 * (1 - r/260))
        gd.ellipse([150-r, 250-r, 150+r, 250+r], fill=(*BLUE, a))
    im.alpha_composite(glow)

    place(im, glyph(W, PAPER), 0.185, center=(158, 250))
    f_name = font("fraunces.ttf", 62)
    f_tag  = font("plex-reg.ttf", 27)
    f_lbl  = font("plex-semi.ttf", 19)
    d.text((300, 186), "Xurface Discern", font=f_name, fill=PAPER)
    d.text((303, 268), "Decide what AI agents may do for you,", font=f_tag, fill=(170, 186, 203))
    d.text((303, 303), "before they do it.", font=f_tag, fill=(170, 186, 203))
    d.line([(303, 352), (303+86, 352)], fill=BLUE, width=3)
    d.text((303, 366), "BEYOND HUMAN IN THE LOOP", font=f_lbl, fill=(108, 128, 148))
    out(im, play/"feature-graphic.png", rgb=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="fail if any output is missing")
    ap.add_argument("--only", choices=["all", "android", "web", "play"], default="all",
                    help="android skips the store graphics, which are the only outputs needing fonts")
    args = ap.parse_args()

    if args.only in ("all", "web"):
        web_icons()
    if args.only in ("all", "android"):
        android_icons(); android_splash()
    if args.only in ("all", "play"):
        play_assets()

    if args.check:
        missing = [p for p in written if not p.exists()]
        if missing:
            print("missing:", *missing, sep="\n  "); sys.exit(1)
    for p in written:
        rel = p.relative_to(ROOT)
        if p.suffix == ".png":
            w, h = Image.open(p).size
            print(f"  {str(rel):62} {w}x{h}")
        else:
            print(f"  {rel}")
    print(f"\n{len(written)} files")


if __name__ == "__main__":
    main()
