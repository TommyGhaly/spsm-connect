#!/usr/bin/env bash
#
# Walk through the App Clip's experiences on the booted simulator, one per
# Enter press.
#
# Each step relaunches org.spsm.connect.Clip with `_XCAppClipURL` set to that
# experience's invocation URL — the same variable Xcode's "App Clip Invocation
# URL" scheme setting uses, read by ClipRouter.debugInvocationURL(). That only
# works in a **Debug** build of the clip (Release ignores it and every step
# lands on the Apps hub), so the script builds and installs one if needed.
#
#   npm run clip-tour                 # all eight, in experiences.ts order
#   npm run clip-tour -- give forms   # just these
#   SIM=<udid> npm run clip-tour      # a simulator other than the booted one
#   CLIP_BUILD=1 npm run clip-tour    # rebuild the clip first
#
# Enter = next, b = back, r = relaunch the current one, q = quit.

set -euo pipefail

cd "$(dirname "$0")/.."

BUNDLE=org.spsm.connect.Clip
SIM="${SIM:-booted}"
ORIGIN=https://www.spsmwayland.org

if [ "$#" -gt 0 ]; then
  slugs=("$@")
else
  # The table in src/clip/experiences.ts is the source of truth for the slugs.
  slugs=()
  while IFS= read -r slug; do slugs+=("$slug"); done < <(
    grep -oE "^    slug: '[a-z-]+'" src/clip/experiences.ts | sed -E "s/.*'(.*)'/\1/"
  )
fi

if [ "${#slugs[@]}" -eq 0 ]; then
  echo "No slugs found in src/clip/experiences.ts." >&2
  exit 1
fi

# The full app embeds the clip, but that copy cannot be launched on its own:
# `simctl launch` fails with FBSOpenApplicationServiceErrorDomain code 4. So
# build the clip target by itself for the simulator and install it standalone.
# CLIP_BUILD=1 forces a rebuild after editing ios-appclip/.
if [ "${CLIP_BUILD:-0}" = 1 ] || ! xcrun simctl get_app_container "$SIM" "$BUNDLE" >/dev/null 2>&1; then
  if [ "$SIM" = booted ]; then
    udid=$(xcrun simctl list devices booted | grep -oE '[0-9A-F-]{36}' | head -1)
  else
    udid=$SIM
  fi
  if [ -z "$udid" ]; then
    echo "No booted simulator." >&2
    exit 1
  fi
  echo "Building the Debug App Clip for the simulator…"
  LANG=en_US.UTF-8 xcodebuild -workspace ios/SPSMConnect.xcworkspace -scheme SPSMConnectClip \
    -configuration Debug -destination "id=$udid" -derivedDataPath ios/build/clip-sim \
    build -quiet
  xcrun simctl install "$SIM" ios/build/clip-sim/Build/Products/Debug-iphonesimulator/SPSMConnectClip.app
fi

launch() {
  local url="$ORIGIN/c/$1"
  SIMCTL_CHILD__XCAppClipURL="$url" \
    xcrun simctl launch --terminate-running-process "$SIM" "$BUNDLE" </dev/null >/dev/null
}

i=0
n=${#slugs[@]}
while :; do
  slug=${slugs[$i]}
  printf '\n[%d/%d] %s  (%s/c/%s)\n' "$((i + 1))" "$n" "$slug" "$ORIGIN" "$slug"
  if ! launch "$slug"; then
    echo "  launch failed" >&2
  fi

  if [ $((i + 1)) -eq "$n" ]; then
    prompt='Enter = finish, b = back, r = relaunch, q = quit: '
  else
    prompt="Enter = next (${slugs[$((i + 1))]}), b = back, r = relaunch, q = quit: "
  fi
  read -r -p "$prompt" key || key=q

  case "$key" in
    q | Q) break ;;
    r | R) ;;
    b | B) [ "$i" -gt 0 ] && i=$((i - 1)) ;;
    *)
      [ $((i + 1)) -eq "$n" ] && break
      i=$((i + 1))
      ;;
  esac
done

echo "Done."
