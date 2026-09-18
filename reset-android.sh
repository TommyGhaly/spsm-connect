#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

# Regenerate android/ from scratch and build, checking that the signing actually
# came from the church's key rather than the template's debug one.
#
# `android/` is gitignored generated output, so everything this project needs on
# top of a stock prebuild lives in config plugins — `withReleaseSigning` for the
# signing config, `withNotificationColorMerge` for the manifest attribute two
# libraries both claim. This script does the parts a plugin cannot: wiping
# state, writing local.properties, building, and verifying.
#
# ## No credentials live in this file
#
# Taksis's equivalent script carries its keystore path and all three passwords
# inline. This one carries none: `plugins/withReleaseSigning.js` reads four
# Gradle properties from ~/.gradle/gradle.properties, outside the repository and
# outside anything that gets committed or uploaded. A script in a git repo is
# not a secret store, and a keystore password in one is a keystore password in
# everybody's clone and every backup of it.
#
# Usage:
#   ./reset-android.sh              sandbox Square, debug signing — development
#   ./reset-android.sh --store      production Square, upload key required, AAB

fail() { echo "   ✗ $1" >&2; exit 1; }
note() { echo "   · $1"; }

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

# ── Environment ──────────────────────────────────────────────────────────────
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$PATH:$ANDROID_HOME/platform-tools"

test -d "$ANDROID_HOME" \
  || fail "No Android SDK at $ANDROID_HOME. Install it through Android Studio, or set ANDROID_HOME."

# ── Java ─────────────────────────────────────────────────────────────────────
#
# Checked rather than forced. This project pins no toolchain in build.gradle and
# has built successfully on whatever `java_home` returns by default, so pinning a
# specific JDK here would change a working build on the strength of a guess.
# What is worth failing on is a version Gradle and AGP will not accept at all.
if [ -z "${JAVA_HOME:-}" ]; then
  JAVA_HOME=$(/usr/libexec/java_home 2>/dev/null || true)
  export JAVA_HOME
fi

[ -n "${JAVA_HOME:-}" ] || fail "No JDK found. Install one: brew install --cask temurin"
export PATH="$JAVA_HOME/bin:$PATH"

JAVA_VER=$(java -version 2>&1 | head -1 | grep -oE '"[0-9]+' | tr -d '"')
case "$JAVA_VER" in
  17|21) echo "   ✓ Java $JAVA_VER" ;;
  *) fail "Java $JAVA_VER is not supported by this project's Gradle and AGP. Use 17 or 21: JAVA_HOME=\$(/usr/libexec/java_home -v 17) ./reset-android.sh" ;;
esac

# ── The upload key, before anything is wiped ─────────────────────────────────
#
# Checked first because everything after it is slow, and because a store build
# that gets all the way to a signed AAB using the debug key is the one failure
# here that looks completely normal until Play rejects it.
#
# The four property names are withReleaseSigning.js's. Only their presence is
# checked — the values are never read, printed, or passed on a command line,
# where they would land in the shell history and the process table.
if [ "$STORE_BUILD" = "1" ]; then
  GRADLE_PROPS="$HOME/.gradle/gradle.properties"
  test -f "$GRADLE_PROPS" \
    || fail "No $GRADLE_PROPS. A store build needs the church's upload key — see plugins/withReleaseSigning.js for the four properties it expects."

  for prop in SPSM_UPLOAD_STORE_FILE SPSM_UPLOAD_KEY_ALIAS SPSM_UPLOAD_STORE_PASSWORD SPSM_UPLOAD_KEY_PASSWORD; do
    grep -q "^${prop}=" "$GRADLE_PROPS" \
      || fail "$prop is not set in $GRADLE_PROPS. Without all four the build would fall back to the debug key, which Play refuses."
  done

  KEYSTORE=$(grep '^SPSM_UPLOAD_STORE_FILE=' "$GRADLE_PROPS" | cut -d= -f2-)
  test -f "$KEYSTORE" \
    || fail "SPSM_UPLOAD_STORE_FILE points at $KEYSTORE, which does not exist. Keep the keystore outside this repository — /android is regenerated and anything inside it is deleted."

  echo "   ✓ upload key properties present, keystore found"

  # Optional, and off unless you set it. Pin the expected fingerprint once and
  # this catches the day the path resolves to a *different* keystore — which
  # produces a perfectly valid AAB that Play rejects as signed by the wrong key.
  #   export SPSM_UPLOAD_SHA1="AB:CD:…"
  if [ -n "${SPSM_UPLOAD_SHA1:-}" ]; then
    ACTUAL_SHA1=$(keytool -list -keystore "$KEYSTORE" \
      -storepass "$(grep '^SPSM_UPLOAD_STORE_PASSWORD=' "$GRADLE_PROPS" | cut -d= -f2-)" \
      -v 2>/dev/null | grep "SHA1:" | head -1 | awk '{print $2}')
    [ "$ACTUAL_SHA1" = "$SPSM_UPLOAD_SHA1" ] \
      || fail "Keystore fingerprint mismatch. Expected $SPSM_UPLOAD_SHA1, got ${ACTUAL_SHA1:-nothing}."
    echo "   ✓ keystore fingerprint matches"
  fi
fi

# ── Wipe and regenerate ──────────────────────────────────────────────────────
echo "→ Stopping Gradle daemons"
pkill -f "GradleDaemon" 2>/dev/null || true
sleep 1

echo "→ Wiping android/"
rm -rf android

echo "→ Running prebuild"
npx expo prebuild --platform android

# prebuild deletes this along with everything else it regenerates, and the next
# Gradle run fails with "SDK location not found", which reads like a broken
# machine rather than a wiped file.
echo "sdk.dir=$ANDROID_HOME" > android/local.properties

# ── Verify the plugins landed ────────────────────────────────────────────────

echo "→ Verifying"

BUILD_GRADLE=android/app/build.gradle

grep -q "withReleaseSigning.js" "$BUILD_GRADLE" \
  || fail "withReleaseSigning did not apply — the release buildType is still signed with debug.keystore, whose password is the string 'android' and is committed to this repo. Play refuses that, and a first upload would bind the package name to a public key permanently."

grep -q "signingConfigs.release" "$BUILD_GRADLE" \
  || fail "No release signingConfig in $BUILD_GRADLE — withReleaseSigning applied only partly."

# versionCode is ANDROID_VERSION_CODE in app.config.ts, and it is Play's alone —
# iOS counts separately, so bumping this does not touch the iOS build number.
# Play refuses a number it has already seen, and it refuses it after the upload
# finishes.
VERSION_CODE=$(grep -E '^\s*versionCode ' "$BUILD_GRADLE" | head -1 | awk '{print $2}')
VERSION_NAME=$(grep -E '^\s*versionName ' "$BUILD_GRADLE" | head -1 | awk '{print $2}' | tr -d '"')
echo "   ✓ version $VERSION_NAME, versionCode $VERSION_CODE"

if [ "$STORE_BUILD" = "1" ]; then
  note "if versionCode $VERSION_CODE has been uploaded before, stop now and bump ANDROID_VERSION_CODE in app.config.ts"
fi

# ── Build ────────────────────────────────────────────────────────────────────
#
# `-PSPSM_REQUIRE_UPLOAD_KEY=1` on a store build turns withReleaseSigning's
# debug fallback into a hard failure. The properties were already checked above;
# this is the belt to that braces, and it is the one that runs inside Gradle
# where the decision is actually made.
if [ "$STORE_BUILD" = "1" ]; then
  echo "→ Building AAB (release, upload key required)"
  ( cd android && ./gradlew :app:bundleRelease -PSPSM_REQUIRE_UPLOAD_KEY=1 )

  OUT="android/app/build/outputs/bundle/release/app-release.aab"
  test -f "$OUT" || fail "No AAB at $OUT — the build failed. Read the Gradle output above."

  echo
  echo "✓ Done"
  echo "   $OUT"
  echo "   $(du -h "$OUT" | cut -f1)"
  echo
  echo "  Upload at play.google.com/console → Production → Create new release."
  echo "  The '[spsm] release signing' line above says which key signed it; it must"
  echo "  name the church upload key and not the debug one."
else
  echo "→ Building APK (release, debug-signed — runnable, not uploadable)"
  ( cd android && ./gradlew :app:assembleRelease )

  OUT="android/app/build/outputs/apk/release/app-release.apk"
  test -f "$OUT" || fail "No APK at $OUT — the build failed. Read the Gradle output above."

  echo
  echo "✓ Done"
  echo "   $OUT"
  echo "   $(du -h "$OUT" | cut -f1)"
  echo
  echo "  Install it:  adb install -r $OUT"
  echo "  Run ./reset-android.sh --store for an AAB you intend to upload."
fi
