/**
 * The App Store's custom product pages, as one table.
 *
 * ---------------------------------------------------------------------------
 * A custom product page is a second copy of the listing, with its own
 * screenshots, its own promotional text and its own URL, that App Store Connect
 * serves to whoever arrives by that URL. The name, subtitle, icon and
 * description are the default listing's and cannot change. So what a page
 * gets to do is put a different screen first, and say a different sentence over
 * it.
 *
 * That is worth having here because people come to this app for one errand.
 * Somebody holding a phone over the giving tag by the door wants to see the
 * giving screen first, not the Creed. Each row below is one of those errands,
 * and the rows follow the App Clip experiences in `src/clip/experiences.ts`,
 * because those are the errands the parish has already printed on tags.
 *
 * ## What each row drives
 *
 *   - `npm run store` writes the screenshots to
 *     `store/product-pages/<slug>/ios/<set>/`, renumbered in `screens` order,
 *     and writes `store/product-pages/README.md` with the copy to paste.
 *   - `screens` names screenshots by what they show. A name resolves to a main
 *     listing capture (`store/raw/ios/<set>/<n>-<name>.png`) first, and
 *     otherwise to one taken only for these pages
 *     (`store/raw/pages/ios/<set>/<name>.png`). `capture-screenshots.sh` takes
 *     both. A name found in neither is a hard failure.
 *   - `deepLink` is the page's **Deep Link** field (iOS 18 and later): where the
 *     app opens when somebody installs it from this page. Each is an App Clip
 *     invocation URL, which the association file already gives this app and
 *     `app/c/[slug].tsx` already routes, so nothing new has to agree with it.
 *
 * ## Apple's limits, checked in make-store-assets.mjs
 *
 * Promotional text is at most 170 characters. A page needs at least one
 * screenshot per required size and takes up to ten. An account gets 70 pages.
 * ---------------------------------------------------------------------------
 */

/** What App Store Connect allows in the Promotional Text field. */
export const PROMO_LIMIT = 170;

/** Screenshots per device size on one page. */
export const SCREEN_LIMIT = 10;

const CLIP = 'https://www.spsmwayland.org/c';

export const PRODUCT_PAGES = [
  {
    slug: 'give',
    /** The page's name inside App Store Connect. Nobody outside sees it. */
    reference: 'Give',
    promo:
      'Make an offering to the church from your phone. Giving goes through Tithe.ly, ' +
      'with Apple Pay, and this week’s services are one tab away.',
    deepLink: `${CLIP}/give`,
    screens: ['giving', 'calendar', 'belief', 'forms', 'bookstore'],
  },
  {
    slug: 'bookstore',
    reference: 'Bookstore',
    promo:
      'The church bookstore’s shelf on your phone. Put books in a basket, pay with ' +
      'Apple Pay, and collect them at the church or have them delivered.',
    deepLink: `${CLIP}/bookstore`,
    screens: ['bookstore', 'calendar', 'giving', 'forms', 'belief'],
  },
  {
    slug: 'this-week',
    reference: 'This Week',
    promo:
      'Every service and event at the church this week, and the Liturgy live when you ' +
      'cannot be there. Church forms and giving are in the same app.',
    deepLink: `${CLIP}/schedule`,
    screens: ['calendar', 'livestream', 'forms', 'giving', 'belief'],
  },
  {
    slug: 'newcomers',
    reference: 'Newcomers',
    promo:
      'New to the Coptic Orthodox Church? Take the six-station tour before you visit, ' +
      'see this week’s services, and watch a Liturgy live first.',
    deepLink: `${CLIP}/welcome`,
    screens: ['welcome', 'belief', 'calendar', 'livestream', 'forms'],
  },
  {
    slug: 'forms',
    reference: 'Forms',
    promo:
      'The church’s forms, filled in on your phone: register a vehicle, reach the ' +
      'church office, and more. None of them needs an account.',
    deepLink: `${CLIP}/forms`,
    screens: ['forms', 'calendar', 'giving', 'bookstore', 'belief'],
  },
  {
    slug: 'plans',
    reference: 'Expansion Plans',
    promo:
      'See the three buildings designed for 169 Rice Road and where the work stands, ' +
      'and give toward them from the same app.',
    deepLink: `${CLIP}/plans`,
    screens: ['plans', 'giving', 'calendar', 'welcome', 'belief'],
  },
];
