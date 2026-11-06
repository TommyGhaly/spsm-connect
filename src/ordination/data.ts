/**
 * The open ordinations, for the nomination form and the hub's card.
 *
 * The app's copy of the website's `watchOpenOrdinations`
 * (features/ordination/data.ts). `ordinations` is world-readable, so nobody
 * signs in for this; every other ordination read is behind the `ordination`
 * screen and lives on the website's admin pages, not here.
 */
import { useEffect, useState } from 'react';
import {
  collection,
  getFirestore,
  onSnapshot,
  query,
  where,
} from '@react-native-firebase/firestore';
import {
  COLLECTIONS,
  PARISH_TIME_ZONE,
  ordinationAccepting,
  parseOrdination,
  todayIn,
  type Ordination,
} from '@spsm/shared';

export type WithId<T> = T & { id: string };

/**
 * Open, and not past their last day to apply, soonest first. The day is
 * checked on each snapshot; the Function refuses a late nomination either way.
 */
export function watchOpenOrdinations(
  onChange: (rows: WithId<Ordination>[]) => void,
  onError: (error: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(getFirestore(), COLLECTIONS.ordinations), where('open', '==', true)),
    (snapshot) =>
      onChange(
        snapshot.docs
          .map((entry) => ({ id: entry.id, ...parseOrdination(entry.data()) }))
          .filter((row) => ordinationAccepting(row, todayIn(PARISH_TIME_ZONE)))
          .sort((a, b) => a.date.localeCompare(b.date)),
      ),
    (cause) => onError(cause),
  );
}

/**
 * Whether any ordination is taking nominations, for the forms hub's card.
 *
 * Opens `false` and stays false on a failed read — the opposite of
 * `useCampSignUpOpen`, and the website's reason: this form is wanted a few
 * times a year, and a card that appears to say nothing is open is noise.
 */
export function useOrdinationsOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(
    () =>
      watchOpenOrdinations(
        (rows) => setOpen(rows.length > 0),
        (error) => {
          console.warn('[ordination] could not read the open ordinations', error);
          setOpen(false);
        },
      ),
    [],
  );
  return open;
}
