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

The listing ships on its own, not as part of a release. Any change to the copy,
the screenshots, the icon or the feature graphic on `main` publishes itself
through the **Store listing** workflow, usually inside a minute. Releases push
the listing too, and both queue behind one lane because Play allows a single
open edit per app.

Regenerate the images and text after a UI change:

```bash
python3 tools/brand.py                       # icons, splash, store graphics
LANGS=en,zh,hi,es,fr,ar,pt,ru,ja,de \
  node tools/screenshots.mjs                 # raw captures, needs a local Horizon
node tools/frames.mjs                        # headline + brand frame -> play/framed
python3 play/publish.py --dry-run            # validates against Play's rules
```

`play/screenshots/` holds the raw captures and `play/framed/` the store versions:
the same capture on the brand gradient with a headline above it, in that
language. The publisher uploads `framed` when it exists and falls back to the
raw captures otherwise, so a missing frame degrades rather than breaks.

Framing is rendered in a browser, not drawn with Pillow. Pillow here has no
raqm, so Arabic would come out as disconnected letterforms and Devanagari would
lose its conjuncts. A browser shapes every script correctly and handles right to
left, which is the whole reason the captions are worth having.

`--dry-run` checks every character limit, every image dimension, the 2:1 aspect
cap, the 2 to 8 screenshots per language rule, and that no long dash slipped into
the copy. It catches what Play would otherwise reject after the upload.

## App identity

| | |
|---|---|
| package | `com.xurface.discern.app` |
| min / target SDK | 23 / 36 |
| default language | en-US |
| privacy policy | `https://xurface.500xlaunch.com/privacy` |

The package name is permanent. It is deliberately not under `com.edger`: Discern
is a Xurface product, and a package cannot be changed after the first upload.

## Target API level

Google Play requires new apps and updates to target Android 16 (API 36) as of
31 August 2026, and raises the bar every August. Capacitor 7 generates 35, and
`cap add` regenerates `variables.gradle`, so the workflow rewrites it from the
`ANDROID_TARGET_SDK` env var rather than committing the value.

Targeting too low is rejected at commit time with a message that reads oddly:
`Target SDK of artifact is too low: 13`, where 13 is the artifact's versionCode,
not an API level.

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

**Live as of 2026-09-21.** CI publishes keyless: GitHub mints a short lived OIDC
token, Google trades it for a Play scoped access token. Nothing is stored, so
nothing can leak.

```
pool      edger-pool           (shared with Edger, by the owner's decision)
provider  github               federated to token.actions.githubusercontent.com
identity  edger-851@project-99519918-c6a0-4f30-bb0.iam.gserviceaccount.com
scope     assertion.repository == 500xlaunch-org/discern
```

Repository variables (not secrets, neither is sensitive) are already set:

```
GCP_WIF_PROVIDER = projects/973696140732/locations/global/workloadIdentityPools/edger-pool/providers/github
GCP_PLAY_SA      = edger-851@project-99519918-c6a0-4f30-bb0.iam.gserviceaccount.com
```

The `attribute-condition` is what makes this safe to share: only this repository
can assume the identity, so a fork cannot, and neither can any other repo in the
org.

Because the identity is shared with Edger, **Play Console is where the two
products stay apart**. Invite the service account under **Users and permissions**
and grant **Release to testing tracks on this app only**, never account wide.
Account wide access would let this pipeline touch Talka's listings.

If you later want full separation, create a `xurface-play` service account in a
`xurface-pool` and repoint the two variables; nothing else changes. The commands
are the same as below with those two names substituted.

### There was never a key to inherit

Edger's account was set up keyless because the org enforces
`iam.disableServiceAccountKeyCreation`. What Edger stores is an
`external_account` config: a pointer to a projected token file that exists only
inside the cluster its pool is federated to. Off that cluster it authenticates
as nobody, and Google answers `invalid_grant: Error connecting to the given
credential's issuer`. Federating GitHub as a second issuer is the fix; looking
for a key is not.

### How the setup was done

```bash
PROJECT_ID=project-99519918-c6a0-4f30-bb0
POOL=edger-pool
SA=edger-851@$PROJECT_ID.iam.gserviceaccount.com
REPO=500xlaunch-org/discern
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')

gcloud iam workload-identity-pools providers create-oidc github \
  --project="$PROJECT_ID" --location=global --workload-identity-pool="$POOL" \
  --display-name="GitHub Actions" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository=='$REPO'"

gcloud iam service-accounts add-iam-policy-binding "$SA" \
  --project="$PROJECT_ID" \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$POOL/attribute.repository/$REPO"
```

A note on flags, because the error is unhelpful: `--project` takes the project
ID, while a `principalSet://` string always takes the project number. Making
them consistent gives a binding that reads correctly and grants nothing.

### If you would rather use a key

Your org policy currently forbids creating one. Relaxing
`iam.disableServiceAccountKeyCreation` to issue a long lived credential, then
pasting it into a CI secret, is a real step backwards from the above. If you do
it anyway, put the JSON in the `PLAY_SERVICE_ACCOUNT` secret and the workflow
will use it.

### One off, by hand

`publish.py` also takes `PLAY_ACCESS_TOKEN`, so a token minted anywhere the
federation does work can be pasted in for a single release.

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
