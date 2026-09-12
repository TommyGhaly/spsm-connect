# SPSM Connect

The parish's second app, and part 2 of the three-part program the website is
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
```

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
  `config/theme`, so the parish can change its own look without a release.
- **Every anonymous list query carries its filter** — `published == true`, and
  for galleries `status == 'approved'`. Firestore judges a `list` on its
  *potential* result set, so omitting the filter fails the whole query rather
  than returning less.
- **Never authorize off the `screens` claim.** It is a lagging mirror that
  exists only because Storage rules cannot read Firestore. `src/firebase/grants.ts`
  reads the member document and force-refreshes the token when the two disagree.

## The App Clip, and the question it is waiting on

There is one clip target, `org.spsm.connect.Clip`, and nine invocation URLs
planned against it — see `../Website/docs/app-clip-experiences.md`. It is built
but it renders one screen, deliberately: a spike.

**Can Firebase App Check mint a token inside an App Clip?** Apple's App Attest,
used in a clip, attests against the **parent** app's bundle identifier while
Firebase builds its request from the bundle it is running in, so the two
disagree by construction. It decides the whole feature, because
`galleryUploadUrl` and `formUploadUrl` read `X-Firebase-AppCheck` by hand and
answer `401 {"error":"unattested"}` without it. No token, no photographs and no
forms — the two things the clip exists for.

### Running it

**It must be a real device.** App Attest refuses a simulator outright, and a
debug token registered in the console makes the simulator pass while telling you
nothing: the debug provider never goes near App Attest, so it would report a
pass for a build that fails in a parishioner's hand.

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
against the parish's current main section; `sweepUnuploadedSubmissions` deletes
it an hour later.

### Reading the answer

- **Pass** — all nine experiences are buildable. Size becomes the next question.
- **Fail** — the clip cannot write anything. That is not the end of it: a
  read-only clip is still worth having, and every tag still works for everybody
  through the website. But it is a different plan, and much cheaper to know now.

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
npm start           # Metro, for a dev client
npx expo run:ios    # build and run a dev client
```
