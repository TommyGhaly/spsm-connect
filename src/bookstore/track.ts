/**
 * Recording what happens in the shop, without slowing it down.
 *
 * ---------------------------------------------------------------------------
 * The same pipeline as the website, by a shorter road.
 *
 * The constraints that shape `features/bookstore/track.ts` are mostly not
 * constraints here, and it is worth saying which ones survive:
 *
 *  - **No counters. Still true, and the important one.** The obvious shape for
 *    "most viewed" is a `views` field every visitor increments. Firestore
 *    sustains about one write per second to a single document, so the most
 *    popular book — the number anyone actually wants — is the first to start
 *    timing out. Every event here is its own document with its own id, which
 *    contends with nothing, and `rollupBookstore` does the arithmetic hourly.
 *
 *  - **No Firestore SDK on the tracking path. Gone, and good riddance.** The
 *    website posts these over the REST API with a bare `fetch` to avoid pulling
 *    the SDK onto a page people open. This app has `@react-native-firebase`
 *    open already for the catalog subscription three files away, so the REST
 *    path would buy nothing and cost the batching, the retries and the App
 *    Check header that come free with the SDK.
 *
 *    That last one closes the caveat the website's note ends on: its writes
 *    carry no App Check token, so switching Firestore enforcement on would
 *    silently stop its statistics. These carry one, because the SDK attaches it
 *    — see `src/firebase/appCheck.ts`. Enforcement is safe to turn on for the
 *    app whatever happens to the site.
 *
 *  - **Never in the way. Still true.** Nothing here is awaited by anything the
 *    person is doing and every failure is swallowed. A statistic that costs a
 *    buyer a dropped press is not worth collecting.
 *
 * ## Do Not Track has no equivalent here, and nothing is put in its place
 *
 * The website honours `navigator.doNotTrack` even though these events identify
 * nobody. A phone has no such signal — the platform privacy controls (ATT on
 * iOS, the advertising id on Android) govern cross-app tracking by an
 * identifier this code does not have and does not want. So there is nothing to
 * read and nothing to honour, and inventing a settings toggle for it would be
 * offering a choice about something the app is not doing.
 *
 * What is done instead is the thing that made DNT cheap to honour in the first
 * place: `visitor` is a random string this install generates for itself, is
 * derived from nothing about the person, goes nowhere but a collection no
 * client may read, and is thrown away when the app is deleted.
 * ---------------------------------------------------------------------------
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getRandomBytes } from 'expo-crypto';
import {
  addDoc,
  collection,
  getFirestore,
  serverTimestamp,
} from '@react-native-firebase/firestore';
import {
  COLLECTIONS,
  EVENT_TTL_DAYS,
  VISITOR_LENGTH,
  normalizeBookstoreEvent,
  type BookstoreEventKind,
} from '@spsm/shared';

const VISITOR_KEY = 'spsm.bookstore.visitor';

/**
 * The church's zone, so a Saturday evening sale is a Saturday sale.
 *
 * Hard-coded to match `track.ts` and `rollupBookstore` on the website, both of
 * which use this literal. The bucket key has to agree across all three or the
 * rollup files an app sale into a different day from the same sale made in a
 * browser — the phone's own zone is the one thing that must not decide this,
 * since somebody in another state is still shopping at this church.
 */
const CHURCH_TIME_ZONE = 'America/New_York';

/**
 * This install's id, read once and then held.
 *
 * A module-level cache rather than storage per event: `AsyncStorage` is a
 * bridge call and a shop scrolling past eight covers would otherwise make eight
 * of them to fetch the same sixteen characters.
 */
let visitor: string | null = null;
let reading: Promise<string> | null = null;

function visitorId(): Promise<string> {
  if (visitor !== null) return Promise.resolve(visitor);
  if (reading) return reading;

  reading = (async () => {
    const pattern = new RegExp(`^[0-9a-f]{${VISITOR_LENGTH}}$`);
    try {
      const stored = await AsyncStorage.getItem(VISITOR_KEY);
      if (stored && pattern.test(stored)) {
        visitor = stored;
        return stored;
      }
    } catch {
      /* Unreadable store. Fall through and make a fresh one. */
    }

    const bytes = getRandomBytes(VISITOR_LENGTH / 2);
    const id = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');

    try {
      await AsyncStorage.setItem(VISITOR_KEY, id);
    } catch {
      /* Not storable. The id still works for this run, which counts this
         session as a new person next launch — the correct failure. The
         alternative is fingerprinting the device so the number is prettier. */
    }
    visitor = id;
    return id;
  })();

  return reading;
}

/** Today in the church's zone, as `YYYY-MM-DD`. */
function today(): string {
  /*
   * `en-CA` because its short date format *is* ISO 8601, which saves
   * reassembling parts by hand. Hermes ships the ICU build of
   * `Intl.DateTimeFormat`, so this is the same call the browser makes — see the
   * note in `src/payments/money.ts`.
   */
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: CHURCH_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/**
 * Record one interaction. Never awaited, never throws.
 *
 * `normalizeBookstoreEvent` is the shared validator the website uses, and it is
 * applied here for the same reason: `firestore.rules` refuses a malformed
 * document, and a refusal inside a fire-and-forget write is invisible — the
 * statistic simply stops moving with nothing in any log to say why. Shaping the
 * document with the same function that the rule was written against is what
 * keeps the two in step.
 */
export function track(
  kind: BookstoreEventKind,
  subject: { slug?: string | null; term?: string | null; quantity?: number } = {},
): void {
  void (async () => {
    try {
      const event = normalizeBookstoreEvent({
        kind,
        slug: subject.slug ?? null,
        term: subject.term ?? null,
        quantity: subject.quantity ?? 1,
        visitor: await visitorId(),
        day: today(),
      });
      // Null means the event was malformed — a search with no term, a view with
      // no slug. Dropped silently: nothing about recording a statistic is worth
      // an error in a buyer's console, let alone a broken interaction.
      if (!event) return;

      await addDoc(collection(getFirestore(), COLLECTIONS.bookstoreEvents), {
        ...event,
        /*
         * The server's clock, not the phone's, and the rule insists on it:
         * `doc.at == request.time`. A device with a wrong clock — or one set
         * deliberately — must not be able to file an event into a period that
         * has already been rolled up and signed off.
         */
        at: serverTimestamp(),
        /*
         * When Firestore's TTL policy should delete this row. A plain `Date`,
         * which the SDK stores as a Timestamp; the rule asks only that it be
         * one, because the deletion is the database's job rather than a
         * client's promise.
         *
         * The raw events are working material. The rollups are the record, and
         * they are small enough to keep forever.
         */
        expiresAt: new Date(Date.now() + EVENT_TTL_DAYS * 24 * 60 * 60 * 1000),
      });
    } catch {
      /* Swallowed by design. See the header. */
    }
  })();
}

/** A product event: a view, a detail open, a basket change. */
export function trackProduct(kind: BookstoreEventKind, slug: string, quantity = 1): void {
  track(kind, { slug, quantity });
}

/** A search. `term` is normalised by the shared validator, not here. */
export function trackSearch(term: string, zero: boolean): void {
  track(zero ? 'searchZero' : 'search', { term });
}
