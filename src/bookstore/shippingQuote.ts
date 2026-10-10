/**
 * Live USPS postage for the basket, once there is a ZIP code to price it to.
 *
 * ---------------------------------------------------------------------------
 * The website's `useShippingQuote`, and its rule is the one that matters: what
 * the basket shows is what checkout charges.
 *
 * Every option comes back with a signed id, and `squareCheckout` charges the
 * cents inside that signature — never a number this app computed. An empty
 * `options` means the server could not quote (an unweighed book, live rates
 * switched off, USPS slow or down), and the basket then shows `fallbackCents`
 * and sends no id, which is the flat charge on both sides. A failed request is
 * the same answer: the flat charge as `config/bookstore` holds it, which is the
 * figure the Function falls back to too.
 *
 * Asked again whenever the ZIP or the basket changes, after a short pause so a
 * ZIP typed digit by digit is one request rather than five.
 *
 * ## Through `apiPost`, like the checkout
 *
 * The same Hosting origin, the same headers and the same App Check token as
 * `/api/square/checkout` — see `src/payments/square.ts` — so if the quote can
 * be fetched, the checkout can be reached by the same road. The endpoint itself
 * neither needs nor checks the ID token; it is rate-limited by address.
 *
 * `apiPost` takes no abort signal, so a superseded request is not cancelled —
 * it is *ignored*: each request carries a sequence number, and only the newest
 * one may write state. The website aborts instead; dropping the answer is the
 * same guarantee, which is that a quote for a ZIP or basket that has since
 * changed is never shown.
 * ---------------------------------------------------------------------------
 */
import { useEffect, useRef, useState } from 'react';
import { usableZip, type ShippingOption, type ShippingQuoteResponse } from '@spsm/shared';

import { apiPost } from '@/api/client';

export type QuoteState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; options: ShippingOption[]; fallbackCents: number }
  | { status: 'error' };

const PAUSE_MS = 400;

/**
 * `{ status, ... , refresh }`. `refresh` asks again for the same basket and ZIP
 * — what the basket calls when checkout refuses a quote as expired, so the new
 * figure is on screen before anybody presses Pay again.
 */
export function useShippingQuote({
  enabled,
  cart,
  postalCode,
}: {
  enabled: boolean;
  cart: readonly { slug: string; quantity: number }[];
  postalCode: string;
}): QuoteState & { refresh: () => void } {
  /*
   * The answer, held beside the question it answers.
   *
   * `key` is what makes "loading" derivable rather than set: the obvious shape
   * — `setState({ status: 'loading' })` at the top of the effect — is a
   * synchronous `setState` inside an effect, which the compiler rules in this
   * repo object to. So the effect only ever writes an *answer*, stamped with
   * the question, and an answer to a different question reads as loading.
   * `src/bookstore/admin/Metrics.tsx` has the same shape for the same reason.
   */
  const [answer, setAnswer] = useState<{ key: string; state: QuoteState } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const sequence = useRef(0);

  const zip = usableZip(postalCode);
  // The basket as a string, so a new array with the same lines is not a change.
  const basket = JSON.stringify(cart.map((line) => [line.slug, line.quantity]));
  const key = `${zip ?? ''}|${basket}|${attempt}`;

  useEffect(() => {
    if (!enabled || !zip) return;

    const mine = ++sequence.current;
    const timer = setTimeout(() => {
      void (async () => {
        let state: QuoteState;
        try {
          const body = await apiPost<ShippingQuoteResponse>('/api/shipping/quote', {
            cart: (JSON.parse(basket) as [string, number][]).map(([slug, quantity]) => ({
              slug,
              quantity,
            })),
            postalCode: zip,
          });
          if (typeof body.fallbackCents !== 'number') throw new Error('No flat charge in the quote.');
          state = {
            status: 'ready',
            options: Array.isArray(body.options) ? body.options : [],
            fallbackCents: body.fallbackCents,
          };
        } catch {
          state = { status: 'error' };
        }
        // Superseded while in flight: a newer ZIP or basket owns the screen.
        if (mine === sequence.current) setAnswer({ key, state });
      })();
    }, PAUSE_MS);

    return () => clearTimeout(timer);
  }, [enabled, zip, basket, key]);

  const state: QuoteState =
    !enabled || !zip ? { status: 'idle' } : answer?.key === key ? answer.state : { status: 'loading' };

  return { ...state, refresh: () => setAttempt((n) => n + 1) };
}
