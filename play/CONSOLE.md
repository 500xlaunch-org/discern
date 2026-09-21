# Filling in Play Console

Everything you need is generated and in this repo. Nothing here has to be
written from scratch.

```
play/upload/                      <- drag from here
play/xurface-discern-store-assets.zip   <- or unzip this anywhere
```

Rebuild it any time with `python3 tools/play_bundle.py`.

| | |
|---|---|
| App name | Xurface Discern |
| Package | `com.xurface.discern.app` |
| Default language | English (United States) |
| Category | Productivity |
| Privacy policy | `https://xurface.500xlaunch.com/privacy` |
| Contact email | hello@500xlaunch.com |

---

## 1. Main store listing

**Grow > Store presence > Main store listing**, on English (United States):

| Field | File |
|---|---|
| App name | `upload/en-US/title.txt` |
| Short description | `upload/en-US/short-description.txt` |
| Full description | `upload/en-US/full-description.txt` |
| App icon | `upload/_store/icon-512.png` |
| Feature graphic | `upload/_store/feature-graphic.png` |
| Phone screenshots | all five PNGs in `upload/en-US/`, in number order |

Then **Manage translations > Add your own translation text** for each of the
nine others. Each folder is self contained: three text files and five
screenshots. The icon and feature graphic are shared across languages, so they
are uploaded once, on English.

`zh-CN  hi-IN  es-ES  fr-FR  ar  pt-BR  ru-RU  ja-JP  de-DE`

The five screenshots are the same story in every language: the inbox of actions
waiting on you, the permission label before you connect, your per category
limits, the audit record, and settings.

---

## 2. App content

**Policy > App content.** This is the part that actually blocks a release.

### Privacy policy
`https://xurface.500xlaunch.com/privacy` (live now, returns 200).

### Ads
**No**, the app contains no ads. There is no ad SDK in the build.

### App access
The app requires sign in, so reviewers need a way in. Choose **All or some
functionality is restricted** and add one instruction:

> Name: Sign in
> Instructions: On the sign in screen, enter any name and any email address,
> then tap Continue. No password, code or email confirmation is required.
> To see the app with content, tap Solutions and connect one of the listed
> solutions; actions needing a decision then appear under Discern.

### Content rating
Start the questionnaire. Category **Utility, Productivity, Communication or
Other**. Every content question is No: no violence, no sexual content, no
profanity, no controlled substances, no gambling, no user generated content
shared between users, no unrestricted internet access. Expect **Everyone**.

### Target audience
**18 and over.** The app is a control surface for business automation. Choosing
18+ keeps it out of the Families policy, which would otherwise require extra
declarations it does not need.

### Data safety
Answer as follows. It matches `www/privacy.html` exactly; do not improvise here,
because a mismatch between this form and the policy is a common rejection.

Does your app collect or share any of the required user data types? **Yes**
Is all of the user data collected by your app encrypted in transit? **Yes**
Do you provide a way for users to request that their data is deleted? **Yes**

Collected data types:

| Type | Collected | Shared | Required | Purpose |
|---|---|---|---|---|
| Personal info > Email address | Yes | No | Required | Account management, App functionality |
| Personal info > Name | Yes | No | Optional | App functionality |
| App activity > Other actions | Yes | No | Required | App functionality |
| Device or other IDs | Yes | No | Optional | App functionality |

Notes for the two that need judgement:

- **App activity > Other actions** is the record of what agents proposed and
  what you decided. That record is the product, so it is required.
- **Device or other IDs** is the push subscription the browser or OS issues.
  It is optional because it only exists if you turn notifications on.

Everything else is **not collected**: no location, contacts, photos, files,
calendar, messages, health, financial info, contacts, search history, installed
apps, or advertising ID. No data is shared with any third party. No data is
processed ephemerally for analytics, because there is no analytics SDK.

### Government apps, financial features, health
**No** to all. The app does not provide financial services; it records
decisions about actions other software proposes to take.

---

## 3. Store settings

**Grow > Store presence > Store settings**

- App category: **Productivity**
- Tags: pick up to five, for example Productivity, Security, Utilities
- Contact details: `hello@500xlaunch.com`, `https://xurface.500xlaunch.com`
- External marketing: your choice

---

## 4. The build

You do not build this on a laptop; there is no Android toolchain there and there
does not need to be.

**Actions > Android > Run workflow**, with Publish off the first time. It builds
the signed bundle on a runner that already has JDK 21 and SDK 35, validates the
listing, and attaches `app-release.aab` to the run. Download it and upload by
hand under **Testing > Internal testing > Create new release**.

Once the credential in `play/README.md` is set up, run the same workflow with
Publish on, or push a tag, and it does the upload and the listing for you.

The four signing secrets are already set on the repository, and the Play
credential is federated, so nothing else has to be configured.

The upload key was generated as PKCS12 (macOS ships a keytool stub with no JDK
behind it, so `cryptography` built it, the same way Edger does):

```
keystore  ~/.config/github-automation-agent/xurface-discern-upload.p12
password  ~/.config/github-automation-agent/xurface-discern-upload.txt
alias     upload
valid to  2054-02-06
SHA-256   D2:13:FE:8D:2E:48:A8:9B:26:65:80:DE:F3:F4:DD:83:ED:5F:B6:15:04:47:52:59:61:1C:6D:26:7C:A7:10:89
```

**Back that keystore up somewhere off this machine.** Google holds the real app
signing key under Play App Signing, so losing the upload key is recoverable, but
only through a Play support round trip. The two files are the only copies.

---

## Two things to decide before a public release

Neither blocks internal testing, both block production.

**Sign in is not real authentication yet.** Any email address signs you in, with
no verification. That is fine for a closed test and is what the reviewer
instructions above describe, but it must become a real magic link or passkey
before anyone outside your testers uses it.

**Notifications do not work in the native build yet.** The web app has full Web
Push, encrypted end to end. The Android shell would need Firebase and a
`google-services.json` for native delivery. Until then the Settings screen
honestly reports that this device cannot receive push. That is also why the
manifest requests no notification permission: declaring one the app does not use
is a review risk.
