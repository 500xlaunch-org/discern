# Google Play release

Everything in this folder is generated and checked in, so a release is data plus
one command rather than an afternoon in the Console.

```
listing.i18n.json      title, short and full description in 10 languages
icon-512.png           store icon
feature-graphic.png    1024x500 banner
screenshots/<lang>/    5 phone screenshots per language, 1080x1920
publish.py             the publisher, with a --dry-run that validates first
```

Regenerate the images and text after a UI change:

```bash
python3 tools/brand.py                       # icons, splash, store graphics
LANGS=en,zh,hi,es,fr,ar,pt,ru,ja,de \
  node tools/screenshots.mjs                 # needs a Horizon running locally
python3 play/publish.py --dry-run            # validates against Play's rules
```

`--dry-run` checks every character limit, every image dimension, the 2:1 aspect
cap, the 2 to 8 screenshots per language rule, and that no long dash slipped into
the copy. It catches what Play would otherwise reject after the upload.

## App identity

| | |
|---|---|
| package | `com.xurface.discern.app` |
| min / target SDK | 23 / 35 |
| default language | en-US |
| privacy policy | `https://xurface.500xlaunch.com/privacy` |

The package name is permanent. It is deliberately not under `com.edger`: Discern
is a Xurface product, and a package cannot be changed after the first upload.

## What is still a human step

Two things, and neither can be automated.

**1. Create the app entry.** The Play Developer API has no "create app" call. In
Play Console, create an app with the package `com.xurface.discern.app`, then complete
the Console-only questionnaires: content rating, target audience, data safety,
and the app category. The privacy policy above answers the data safety form:
the app collects an email address, a push subscription, and the record of the
actions you decided on; it collects no location, contacts, photos or advertising
identifier, and shares nothing with third parties.

**2. Grant release permission.** Give the publishing identity the "Release to
testing tracks" permission in Play Console under Users and permissions.

## Authentication

`publish.py` accepts, in order: `--creds` (a service account key or an
`external_account` config), `GOOGLE_APPLICATION_CREDENTIALS`, or
`PLAY_ACCESS_TOKEN` for an already minted token.

A note on Workload Identity Federation, since it is easy to lose a day to this.
An `external_account` config is a pointer, not a secret. Its `credential_source`
names a projected token file that exists only inside the cluster the pool is
federated to. Handing that JSON to a laptop or to a different cluster does not
grant anything: the token file is absent, and even with a token the provider
only trusts its own issuer, which must be reachable for Google to fetch its
JWKS. `publish.py` detects this case and says so rather than failing with an
opaque `invalid_grant`.

So pick one:

- **CI with a key.** Put a service account key in the `PLAY_SERVICE_ACCOUNT`
  secret. Simplest, if org policy allows key creation.
- **CI keyless.** Add a WIF provider for GitHub's OIDC issuer and grant it
  `roles/iam.workloadIdentityUser` on the publishing service account.
- **From the workload.** Run `publish.py` inside the federated cluster, where
  the projected token exists.

## Releasing

Push a tag, or run the Android workflow by hand:

```bash
git tag v0.1.0 && git push --tags
```

The workflow builds the signed bundle on a runner that already has JDK 21 and
SDK 35, validates the listing, attaches the AAB to the run, and publishes when a
credential is present. Without one it still produces a bundle you can upload by
hand, so a missing secret never blocks a build.

`versionCode` comes from the run number: it only ever increases, and a code is
never reused, which Play requires.
