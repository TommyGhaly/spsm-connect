/**
 * Move Square's `setup` build phase after `[CP] Embed Pods Frameworks`, so it
 * actually runs.
 *
 * ## The failure
 *
 * `SquareInAppPaymentsSDK.framework` and `SquareBuyerVerificationSDK.framework`
 * ship **nested** frameworks — `CorePaymentCard` inside the first,
 * `ThreeDS_SDK` inside the second. Nothing loads a nested framework from there:
 * both SDKs reference `@rpath/CorePaymentCard.framework/CorePaymentCard`, and
 * their rpaths are `@executable_path/Frameworks` and `@loader_path/Frameworks`
 * — neither of which reaches one framework's `Frameworks` directory from
 * another. Square's answer is a script shipped inside the framework, `setup`,
 * which hoists the nested frameworks up into the app's own `Frameworks` folder
 * and re-signs them. Square's Expo plugin adds a build phase to invoke it.
 *
 * That phase lands in the wrong place, and the reason it is silent is its own
 * guard:
 *
 *     SETUP_SCRIPT=${BUILT_PRODUCTS_DIR}/${FRAMEWORKS_FOLDER_PATH}/SquareInAppPaymentsSDK.framework/setup
 *     if [ -f "${SETUP_SCRIPT}" ]; then ...
 *
 * `${FRAMEWORKS_FOLDER_PATH}` is only populated by `[CP] Embed Pods
 * Frameworks`. Run the phase before that and the file is not there yet, the
 * `if` is false, and the phase succeeds having done nothing. The frameworks are
 * then embedded still nested, and the app dies at launch — before any of its
 * own code runs — with no crash report and nothing on screen:
 *
 *     RBSProcessExitStatus| domain:dyld(6) code:1
 *     FrontBoard: flagged as pending exit for reason: launch failed
 *
 * ## Why this is a Podfile hook and not an Xcode mod
 *
 * The phase to order against, `[CP] Embed Pods Frameworks`, does not exist when
 * prebuild's `withXcodeProject` mods run — **CocoaPods** adds it later, during
 * `pod install`. A prebuild mod can only append, and CocoaPods then appends its
 * embed phase after whatever it finds, which is how Square's phase ends up
 * early no matter where a plugin puts it.
 *
 * ## `post_integrate`, not `post_install`
 *
 * This hook was `post_install` first, and that silently never worked. The
 * embed phase is added to the **user** project by CocoaPods' user-project
 * integrator, and `post_install` runs *before* that step — so the hook looked
 * for a phase that did not exist yet, hit its own `next if embed.nil?` guard,
 * and returned having done nothing. Verified against CocoaPods 1.16.2 by
 * running `pod install` and reading the phase order back out of the pbxproj:
 * Square's phase at index 7, the embed phase at 9, unchanged.
 *
 * `post_integrate` runs after integration, which is the first moment both
 * phases exist in the same project. It is the hook this always wanted.
 *
 * Moved to the **end** rather than to `embed + 1`: everything after the embed
 * phase is unrelated to frameworks, and last is the one position that stays
 * correct if CocoaPods changes what it appends.
 *
 * ## Why the Podfile hook is not enough on its own
 *
 * It only runs during `pod install`, and **prebuild undoes it**. Regenerating
 * the project rewrites the app target's build phases from Expo's own template
 * plus the config plugins, which puts Square's phase back where its plugin
 * appends it — before the embed phase. `pod install` is then skipped, because
 * `Podfile.lock` has not changed, so nothing puts it back:
 *
 *     npx expo prebuild --platform ios   # pod install runs, order fixed
 *     npx expo run:ios                   # prebuilds again, order broken,
 *                                        # pod install skipped, app crashes
 *
 * That is not a hypothetical ordering — `expo run:ios` prebuilds on its own,
 * so it is what an ordinary second build does. The symptom is the launch
 * crash above, on a build that compiled and signed perfectly.
 *
 * So the reorder is applied **twice, by two mechanisms**, and neither is
 * redundant:
 *
 *   dangerous mod   reorders the .pbxproj on every prebuild. Needs the embed
 *                   phase to already exist, so it does nothing on a project
 *                   that has never been pod-installed.
 *   Podfile hook    reorders during `pod install`, which is what covers that
 *                   first-ever install.
 *
 * Both are no-ops when the order is already right, so running both is safe.
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');

/**
 * Written by `react-native-square-in-app-payments`' own config plugin for the
 * app target, and by `plugins/withNativeClip.js` for the App Clip.
 *
 * Matched as a **prefix**, not an equality, and that is not tidiness. Square's
 * plugin skips its work entirely if a phase with its exact name already exists
 * anywhere in the project, so the clip's copy is named
 * `… Setup (Clip)` to stay out of its way — see the note beside `SETUP_PHASE`
 * in that file. Both need moving, and both start with this.
 */
const PHASE = '[CP] Square In-App Payments SDK Setup';

/** Added by CocoaPods during `pod install`. */
const EMBED = '[CP] Embed Pods Frameworks';

/** Marker, so repeated prebuilds do not stack copies of the hook. */
const MARKER = '# @generated withSquareSetupPhaseOrder';

/**
 * Anchors on the existing `post_install` block rather than adding one.
 *
 * CocoaPods allows a single `post_install` hook per Podfile — a second
 * definition silently replaces the first, which would drop
 * `react_native_post_install` and take the whole React Native build with it.
 * So this injects a call into the block Expo already generates.
 */
const HOOK = `${MARKER}
# See plugins/withSquareSetupPhaseOrder.js. Square's \`setup\` phase hoists the
# nested CorePaymentCard / ThreeDS_SDK frameworks up into the app's own
# Frameworks folder, and no-ops silently unless it runs after
# '${EMBED}' has put them there.
def square_setup_phase_runs_last(installer)
  installer.aggregate_targets.each do |aggregate|
    project = aggregate.user_project
    next if project.nil?

    changed = false
    project.native_targets.each do |target|
      phases = target.build_phases
      setup = phases.find { |p| p.respond_to?(:name) && p.name.to_s.start_with?('${PHASE}') }
      next if setup.nil?

      embed = phases.find { |p| p.respond_to?(:name) && p.name == '${EMBED}' }
      # No embed phase means nothing to order against; leave it where it is
      # rather than moving it somewhere that is wrong in a different way.
      next if embed.nil?
      next if phases.index(setup) > phases.index(embed)

      phases.delete(setup)
      phases << setup
      changed = true
    end

    project.save if changed
  end
end

post_integrate do |installer|
  square_setup_phase_runs_last(installer)
end
`;

/**
 * Move each setup phase after its own target's embed phase, in the .pbxproj.
 *
 * A dangerous mod rather than a `withXcodeProject` one, and that is forced
 * rather than chosen. `withXcodeProject` mods compose by wrapping, so the
 * plugin listed *later* in app.config.ts runs *first* — and this plugin is
 * listed after `react-native-square-in-app-payments`, so an Xcode mod here
 * would run before that plugin had added the phase there is to move. Listing
 * it earlier instead would fix the Xcode mod and break the Podfile edit, which
 * wants to be as late as possible. Dangerous mods run at the end of the
 * pipeline, after the project has been written, so this one sees the finished
 * file and needs no ordering at all.
 *
 * Edited as text rather than through `xcode`: the change is moving one line
 * within one array, and parsing a 1,500-line pbxproj to do it would be the
 * larger risk.
 *
 * ## Per target, since there are two
 *
 * This walked the whole file once and moved the first match, which was right
 * while only the app linked Square. The App Clip has its own copy of the
 * framework now — an App Clip is an independent bundle and embeds its own — so
 * there are two setup phases and two embed phases, and pairing them across
 * targets would move the app's phase after the clip's embed and fix neither.
 *
 * So the work is done inside each `buildPhases = ( … );` list, which is
 * exactly one target's, and a target with only one of the two phases is left
 * alone.
 */
function reorderProject(platformProjectRoot) {
  const candidates = fs
    .readdirSync(platformProjectRoot)
    .filter((name) => name.endsWith('.xcodeproj'))
    .map((name) => path.join(platformProjectRoot, name, 'project.pbxproj'))
    .filter((file) => fs.existsSync(file));

  for (const file of candidates) {
    const contents = fs.readFileSync(file, 'utf8');
    const next = contents.replace(/buildPhases = \(\n[\s\S]*?\n(\s*)\);/g, reorderList);
    if (next !== contents) fs.writeFileSync(file, next);
  }
}

/**
 * One target's phase list, with Square's line moved after the embed line.
 *
 * Both phases are referenced by `UUID /* Name *\/,` lines. The name is matched
 * as a prefix so that the clip's `… Setup (Clip)` is caught by the same pass.
 */
function reorderList(list) {
  const setup = new RegExp(`^\\t*[A-F0-9]{24} /\\* ${escapeRe(PHASE)}[^*]*\\*/,\\n`, 'm');
  const embed = new RegExp(`^\\t*[A-F0-9]{24} /\\* ${escapeRe(EMBED)} \\*/,\\n`, 'm');

  const setupMatch = list.match(setup);
  const embedMatch = list.match(embed);
  if (!setupMatch || !embedMatch) return list;
  if (setupMatch.index > embedMatch.index) return list;

  // Lift Square's line out and put it back directly after the embed line.
  const without = list.replace(setup, '');
  const embedAgain = without.match(embed);
  if (!embedAgain) return list;

  const at = embedAgain.index + embedAgain[0].length;
  return without.slice(0, at) + setupMatch[0] + without.slice(at);
}

function escapeRe(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** @type {import('@expo/config-plugins').ConfigPlugin} */
module.exports = function withSquareSetupPhaseOrder(config) {
  return withDangerousMod(config, [
    'ios',
    (mod) => {
      reorderProject(mod.modRequest.platformProjectRoot);

      const podfile = path.join(mod.modRequest.platformProjectRoot, 'Podfile');
      const contents = fs.readFileSync(podfile, 'utf8');

      if (contents.includes(MARKER)) return mod;

      /*
       * Prepended whole: the `def` and its `post_integrate` hook both go at the
       * top level. A `def` inside the `target` block CocoaPods evaluates is not
       * in scope for the hook, and `post_integrate` is a Podfile-level hook, so
       * neither belongs inside a target. Expo's own `post_install` block is
       * left completely untouched — nothing here needs to be inside it, and not
       * editing it means this cannot disturb `react_native_post_install`.
       */
      fs.writeFileSync(podfile, `${HOOK}\n${contents}`);
      return mod;
    },
  ]);
};
