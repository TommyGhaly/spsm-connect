#!/usr/bin/env bash
#
# Take the App Store's screenshots off the simulators, into store/raw/ios/.
#
# Run by hand — `npm run screenshots:ios` — and then `npm run store`, which is
# what checks the sizes and writes store/screenshots/. This half only drives
# the simulator; it deliberately does no image processing at all, so that the
# two things that can go wrong (a screen that did not load, a size a store
# refuses) fail in different places with different messages.
#
# The Android half is capture-screenshots-android.sh; `npm run screenshots`
# runs both.
#
# ## Why deep links rather than tapping
#
# Every screen below is reached with `simctl openurl` against the app's own
# `spsmconnect://` scheme, which expo-router resolves to the same route a tap
# would. Driving the tab bar by coordinate was the alternative and it is not
# reproducible: the tab bar has six items whose positions move with the device
# width, and `admin/camp/attendance` appears in it only for a signed-in servant
# — so the Giving tab is in a different place depending on who last used the
# simulator. A URL is the same on every device and says in the script which
# screen it meant.
#
# Routes come from app/(drawer)/(tabs)/. Keep SCREENS in step with them; a
# route that no longer exists lands on the not-found screen, and it will be
# captured and uploaded without complaint because it is a perfectly valid PNG.
# Look at what lands in store/raw/ before running the second half.
#
# ## Why Release
#
# A Debug build needs Metro and paints a dev-mode overlay over the corner of
# every screenshot. See README.md.
set -euo pipefail

cd "$(dirname "$0")/.."

BUNDLE_ID="${BUNDLE_ID:-org.spsm.connect}"

# PAGES_ONLY=1 takes only PAGE_SCREENS, leaving the main listing's captures as
# they are — for adding a custom product page without re-shooting a listing
# that is already live.
PAGES_ONLY="${PAGES_ONLY:-}"

# The .app to install, from the Release build `npm run ios:release` leaves in
# DerivedData. Overridable because a CI build puts it somewhere else.
APP_PATH="${APP_PATH:-}"
if [[ -z "$APP_PATH" ]]; then
  APP_PATH=$(find ~/Library/Developer/Xcode/DerivedData -maxdepth 5 \
    -path '*Release-iphonesimulator/SPSMConnect.app' -print0 2>/dev/null \
    | xargs -0 ls -dt 2>/dev/null | head -1 || true)
fi

if [[ -z "$APP_PATH" || ! -d "$APP_PATH" ]]; then
  echo "No Release SPSMConnect.app found in DerivedData." >&2
  echo "Build one first:  npx expo run:ios --configuration Release" >&2
  echo "Or point APP_PATH at a .app built elsewhere." >&2
  exit 1
fi

echo "Installing $APP_PATH"

# The device sets. The name is the App Store's own size class, and it is also
# the directory under store/raw/ios/ that make-store-assets.mjs checks against
# RULES — so these two strings have to agree with that file.
#
#   6.9   iPhone 17 Pro Max, 1320x2868
#   13    iPad Pro 13-inch,  2064x2752
#
# Apple requires exactly these two for a universal app and scales every smaller
# class down from them itself. `supportsTablet: true` in app.config.ts is what
# makes the iPad set mandatory.
DEVICES=(
  "6.9|iPhone 17 Pro Max"
  "13|iPad Pro 13-inch (M5)"
)

# Route, then the filename it is captured as. Numbered because both stores show
# screenshots in filename order and the order is the argument the listing makes:
# what the app is for first, then the two things most people open it for.
#
# ## The two screens that are deliberately NOT here
#
# **Send** (`spsmconnect:///`, the tab bar's camera button) is the app's whole
# point and photographs terribly. It is a live viewfinder, and a simulator has
# no camera — so the screenshot is an all-but-empty dark red rectangle with a
# shutter button on it. There is no fixing that from here; it would have to be
# captured on a real device, by hand, pointed at something worth seeing.
#
# **Photos** (`/events`, the galleries) was the obvious substitute and is
# worse: every activity currently reads "No photographs yet" over a placeholder
# seal, so the shot advertises an empty app. Worth revisiting once the
# galleries have something in them — it is the better story than /about.
#
# `/about` takes the fifth slot instead: real copy, and it says whose church
# this is, which nothing else in the set does.
#
# ## The Send tab is deliberately absent, and cannot be captured here
#
# `spsmconnect:///` is the camera. A simulator has no camera, so expo-camera
# renders its preview as a flat `deep` rectangle and the capture is an empty
# maroon screen with a shutter floating on it — a perfectly valid PNG, which is
# exactly the failure the closing note warns about. There is no simulator fix:
# the frames do not exist to capture. That screenshot has to be taken on a real
# device, by hand. Until then the listing leads on `/about/our-belief`, which is
# the app at its best anyway — the church's own words in its own type, and the
# one screen that could not belong to any other church's app.
SCREENS=(
  "spsmconnect:///about/our-belief|1-belief"
  "spsmconnect:///calendar|2-calendar"
  "spsmconnect:///forms|3-forms"
  "spsmconnect:///bookstore|4-bookstore"
  "spsmconnect:///giving|5-giving"
)

# Screens that only the custom product pages use, captured into
# store/raw/pages/ios/<set>/ rather than beside the five above — the main
# listing takes every PNG in its directory, in filename order, so a sixth file
# there would quietly join it. Unnumbered, because each product page sets its
# own order: see FILES in store/custom-product-pages/src/shots.html, which
# names these.
#
# The calendar is here as well as in SCREENS, deliberately. It draws the
# church's real week, so whether it is publishable depends on the day it was
# taken; the product pages carry their own copy so that one can be retaken on
# a clean day without re-shooting a main listing that is already live.
PAGE_SCREENS=(
  "spsmconnect:///calendar|calendar"
  "spsmconnect:///about/welcome-newcomers|welcome"
  "spsmconnect:///about/future-plans|plans"
  "spsmconnect:///livestream|livestream"
)

# capture <udid> <url> <file>
capture() {
  xcrun simctl openurl "$1" "$2"
  # Long enough for the navigation, the screen's own first paint, and any
  # list it fetches. Generous on purpose: the failure mode of being too quick
  # is a screenshot of a spinner, and that is not visible in the script's
  # output — only in the PNG, after the fact.
  sleep 5
  # Errors deliberately not swallowed: a failed capture leaves the previous
  # run's PNG in place, and a stale screenshot is the one failure here that
  # survives all the way onto a store listing without looking wrong.
  xcrun simctl io "$1" screenshot --type=png "$3" >/dev/null
  echo "  ${3#store/raw/}  $(sips -g pixelWidth -g pixelHeight "$3" \
    | awk '/pixel/ {printf "%s ", $2}')"
}

for entry in "${DEVICES[@]}"; do
  set_name="${entry%%|*}"
  device="${entry##*|}"

  udid=$(xcrun simctl list devices available \
    | grep -F "$device (" | head -1 | sed -E 's/.*\(([0-9A-F-]{36})\).*/\1/')

  if [[ -z "$udid" ]]; then
    echo "No simulator named '$device'. Create one in Xcode, or edit DEVICES." >&2
    exit 1
  fi

  out="store/raw/ios/$set_name"
  mkdir -p "$out"
  echo
  echo "=== $device ($set_name) — $udid"

  xcrun simctl bootstatus "$udid" -b >/dev/null 2>&1 || xcrun simctl boot "$udid"
  xcrun simctl bootstatus "$udid" -b >/dev/null 2>&1 || true

  # The status bar, frozen. Apple's own screenshots read 9:41 with full bars
  # and a full battery, and a real simulator's bar shows the wall-clock time
  # and a "charging" bolt — which dates a screenshot and looks unfinished. This
  # is a simulator-only facility, and it is reset at the end of the run.
  xcrun simctl status_bar "$udid" override \
    --time "9:41" \
    --batteryState charged --batteryLevel 100 \
    --cellularMode active --cellularBars 4 \
    --wifiMode active --wifiBars 3 \
    --dataNetwork wifi

  xcrun simctl uninstall "$udid" "$BUNDLE_ID" >/dev/null 2>&1 || true
  xcrun simctl install "$udid" "$APP_PATH"

  # Permissions, pre-granted, because the Send tab asks for the camera the
  # moment it appears — and the first screenshot of the run would otherwise be
  # of the permission alert rather than of the app. Granting is only possible
  # on a simulator, and only after the app is installed.
  for service in camera photos photos-add microphone; do
    xcrun simctl privacy "$udid" grant "$service" "$BUNDLE_ID" >/dev/null 2>&1 || true
  done

  # Launched once up front rather than per screen. A cold launch costs the
  # splash screen plus the first frame of JS, and a screenshot taken during
  # either is a red rectangle — the openurl loop below reuses this process.
  xcrun simctl launch "$udid" "$BUNDLE_ID" >/dev/null
  sleep 12

  if [[ -z "$PAGES_ONLY" ]]; then
    for screen in "${SCREENS[@]}"; do
      capture "$udid" "${screen%%|*}" "$out/${screen##*|}.png"
    done
  fi

  pages="store/raw/pages/ios/$set_name"
  mkdir -p "$pages"
  for screen in "${PAGE_SCREENS[@]}"; do
    capture "$udid" "${screen%%|*}" "$pages/${screen##*|}.png"
  done

  xcrun simctl status_bar "$udid" clear
  echo "  written to $out and $pages"
done

echo
echo "Raw screenshots in store/raw/ios/. Look at them — a spinner, a blank"
echo "camera or a not-found screen is a valid PNG and nothing downstream will"
echo "object. Check 2-calendar especially: it draws the church's real week, and"
echo "an event carrying a servant's name and telephone number must not be"
echo "published on a store listing."
echo "Then: npm run store"
