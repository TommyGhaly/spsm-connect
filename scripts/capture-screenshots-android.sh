#!/usr/bin/env bash
#
# Take Play's phone screenshots off an emulator, into store/raw/android/phone/.
#
# The Android half of capture-screenshots.sh, and a separate file rather than a
# flag on that one because nothing is shared: `adb` and `simctl` disagree about
# how to install, how to deep-link, how to take a picture and how to freeze the
# status bar, so a combined script would be two scripts in a trench coat with
# an `if` down the middle. What they do share is the shape — boot, install,
# launch once, deep-link to each screen, capture — and the same warning: a
# screenshot of a spinner is a valid PNG and nothing downstream will object.
#
# Run by hand — `npm run screenshots:android` — then `npm run store`, which is
# what pads these to a ratio Play accepts. See RULES in make-store-assets.mjs;
# a raw phone screenshot is too tall for Play and this script does not fix
# that, on purpose.
set -euo pipefail

cd "$(dirname "$0")/.."

SDK="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
ADB="$SDK/platform-tools/adb"
APPLICATION_ID="${APPLICATION_ID:-org.spsm.connect}"

[[ -x "$ADB" ]] || { echo "No adb at $ADB. Set ANDROID_HOME." >&2; exit 1; }

# An emulator has to be running already. Deliberately not booted here: an AVD
# takes a minute or two to come up, `emulator` does not detach cleanly, and a
# script that leaves a stray emulator behind on failure is worse than one that
# asks. Start one with:
#
#   $ANDROID_HOME/emulator/emulator -avd Pixel_9a &
echo "Waiting for a device..."
"$ADB" wait-for-device
until [[ "$("$ADB" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" == "1" ]]; do
  sleep 2
done
echo "Device ready: $("$ADB" shell getprop ro.product.model | tr -d '\r')"

# The APK. Release for the same reason iOS is — a debug build needs Metro and
# paints a dev overlay. Expo's generated build.gradle signs `release` with the
# debug keystore, so this builds without a keystore of the church's; that is
# fine for a screenshot and is NOT the artefact to upload to Play.
APK="${APK:-android/app/build/outputs/apk/release/app-release.apk}"
if [[ ! -f "$APK" ]]; then
  echo "No APK at $APK. Build one first:" >&2
  echo "  (cd android && ./gradlew assembleRelease)" >&2
  exit 1
fi

echo "Installing $APK"
"$ADB" install -r -d "$APK" >/dev/null

# Permissions, pre-granted, for the reason the iOS script does it: the Send tab
# asks for the camera on sight, and an alert over the first screenshot is not
# what the listing wants to show. `|| true` because a permission the manifest
# does not declare is an error here, and the set below is deliberately broader
# than any one build needs.
for permission in CAMERA RECORD_AUDIO READ_MEDIA_IMAGES READ_MEDIA_VIDEO POST_NOTIFICATIONS; do
  "$ADB" shell pm grant "$APPLICATION_ID" "android.permission.$permission" >/dev/null 2>&1 || true
done

# The status bar, frozen, so the shots do not carry the wall-clock time and a
# half-full battery. SystemUI demo mode is the Android equivalent of `simctl
# status_bar override`, and `sysui_demo_allowed` has to be set first or every
# broadcast below is silently ignored. Cleared at the end of the run.
"$ADB" shell settings put global sysui_demo_allowed 1
demo() { "$ADB" shell am broadcast -a com.android.systemui.demo "$@" >/dev/null; }
demo -e command enter
demo -e command clock -e hhmm 0941
demo -e command battery -e level 100 -e plugged false
demo -e command network -e wifi show -e level 4
demo -e command network -e mobile show -e level 4 -e datatype none
demo -e command notifications -e visible false

# The same five screens as the iOS set, in the same order, so the two listings
# tell the same story. Routes come from app/(drawer)/(tabs)/ — see the note in
# capture-screenshots.sh about why these are deep links rather than taps.
SCREENS=(
  "spsmconnect:///calendar|1-calendar"
  "spsmconnect:///bookstore|2-bookstore"
  "spsmconnect:///giving|3-giving"
  "spsmconnect:///forms|4-forms"
  "spsmconnect:///about|5-about"
)

out="store/raw/android/phone"
mkdir -p "$out"

# Launched once up front; the loop below reuses the process. A cold launch is
# the splash screen plus the first frame of JS, and a screenshot taken during
# either is a red rectangle. 12s rather than 8: a Release RN start on an
# emulator was measured at just over 10, and the cost of being wrong is a
# screenshot of the splash screen.
"$ADB" shell monkey -p "$APPLICATION_ID" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
sleep 12

for screen in "${SCREENS[@]}"; do
  url="${screen%%|*}"
  name="${screen##*|}"

  # `-p` scopes the intent to this package. Without it the VIEW intent can be
  # offered to anything else on the device that claims the scheme, which on an
  # emulator with a browser installed means a disambiguation dialog — and that
  # dialog is what gets photographed.
  "$ADB" shell am start -W -a android.intent.action.VIEW -d "$url" \
    -p "$APPLICATION_ID" >/dev/null
  sleep 5
  "$ADB" exec-out screencap -p > "$out/$name.png"
  echo "  $name  $(sips -g pixelWidth -g pixelHeight "$out/$name.png" \
    | awk '/pixel/ {printf "%s ", $2}')"
done

demo -e command exit
"$ADB" shell settings put global sysui_demo_allowed 0

echo
echo "Raw screenshots in $out. Look at them, then: npm run store"
