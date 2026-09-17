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
| `/c/bookstore` | Explains, then hands off — Square's SDK is not in this target |
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

### The question, and how far it can be answered without a device

**Can Firebase App Check mint a token inside an App Clip?** It decides two of
the eight experiences: `galleryUploadUrl` and `formUploadUrl` read
`X-Firebase-AppCheck` by hand and answer `401 {"error":"unattested"}` without
it, so no token means no photographs and no forms. The other six read or hand
off and are unaffected either way.

Reading the SDK and the configuration settles most of it, and the answer is that
**the clip as currently configured cannot succeed** — for a reason that is
fixable, and behind a question that is not yet settled.

1. **Apple binds an attestation to the bundle it is running in.** The
   relying-party identifier is the team id concatenated with *the app's* bundle
   identifier. Inside the clip that is `org.spsm.connect.Clip`, not the parent.
   (The note this file used to carry had it the other way round — that a clip
   attests as its parent. That was the wrong guess, and it does not change the
   conclusion, only which side the mismatch is on.)

2. **The clip authenticates as the parent app.** `plugins/withClipTarget.js`
   copies the parent's `GoogleService-Info.plist` onto the clip target, so the
   clip talks to the Firebase iOS app registered for `org.spsm.connect` —
   confirmed: both plists carry the same `BUNDLE_ID` and `GOOGLE_APP_ID`.

3. **And it tells the backend which bundle it really is.** `AppCheckCore`'s
   `GACAppCheckAPIService.m` stamps every request with
   `[[NSBundle mainBundle] bundleIdentifier]`, which in the clip is
   `org.spsm.connect.Clip`.

So the attestation says `…Clip`, the Firebase app says `org.spsm.connect`, and
the bundle header says `…Clip`. Those cannot all be satisfied at once, and a
rejection is the expected outcome rather than a surprise.

**The fix, if App Attest runs in a clip at all:** register a *second* Firebase
iOS app for `org.spsm.connect.Clip`, give the clip its own
`GoogleService-Info.plist` naming it, and register App Attest for that app in
App Check. Everything is then self-consistent. That is a console change plus a
small change to `withClipTarget.js`, which currently copies the parent's file.

**What still needs hardware, and only this:** whether
`DCAppAttestService.isSupported` is true inside an App Clip process at all.
Apple documents that it is false in some contexts — most app extensions — and an
App Clip is not an app extension, so the carve-out does not obviously apply and
the documentation does not say either way. If it is false, no configuration
rescues it and the clip ships read-only. That is one boolean, and the spike now
reports it directly.

`src/clip/AppCheckSpike.tsx` was changed to answer this in **one run** rather
than leaving a bare null to be interpreted: it prints the plist's bundle id
beside the running process's, surfaces the actual SDK error instead of
swallowing it (`appCheckTokenOrReason` in `src/firebase/appCheck.ts`), and adds
a "What that means" line that distinguishes *App Attest is unavailable here*
from *the exchange was refused*. The first is fatal to the feature; the second
is the bundle mismatch above, and is fixable.

### Running the spike

**It must be a real device.** App Attest refuses a simulator outright, and a
debug token registered in the console makes the simulator pass while telling you
nothing: the debug provider never goes near App Attest, so it would report a
pass for a build that fails in somebody's hand.

```bash
npx expo prebuild --platform ios --clean
npx expo run:ios --device --configuration Release --scheme SPSMConnectClip
```

**Match the App Attest environment to how you signed.** A mismatch fails
attestation and reads exactly like App Check being broken, which is the one
false answer this spike must not give.

- **TestFlight** — build as above. `production` is correct and is the default.
- **Locally on your own device** — prepend `APPATTEST_ENV=development` to the
  prebuild. Do *not* reach for `APP_VARIANT=development` instead: that changes
  the bundle id to `org.spsm.connect.dev`, which means a second Firebase iOS
  app, a second `GoogleService-Info.plist` and a second pair of App IDs, for one
  run.

```bash
APPATTEST_ENV=development npx expo prebuild --platform ios --clean
```

`plugins/withClipTarget.js` copies whatever that resolves to onto the App Clip
target, which ships with no entitlements of its own.

The screen runs three checks on its own — Firebase initialised, anonymous
sign-in, App Check token — and offers a fourth behind a button, which asks
`galleryUploadUrl` for a real reservation. That last one writes one pending row
against the church's current main section; `sweepUnuploadedSubmissions` deletes
it an hour later.

### Reading the answer

Three outcomes, and the screen names which one it got.

- **Pass** — all eight experiences are shippable. Size becomes the next question.
- **Fail, "App Attest is not available inside an App Clip at all"** — the
  `isSupported` case. Nothing fixes it: `/c/forms` and `/c/photos` cannot write,
  and the clip ships read-only. The other six are unaffected, and both tags
  still work for everybody through the fallback pages on the website. A
  read-only clip is still worth having; it is just a shorter list of experiences
  to register.
- **Fail, "the exchange was refused"** — the bundle mismatch above, and it is
  worth one more attempt before giving up the feature: a second Firebase iOS app
  for `org.spsm.connect.Clip`, its own `GoogleService-Info.plist`, App Attest
  registered for it, and `withClipTarget.js` copying that file instead of the
  parent's. Then run the spike again.

### What the build needed that the plugin does not provide

`plugins/withClipTarget.js`, and all three were found by generating the project
and reading it. Each would have broken the clip in a way that looks like
something else:

1. **Its own JS entry.** Without `ENTRY_FILE`, the clip bundles expo-router,
   whose `require.context` over `app/` pulls in every screen, the upload queue,
   SQLite and the background task. Measured: swapping a component underneath the
   router took the clip bundle from 1,930 modules to 1,931 — it added the
   replacement and removed nothing. The seam had to move to `index.clip.ts`.
2. **The App Attest entitlement**, which the clip's generated entitlements file
   does not inherit from `ios.entitlements`.
3. **A `GoogleService-Info.plist`**, which the clip target ships without.

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
