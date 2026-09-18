/**
 * The App Clip target — native SwiftUI, linking no pods.
 *
 * ---------------------------------------------------------------------------
 * ## Why this replaced the React Native clip
 *
 * The clip was built with `react-native-app-clip`, and it was rejected on
 * upload:
 *
 *     90865: Thinned App Clip size is too large. The main bundle of the
 *     "/Payload/SPSM Connect.app" App Clip is 61 MB … must be less than 15 MB.
 *
 * Measured, that 61 MB was not fat to trim. `React.framework` is 11.6 MB and
 * `hermesvm.framework` is 4.9 MB, and those two alone — before a line of this
 * church's code — are 16.5 MB. React Native 0.86 ships them as prebuilt dynamic
 * frameworks, and an App Clip is an independent bundle that must carry its own
 * copies. There is no configuration that removes them.
 *
 * The 100 MB tier does not apply and never will here. Apple grants it only to
 * clips that support **digital invocations alone** — a link on a website or in
 * Spotlight — and explicitly not to App Clip Codes, QR codes or NFC tags. Every
 * invocation this parish has is a tag by a door or a code on a printed card, so
 * 15 MB is the ceiling for as long as that is true.
 *
 * So the clip is Swift. It links no pods, carries no JavaScript engine, and
 * talks to the church's systems over REST — the same conclusion Taksis reached
 * for the vehicle registration clip on this same domain, and
 * `plugins/withVehicleAppClip.js` in that repo is what this is ported from.
 *
 * ## What that costs, stated plainly
 *
 * The React Native clip shared screens with the app — `/c/welcome` rendered the
 * very same `TourScreen` the app does, so the words could never drift. This
 * cannot. `about/tour.ts` is 842 lines of prose and `about/future.ts` is 497,
 * and a Swift copy of either would be a second original that goes stale the
 * first time the church edits the page.
 *
 * So the long-form experiences do not copy it. They draw a native card and hand
 * the reading to the church's own page in `SFSafariViewController`, which is
 * always current, is what `aboutOverrides` already edits, and costs the clip
 * nothing. What stays native is everything a person came to a tag to *do*: see
 * this week, send a photograph, open a form, give.
 *
 * ## `ios/` is generated, which is why this is a plugin
 *
 * Anything added to the Xcode project by hand dies at the next
 * `expo prebuild --clean`. The sources live in `ios-appclip/` and are copied in
 * on every prebuild.
 * ---------------------------------------------------------------------------
 */
const { withXcodeProject, withDangerousMod } = require('@expo/config-plugins');
const plist = require('@expo/plist').default;
const fs = require('node:fs');
const path = require('node:path');

const TARGET_NAME = 'SPSMConnectClip';
const SOURCE_DIR = 'ios-appclip/SPSMConnectClip';

/**
 * 16.4, and it is **Apple's floor for App Clips**, not a dependency's.
 *
 * This was set to 16.0 on the reasoning that 16.4 had only ever been
 * `expo-modules-core`'s requirement — the old clip's AppDelegate imported Expo,
 * and a native clip imports none. That reasoning was wrong, and App Store
 * Connect said so after the archive had uploaded:
 *
 *     90838: Invalid MinimumOSVersion. The Info.plist for app clip
 *     'SPSMConnect.app/AppClips/SPSMConnectClip.app' has an invalid
 *     MinimumOSVersion value of '16.0'. The version number should be three
 *     dot-separated integers with a minimum OS of '16.4' or later.
 *
 * So 16.4 is the floor regardless of what the clip is written in, and the
 * devices on 16.0 to 16.3 that dropping to 16.0 appeared to buy were never
 * available. They fall back to the website page every tag already carries.
 *
 * It must not exceed the app's own deployment target either — a clip that
 * requires a newer iOS than its parent cannot be installed by everyone who can
 * install the parent. Both are 16.4 today; `reset-ios.sh` checks the pair.
 */
const DEPLOYMENT_TARGET = '16.4';

/** Apple requires the clip's id to be the parent's plus exactly one component. */
const BUNDLE_ID_SUFFIX = 'Clip';

/**
 * Both hosts, and `www.` on the church's own domain rather than the apex.
 *
 * The apex answers 301 for every path, `/.well-known/` included, and Apple
 * follows no redirect either for an invocation URL or when fetching the
 * association file — so an apex entry is an association that can never
 * validate, and the only symptom is a tag opening Safari. `reset-ios.sh` checks
 * this after every prebuild because it is invisible otherwise.
 */
const ASSOCIATED_DOMAINS = ['www.spsmwayland.org', 'spsm-database.web.app'];

/** Where Xcode's Run action points, so a fresh checkout can just press Run. */
const DEBUG_INVOCATION_URL = `https://${ASSOCIATED_DOMAINS[0]}/c/schedule`;

const SWIFT_FILES = [
  'SPSMConnectClipApp.swift',
  'ClipConfig.swift',
  'ClipDestination.swift',
  'ClipRouter.swift',
  'RootView.swift',
  'Theme.swift',
  'Chrome.swift',
  'Handoff.swift',
  'FirestoreREST.swift',
  'GiveView.swift',
  'AppsView.swift',
  'BookstoreView.swift',
  'PlansView.swift',
  'WelcomeView.swift',
  'ScheduleView.swift',
  'FormsView.swift',
  'PhotosView.swift',
  'AppAttest.swift',
  'UploadClient.swift',
];

const RESOURCE_FILES = ['Assets.xcassets'];
const REFERENCE_ONLY_FILES = ['Info.plist', `${TARGET_NAME}.entitlements`];

/* ── 1. Copy the checked-in sources into ios/ ──────────────────────────────── */

const withClipSources = (config) =>
  withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const src = path.join(cfg.modRequest.projectRoot, SOURCE_DIR);
      const dest = path.join(cfg.modRequest.platformProjectRoot, TARGET_NAME);

      if (!fs.existsSync(src)) {
        throw new Error(
          `[withNativeClip] Expected the clip's Swift sources at ${SOURCE_DIR}, which does not exist.`,
        );
      }

      fs.rmSync(dest, { recursive: true, force: true });
      fs.cpSync(src, dest, { recursive: true });

      /*
       * The entitlements are stamped from the constants above rather than
       * trusted as checked in, so the domains and the App Attest environment
       * cannot drift from what app.config.ts decided. Everything else in the
       * file — app groups, the parent identifier, on-demand-install-capable —
       * is static and comes from the checked-in copy.
       */
      const file = path.join(dest, `${TARGET_NAME}.entitlements`);
      const entitlements = plist.parse(fs.readFileSync(file, 'utf8'));

      entitlements['com.apple.developer.associated-domains'] =
        ASSOCIATED_DOMAINS.flatMap((host) => [`applinks:${host}`, `appclips:${host}`]);

      entitlements['com.apple.developer.parent-application-identifiers'] = [
        `$(AppIdentifierPrefix)${cfg.ios.bundleIdentifier}`,
      ];

      /*
       * The same value the app target gets, from the same expression in
       * app.config.ts. A clip signed for one environment while the app is
       * signed for the other fails attestation in a way that reads as App Check
       * being broken rather than as a signing mismatch.
       */
      const attest = cfg.ios?.entitlements?.['com.apple.developer.devicecheck.appattest-environment'];
      if (attest) {
        entitlements['com.apple.developer.devicecheck.appattest-environment'] = attest;
      }

      fs.writeFileSync(file, plist.build(entitlements));
      return cfg;
    },
  ]);

/* ── 2. Create the target ──────────────────────────────────────────────────── */

const withClipTarget = (config) =>
  withXcodeProject(config, (cfg) => {
    const proj = cfg.modResults;

    // prebuild can run a mod more than once, and a project with two targets of
    // the same name is one Xcode refuses to open.
    const existing = findTargetByName(proj, TARGET_NAME);
    if (existing) {
      writeClipScheme(cfg, existing);
      return cfg;
    }

    const clipBundleId = `${cfg.ios.bundleIdentifier}.${BUNDLE_ID_SUFFIX}`;

    // `xcode` has no App Clip product type, so make an application and correct it.
    const target = proj.addTarget(TARGET_NAME, 'application', TARGET_NAME, clipBundleId);
    proj.pbxNativeTargetSection()[target.uuid].productType =
      '"com.apple.product-type.application.on-demand-install-capable"';

    // addTarget creates no build phases.
    proj.addBuildPhase([], 'PBXSourcesBuildPhase', 'Sources', target.uuid);
    proj.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', target.uuid);
    proj.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', target.uuid);

    const group = proj.addPbxGroup([], TARGET_NAME, TARGET_NAME);
    proj.addToPbxGroup(group.uuid, proj.getFirstProject().firstProject.mainGroup);

    for (const file of SWIFT_FILES) {
      proj.addSourceFile(file, { target: target.uuid }, group.uuid);
    }
    for (const file of RESOURCE_FILES) {
      addResourceFile(proj, file, group.uuid, target.uuid);
    }
    for (const file of REFERENCE_ONLY_FILES) {
      proj.addFile(file, group.uuid, { lastKnownFileType: 'text.plist.xml' });
    }

    applyBuildSettings(proj, target, cfg, clipBundleId);
    embedIntoMainApp(proj, target, cfg);
    writeClipScheme(cfg, target.uuid);

    return cfg;
  });

/**
 * `xcode`'s own addResourceFile calls `correctForResourcesPath`, which
 * dereferences a group literally named "Resources". Expo projects have none, so
 * that path throws. This does the same work without the lookup.
 */
function addResourceFile(proj, filename, groupId, targetId) {
  const file = proj.addFile(filename, groupId, { lastKnownFileType: 'folder.assetcatalog' });
  if (!file) return;

  file.uuid = proj.generateUuid();
  file.target = targetId;
  proj.addToPbxBuildFileSection(file);
  proj.addToPbxResourcesBuildPhase(file);
}

function findTargetByName(proj, name) {
  const targets = proj.pbxNativeTargetSection();
  return Object.keys(targets).find(
    (key) => !key.endsWith('_comment') && stripQuotes(targets[key].name) === name,
  );
}

function stripQuotes(value) {
  return typeof value === 'string' ? value.replace(/^"|"$/g, '') : value;
}

function applyBuildSettings(proj, target, cfg, clipBundleId) {
  const teamId = cfg.ios?.appleTeamId;
  if (!teamId) {
    throw new Error(
      '[withNativeClip] ios.appleTeamId is missing from app.config.ts. The App Clip target ' +
        'needs it to sign, and inherits nothing from the app target.',
    );
  }

  const configurations = proj.pbxXCBuildConfigurationSection();
  const listId = proj.pbxNativeTargetSection()[target.uuid].buildConfigurationList;

  for (const { value: configId } of proj.pbxXCConfigurationList()[listId].buildConfigurations) {
    const settings = configurations[configId].buildSettings;

    Object.assign(settings, {
      PRODUCT_NAME: `"${TARGET_NAME}"`,
      PRODUCT_BUNDLE_IDENTIFIER: `"${clipBundleId}"`,
      INFOPLIST_FILE: `"${TARGET_NAME}/Info.plist"`,
      GENERATE_INFOPLIST_FILE: 'NO',
      CODE_SIGN_ENTITLEMENTS: `"${TARGET_NAME}/${TARGET_NAME}.entitlements"`,
      CODE_SIGN_STYLE: 'Automatic',
      IPHONEOS_DEPLOYMENT_TARGET: DEPLOYMENT_TARGET,
      SWIFT_VERSION: '5.0',
      TARGETED_DEVICE_FAMILY: '"1,2"',
      ASSETCATALOG_COMPILER_APPICON_NAME: 'AppIcon',
      /*
       * The app's version and build, not the clip's own. App Store Connect
       * rejects a clip whose either value differs from its parent — after the
       * whole archive has uploaded. `BUILD` in app.config.ts feeds both.
       */
      MARKETING_VERSION: `"${cfg.version ?? '1.0.0'}"`,
      CURRENT_PROJECT_VERSION: `"${cfg.ios?.buildNumber ?? '1'}"`,
      ENABLE_BITCODE: 'NO',
      /*
       * YES, because the clip ships *inside* the app. NO would put
       * SPSMConnectClip.app at Products/Applications beside SPSMConnect.app,
       * and an archive with two top-level apps is not a valid submission: the
       * Organizer cannot tell which to distribute, so it hides "TestFlight &
       * App Store" and offers only "Custom", explaining nothing.
       */
      SKIP_INSTALL: 'YES',
      SWIFT_EMIT_LOC_STRINGS: 'YES',
      LD_RUNPATH_SEARCH_PATHS: '"$(inherited) @executable_path/Frameworks"',
      /*
       * The clip links no pods, so it must not inherit the app's Pods xcconfig
       * search paths — that is what dragged Square's framework into the old
       * clip and produced the 90205 "disallowed nested bundles" rejection.
       */
      OTHER_LDFLAGS: '"$(inherited)"',
    });

    /*
     * Per-target, and not inherited from the app. Omitting it fails a device or
     * archive build with "Signing for SPSMConnectClip requires a development
     * team", which reads like a project misconfiguration rather than a missing
     * value — so this throws at prebuild instead, where the cause is obvious.
     */
    settings.DEVELOPMENT_TEAM = teamId;

    if (stripQuotes(configurations[configId].name) === 'Debug') {
      Object.assign(settings, {
        SWIFT_ACTIVE_COMPILATION_CONDITIONS: 'DEBUG',
        SWIFT_OPTIMIZATION_LEVEL: '"-Onone"',
        DEBUG_INFORMATION_FORMAT: 'dwarf',
        ONLY_ACTIVE_ARCH: 'YES',
      });
    } else {
      Object.assign(settings, {
        SWIFT_OPTIMIZATION_LEVEL: '"-O"',
        SWIFT_COMPILATION_MODE: 'wholemodule',
        DEBUG_INFORMATION_FORMAT: '"dwarf-with-dsym"',
        VALIDATE_PRODUCT: 'YES',
      });
    }

    delete settings.PROVISIONING_PROFILE_SPECIFIER;
  }
}

/** The app depends on the clip and embeds it, so building the app builds both. */
function embedIntoMainApp(proj, target, cfg) {
  const mainTargetId = findMainAppTarget(proj, cfg.modRequest.projectName);
  if (!mainTargetId) {
    throw new Error('[withNativeClip] Could not find the main app target to embed the clip into.');
  }

  // addTargetDependency silently does nothing unless both of these exist, and a
  // freshly generated Expo project has neither.
  const objects = proj.hash.project.objects;
  objects.PBXTargetDependency = objects.PBXTargetDependency || {};
  objects.PBXContainerItemProxy = objects.PBXContainerItemProxy || {};
  proj.addTargetDependency(mainTargetId, [target.uuid]);

  const phase = proj.addBuildPhase(
    [],
    'PBXCopyFilesBuildPhase',
    'Embed App Clips',
    mainTargetId,
    'app_clips',
    '"$(CONTENTS_FOLDER_PATH)/AppClips"',
  );
  // `xcode` has no app_clips folder spec; 16 is Xcode's Products Directory,
  // which is what Embed App Clips actually uses.
  phase.buildPhase.dstSubfolderSpec = 16;
  phase.buildPhase.dstPath = '"$(CONTENTS_FOLDER_PATH)/AppClips"';
  phase.buildPhase.name = '"Embed App Clips"';
  phase.buildPhase.runOnlyForDeploymentPostprocessing = 0;

  const productRef = proj.pbxNativeTargetSection()[target.uuid].productReference;
  const buildFileId = proj.generateUuid();
  objects.PBXBuildFile[buildFileId] = {
    isa: 'PBXBuildFile',
    fileRef: productRef,
    settings: { ATTRIBUTES: ['RemoveHeadersOnCopy'] },
  };
  objects.PBXBuildFile[`${buildFileId}_comment`] = `${TARGET_NAME}.app in Embed App Clips`;

  phase.buildPhase.files.push({
    value: buildFileId,
    comment: `${TARGET_NAME}.app in Embed App Clips`,
  });
}

function findMainAppTarget(proj, projectName) {
  const targets = proj.pbxNativeTargetSection();
  const keys = Object.keys(targets).filter((k) => !k.endsWith('_comment'));

  if (projectName) {
    const exact = keys.find((k) => stripQuotes(targets[k].name) === projectName);
    if (exact) return exact;
  }
  return keys.find(
    (k) =>
      stripQuotes(targets[k].productType) === 'com.apple.product-type.application' &&
      stripQuotes(targets[k].name) !== TARGET_NAME,
  );
}

/**
 * A shared scheme, so the clip is runnable from Xcode at all.
 *
 * Called from inside `withClipTarget` rather than being its own mod: chained
 * mods of one type apply in reverse, so a step registered after it would run
 * before it and find no target to point at.
 *
 * Xcode autocreates schemes on open, but unshared ones, and `ios/` is
 * regenerated by every prebuild — so an autocreated scheme would not survive.
 * Store builds do not need it (the clip ships through the app's embed phase);
 * running the clip on a device does.
 */
function writeClipScheme(cfg, targetUuid) {
  const projectName = cfg.modRequest.projectName || 'SPSMConnect';
  const dir = path.join(
    cfg.modRequest.platformProjectRoot,
    `${projectName}.xcodeproj`,
    'xcshareddata',
    'xcschemes',
  );
  fs.mkdirSync(dir, { recursive: true });

  const ref = `            <BuildableReference
               BuildableIdentifier = "primary"
               BlueprintIdentifier = "${targetUuid}"
               BuildableName = "${TARGET_NAME}.app"
               BlueprintName = "${TARGET_NAME}"
               ReferencedContainer = "container:${projectName}.xcodeproj">
            </BuildableReference>`;

  const scheme = `<?xml version="1.0" encoding="UTF-8"?>
<Scheme LastUpgradeVersion = "1430" version = "1.3">
   <BuildAction parallelizeBuildables = "YES" buildImplicitDependencies = "YES">
      <BuildActionEntries>
         <BuildActionEntry buildForTesting = "YES" buildForRunning = "YES" buildForProfiling = "YES" buildForArchiving = "YES" buildForAnalyzing = "YES">
${ref}
         </BuildActionEntry>
      </BuildActionEntries>
   </BuildAction>
   <LaunchAction
      buildConfiguration = "Debug"
      selectedDebuggerIdentifier = "Xcode.DebuggerFoundation.Debugger.LLDB"
      selectedLauncherIdentifier = "Xcode.DebuggerFoundation.Launcher.LLDB"
      launchStyle = "0"
      useCustomWorkingDirectory = "NO"
      ignoresPersistentStateOnLaunch = "NO"
      debugDocumentVersioning = "YES"
      debugServiceExtension = "internal"
      allowLocationSimulation = "YES">
      <BuildableProductRunnable runnableDebuggingMode = "0">
${ref}
      </BuildableProductRunnable>
      <EnvironmentVariables>
         <EnvironmentVariable key = "_XCAppClipURL" value = "${DEBUG_INVOCATION_URL}" isEnabled = "YES">
         </EnvironmentVariable>
      </EnvironmentVariables>
   </LaunchAction>
   <ProfileAction buildConfiguration = "Release" shouldUseLaunchSchemeArgsEnv = "YES" savedToolIdentifier = "" useCustomWorkingDirectory = "NO" debugDocumentVersioning = "YES">
      <BuildableProductRunnable runnableDebuggingMode = "0">
${ref}
      </BuildableProductRunnable>
   </ProfileAction>
   <AnalyzeAction buildConfiguration = "Debug">
   </AnalyzeAction>
   <ArchiveAction buildConfiguration = "Release" revealArchiveInOrganizer = "YES">
   </ArchiveAction>
</Scheme>
`;

  fs.writeFileSync(path.join(dir, `${TARGET_NAME}.xcscheme`), scheme);
}

module.exports = function withNativeClip(config) {
  return withClipTarget(withClipSources(config));
};
