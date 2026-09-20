# Xurface Discern

**Approve, edit or deny the critical actions AI agents take on your behalf.** The
phone (and tablet, and laptop) side of [Xurface Horizon](https://xurface.500xlaunch.com):
when an agent's action exceeds what you tolerate, Horizon holds it and pushes it
here, and you decide.

> Beyond human in the loop. Human on the go.

One web app, shipped native to every platform:

| Platform | Form factors | Built with |
|---|---|---|
| **Android** (first) | phone, tablet | Capacitor |
| **Apple** | iPhone, iPad, macOS | Capacitor (iOS/iPadOS) + Electron (macOS) |
| **Windows** | laptop, tablet, phone | Electron |

## Try it now (web)

The app runs as a plain web app you can try in a browser, with a **device
simulator** to preview it as any platform and screen size:

- Hosted preview: **https://claude.ai/artifact/9n8CAaNbb6N4DqQ4BBtGff**
- Or locally: `npm run serve` (opens `www/index.html` on :5173)

Pick a platform (Apple / Android / Windows) and a device (phone / tablet /
laptop) in the top bar, open **Examples**, run one, and approve or deny the cards
that arrive. It opens in a working state with two example cards already waiting.

## Two environments: Demo, Test, Live

Switch environment in the top bar or in Settings, so you can build and test
safely before rollout:

- **Demo** - a self-contained mock Horizon (with the real risk-scoring model)
  and the example solutions baked in. No network. This is what the web preview
  runs.
- **Test** - connects to the Horizon **test** environment
  (`https://test.xurface.500xlaunch.com`). Ship an agent, watch its real cards
  arrive here, tune appetites - without touching production.
- **Live** - connects to Horizon **live** (`https://xurface.500xlaunch.com`).

Horizon runs both a test and a live environment inside production; the app points
at whichever you select. (Connected modes reach real Horizon from the hosted or
installed app; the browser preview's sandbox keeps it in Demo.)

## What's in the app

- **Discern** - the inbox of held actions. Each card shows the solution, the
  agent, what it wants to do, why it was held (the risk categories and reasons),
  and the exact arguments - which you can edit before approving. SEVERE actions
  require a biometric.
- **Activity** - a signed, traceable record of every action, allowed or not.
- **Solutions** - the agents acting for you; set a per-category discernment
  **appetite** (LOW / MEDIUM / HIGH / SEVERE), or pause a solution entirely.
- **Examples** - run BattleMate, FreeLeap, a coding agent or a finance assistant
  and watch the loop happen.

## Build the native apps

Prereqs: Node 20+. For Android: JDK 21 + Android SDK. For iOS/macOS: Xcode.

```bash
npm install

# Android (first): generate the project, then build a debug APK
npm run cap:add:android
npm run android:apk           # android/app/build/outputs/apk/debug/*.apk
# a release AAB for Google Play:
npm run android:aab

# iOS / iPadOS
npm run cap:add:ios && npx cap open ios     # build + run in Xcode

# Windows / macOS desktop (Electron)
cd electron && npm install
npm run dist:win              # NSIS installer
npm run dist:mac              # dmg
```

CI builds a debug APK on every push (`.github/workflows/android.yml`), ready to
wire into the Google Play ship lane.

## Layout

```
www/            the app - one responsive UI + a mock Horizon (real scoring model)
  index.html    full document (Capacitor / Electron / hosting)
  artifact.html body-only entry (for the hosted web preview)
  styles.css    design system (Xurface palette + severity + device simulator)
  app.js        screens, the mock backend, the example runners, the device sim
capacitor.config.json   Android + iOS wrap
electron/       Windows + macOS desktop wrap
```

The web app carries no build step and no runtime dependencies; the native shells
load the same `www/`. Real Horizon calls (Test/Live) use the same consumer API
the SDK's `XurfaceConsumer` speaks.

A product of 500xLaunch. Built on Xurface Horizon.
