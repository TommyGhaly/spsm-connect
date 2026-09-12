import type { ExpoConfig } from 'expo/config';

/*
 * SPSM Connect — the parish's second app, and part 2 of the program the website
 * is part 1 of. See ../Website/apps/website/src/features/apps/stores.ts, which
 * has carried an entry for this app (marked `unreleased`) since before it
 * existed.
 *
 * A dynamic config rather than app.json because the Square environment and the
 * API origin differ per build profile, and because the permission copy below is
 * worth writing in prose rather than squeezing into JSON.
 */

const IS_PRODUCTION = process.env.APP_VARIANT !== 'development';

const config: ExpoConfig = {
  name: IS_PRODUCTION ? 'SPSM Connect' : 'SPSM Connect (dev)',
  slug: 'spsm-connect',
  version: '1.0.0',
  orientation: 'default',
  icon: './assets/icon.png',
  scheme: 'spsmconnect',
  userInterfaceStyle: 'light',

  ios: {
    bundleIdentifier: IS_PRODUCTION ? 'org.spsm.connect' : 'org.spsm.connect.dev',
    supportsTablet: true,
    /*
     * App Attest is the iOS App Check provider. It replaces reCAPTCHA
     * Enterprise, which the website uses and which does not exist on a phone.
     * Without a valid App Check token `galleryUploadUrl` answers 401
     * "unattested" and every upload fails — see docs/gallery-console-setup.md.
     */
    entitlements: {
      /*
       * Which App Attest server vouches for this build, and it must match how
       * the build is signed or attestation fails for a reason that looks like
       * App Check being broken:
       *
       *   development   a locally signed build on your own device
       *   production    TestFlight and the App Store
       *
       * Defaulted off APP_VARIANT, which is right for both ordinary cases — a
       * dev build is a dev variant, a release build is not. `APPATTEST_ENV`
       * overrides it for the case that is neither: a **production-bundle build
       * run locally on a device**, which is what the App Clip spike wants. The
       * alternative for that is APP_VARIANT=development, and that changes the
       * bundle id to org.spsm.connect.dev — a second Firebase iOS app, a second
       * GoogleService-Info.plist and a second pair of App IDs, for one run.
       *
       *   APPATTEST_ENV=development npx expo prebuild --platform ios --clean
       *
       * See README.md; plugins/withClipTarget.js copies whatever this resolves
       * to onto the App Clip target, which has no entitlements of its own.
       */
      'com.apple.developer.devicecheck.appattest-environment':
        process.env.APPATTEST_ENV ?? (IS_PRODUCTION ? 'production' : 'development'),
    },
    infoPlist: {
      // Universal links for /events/** (galleries) and the /parking NFC tag.
      LSApplicationQueriesSchemes: ['https'],
      ITSAppUsesNonExemptEncryption: false,
    },
    associatedDomains: ['applinks:spsm-database.web.app'],
    googleServicesFile: './GoogleService-Info.plist',
  },

  android: {
    package: IS_PRODUCTION ? 'org.spsm.connect' : 'org.spsm.connect.dev',
    adaptiveIcon: {
      // theme `deep`, matching assets/. Baked at build time, so it cannot come
      // from config/theme like everything else — see scripts/make-icons.mjs.
      backgroundColor: '#481010',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      /*
       * No `monochromeImage`. A themed icon is a single-colour silhouette, and
       * this seal — two saints, a camel, a horse and two rings of lettering —
       * does not reduce to one. The file that was here was still the Expo
       * template's, so shipping it would have put a stranger's logo on the
       * home screen of anybody using themed icons. Better absent than wrong;
       * Android falls back to the adaptive icon.
       */
    },
    googleServicesFile: './google-services.json',
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [{ scheme: 'https', host: 'spsm-database.web.app' }],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },

  plugins: [
    'expo-router',
    /*
     * The App Clip, and the plugin that points it at its own JS entry.
     *
     * Order matters: `withClipEntry` edits the Clip target's build settings, so
     * the target has to exist by the time it runs. It throws rather than
     * shrugging if it cannot find one.
     *
     * ## The budget governs every choice below
     *
     * **15 MB, uncompressed.** Every invocation the parish has is physical — a
     * tag by a door, a code on a printed card — and physical invocations do not
     * get the larger budget iOS 17 added for links tapped in Safari or Messages.
     * An iOS 16 floor is what buys 15 rather than the 10 MB an iOS 15 floor
     * would allow, and is the only reason it is set at all.
     *
     * It reads 16.4 rather than 16.0 because expo-modules-core requires 16.4
     * and the clip's AppDelegate imports Expo — at 16.0 the target does not
     * compile: "module 'Expo' has a minimum deployment target of iOS 16.4".
     * The budget is untouched by that. Apple's tier is "iOS 16 or later", so
     * 16.4 sits in the same 15 MB band 16.0 did; what it costs is devices on
     * 16.0-16.3, which lose the clip and fall back to the website page every
     * tag already carries.
     */
    /*
     * Listed BEFORE 'react-native-app-clip', which looks backwards and is not.
     * `withXcodeProject` mods compose by wrapping, so the plugin registered
     * *later* runs *first* — verified by this one throwing "found no build
     * configuration" when it was listed after. It has to run once the Clip
     * target exists, so it goes above.
     */
    './plugins/withClipTarget',
    [
      'react-native-app-clip',
      {
        name: 'SPSM Connect',
        // Apple requires the App Clip's App ID product name to be exactly
        // "Clip", which makes the bundle id org.spsm.connect.Clip.
        bundleIdSuffix: 'Clip',
        targetSuffix: 'Clip',
        deploymentTarget: '16.4',
        /*
         * Shared container, so a photograph taken in the clip can be handed to
         * the full app if the person installs it rather than being lost with
         * the clip's own storage — which iOS clears without warning.
         */
        groupIdentifier: 'group.org.spsm.connect',
        /*
         * Kept out of the clip target's autolinking. Three kinds of thing:
         *
         *   Forbidden.  `expo-media-library` is PhotoKit, and PhotoKit provides
         *               no functionality at runtime in an App Clip. This is why
         *               the clip's photo experience is camera-only.
         *               `expo-background-task` / `expo-task-manager` are
         *               background execution, which a clip may not do at all.
         *
         *   Pointless.  `expo-sqlite` backs the durable upload queue, and a clip
         *               is ephemeral — a queue that outlives the process has
         *               nowhere to drain from. `@react-native-firebase/messaging`
         *               is push; a clip gets only the 8-hour ephemeral kind,
         *               which is a different API.
         *
         *   Unused.     Storage, FlashList, WebView and Sharing are not reachable
         *               from ClipRoot and are not planned to be.
         *
         * Anything added here must also be unreachable from `index.clip.ts`, or
         * the clip crashes on import rather than failing gracefully.
         */
        excludedPackages: [
          'expo-media-library',
          'expo-background-task',
          'expo-task-manager',
          'expo-sqlite',
          '@react-native-firebase/messaging',
          '@react-native-firebase/storage',
          '@shopify/flash-list',
          'react-native-webview',
          'expo-sharing',
        ],
      },
    ],
    [
      '@react-native-firebase/app',
      {
        ios: {
          /*
           * Sets `$RNFirebaseDisableSPM = true` in the Podfile, so Firebase is
           * installed by CocoaPods rather than Swift Package Manager.
           *
           * Required, not preference. React Native Firebase 26 resolves Firebase
           * through SPM by default, and firebase-ios-sdk's SPM products are
           * automatic libraries — so every react-native-firebase pod embeds its
           * own copy of FirebaseCore. Under `useFrameworks: 'static'` below,
           * those copies collide at link time and `pod install` refuses outright:
           *
           *   [react-native-firebase] SPM + static linkage is not supported
           *   (target(s): Pods-SPSMConnect, Pods-SPSMConnectClip)
           *
           * The other way out is dynamic linkage, and it is the wrong one here.
           * Dynamic pods each embed a private Firebase copy as an
           * .framework the app has to carry, and the App Clip has **15 MB
           * uncompressed** for everything. Static linkage with one shared
           * CocoaPods Firebase is the smaller binary, which is the constraint
           * that governs this project.
           */
          disableSPM: true,
        },
      },
    ],
    '@react-native-firebase/auth',
    '@react-native-firebase/app-check',
    '@react-native-firebase/messaging',
    [
      'expo-build-properties',
      {
        /*
         * React Native Firebase needs frameworks on iOS. Static rather than
         * dynamic for the App Clip's size budget — see the `disableSPM` note on
         * the @react-native-firebase/app plugin above, which is what makes
         * static possible at all on RNFB 26.
         */
        ios: { useFrameworks: 'static' },
        android: { minSdkVersion: 24 },
      },
    ],
    [
      'expo-splash-screen',
      {
        // theme `deep`, and it must equal the ground the seal is drawn on in
        // assets/splash-icon.png — that image is transparent, so a mismatch
        // shows as a square of the wrong red behind the logo.
        backgroundColor: '#481010',
        image: './assets/splash-icon.png',
        imageWidth: 200,
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission:
          'SPSM Connect needs your photo library so you can choose photographs to send to the parish galleries.',
        cameraPermission:
          'SPSM Connect needs your camera so you can take a photograph for the parish galleries.',
      },
    ],
    [
      'expo-media-library',
      {
        photosPermission:
          'SPSM Connect needs your photo library so you can choose photographs to send to the parish galleries.',
        savePhotosPermission: 'SPSM Connect needs permission to save photographs to your library.',
        isAccessMediaLocationEnabled: false,
      },
    ],
    [
      'expo-camera',
      {
        cameraPermission:
          'SPSM Connect needs your camera so you can take a photograph for the parish galleries.',
        recordAudioAndroid: true,
      },
    ],
  ],

  experiments: {
    typedRoutes: true,
  },

  extra: {
    apiOrigin: process.env.EXPO_PUBLIC_API_ORIGIN ?? 'https://spsm-database.web.app',
    squareEnvironment: process.env.EXPO_PUBLIC_SQUARE_ENVIRONMENT ?? 'sandbox',
  },
};

export default config;
