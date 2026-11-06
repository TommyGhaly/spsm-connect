# NFC tag test checklist

There are nine tags, and every one is `https://www.spsmwayland.org/c/<slug>`.
**Check the `www.`** when you write a tag. The apex domain redirects with a 301,
Apple won't follow that redirect, and a tag without `www.` will open Safari
instead of the clip.

Test each tag in up to four states, because each state takes a different path:

| | State | What should open |
|---|---|---|
| **A** | iPhone, SPSM Connect **not** installed | App Clip card → native Swift clip (`ios-appclip/`) |
| **B** | iPhone, SPSM Connect installed | The app, routed by `app/c/[slug].tsx` |
| **C** | Android, SPSM Connect installed | The app, through the verified App Link → `app/c/[slug].tsx` |
| **D** | Android, app not installed (or any browser) | The website's fallback page `/c/<slug>.html` |

## Per tag

| ✓ | Tag | A — iPhone clip | B / C — full app lands on | D — fallback page links to |
|---|---|---|---|---|
| ☐ | `/c/give` | Giving screen; tapping through opens Tithe.ly in an in-app Safari sheet | `/giving` | `/giving` |
| ☐ | `/c/schedule` | "This Week": week and month calendar, read-only | `/calendar` | `/calendar` |
| ☐ | `/c/apps` | Taksis, Tithe.ly, plus a card for SPSM Connect | `/apps` | `/apps` |
| ☐ | `/c/welcome` | Liturgy tour (full text) | `/about/welcome-newcomers` | same |
| ☐ | `/c/plans` | Expansion plans; flythrough opens in Safari | `/about/future-plans` | same |
| ☐ | `/c/bookstore` | Shelf + Apple Pay. If there's no merchant ID, no wallet, or the card is declined, it should show the hand-off card instead | `/bookstore` | `/bookstore` |
| ☐ | `/c/forms` | Opens straight into the form set in `config/forms.nfcFormSlug`, **not** the list; the list is one tap away. Fill it in and send it | `/forms/<nfcFormSlug>`. A spinner first, then a redirect. Falls back to `vehicle-registration` if the config read fails | `/forms` |
| ☐ | `/c/photos` | Camera only (no photo library in a clip), filed under `config/events.mainSection`. The section can be changed from the pill | `/` (the camera is the home screen) | `/events` |
| ☐ | `/c/register-vehicle` | **Taksis's clip, not ours**: Taksis should open | SPSM Connect must **not** claim it. Taksis or Safari should open | Taksis's page |

For every tag in state B or C, also check:
- ☐ The back gesture doesn't return to a blank screen. The route uses `replace`.
- ☐ A brand-new slug shows "NOT IN THIS VERSION" instead of crashing.

## Testing without the physical tags

- **iPhone, clip (A):** go to Settings → Developer → App Clips Testing → Local
  Experiences, register `https://www.spsmwayland.org/c/<slug>` against bundle
  `org.spsm.connect.Clip`, then open the URL from Notes or Messages. If you type
  it into Safari's address bar, Safari opens the page itself and never tries
  the app or clip.
- **iPhone, app (B):** paste the URL into Notes and tap it. In the simulator:

  ```bash
  xcrun simctl openurl booted https://www.spsmwayland.org/c/schedule
  ```

- **Android (C):**

  ```bash
  adb shell am start -a android.intent.action.VIEW -d https://www.spsmwayland.org/c/schedule
  ```

  If it opens a browser, App Links verification failed:

  ```bash
  adb shell pm get-app-links org.spsm.connect
  ```

## Writing the tags

Use NFC Tools (or a similar app) and write a single **URI** record containing
the full `https://www.` URL. When you're done, lock the tag so nobody can
rewrite the one on the wall. Lock only after it passes A–D, because locking
can't be undone.
