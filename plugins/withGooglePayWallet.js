/**
 * The one AndroidManifest entry Google Pay needs, which Square's own Expo
 * config plugin does not write.
 *
 * `react-native-square-in-app-payments` ships a config plugin (`app.plugin.js`)
 * and it does a lot: the Kotlin pin, the OkHttp `META-INF` exclusion, the
 * card-entry theme, and the iOS framework `setup` build phase. It does not
 * touch the manifest, so this is the gap.
 *
 * Without it `SQIPGooglePay.canUseGooglePay()` resolves **false** on a device
 * that supports Google Pay perfectly well, and the wallet button simply never
 * appears. There is no error and nothing in logcat — which is why this is a
 * plugin with a paragraph above it rather than a line somebody adds to a
 * generated manifest and loses at the next `prebuild --clean`.
 */
const { withAndroidManifest, AndroidConfig } = require('@expo/config-plugins');

const META_DATA_NAME = 'com.google.android.gms.wallet.api.enabled';

/** @type {import('@expo/config-plugins').ConfigPlugin} */
module.exports = function withGooglePayWallet(config) {
  return withAndroidManifest(config, (mod) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(mod.modResults);
    AndroidConfig.Manifest.addMetaDataItemToMainApplication(application, META_DATA_NAME, 'true');
    return mod;
  });
};
