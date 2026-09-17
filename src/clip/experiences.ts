/**
 * The eight App Clip experiences, as one table.
 *
 * ---------------------------------------------------------------------------
 * **One binary, eight invocations.** There is no such thing as eight App Clips.
 * There is one clip target — `org.spsm.connect.Clip` — and eight *experiences*
 * registered against it in App Store Connect, each with its own URL, card title,
 * subtitle and image. All eight share one 15 MB budget.
 *
 * Every URL is `https://spsmwayland.org/c/<slug>`, which is the shape Taksis's
 * vehicle-registration clip already uses on this domain. Three properties come
 * with that shape and are the reason for it:
 *
 *   1. **An invocation URL can never be renamed.** It is compiled into the
 *      experience in App Store Connect and printed on physical tags and cards.
 *      `/c/<slug>` is a namespace that exists to be permanent; `/calendar` is a
 *      website route, and a website route is somebody's to reorganise.
 *   2. **Apple will not follow a redirect from one.** So each URL must be a real
 *      file on the site. `apps/website/public/c/<slug>.html` in the Website repo
 *      is that file, and it is also the Android and dismissed-the-card fallback.
 *   3. **It keeps the two apps apart.** `/c/register-vehicle` is Taksis's and
 *      stays Taksis's; the association file gives it that one path and gives
 *      these eight to SPSM Connect, with no glob overlapping the other app.
 *
 * ## Four things every row has to agree with, outside this repository
 *
 *   - `apps/website/public/.well-known/apple-app-site-association` — `path`
 *     appears in SPSM Connect's `applinks` components, or the installed app
 *     never opens and the tag goes to Safari instead.
 *   - `apps/website/public/c/<slug>.html` — the fallback page.
 *   - App Store Connect → Advanced App Clip Experiences — `title` and `card` are
 *     what somebody reads on the card before anything is downloaded.
 *   - `app/c/[slug].tsx` in this repo — where the **full app** goes when it is
 *     installed and the same URL is opened. It reads `appPath` below.
 * ---------------------------------------------------------------------------
 */

/**
 * The public website, which is where the tags point.
 *
 * ---------------------------------------------------------------------------
 * **`www.`, and that is not a style choice.** The apex answers 301 to the `www`
 * host for every path, `/.well-known/` included — verified against the live
 * site — and **Apple follows no redirect for either of the two things that
 * matter here**: an App Clip invocation URL, and the association file it is
 * validated against. A tag printed `spsmwayland.org/c/give` would resolve to a
 * page in Safari and would never open the clip.
 *
 * So the canonical host is the one that answers 200. `invocation.ts` still
 * accepts the apex, because a URL typed by hand or printed before this was
 * noticed should still find the right experience if it ever reaches the app.
 *
 * Deliberately not `EXPO_PUBLIC_API_ORIGIN`, which is the Hosting origin the
 * app makes API calls against (`spsm-database.web.app` by default, and a
 * staging site in a staging build). These URLs are printed on metal: they are
 * the church's own domain, always, and a staging build must not change what a
 * clip believes its own invocation URLs are.
 * ---------------------------------------------------------------------------
 */
export const PUBLIC_ORIGIN = 'https://www.spsmwayland.org';

/** The one path segment every experience sits under. Taksis is here too. */
export const CLIP_PREFIX = '/c';

export type ClipSlug =
  | 'give'
  | 'schedule'
  | 'apps'
  | 'welcome'
  | 'plans'
  | 'bookstore'
  | 'forms'
  | 'photos';

/**
 * How much of the errand this binary can finish on its own.
 *
 * `native` — the clip does the thing. `handoff` — the clip explains the thing
 * and offers the full app, because something it needs is not in this target.
 * There are two of those and both are budget, not policy; see the rows.
 */
export type ClipKind = 'native' | 'handoff';

export interface Experience {
  slug: ClipSlug;
  /** The card title in App Store Connect. Title case, and short. */
  title: string;
  /** The card's second line. One sentence, no full stop — Apple's house style. */
  card: string;
  kind: ClipKind;
  /** The route the **full app** opens for this URL. See `app/c/[slug].tsx`. */
  appPath: string;
  /** The page on the website that says the same thing, for anybody without the app. */
  sitePath: string;
}

export const EXPERIENCES: readonly Experience[] = [
  {
    slug: 'give',
    title: 'Give',
    card: 'Make an offering to the church',
    /*
     * Native, and this is the row most likely to be misread as a handoff.
     *
     * The gift is taken on `give.tithe.ly` either way — the church's giving is
     * Tithe.ly's, here and on the website and in the full app — and the app
     * opens it in `SFSafariViewController` rather than embedding it, for the
     * three reasons `giving/open.ts` sets out (the wallets work, the address is
     * visible, and it is the mechanism Apple names for donations outside IAP).
     * `expo-web-browser` is not excluded from this target, so the clip does
     * exactly what the app does, with the same verse over it.
     */
    kind: 'native',
    appPath: '/giving',
    sitePath: '/giving',
  },
  {
    slug: 'schedule',
    title: 'This Week',
    card: 'Services and events at the church this week',
    kind: 'native',
    appPath: '/calendar',
    sitePath: '/calendar',
  },
  {
    slug: 'apps',
    title: 'The Parish’s Apps',
    card: 'Taksis, Tithe.ly and SPSM Connect',
    /*
     * An App Clip *is* an App Store card, so a clip advertising apps is
     * circular — the website's `docs/app-clip-experiences.md` argued against
     * this one and it is here anyway, for the one thing the circularity does not
     * cover: a card handed to a newcomer lists *four* things, only one of which
     * is this app, and a Smart App Banner cannot introduce Taksis.
     */
    kind: 'native',
    appPath: '/apps',
    sitePath: '/apps',
  },
  {
    slug: 'welcome',
    title: 'Welcome',
    card: 'What happens in the liturgy, if you have not been before',
    kind: 'native',
    appPath: '/about/welcome-newcomers',
    sitePath: '/about/welcome-newcomers',
  },
  {
    slug: 'plans',
    title: 'Our Expansion Plans',
    card: 'The three buildings designed for 169 Rice Road',
    kind: 'native',
    appPath: '/about/future-plans',
    sitePath: '/about/future-plans',
  },
  {
    slug: 'bookstore',
    title: 'The Bookstore',
    card: 'See the shelf and buy in the app',
    /*
     * Handoff, and the only reason is the 15 MB budget.
     *
     * Physical goods may not be sold through in-app purchase, so the only way to
     * take money for a book is Square's native SDK — which is in
     * `excludedPackages` in app.config.ts, because it is a large framework in a
     * budget that has none to spare. `payments/square.ts` degrades honestly
     * rather than crashing (`paymentsAvailable()` is false in this binary), so
     * the shelf itself could be drawn here; what cannot be drawn is a Buy
     * button that works, and a shop that cannot sell is a worse card than an
     * honest one. Revisit the day there is a measurement, not before.
     */
    kind: 'handoff',
    appPath: '/bookstore',
    sitePath: '/bookstore',
  },
  {
    slug: 'forms',
    title: 'Parish Forms',
    card: 'Fill in a church form from your phone',
    kind: 'native',
    appPath: '/forms',
    sitePath: '/forms',
  },
  {
    slug: 'photos',
    title: 'Send a Photograph',
    card: 'Add a photograph to the parish galleries',
    /*
     * Camera only, and that is Apple's rule rather than a simplification:
     * PhotoKit provides no functionality at runtime inside an App Clip, so
     * "choose from my library" does not exist here. `expo-media-library` is
     * excluded from the target for the same reason.
     */
    kind: 'native',
    // The camera is the app's home screen — see `app/(drawer)/(tabs)/index.tsx`.
    appPath: '/',
    sitePath: '/events',
  },
];

export function experience(slug: string): Experience | undefined {
  return EXPERIENCES.find((entry) => entry.slug === slug);
}

/** `https://spsmwayland.org/c/give` — what goes on the tag and in App Store Connect. */
export function invocationUrl(slug: ClipSlug): string {
  return `${PUBLIC_ORIGIN}${CLIP_PREFIX}/${slug}`;
}

/** The website page behind an experience, for anybody who cannot or will not install. */
export function siteUrlFor(slug: ClipSlug): string {
  return `${PUBLIC_ORIGIN}${experience(slug)?.sitePath ?? ''}`;
}

/**
 * The experience that draws a given app route, when there is one.
 *
 * This is the lookup that lets a screen borrowed from the full app keep its own
 * `router.push('/about/future-plans')` and land on the clip's Plans screen
 * instead of a handoff. See `navigate.ts`.
 *
 * `/` is matched exactly rather than by prefix, or every path in the app would
 * resolve to the camera.
 */
export function experienceForAppPath(path: string): Experience | undefined {
  const clean = (path.split('?')[0] ?? '').replace(/\/+$/, '') || '/';
  return EXPERIENCES.find(
    (entry) => entry.appPath === clean || (entry.appPath !== '/' && clean.startsWith(`${entry.appPath}/`)),
  );
}
