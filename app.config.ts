import type { ExpoConfig } from 'expo/config';

/*
 * SPSM Connect — the church's second app, and part 2 of the program the website
 * is part 1 of. See ../Website/apps/website/src/features/apps/stores.ts, which
 * has carried an entry for this app (marked `unreleased`) since before it
 * existed.
 *
 * A dynamic config rather than app.json because the Square environment and the
 * API origin differ per build profile, and because the permission copy below is
 * worth writing in prose rather than squeezing into JSON.
 */

const IS_PRODUCTION = process.env.APP_VARIANT !== 'development';

/*
 * Which Square the app talks to, and the two public ids that go with it.
 *
 * ---------------------------------------------------------------------------
 * Sandbox unless somebody asks for production, by hand.
 *
 * Deliberately NOT defaulted off APP_VARIANT the way the bundle id and the App
 * Attest environment below are. `APP_VARIANT` is unset for an ordinary
 * `npx expo run:ios`, so IS_PRODUCTION is true for it — which is right for a
 * bundle id and catastrophic for a payment environment, because every local
 * build would then charge the church's live account. Real money is opt-in:
 *
 *   SQUARE_ENV=production npx expo run:ios
 *
 * So a TestFlight or App Store build must set SQUARE_ENV=production in its
 * build environment. That is a release step, and it is the right way round:
 * forgetting it ships an app that only takes test cards, which is a bug report
 * on the first day. Forgetting the inverse takes real money by accident.
 * ---------------------------------------------------------------------------
 *
 * Neither id is a secret — both are visible in the network tab of any site
 * using Square's SDK and authorize nothing on their own. The token that does
 * authorize charges never leaves the Cloud Functions runtime, and is not in
 * this repo in any form.
 *
 * They are read from *unprefixed* names rather than EXPO_PUBLIC_* because Expo
 * inlines every EXPO_PUBLIC_ variable into the JS bundle by literal textual
 * match. With both environments' ids in `.env`, both would ship inside the
 * binary and the choice between them would become a runtime branch — one a
 * bug, a dev toggle or a stale flag could flip in a released build. Resolving
 * it here means only the winning pair ever reaches the app. Confirmed against
 * Expo 57: an unprefixed `.env` value is readable in this file and absent from
 * the bundle, which is what makes holding both sets in `.env` safe.
 */
const SQUARE_PRODUCTION = process.env.SQUARE_ENV === 'production';

const square = {
  environment: SQUARE_PRODUCTION ? 'production' : 'sandbox',
  applicationId:
    (SQUARE_PRODUCTION
      ? process.env.SQUARE_APPLICATION_ID
      : process.env.SQUARE_SANDBOX_APPLICATION_ID) ?? '',
  locationId:
    (SQUARE_PRODUCTION
      ? process.env.SQUARE_LOCATION_ID
      : process.env.SQUARE_SANDBOX_LOCATION_ID) ?? '',
};

/*
 * Square prefixes every sandbox application id with `sandbox-`, which makes the
 * id a better witness than the variable that selected it. A mismatch is the
 * copy-paste that puts production ids behind a sandbox flag, and it earns a
 * hard failure at config time because the runtime symptom does not look like
 * one: a nonce minted by one environment is refused by the other's API as an
 * invalid source id, which reads like a declined card.
 */
if (square.applicationId && square.applicationId.startsWith('sandbox-') === SQUARE_PRODUCTION) {
  throw new Error(
    `Square: SQUARE_ENV selected ${square.environment}, but the application id disagrees. ` +
      'Sandbox ids start with `sandbox-`; production ids do not.',
  );
}

/*
 * Missing ids: a warning in sandbox, a hard failure in production.
 *
 * The asymmetry is the point. Locally, an empty `.env` should not stop somebody
 * working on the calendar, so sandbox warns and carries on with checkout off.
 *
 * A production build is the opposite case, and it is the one EAS makes easy to
 * get wrong: `.env` is gitignored and never reaches a build runner, so unless
 * the ids are set as EAS environment variables they are simply absent — and the
 * old behaviour here was to print a warning into a build log nobody reads and
 * ship a store binary whose Give and Bookstore tabs cannot take a payment. That
 * is a release that looks successful and is not. Fail the build instead.
 */
if (!square.applicationId || !square.locationId) {
  const missing = [
    !square.applicationId && (SQUARE_PRODUCTION ? 'SQUARE_APPLICATION_ID' : 'SQUARE_SANDBOX_APPLICATION_ID'),
    !square.locationId && (SQUARE_PRODUCTION ? 'SQUARE_LOCATION_ID' : 'SQUARE_SANDBOX_LOCATION_ID'),
  ].filter(Boolean);
  const names = missing.join(' and ');
  const verb = missing.length > 1 ? 'are' : 'is';

  if (SQUARE_PRODUCTION) {
    throw new Error(
      `Square: SQUARE_ENV=production, but ${names} ${verb} missing, so this build could not take a ` +
        'payment. On EAS these come from the profile\'s environment, not from .env, which is ' +
        'gitignored and never reaches the build runner: `eas env:set --environment production`. ' +
        'See .env.example.',
    );
  }

  console.warn(
    `[square] No ${square.environment} application id or location id (${names}), so checkout ` +
      'is switched off in this build. See .env.example.',
  );
}

/*
 * Apple Pay's merchant id, and empty until one exists. See ios.entitlements.
 */
const APPLE_PAY_MERCHANT_ID = process.env.APPLE_PAY_MERCHANT_ID ?? '';

/**
 * The build numbers — one per store, counted separately.
 *
 * ---------------------------------------------------------------------------
 * `version` below is what a person reads — 1.0.0, the marketing version, shown
 * on the listing and in the About screen. These are the other ones: the numbers
 * the *stores* use to tell two uploads apart, and neither store will accept an
 * upload carrying a number it has already seen. They have nothing to do with
 * what changed and everything to do with how many times something has been
 * sent.
 *
 * They are here, explicitly and committed, because this project builds locally
 * rather than on EAS. `eas.json`'s production profile sets
 * `autoIncrement: true`, which would have handled this on a build server; a
 * local build has nothing to increment it, and the default for both fields is
 * 1. The failure that produces is not on the first submission — it is on the
 * *second*, where App Store Connect answers "The provided entity includes an
 * attribute with a value that has already been used" and Play says the version
 * code is already in use, both of them after a full upload.
 *
 * ## Two numbers, not one
 *
 * These used to be a single `BUILD` shared by both platforms, so that "build 7"
 * meant one thing when somebody reported a bug. That is given up here on
 * purpose: iOS is pinned while Android climbs, because the two are not being
 * shipped at the same rate and Play is the one refusing repeats.
 *
 * What it costs is exactly what the old arrangement bought. "Build 3" is now
 * ambiguous on its own — a bug report needs to say which store it came from,
 * and the two sequences will not line up again. `Platform.OS` alongside the
 * number is the thing to read.
 *
 * **Bump the platform you are shipping, by one, for every build you send it** —
 * including a TestFlight build that never reaches review, and including a
 * rejected one. Never reuse and never go backwards. Bumping the other platform
 * to match is not required and not wanted; they are independent counters now.
 *
 * `IOS_BUILD_NUMBER` and `ANDROID_VERSION_CODE` override them for a CI that
 * counts its own runs. Nothing sets either today. The old single
 * `BUILD_NUMBER` is gone rather than aliased, because a variable that silently
 * moved only one of two counters is worse than one that is not there.
 * ---------------------------------------------------------------------------
 */

/** CFBundleVersion. Held at 1 deliberately — see above. */
const IOS_BUILD = Number(process.env.IOS_BUILD_NUMBER ?? 1);

/** Play's versionCode. This is the one that climbs. */
const ANDROID_VERSION_CODE = Number(process.env.ANDROID_VERSION_CODE ?? 9);

for (const [name, value, variable] of [
  ['iOS build number', IOS_BUILD, 'IOS_BUILD_NUMBER'],
  ['Android versionCode', ANDROID_VERSION_CODE, 'ANDROID_VERSION_CODE'],
] as const) {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(
      `${name} must be a positive whole number; got "${process.env[variable]}" from ${variable}. ` +
        "Play refuses anything else outright, and Apple's rules for it are stricter still.",
    );
  }
}

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
    /*
     * The church's Apple Developer team, declared rather than inherited.
     *
     * A generated project had this on every target without anything here
     * setting it — Xcode and the Apple account between them had been supplying
     * it, which works until the first build on a machine that has never signed
     * for this team, where it fails as "Signing for SPSMConnectClip requires a
     * development team". That is a confusing error for a missing declaration.
     *
     * It is load-bearing for the App Clip in particular:
     * `plugins/withNativeClip.js` puts DEVELOPMENT_TEAM on the clip target from
     * this value, because build settings are per-target and the clip inherits
     * none of the app's. The plugin throws when this is absent rather than
     * creating a target that cannot be signed.
     *
     * The same team owns `merchant.org.spsm.connect` — see the Apple Pay
     * entitlement below.
     */
    appleTeamId: '5ZRM8X66TN',
    supportsTablet: true,
    /* CFBundleVersion, a string here and an integer on Android. No longer the
     * same number as Android's — see IOS_BUILD above. */
    buildNumber: String(IOS_BUILD),
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
       * See README.md; plugins/withNativeClip.js stamps whatever this resolves
       * to onto the clip's entitlements, so the two targets are always signed
       * for the same App Attest environment — a mismatch fails attestation in a
       * way that reads as App Check being broken.
       */
      'com.apple.developer.devicecheck.appattest-environment':
        process.env.APPATTEST_ENV ?? (IS_PRODUCTION ? 'production' : 'development'),
      /*
       * Push notifications, and this string is signed into the binary exactly
       * as App Attest's above is.
       *
       *   development   a locally signed build, talking to APNs sandbox
       *   production    TestFlight and the App Store
       *
       * Getting it wrong does not fail the build. It fails at *send* time, with
       * FCM answering `third-party auth error` for every iOS device while
       * Android carries on working perfectly — which is a genuinely hard
       * failure to read, because nothing on the phone says anything at all.
       * TestFlight is the trap specifically: it is `production`, so a build
       * that was fine on a cable stops receiving the moment it is uploaded.
       *
       * Defaulted off the same APPATTEST_ENV override, because the case that
       * needs one needs both: a production-bundle build run locally on a device
       * wants the sandbox for attestation and the sandbox for APNs too.
       *
       * The App Clip does not get this. A clip may only receive the 8-hour
       * ephemeral kind of push, which is a different API — see
       * `excludedPackages` above, where @react-native-firebase/messaging and
       * expo-notifications are both kept out of that target.
       */
      'aps-environment': process.env.APPATTEST_ENV ?? (IS_PRODUCTION ? 'production' : 'development'),
      /*
       * Apple Pay, spread rather than assigned so that it vanishes entirely
       * when no merchant id is configured.
       *
       * An entitlement naming a merchant id that does not exist in the Apple
       * Developer portal fails **code signing**, not runtime — so hardcoding
       * one before it is created would break `expo run:ios` for everybody,
       * including work that has nothing to do with payments. Set
       * APPLE_PAY_MERCHANT_ID once the id exists on team 5ZRM8X66TN and Square
       * holds the matching payment-processing certificate. Until then the app
       * takes cards and hides the wallet button, which is what
       * `SQIPApplePay.canUseApplePay()` reports on its own anyway.
       */
      ...(APPLE_PAY_MERCHANT_ID
        ? { 'com.apple.developer.in-app-payments': [APPLE_PAY_MERCHANT_ID] }
        : {}),
    },
    infoPlist: {
      // Universal links for /events/** (galleries), the /parking NFC tag, and
      // the eight /c/* App Clip experiences.
      LSApplicationQueriesSchemes: ['https'],
      ITSAppUsesNonExemptEncryption: false,
      /*
       * The viewfinder's two strings, written here because VisionCamera ships
       * no config plugin to write them for it. expo-image-picker's plugin
       * also sets the camera one, to the same sentence.
       *
       * Holding the shutter records a clip, and a clip of a hymn with no hymn
       * in it is not worth sending. Without the microphone string iOS
       * terminates the app the moment the recorder opens an audio input,
       * which is the shutter being held down — a crash, not a refusal.
       */
      NSCameraUsageDescription:
        'SPSM Connect needs your camera so you can take a photograph for the church galleries.',
      NSMicrophoneUsageDescription:
        'SPSM Connect needs your microphone so the videos you send to the church have their sound.',
    },
    /*
     * Two domains, two prefixes, and every combination is load-bearing.
     *
     * ---------------------------------------------------------------------
     * `applinks:` is what makes the **installed app** open for one of these
     * URLs instead of Safari. `appclips:` is what associates the **App Clip**
     * with the site, and Apple asks for it on both targets. The clip keeps its
     * own list, in `ASSOCIATED_DOMAINS` in plugins/withNativeClip.js, which
     * stamps it over the checked-in entitlements on every prebuild — so the two
     * are set in two places and `reset-ios.sh` checks that neither has drifted
     * onto the apex.
     *
     * Both hosts, because both serve the same site: `www.spsmwayland.org` is
     * the church's own domain and is what goes on a tag, and
     * `spsm-database.web.app` is the Firebase Hosting origin behind it, which
     * the app already talks to for every API call.
     *
     * **The apex `spsmwayland.org` is deliberately absent.** It answers 301 to
     * the `www` host for every path, `/.well-known/` included, and Apple
     * fetches an association file without following redirects — so an apex
     * entry here would be an association that can never validate, and Android's
     * App Links verification is all-or-nothing about the hosts it is given.
     * Print `www.` on the tags.
     *
     * **The paths are not here.** They are in the site's
     * `.well-known/apple-app-site-association`, which is the file iOS actually
     * reads — see `apps/website/public/.well-known/` in the Website repo. That
     * file also keeps this app off `/c/register-vehicle`, which is Taksis's
     * clip and shares this domain.
     * ---------------------------------------------------------------------
     */
    associatedDomains: [
      'applinks:www.spsmwayland.org',
      'appclips:www.spsmwayland.org',
      'applinks:spsm-database.web.app',
      'appclips:spsm-database.web.app',
    ],
    googleServicesFile: './GoogleService-Info.plist',
  },

  android: {
    package: IS_PRODUCTION ? 'org.spsm.connect' : 'org.spsm.connect.dev',
    /* Play's own counter, and it must increase with every upload. Independent
     * of iOS's — see ANDROID_VERSION_CODE. */
    versionCode: ANDROID_VERSION_CODE,
    // The viewfinder's, in `send/CameraScreen.tsx`. VisionCamera has no config
    // plugin to add them; see the iOS strings above for why audio is here.
    permissions: ['android.permission.CAMERA', 'android.permission.RECORD_AUDIO'],
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
    /*
     * Android's half of the same association, verified against
     * `.well-known/assetlinks.json` on each host.
     *
     * There is no Android App Clip — Instant Apps are a different mechanism and
     * the church does not ship one — so what this buys on Android is narrower
     * and still worth having: somebody with SPSM Connect installed who taps a
     * `/c/*` tag gets the app at the right screen rather than a browser. Anyone
     * else gets the fallback page, which is what those pages are for.
     */
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [
          { scheme: 'https', host: 'www.spsmwayland.org' },
          { scheme: 'https', host: 'spsm-database.web.app' },
        ],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },

  plugins: [
    'expo-router',
    /*
     * EB Garamond, embedded at build time.
     *
     * The church's serif — `font.body` and `font.display` in the theme — is a
     * real typeface rather than whatever serif the OS happens to supply. It has
     * to be *here* rather than loaded at runtime with `useFonts`, because the
     * theme provider holds the splash until the tokens are in hand and then
     * draws the first screen immediately: a font still arriving at that point
     * is the flash of the wrong typeface that ThemeProvider's header spends
     * twenty lines explaining it will not tolerate for colour. Embedded fonts
     * are registered before the first frame, so there is nothing to wait for.
     *
     * Only the four RIBBI faces ship, and the reason is iOS. The family name
     * inside a font file is what `fontFamily` resolves on iOS, and Google's
     * static builds put Regular, Italic, Bold and Bold Italic under
     * `EB Garamond` while giving every other weight its own family
     * (`EB Garamond SemiBold`). So these four are exactly the set that one
     * `fontFamily: 'EB Garamond'` can reach by weight and style, which is what
     * `Rich.tsx` asks for when it renders a bold or italic run. A SemiBold
     * would be 480KB that no style in this app can name.
     *
     * Android needs the same four spelled out, because there the *file name*
     * becomes the family unless an XML family declares otherwise — four files
     * would be four unrelated families, and `fontWeight: '700'` would find
     * none of them.
     */
    [
      'expo-font',
      {
        ios: {
          fonts: [
            './assets/fonts/EBGaramond-Regular.ttf',
            './assets/fonts/EBGaramond-Italic.ttf',
            './assets/fonts/EBGaramond-Bold.ttf',
            './assets/fonts/EBGaramond-BoldItalic.ttf',
          ],
        },
        android: {
          fonts: [
            {
              fontFamily: 'EB Garamond',
              fontDefinitions: [
                { path: './assets/fonts/EBGaramond-Regular.ttf', weight: 400 },
                { path: './assets/fonts/EBGaramond-Italic.ttf', weight: 400, style: 'italic' },
                { path: './assets/fonts/EBGaramond-Bold.ttf', weight: 700 },
                { path: './assets/fonts/EBGaramond-BoldItalic.ttf', weight: 700, style: 'italic' },
              ],
            },
          ],
        },
      },
    ],
    /*
     * The App Clip, and the plugin that points it at its own JS entry.
     *
     * Order matters: `withClipEntry` edits the Clip target's build settings, so
     * the target has to exist by the time it runs. It throws rather than
     * shrugging if it cannot find one.
     *
     * ## The budget governs every choice below
     *
     * **15 MB, uncompressed.** Every invocation the church has is physical — a
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
     * The App Clip, and it is **native SwiftUI** rather than React Native.
     *
     * The React Native clip was rejected on upload: 61 MB thinned against a
     * 15 MB limit. That was not fat to trim — React.framework is 11.6 MB and
     * hermesvm.framework 4.9 MB, so the runtime alone exceeded the budget
     * before any of this church's code. The 100 MB tier does not apply and
     * never will: Apple grants it only to clips with no physical invocations,
     * and every tag this parish owns is physical.
     *
     * So the clip is Swift and talks to the church over REST. It links exactly
     * one pod — `SquareInAppPaymentsSDK`, about 1.4 MB embedded, so that
     * `/c/bookstore` can take Apple Pay rather than hand off — and the plugin
     * gives it its own Podfile target for that one framework and nothing else.
     * Its sources are in `ios-appclip/`; the plugin's header has the account,
     * and `docs/app-clip-experiences.md` in the Website repo carries the
     * consequences for what each experience can do.
     */
    './plugins/withNativeClip',
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
    /*
     * Listed BEFORE 'expo-notifications' so that it runs AFTER it — mods
     * compose by wrapping, which is the rule every ordered plugin here obeys.
     * It edits an element expo-notifications creates, and throws if it is not
     * there yet, so a move in either direction fails loudly.
     */
    './plugins/withNotificationColorMerge',
    [
      /*
       * The local half of notifications: calendar reminders, and the
       * presentation of the remote ones.
       *
       * It sits beside messaging rather than instead of it, and the split is
       * deliberate — the two libraries both want to be the iOS notification
       * delegate, so each is given one job and neither is asked to do the
       * other's. Messaging owns the *remote* side: it mints the FCM token,
       * which is the thing a Cloud Function can address, and an APNs token
       * from `getDevicePushTokenAsync()` would not be. expo-notifications owns
       * the *local* side: permissions, Android channels, and
       * `scheduleNotificationAsync`, which is what makes a reminder about
       * Vespers possible without a server knowing when Vespers is. See
       * src/notify/ and the header of @spsm/shared's schema/notifications.ts.
       */
      'expo-notifications',
      {
        /*
         * Android draws the small icon as a silhouette in the status bar, so it
         * must be white-on-transparent — a colour icon renders as a white
         * square. `make-icons.mjs` writes this one alongside the launcher
         * icons; `color` tints the silhouette behind it and matches the
         * adaptive icon's background.
         *
         * `color` is also what makes ./plugins/withNotificationColorMerge
         * necessary, and the two have to be read together. Setting it writes
         * `com.google.firebase.messaging.default_notification_color` into the
         * manifest pointing at a generated `@color/notification_icon_color`,
         * and @react-native-firebase/messaging's own manifest declares that
         * exact key too, defaulting to `@color/white`. Two libraries, one
         * attribute, different values — the merger refuses the build rather
         * than choosing, and only on Android:
         *
         *   Execution failed for task ':app:processReleaseMainManifest'
         *   Attribute meta-data#...default_notification_color@resource
         *   ... is also present at [:react-native-firebase_messaging]
         *
         * That plugin adds the `tools:replace` the merger asks for, so this
         * colour wins and RNFB's untouched default loses. Its header carries
         * the full account, including why the apparently tidier fix — making
         * RNFB name the same resource via firebase.json — cannot work.
         */
        icon: './assets/notification-icon.png',
        color: '#481010',
        /*
         * No `defaultChannel`. Every notification this app sends names its own
         * channel — one per admin notice, one for reminders — because a channel
         * is what lets somebody silence bookstore orders in the OS settings
         * without silencing the reminder about Sunday's Liturgy. A default
         * channel would be the bucket anything unlabelled fell into, and there
         * is deliberately nothing unlabelled. See src/notify/channels.ts.
         */
        /*
         * Off, and this is the one that would be tempting to switch on.
         *
         * It adds `remote-notification` to UIBackgroundModes, which is what an
         * app needs to run code when a *silent* push arrives. Nothing here
         * sends one: every remote notification in this app is a visible alert
         * that iOS presents on its own, and the reminders are scheduled
         * locally. Claiming a background mode the app does not use is an App
         * Review question with no good answer.
         */
        enableBackgroundRemoteNotifications: false,
      },
    ],
    /*
     * Square's card entry, Apple Pay and Google Pay.
     *
     * The plugin writes the iOS framework `setup` build phase and pins Kotlin
     * for the Android SDK. After `prebuild`, confirm in Xcode that the phase
     * named "[CP] Square In-App Payments SDK Setup" landed on the **app**
     * target: the plugin attaches it to the first native target it finds, and
     * this project has two.
     *
     * It also lands in the wrong *position*, early enough that it does nothing
     * at all and the app dies at launch under dyld — `withSquareSetupPhaseOrder`
     * below moves it, and carries the full account of why.
     */
    'react-native-square-in-app-payments',
    './plugins/withSquareSetupPhaseOrder',
    './plugins/withGooglePayWallet',
    /*
     * Replaces the template's `signingConfig signingConfigs.debug` on the
     * Android release, which Play refuses. It has to be a plugin because
     * /android is gitignored and regenerated — see the file's header, and the
     * four Gradle properties it expects in ~/.gradle/gradle.properties.
     */
    './plugins/withReleaseSigning',
    /*
     * Raises `org.gradle.jvmargs` past the template's 2 GB, which R8 does not
     * fit in — see `enableMinifyInReleaseBuilds` below, which is what makes
     * this necessary, and the plugin's header for the failure it produces.
     */
    './plugins/withR8Heap',
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
        /*
         * 28 — Android 9, 2018 — and it is Square's floor rather than a
         * preference. `react-native-square-in-app-payments` pulls in
         * `com.squareup.sdk.in-app-payments:card-entry`, whose own manifest
         * declares `minSdkVersion 28`, and the merger will not build beneath
         * it:
         *
         *   Manifest merger failed : uses-sdk:minSdkVersion 24 cannot be
         *   smaller than version 28 declared in library
         *   [com.squareup.sdk.in-app-payments:card-entry:1.6.9]
         *
         * It was Expo's default 24 (Android 7.0), uncommented, and nothing had
         * built for Android yet to disagree with it. There is no setting that
         * keeps both: the only alternative to raising this is dropping card
         * payments from Android altogether, and Giving and the Bookstore are
         * two of the app's five tabs.
         *
         * What it costs is Android 7.0 through 8.1. Worth knowing rather than
         * guessing at — Play's own device catalogue will say how many of the
         * parish that is, and the Play Console refuses an upload that would
         * strand existing installs, so this is safe to discover there.
         *
         * iOS has the same shape of constraint in a different place, though it
         * eased: the clip's deployment target was 16.4 because expo-modules-core
         * required it, and a native clip imports no Expo at all — so
         * plugins/withNativeClip.js sets 16.0 and picks up every device on
         * 16.0 to 16.3 the old clip could not serve.
         */
        android: {
          minSdkVersion: 28,
          /*
           * R8. Off by Expo's default, and Play noticed:
           *
           *   DEX code optimization is below our threshold
           *   Improve your percentages in the following categories:
           *   Obfuscation (3%)
           *
           * Percentages under 25% "may impact your visibility and publishing
           * capabilities on Google Play" — see
           * https://developer.android.com/topic/performance/vitals/code-optimization.
           * The 3% is the handful of dependencies that arrive pre-obfuscated;
           * nothing this build compiles was being renamed at all, because the
           * template's `minifyEnabled enableMinifyInReleaseBuilds` reads a
           * Gradle property that nothing set.
           *
           * This sets it. `android.enableMinifyInReleaseBuilds=true` lands in
           * android/gradle.properties on prebuild, which is the only place it
           * can live — /android is gitignored and regenerated, the same reason
           * plugins/withReleaseSigning.js exists.
           *
           * **None of it touches the JavaScript.** R8 shrinks and renames Java
           * and Kotlin; the app's own code is a Hermes bytecode bundle sitting
           * in assets/, untouched. What gets obfuscated is React Native, the
           * Expo modules, Firebase and Square — which is exactly what Play is
           * measuring, since that is what the DEX is.
           *
           * The keep rules below are the whole of what this app needs on top of
           * its dependencies' own, and the list is short on purpose: every
           * native dependency here ships `consumerProguardFiles` and they are
           * thorough. expo-modules-core keeps anything extending `Module` or
           * implementing `Record`, expo-task-manager and expo-notifications
           * keep their packages whole, all five
           * `com.squareup.sdk.in-app-payments` AARs carry a proguard.txt, and
           * every Firebase and ML Kit `ComponentRegistrar` survived R8 untouched
           * — checked against mapping.txt, not assumed. React Native keeps its
           * own `@DoNotStrip` and `@ReactModule` surface, which is what every
           * third-party RN module relies on. Each keep added past that lowers
           * the number Play is complaining about, so they have to be earned.
           *
           * These three were earned the hard way: R8 deleted all three, and the
           * release build still compiled, installed and launched. They are
           * named in the merged AndroidManifest as `android:value` — a *string*,
           * not `android:name` — so AGP's automatic manifest keeps do not see
           * them, and each is then resolved with `Class.forName`. Nothing in
           * the bytecode references them, so R8 is right to think them dead.
           *
           * They were found by listing every class-shaped `android:value` in
           * the merged manifest and grepping mapping.txt for each: a class R8
           * kept appears there even when its name is unchanged, so absence
           * means deleted. Worth repeating after an SDK bump, because the
           * symptom is not a crash — see below.
           *
           *   RNHeadlessAppLoader             expo-modules-core's headless JS
           *                                   entry point, read from meta-data
           *                                   by `AppLoaderProvider`. Without
           *                                   it `getLoader` returns null and
           *                                   nothing running outside the
           *                                   foreground works —
           *                                   src/notify/backgroundReminders.ts
           *                                   and src/upload/backgroundDrain.ts,
           *                                   both registered in app/_layout.tsx.
           *
           *   Camera2Config$DefaultProvider   CameraX's default configuration,
           *                                   loaded the same way. VisionCamera
           *                                   fails to initialise without it —
           *                                   src/send/CameraScreen.tsx and
           *                                   src/upload/pick.ts.
           *
           *   CredentialProviderPlayServices- androidx.credentials' Play
           *   Impl                            services backend, behind Firebase
           *                                   Auth.
           *
           * The reason to be careful here rather than quick: **the app launches
           * fine without them.** The first build of this change ran, rendered
           * and logged `Running "main"`, and the only sign of the damage was a
           * `W System.err: java.lang.ClassNotFoundException` that no crash
           * report would ever collect, for a background task that simply never
           * fires again. That is the shape of R8 breakage worth fearing — not a
           * red build, a feature that quietly stops existing.
           *
           * Whole classes rather than `{ <init>(); }`. Reflection needs the
           * name and the constructor, and interface dispatch covers the methods
           * in principle, but three small classes kept whole cost roughly
           * nothing against 85% and remove a subtler way to be wrong later.
           *
           * The two keeps already in android/app/proguard-rules.pro —
           * reanimated and turbomodule — come from the Expo template and stay.
           *
           * Crash reports stay readable without any extra step: AGP writes the
           * mapping file into the AAB's BUNDLE-METADATA, so Play deobfuscates
           * stack traces itself. Nothing here uploads to Crashlytics, which is
           * not installed.
           *
           * `enableShrinkResources` is left off. It is a different lever —
           * unused *resources*, not code — it does nothing for the obfuscation
           * number, and it strips drawables that are only ever named as
           * strings, which is a real risk for a notification icon. Size is not
           * the problem being solved.
           */
          enableMinifyInReleaseBuilds: true,
          extraProguardRules: [
            '# Named in the merged manifest as an android:value string and loaded by',
            '# Class.forName, so nothing in the bytecode reaches them and R8 deletes',
            '# them. See the note in app.config.ts before removing any of these.',
            '-keep class expo.modules.adapters.react.apploader.RNHeadlessAppLoader { *; }',
            '-keep class androidx.camera.camera2.Camera2Config$DefaultProvider { *; }',
            '-keep class androidx.credentials.playservices.CredentialProviderPlayServicesImpl { *; }',
          ].join('\n'),
        },
      },
    ],
    [
      'expo-splash-screen',
      {
        /*
         * theme `deep`. The image below is transparent — it is the app's name
         * in `inkInverse` and nothing else — so this is the ground that name is
         * read against, and the contrast between the two is the whole design.
         * Change one in scripts/make-icons.mjs and change the other here.
         */
        backgroundColor: '#481010',
        /*
         * The seal with the app's name above it, as one image, because
         * `expo-splash-screen` takes exactly one — the stack is composited in
         * scripts/make-icons.mjs rather than laid out here.
         *
         * Not `splash-icon.png`, which is the seal alone and is still written:
         * src/navigation/DrawerContent.tsx draws that one in the drawer
         * masthead. The name is here because a launch image is up for a few
         * hundred milliseconds, and the seal alone does not resolve in that
         * long — it is full-colour artwork with two rings of lettering in it,
         * and at this size for that long it reads as a red circle. The name is
         * the thing a splash screen can actually say; the seal is what the
         * church is. Hence both.
         *
         * Baked type rather than a `<Text>` because a splash screen has to be:
         * on iOS it is a storyboard and on Android a themed window background,
         * both drawn by the OS before any JavaScript exists to lay one out.
         * The WORDMARK note in scripts/make-icons.mjs carries the type
         * decisions.
         */
        image: './assets/splash-banner.png',
        /*
         * `SPLASH_WIDTH_POINTS` in scripts/make-icons.mjs, and the two must be
         * equal — nothing enforces it.
         *
         * It is the side of a square rather than a width: the plugin pads what
         * it is handed out to `imageWidth` x `imageWidth` and the storyboard
         * aspect-fits that, so for a lockup taller than it is wide this is the
         * height. 240 of it is a 224pt seal with a 21pt cap height above it;
         * `npm run icons` prints those, measured.
         */
        imageWidth: 240,
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission:
          'SPSM Connect needs your photo library so you can choose photographs to send to the church galleries.',
        cameraPermission:
          'SPSM Connect needs your camera so you can take a photograph for the church galleries.',
      },
    ],
    [
      'expo-media-library',
      {
        photosPermission:
          'SPSM Connect needs your photo library so you can choose photographs to send to the church galleries.',
        savePhotosPermission: 'SPSM Connect needs permission to save photographs to your library.',
        isAccessMediaLocationEnabled: false,
        /*
         * **Play rejects a build that declares these.** The plugin's default is
         * `['photo', 'video', 'audio']`, which puts `READ_MEDIA_IMAGES`,
         * `READ_MEDIA_VIDEO` and `READ_MEDIA_AUDIO` in the manifest, and
         * Google's Photo and Video Permissions policy answers:
         *
         *     Your app uses the following undeclared photo and video
         *     permissions: android.permission.READ_MEDIA_IMAGES,
         *     android.permission.READ_MEDIA_VIDEO
         *
         * The policy's remedy is the Android photo picker, and **this app
         * already uses it.** `expo-image-picker` on API 33+ launches
         * `PickVisualMedia` and requests nothing —
         * `getMediaLibraryPermissions` in its ImagePickerModule.kt returns an
         * empty array on TIRAMISU and above. So every path a member actually
         * takes keeps working with these gone: "choose from my library" in
         * `upload/pick.ts` (images *and* video), the forms picker, the
         * bookstore admin picker. `READ_EXTERNAL_STORAGE` stays for Android 12
         * and below, where that picker does need it, capped at
         * `maxSdkVersion="32"`.
         *
         * Two of the three had nothing behind them at all. Nothing in this app
         * reads video or audio from the library, and nothing writes to it —
         * there is no `saveToLibraryAsync` call anywhere. What the third bought
         * was one decoration: the most recent photograph shown on the library
         * button in `send/CameraScreen.tsx`, which is now iOS-only. See
         * `LibraryButton` there, which says this from the other side.
         *
         * `READ_MEDIA_VISUAL_USER_SELECTED` is added by the plugin
         * unconditionally and is *not* restricted — it is the partial-access
         * permission Google recommends, and the picker path is happy with it.
         */
        granularPermissions: [],
      },
    ],
  ],

  experiments: {
    typedRoutes: true,
  },

  extra: {
    apiOrigin: process.env.EXPO_PUBLIC_API_ORIGIN ?? 'https://spsm-database.web.app',
    square: { ...square, applePayMerchantId: APPLE_PAY_MERCHANT_ID },
  },
};

export default config;
