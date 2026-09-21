/**
 * Reading one of the church's own event pages.
 *
 * ## What an "event" is here, and what it is not
 *
 * Three things in this app are called events and only one of them is this one.
 * `scheduleEntries` are lines on the calendar the church typed; `programEvents`
 * are the levels of a ministry's gallery — Week 1, Day 3 — and are read by
 * `gallery/data.ts`. This is the `events` collection: the handful of authored
 * pages the Wix site used to keep as bespoke pages, one per festival, class or
 * camp, with a photograph and a description. `AREA_EVENTS` at /access is the
 * grant over it, and `schema/events.ts` in `@spsm/shared` is the shape.
 *
 * ## The reads are by slug, because the slug is the address
 *
 * Nothing in the app holds an event's document id. What it holds is `href` —
 * `/events/christmas-festival` — written by `occurrenceOfEvent` when the
 * calendar turned the document into a dot, and the same path a universal link
 * from the website carries. So the query is `where('slug','==',…)`, the same
 * one `slugTaken` uses over there, and the document id comes back with it for
 * the editor to write to.
 *
 * ## Everything in this collection is public, and the query must not pretend
 * otherwise
 *
 * There is no `published` field: it was removed when the website's editor lost
 * its publish step, and `firestore.rules` now reads `allow read: if true` here.
 * Adding a filter to match the gallery's `where('published','==',true)` would
 * deny the whole read rather than narrow it. The same warning is on
 * `getFeatureOccurrences` in `calendar/data.ts`, which reads this collection
 * for the calendar's dots.
 *
 * ## Field by field rather than a cast
 *
 * `gallery/data.ts` gives the reason and it is the same one here: this is a
 * binary on somebody's phone, and it cannot be redeployed on the afternoon a
 * document turns out to hold a number where a string was expected. A missing
 * field is the empty value for its type; a malformed one is treated as missing.
 * The single exception is `startAt` — an event with no readable start is not an
 * event, and `getEventBySlug` answers null for it rather than rendering a page
 * dated 1 January 1970.
 */
import {
  collection,
  doc,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  query,
  where,
} from '@react-native-firebase/firestore';
import {
  COLLECTIONS,
  EVENT_AUDIENCES,
  EVENT_CATEGORIES,
  PARISH_TIME_ZONE,
  toDate,
  type DocOf,
  type Event,
} from '@spsm/shared';

/**
 * One event page, with its id.
 *
 * `DocOf<Event>` and not a flattened shape of this file's own invention, which
 * is what it was for an afternoon. The form model in `@spsm/shared` reads an
 * `Event` — the same one the website hands it — so a row with `locationName`
 * and `registrationUrl` on it would have needed a translation layer here whose
 * only purpose was to undo a decision made two files away.
 *
 * The timestamps come back as `Date`s rather than Firestore `Timestamp`s, which
 * is legal: `Timestamped` is a union with `Date` in it, and `toDate` accepts
 * either. Everything downstream — `eventToForm`, `formatEventWhen` — goes
 * through `toDate` and cannot tell.
 */
export type EventDoc = DocOf<Event>;

/**
 * The event at this address, or null if there is not one.
 *
 * Null covers three different things on purpose — no such slug, a document too
 * malformed to date, and a failed read — because the screen says the same
 * sentence for all three and a caller that could tell them apart would have
 * nothing different to do. The failure is logged rather than thrown for the
 * reason `gallery/data.ts` gives: a throw here unmounts the screen somebody is
 * looking at.
 *
 * `limit(1)` because a slug is unique by construction — the website's editor
 * checks it before creating, and two events sharing one would already have
 * collapsed into a single page on the website.
 */
export async function getEventBySlug(slug: string): Promise<EventDoc | null> {
  if (!slug) return null;

  try {
    const found = await getDocs(
      query(collection(getFirestore(), COLLECTIONS.events), where('slug', '==', slug), limit(1)),
    );

    const document = found.docs[0];
    if (!document) return null;

    return parseEvent(document.id, document.data() as Record<string, unknown>);
  } catch (error) {
    console.warn(`[events] could not read the event "${slug}":`, error);
    return null;
  }
}

/**
 * One event page, live, by document id.
 *
 * **This is what keeps the photograph current.** The hero is the one thing on
 * the page somebody is most likely to change from somewhere else — the website,
 * or another phone — and a one-shot read means the person looking at the event
 * keeps the old picture until they leave the screen and come back. A document
 * this size, watched only while its own page is open, is the cheap end of the
 * trade that `gallery/data.ts` refuses at the other end: that one watches a
 * whole tree plus a window of media for every visitor, this watches one
 * document for as long as somebody is reading it.
 *
 * By id and not by slug, because the caller already holds the document — the
 * route resolved the slug once — and because an editor may rename the event
 * under itself. A slug query would stop matching at that moment and the screen
 * would go blank on the person doing the renaming.
 *
 * Null means the document is gone: deleted in a browser while this was open.
 * The caller decides what to say about that; nothing here assumes a screen.
 */
export function watchEvent(id: string, onEvent: (event: EventDoc | null) => void): () => void {
  return onSnapshot(
    doc(getFirestore(), COLLECTIONS.events, id),
    (snapshot) => {
      onEvent(
        snapshot.exists()
          ? parseEvent(snapshot.id, (snapshot.data() ?? {}) as Record<string, unknown>)
          : null,
      );
    },
    // Losing a live read is not worth a banner over a page that is already
    // rendering: what the reader has is what they had a moment ago, which is
    // the same thing a one-shot read would have left them with.
    (error) => console.warn(`[events] lost the live read of "${id}":`, error),
  );
}

/** Exported for the test, and for anything that already holds the raw data. */
export function parseEvent(id: string, raw: Record<string, unknown>): EventDoc | null {
  const startAt = toDate(raw['startAt'] as never);
  if (!startAt) return null;

  const location =
    typeof raw['location'] === 'object' && raw['location'] !== null
      ? (raw['location'] as Record<string, unknown>)
      : null;

  const registration =
    typeof raw['registration'] === 'object' && raw['registration'] !== null
      ? (raw['registration'] as Record<string, unknown>)
      : null;

  return {
    id,
    slug: text(raw['slug']) || id,
    title: text(raw['title']),
    summary: text(raw['summary']),
    body: text(raw['body']),

    startAt,
    endAt: toDate(raw['endAt'] as never),
    allDay: raw['allDay'] === true,
    timeZone: text(raw['timeZone']) || PARISH_TIME_ZONE,

    location: location
      ? {
          name: text(location['name']),
          address: text(location['address']) || null,
          meetingUrl: text(location['meetingUrl']) || null,
        }
      : null,
    heroImagePath: text(raw['heroImagePath']) || null,

    category: oneOf(raw['category'], EVENT_CATEGORIES, 'other'),
    audience: oneOf(raw['audience'], EVENT_AUDIENCES, 'parish'),
    tags: Array.isArray(raw['tags']) ? raw['tags'].map(text).filter(Boolean) : [],

    /*
     * Rebuilt field by field rather than passed through, so a document holding
     * something unexpected under `registration` cannot reach a screen.
     *
     * Only `externalUrl` is ever rendered, on either surface. `formId` points
     * at the `forms` collection, and the website has no `/forms/[slug]` route,
     * so a "Register" link built from it would send a parishioner to a 404.
     * This app *does* have that screen, which makes honouring it a real and
     * reasonable change — but one to make on both surfaces at once, with the
     * link resolved the same way in each, rather than a difference this reader
     * introduces on its own. The rest is carried because this is a whole
     * `Event`, and a partial one would have to be typed as such everywhere it
     * went.
     */
    registration: registration
      ? {
          formId: text(registration['formId']) || null,
          externalUrl: text(registration['externalUrl']) || null,
          opensAt: toDate(registration['opensAt'] as never),
          closesAt: toDate(registration['closesAt'] as never),
          capacity: typeof registration['capacity'] === 'number' ? registration['capacity'] : null,
        }
      : null,

    // Out of scope for the whole schema; the field exists and is always null.
    recurrence: null,

    /*
     * The audit trail, carried rather than dropped so this is a complete
     * `Event`. Nothing draws it. `createdAt` falling back to the start is the
     * same fallback the website's `plainEvent` makes, and for its reason: an
     * unreadable audit field is not worth refusing to render a page over.
     */
    createdAt: toDate(raw['createdAt'] as never) ?? startAt,
    updatedAt: toDate(raw['updatedAt'] as never) ?? startAt,
    updatedBy: text(raw['updatedBy']) || null,
  };
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/**
 * A value from a closed list, or the fallback.
 *
 * An unknown category is not an error to report — it is a document written by a
 * newer version of the website than this build knows about, which is the
 * ordinary state of an app somebody has not updated. "Something else" is the
 * honest reading of a word this binary has never heard of.
 */
function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}
