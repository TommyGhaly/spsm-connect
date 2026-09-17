/**
 * Keeping the reminder window ahead of the person, while the app is closed.
 *
 * ---------------------------------------------------------------------------
 * `reminders.ts` schedules six weeks of reminders every time it runs, and it
 * runs when the app is opened. For somebody who opens the app weekly that is
 * more than enough on its own. This exists for the person who sets their
 * reminders in September and does not open the app again until Christmas: their
 * phone would faithfully deliver reminders until mid-October and then go quiet,
 * with nothing on screen ever having said so.
 *
 * So this is a periodic wake-up that calls `reconcile` and pushes the window
 * forward. It is the second mechanism in this app to work exactly this way —
 * `src/upload/backgroundDrain.ts` drains the upload queue on the same
 * scheduler — and the warning there applies here word for word:
 *
 * **Do not expect promptness.** `expo-background-task` is WorkManager on
 * Android and BGTaskScheduler on iOS. The floor is 15 minutes, the real
 * interval is whatever the OS decides from how the person uses the app, and it
 * is **unavailable on the iOS simulator**. A phone that is never opened may not
 * run this for days.
 *
 * That is why it is a safety net and not the mechanism. The honest statement of
 * the limit is the horizon date on the settings screen, which is drawn from
 * what was actually scheduled rather than from what was intended.
 *
 * ## Why this one does not unregister itself
 *
 * `backgroundDrain` stops itself once the queue is empty, because a wake-up
 * that exists to discover there is nothing to do is a battery cost paid by
 * everybody who ever sent one photograph. This is the opposite case: there is
 * *always* something to do while reminders are switched on, because the horizon
 * is always advancing. So it is registered when reminders are on and
 * unregistered when they are turned off — `syncReminderTask` — rather than
 * managing itself from inside the handler.
 * ---------------------------------------------------------------------------
 */
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';

import { loadReminderPrefs } from './prefs';
import { reconcile } from './reminders';

export const REMINDER_TASK = 'spsm.notify.reminders';

/*
 * Defined at module scope, which is a requirement rather than a style: the OS
 * launches the app straight into the task with no UI, and `defineTask` has to
 * have already run by the time the runtime looks for the handler. That is why
 * this module is imported for its side effect in app/_layout.tsx, beside
 * `@/upload/backgroundDrain`, and not lazily from the screen that happens to
 * show the switches — in a headless launch that screen never mounts.
 */
TaskManager.defineTask(REMINDER_TASK, async () => {
  try {
    const prefs = await loadReminderPrefs();

    /*
     * Registered but switched off. Reachable: somebody turns reminders off
     * while the OS has a wake-up already queued. `reconcile` would cancel
     * everything and return, which is correct but pointless work — and
     * `syncReminderTask` is about to unregister this anyway.
     */
    if (!prefs.enabled) return BackgroundTask.BackgroundTaskResult.Success;

    const result = await reconcile(prefs);

    /*
     * `Success` even when the calendar could not be read. The task did its job;
     * the network was out. `reconcile` leaves the existing reminders in place
     * in that case and there is nothing here to salvage or retry — the next
     * wake-up tries again, and reporting a failure only teaches the OS to run
     * this less often, which is precisely the wrong lesson.
     */
    if (result.problem) console.info(`[notify] background reconcile deferred: ${result.problem}`);
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (error) {
    /*
     * `Failed` rather than a rethrow, for the reason the drain task gives: an
     * unhandled throw out of a headless task is a crash in a process the person
     * cannot see. Nothing is lost — the preferences are on disk and the next
     * app start reconciles from scratch.
     */
    console.warn('[notify] background reminder refresh failed:', error);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/**
 * Register or unregister the wake-up to match the switch.
 *
 * Called from wherever reminders are turned on or off, and on app start so that
 * a registration lost to a reinstall comes back. Idempotent in both directions.
 */
export async function syncReminderTask(enabled: boolean): Promise<void> {
  try {
    const registered = await TaskManager.isTaskRegisteredAsync(REMINDER_TASK);

    if (enabled && !registered) {
      await BackgroundTask.registerTaskAsync(REMINDER_TASK, {
        /*
         * Once a day is the *request*, not the schedule. The OS floor is 15
         * minutes and the OS ceiling is "whenever we feel like it"; asking for
         * daily says what this actually needs — the horizon moves by a day per
         * day — and avoids asking to be woken every quarter of an hour to
         * re-derive a six-week window that has barely changed.
         */
        minimumInterval: 60 * 24,
      });
      return;
    }

    if (!enabled && registered) await BackgroundTask.unregisterTaskAsync(REMINDER_TASK);
  } catch (error) {
    /*
     * Unavailable on a simulator, and refusable by a phone in Low Power Mode or
     * with Background App Refresh switched off. None of that is an error worth
     * showing: reminders already scheduled still fire, and reconciling on app
     * start still works. The only thing lost is the safety net.
     */
    console.info('[notify] background reminder refresh is unavailable here:', error);
  }
}
