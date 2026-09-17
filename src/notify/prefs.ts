/**
 * The two sets of preferences, and why only one of them leaves the phone.
 *
 * ---------------------------------------------------------------------------
 * `CalendarReminderPrefs` is stored here and **nowhere else**. It is not
 * mirrored to Firestore, not attached to the member document, and not sent to
 * any endpoint. The reasons are in @spsm/shared's schema/notifications.ts and
 * the short version is that most people using this app are anonymous, there is
 * no server-side copy of the parish calendar to schedule against anyway, and a
 * reminder preference is a small statement about where somebody will be on
 * Wednesday which the parish has no reason to hold.
 *
 * `AdminNoticePrefs` is the opposite and has to be: a push is sent by a server,
 * so the server must know who wants one. It is cached here purely so the
 * settings screen can draw itself before the network answers, and so
 * `watchToken` has something to re-register with. **The stored copy is not
 * authoritative** — `pushRegister` intersects whatever it is sent with the
 * caller's actual grants and echoes back the truth, and that answer overwrites
 * this. See `saveNoticePrefs`.
 *
 * AsyncStorage rather than the SQLite database that backs the upload queue.
 * That queue needs transactions and survives a crash mid-write because losing a
 * row loses somebody's photograph; this is one small blob rewritten whole, and
 * the worst case of losing it is a person re-ticking four switches.
 * ---------------------------------------------------------------------------
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  defaultReminderPrefs,
  noAdminNotices,
  parseAdminNoticePrefs,
  parseReminderPrefs,
  type AdminNoticePrefs,
  type CalendarReminderPrefs,
} from '@spsm/shared';

const REMINDER_KEY = 'spsm.notify.reminders';
const NOTICE_KEY = 'spsm.notify.notices';

/**
 * How far ahead reminders have been scheduled, as a `YYYY-MM-DD`.
 *
 * Kept so the settings screen can say "reminders are set to 12 October" rather
 * than implying they run forever. That sentence is the honest cost of doing
 * this locally, and hiding it is how somebody ends up trusting a reminder that
 * was never scheduled.
 */
const HORIZON_KEY = 'spsm.notify.horizon';

/* -------------------------------------------------------------------------- */
/* Calendar reminders                                                         */
/* -------------------------------------------------------------------------- */

export async function loadReminderPrefs(): Promise<CalendarReminderPrefs> {
  try {
    const raw = await AsyncStorage.getItem(REMINDER_KEY);
    // `parseReminderPrefs` falls back field by field rather than wholesale, so
    // an upgrade that adds a kind keeps the lead time somebody chose.
    return raw === null ? defaultReminderPrefs() : parseReminderPrefs(JSON.parse(raw));
  } catch {
    /*
     * Unreadable or not JSON — a half-written value from a kill mid-write, or a
     * shape from a build long gone. The defaults are a working set of answers,
     * so this is recoverable without telling anybody anything.
     */
    return defaultReminderPrefs();
  }
}

export async function saveReminderPrefs(prefs: CalendarReminderPrefs): Promise<void> {
  await AsyncStorage.setItem(REMINDER_KEY, JSON.stringify(prefs));
}

/* -------------------------------------------------------------------------- */
/* Admin notices                                                              */
/* -------------------------------------------------------------------------- */

export async function loadNoticePrefs(): Promise<AdminNoticePrefs> {
  try {
    const raw = await AsyncStorage.getItem(NOTICE_KEY);
    return raw === null ? noAdminNotices() : parseAdminNoticePrefs(JSON.parse(raw));
  } catch {
    // Subscribed to nothing is the safe direction for a value we cannot read:
    // it under-notifies rather than sending somebody something they never
    // asked for, and the settings screen replaces it on the next answer.
    return noAdminNotices();
  }
}

/**
 * Cache what the *server* said, not what was asked for.
 *
 * Always called with `Registration.notices` — the intersection the endpoint
 * performed — rather than with the map handed to `register`. A servant who has
 * lost the `forms` grant asked for four things and was given three, and the
 * three are what this phone should believe it has.
 */
export async function saveNoticePrefs(prefs: AdminNoticePrefs): Promise<void> {
  await AsyncStorage.setItem(NOTICE_KEY, JSON.stringify(prefs));
}

/* -------------------------------------------------------------------------- */
/* The reminder horizon                                                       */
/* -------------------------------------------------------------------------- */

export async function loadHorizon(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(HORIZON_KEY);
    return /^\d{4}-\d{2}-\d{2}$/.test(raw ?? '') ? raw : null;
  } catch {
    return null;
  }
}

export async function saveHorizon(day: string): Promise<void> {
  await AsyncStorage.setItem(HORIZON_KEY, day);
}

/** Forget the horizon, so the next reconcile does not claim a stale date. */
export async function clearHorizon(): Promise<void> {
  await AsyncStorage.removeItem(HORIZON_KEY);
}
