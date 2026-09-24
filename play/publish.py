#!/usr/bin/env python3
"""Publish Xurface Discern to Google Play.

    python3 play/publish.py --dry-run                 # validate everything, no network
    python3 play/publish.py --aab app.aab --track internal
    python3 play/publish.py --listing-only            # push text and images, no binary

One edit covers the bundle, the store listing in every language and the images,
then commits. If any part fails the edit is abandoned, so a half applied listing
never reaches the store.

Auth, in the order tried:
  --creds FILE                  a service account key, or an external_account
                                (Workload Identity Federation) config
  GOOGLE_APPLICATION_CREDENTIALS
  PLAY_ACCESS_TOKEN             an already minted OAuth token, useful in CI

Xurface publishes as its own service account, federated to GitHub. It does not
borrow another product's identity, so a compromise of this pipeline cannot reach
another product's listings. See play/README.md for the one time setup.

Note on Workload Identity Federation: an external_account config is a pointer,
not a secret. Its credential_source file (a projected token) only exists inside
the cluster the pool is federated to, so that config cannot authenticate from a
laptop. Use it from the workload, or use a key, or mint a token first.
"""
from __future__ import annotations
import argparse, json, os, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PLAY = ROOT / "play"
PACKAGE = "com.xurface.discern.app"

# the app's own language codes -> the locales Google Play uses
LOCALES = {
    "en": "en-US", "zh": "zh-CN", "hi": "hi-IN", "es": "es-ES", "fr": "fr-FR",
    "ar": "ar", "pt": "pt-BR", "ru": "ru-RU", "ja": "ja-JP", "de": "de-DE",
}
LIMITS = {"title": 30, "shortDescription": 80, "fullDescription": 4000}
LONG_DASHES = "—–‒―−"


# ---------------------------------------------------------------- validation
def _png(path: Path):
    from PIL import Image
    with Image.open(path) as im:
        return im.size, im.mode


def validate() -> dict:
    """Everything Play will reject, caught here instead of after upload."""
    errs, warns = [], []

    listing_path = PLAY / "listing.i18n.json"
    if not listing_path.exists():
        return {"errors": [f"missing {listing_path}"], "warnings": [], "locales": {}}
    listing = json.loads(listing_path.read_text(encoding="utf-8"))

    for loc, fields in listing.items():
        for key, lim in LIMITS.items():
            v = fields.get(key, "")
            if not v:
                errs.append(f"{loc}: {key} is empty")
            elif len(v) > lim:
                errs.append(f"{loc}: {key} is {len(v)} chars, limit {lim}")
        if any(c in LONG_DASHES for c in "".join(fields.values())):
            errs.append(f"{loc}: contains a long dash")

    icon = PLAY / "icon-512.png"
    if not icon.exists():
        errs.append("missing play/icon-512.png")
    else:
        (w, h), mode = _png(icon)
        if (w, h) != (512, 512):
            errs.append(f"icon must be 512x512, is {w}x{h}")
        if mode == "RGBA":
            warns.append("icon has an alpha channel; Play prefers it flattened")

    feat = PLAY / "feature-graphic.png"
    if not feat.exists():
        errs.append("missing play/feature-graphic.png")
    else:
        (w, h), mode = _png(feat)
        if (w, h) != (1024, 500):
            errs.append(f"feature graphic must be 1024x500, is {w}x{h}")
        if mode == "RGBA":
            errs.append("feature graphic must not have an alpha channel")

    shots: dict[str, list[Path]] = {}
    for code, play_locale in LOCALES.items():
        # framed captures carry a headline on the brand background and are what
        # the store should show; the raw ones are the fallback and the source
        d = PLAY / "framed" / code
        if not d.exists() or not any(d.glob("*.png")):
            d = PLAY / "screenshots" / code
        files = sorted(d.glob("*.png")) if d.exists() else []
        if not files:
            warns.append(f"{play_locale}: no screenshots, Play will fall back to the default language")
            continue
        if not 2 <= len(files) <= 8:
            errs.append(f"{play_locale}: {len(files)} screenshots, Play allows 2 to 8")
        for f in files:
            (w, h), _ = _png(f)
            if not (320 <= w <= 3840 and 320 <= h <= 3840):
                errs.append(f"{f.name} ({play_locale}): {w}x{h} outside 320..3840")
            if max(w, h) / min(w, h) > 2.0:
                errs.append(f"{f.name} ({play_locale}): aspect {w}x{h} exceeds 2:1")
        shots[play_locale] = files

    missing = set(LOCALES.values()) - set(listing)
    if missing:
        warns.append(f"no listing text for: {', '.join(sorted(missing))}")

    return {"errors": errs, "warnings": warns, "listing": listing, "shots": shots,
            "icon": icon, "feature": feat}


# ---------------------------------------------------------------------- auth
def build_service(creds_path: str | None):
    from googleapiclient.discovery import build
    import google.auth
    from google.oauth2 import service_account

    SCOPE = ["https://www.googleapis.com/auth/androidpublisher"]
    token = os.environ.get("PLAY_ACCESS_TOKEN")
    if token:
        from google.oauth2.credentials import Credentials
        return build("androidpublisher", "v3", credentials=Credentials(token=token), cache_discovery=False)

    path = creds_path or os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if path:
        info = json.loads(Path(path).read_text())
        if info.get("type") == "external_account":
            src = (info.get("credential_source") or {}).get("file")
            if src and not Path(src).exists():
                sys.exit(
                    f"This is a Workload Identity Federation config. Its credential source\n"
                    f"  {src}\n"
                    f"does not exist here, so it cannot authenticate from this machine. Run this\n"
                    f"from the workload the pool is federated to, or pass a service account key,\n"
                    f"or set PLAY_ACCESS_TOKEN to a token minted where the source does exist.")
            from google.auth import load_credentials_from_info
            creds, _ = load_credentials_from_info(info, scopes=SCOPE)
        else:
            creds = service_account.Credentials.from_service_account_info(info, scopes=SCOPE)
    else:
        creds, _ = google.auth.default(scopes=SCOPE)
    return build("androidpublisher", "v3", credentials=creds, cache_discovery=False)


# -------------------------------------------------------------------- status
def status(args):
    """Read the app's current state without changing anything. The edit is
    opened only because the API has no read path outside one, and it is
    abandoned rather than committed."""
    svc = build_service(args.creds)
    edits = svc.edits()
    edit_id = edits.insert(body={}, packageName=args.package).execute()["id"]
    try:
        d = edits.details().get(packageName=args.package, editId=edit_id).execute()
        print(f"  package          {args.package}")
        print(f"  default language {d.get('defaultLanguage')}")
        print(f"  contact          {d.get('contactEmail') or 'not set'}")

        print("\n  tracks")
        tracks = edits.tracks().list(packageName=args.package, editId=edit_id).execute()
        for t in tracks.get("tracks", []):
            rels = t.get("releases") or []
            if not rels:
                print(f"    {t['track']:12} no release")
            for r in rels:
                codes = ", ".join(r.get("versionCodes") or []) or "none"
                frac = r.get("userFraction")
                extra = f"  {frac:.0%} rollout" if frac else ""
                print(f"    {t['track']:12} {r.get('status'):11} versionCode {codes}"
                      f"  name {r.get('name') or '-'}{extra}")

        print("\n  testers")
        for track in ("internal", "alpha", "beta"):
            try:
                te = edits.testers().get(packageName=args.package, editId=edit_id, track=track).execute()
                groups = te.get("googleGroups") or []
                print(f"    {track:12} {', '.join(groups) if groups else 'no Google Group set'}")
            except Exception as e:
                print(f"    {track:12} {getattr(e, 'status_code', '')} {str(e)[:60]}")
        print("\n  Email lists added in the Console are not visible here: the API\n"
              "  exposes Google Groups only.")
    finally:
        try: edits.delete(packageName=args.package, editId=edit_id).execute()
        except Exception: pass


# ------------------------------------------------------------------- testers
def set_testers(args):
    """Point a track at one or more Google Groups.

    Play has two ways to name testers. The Console can hold a plain list of
    email addresses, which the API cannot see or change. The API can hold Google
    Groups, which the Console also shows. So a group is the only form that can
    be managed from here, and the only one that survives as code.

    Whoever is in the group still has to accept the opt in link once, from the
    account they use on the device."""
    groups = [g.strip() for g in args.testers.split(",") if g.strip()]
    svc = build_service(args.creds)
    edits = svc.edits()
    edit_id = edits.insert(body={}, packageName=args.package).execute()["id"]
    try:
        edits.testers().update(packageName=args.package, editId=edit_id, track=args.track,
                               body={"googleGroups": groups}).execute()
        edits.commit(packageName=args.package, editId=edit_id).execute()
        print(f"  {args.track} testers: {', '.join(groups) if groups else 'cleared'}")
        print("  Each member still has to accept the opt in link once. Play Console")
        print(f"  shows it under Testing > {args.track.title()} testing > Testers.")
    except Exception:
        try: edits.delete(packageName=args.package, editId=edit_id).execute()
        except Exception: pass
        raise


# ------------------------------------------------------------------- publish
def publish(args, v: dict):
    from googleapiclient.http import MediaFileUpload

    svc = build_service(args.creds)
    edits = svc.edits()
    edit_id = edits.insert(body={}, packageName=args.package).execute()["id"]
    print(f"edit {edit_id} opened on {args.package}")

    try:
        version_code = None
        if args.aab:
            print(f"uploading {args.aab} ...")
            up = edits.bundles().upload(
                packageName=args.package, editId=edit_id,
                media_body=MediaFileUpload(args.aab, mimetype="application/octet-stream", resumable=True),
            ).execute()
            version_code = up["versionCode"]
            print(f"  bundle accepted, versionCode {version_code}")

        for locale, fields in v["listing"].items():
            edits.listings().update(packageName=args.package, editId=edit_id, language=locale, body={
                "title": fields["title"],
                "shortDescription": fields["shortDescription"],
                "fullDescription": fields["fullDescription"],
            }).execute()
            print(f"  listing {locale}")

        default = args.default_language
        for kind, path in (("icon", v["icon"]), ("featureGraphic", v["feature"])):
            edits.images().deleteall(packageName=args.package, editId=edit_id,
                                     language=default, imageType=kind).execute()
            edits.images().upload(packageName=args.package, editId=edit_id, language=default,
                                  imageType=kind,
                                  media_body=MediaFileUpload(str(path), mimetype="image/png")).execute()
            print(f"  {kind} ({default})")

        for locale, files in v["shots"].items():
            edits.images().deleteall(packageName=args.package, editId=edit_id,
                                     language=locale, imageType="phoneScreenshots").execute()
            for f in files:
                edits.images().upload(packageName=args.package, editId=edit_id, language=locale,
                                      imageType="phoneScreenshots",
                                      media_body=MediaFileUpload(str(f), mimetype="image/png")).execute()
            print(f"  {len(files)} screenshots ({locale})")

        if version_code:
            edits.tracks().update(packageName=args.package, editId=edit_id, track=args.track, body={
                "releases": [{
                    "name": args.release_name,
                    "versionCodes": [str(version_code)],
                    "status": "completed",
                    "releaseNotes": [{"language": loc, "text": args.release_notes}
                                     for loc in v["listing"]],
                }],
            }).execute()
            print(f"  track {args.track} <- versionCode {version_code}")

        edits.commit(packageName=args.package, editId=edit_id).execute()
        print("committed")
    except Exception:
        # never leave a half applied listing behind
        try:
            edits.delete(packageName=args.package, editId=edit_id).execute()
            print("edit abandoned, nothing was changed")
        except Exception:
            pass
        raise


def main():
    ap = argparse.ArgumentParser(description="Publish Xurface Discern to Google Play")
    ap.add_argument("--package", default=PACKAGE)
    ap.add_argument("--aab", help="path to the signed App Bundle")
    ap.add_argument("--track", default="internal", choices=["internal", "alpha", "beta", "production"])
    ap.add_argument("--creds", help="service account key or external_account config")
    ap.add_argument("--default-language", default="en-US")
    ap.add_argument("--release-name", default="Discern")
    ap.add_argument("--release-notes", default="First release.")
    ap.add_argument("--dry-run", action="store_true", help="validate only, no network")
    ap.add_argument("--status", action="store_true", help="report tracks and testers, change nothing")
    ap.add_argument("--testers", help="comma separated Google Group addresses for --track; "
                                      "individual emails are not supported by Play's API")
    ap.add_argument("--listing-only", action="store_true", help="push text and images without a bundle")
    args = ap.parse_args()

    if args.status:
        status(args)
        return
    if args.testers is not None:
        set_testers(args)
        return

    v = validate()
    for w in v["warnings"]:
        print(f"  warning: {w}")
    for e in v["errors"]:
        print(f"  ERROR:   {e}")
    if v["errors"]:
        sys.exit(f"\n{len(v['errors'])} problem(s); nothing was uploaded.")

    counts = ", ".join(f"{loc}:{len(f)}" for loc, f in sorted(v["shots"].items()))
    print(f"\nvalidated: {len(v['listing'])} locales, icon, feature graphic, screenshots [{counts}]")

    if args.dry_run:
        print("dry run, nothing uploaded.")
        return
    if args.listing_only:
        args.aab = None
    elif not args.aab:
        sys.exit("pass --aab, or --listing-only to push text and images alone.")
    publish(args, v)


if __name__ == "__main__":
    main()
