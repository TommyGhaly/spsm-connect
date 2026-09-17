/**
 * Android notification channels — the switches the OS gives people, not us.
 *
 * ---------------------------------------------------------------------------
 * A channel is the unit Android lets somebody silence. Ship one channel and the
 * only choice a person has is this app or nothing; ship one per kind and they
 * can keep the reminder about Sunday's Liturgy while turning bookstore orders
 * off, in the OS settings, without asking anybody. That is the whole reason
 * these exist and it is why there are six rather than one.
 *
 * Three things about them are worth knowing before changing anything here.
 *
 * **The ids are a contract with the server.** `functions/src/notify/send.ts`
 * puts one of these strings in `android.notification.channelId` on every
 * message, and a message naming a channel that does not exist on the device is
 * delivered **silently, with no heads-up banner**, on Android 8 and later. It
 * does not error and nothing on either end says why. The two lists must match.
 *
 * **Importance is immutable after the first create.** Android deliberately
 * ignores changes to a channel's importance once it exists, so that an app
 * cannot un-silence something a person silenced. Calling
 * `setNotificationChannelAsync` again with a different importance does nothing
 * on an installed app — it only affects a fresh install. So these values are
 * effectively permanent, and the way to change one in the field is a new
 * channel id.
 *
 * **Creating a channel is what makes the Android 13 permission prompt
 * possible.** The OS will not show the notification permission dialog until at
 * least one channel exists, per the expo-notifications documentation. So this
 * runs before `askForNotifications`, not after — see `src/notify/permission.ts`.
 * ---------------------------------------------------------------------------
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { ADMIN_NOTICES, specOfAdminNotice, type AdminNotice } from '@spsm/shared';

/** The parish's colour, used for the LED and the icon tint. Matches app.config. */
const ACCENT = '#481010';

/** The channel a calendar reminder is delivered on. */
export const REMINDER_CHANNEL = 'calendar-reminders';

/** The channel an admin notice is delivered on. Mirrors `CHANNELS` in send.ts. */
export function channelForNotice(notice: AdminNotice): string {
  return `admin-${notice}`;
}

/**
 * Create every channel this app can deliver on.
 *
 * Idempotent, and called on every start rather than once behind a flag. A
 * channel the person has customised is not overwritten by this — Android keeps
 * their importance and their sound choice — so the only effect of calling it
 * again is to create anything a previous version of the app did not have. That
 * makes it the right shape for an upgrade: a notice added to `ADMIN_NOTICES`
 * gets its channel on the next launch with nothing to remember.
 *
 * A no-op on iOS, which has no channels. Notification *grouping* is the nearest
 * equivalent there and is done server-side with `thread-id` — see send.ts.
 */
export async function ensureChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL, {
    name: 'Calendar reminders',
    description: 'Reminders about services and events you have asked to be told about.',
    /*
     * `DEFAULT` rather than `HIGH`, and this is the one importance choice here
     * that is a real judgement.
     *
     * HIGH means a heads-up banner over whatever is on screen. That is right
     * for the admin notices below — somebody is waiting on each of them — and
     * wrong for a reminder, which the person scheduled *themselves* for a time
     * they chose. A banner interrupting a phone call to say "Vespers in one
     * hour" is more than was asked for. It still makes a sound and still sits
     * in the shade; it just does not push in front of anything.
     */
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: ACCENT,
  });

  /*
   * Sequentially rather than in a `Promise.all`. These are five cheap native
   * calls made once per launch, and doing them in order means a failure names
   * the channel it failed on instead of arriving as one rejected race.
   */
  for (const notice of ADMIN_NOTICES) {
    const spec = specOfAdminNotice(notice);
    await Notifications.setNotificationChannelAsync(channelForNotice(notice), {
      name: spec.label,
      description: spec.hint,
      // HIGH: every one of these is a person waiting on a servant to act.
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: ACCENT,
    });
  }
}
