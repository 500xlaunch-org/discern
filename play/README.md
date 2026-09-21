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

Xurface publishes as itself. Edger's service account
(`edger-851@...`) and its `edger-pool` belong to Edger: reusing them would let
one CI pipeline publish both Talka and Discern, and would tie Xurface's release
path to a product that is currently parked. Xurface gets its own identity, its
own pool, and Play access scoped to this app alone.

There is also no key to inherit. Edger's account was set up keyless because the
org enforces `iam.disableServiceAccountKeyCreation`, and what it stores is an
`external_account` config: a pointer to a projected token file that exists only
inside the cluster its pool is federated to. Off that cluster it authenticates
as nobody, and Google answers `invalid_grant: Error connecting to the given
credential's issuer`. The answer is not to find a key. It is to federate GitHub
directly to an identity that belongs to Xurface.

### One time setup, keyless

Run in Cloud Shell. `PROJECT_ID` is the project Play Console is linked to, under
**Setup > API access** in the Console; the project number is derived rather than
typed, which removes the usual ID versus number mistake.

```bash
PROJECT_ID=<the project Play Console is linked to>
POOL=xurface-pool
SA_NAME=xurface-play
REPO=500xlaunch-org/discern

SA="$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com"
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')

# Xurface's own publishing identity
gcloud iam service-accounts create "$SA_NAME" \
  --project="$PROJECT_ID" --display-name="Xurface Play publisher"

# Xurface's own pool, federated to GitHub
gcloud iam workload-identity-pools create "$POOL" \
  --project="$PROJECT_ID" --location=global --display-name="Xurface CI"

gcloud iam workload-identity-pools providers create-oidc github \
  --project="$PROJECT_ID" --location=global --workload-identity-pool="$POOL" \
  --display-name="GitHub Actions" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository=='$REPO'"

# only this repository may assume that identity
gcloud iam service-accounts add-iam-policy-binding "$SA" \
  --project="$PROJECT_ID" \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$POOL/attribute.repository/$REPO"

echo "GCP_WIF_PROVIDER = projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$POOL/providers/github"
echo "GCP_PLAY_SA      = $SA"
```

The `attribute-condition` is the part that matters: only this repository can
assume the identity, so a fork cannot.

Set the two values it prints as repository **variables**, not secrets, since
neither is sensitive:

```bash
gh variable set GCP_WIF_PROVIDER -R 500xlaunch-org/discern -b "<first line>"
gh variable set GCP_PLAY_SA      -R 500xlaunch-org/discern -b "<second line>"
```

Finally, in Play Console under **Users and permissions**, invite that service
account address and grant it **Release to testing tracks** on **this app only**,
not account wide. Federation only gets CI as far as authenticating; without the
Play grant the API authenticates and then refuses with a 403.

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
