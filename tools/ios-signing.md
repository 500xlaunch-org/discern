# Signing Discern for the App Store

Done once per Mac, all outside git, all in `~/.config/github-automation-agent/` (mode 600):

| File | What |
|---|---|
| `apple.env` | `ASC_ISSUER_ID`, `ASC_KEY_ID`, `APPLE_TEAM_ID` |
| `AuthKey_<ASC_KEY_ID>.p8` | App Store Connect API key (team key, App Manager or Admin) |
| `ios-distribution.key` | private key of the Apple Distribution certificate |
| `ios-keychain.pw` | password of `discern-build.keychain`, which holds that identity |

In App Store Connect (made through the API on 2026-10-06):

- bundle ID `com.xurface.discern.app` (id `7Q6798T2C8`), Push Notifications on
- certificate Apple Distribution, id `37JNAR97SB`, expires 2027-10-05
- profile `Discern App Store` (IOS_APP_STORE), id `J4WK37NM6R`, installed in
  `~/Library/MobileDevice/Provisioning Profiles/`

Why manual: automatic signing first asks for a development profile, which needs
a registered iPhone; and a profile set on the command line is refused by the
Swift packages' resource bundles. `ios-release.sh` therefore sets the profile on
the app target's Release configuration only.

When the certificate expires: make a new CSR from `ios-distribution.key`, create
a DISTRIBUTION certificate and a new IOS_APP_STORE profile with the API, import
the certificate into `discern-build.keychain`, and install the profile.

The app record itself cannot be created through the API: App Store Connect,
Apps, "+", New App, bundle ID `com.xurface.discern.app`.
