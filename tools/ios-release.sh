#!/usr/bin/env bash
# Build, sign and upload Discern for iPhone to App Store Connect, from a Mac.
#
#   tools/ios-release.sh            # archive, sign, upload to TestFlight
#   tools/ios-release.sh --build    # archive and export only, no upload
#
# What it needs, once, from the Apple Developer account (all outside git):
#
#   APPLE_TEAM_ID      the 10 character team id (Membership details)
#   ASC_KEY_ID         an App Store Connect API key (Users and Access, Integrations,
#   ASC_ISSUER_ID      Team keys, role App Manager). The .p8 downloads once.
#   ASC_KEY_PATH       defaults to ~/.config/github-automation-agent/AuthKey_<ASC_KEY_ID>.p8
#
# Read from ~/.config/github-automation-agent/apple.env if present, so nothing
# is typed into a shell history.
#
# Signing is automatic: with the API key, xcodebuild creates and renews the
# certificate and the provisioning profile itself (-allowProvisioningUpdates),
# including the Push Notifications capability the entitlements ask for. The app
# record (bundle id com.xurface.discern.app) must exist in App Store Connect
# before the first upload.
#
# The build number is a timestamp, so it only ever rises, as Apple requires.
set -euo pipefail
HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
CFG=${XURFACE_SECRETS:-$HOME/.config/github-automation-agent}
[ -f "$CFG/apple.env" ] && . "$CFG/apple.env"
: "${APPLE_TEAM_ID:?set APPLE_TEAM_ID (see the header of this script)}"
: "${ASC_KEY_ID:?set ASC_KEY_ID}"
: "${ASC_ISSUER_ID:?set ASC_ISSUER_ID}"
ASC_KEY_PATH=${ASC_KEY_PATH:-$CFG/AuthKey_${ASC_KEY_ID}.p8}
[ -f "$ASC_KEY_PATH" ] || { echo "no API key at $ASC_KEY_PATH"; exit 1; }

UPLOAD=1; [ "${1:-}" = "--build" ] && UPLOAD=0
VERSION=$(node -e "console.log(require('$HERE/package.json').version)")
BUILD=$(date -u +%Y%m%d%H%M)
OUT=$HERE/ios/build; rm -rf "$OUT"; mkdir -p "$OUT"
AUTH=(-allowProvisioningUpdates -authenticationKeyPath "$ASC_KEY_PATH"
      -authenticationKeyID "$ASC_KEY_ID" -authenticationKeyIssuerID "$ASC_ISSUER_ID")

echo "==> Discern for iPhone $VERSION ($BUILD)"
cd "$HERE"
npm test
# ios/ is generated; the push setup and the icons are applied over it
[ -d ios ] || PATH="$HERE/tools/.podless:$PATH" npx cap add ios --packagemanager SPM || true
npx cap sync ios
# the icons need Pillow; a private venv keeps it out of the system Python
PY=python3
if ! python3 -c "import PIL" 2>/dev/null; then
  [ -x tools/.venv/bin/python ] || { python3 -m venv tools/.venv && tools/.venv/bin/pip -q install pillow; }
  PY=tools/.venv/bin/python
fi
$PY tools/native.py --ios --aps production
$PY tools/brand.py --only ios

# Release is signed for the App Store by the app target alone: automatic
# signing wants a registered iPhone first, and a profile set for the whole
# build is refused by the Swift packages' resource bundles. The distribution
# identity lives in a keychain of its own (made once, see tools/ios-signing.md).
PROFILE=${IOS_PROFILE:-Discern App Store}
python3 - "$PROFILE" "$APPLE_TEAM_ID" <<'PY'
import re, sys
p = "ios/App/App.xcodeproj/project.pbxproj"; s = open(p).read()
prof, team = sys.argv[1], sys.argv[2]
def fix(m):
    b = m.group(0)
    if "PRODUCT_BUNDLE_IDENTIFIER = com.xurface.discern.app;" not in b or "name = Release;" not in b: return b
    b = b.replace("CODE_SIGN_STYLE = Automatic;", "CODE_SIGN_STYLE = Manual;")
    if "PROVISIONING_PROFILE_SPECIFIER" not in b:
        b = b.replace("CODE_SIGN_STYLE = Manual;", f'CODE_SIGN_STYLE = Manual;\n\t\t\t\tCODE_SIGN_IDENTITY = "Apple Distribution";\n\t\t\t\tPROVISIONING_PROFILE_SPECIFIER = "{prof}";\n\t\t\t\tDEVELOPMENT_TEAM = {team};')
    return b
s = re.sub(r"\t\t[0-9A-F]{24} /\* Release \*/ = \{.*?\n\t\t\};", fix, s, flags=re.S)
open(p, "w").write(s)
print("  project.pbxproj: the app target signs Release with", prof)
PY
# the notification service, so a push shows its picture (tools/ios-nse.rb)
NSE_PROFILE=${IOS_NSE_PROFILE:-Discern Notification Service App Store}
ruby tools/ios-nse.rb "$APPLE_TEAM_ID" "$NSE_PROFILE"
KC_PW="$CFG/ios-keychain.pw"
[ -f "$KC_PW" ] && security unlock-keychain -p "$(cat "$KC_PW")" discern-build.keychain

echo "==> archive"
LOG=$OUT/archive.log
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release \
  -destination 'generic/platform=iOS' -archivePath "$OUT/Discern.xcarchive" \
  MARKETING_VERSION="$VERSION" CURRENT_PROJECT_VERSION="$BUILD" \
  archive > "$LOG" 2>&1 || { grep -E "error:" "$LOG" | sort -u | head -20; echo "archive failed, full log: $LOG"; exit 1; }
tail -1 "$LOG"

cat > "$OUT/ExportOptions.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>method</key><string>app-store-connect</string>
  <key>teamID</key><string>$APPLE_TEAM_ID</string>
  <key>signingStyle</key><string>manual</string>
  <key>signingCertificate</key><string>Apple Distribution</string>
  <key>provisioningProfiles</key><dict><key>com.xurface.discern.app</key><string>$PROFILE</string><key>com.xurface.discern.app.NotificationService</key><string>$NSE_PROFILE</string></dict>
  <key>destination</key><string>$([ $UPLOAD = 1 ] && echo upload || echo export)</string>
  <key>uploadSymbols</key><true/>
  <key>manageAppVersionAndBuildNumber</key><false/>
</dict></plist>
EOF

echo "==> export$([ $UPLOAD = 1 ] && echo ' and upload to App Store Connect')"
xcodebuild -exportArchive -archivePath "$OUT/Discern.xcarchive" \
  -exportOptionsPlist "$OUT/ExportOptions.plist" -exportPath "$OUT/export" "${AUTH[@]}" | tail -5

if [ $UPLOAD = 1 ]; then
  echo "Uploaded $VERSION ($BUILD). It appears in TestFlight once Apple has processed it, usually within 15 minutes."
else
  ls -la "$OUT/export"
fi
