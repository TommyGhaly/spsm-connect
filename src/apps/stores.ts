/**
 * The apps the church asks anybody to install, and where each one lives.
 *
 * ---------------------------------------------------------------------------
 * The app's half of the website's `features/apps/stores.ts`. Literals, not
 * Firestore, for the reason that file gives: a store URL changes when an app is
 * re-published under a new identifier, which is roughly never, and a bad read
 * that emptied this screen would empty the one screen whose entire purpose is
 * four links.
 *
 * **Every URL here has been opened.** That is not a formality — see the note on
 * `TITHELY_APP` in `giving/config.ts` about the two Tithe.ly products — and a
 * store link that goes to the wrong listing sends somebody to something
 * they cannot use and cannot tell is wrong.
 *
 * ## Two apps, where the website lists three
 *
 * The website's list ends with a third card: SPSM Connect, with no links and no
 * date, because somebody who hears the name mentioned should be able to find
 * out what it is. **This is SPSM Connect.** A card here telling the reader about
 * the app they are holding — and telling them there is nothing to install — is
 * the one entry that could only confuse them, so the list is the website's two
 * installable apps and nothing else. If a fourth church app ever appears, it
 * goes in this file and on the website's, in both repositories.
 * ---------------------------------------------------------------------------
 */
import type { Href } from 'expo-router';

import { TITHELY_APP as TITHELY_GIVING_APP } from '@/giving/config';

export type ChurchApp = {
  /** The name as it appears on the store listing. */
  name: string;
  /** Who publishes it, when that is not the church itself. */
  by?: string;
  /** What it is for, in one or two sentences. */
  what: string;
  /**
   * The app's own icon, as a path under the website's `public/` — see
   * `about/media.ts` for why these are fetched rather than bundled. The 192
   * file, always: the card draws it at 64pt, which is 192 device pixels on the
   * 3x phones and 128 on the 2x ones, and the smaller file would draw soft on
   * half the phones in the church.
   *
   * These are **third-party trademarks** where the app is somebody else's,
   * shown to identify their app and for nothing else — not cropped, not
   * recoloured, not redrawn. The rounded corner is a `borderRadius` on the
   * view, which is how every store draws these and leaves the file alone.
   */
  icon: string;
  /** App Store URL. */
  ios: string;
  /** Google Play URL. */
  android: string;
  /** A screen in this app that says more, when there is one. */
  more?: { href: Href; label: string };
};

/**
 * The church's own app, and the App Store says so — the seller is
 * "ST. PHILOPATER MERCURIUS & ST. MINA COPTIC ORTHODOX CHURCH, INC."
 *
 * It is also the service this app's forms write into: a vehicle registration
 * submitted here becomes a pending record in Taksis and nowhere else.
 *
 * No `by`. Saying "by the church" on the church's own app is noise; the absence
 * is what the card reads as "ours", and the eyebrow above it says so in words.
 */
export const TAKSIS_APP: ChurchApp = {
  name: 'Taksis',
  what:
    'Our own app. Servants’ schedules and attendance are kept in it, and a parent manages their children’s accounts from it.',
  // The sixth-century icon of Christ and St. Menas, which is what the church
  // chose for its own app. Nothing here picked it.
  icon: '/img/app-taksis-192.webp',
  ios: 'https://apps.apple.com/us/app/taksis/id6743824691',
  android: 'https://play.google.com/store/apps/details?id=com.tghaly.taksis',
};

/**
 * Tithe.ly's giving app, which is `giving/config.ts`'s record with this
 * screen's sentence on it.
 *
 * **The identifiers are not copied.** One record, two screens: the band at the
 * foot of Giving and the card here are the same two store URLs and the same
 * icon, and a second copy of them is a second chance to paste the wrong product
 * id. The website hoists its copy for exactly this reason.
 *
 * What *is* different is the sentence. The stored one ends "the same offering
 * as the form above", which is true a screen below that form and false here;
 * this is the website's own wording for the same card, which refers to Giving
 * by name because the reader is not standing on it.
 */
export const TITHELY_APP: ChurchApp = {
  ...TITHELY_GIVING_APP,
  what:
    'Gives to the church from a phone, once or on a schedule — the same offering as the form on the Giving screen.',
  more: { href: '/giving', label: 'How the church receives an offering' },
};

export const CHURCH_APPS: readonly ChurchApp[] = [TAKSIS_APP, TITHELY_APP];
