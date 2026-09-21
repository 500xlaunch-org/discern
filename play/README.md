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

There is no service account key to find. The Play service account
`edger-851@project-99519918-c6a0-4f30-bb0.iam.gserviceaccount.com` was set up
keyless on purpose: the GCP org enforces `iam.disableServiceAccountKeyCreation`,
so a downloadable key was never created for it. What exists is an
`external_account` config, which is a pointer rather than a secret: it names a
projected token file that only exists inside the cluster its pool is federated
to. Off that cluster it authenticates as nobody, and Google answers
`invalid_grant: Error connecting to the given credential's issuer`.

The fix is not to find a key. It is to federate a second issuer: GitHub.

### One time setup, keyless (recommended)

Run as someone with IAM admin on the GCP project. It adds a provider beside the
existing AKS one and changes nothing about Edger.

gcloud wants the project **ID** for `--project`, but a workload identity
principal is always addressed by project **number**. Both appear below and they
are not interchangeable: swapping either one produces a command that looks right
and grants nothing.

```bash
PROJECT_ID=project-99519918-c6a0-4f30-bb0     # --project flags
PROJECT_NUMBER=973696140732                   # principal strings, never the ID
POOL=edger-pool                               # reuse the existing pool
SA=edger-851@$PROJECT_ID.iam.gserviceaccount.com
REPO=500xlaunch-org/discern

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

If the pool name is wrong the first command fails immediately. Check it with:

```bash
gcloud iam workload-identity-pools list --project="$PROJECT_ID" --location=global
```

The `attribute-condition` is the part that matters: only this repository can
assume the identity. A fork or another repo cannot.

Then set two repository **variables** (not secrets, neither is sensitive):

```bash
gh variable set GCP_WIF_PROVIDER -R 500xlaunch-org/discern \
  -b "projects/973696140732/locations/global/workloadIdentityPools/edger-pool/providers/github"
gh variable set GCP_PLAY_SA -R 500xlaunch-org/discern \
  -b "edger-851@project-99519918-c6a0-4f30-bb0.iam.gserviceaccount.com"
```

Finally, in Play Console under Users and permissions, give that service account
"Release to testing tracks" on the app.

Nothing is stored anywhere. GitHub mints a token that lives for minutes, GCP
trades it for an access token scoped to the Play API alone.

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
