/**
 * Settle the one manifest attribute expo-notifications and
 * @react-native-firebase/messaging both claim.
 *
 * Both libraries write `com.google.firebase.messaging.default_notification_color`
 * into the merged manifest, and they disagree about its value:
 *
 *   expo-notifications   `@color/notification_icon_color`, generated in the app
 *                        module from the `color` option in app.config.ts
 *   RNFB messaging       `@color/white`, from a manifest placeholder in its own
 *                        library module
 *
 * The merger refuses to pick, and the build stops:
 *
 *   Execution failed for task ':app:processReleaseMainManifest'
 *   Attribute meta-data#com.google.firebase.messaging.default_notification_color
 *     @resource value=(@color/notification_icon_color) ... is also present at
 *     [:react-native-firebase_messaging] value=(@color/white)
 *   Suggestion: add 'tools:replace="android:resource"'
 *
 * ## Why not just make RNFB agree
 *
 * That was tried first and it is a trap worth recording, because it looks like
 * the tidier fix. RNFB reads `messaging_android_notification_color` out of
 * firebase.json and substitutes it into the placeholder — so setting it to
 * `@color/notification_icon_color` makes both sides name the same resource and
 * the merge conflict genuinely does go away.
 *
 * It then fails later and further away:
 *
 *   ':react-native-firebase_messaging:verifyReleaseResources'
 *   AAPT: error: resource color/notification_icon_color
 *     (aka io.invertase.firebase.messaging:color/notification_icon_color) not found
 *
 * The placeholder is substituted into RNFB's **own library module**, and a
 * library module is resource-verified on its own, against only what it and its
 * dependencies declare. `@color/notification_icon_color` is generated in the
 * *app* module by expo-notifications, so from inside the library it does not
 * exist. That is exactly why RNFB's default is `@color/white` — an
 * AndroidX colour every module can already see. firebase.json can only name
 * resources RNFB itself has, which the app's generated colour will never be.
 *
 * So the merger's own suggestion is the right answer after all, and this is
 * what it looks like: the app module states which of the two values wins. The
 * losing value is `@color/white`, a default nobody chose, and the winning one
 * is the church's `deep` — see the `color` option in app.config.ts.
 */
const { withAndroidManifest } = require('@expo/config-plugins');

const ATTRIBUTE = 'com.google.firebase.messaging.default_notification_color';

module.exports = function withNotificationColorMerge(config) {
  return withAndroidManifest(config, (mod) => {
    const application = mod.modResults.manifest?.application?.[0];
    if (!application) throw new Error('withNotificationColorMerge: no <application> in the manifest.');

    const entry = (application['meta-data'] ?? []).find(
      (item) => item?.$?.['android:name'] === ATTRIBUTE,
    );

    /*
     * Thrown rather than shrugged at, and the ordering is the reason. This mod
     * has to run *after* expo-notifications' own, which is what creates the
     * element — and config-plugin mods of a kind compose by wrapping, so the
     * plugin listed **later** in app.config.ts runs **first**. Get that
     * backwards and there is nothing here to edit yet; without this check the
     * plugin would quietly do nothing and the build would fail later with the
     * merge conflict it was added to prevent.
     */
    if (!entry) {
      throw new Error(
        `withNotificationColorMerge: no <meta-data android:name="${ATTRIBUTE}"> to edit. ` +
          'expo-notifications writes it from its `color` option, and this plugin must run ' +
          'after that one — which means being listed BEFORE it in app.config.ts, because ' +
          'mods compose by wrapping. Check that `color` is still set there.',
      );
    }

    /*
     * `tools:replace` names the attribute this module overrides, not the
     * element. `android:name` is what identifies the element to the merger, so
     * replacing it as well would break the match; `android:resource` is the
     * one the two libraries actually disagree about.
     *
     * The `tools` namespace is already declared on <manifest> by Expo's own
     * prebuild — other permissions in this app use `tools:replace` too — so
     * there is nothing to add for it here.
     */
    entry.$['tools:replace'] = 'android:resource';
    return mod;
  });
};
