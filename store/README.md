# Store listings

Everything the App Store and Play ask for as a *picture*. Generated, not drawn
by hand — `scripts/make-store-assets.mjs` composes the artwork from the church
seal in `../Website`, and the two `capture-screenshots*.sh` scripts drive a
simulator and an emulator.

The outputs are committed for the same reason `assets/` is: so that the next
person changing the background colour reruns a script instead of reopening a
design tool, and so that a diff shows when a listing's artwork changed.

Listing *copy* — the description, the keywords, the subtitle — is not here.
This directory is images only.

## Rebuilding

```bash
npm run icons          # assets/ — app icon, splash. Unrelated, but shares brand.mjs.
npm run ios:release    # the build the iOS screenshots are taken from
npm run screenshots    # simulators + emulator -> store/raw/
npm run store          # draws the Play artwork, conforms store/raw/ -> store/screenshots/
```

`npm run store` is safe to run on its own; it skips whatever is missing from
`store/raw/` and says so. The screenshot scripts are the slow, fussy half.

Everything needs `../Website` checked out beside this repo — that is where the
seal and `sharp` both come from. See the header of `scripts/brand.mjs`.

## The App Clip cards

`clip-cards/` holds eight **1800x1200** images, one per App Clip experience.
They are not part of either store listing: each is uploaded in App Store
Connect under **Advanced App Clip Experiences**, against the experience whose
invocation URL is `https://www.spsmwayland.org/c/<slug>` — so `give.png` goes on
the `/c/give` experience and so on down.

The card is what somebody sees when they hold a phone over a tag by a door, and
for most people it is the only part of this app they will ever look at. The
composition is deliberately Taksis's, in this church's colours, so that the
parish's two apps look related to the people holding both — see the header of
`scripts/make-clip-cards.mjs`.

```bash
npm run clip-cards
```

It fails if the eight slugs have drifted from `src/clip/experiences.ts`, which
is the table the URLs, the fallback pages and the association file all come
from.

## What goes where

### Google Play

| File | Where it goes |
| --- | --- |
| `android/feature-graphic.png` (1024×500) | Store listing → Graphics → Feature graphic |
| `android/icon-512.png` (512×512) | Store listing → Graphics → App icon |
| `screenshots/android/phone/*.png` | Store listing → Graphics → Phone screenshots |

Play wants **at least two** phone screenshots before it will let a release out
of draft, and takes up to eight.

The phone screenshots are padded, and that is deliberate rather than a
mistake: Play refuses an image whose long side is more than twice its short
side, and every modern phone's screen is taller than that. A Pixel 9a is
1080×2424, which is 2.24∶1. The script scales each shot to fit and fills the
rest with `deep`, so the result is exactly 2∶1 with the whole screen intact.
Cropping instead would take the tab bar off the bottom. See `RULES` in
`scripts/make-store-assets.mjs`.

The APK those screenshots come from is signed with the **debug keystore** —
that is what Expo's generated `build.gradle` does for `release` and it is fine
for a picture. It is not the artefact to upload. Play takes an AAB, signed
properly:

```bash
cd android && ./gradlew bundleRelease
```

### App Store

| File | Where it goes |
| --- | --- |
| `screenshots/ios/6.9/*.png` | App Store Connect → the 6.9" iPhone slot |
| `screenshots/ios/13/*.png` | App Store Connect → the 13" iPad slot |

There is no icon here. iOS takes its icon from the binary — `assets/icon.png`,
via `app.config.ts` — and App Store Connect has no field to upload one into.

Those two slots are the only ones Apple still *requires*; it scales every
smaller class down from them. The iPad set is mandatory rather than optional
because `app.config.ts` sets `supportsTablet: true`. Drop that and the iPad
column goes away with it.

Apple wants the **exact** pixel dimensions of a real device and rejects
anything else, so `npm run store` checks these and never resizes them. A
mismatch is a hard failure at that point, which is much cheaper than hearing
about it an hour after an upload.

## The screenshots themselves

Five screens, the same five in the same order on both platforms, so the two
listings tell the same story:

1. **Send** — the photo upload, which is what the app is for
2. **Calendar**
3. **Bookstore**
4. **Giving**
5. **Forms**

They are reached by deep link (`spsmconnect:///calendar` and so on) rather than
by tapping the tab bar, because tab positions move with the device width and
the admin tab only appears for a signed-in servant. None of the five needs an
account: the upload path signs in anonymously on its own, and the rest is
public. The status bar is frozen at 9:41 with a full battery on both platforms.

**Look at the raw PNGs before uploading.** A screenshot of a loading spinner,
or of the not-found screen after a route is renamed, is a perfectly valid image
and nothing downstream will object to it.
