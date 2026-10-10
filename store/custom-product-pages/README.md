# App Store custom product pages

Six alternate App Store listings for SPSM Connect, each aimed at one errand, plus the
default listing everyone else sees. Built the same way as Taksis's
(`Taksis/screenshots/custom-product-pages/`), so the parish's two apps are uploaded the
same way.

Unlike Taksis's, the screens inside the frames are **real captures** from `../raw/`, not
HTML recreations. Nothing on these screens is anybody's personal data. The one exception
is the calendar, which shows the church's real week: an event can carry a servant's
name and phone number, and the main listing's `2-calendar` capture shows one. So the pages
use their own calendar capture (`../raw/pages/ios/*/calendar.png`, taken on a clean
Saturday). Look at it again after every recapture.

| Page | Audience | Deep link |
| --- | --- | --- |
| [`give/`](give) | People giving, from the tag by the door or a bulletin | `spsmconnect:///giving` |
| [`bookstore/`](bookstore) | People at the bookstore table or shopping its shelf | `spsmconnect:///bookstore` |
| [`week/`](week) | Parishioners checking what is on and when | `spsmconnect:///calendar` |
| [`newcomers/`](newcomers) | Visitors and anyone new to the Coptic Orthodox Church | `spsmconnect:///about/welcome-newcomers` |
| [`forms/`](forms) | Anyone sent to fill in a church form | `spsmconnect:///forms` |
| [`plans/`](plans) | Parishioners following the building project | `spsmconnect:///about/future-plans` |
| [`listing/`](listing) | **The default App Store listing** (not a custom page). It covers the whole app and adds subtitle, keywords and description files | |

Every page folder is laid out for App Store Connect (Xcode doesn't upload screenshots).
Each slot gets a numbered folder holding only that slot's files, so you can drag a folder's
contents straight in. Each page's own `README.md` walks through the slots in order.

| In each page folder | Size | App Store Connect slot |
| --- | --- | --- |
| `1-iPhone-6.9/` | 1320 × 2868 | iPhone 6.9" display |
| `2-iPhone-6.3/` | 1206 × 2622 | iPhone 6.1" or 6.3" display |
| `3-iPad-13/` | 2064 × 2752, portrait | iPad 12.9" or 13" display |
| `4-Header-Asset/` | 3840 × 1646 | Header Asset |
| `5-Search-Results-Asset/` | 3840 × 2560 | Search Results Asset |
| `alternate-5244x2950/` | 5244 × 2950 | Either asset slot, if you want one image for both |
| `promotional-text.txt` | | Promotional text, ready to paste |
| `deep-link.txt` | | Deep link, ready to paste |

The iPad shots are portrait because that is how the captures are taken
(`scripts/capture-screenshots.sh`), and the app has no landscape-only layout worth showing.

## About the deep links

The links use the app's own `spsmconnect://` scheme (`scheme` in `app.config.ts`), as
Taksis's use `taksis://`. Unlike Taksis's, **they already land on the right screen**:
expo-router resolves each path to the route a tap would, which is how the capture script
reaches every screen. No new binary is needed.

They are deliberately not the `https://www.spsmwayland.org/c/<slug>` App Clip URLs. Those
are printed on tags and belong to the clip experiences. A custom-scheme link only ever
means "open the app on this screen".

## Uploading

Follow the page's own README. Once submitted and approved, each page gets its own URL
(`…?ppid=<id>`). Use it in bulletins, emails, QR codes or the website for that audience,
in place of the plain listing.

App Store Connect also lets you attach search keywords to a custom product page, so
people who search for those words see it instead of the default listing.

## Editing and re-rendering

Captions, banner copy and which screen goes in each shot live in
[`src/shots.html`](src/shots.html). The `SHOTS` table maps each file to its eyebrow, headline,
subhead and screen; `PAGES` holds each banner's copy and three screens. Open
`src/shots.html?shot=give-01` in Chrome to preview one, then re-render them all:

```bash
./src/render.sh
```

This needs Google Chrome and the captures in `../raw/`. It renders the iPhone 6.9", iPad and
banner images in parallel in about a minute and a half, then scales the 6.9" set down to make
the 6.3" one. It finishes by running `src/page_readmes.py`, which rewrites each page's README
and text files. Promotional text, deep links and the default listing's subtitle, keywords and
description are set there. Each banner's subhead (`blurb` in `shots.html`) is the promotional
text minus what the headline says, so edit the two together.

To retake the captures only these pages use (calendar, welcome, plans, livestream) without
re-shooting the main listing:

```bash
PAGES_ONLY=1 npm run screenshots:ios
```
