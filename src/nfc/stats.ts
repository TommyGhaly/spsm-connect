/**
 * Reading the NFC tag statistics — the app's copy of the website's
 * `features/nfc/data.ts`, against the same two collections and through the
 * same shared arithmetic, so the two screens cannot disagree about a number.
 *
 * One query per collection over a range of document ids (`day-…` for up to
 * ninety days, `month-…` beyond), which needs no composite index. The money is
 * asked for only when the reader holds Finance as well: `firestore.rules`
 * refuses it otherwise, and that refusal is the reason it is a separate
 * collection at all. See `packages/shared/src/analytics/nfc.ts`.
 */
import {
  collection,
  documentId,
  getDocs,
  getFirestore,
  query,
  where,
} from '@react-native-firebase/firestore';
import {
  COLLECTIONS,
  PARISH_TIME_ZONE,
  dayKey,
  nfcPeriodDocIds,
  sumNfcRevenue,
  sumNfcStats,
  type NfcSlug,
  type NfcSlugCounts,
  type NfcSlugRevenue,
} from '@spsm/shared';

export const NFC_RANGES = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
  { days: 365, label: '12 months' },
] as const;

export interface NfcReading {
  bySlug: Record<NfcSlug, NfcSlugCounts>;
  /** Null when the reader does not hold Finance. */
  revenue: Record<NfcSlug, NfcSlugRevenue> | null;
}

async function readRange(name: string, ids: string[]): Promise<unknown[]> {
  const first = ids[0];
  const last = ids[ids.length - 1];
  if (!first || !last) return [];
  const snapshot = await getDocs(
    query(
      collection(getFirestore(), name),
      where(documentId(), '>=', first),
      where(documentId(), '<=', last),
    ),
  );
  return snapshot.docs.map((doc) => doc.data());
}

export async function readNfcPeriod(days: number, withRevenue: boolean): Promise<NfcReading> {
  const ids = nfcPeriodDocIds(dayKey(new Date(), PARISH_TIME_ZONE), days);
  const [stats, money] = await Promise.all([
    readRange(COLLECTIONS.nfcStats, ids),
    withRevenue ? readRange(COLLECTIONS.nfcRevenue, ids) : Promise.resolve(null),
  ]);
  return { bySlug: sumNfcStats(stats), revenue: money ? sumNfcRevenue(money) : null };
}
