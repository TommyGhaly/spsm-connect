/**
 * Reading the schedule, on a phone.
 *
 * This mirrors the website's `features/calendar/data.ts` reader for reader, and
 * deliberately so: the two surfaces answer "what is the parish doing this week"
 * from the same Function, the same two Firestore collections and the same
 * bulletin, and the merge that reconciles them lives in `@spsm/shared`. What
 * differs here is only the transport — `apiGet`/`apiGetAuthed` instead of
 * `fetch('/api/...')`, because a native app has no origin to be relative to.
 *
 * The one thing worth knowing before changing any of it: **three of the four
 * sources fail silently.** The bulletin, the staff layers and the site's own
 * events are enrichments of a schedule that renders without them, and an error
 * banner over a working calendar is a worse outcome than a missing annotation.
 * Only `/api/calendar` itself reports a failure, because without it there is no
 * schedule at all.
 */
import { collection, getDocs, getFirestore } from '@react-native-firebase/firestore';
import {
  COLLECTIONS,
  PARISH_TIME_ZONE,
  occurrenceOfEvent,
  occurrenceOfScheduleEntry,
  occurrencesOfBulletin,
  parseCalendarDetail,
  parseScheduleEntry,
  toDate,
  type BulletinLike,
  type CalendarDetail,
  type CalendarFeed,
  type CalendarOccurrence,
} from '@spsm/shared';

import { ApiError, apiGet, apiGetAuthed } from '@/api/client';

/**
 * What a caller gets back. A feed, or a reason there is not one.
 *
 * The same four arms the website uses, for the same reason: `denied` is
 * separated from `error` because a session that has expired, or an account that
 * is not on the rota, is an ordinary outcome with its own sentence — not a
 * fault, and not something to show an alarm about.
 */
export type ScheduleResult =
  | { kind: 'ok'; feed: CalendarFeed }
  /** Asked for the servants calendar without a session that carries it. */
  | { kind: 'denied'; message: string }
  /** The parish has not configured a calendar yet. */
  | { kind: 'unset' }
  | { kind: 'error'; message: string };

/**
 * Fetch one range.
 *
 * No `AbortSignal`. The website passes one because stepping through weeks fires
 * a request per click and they return out of order; this screen has the same
 * problem and solves it with the sequence guard in `CalendarScreen` alone. RN's
 * `fetch` does support `AbortController`, but an aborted request there rejects
 * with a plain `Error` whose name is not reliably `AbortError` across the
 * Hermes/Flipper combinations this app runs under, and a guard that silently
 * stops working is worse than no guard. The sequence number is checked at the
 * point the answer is used, which is the part that actually matters.
 */
export async function getSchedule(
  from: string,
  to: string,
  options: { servants: boolean },
): Promise<ScheduleResult> {
  const query = new URLSearchParams({ from, to });
  if (options.servants) query.set('scope', 'servants');
  const path = `/api/calendar?${query.toString()}`;

  try {
    const feed = options.servants
      ? await apiGetAuthed<CalendarFeed>(path)
      : await apiGet<CalendarFeed>(path);

    if (!Array.isArray(feed.occurrences)) {
      return { kind: 'error', message: 'The schedule came back in a shape this app cannot read.' };
    }
    return { kind: 'ok', feed };
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 401 || error.status === 403) {
        return { kind: 'denied', message: error.message };
      }
      // 503 is the parish not having configured a calendar, not a fault.
      if (error.status === 503) return { kind: 'unset' };
      return { kind: 'error', message: error.message };
    }
    return { kind: 'error', message: 'Could not reach the church calendar.' };
  }
}

/**
 * This week's bulletin, as calendar occurrences.
 *
 * Fetched once rather than per range, because it covers exactly one week —
 * stepping to October does not need re-asking, since the answer for October is
 * "the bulletin has nothing to say".
 *
 * The JSON is used as-is rather than through `reviveBulletin`, matching the
 * website: that helper turns ISO strings back into `Date`s, and the only fields
 * it touches — `addedAt`, `publishedAt` — are ones nothing here reads.
 */
export async function getBulletinOccurrences(): Promise<CalendarOccurrence[]> {
  try {
    const body = await apiGet<{ bulletin?: BulletinLike | null }>('/api/bulletin');
    if (!body.bulletin || !Array.isArray(body.bulletin.days)) return [];
    return occurrencesOfBulletin(body.bulletin);
  } catch (error) {
    console.warn('[calendar] the bulletin could not be read; carrying on without it:', error);
    return [];
  }
}

/**
 * Manually added entries, and the annotations laid over everything else.
 *
 * Both collections are `allow read: if true` — they are part of the public
 * schedule, so an anonymous reader has to be able to see them or a manually
 * added service would be visible only to staff. Neither carries a `published`
 * filter for that reason, and adding one would deny the whole query.
 *
 * Read whole rather than filtered to the visible range, as on the website: both
 * are small, and a range query would need an index and a re-read on every step
 * through the weeks to save a few kilobytes.
 */
export async function getStaffLayers(): Promise<{
  entries: CalendarOccurrence[];
  details: Map<string, CalendarDetail>;
}> {
  const empty = { entries: [], details: new Map<string, CalendarDetail>() };

  try {
    const db = getFirestore();
    const [entrySnap, detailSnap] = await Promise.all([
      getDocs(collection(db, COLLECTIONS.scheduleEntries)),
      getDocs(collection(db, COLLECTIONS.calendarDetails)),
    ]);

    const entries = entrySnap.docs
      .map((snapshot) => occurrenceOfScheduleEntry(parseScheduleEntry(snapshot.data()), snapshot.id))
      .filter((entry): entry is CalendarOccurrence => entry !== null);

    const details = new Map<string, CalendarDetail>();
    for (const snapshot of detailSnap.docs) {
      const detail = parseCalendarDetail(snapshot.data());
      /*
       * Keyed on the stored `occurrenceId`, **not** the document id. They are
       * usually the same string, but a document id cannot contain a slash, so
       * the website's writer substitutes those — and keying on the id here
       * would look an annotation up under a name it was never saved as.
       */
      if (detail.occurrenceId !== '') details.set(detail.occurrenceId, detail);
    }

    return { entries, details };
  } catch (error) {
    console.warn('[calendar] could not read the staff layers; carrying on without them:', error);
    return empty;
  }
}

/**
 * The parish's own authored event pages, as occurrences.
 *
 * The website gets these from its build and hands them down as a prop; a phone
 * has no build, so it reads them. Cheap — a parish authors a few dozen — and
 * worth having for the reason `occurrenceOfEvent` gives: a feature event is the
 * only source with somewhere to go.
 *
 * **No `published` filter, and that is not an oversight.** The `events`
 * collection has no such field: it was removed deliberately, the rule is
 * `allow read: if true`, and everything in it is public. Adding a filter here
 * to match the gallery queries would deny the whole read. See the header of the
 * website's `features/events/data.ts`.
 */
export async function getFeatureOccurrences(): Promise<CalendarOccurrence[]> {
  try {
    const snapshot = await getDocs(collection(getFirestore(), COLLECTIONS.events));

    return snapshot.docs.flatMap((doc) => {
      const raw = doc.data() as Record<string, unknown>;
      const startAt = toDate(raw.startAt as never);
      if (!startAt) return [];

      /*
       * Field by field rather than a cast, for the reason gallery/data.ts gives:
       * this binary is on a phone and cannot be redeployed when a document turns
       * out to be shaped unexpectedly.
       */
      return [
        occurrenceOfEvent(
          {
            slug: typeof raw.slug === 'string' && raw.slug !== '' ? raw.slug : doc.id,
            title: typeof raw.title === 'string' ? raw.title : '',
            startAt,
            endAt: toDate(raw.endAt as never),
            allDay: raw.allDay === true,
            location:
              typeof raw.location === 'object' && raw.location !== null
                ? String((raw.location as { name?: unknown }).name ?? '')
                : '',
            summary: typeof raw.summary === 'string' ? raw.summary : '',
            ...(typeof raw.timeZone === 'string' && raw.timeZone !== ''
              ? { timeZone: raw.timeZone }
              : {}),
          },
          PARISH_TIME_ZONE,
        ),
      ];
    });
  } catch (error) {
    console.warn('[calendar] could not read the parish events; carrying on without them:', error);
    return [];
  }
}
