/**
 * Actually exclude the excluded packages from the App Clip.
 *
 * ---------------------------------------------------------------------------
 * ## The bug this works around is upstream, and it is silent
 *
 * `react-native-app-clip`'s `excludedPackages` option is applied to exactly one
 * of the two autolinkers the clip target uses. Its `withPodfile` writes:
 *
 *     exclude = ["expo-media-library", …]
 *     use_expo_modules!(exclude: exclude)          ← the list is used here
 *     …
 *     '…cliPlugin.js\').run(' + json + ', [])'     ← and hardcoded empty here
 *
 * The second call is the one that handles **React Native community modules** —
 * anything that is not an Expo module. `cliPlugin.run(config, exclude)` deletes
 * each named package from `config.dependencies`, and it is being handed an
 * empty array, so it deletes nothing. See
 * node_modules/react-native-app-clip/plugin/build/withPodfile.js.
 *
 * The result is that every non-Expo entry in `excludedPackages` is linked into
 * the clip anyway, and nothing anywhere says so. In this project that was five
 * of the eleven: react-native-square-in-app-payments,
 * @react-native-firebase/messaging, @react-native-firebase/storage,
 * @shopify/flash-list and react-native-webview.
 *
 * ## How it surfaced, which was as late as it possibly could
 *
 * Not at build time — the clip built and ran. At **upload**, from App Store
 * Connect, after the whole archive had gone up:
 *
 *     Invalid Bundle. The bundle at 'SPSMConnect.app/AppClips/SPSM Connect.app/
 *     Frameworks/SquareInAppPaymentsSDK.framework' contains disallowed nested
 *     bundles.  (90205)
 *     … contains disallowed file 'Frameworks'.  (90206)
 *
 * Square's framework ships nested frameworks inside itself, and the script that
 * hoists them out — see plugins/withSquareSetupPhaseOrder.js — is attached to
 * the *app* target only. The clip got the framework without the fix-up, so the
 * nested bundles went to Apple exactly as Square ships them.
 *
 * Adding a second setup phase to the clip would have been the wrong repair. The
 * framework has no business being in a 15 MB budget it is never called from:
 * `index.clip.ts` cannot reach checkout, `paymentsAvailable()` is false in that
 * binary, and app.config.ts has listed it as excluded since the clip existed.
 * The bug was that "excluded" was not true.
 *
 * ## What this does
 *
 * Rewrites the `[]` into the real list, after react-native-app-clip has
 * generated the block.
 *
 * **Listed BEFORE 'react-native-app-clip' in app.config.ts**, which looks
 * backwards and is not: mods compose by wrapping, so the plugin registered
 * *later* runs *first*. This has to run once the block exists, so it goes
 * above — the same rule, and the same reason, as withClipTarget.
 *
 * It throws rather than shrugging if the anchor is missing, because a silent
 * no-op here restores exactly the failure it was written to prevent, and that
 * failure is only visible after a full upload.
 *
 * ## If the clip stops building after this
 *
 * That is this plugin working. Those five packages were being linked in all
 * along, so anything in the clip's import graph that reached one has been
 * silently satisfied by a dependency that was never supposed to be there.
 * app.config.ts's note on `excludedPackages` states the rule: anything listed
 * must also be unreachable from `index.clip.ts`. Until now nothing enforced it.
 * ---------------------------------------------------------------------------
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');

/**
 * The generated line's tail, as it appears in the Podfile.
 *
 * Matched on the literal `, [])'` that closes the `run(` call rather than on
 * the whole line, because the line carries escaped quotes whose exact form is
 * react-native-app-clip's to change. Asserted to appear exactly once — the
 * Podfile has one clip target, and matching twice would mean the file is not
 * the shape this assumes.
 */
const ANCHOR = "', [])'";

module.exports = function withClipExclusions(config, { excludedPackages } = {}) {
  if (!Array.isArray(excludedPackages) || excludedPackages.length === 0) {
    throw new Error(
      'withClipExclusions needs the same excludedPackages array that is given to ' +
        'react-native-app-clip. Pass it from app.config.ts rather than repeating it here.',
    );
  }

  return withDangerousMod(config, [
    'ios',
    (mod) => {
      const podfile = path.join(mod.modRequest.platformProjectRoot, 'Podfile');
      const contents = fs.readFileSync(podfile, 'utf8');

      const already = contents.includes('withClipExclusions');
      if (already) return mod;

      const found = contents.split(ANCHOR).length - 1;
      if (found !== 1) {
        throw new Error(
          `withClipExclusions expected exactly one \`${ANCHOR}\` in the Podfile and found ` +
            `${found}. react-native-app-clip has changed the block it generates — check ` +
            'whether it now passes excludedPackages to cliPlugin itself before keeping this ' +
            'plugin. Shipping without the fix puts Square back inside the clip, and that is ' +
            'only visible after a full upload to App Store Connect.',
        );
      }

      /*
       * Double quotes inside what is a Ruby single-quoted string, so nothing
       * needs escaping on either side. A package name containing a double quote
       * would break this and is not a thing npm allows.
       */
      const list = excludedPackages.map((name) => `"${name}"`).join(', ');

      fs.writeFileSync(
        podfile,
        contents.replace(
          ANCHOR,
          `', [${list}])' # withClipExclusions: react-native-app-clip hardcodes []`,
        ),
      );

      return mod;
    },
  ]);
};
