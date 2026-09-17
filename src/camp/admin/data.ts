/**
 * The camp's back office, from a phone: three listeners, one tick, one switch.
 *
 * ---------------------------------------------------------------------------
 * A deliberate subset of the website's `features/camp/data.ts`,
 * `allocationData.ts` and `attendanceData.ts`. What is here is what the three
 * screens in this app do, and what is *not* here is the point of the file:
 *
 *   - **No registration write.** Families are registered at a desk, on a
 *     laptop, by somebody reading a form — children's medical notes, a fee and
 *     a payment ledger. None of that is work for a phone, and a half-typed
 *     registration is worse than none.
 *   - **No allocation write.** The groups board is a drag-and-drop arrangement
 *     of two hundred children across nine panels. It is read here and arranged
 *     on the website; see `GroupsBoard`.
 *   - **No settings write except `servantSignUp`.** The season, the week dates,
 *     the fee, the waiver and the roles all stay on the website. The one switch
 *     that is here is the one somebody needs to reach while they are standing
 *     in the hall being asked whether the list is still open.
 *
 * Every function below is refused outright by `firestore.rules` without the
 * `camp` screen grant, so this module is only ever reached from behind
 * `useCampAdmin`.
 * ---------------------------------------------------------------------------
 */
import {
  collection,
  doc,
  getFirestore,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from '@react-native-firebase/firestore';
import {
  COLLECTIONS,
  CONFIG_DOC_CAMP,
  attendanceDocId,
  allocationDocId,
  blankAllocation,
  parseCampAllocation,
  parseCampAttendanceDay,
  parseCampRegistration,
  sortRegistrations,
  type CampAllocationDraft,
  type CampAttendanceEntry,
  type CampDayKey,
  type CampPersonKey,
  type CampRegistration,
} from '@spsm/shared';

export type WithId<T> = T & { id: string };

/* -------------------------------------------------------------------------- */
/* The season's people                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Every registration for one season, kept live.
 *
 * ---------------------------------------------------------------------------
 * The website's query, letter for letter, and the two parts of it that are not
 * obvious are worth writing down.
 *
 * **The two equality filters scope the read; they are no longer what makes it
 * allowed.** `firestore.rules` guards `campRegistrations` on the `camp` screen
 * flag alone — it reads nothing off the document, which is exactly why the
 * rule has no `resource == null` branch — so an unconstrained list would be
 * granted. It would also hand back every season the church has ever run, which
 * is a register paying for nine years of children to tick today's. Under the
 * *old* program grant these filters were load-bearing for a second reason —
 * Firestore judges a query by what it could return, and a rule proven against
 * `resource.data.programId` refuses an unconstrained list outright rather than
 * filtering it. That is no longer the rule, but it is one flag away from being
 * the rule again, so the filters stay and this is why.
 *
 * **No `orderBy`.** Two equality filters need no composite index — Firestore
 * merges the single-field ones — but adding a sort would, and a missing index
 * is not a failed build somebody sees, it is a register that spins forever at
 * nine in the morning. `sortRegistrations` does it in memory, where it can also
 * sort on a name assembled from two fields.
 *
 * `serverTimestamps: 'estimate'` because a registration saved on this device
 * echoes back before the server has resolved its `updatedAt`, and the default
 * read of that pending sentinel is null.
 * ---------------------------------------------------------------------------
 */
export function subscribeRegistrations(
  programId: string,
  season: string,
  onChange: (rows: WithId<CampRegistration>[]) => void,
  onError: (error: Error) => void,
): () => void {
  return onSnapshot(
    query(
      collection(getFirestore(), COLLECTIONS.campRegistrations),
      where('programId', '==', programId),
      where('season', '==', season),
    ),
    (snapshot) => {
      onChange(
        sortRegistrations(
          snapshot.docs.map((entry) => ({
            id: entry.id,
            ...parseCampRegistration(entry.data({ serverTimestamps: 'estimate' })),
          })),
        ),
      );
    },
    (cause) => onError(cause as Error),
  );
}

/* -------------------------------------------------------------------------- */
/* The arrangement                                                            */
/* -------------------------------------------------------------------------- */

/**
 * The season's allocation, kept live and read only.
 *
 * A listener rather than a read, for the reason the website gives: the board is
 * arranged on a laptop the week before camp, sometimes by two people at one
 * table, and a phone holding a picture of it from when the screen opened is
 * wrong on the two days of the year it matters. A child moved between groups on
 * the laptop has to change the heading they are listed under here, without
 * anybody being told to pull down to refresh.
 *
 * A season nobody has arranged yet is an empty board, not an error — which is
 * what makes "no groups yet" a state the screens can draw rather than a failure
 * they have to report.
 */
export function subscribeAllocation(
  programId: string,
  season: string,
  onChange: (draft: CampAllocationDraft) => void,
  onError: (error: Error) => void,
): () => void {
  return onSnapshot(
    doc(getFirestore(), COLLECTIONS.campAllocations, allocationDocId(programId, season)),
    (snapshot) => {
      const data = snapshot.data({ serverTimestamps: 'estimate' });
      onChange(data ? parseCampAllocation(data) : blankAllocation(programId, season));
    },
    (cause) => onError(cause as Error),
  );
}

/* -------------------------------------------------------------------------- */
/* The register                                                               */
/* -------------------------------------------------------------------------- */

/** What a subscriber is handed. A day nobody has opened has no document. */
export interface AttendanceSnapshot {
  entries: Record<CampPersonKey, CampAttendanceEntry>;
  /** False until somebody ticks the first child of the day. */
  exists: boolean;
}

/**
 * Listen to one day's register.
 *
 * ---------------------------------------------------------------------------
 * A live listener, and it is the whole reason the register works at a gate.
 *
 * Two servants take the morning: one at the door with this app, one in the hall
 * with a tablet or the website. A one-shot read would give each of them the
 * register as it was when they arrived, and the hall would spend twenty minutes
 * calling names that were ticked at the door. `onSnapshot` lands the second
 * tick on both screens in about a second, and the afternoon's "who is still
 * here" is one list rather than two that have to be reconciled.
 *
 * `serverTimestamps: 'estimate'` is not a nicety. Every `at` is written as
 * `serverTimestamp()`, which is a sentinel until the server acknowledges it;
 * the default read of a pending write hands back null, so a child would be
 * ticked in and show no time for as long as the round trip takes — which on a
 * phone at the edge of the church's wifi is not always quick. The estimate is
 * the device's clock standing in for a value that is on its way, and the moment
 * it lands the listener fires again with the real one.
 * ---------------------------------------------------------------------------
 */
export function subscribeAttendance(
  programId: string,
  season: string,
  day: CampDayKey,
  onChange: (snapshot: AttendanceSnapshot) => void,
  onError: (error: Error) => void,
): () => void {
  return onSnapshot(
    doc(getFirestore(), COLLECTIONS.campAttendance, attendanceDocId(programId, season, day)),
    (snapshot) => {
      const data = snapshot.data({ serverTimestamps: 'estimate' });
      onChange({
        entries: data ? parseCampAttendanceDay(data).entries : {},
        exists: data !== undefined,
      });
    },
    (cause) => onError(cause as Error),
  );
}

/**
 * Tick one child in, or out, or take a tick back.
 *
 * ---------------------------------------------------------------------------
 * A merging `setDoc` of one nested field path, and it must never become a
 * read-modify-write. A register is written by several people in the same five
 * minutes: the phone that read the day at 8:59 and replaced it at 9:04 would
 * put back a register missing every tick the door made in between — silently,
 * with no conflict to report. Merging one field per tap makes that impossible;
 * Firestore merges them server-side and neither device needs to know the other
 * exists.
 *
 * The key is a `registrationId/childId` string, which is a legal Firestore
 * *field name* even with the slash in it. It is passed as an object key and
 * never as a dotted path, because the SDK builds the merge mask out of the
 * object's own structure — an `updateDoc` with a template-literal path would
 * try to parse the slash and is the one way to get this wrong.
 *
 * Undo writes `null` rather than deleting: `parseCampAttendanceDay` drops an
 * entry whose marks are both null, so an undone tick leaves no trace in the
 * register while `updatedBy` still records that somebody touched the day.
 * ---------------------------------------------------------------------------
 */
export async function markAttendance(params: {
  programId: string;
  season: string;
  day: CampDayKey;
  key: CampPersonKey;
  which: 'arrived' | 'collected';
  /** False takes the tick back. */
  on: boolean;
  uid: string | null;
  /**
   * Whether the day's document is known to exist, from the live snapshot.
   * Wrong in either direction costs nothing: `createdAt` is either set on a
   * document that has one already, or the day's first tick writes without one.
   */
  exists: boolean;
}): Promise<void> {
  const { programId, season, day, key, which, on, uid, exists } = params;

  await setDoc(
    doc(getFirestore(), COLLECTIONS.campAttendance, attendanceDocId(programId, season, day)),
    {
      // Sent on every tick and not only the first. They are what the rules read
      // to decide the write, and a merge that omitted them on the day's first
      // tap would be refused rather than defaulted.
      programId,
      season,
      day,
      entries: {
        [key]: {
          [which]: on ? { at: serverTimestamp(), by: uid } : null,
        },
      },
      ...(exists ? {} : { createdAt: serverTimestamp() }),
      updatedAt: serverTimestamp(),
      // The rule requires this to equal the caller's uid, so every tick — and
      // every untick — is attributable to whoever was holding the phone.
      updatedBy: uid,
    },
    { merge: true },
  );
}

/* -------------------------------------------------------------------------- */
/* The one setting this app writes                                            */
/* -------------------------------------------------------------------------- */

/**
 * Open or close the servants' sign-up form.
 *
 * ---------------------------------------------------------------------------
 * One boolean on `config/camp`, and the only write this app makes to the
 * camp's settings.
 *
 * `firestore.rules` guards the whole `config` collection with the superadmin,
 * and then carves out a second match on this one document allowing whoever has
 * the camp everything on it **except `programId`** — the ministry the camp's
 * registrations are filed under, which is refused because writing it would be a
 * way to re-point the camp at somebody else's gallery. So this is allowed, and
 * it is allowed without being a superadmin.
 *
 * `updateDoc`, not `setDoc`. It merges, so closing the sign-up cannot blank a
 * waiver somebody typed on the website a minute ago; and it fails loudly on a
 * camp whose settings document has never been created, which is the right
 * answer — a switch that quietly conjured a settings document with half a shape
 * would leave the camp with no season and no waiver, and the sign-up form reads
 * both.
 *
 * Everything else on this document stays on the website on purpose. A phone is
 * the right place to answer "is the list still open"; it is the wrong place to
 * retype a waiver.
 * ---------------------------------------------------------------------------
 */
export async function setServantSignUp(open: boolean, uid: string | null): Promise<void> {
  await updateDoc(doc(getFirestore(), COLLECTIONS.config, CONFIG_DOC_CAMP), {
    servantSignUp: open,
    updatedAt: serverTimestamp(),
    // The rule requires this to equal the caller's uid when it is sent at all.
    updatedBy: uid,
  });
}
