# SPSM Connect

The church's second app, and part 2 of the three-part program the website is
part 1 of. Native, for everyone rather than for servants — the emphasis is
photographs.

The website is part 1 and lives in `../Website`. The two share
`@spsm/shared`, which holds every schema, design token, permission predicate and
gallery-layout function. That package is the reason the two frontends cannot
drift, so read its file headers before changing anything that touches it.

## The one environmental assumption

**The Website repo must be checked out beside this one, at `../Website`.**

```
SPSM-Website/
  Website/          <- the Next.js site, part 1
  SPSM-Connect/     <- this app
```

**No spaces in either directory name, and that is not a style preference.** The
iOS toolchain breaks on them in at least three separate places, none of which
say so clearly:

- CocoaPods dies with `Unicode Normalization not appropriate for ASCII-8BIT`
  unless the terminal is UTF-8 (`export LANG=en_US.UTF-8`).
- `expo-constants` runs its config script as
  `bash -l -c "$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh"`, which
  word-splits on the expansion — the build fails with
  `No such file or directory: /Users/you/Desktop/SPSM`, a path truncated at the
  first space.
- Xcode's own copy phases mangle the escaping in their logs, which makes every
  one of these harder to read than it should be.

`package.json` depends on `"@spsm/shared": "file:../Website/packages/shared"`,
and `metro.config.js` adds that path to `watchFolders` so Metro follows the
symlink out of the project root.

`@spsm/shared` publishes its compiled `dist/`, not its TypeScript source, so it
must be built before the app bundles. `npm run shared` does that, and
`postinstall` runs it for you. After any schema change in the Website repo, run
it again.

If the link breaks, the failure is loud — Metro refuses to bundle with
`Unable to resolve module @spsm/shared`. That is deliberate; a silent fallback
would ship an app that disagrees with the website about what a photograph is.

## Before it will run

This app **cannot run in Expo Go.** It needs native App Check and FCM, so it
needs a development build:

```bash
npx expo run:ios
```

Three things must be in place first, and none of them are code:

1. **`GoogleService-Info.plist` and `google-services.json`** — download from the
   Firebase console for the iOS and Android apps. React Native Firebase reads
   these for its own init; it does not use the `EXPO_PUBLIC_FIREBASE_*` values
   in `.env` (those are for the plain-REST theme read and for Square).
   Both files are gitignored.

2. **App Check registered for both platforms** — App Attest for iOS, Play
   Integrity for Android, under the same App Check app the website's reCAPTCHA
   Enterprise key belongs to. Without this every upload fails:
   `galleryUploadUrl` reads the `X-Firebase-AppCheck` header by hand and answers
   `401 {"error":"unattested"}` when it is absent. See
   `../Website/docs/gallery-console-setup.md` §1.

   For simulator work, register a debug token and put it in
   `EXPO_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN` — App Attest and Play Integrity
   both refuse to vouch for a simulator or an unsigned build.

   Two things on the Firebase side are required for App Attest and neither is
   obvious, because a missing one fails exactly like a broken app: the iOS app
   must carry its **Apple Team ID** (Project settings → General; Firebase builds
   the relying-party App ID from `teamId.bundleId` when it validates an
   attestation), and the App Attest provider must be registered for it. Both are
   set — `5ZRM8X66TN`, matching `ios.appleTeamId`.

   **A build sideloaded onto a phone needs the `development` App Attest
   environment**, because ad-hoc signing and the `production` environment are a
   mismatch Apple refuses — and the refusal arrives as `getToken` failing, then
   `401 unattested`, with nothing naming the cause. `app.config.ts` defaults the
   entitlement off `APP_VARIANT`, which is right for `npx expo run:ios` and for
   the App Store but wrong for EAS **internal distribution**: that profile sets
   no `APP_VARIANT`, so it used to claim `production` on an ad-hoc build. The
   `preview` profile now sets `APPATTEST_ENV=development` in `eas.json` for
   exactly that case. TestFlight and the App Store come from the `production`
   profile and keep `production`, which is correct for them.

   One debug token is already registered on **both** the iOS and Android apps,
   named *"Local simulator and emulator (dev builds)"* under App Check → Manage
   debug tokens. The value is not in this repository: it is a credential, and
   anything holding it can mint App Check tokens for these apps. It lives in
   the gitignored `.env`, `src/firebase/appCheck.ts` reads it only on the
   `__DEV__` branch so it cannot be inlined into a release bundle, and there is
   nothing to recover if it is lost — revoke it and register another. Restart
   the dev server after changing it; `EXPO_PUBLIC_*` is inlined at bundle time,
   not read at runtime.

3. **`.env`** — copy `.env.example` and fill it in, or let the values carry over
   from `../Website/.env`. Everything in it is public by design; the Square
   access token is a real secret and is not there, because it lives in Secret
   Manager and never leaves the Cloud Function.

## Architecture

```
app/                  expo-router, mirroring the website's URL shape
src/
  theme/              config/theme -> resolveTheme() -> RN styles
  firebase/           RNFB init, App Check, auth, screen grants
  api/                Cloud Function calls, through the Hosting origin
  upload/             the photo queue - condense, persist, send
  gallery/            reads + rendering for the program galleries
  forms/              the church's forms: hub, renderer, builder, submissions
  payments/           Square, and the one place money is formatted
  camp/               the servant sign-up, and whether the camp is running
  access/             Areas: who administers what, for the superadmin
```

### The forms

`app/(drawer)/(tabs)/forms/` is the Forms tab: the hub, then `/forms/<slug>` for
whichever form was pressed — the website's URLs, so a link or a QR code lands in
the same place on both surfaces.

**Nothing about a form is compiled in.** The definitions are `forms` documents in
Firestore, read live, and staff build them in the app's own admin screens under
`/forms/admin`. Two forms have a copy in `@spsm/shared` and fall back to it —
`contact` and `vehicle-registration`, because a car-park NFC tag and every "ask
the church office" link point at them and neither can be fixed by editing a file.

The rules of the road, all of them the website's:

- **The browser sends choices, never money.** `computeTotalCents` runs here to
  draw a running total and again inside `formSubmit` against the *stored*
  definition, which is what gets charged. There is nowhere in the request to put
  an amount. A paid form takes Apple Pay or a card through Square's own sheet,
  and the answers travel *with* the payment in one request — see
  `src/forms/FormRenderer.tsx`.
- **Submissions are never written from a client.** `formSubmissions` is
  `allow create: if false`; everything goes through the `formSubmit` Function.
  Reviewing one is a direct read, behind `hasScreen('forms')`.
- **A photograph attached to a form is quarantined.** `formUploads/` is
  unreadable to whoever wrote it, the write is a signed URL from
  `/api/forms/upload-url`, and what the submission stores is a path rather than
  a URL. Staff resolve it with a staff token when they review it.
- **The admin screens are hiding, not enforcing.** `mayAdminScreen(grants,
  'forms')` decides what is drawn; `firestore.rules` decides what is allowed,
  and it reads the grant on the member document rather than the button.

`/forms/summer-camp` is the one form that is not a `FormDefinition` and cannot
be: a servant sign-up has a week/day grid, roles that differ by week and by half
of the camp, an age-dependent waiver and a charge that is the same whether you
serve one week or two. It writes a *request* that an administrator accepts — see
`src/camp/ServantSignUp.tsx`.

### Areas — who administers what

`app/(drawer)/access/` is the website's `/access` on a phone: the church's people
as a list, and one person's allocation pushed on top of it. Same route, so a link
lands in the same place whichever it opens in; same copy, because a flag named
`content` says nothing to the person ticking it and the sentences are the whole
description of what is being given away. `src/access/areas.ts` is a deliberate
duplicate of `apps/website/src/features/access/areas.ts` and its header says what
that costs — **change the wording in both, in the same sitting.**

- **Superadmin only, and it cannot delegate itself.** The gate is the
  `superadmin` claim rather than a screen flag. The flag that would grant this
  screen is `members`, which is the power to hand out every other flag, and a
  screen that can give away its own key stops being superadmin-only the first
  time anybody uses it. `members` and `config` are therefore not offered as rows
  at all.
- **It hands out areas and never promotes.** `superadmin` is a custom claim, so
  only the Admin SDK can set it — `scripts/grant-admin.mjs` in the Website repo
  is the one path. This screen writes `screenAdmin`, `financeScopes` and
  `programAdmin` on the member document, in one field-scoped `updateDoc`.
- **A row disappearing revokes nothing.** The whole `ScreenAdmin` map is read and
  written back, so the four flags with no editor yet survive a save — and are
  named on the person's screen, because a permission this screen preserves and
  never mentions is worse than one it does not offer.
- **Explicit Save, against the house style.** Everything else in this app commits
  as you go. A stray press here is somebody who can suddenly read every form
  submission in the church, so the bar says what the press will do — "Adding
  Forms, removing Bookstore" — while the button is under your thumb.
- **Unlisted.** One row in the drawer's account card, drawn for the superadmin
  and nobody else. That is a courtesy: `allow read: if isSelf(uid) || isSuper()`
  and `allow update: if isSuper()` on `/members/{uid}` are what actually hold.

### The galleries

`app/(tabs)/events/` is the Photos tab: a ministry directory, and one catch-all
route under it for a level at any depth — `/events/summercamp/2026-week-1/day-1`
is a real screen, and it is the same URL the website serves, which is what makes
the universal links land in the right place.

**The hard part is not in this repo.** `buildGalleryTree`, `resolveTrail`,
`nodeSummary`, `summariseChildren`, `packGallery` and `collapseToColumn` are all
`@spsm/shared`, and the screens here do not second-guess any of them. The one
idea they encode, which is worth knowing before changing anything on those
screens: **a level summarises everything beneath it.** No page renders "its own"
photographs — Summercamp shows pictures drawn from every year of camp, and the
deepest level is only special in that its subtree is one node. `nodeSummary`'s
header explains why "newest first" is the wrong answer to that.

`src/gallery/data.ts` mirrors the website's `features/programs/data.ts` query for
query, deliberately. Two of those queries are approximations under load and say
so at the point it matters: a subtree wider than thirty nodes falls back to one
capped read, and the directory reads a small window per ministry.

Three rules carried over from the website, each of which has a comment
explaining it at the point it matters:

- **Never write a literal colour or type size.** Everything comes from
  `config/theme`, so the church can change its own look without a release.
- **Every anonymous list query carries its filter** — `published == true`, and
  for galleries `status == 'approved'`. Firestore judges a `list` on its
  *potential* result set, so omitting the filter fails the whole query rather
  than returning less.
- **Never authorize off the `screens` claim.** It is a lagging mirror that
  exists only because Storage rules cannot read Firestore. `src/firebase/grants.ts`
  reads the member document and force-refreshes the token when the two disagree.

## The App Clip

One clip target, `org.spsm.connect.Clip`, and **eight experiences** registered
against it — one binary, eight invocation URLs, all of them
`https://www.spsmwayland.org/c/<slug>`. **The `www.` is load-bearing**: the apex
301s to it for every path, `.well-known/` included, and Apple follows no
redirect from an invocation URL or an association file, so a tag printed without
it opens Safari and never the clip. `src/clip/experiences.ts` is the table, and
its header lists the four places outside itself that every row has to agree
with. `../Website/docs/app-clip-experiences.md` is the other end of it.

| URL | What it opens |
|---|---|
| `/c/give` | The giving screen; Tithe.ly's form in Safari over it |
| `/c/schedule` | Week and month views of the parish calendar, read-only |
| `/c/apps` | Taksis and Tithe.ly, plus a card for this app the full app does not show |
| `/c/welcome` | The liturgy tour, for a visitor at the door |
| `/c/plans` | The expansion plans; the flythrough in Safari |
| `/c/bookstore` | The shelf, and Apple Pay under it; hands off only when it cannot charge |
| `/c/forms` | Opens on `config/forms.nfcFormSlug`; the list is one press away |
| `/c/photos` | The camera, filed against `config/events.mainSection` — changeable from the pill |

Seven of the eight are the **full app's own screens**, unforked. That is what
`src/clip/shims/expo-router.tsx` buys: Metro resolves `expo-router` to it in the
clip build, so a borrowed screen's `router.push('/about/future-plans')` lands on
the Plans experience instead of dragging the real router — and its
`require.context` over `app/` — into the clip's module graph. `metro.config.js`
carries the alias table and the reasoning.

Three things moved so the clip could share them rather than fork them:
`calendar/ViewControls.tsx` (the view switch, stepper, busy rule and legend,
out of `CalendarScreen`), `forms/pictures.ts` (the Storage SDK calls, out of
`forms/uploads.ts`, which a clip reaches), and an optional `footer` slot on
`AppsScreen`. Each carries its own note about why.

Measured after the eight: **1,473 modules, 2.7 MB of JS**, against the
1,930-module graph the router alone produced.

### It is native SwiftUI, and that was forced

The clip was React Native until App Store Connect refused it:

```
90865: Thinned App Clip size is too large. The main bundle of the
"/Payload/SPSM Connect.app" App Clip is 61 MB … must be less than 15 MB.
```

Measured, that 61 MB was not fat to trim:

| | |
| --- | --- |
| `React.framework` | 11.6 MB |
| `hermesvm.framework` | 4.9 MB |
| executable (Firestore, gRPC, BoringSSL, abseil, leveldb) | 18.1 MB |
| `libavif` + SDWebImage + ExpoImage | 5.3 MB |
| everything else | ~21 MB |

**React and Hermes alone are 16.5 MB** — over the limit before a line of this
church's code. React Native 0.86 ships them as prebuilt dynamic frameworks and
an App Clip is an independent bundle that must carry its own copies.

The 100 MB tier does not apply and never will. Apple grants it only to clips
supporting **digital invocations alone** — a link on a website or in Spotlight —
and explicitly not to App Clip Codes, QR codes or NFC tags. Every invocation
this parish has is a tag by a door or a code on a printed card.

So the clip is Swift, in `ios-appclip/`, built by `plugins/withNativeClip.js`.
It links no pods, carries no JavaScript engine, and reads the church's data over
REST — `/api/calendar` for the week, Firestore's REST API for the forms. **It
measures 3 MB.**

`plugins/withVehicleAppClip.js` in the Taksis repo is what the plugin is ported
from; that clip reached the same conclusion on the same domain.

### Two floors that are not negotiable

**15 MB**, because every invocation is physical, and **iOS 16.4**, because that
is Apple's minimum for an App Clip whatever it is written in. The second was
learned the same way as the first — from a rejection after a completed upload:

```
90838: Invalid MinimumOSVersion … has an invalid MinimumOSVersion value of
'16.0' … with a minimum OS of '16.4' or later.
```

`DEPLOYMENT_TARGET` in `plugins/withNativeClip.js` is 16.4, and `reset-ios.sh`
checks both that it has not dropped below Apple's floor and that it does not
exceed the app's own — a clip needing a newer iOS than its parent would leave
somebody able to install the app but not the clip inside it.

### What the native clip does not carry

The React Native clip shared screens with the app, so `/c/welcome` rendered the
very `TourScreen` the app does and the words could never drift. This cannot.
`about/tour.ts` is 842 lines and `about/future.ts` 497, and a Swift copy of
either would be a second original going stale the first time the church edits
the page through `aboutOverrides`.

So the long-form experiences do not copy it. They draw a native card answering
what cannot wait — may I come in, what happens, what am I expected to do — and
hand the reading to the church's own page in `SFSafariViewController`, which is
always current and costs the clip nothing. What stays native is everything
somebody came to a tag to *do*: see this week, send a photograph, open a form,
give.

### The App Check question, and what changed

`galleryUploadUrl` reads `X-Firebase-AppCheck` by hand and answers
`401 unattested` without it, so `/c/photos` still depends on the clip minting a
token. Going native removed the part that made this unanswerable: Apple builds
the relying-party identifier from the bundle it is *running in*, so the clip
attests as `org.spsm.connect.Clip`, while the old clip authenticated to Firebase
as the parent app because the plugin copied the parent's
`GoogleService-Info.plist` onto it. Those two could never both be satisfied.

`ios-appclip/SPSMConnectClip/AppAttest.swift` calls `DCAppAttestService` directly
and exchanges the attestation with App Check's REST endpoint for the **clip's
own** app id. Two things remain, and neither is code:

1. **Register `org.spsm.connect.Clip` as a second Firebase iOS app**, with App
   Attest enabled, and put its app id in `AppAttest.clipAppId`. Until then that
   file returns `.notConfigured` and the photographs screen says so plainly
   rather than failing at the upload.
2. **`DCAppAttestService.isSupported` may be false inside a clip.** Apple
   documents it false in some contexts and does not say whether an App Clip is
   one. If it is, nothing rescues `/c/photos` and the screen falls back to
   offering the app. That is one boolean on one device, and the code reports it
   distinctly from every other failure so the first run settles it.

### Running the clip

The clip has its own shared scheme, written by the plugin on every prebuild, and
Xcode's Run action is preset to `/c/schedule`.

```bash
npx expo run:ios --scheme SPSMConnectClip
```

To exercise a different experience, change the scheme's **App Clip Invocation
URL** (Run → Arguments) to any `/c/<slug>`. `ClipRouter` reads it from
`_XCAppClipURL`, and only in Debug — a release build takes its destination from
the system and nowhere else, so an environment variable can never override a
tag.

A simulator cannot test the invocation itself: the App Clip card, the codes and
associated-domain validation all need a device. Register a Local Experience
under **Settings → Developer → Local Experiences** with URL prefix
`https://www.spsmwayland.org/c` and bundle id `org.spsm.connect.Clip`, and a tag
or QR code holding one of those URLs brings up the real card. Local Experiences
bypass the association check, so this works before the AASA is deployed.

## Commands

```bash
npm run shared      # rebuild @spsm/shared from ../Website
npm run typecheck   # tsc --noEmit
npm run lint        # expo lint
npm test            # jest, on the modules that run without a native runtime
npm start           # Metro, for a dev client
npx expo run:ios    # build and run a dev client
```

## Releases

`eas.json` holds the four build profiles. The one that matters is
**production**, and what makes it the one that matters is a single line:

```json
"env": { "SQUARE_ENV": "production" }
```

`app.config.ts` defaults Square to the **sandbox** on purpose — a local
`npx expo run:ios` must never be able to charge the church's live account — so
production is opt-in, once, here. Forgetting it used to ship a store binary that
only accepted test cards.

The Square ids themselves are *not* in `eas.json` and must not be. `.env` is
gitignored and never reaches a build runner, so they come from the profile's EAS
environment:

```bash
eas env:set --name SQUARE_APPLICATION_ID --environment production --visibility sensitive
eas env:set --name SQUARE_LOCATION_ID --environment production --visibility sensitive
```

`app.config.ts` now **fails the build** rather than warning if `SQUARE_ENV` is
`production` and either id is missing, because the old behaviour was a warning
in a log nobody reads and a store binary that could not take a payment.

`google-services.json` and `GoogleService-Info.plist` are gitignored too, and
are EAS *file* environment variables for the same reason.

Two things are still outstanding before a first submission: the project has no
EAS project id yet (`eas init` writes `extra.eas.projectId`), and `submit`'s
`ascAppId` is unknown until the app exists in App Store Connect.

**`production-simulator`** exists to feed `npm run screenshots` a Release build
without a device.

### The two reset scripts

`./reset-ios.sh` and `./reset-android.sh` do the whole thing — wipe the
generated native directory, prebuild, install, verify, build — and each takes
one optional argument:

```bash
./reset-ios.sh              # sandbox Square, for development
./reset-ios.sh --store      # production Square, then archive in Xcode
```

```bash
./reset-android.sh          # sandbox Square, debug-signed APK
./reset-android.sh --store  # production Square, upload key required, AAB
```

`--store` is the only route to production Square and the only one that requires
the church's upload key. Neither is defaulted off anything, because
`app.config.ts` defaults to the sandbox precisely so that no ordinary build can
charge the church's live account, and a script must not quietly undo that.

**The verification is the point.** Every check guards something that fails
silently — the project builds and breaks later somewhere that does not point
back at the cause. The iOS script checks that the clip target, its embed phase,
its App Attest entitlement and its `GoogleService-Info.plist` all landed; that
Square's setup phase runs *after* `[CP] Embed Pods Frameworks`, without which a
Release build dies at launch under dyld with no crash report; that the clip's
version matches the app's, which App Store Connect otherwise rejects after the
whole archive has uploaded; and that every associated domain is on `www.` with
no bare apex, which is an association that can never validate. The Android
script checks that `withReleaseSigning` applied at all, and on `--store` that
all four key properties exist *before* it wipes anything.

Neither script contains a credential. The keystore and its passwords are four
Gradle properties in `~/.gradle/gradle.properties`, read by
`plugins/withReleaseSigning.js` — a script in a git repository is not a secret
store. Set `SPSM_UPLOAD_SHA1` to have the Android script pin the fingerprint
too.

### Building for the stores locally, without EAS

This is the path the project actually uses. `eas.json` stays as the record of
what a build profile *means*, and three things it would have done have to be
done by hand instead.

**1. Square must be told, every time.**

```bash
SQUARE_ENV=production npx expo prebuild --platform ios --clean
```

It has to be set for the Xcode or Gradle step too, not only for prebuild —
`extra.square` is embedded when Metro bundles, so archive from a terminal that
has it exported. Forgetting it ships an app that only takes test cards;
`app.config.ts` fails the build outright if the production ids are missing, so
the half-configured case cannot ship silently.

**2. `BUILD` in `app.config.ts` must be bumped by one for every upload.**

`autoIncrement` was EAS's job. Locally there is nothing to increment it, and
both stores refuse a build number they have already seen — on the *second*
submission, after a full upload. Bump it for every build you send, including
TestFlight builds and rejected ones.

**3. Android needs the church's upload key.**

The template signs the release with `debug.keystore`, whose password is the
string `android` and which is committed here. Play refuses it, and if it did
not the result would be worse: the first upload binds the package name to
whatever key signed it forever. `plugins/withReleaseSigning.js` replaces that,
and reads four properties from `~/.gradle/gradle.properties` — never from this
repository:

```
SPSM_UPLOAD_STORE_FILE=/absolute/path/to/spsm-upload.jks
SPSM_UPLOAD_KEY_ALIAS=spsm-upload
SPSM_UPLOAD_STORE_PASSWORD=…
SPSM_UPLOAD_KEY_PASSWORD=…
```

Generate the keystore once, keep it outside the repository, and back it up — a
lost upload key can only be recovered through Play support, and only with Play
App Signing enrolled:

```bash
keytool -genkeypair -v -keystore spsm-upload.jks -alias spsm-upload -keyalg RSA -keysize 2048 -validity 10000
```

Every release build prints which key it used. For the build that is actually
going to Play, make the fallback fatal rather than trusting the log:

```bash
SQUARE_ENV=production ./gradlew :app:bundleRelease -PSPSM_REQUIRE_UPLOAD_KEY=1
```

`npx expo prebuild --platform android --clean` deletes `android/local.properties`
along with everything else it regenerates, so export `ANDROID_HOME` (or write
the file again) before the first Gradle run afterwards.

Run by hand and rarely, with their outputs committed:

```bash
npm run icons       # assets/ — the app icon and the splash, from the seal
npm run screenshots # store/raw/ — drives a simulator and an emulator
npm run store       # store/ — Play's feature graphic and icon, and the screenshots
```

All three draw the church seal out of `../Website` through
`scripts/brand.mjs`, and need `rsvg-convert` (`brew install librsvg`).
`store/README.md` says which file goes in which field of which console.

`npm run screenshots` wants a Release build to photograph — `npm run
ios:release` for the iOS half, and `(cd android && ./gradlew assembleRelease)`
with an emulator already running for the Android half. Release rather than
Debug because a Debug build needs Metro and paints a dev overlay across the
corner of every shot.
