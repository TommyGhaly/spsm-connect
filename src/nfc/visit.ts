/**
 * The app's half of the NFC tag statistics: a tap that opened the app, and the
 * steps that follow it.
 *
 * ---------------------------------------------------------------------------
 * The model is `packages/shared/src/analytics/nfc.ts` in the Website repo.
 * What this file adds is the app's idea of a visit.
 *
 * A tag opens `app/c/[slug].tsx`, which calls `startNfcVisit` and redirects.
 * From then on, for `NFC_VISIT_WINDOW_MINUTES` after the last thing the person
 * did, every step this app reports — a basket, a checkout, a form, a gift, a
 * photograph — is credited to that tap, and checkout and form submission carry
 * the visit to the server so the money is too. Somebody who opened the app
 * themselves, with no tag, has no visit, and every call here does nothing.
 *
 * Held in memory and nowhere else. A visit that outlived the process would be
 * a device id by another name, and the privacy notice says the app keeps none.
 *
 * Fire-and-forget everywhere: a statistic that failed to send must never be
 * something a person notices.
 * ---------------------------------------------------------------------------
 */
import { Platform } from 'react-native';
import { getRandomBytes } from 'expo-crypto';
import {
  NFC_VISIT_LENGTH,
  NFC_VISIT_WINDOW_MINUTES,
  isNfcSlug,
  nfcVisitFrom,
  type NfcAttribution,
  type NfcClientAction,
} from '@spsm/shared';

import { apiUrl } from '@/api/client';

const WINDOW_MS = NFC_VISIT_WINDOW_MINUTES * 60_000;

let current: { attribution: NfcAttribution; lastActive: number } | null = null;

/**
 * How long to wait before the one second attempt. Long enough for a phone
 * walking out of a basement to find a signal, short enough that the app is
 * almost certainly still open.
 */
const RETRY_MS = 5_000;

/**
 * Send one event, and once more if the first did not arrive.
 *
 * Only a network failure or a server error earns the retry. A 4xx is the
 * server refusing the event — malformed, or rate-limited — and sending it again
 * would be refused again. A retry cannot double-count: the server keeps the
 * first `(visit, action)` and drops repeats, so a first attempt that landed
 * but whose answer was lost costs nothing.
 */
function post(attribution: NfcAttribution, action: NfcClientAction): void {
  const body = JSON.stringify({ ...attribution, action });
  const send = () =>
    fetch(apiUrl('/api/nfc/event'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    }).then(
      (response) => response.status < 500,
      () => false,
    );
  void send().then((arrived) => {
    if (arrived) return;
    setTimeout(() => {
      void send();
    }, RETRY_MS);
  });
}

/**
 * A tag just opened the app. Mints the visit and reports the scan.
 *
 * Returns nothing and takes a plain string, so the route can hand it whatever
 * came in the URL: a slug this build does not know is not a tap worth counting.
 */
export function startNfcVisit(slug: string): void {
  if (!isNfcSlug(slug)) return;
  const attribution: NfcAttribution = {
    visit: nfcVisitFrom(getRandomBytes(NFC_VISIT_LENGTH / 2)),
    slug,
    path: 'app',
    platform: Platform.OS === 'android' ? 'android' : 'ios',
  };
  current = { attribution, lastActive: Date.now() };
  post(attribution, 'scan');
}

/**
 * The visit still in force, or null. Each call that finds one keeps it alive,
 * so the window runs from the last thing the person did rather than from the
 * tap.
 */
export function nfcAttribution(): NfcAttribution | null {
  if (!current) return null;
  if (Date.now() - current.lastActive > WINDOW_MS) {
    current = null;
    return null;
  }
  current.lastActive = Date.now();
  return current.attribution;
}

/** Report one step of the visit in force. Does nothing without one. */
export function reportNfc(action: Exclude<NfcClientAction, 'scan'>): void {
  const attribution = nfcAttribution();
  if (attribution) post(attribution, action);
}
