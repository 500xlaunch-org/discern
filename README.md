<h1 align="center">Xurface Discern</h1>

<p align="center">
  <b>Approve, edit or deny the critical actions AI agents take on your behalf.</b><br/>
  <i>Beyond human in the loop. Human on the go.</i>
</p>

<p align="center">
  <a href="https://xurface.500xlaunch.com/app"><img alt="Try the live app" src="https://img.shields.io/badge/try_the_live_app-xurface.500xlaunch.com%2Fapp-3B6EA3.svg"></a>
  <img alt="Android · iOS · macOS · Windows" src="https://img.shields.io/badge/Android_·_iOS_·_macOS_·_Windows-one_codebase-1f9d57.svg">
  <img alt="Capacitor + Electron" src="https://img.shields.io/badge/Capacitor_+_Electron-web--first-60A5FA.svg">
</p>

<p align="center">
  <img src="docs/assets/discern-app.png" width="360" alt="Xurface Discern - the discernment inbox" />
</p>

The phone (and tablet, and laptop) side of [Xurface Horizon](https://xurface.500xlaunch.com):
when an agent's action exceeds what you tolerate, Horizon holds it and pushes it here,
and you decide. One inbox for every agent, from every developer.

## Try it now

**The real, connected app: https://xurface.500xlaunch.com/app** (opens on the Test
environment). Sign in, browse the solutions from 500xLaunch, connect one, and
approve or deny what it wants to do - live against Horizon.

Locally: `npm run serve` opens `www/index.html`; point it at a Horizon with
`?api=` or serve it from Horizon at `/app`. The top bar has a **device simulator**
(Apple / Android / Windows x phone / tablet / laptop) so you can preview any
screen size, and `Fill screen` to drop the frame.

## Two environments: Test and Live

Switch in the top bar or Settings. Horizon runs both a **Test** and a **Live**
environment inside production, isolated by the `x-xurface-env` header, so you
build and try safely before rolling out. Same account, separate data and audit.

## What's in the app

- **Discern** - the inbox of held actions. Each card shows the solution, the
  agent, what it wants to do, why it was held, and the exact arguments (editable
  before you approve). SEVERE actions require a biometric.
- **Activity** - a signed, traceable record of every action, allowed or not.
- **Solutions** - the solutions acting for you (set a per-category discernment
  appetite or pause one), and a **From 500xLaunch** catalog you connect in a tap.

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
