/**
 * The destination the camera is currently pointed at.
 *
 * Holds the two answers described in `destination.ts` and the rule between
 * them: **the church's answer is live, the sender's answer wins, and the
 * sender's answer does not outlive the visit.**
 *
 * A gallery page may give the sender's answer on their behalf — see `handoff.ts`
 * and the focus effect below. It is the same override the sheet writes, arrived
 * at by a different press, and it is forgotten on the same terms.
 *
 * ## Why the override is forgotten on the way out
 *
 * It is the difference between a preference and a correction. Somebody who
 * picks "Vespers" because the photograph in their hand is of Vespers has said
 * something about *that photograph*, not about themselves — and the cost of
 * guessing wrong is silent. A remembered override means opening the camera
 * three weeks later, seeing a pill nobody reads because it has said the same
 * thing every day, and filing the Nativity liturgy under last month's camp.
 * Nothing on screen would be wrong. Everything about it would be.
 *
 * So the override lives exactly as long as the screen is focused. Leaving the
 * tab clears it, and the next visit opens on whatever the church is collecting
 * for now. A servant shooting one ministry all week pays two taps a day for
 * that, which is the right side of the trade.
 *
 * ## The live half, once the override exists
 *
 * The listener stays attached and `fallback` keeps moving underneath — it is
 * just no longer what `destination` returns. That is what makes `revert()`
 * cheap and always correct, and it means the sheet can show the church's
 * current answer as the thing you are departing from rather than as a stale
 * copy taken when the screen opened.
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { watchDefaultDestination, type Destination } from './destination';
import { takeRequestedDestination } from './handoff';

export interface DestinationState {
  /** Where a photograph taken right now would go. Null when nowhere. */
  destination: Destination | null;
  /** The church's own current answer, whether or not it is being used. */
  fallback: Destination | null;
  /** False only until the first snapshot lands. Distinguishes "none" from "not yet". */
  ready: boolean;
  /** True when the sender has overridden the church's answer. */
  overridden: boolean;
  choose: (destination: Destination) => void;
  /** Give the church's answer back. */
  revert: () => void;
}

export function useDestination(): DestinationState {
  const [fallback, setFallback] = useState<Destination | null>(null);
  const [ready, setReady] = useState(false);
  const [chosen, setChosen] = useState<Destination | null>(null);

  useEffect(() => {
    const stop = watchDefaultDestination((next) => {
      setFallback(next);
      setReady(true);
    });
    return stop;
  }, []);

  /*
   * The clear happens on *blur*, not on focus.
   *
   * Clearing on focus would be the same thing most of the time and wrong in the
   * one case that matters: the sender picks a destination, is interrupted by
   * the system camera permission sheet or a phone call, and comes back. That is
   * a re-focus without a departure, and it must not quietly move their
   * photographs. A blur is somebody leaving the screen on purpose.
   */
  useFocusEffect(
    useCallback(() => {
      /*
       * A gallery page can arrive holding an answer — "add photographs" on
       * Day 3 opens this screen already pointed at Day 3 — and that is the
       * sender's own answer rather than a second kind of default: they said it
       * by standing on that page and pressing the button there.
       *
       * Taken on focus, which is the same moment the clear below happens on
       * blur, so it obeys the rule above without an exception to it: the
       * override still does not outlive the visit. A re-focus with no request
       * waiting — back from the permission sheet, back from a phone call —
       * takes nothing and changes nothing, because `takeRequestedDestination`
       * answers null for everything except a request made seconds ago.
       */
      const requested = takeRequestedDestination();
      if (requested) setChosen(requested);

      return () => setChosen(null);
    }, []),
  );

  return {
    destination: chosen ?? fallback,
    fallback,
    ready,
    overridden: chosen !== null,
    choose: setChosen,
    revert: useCallback(() => setChosen(null), []),
  };
}
