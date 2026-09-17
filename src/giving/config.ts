/**
 * Where the church's giving form lives, and which app is the right one.
 *
 * The app's half of the website's `features/giving/config.ts` and the
 * `TITHELY_APP` record in its `features/apps/stores.ts`. Both are copied rather
 * than shared, and that is worth stating plainly: `@spsm/shared` is the right
 * home for them the day a third thing needs them, and until then two files that
 * must agree are two files that can drift. **If the church's giving form or the
 * store listing moves, it moves in both repositories.**
 */

/**
 * The church's Tithe.ly giving form.
 *
 * **Committed, not read from `.env`, and that is deliberate** — the website's
 * copy of this constant explains it at length and the reasoning carries over
 * whole. The short version: `.env` is not in the repository, so anything that
 * lives only there is absent from every build that is not Tommy's laptop, and
 * for eight months the website's giving page said "online giving is being set
 * up" to every visitor because of exactly that.
 *
 * It is not a credential. It is the identifier Tithe.ly prints in the embed
 * snippet it hands you, it ships in the website's HTML already, and it
 * authorises nothing beyond opening a public donation form. A key would still
 * go in `.env`.
 *
 * The env var still wins where it is set, so a test form can be swapped in
 * without a code change. Written out in full rather than destructured because
 * Expo inlines `process.env.EXPO_PUBLIC_*` by textual substitution — a
 * destructured read is a read of `undefined` in a release build.
 */
export const GIVING_FORM_ID =
  process.env.EXPO_PUBLIC_TITHELY_FORM_ID || '44f1af1b-7edf-4005-af05-0c7a7f7249ac';

/** Where Tithe.ly's hosted form lives. */
export const GIVE_ORIGIN = 'https://give.tithe.ly';

/**
 * The form as a page.
 *
 * Derived from the form id rather than configured separately, because two
 * settings that must agree are one setting and a bug.
 * `EXPO_PUBLIC_TITHELY_GIVING_URL` overrides it for the case where the church's
 * giving page moves somewhere that is not a form id at all.
 *
 * Note what is *not* here: the website's `giveFormUrl()`, which appends
 * Tithe.ly's `?context=modal`. That parameter exists to make their page post
 * `closeWindow` to a parent frame, and nothing here is a frame — see
 * `open.ts` for why this app gives Tithe.ly a real browser rather than an
 * embedded one.
 */
export function givingUrl(): string {
  const url = process.env.EXPO_PUBLIC_TITHELY_GIVING_URL;
  if (url && !url.startsWith('REPLACE_ME')) return url;
  return `${GIVE_ORIGIN}/?formId=${GIVING_FORM_ID}`;
}

/**
 * Tithe.ly's giving app, which the foot of this screen points at.
 *
 * **Getting the identifiers right matters.** Tithe.ly ships two products under
 * similar names: `id694740700` / `ly.tithe.tithely` is the giving app, which is
 * what the church's form belongs to, and `id565301194` / `com.churchlinkapp` is
 * "Church App — Tithe.ly", a separate paid product with sermons and groups that
 * this church does not have. Linking the second would send somebody to
 * something they cannot use and cannot tell is wrong.
 *
 * The icon is Tithe.ly's own, from their store listing, fetched from the
 * website's asset pipeline at the size it is drawn. It is a **third-party
 * trademark**, shown to identify their app and for nothing else — not cropped,
 * not recoloured, not redrawn. The rounded corner is a `borderRadius` on the
 * view, which is how every store draws these and leaves the file alone.
 */
export const TITHELY_APP = {
  name: 'Tithe.ly',
  by: 'Tithe.ly',
  /* The website's card says "…the same offering as the form on the Giving
     page", which is odd to read one band below that form. Same swap it makes
     on its own giving page. */
  what: 'Gives to the church from a phone, once or on a schedule — the same offering as the form above.',
  icon: '/img/app-tithely-192.webp',
  ios: 'https://apps.apple.com/us/app/tithe-ly/id694740700',
  android: 'https://play.google.com/store/apps/details?id=ly.tithe.tithely',
} as const;
