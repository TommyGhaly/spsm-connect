/**
 * `config/parish`, and the addresses built out of it.
 *
 * The app's half of the website's `lib/config.ts` and of the URL builders
 * inside its `ParishMap`. The document is the same one, world-readable for the
 * same reason the theme and the livestream settings are: somebody who wants the
 * church's phone number has not signed in and must not have to.
 *
 * Everything here is either a read of that document or a string built from it.
 * Nothing invents a fact — a church that has not filled a field in gets an empty
 * string, and every renderer treats that as "ask the office" rather than
 * guessing. See `DEFAULT_PARISH_CONFIG`, which is blank on purpose.
 */
import { useEffect, useState } from 'react';
import { doc, getFirestore, onSnapshot } from '@react-native-firebase/firestore';
import {
  COLLECTIONS,
  CONFIG_DOC_PARISH,
  parseParishConfig,
  type ParishConfig,
} from '@spsm/shared';

/**
 * What the church is called, in the places a stranger's map app has to match it.
 *
 * The website's constant, copied rather than imported because it lives inside
 * that repo's `ParishMap` component. If it changes there, change it here — it is
 * the string Google's own listing is matched against, and it was checked against
 * the live map when the embed moved off OpenStreetMap.
 */
export const CHURCH_NAME = 'St. Philopater Mercurius & St. Mina Coptic Orthodox Church';

/** Street level: close enough to read the road names, wide enough to show the turning. */
const ZOOM = 17;

export interface ChurchSettings {
  /**
   * False until the first snapshot.
   *
   * The screen waits on it rather than drawing from the parsed defaults, which
   * are blank: a phone that rendered those for one frame would flash "contact
   * details aren't published yet" at somebody whose church has published them.
   */
  ready: boolean;
  church: ParishConfig;
}

/**
 * The church's details, as a live subscription.
 *
 * A listener rather than a one-shot read, for the same reason `useLivestreamConfig`
 * is one: these are the facts most likely to be corrected in a hurry — a phone
 * number that changed, a service time moved for a feast — and the correction
 * should reach a screen that is already open.
 */
export function useChurchConfig(): ChurchSettings {
  const [settings, setSettings] = useState<ChurchSettings>(() => ({
    ready: false,
    church: parseParishConfig(undefined),
  }));

  useEffect(() => {
    return onSnapshot(
      doc(getFirestore(), COLLECTIONS.config, CONFIG_DOC_PARISH),
      (snapshot) => {
        setSettings({ ready: true, church: parseParishConfig(snapshot.data()) });
      },
      (error) => {
        /*
         * Ready, with the blanks — which is not a graceful failure so much as an
         * honest one. Unlike the livestream, whose defaults are the church's real
         * Castr player, there is nothing true to fall back to here: every default
         * in `DEFAULT_PARISH_CONFIG` is empty precisely so that a phone with no
         * signal says "we could not fetch this" rather than showing an address
         * somebody might drive to.
         */
        console.warn('[contact] could not read the church details', error);
        setSettings({ ready: true, church: parseParishConfig(undefined) });
      },
    );
  }, []);

  return settings;
}

/**
 * The address as an address — commas, one line, no decoration.
 *
 * Deliberately *not* `formatAddress`, which joins the parts with a middle dot
 * for display. "169 Rice Rd · Wayland, MA · 01778" is a fine thing to read and a
 * poor thing to hand a geocoder. The website's own note, and its own function.
 */
export function postalAddress(address: ParishConfig['address']): string {
  const street = [address.line1, address.line2].filter(Boolean).join(', ');
  const region = [address.city, address.state].filter(Boolean).join(', ');
  return [street, [region, address.postalCode].filter(Boolean).join(' ')].filter(Boolean).join(', ');
}

/**
 * Whether there is a map to show — the address, not the coordinates.
 *
 * `geo` is checked and correct and still not what this asks, for the same reason
 * the website gives: the embed below is built from the street address, because
 * that is what Google needs to find its own listing for the church. A church
 * with a coordinate and no address has nothing to put in the frame.
 */
export function hasChurchMap(church: ParishConfig): boolean {
  return postalAddress(church.address) !== '';
}

/**
 * The map, as something a `WebView` can load, or null.
 *
 * The website's embed URL verbatim — `maps.google.com/…&output=embed`, which
 * needs no key and costs nothing. Name *and* address in the query: the address
 * alone resolves to the building, which Google titles "169 Rice Rd", so the pin
 * would carry a street number instead of the church's name.
 */
export function mapEmbedUrl(church: ParishConfig): string | null {
  const address = postalAddress(church.address);
  if (address === '') return null;

  const query = `${CHURCH_NAME}, ${address}`;
  return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=${ZOOM}&hl=en&output=embed`;
}

/**
 * Apple Maps, and Google Maps, for somebody who wants to *go* there.
 *
 * The two links are not the same shape, and that is the website's decision
 * rather than an oversight. Google takes the search Google itself answers with
 * the church's listing. Apple gets `address`, which is documented to *place* an
 * address rather than search for one — a search on Apple's side that finds
 * nothing leaves the reader on a spinner — with `q` as the label on the pin.
 *
 * Neither carries `geo`, which is the coordinate somebody checked by hand and is
 * also what nobody can read: the destination field would say
 * "42.345742,-71.3331069".
 */
export function appleMapsUrl(church: ParishConfig): string {
  const address = postalAddress(church.address);
  return `https://maps.apple.com/?address=${encodeURIComponent(address)}&q=${encodeURIComponent(CHURCH_NAME)}`;
}

export function googleMapsUrl(church: ParishConfig): string {
  const query = `${CHURCH_NAME}, ${postalAddress(church.address)}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** A number the dialler will take. The punctuation has to go or some choke. */
export function dialUrl(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

export function mailUrl(email: string): string {
  return `mailto:${email}`;
}

/**
 * The embed, wrapped in the one thing Google requires of it: an iframe.
 *
 * ---------------------------------------------------------------------------
 * Loading the embed URL straight into a `WebView` does not work, and it fails
 * in the one way that would have shipped — not an error, a rendered page
 * reading "The Google Maps Embed API must be used in an iframe." A `WebView`
 * loads it as a *top-level document*, which is exactly what that check refuses.
 *
 * So the frame loads a one-line document of our own with the embed inside an
 * iframe, which is the same shape the website has: a page on the church's
 * origin framing Google's map. `baseUrl` is that origin rather than
 * `about:blank`, so the tile requests carry the referrer Google attributes the
 * load to — the point of the website's `referrerPolicy` on the same iframe.
 * ---------------------------------------------------------------------------
 */
export function mapDocument(embed: string): string {
  return [
    '<!doctype html>',
    '<html><head>',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<style>html,body{margin:0;padding:0;height:100%;overflow:hidden}',
    'iframe{border:0;display:block;width:100%;height:100%}</style>',
    '</head><body>',
    `<iframe src="${embed}" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe>`,
    '</body></html>',
  ].join('');
}
