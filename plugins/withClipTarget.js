/**
 * The five things the App Clip target needs that `react-native-app-clip`
 * does not give it.
 *
 * All five were found by generating the project and reading it, and each one
 * would break the clip in a way that looks like something else:
 *
 *   1. **Its own JS entry.** Without it the clip bundles expo-router, and the
 *      router's `require.context` over `app/` drags in every screen, the upload
 *      queue, SQLite and the background task. Measured: swapping a component
 *      underneath the router took the clip bundle from 1,930 modules to 1,931 —
 *      it added the replacement and removed nothing. The failure shows up as a
 *      build rejected for size, with nothing on screen to say why.
 *
 *   2. **The App Attest entitlement.** The app target gets
 *      `com.apple.developer.devicecheck.appattest-environment` from
 *      `ios.entitlements` in app.config.ts. The clip's entitlements file is
 *      written by the clip plugin and does not inherit it, so App Check would
 *      fail in the clip for a trivial reason and be mistaken for the
 *      interesting one.
 *
 *   3. **A `GoogleService-Info.plist`.** The clip target ships none at all, so
 *      React Native Firebase cannot initialise and nothing else can be tested.
 *
 *   4. **A bridging header.** `@react-native-firebase/app-check`'s prebuild mod
 *      writes `RNFBAppCheckModule.sharedInstance()` into *every* AppDelegate it
 *      finds, the clip's included, but creates the bridging header that puts
 *      that Objective-C class in Swift scope for the app target only. The clip
 *      then fails to compile with `cannot find 'RNFBAppCheckModule' in scope` —
 *      a message that reads like a missing pod, when the pod is linked and it
 *      is only Swift that cannot see it. Deleting the generated block is not
 *      the way out: it carries `FirebaseApp.configure()` with it.
 *
 *   5. **A bundle phase that can find `@expo/cli`.** The clip plugin's own
 *      phase resolves it as a bare `require.resolve('@expo/cli')`, which only
 *      works when npm happens to hoist that package to the top-level
 *      `node_modules`. Here it does not — it sits under
 *      `node_modules/expo/node_modules/@expo/cli` — so the resolve throws,
 *      `CLI_PATH` never gets set, and react-native-xcode.sh falls back to
 *      `@react-native-community/cli`, which this project does not depend on.
 *      **This breaks Release builds of the whole app, not just the clip**:
 *      the app target embeds the clip, so the clip's failure takes the app's
 *      `.app` down with it and the only thing on screen is a suggestion to
 *      add a CLI to devDependencies that nothing here should need.
 *
 * On (3), which is the whole question the spike exists to answer: the file
 * copied in is the **parent app's**, whose `BUNDLE_ID` says `org.spsm.connect`
 * while the process it runs in is `org.spsm.connect.Clip`. That mismatch is
 * deliberate. Apple's App Attest, used inside an App Clip, attests against the
 * *parent* application's identifier — so the parent's configuration is the one
 * that could conceivably match the attestation. If RNFB refuses it outright, or
 * accepts it and App Check still will not mint a token, that is the finding.
 */
const { withInfoPlist, withXcodeProject } = require('@expo/config-plugins');
const PbxFile = require('xcode/lib/pbxFile');
const fs = require('node:fs');
const path = require('node:path');
const plist = require('@expo/plist').default;

/** Must match the file at the project root. */
const CLIP_ENTRY = 'index.clip.ts';

/** Bare, because the clip's own group supplies the directory. See below. */
const PLIST = 'GoogleService-Info.plist';

module.exports = function withClipTarget(config, { targetSuffix = 'Clip' } = {}) {
  /*
   * Two mods, in two phases, and the split is forced rather than stylistic.
   *
   * Config-plugin mods of the same kind compose by wrapping, so the plugin
   * listed *later* runs *first* — which is why this plugin sits ABOVE
   * react-native-app-clip in app.config.ts. But the phases themselves run in a
   * fixed order, and the clip plugin does its work across two of them:
   *
   *   xcodeproj   `withXcode` creates the target, its build configurations and
   *               its PBXGroup. Editing the project has to happen after that.
   *   infoPlist   `withEntitlements` is a `withInfoPlist` mod, and it is what
   *               creates the target's directory and writes its `.entitlements`.
   *               That phase runs *after* xcodeproj, so anything touching those
   *               files from an xcodeproj mod finds nothing — which is exactly
   *               what "found no entitlements file" meant when this was one mod.
   *
   * So: project edits in the first, file edits in the second. A pbxproj
   * reference to a file that is written a phase later is fine — Xcode resolves
   * the path at build time, not now.
   */
  const project = withXcodeProject(config, (mod) => {
    setEntryFile(mod.modResults, targetSuffix);
    fixClipBundlePhase(mod.modResults);
    referenceGoogleService(mod, mod.modResults, targetSuffix);
    setBridgingHeader(mod, mod.modResults, targetSuffix);
    return mod;
  });

  return withInfoPlist(project, (mod) => {
    addAppAttest(mod, targetSuffix);
    copyGoogleService(mod, targetSuffix);
    writeBridgingHeader(mod, targetSuffix);
    return mod;
  });
};

/* -------------------------------------------------------------------------- */
/* 1. ENTRY_FILE                                                              */
/* -------------------------------------------------------------------------- */

/**
 * The clip plugin's bundle phase resolves the entry like this:
 *
 *     if [[ -z "$ENTRY_FILE" ]]; then
 *       export ENTRY_FILE="$(... expo/scripts/resolveAppEntry ...)"
 *     fi
 *
 * That resolver does not consult Metro's `sourceExts`, so `index.clip.ts` is
 * never found by it and both targets get `index.ts`. The `-z` is the way in:
 * set ENTRY_FILE as a build setting and the script leaves it alone.
 */
function setEntryFile(project, targetSuffix) {
  const configurations = project.pbxXCBuildConfigurationSection();
  let touched = 0;

  for (const key of Object.keys(configurations)) {
    const entry = configurations[key];
    if (!entry || typeof entry !== 'object' || !entry.buildSettings) continue;

    const bundleId = String(entry.buildSettings.PRODUCT_BUNDLE_IDENTIFIER ?? '').replace(/"/g, '');
    if (!bundleId.endsWith(`.${targetSuffix}`)) continue;

    entry.buildSettings.ENTRY_FILE = `"${CLIP_ENTRY}"`;
    touched += 1;
  }

  if (touched === 0) throw new Error(missing(targetSuffix, 'build configuration'));
}

/* -------------------------------------------------------------------------- */
/* 1b. CLI_PATH in the clip's bundle phase                                    */
/* -------------------------------------------------------------------------- */

/** What the clip plugin writes, and what it should have written. */
const BARE_RESOLVE = "require.resolve('@expo/cli')";
const ANCHORED_RESOLVE =
  "require.resolve('@expo/cli', { paths: [require.resolve('expo/package.json')] })";

/**
 * Resolve `@expo/cli` from `expo` rather than from the current directory.
 *
 * The app target's own bundle phase — written by Expo's prebuild — already
 * does it this way, and the difference matters because `@expo/cli` is a
 * dependency of `expo`, not of this project. Whether it lands in the top-level
 * `node_modules` is entirely up to npm's hoisting, and here it does not: it is
 * at `node_modules/expo/node_modules/@expo/cli`, so a bare resolve throws.
 *
 * What makes that expensive to diagnose is where the error surfaces. The
 * resolve runs inside `$(...)`, so its failure is discarded, `CLI_PATH` is
 * left empty, and react-native-xcode.sh quietly takes its non-Expo path and
 * shells out to `@react-native-community/cli`. The build then fails with that
 * package's "not installed" notice, advising a devDependency — so the visible
 * error names a CLI this project has never used and says nothing about
 * `@expo/cli`, hoisting, or the clip.
 *
 * Anchoring to `expo/package.json` is hoist-proof in both directions: node
 * looks in `expo`'s own `node_modules` first and walks up to the top level
 * anyway, so this keeps working if a future install does hoist it.
 *
 * Matched on the script's text rather than on a phase name or a target uuid.
 * The clip's phase and the app's are both called `Bundle React Native code and
 * images`, and the app's is already correct — but it is also already anchored,
 * so it does not contain the bare form and is left alone by construction. The
 * count is asserted: if react-native-app-clip ever fixes this upstream there
 * will be nothing to replace, and that should be noticed rather than silently
 * passed over.
 */
function fixClipBundlePhase(project) {
  const phases = project.hash?.project?.objects?.PBXShellScriptBuildPhase ?? {};
  let touched = 0;

  for (const key of Object.keys(phases)) {
    const phase = phases[key];
    if (!phase || typeof phase !== 'object' || typeof phase.shellScript !== 'string') continue;
    if (!phase.shellScript.includes(BARE_RESOLVE)) continue;

    phase.shellScript = phase.shellScript.split(BARE_RESOLVE).join(ANCHORED_RESOLVE);
    touched += 1;
  }

  if (touched === 0) {
    throw new Error(
      'withClipTarget: found no bundle phase resolving @expo/cli the unhoisted way. ' +
        'react-native-app-clip may have fixed this upstream — if so, delete ' +
        'fixClipBundlePhase() and this check. Do not ignore it: the symptom if it is ' +
        'genuinely missing is a Release build failing with a @react-native-community/cli ' +
        'notice that says nothing about the real cause.',
    );
  }
}

/* -------------------------------------------------------------------------- */
/* 2. App Attest                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Copy the environment the app target uses rather than naming one here.
 *
 * Two entitlements that disagree about development versus production is a
 * failure whose only symptom is App Attest declining to vouch, on one target,
 * in one build configuration. Reading it off the app's own entitlements keeps
 * the two in step by construction.
 */
function addAppAttest(mod, targetSuffix) {
  const environment =
    mod.ios?.entitlements?.['com.apple.developer.devicecheck.appattest-environment'];
  if (!environment) return;

  const file = clipFile(mod, targetSuffix, `${clipTargetName(mod, targetSuffix)}.entitlements`);
  if (!fs.existsSync(file)) throw new Error(missing(targetSuffix, 'entitlements file'));

  const entitlements = plist.parse(fs.readFileSync(file, 'utf8'));
  if (entitlements['com.apple.developer.devicecheck.appattest-environment'] === environment) return;

  entitlements['com.apple.developer.devicecheck.appattest-environment'] = environment;
  fs.writeFileSync(file, plist.build(entitlements));
}

/* -------------------------------------------------------------------------- */
/* 3. GoogleService-Info.plist                                                */
/* -------------------------------------------------------------------------- */

/**
 * A reference in the clip's resources build phase.
 *
 * Copying the file is not enough on its own: without this the plist is never
 * bundled into the clip and React Native Firebase finds nothing at runtime,
 * which is indistinguishable from App Check failing — the exact confusion the
 * spike is meant to avoid.
 *
 * Done by hand rather than with node-xcode's `addResourceFile`, which cannot
 * see this phase. That helper finds a target's resources phase by looking for
 * one *named* `Resources`, and the clip plugin names the clip's phase
 * `Embed App Clips`. The lookup returns null and the helper then dereferences
 * it — which surfaces as `Cannot read properties of null (reading 'path')`, a
 * message that says nothing about the actual cause.
 */
function referenceGoogleService(mod, project, targetSuffix) {
  if (!mod.ios?.googleServicesFile) return;

  const target = clipTargetName(mod, targetSuffix);
  const uuid = clipTargetUuid(project, targetSuffix);
  if (!uuid) throw new Error(missing(targetSuffix, 'native target'));

  const phase = resourcesPhaseFor(project, uuid);
  if (!phase) throw new Error(missing(targetSuffix, 'resources build phase'));

  const group = groupUuidFor(project, target);
  if (alreadyReferenced(project, phase)) return;

  /*
   * A **bare filename**, not `SPSMConnectClip/GoogleService-Info.plist`.
   *
   * The clip's PBXGroup already carries `path = SPSMConnectClip`, and a file
   * reference inside a group with `sourceTree = "<group>"` is resolved relative
   * to it. Giving the full path here produced
   * `ios/SPSMConnectClip/SPSMConnectClip/GoogleService-Info.plist` and a build
   * failure — "Build input file cannot be found" — naming a directory that
   * exists once, doubled. The app target's own reference looks different
   * (`SPSMConnect/GoogleService-Info.plist`) precisely because Expo adds it to
   * the *root* group, which has no path of its own.
   */
  const file = new PbxFile(PLIST, { lastKnownFileType: 'text.plist.xml' });
  file.uuid = project.generateUuid();
  file.fileRef = project.generateUuid();
  file.target = uuid;

  project.addToPbxFileReferenceSection(file);
  project.addToPbxBuildFileSection(file);
  phase.files.push({ value: file.uuid, comment: `${PLIST} in Resources` });

  if (group) project.addToPbxGroup(file, group);
}

/**
 * Whether the clip's resources phase already lists the plist.
 *
 * Checked through the phase rather than by searching the whole project for the
 * filename: the app target has a reference to a file of exactly the same name,
 * so any string match across the pbxproj finds it and concludes, wrongly, that
 * there is nothing to do.
 */
function alreadyReferenced(project, phase) {
  const buildFiles = project.pbxBuildFileSection();
  const fileRefs = project.pbxFileReferenceSection();

  return (phase.files ?? []).some((entry) => {
    const build = buildFiles[entry.value];
    const ref = build && fileRefs[build.fileRef];
    return String(ref?.path ?? '').replace(/"/g, '') === PLIST;
  });
}

/**
 * The clip target's resources phase, found through the target rather than by
 * name — see the note above for why the name is not usable.
 */
function resourcesPhaseFor(project, targetUuid) {
  const target = project.pbxNativeTargetSection()[targetUuid];
  const phases = project.hash.project.objects.PBXResourcesBuildPhase ?? {};

  for (const entry of target?.buildPhases ?? []) {
    const phase = phases[entry.value];
    if (phase && typeof phase === 'object' && Array.isArray(phase.files)) return phase;
  }
  return null;
}

/**
 * The parent app's plist, into the clip's target directory.
 *
 * **The parent's, deliberately.** Its `BUNDLE_ID` says `org.spsm.connect` while
 * the process it will run in is `org.spsm.connect.Clip`, and that mismatch is
 * the whole question: Apple's App Attest, used inside an App Clip, attests
 * against the *parent* application's identifier, so the parent's configuration
 * is the only one that could match the attestation. Whether Firebase agrees is
 * what src/clip/AppCheckSpike.tsx exists to find out.
 */
function copyGoogleService(mod, targetSuffix) {
  const source = mod.ios?.googleServicesFile;
  if (!source) return;

  const from = path.resolve(mod.modRequest.projectRoot, source);
  /*
   * Absent is not fatal here — the app target's own copy step fails first and
   * says so plainly, and README.md lists this as one of the three things that
   * must be in place before anything builds at all.
   */
  if (!fs.existsSync(from)) return;

  fs.copyFileSync(from, clipFile(mod, targetSuffix, 'GoogleService-Info.plist'));
}

/* -------------------------------------------------------------------------- */
/* 4. Bridging header                                                         */
/* -------------------------------------------------------------------------- */

/** Xcode resolves this setting relative to the .xcodeproj's directory. */
function bridgingHeaderPath(mod, targetSuffix) {
  const target = clipTargetName(mod, targetSuffix);
  return `${target}/${target}-Bridging-Header.h`;
}

/**
 * Point the clip's build configurations at a bridging header of its own.
 *
 * Matched on the bundle id rather than the target name, for the same reason
 * setEntryFile does: the configuration objects carry the id, and it is the one
 * field that distinguishes the clip's Debug and Release from the app's.
 */
function setBridgingHeader(mod, project, targetSuffix) {
  const header = bridgingHeaderPath(mod, targetSuffix);
  const configurations = project.pbxXCBuildConfigurationSection();
  let touched = 0;

  for (const key of Object.keys(configurations)) {
    const entry = configurations[key];
    if (!entry || typeof entry !== 'object' || !entry.buildSettings) continue;

    const bundleId = String(entry.buildSettings.PRODUCT_BUNDLE_IDENTIFIER ?? '').replace(/"/g, '');
    if (!bundleId.endsWith(`.${targetSuffix}`)) continue;

    entry.buildSettings.SWIFT_OBJC_BRIDGING_HEADER = `"${header}"`;
    touched += 1;
  }

  if (touched === 0) throw new Error(missing(targetSuffix, 'build configuration'));
}

/**
 * Mirror the app target's bridging header rather than naming its contents here.
 *
 * Same reasoning as addAppAttest: the app's header is written by whichever
 * config plugins need Objective-C in Swift scope, and that set will change. A
 * copy tracks it; a hardcoded `#import "RNFBAppCheckModule.h"` would be correct
 * today and silently wrong the first time another plugin adds a second import.
 *
 * If the app has no bridging header there is nothing to mirror and nothing to
 * fix — the generated block that needs one is not there either.
 */
function writeBridgingHeader(mod, targetSuffix) {
  const app = mod.modRequest.projectName;
  const from = path.join(mod.modRequest.platformProjectRoot, app, `${app}-Bridging-Header.h`);
  if (!fs.existsSync(from)) return;

  const to = clipFile(mod, targetSuffix, `${clipTargetName(mod, targetSuffix)}-Bridging-Header.h`);
  const contents = fs.readFileSync(from, 'utf8');

  if (fs.existsSync(to) && fs.readFileSync(to, 'utf8') === contents) return;
  fs.writeFileSync(to, contents);
}

/* -------------------------------------------------------------------------- */
/* Shared                                                                     */
/* -------------------------------------------------------------------------- */

/** `SPSMConnectClip` — the sanitised project name with the suffix appended. */
function clipTargetName(mod, targetSuffix) {
  return `${mod.modRequest.projectName}${targetSuffix}`;
}

function clipFile(mod, targetSuffix, file) {
  return path.join(mod.modRequest.platformProjectRoot, clipTargetName(mod, targetSuffix), file);
}

function clipTargetUuid(project, targetSuffix) {
  const targets = project.pbxNativeTargetSection();
  for (const key of Object.keys(targets)) {
    const target = targets[key];
    if (!target || typeof target !== 'object') continue;
    if (String(target.name ?? '').replace(/"/g, '').endsWith(targetSuffix)) return key;
  }
  return null;
}

function groupUuidFor(project, name) {
  const groups = project.hash.project.objects.PBXGroup ?? {};
  for (const key of Object.keys(groups)) {
    const group = groups[key];
    if (group && typeof group === 'object' && String(group.name ?? '').replace(/"/g, '') === name) {
      return key;
    }
  }
  return undefined;
}

function missing(targetSuffix, what) {
  return (
    `withClipTarget: found no ${what} for the "${targetSuffix}" target. ` +
    'Xcode mods compose by wrapping, so the plugin listed LATER runs FIRST — ' +
    'this one must appear ABOVE react-native-app-clip in app.config.ts.'
  );
}
