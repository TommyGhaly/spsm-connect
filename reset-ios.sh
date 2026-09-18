#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

# Regenerate ios/ from scratch, install pods, and check that every plugin
# actually landed.
#
# `ios/` is gitignored generated output. Everything this project adds on top of
# a stock `expo prebuild` lives in config plugins, so a plain prebuild produces
# the same project this does — what this script adds is the parts a plugin
# cannot do: wiping state, running pods, and *verifying*.
#
# The verification is the point. Every check below guards something that fails
# silently: the project still builds, and breaks later in a way that does not
# point back here. Written after finding ios/ carrying an associated-domains
# list a day older than app.config.ts — a clip that could never have validated,
# with nothing on screen to say so.
#
# What the plugins do, so it is findable from here:
#   withNativeClip            the whole SPSMConnectClip target — a native
#                             SwiftUI clip that links no pods, from the sources
#                             in ios-appclip/
#   withSquareSetupPhaseOrder moves Square's `setup` phase after [CP] Embed Pods
#                             Frameworks, without which a Release build dies at
#                             launch under dyld with no crash report
#
# Usage:
#   ./reset-ios.sh              sandbox Square — for development
#   ./reset-ios.sh --store      production Square — for an archive you will upload

fail() { echo "   ✗ $1" >&2; exit 1; }
note() { echo "   · $1"; }

# ── Which Square ─────────────────────────────────────────────────────────────
#
# Never defaulted off anything. app.config.ts defaults to the sandbox precisely
# so that no ordinary build can charge the church's live account, and this
# script must not quietly undo that. `--store` is the only way to production and
# it says so on every run.
STORE_BUILD=0
if [ "${1:-}" = "--store" ]; then
  STORE_BUILD=1
  export SQUARE_ENV=production
fi

if [ "$STORE_BUILD" = "1" ]; then
  echo "→ Square: PRODUCTION — this build can take real money"
else
  echo "→ Square: sandbox (pass --store for a build you will upload)"
fi

# CocoaPods requires a UTF-8 locale. An interactive Terminal usually has one; a
# script invoked by an editor or a task runner often does not, and pod install
# then dies with `Unicode Normalization not appropriate for ASCII-8BIT`, which
# names neither CocoaPods nor the locale.
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8

echo "→ Closing Xcode"
osascript -e 'quit app "Xcode"' 2>/dev/null || true
sleep 2

echo "→ Wiping ios/"
rm -rf ios

echo "→ Running prebuild"
npx expo prebuild --platform ios --no-install

echo "→ Clearing build cache (keeps the index, so Xcode opens fast)"
# Narrow on purpose: wiping all of DerivedData takes Index.noindex with it and
# forces a multi-minute re-index on open. This clears the two things that
# actually cause phantom errors.
rm -rf ~/Library/Developer/Xcode/DerivedData/SPSMConnect-*/Build
rm -rf ~/Library/Developer/Xcode/DerivedData/ModuleCache.noindex

echo "→ Pod install"
# Retried, because the failure it guards against is not ours and not persistent:
# resolution fetches a few hundred podspecs from the CocoaPods CDN in parallel,
# and under that fan-out one connection intermittently dies mid-stream. A plain
# retry almost always succeeds — but `set -e` turned one dropped connection into
# an aborted run that left ios/ populated with no .xcworkspace, which looks like
# this script is broken rather than like the network blipped.
pod_install() {
  local attempt
  for attempt in 1 2 3; do
    if [ "$attempt" -eq 1 ]; then
      ( cd ios && pod install --repo-update ) && return 0
    else
      echo "   … pod install failed (attempt $((attempt - 1))), retrying"
      ( cd ios && pod install ) && return 0
    fi
  done
  fail "pod install failed 3 times. If every attempt printed a CDN/HTTP2 error, the CocoaPods CDN is having a bad day — run this again. Any other error is real and the output above is the one to read."
}
pod_install

# ── Verify ───────────────────────────────────────────────────────────────────

echo "→ Verifying"

PBX=ios/SPSMConnect.xcodeproj/project.pbxproj
APP_ENT=ios/SPSMConnect/SPSMConnect.entitlements
CLIP_ENT=ios/SPSMConnectClip/SPSMConnectClip.entitlements

test -f ios/SPSMConnect/GoogleService-Info.plist \
  || fail "GoogleService-Info.plist missing from ios/SPSMConnect — check ios.googleServicesFile in app.config.ts. Firebase would fail on the first call."

grep -q "SPSMConnectClip" "$PBX" \
  || fail "SPSMConnectClip target missing from the Xcode project — react-native-app-clip did not apply."

grep -q "Embed App Clips" "$PBX" \
  || fail "Embed App Clips build phase missing — the clip would not ship inside the app."

grep -q "appattest-environment" "$CLIP_ENT" \
  || fail "App Attest entitlement missing from the clip's entitlements — withNativeClip did not stamp it. Sending a photograph from the clip would fail for a reason that looks like App Check being broken."

# ── The `www.` check ─────────────────────────────────────────────────────────
#
# The apex answers 301 to the www host for every path, `.well-known/` included,
# and **Apple follows no redirect** either for an invocation URL or when
# fetching the association file. An entitlement naming the apex is an
# association that can never validate: the tag opens Safari, the clip never
# appears, and nothing anywhere reports an error.
#
# Checked on both targets and in both directions — present with `www.`, absent
# without — because the failing case is a *bare* apex entry sitting beside a
# correct one, which a `grep -q www` alone would pass.
for ent in "$APP_ENT" "$CLIP_ENT"; do
  grep -q "applinks:www.spsmwayland.org" "$ent" \
    || fail "$ent does not claim www.spsmwayland.org. Apple follows no redirect and the apex 301s, so the clip and universal links would silently never work."

  grep -qE '<string>(applinks|appclips):spsmwayland\.org</string>' "$ent" \
    && fail "$ent claims the bare apex spsmwayland.org. It 301s to www for every path and Apple follows no redirect, so that association can never validate. Check associatedDomains in app.config.ts, then rerun this script."
done

# ── Square's setup phase must run AFTER the frameworks are embedded ──────────
#
# The phase guards itself on a file that only exists once [CP] Embed Pods
# Frameworks has run, so ordered before it the phase succeeds having done
# nothing, Square's nested frameworks ship still nested, and the app dies at
# launch under dyld — before any of its own code runs, with no crash report and
# nothing on screen. See plugins/withSquareSetupPhaseOrder.js.
EMBED_LINE=$(grep -n "/\* \[CP\] Embed Pods Frameworks \*/," "$PBX" | head -1 | cut -d: -f1)
SETUP_LINE=$(grep -n "/\* \[CP\] Square In-App Payments SDK Setup \*/," "$PBX" | head -1 | cut -d: -f1)

[ -n "$SETUP_LINE" ] \
  || fail "Square's setup build phase is missing from the app target. A Release build would die at launch under dyld."

[ -n "$EMBED_LINE" ] \
  || fail "[CP] Embed Pods Frameworks is missing — pod install did not finish."

[ "$SETUP_LINE" -gt "$EMBED_LINE" ] \
  || fail "Square's setup phase runs BEFORE [CP] Embed Pods Frameworks (lines $SETUP_LINE vs $EMBED_LINE). withSquareSetupPhaseOrder did not apply, and the Release build will die at launch with no crash report."

# ── The clip must link no pods at all ────────────────────────────────────────
#
# The clip is native SwiftUI and links nothing. That is not a preference: the
# React Native clip measured 61 MB against a 15 MB limit, and the framework that
# produced its first rejection — Square's, with its nested bundles — arrived
# because the clip inherited the app's Pods xcconfig.
#
# `OTHER_LDFLAGS = "$(inherited)"` in withNativeClip.js is what keeps that from
# happening again, and this is the check that it held. A Pods xcconfig appearing
# for the clip means the target has acquired dependencies and the budget is
# about to be a problem again.
if [ -f "ios/Pods/Target Support Files/Pods-SPSMConnectClip/Pods-SPSMConnectClip.release.xcconfig" ]; then
  fail "The clip has a Pods xcconfig, which means it is linking pods again. A native clip links nothing — see plugins/withNativeClip.js, and check whether react-native-app-clip has come back into package.json."
fi
echo "   ✓ clip links no pods"

# Its whole reason for existing, as a number.
CLIP_SOURCES=$(ls ios/SPSMConnectClip/*.swift 2>/dev/null | wc -l | tr -d ' ')
[ "$CLIP_SOURCES" -ge 15 ] \
  || fail "Only $CLIP_SOURCES Swift files reached ios/SPSMConnectClip — withNativeClip did not copy the sources from ios-appclip/."
echo "   ✓ $CLIP_SOURCES Swift sources in the clip target"

# ── The clip's version must match the app's exactly ──────────────────────────
#
# App Store Connect rejects a clip whose version or build differs from its
# parent, and it rejects it after the whole archive has uploaded.
APP_V=$(plutil -extract CFBundleShortVersionString raw ios/SPSMConnect/Info.plist)
APP_B=$(plutil -extract CFBundleVersion raw ios/SPSMConnect/Info.plist)
CLIP_V=$(xcodebuild -project ios/SPSMConnect.xcodeproj -target SPSMConnectClip -configuration Release -showBuildSettings 2>/dev/null | awk '/ MARKETING_VERSION =/{print $3}')
CLIP_B=$(xcodebuild -project ios/SPSMConnect.xcodeproj -target SPSMConnectClip -configuration Release -showBuildSettings 2>/dev/null | awk '/ CURRENT_PROJECT_VERSION =/{print $3}')

if [ -n "$CLIP_V" ] && [ -n "$CLIP_B" ]; then
  { [ "$APP_V" = "$CLIP_V" ] && [ "$APP_B" = "$CLIP_B" ]; } \
    || fail "Version mismatch: app $APP_V ($APP_B) vs clip $CLIP_V ($CLIP_B). App Store Connect rejects a clip whose version differs from its parent, after the upload completes."
  echo "   ✓ app and clip both at $APP_V ($APP_B)"
else
  note "could not read the clip's version from build settings — check it by hand before uploading"
fi

# withNativeClip writes this, so its absence means the plugin only half ran.
test -f ios/SPSMConnect.xcodeproj/xcshareddata/xcschemes/SPSMConnectClip.xcscheme \
  || fail "No SPSMConnectClip scheme — withNativeClip did not finish. The clip would not be runnable from Xcode."

echo "   ✓ clip target, embed phase, entitlements, Firebase plists, Square phase order"
echo "   ✓ associated domains all on www.spsmwayland.org"

echo "→ Opening workspace"
open -a Xcode "$(pwd)/ios/SPSMConnect.xcworkspace"

echo "✓ Done"
echo
if [ "$STORE_BUILD" = "1" ]; then
  echo "  Square is PRODUCTION in this project. To archive:"
  echo "    scheme 'SPSMConnect', destination 'Any iOS Device', Product → Archive"
  echo
  echo "  Bump BUILD in app.config.ts first if this number has been uploaded before."
  echo "  Before uploading, confirm SPSMConnectClip.app is inside SPSMConnect.app/AppClips/."
else
  echo "  Sandbox Square. Run ./reset-ios.sh --store for a build you intend to upload."
fi
