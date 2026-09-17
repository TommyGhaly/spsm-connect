/**
 * The housekeeping that has to happen on every start, and nowhere else.
 *
 * ---------------------------------------------------------------------------
 * Three jobs, none of which belongs to a screen, because all three must happen
 * whether or not anybody opens the settings screen — which most people never
 * will.
 *
 *   1. **Re-assert the FCM token.** A token is not permanent: FCM reissues one
 *      on reinstall, on a restore to a new phone, and when it decides the old
 *      one is stale. Re-registering on every start keeps `refreshedAt` moving
 *      so a dead device is findable, and repairs a row that went stale while
 *      the app was closed.
 *
 *   2. **Re-check the entitlement.** This is the one that matters most and is
 *      easiest to miss. A servant who is given the `forms` grant today sees the
 *      row appear — but a servant whose grant is *removed* is still registered
 *      for it. `pushRegister` intersects on every call, so simply calling it is
 *      what revokes the subscription. `audience.ts` would refuse to send anyway
 *      — the entitlement is checked again at send time, deliberately — so this
 *      is the tidying rather than the guarantee.
 *
 *   3. **Push the reminder horizon forward.** `reconcile` schedules six weeks
 *      from today, so opening the app is what moves the window. The background
 *      task does this too, but the OS decides when to run it and may not for
 *      days; an app being opened is the one moment we know for certain.
 *
 * ## What it deliberately does not do
 *
 * **It never asks for permission.** Not once, not conditionally. A notification
 * prompt at launch is the one that gets refused, and on iOS a refusal is
 * permanent until somebody goes to Settings. The ask belongs to the moment a
 * person turns something on, which is `NotifySettings` and only there.
 *
 * **It never signs anybody in.** `register` refuses an anonymous session rather
 * than minting one; see the note in device.ts about `uploadIdToken`.
 *
 * **It sends nothing when nothing is subscribed**, which is the common case: an
 * ordinary parishioner holds no grants, so there is no row to refresh and no
 * call to make. The check is a local read rather than a request.
 * ---------------------------------------------------------------------------
 */
import { useEffect } from 'react';
import { wantsAnyAdminNotice } from '@spsm/shared';

import { useSession } from '@/session/SessionProvider';

import { syncReminderTask } from './backgroundReminders';
import { ensureChannels } from './channels';
import { register, watchToken } from './device';
import { loadNoticePrefs, loadReminderPrefs, saveNoticePrefs } from './prefs';
import { reconcile } from './reminders';

/**
 * Run the start-up housekeeping, and keep the token watched.
 *
 * Called once, from the root layout. Depends on the session because job 2 needs
 * to know there is a person: it re-runs when somebody signs in or out, which is
 * exactly when their entitlement can have changed.
 */
export function useNotifyLifecycle(): void {
  const { isPerson, loading } = useSession();

  useEffect(() => {
    // Wait for the first auth callback. Registering during `loading` would use
    // whatever the session happened to be a moment before it settled.
    if (loading) return;

    let alive = true;

    void (async () => {
      /*
       * Channels first and unconditionally. They are what the OS silences
       * against, and on Android 13 their existence is what makes the permission
       * prompt possible at all — so they must be in place before anybody taps a
       * switch, which may be before this app is ever opened again.
       */
      await ensureChannels();

      /* ── Reminders ─────────────────────────────────────────────────────── */
      const reminders = await loadReminderPrefs();
      if (!alive) return;

      if (reminders.enabled) {
        await reconcile(reminders);
        /*
         * Re-registered rather than assumed. A background task registration
         * does not survive a reinstall, and a person whose reminders have been
         * on for a year would otherwise silently lose the refresh.
         */
        await syncReminderTask(true);
      }
      if (!alive) return;

      /* ── Admin notices ─────────────────────────────────────────────────── */
      const notices = await loadNoticePrefs();

      /*
       * Nothing subscribed, so nothing to refresh. The early return is the
       * whole reason this is cheap for the parishioners who are most of the
       * app's users: no token is minted, no request is made.
       */
      if (!isPerson || !wantsAnyAdminNotice(notices)) return;

      try {
        const result = await register(notices);
        if (!alive || !result) return;
        // The server's intersection, which is what this phone should believe.
        await saveNoticePrefs(result.notices);
      } catch (error) {
        /*
         * Silent. Nobody asked for this — it is start-up housekeeping — and
         * there is no screen to put a message on. The settings screen reports
         * its own failures, and the next start tries again.
         */
        console.warn('[notify] could not refresh this device registration:', error);
      }
    })();

    return () => {
      alive = false;
    };
  }, [isPerson, loading]);

  /*
   * The token watcher, kept separate because it must outlive the effect above
   * rather than re-run whenever the session settles.
   *
   * `loadNoticePrefs` is handed over as the getter rather than the current
   * value: a token can rotate hours from now, and what should be re-registered
   * then is whatever the switches say at that point. Reading it off disk at the
   * moment of the rotation means there is no cached copy to fall out of step.
   */
  useEffect(() => watchToken(loadNoticePrefs), []);
}
