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
#                             SwiftUI clip built from the sources in
#                             ios-appclip/, linking one pod (Square's payment
#                             SDK, ~1.4 MB, so /c/bookstore can take Apple Pay)
#   withSquareSetupPhaseOrder moves Square's `setup` phase after [CP] Embed Pods
#                             Frameworks, without which a Release build dies at
#                             launch under dyld with no crash report
#
# Usage:
#   ./reset-ios.sh              sandbox Square — for development
#   ./reset-ios.sh --store      production Square — for an archive you will upload

fail() { echo "   ✗ $1" >&2; exit 1; }
note() { echo "   · $1"; }

# ── The signing team ─────────────────────────────────────────────────────────
#
# The church's Apple Developer team, and the value `ios.appleTeamId` in
# app.config.ts declares. Checked here rather than assumed, because a generated
# project carried it for a long time without anything in the repo setting it —
# Xcode and the signed-in Apple account were supplying it between them, which
# holds until the first build on a machine that has never signed for this team.
#
# Both targets are checked. Build settings are per-target and the App Clip
# inherits none of the app's, so the clip is the one that fails first, with
# "Signing for SPSMConnectClip requires a development team" — an error that
# reads like a broken project rather than a missing declaration.
APPLE_TEAM_ID="${APPLE_TEAM_ID:-5ZRM8X66TN}"

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

# ── iOS version ──────────────────────────────────────────────────────────────
#
# Asked first, before anything is wiped, because `expo prebuild` reads
# app.config.ts to write Info.plist and the clip's MARKETING_VERSION — a version
# changed after it would not reach the archive. Enter keeps the current one.
# With no terminal attached (a task runner, CI) it keeps the current one without
# asking. The same question Taksis's reset-ios.sh asks.
#
# Anchored to the two-space indent so it matches the top-level `version` and
# nothing nested inside the config.
VERSION_LINE="^  version: '"
CURRENT_VERSION=$(grep -E "${VERSION_LINE}[^']*'" app.config.ts | head -1 | sed "s/.*'\(.*\)'.*/\1/")
[ -n "$CURRENT_VERSION" ] || fail "No top-level \"version: '…'\" in app.config.ts."

NEW_VERSION="$CURRENT_VERSION"
if [ -t 0 ]; then
  while true; do
    # `|| ANSWER=""`: under set -e a Ctrl-D (EOF) would otherwise end the whole
    # script right here, silently. Treat it as Enter.
    read -r -p "→ iOS version [$CURRENT_VERSION] — Enter to keep, or type a new one: " ANSWER || ANSWER=""
    [ -z "$ANSWER" ] && break
    if [[ "$ANSWER" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
      NEW_VERSION="$ANSWER"
      break
    fi
    echo "   '$ANSWER' is not a version like 1.0.1 — try again."
  done
fi

if [ "$NEW_VERSION" != "$CURRENT_VERSION" ]; then
  sed -i '' "s/${VERSION_LINE}${CURRENT_VERSION}'/  version: '${NEW_VERSION}'/" app.config.ts
  # Read back: a sed that matched nothing looks exactly like a successful edit.
  WROTE=$(grep -E "${VERSION_LINE}[^']*'" app.config.ts | head -1 | sed "s/.*'\(.*\)'.*/\1/")
  [ "$WROTE" = "$NEW_VERSION" ] || fail "Tried to set version $NEW_VERSION, app.config.ts still reads $WROTE."
  echo "   ✓ version $CURRENT_VERSION → $NEW_VERSION (commit app.config.ts with the release)"
else
  echo "   ✓ keeping version $CURRENT_VERSION"
fi

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
  || fail "SPSMConnectClip target missing from the Xcode project — withNativeClip did not apply."

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
# nothing, Square's nested frameworks ship still nested, and the binary dies at
# launch under dyld — before any of its own code runs, with no crash report and
# nothing on screen. For the clip there is a second failure and it is worse: an
# un-hoisted nested bundle is rejected by App Store Connect as 90205
# "disallowed nested bundles", after the whole archive has uploaded. See
# plugins/withSquareSetupPhaseOrder.js.
#
# **Both targets are checked, each against its own embed phase.** The app links
# Square through react-native-square-in-app-payments and the clip links it
# directly for /c/bookstore, so the project has two setup phases and two embed
# phases. Comparing the first of each would pair the app's setup with whichever
# embed phase came first in the file and prove nothing about either target.
#
# awk rather than grep, because "the same target" means "the same buildPhases
# list", which is a block and not a line.
PHASE_ORDER=$(awk '
  /buildPhases = \(/        { inlist = 1; setup = 0; embed = 0; next }
  inlist && /\);/           {
                              if (setup && !embed) print "MISSING_EMBED"
                              else if (setup && setup < embed) print "OUT_OF_ORDER"
                              else if (setup) found++
                              inlist = 0
                              next
                            }
  inlist && /\[CP\] Square In-App Payments SDK Setup/ { setup = NR }
  inlist && /\[CP\] Embed Pods Frameworks/            { embed = NR }
  END                       { if (found) print "OK " found }
' "$PBX")

case "$PHASE_ORDER" in
  *OUT_OF_ORDER*)
    fail "Square's setup phase runs BEFORE [CP] Embed Pods Frameworks in one of the two targets. withSquareSetupPhaseOrder did not apply: the Release app dies at launch with no crash report, and the clip is rejected as 90205 disallowed nested bundles."
    ;;
  *MISSING_EMBED*)
    fail "A target has Square's setup phase and no [CP] Embed Pods Frameworks — pod install did not finish."
    ;;
esac

[ "$PHASE_ORDER" = "OK 2" ] \
  || fail "Expected Square's setup phase on both the app and the clip, correctly ordered; found '$PHASE_ORDER'. The app links Square through react-native-square-in-app-payments and the clip links it directly for /c/bookstore."

# ── The clip's deployment target ─────────────────────────────────────────────
#
# **Apple's floor for an App Clip is 16.4**, whatever the clip is written in.
# This was set to 16.0 once, on the reasoning that 16.4 had only ever been
# expo-modules-core's requirement, and App Store Connect refused the upload —
# after the whole archive had gone up:
#
#   90838: Invalid MinimumOSVersion … has an invalid MinimumOSVersion value of
#   '16.0'. The version number should be three dot-separated integers with a
#   minimum OS of '16.4' or later.
#
# The clip must also not require a *newer* iOS than the app that carries it,
# which would leave people able to install the app and not the clip inside it.
CLIP_MIN=$(xcodebuild -project ios/SPSMConnect.xcodeproj -target SPSMConnectClip \
  -configuration Release -showBuildSettings 2>/dev/null \
  | awk '/ IPHONEOS_DEPLOYMENT_TARGET =/{print $3; exit}')
APP_MIN=$(xcodebuild -project ios/SPSMConnect.xcodeproj -target SPSMConnect \
  -configuration Release -showBuildSettings 2>/dev/null \
  | awk '/ IPHONEOS_DEPLOYMENT_TARGET =/{print $3; exit}')

# `sort -V` rather than a numeric compare, because 16.10 is newer than 16.4 and
# a float comparison says the opposite.
lowest() { printf '%s\n%s\n' "$1" "$2" | sort -V | head -1; }

[ "$(lowest "$CLIP_MIN" 16.4)" = "16.4" ] \
  || fail "The clip's deployment target is $CLIP_MIN. Apple refuses any App Clip below 16.4, and only says so after the archive has uploaded. See DEPLOYMENT_TARGET in plugins/withNativeClip.js."

[ "$(lowest "$CLIP_MIN" "$APP_MIN")" = "$APP_MIN" ] \
  || fail "The clip requires iOS $CLIP_MIN but the app requires only $APP_MIN, so somebody could install the app and not the clip inside it."

echo "   ✓ clip targets iOS $CLIP_MIN, app iOS $APP_MIN"

# ── Both targets sign as the church ──────────────────────────────────────────
for target in SPSMConnect SPSMConnectClip; do
  resolved=$(xcodebuild -project ios/SPSMConnect.xcodeproj -target "$target" \
    -configuration Release -showBuildSettings 2>/dev/null \
    | awk '/ DEVELOPMENT_TEAM =/{print $3; exit}')

  [ -n "$resolved" ] \
    || fail "$target has no DEVELOPMENT_TEAM. Set ios.appleTeamId in app.config.ts — the clip inherits nothing from the app target and will not sign."

  [ "$resolved" = "$APPLE_TEAM_ID" ] \
    || fail "$target signs as team $resolved, not $APPLE_TEAM_ID. Check ios.appleTeamId in app.config.ts, or set APPLE_TEAM_ID if the church has genuinely moved teams."
done
echo "   ✓ both targets sign as $APPLE_TEAM_ID"

# ── The clip must link exactly one pod ───────────────────────────────────────
#
# It linked none until /c/bookstore went native, and the check here was that no
# Pods xcconfig existed for it at all. That is no longer the rule, but the thing
# it was protecting is unchanged and is the whole reason this block is still
# here: the React Native clip measured 61 MB against a 15 MB limit, and the
# framework that produced its first rejection — Square's, with its nested
# bundles — arrived because the clip inherited the *app's* Pods xcconfig rather
# than having one of its own.
#
# So the rule is now "one, and it is Square's". A second name appearing in this
# list is the clip having quietly acquired a dependency, which is how the budget
# went the first time.
CLIP_XCCONFIG="ios/Pods/Target Support Files/Pods-SPSMConnectClip/Pods-SPSMConnectClip.release.xcconfig"

[ -f "$CLIP_XCCONFIG" ] \
  || fail "No Pods xcconfig for the clip. Its Podfile target did not integrate, so SquareInAppPaymentsSDK is not linked and /c/bookstore cannot take a payment — see withClipPods in plugins/withNativeClip.js."

CLIP_FRAMEWORKS=$(grep '^OTHER_LDFLAGS' "$CLIP_XCCONFIG" \
  | tr ' ' '\n' | grep -A 1 -- '-framework' | grep -v -- '-framework' \
  | tr -d '"' | sort -u | tr '\n' ' ' | sed 's/ $//')

[ "$CLIP_FRAMEWORKS" = "SquareInAppPaymentsSDK" ] \
  || fail "The clip links '$CLIP_FRAMEWORKS'; it must link SquareInAppPaymentsSDK and nothing else. Every extra framework comes out of 15 MB uncompressed, and a nested bundle among them is an App Store Connect 90205 rejection after the archive has uploaded."

echo "   ✓ clip links one pod: SquareInAppPaymentsSDK"

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
