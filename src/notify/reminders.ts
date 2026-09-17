/**
 * Scheduling a phone to say "Vespers in an hour", with no server involved.
 *
 * ---------------------------------------------------------------------------
 * ## The whole shape of it
 *
 * Fetch the next few weeks of the parish schedule; work out which occurrences
 * the person asked about; cancel every reminder this app had scheduled; set
 * them again from scratch. That last pair is one operation — `reconcile` — and
 * it is deliberately a *replace* rather than a diff.
 *
 * A diff would be less work and is the wrong trade here. Reminders go stale in
 * ways the phone cannot detect incrementally: the office moves a Liturgy by
 * half an hour, an event is cancelled outright, a reminder is left over for a
 * kind the person switched off last week. Every one of those is a notification
 * that fires and is *wrong*, which is worse than one that never fires at all —
 * an app that lies about the time of a service will not be trusted about the
 * next one either. Cancelling everything and re-deriving makes the scheduled
 * set a pure function of (schedule, preferences), so there is no state to drift.
 *
 * The cost is bounded and small: `cancelScheduledNotificationAsync` on a few
 * dozen ids and `scheduleNotificationAsync` on a few dozen more, off the main
 * path, a handful of times a day at most.
 *
 * ## What this cannot do, said plainly
 *
 * It can only remind somebody about events it has already fetched. A phone left
 * closed for a month runs out of scheduled reminders and nothing happens. There
 * is no way around that without the server-side scheduler this design
 * deliberately does not have (see @spsm/shared's schema/notifications.ts), so
 * it is mitigated rather than hidden:
 *
 *   - `reconcile` runs on every app start and on every change to the switches.
 *   - `src/notify/backgroundReminders.ts` runs it from a periodic wake-up.
 *   - The horizon is **shown on the settings screen**. If reminders are only
 *     set to the 12th, the person is told they are only set to the 12th.
 *
 * ## Why `HORIZON_DAYS` is 42 and not a year
 *
 * `MAX_CALENDAR_RANGE_DAYS` caps one `/api/calendar` request at 62 days, and
 * the note on it explains why that endpoint is not a bulk export: the parish
 * calendar comes out of Breeze and a year of it is 816 occurrences and 728KB.
 * Six weeks is one request, comfortably inside the cap, and about as far ahead
 * as a reminder is any use — a notification scheduled in March for an event in
 * November will have been rescheduled forty times before it fires.
 * ---------------------------------------------------------------------------
 */
import * as Notifications from 'expo-notifications';
import {
  PARISH_TIME_ZONE,
  addDays,
  kindOf,
  todayIn,
  wallClockToInstant,
  wantsReminder,
  type CalendarOccurrence,
  type CalendarReminderPrefs,
} from '@spsm/shared';

import { getSchedule } from '@/calendar/data';

import { REMINDER_CHANNEL } from './channels';
import { notifyPermission } from './permission';
import { clearHorizon, saveHorizon } from './prefs';

/** How far ahead to schedule. One `/api/calendar` request. See the header. */
const HORIZON_DAYS = 42;

/**
 * The cap on scheduled reminders.
 *
 * iOS allows **64 pending local notifications per app** and silently drops the
 * rest — it does not error, and the ones it keeps are not necessarily the
 * soonest. So the list is sorted by time and truncated here rather than left
 * for the OS to truncate arbitrarily, which is the difference between "your
 * reminders stop after the 12th" and "some of your reminders did not happen".
 *
 * Sixty rather than sixty-four, leaving room for anything else this app might
 * ever schedule locally.
 */
const MAX_SCHEDULED = 60;

/**
 * A marker on every notification this module creates.
 *
 * `cancelAllScheduledNotificationsAsync` would be simpler and is not used,
 * because it would also cancel anything else the app ever schedules. Matching
 * on this in the content's data means the reconcile owns exactly its own
 * reminders — and if a future version of this app schedules something else,
 * this keeps working without anybody having to notice.
 */
const MARKER = 'spsm.reminder';

export interface ReconcileResult {
  /** How many reminders are now pending. */
  scheduled: number;
  /** The last day reminders reach, `YYYY-MM-DD`. Null when none are set. */
  horizon: string | null;
  /** True when the 64-notification ceiling truncated the list. */
  truncated: boolean;
  /** Set when the schedule could not be read. Reminders are left alone. */
  problem: string | null;
}

/**
 * Cancel and re-schedule every calendar reminder.
 *
 * Safe to call often and from anywhere — the app start, a switch, the
 * background task. Never throws: a failure to reach the calendar must not take
 * down whatever called it, and the previous reminders are left in place, which
 * is strictly better than clearing them because the network was briefly out.
 */
export async function reconcile(prefs: CalendarReminderPrefs): Promise<ReconcileResult> {
  const idle: ReconcileResult = { scheduled: 0, horizon: null, truncated: false, problem: null };

  /*
   * Switched off, or not permitted. Cancel and stop.
   *
   * The permission check matters as much as the switch: somebody can revoke
   * notifications in the OS settings long after turning these on, and every
   * scheduled reminder then sits pending and silent. Clearing them means that
   * re-granting permission does not produce a burst of reminders for events
   * that have since happened.
   */
  if (!prefs.enabled || (await notifyPermission()) !== 'granted') {
    await cancelAll();
    await clearHorizon();
    return idle;
  }

  const from = todayIn(PARISH_TIME_ZONE);
  const to = addDays(from, HORIZON_DAYS);

  /*
   * The church calendar only. `scope=servants` is deliberately never asked for
   * here: the servants' rota is readable in the calendar screen, but it does
   * not produce reminders, so requesting it would fetch a private schedule this
   * module has no use for.
   */
  const result = await getSchedule(from, to, { servants: false });

  if (result.kind !== 'ok') {
    /*
     * Left exactly as it was, on purpose. `getSchedule` fails for an aeroplane,
     * a flat cellular connection and an expired session, and in every one of
     * those the reminders already on the phone are the best information
     * available. Wiping them would turn a bad signal into a missed service.
     *
     * `unset` — the parish has configured no calendar — is treated the same.
     * It is indistinguishable here from a Function that is briefly unwell, and
     * guessing wrong in the other direction cancels somebody's reminders.
     */
    return {
      ...idle,
      problem: result.kind === 'denied' || result.kind === 'error' ? result.message : null,
    };
  }

  const wanted = due(result.feed.occurrences, prefs);

  await cancelAll();

  const kept = wanted.slice(0, MAX_SCHEDULED);
  for (const entry of kept) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: entry.occurrence.title,
          body: bodyFor(entry.occurrence, prefs.leadMinutes),
          /*
           * Carried so a tap can open the day this is about, and so `cancelAll`
           * can recognise its own work. `data` is the only part of a scheduled
           * notification that survives to the handler.
           */
          data: {
            [MARKER]: true,
            occurrenceId: entry.occurrence.id,
            day: entry.occurrence.day,
          },
        },
        trigger: {
          /*
           * A date trigger, which is the only correct kind here.
           *
           * The tempting alternative is `timeInterval` with "seconds from now",
           * and it is wrong for a reminder about a fixed clock time: the
           * interval is computed once and does not move, so a phone that
           * sleeps, crosses a time zone, or sits through the end of daylight
           * saving fires it an hour out. A date is an instant, and the OS holds
           * it against the wall clock.
           */
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: entry.at,
          channelId: REMINDER_CHANNEL,
        },
      });
    } catch (error) {
      // One bad entry must not cost the other fifty-nine.
      console.warn(`[notify] could not schedule a reminder for ${entry.occurrence.id}:`, error);
    }
  }

  const horizon = kept.length > 0 ? (kept[kept.length - 1]?.occurrence.day ?? null) : null;
  if (horizon) await saveHorizon(horizon);
  else await clearHorizon();

  return {
    scheduled: kept.length,
    horizon,
    truncated: wanted.length > kept.length,
    problem: null,
  };
}

interface DueReminder {
  occurrence: CalendarOccurrence;
  at: Date;
}

/**
 * Which occurrences want a reminder, and exactly when to fire it.
 *
 * Exported for the tests, and because the arithmetic is the part of this file
 * most worth checking without a device attached.
 */
export function due(
  occurrences: readonly CalendarOccurrence[],
  prefs: CalendarReminderPrefs,
): DueReminder[] {
  const now = Date.now();
  const reminders: DueReminder[] = [];

  for (const occurrence of occurrences) {
    if (!wantsReminder(prefs, { id: occurrence.id, kind: kindOf(occurrence) })) continue;

    const at = fireTime(occurrence, prefs.leadMinutes);
    /*
     * Already gone. Two causes and both are ordinary: the event is today and
     * its lead time has passed, or the person just chose "the day before" for
     * something happening this afternoon. iOS treats a past date trigger as
     * "deliver immediately", so without this check turning on reminders would
     * fire a handful of notifications about services that have already been
     * sung.
     */
    if (!at || at.getTime() <= now) continue;

    reminders.push({ occurrence, at });
  }

  // Soonest first, which is what makes the MAX_SCHEDULED truncation keep the
  // reminders that matter rather than an arbitrary sixty.
  return reminders.sort((left, right) => left.at.getTime() - right.at.getTime());
}

/**
 * When to speak about one occurrence.
 *
 * ---------------------------------------------------------------------------
 * The times on the parish calendar are **wall-clock readings in the parish's
 * zone** — `startTime` is `HH:MM` and `day` is `YYYY-MM-DD`, with no offset
 * anywhere, because a calendar cell is a civil date rather than an instant.
 * See the long note at the top of `schema/calendar.ts`.
 *
 * So turning one into a `Date` has to go through `wallClockToInstant`, which
 * resolves the zone in two passes and is therefore right across a daylight
 * saving transition. `new Date('2026-11-01T02:30')` would be interpreted in
 * whatever zone the phone happens to be in — which for a parishioner
 * travelling is the whole problem, and on the fall-back night is ambiguous even
 * at home.
 *
 * An all-day event has no `startTime`. It is reminded about at **9am on the
 * day**, not at midnight: a notification that arrives while somebody is asleep
 * has been read before they are awake enough to act on it, and the lead time
 * they chose is about services with a clock time. The day-before lead is
 * honoured by shifting that 9am back, which is the one case where "the day
 * before" means something for an all-day event.
 * ---------------------------------------------------------------------------
 */
function fireTime(occurrence: CalendarOccurrence, leadMinutes: number): Date | null {
  const wallClock = occurrence.allDay || !occurrence.startTime
    ? `${occurrence.day}T09:00`
    : `${occurrence.day}T${occurrence.startTime}`;

  const start = wallClockToInstant(wallClock, PARISH_TIME_ZONE);
  if (!start) return null;

  return new Date(start.getTime() - leadMinutes * 60_000);
}

/** "Starts at 6:00 PM · Church hall", or "Today" for an all-day entry. */
function bodyFor(occurrence: CalendarOccurrence, leadMinutes: number): string {
  const parts: string[] = [];

  if (occurrence.allDay || !occurrence.startTime) {
    parts.push(leadMinutes >= 1440 ? 'Tomorrow' : 'Today');
  } else {
    /*
     * Formatted from the `HH:MM` string rather than from the instant, so the
     * notification reads the parish's clock even for somebody in another zone.
     * A parishioner in Cairo being told a Liturgy is at 1:00 AM is technically
     * correct and useless.
     */
    parts.push(`Starts at ${clockLabel(occurrence.startTime)}`);
  }

  if (occurrence.location) parts.push(occurrence.location);
  return parts.join(' · ');
}

/** `18:00` → `6:00 PM`. Deliberately not `Intl`; there is no instant here. */
function clockLabel(time: string): string {
  const [rawHour = '0', minute = '00'] = time.split(':');
  const hour = Number(rawHour);
  const suffix = hour < 12 ? 'AM' : 'PM';
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelve}:${minute} ${suffix}`;
}

/**
 * Cancel every reminder this module scheduled, and nothing else.
 *
 * Matched on `MARKER` in the content's data rather than using
 * `cancelAllScheduledNotificationsAsync`, so that anything else this app ever
 * schedules locally is left alone. See the note on `MARKER`.
 */
async function cancelAll(): Promise<void> {
  try {
    const pending = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      pending
        .filter((request) => request.content.data?.[MARKER] === true)
        .map((request) => Notifications.cancelScheduledNotificationAsync(request.identifier)),
    );
  } catch (error) {
    console.warn('[notify] could not clear scheduled reminders:', error);
  }
}
