/**
 * Asking to be allowed to make the phone buzz.
 *
 * ---------------------------------------------------------------------------
 * ## Nothing here asks on its own
 *
 * There is no `requestPermissionsAsync` at app start in this codebase and there
 * must not be. A permission dialog on first launch, before the person has seen
 * what the app is for, is the one that gets denied — and on iOS a denial is
 * effectively **permanent**: `requestPermissionsAsync` resolves immediately
 * with the same answer every time afterwards, and the only way back is the
 * Settings app. One badly timed prompt spends the whole budget.
 *
 * So the ask is attached to the switch. Somebody turns on "Remind me about
 * Liturgies", *then* iOS asks, and the question has an obvious answer because
 * they just said what they wanted. `NotifySettings` is the only caller.
 *
 * ## Why the status is three-valued and not a boolean
 *
 * "Not allowed" has two completely different meanings and they need different
 * screens:
 *
 *   `undetermined`  nobody has asked yet. A switch can ask.
 *   `denied`        they said no, or turned it off in Settings later. A switch
 *                   cannot ask again; the only honest thing to offer is a link
 *                   to Settings, and saying "allow notifications" with no way
 *                   to do it is how an app gets called broken.
 *   `granted`       proceed.
 *
 * Collapsing those two into `false` is what produces a switch that silently
 * does nothing when tapped.
 * ---------------------------------------------------------------------------
 */
import { Linking, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import { ensureChannels } from './channels';

export type NotifyPermission = 'granted' | 'denied' | 'undetermined';

/**
 * What the OS currently thinks, without asking anybody anything.
 *
 * Safe to call on every mount. `getPermissionsAsync` shows no dialog.
 *
 * iOS `provisional` authorization is reported as granted. That is the quiet
 * delivery state an app gets if it ever asks for it — notifications go straight
 * to Notification Center without a sound — and this app does not ask for it,
 * so in practice this arm is unreachable. It is handled rather than left to
 * fall through to `denied`, because "granted, quietly" is much nearer granted
 * than denied and the settings screen would otherwise tell a lie.
 */
export async function notifyPermission(): Promise<NotifyPermission> {
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted) return 'granted';

  if (
    Platform.OS === 'ios' &&
    settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  ) {
    return 'granted';
  }

  /*
   * `canAskAgain` is the whole distinction. On iOS it goes false the moment the
   * person answers, whichever way; on Android 13 it goes false after two
   * dismissals. Either way, false means the switch must stop offering to ask.
   */
  return settings.canAskAgain ? 'undetermined' : 'denied';
}

/**
 * Ask, once, because somebody just turned something on.
 *
 * Channels are created first, and on Android 13+ that ordering is load-bearing
 * rather than tidy: the OS refuses to show the permission dialog until the app
 * has at least one notification channel. Without this line the prompt simply
 * never appears and `requestPermissionsAsync` resolves `denied` with nothing
 * having been shown to anybody.
 *
 * Returns the resulting status rather than a boolean, so a caller can tell
 * "they said no" from "they had already said no" — see `notifyPermission`.
 */
export async function askForNotifications(): Promise<NotifyPermission> {
  await ensureChannels();

  const existing = await notifyPermission();
  /*
   * Don't ask when asking cannot work. On iOS this would resolve instantly with
   * the old answer and no dialog, which looks to the caller exactly like a
   * fresh refusal — and the settings screen would then show "denied" without
   * ever having offered the Settings link that is the only way out.
   */
  if (existing !== 'undetermined') return existing;

  const settings = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowSound: true,
      allowBadge: true,
      /*
       * No `allowCriticalAlerts` and no `allowProvisional`.
       *
       * Critical alerts pierce Do Not Disturb and need an entitlement Apple
       * grants on application, for medical and public-safety use. A parish
       * bookstore order is not that, and asking would be refused.
       */
    },
  });

  if (settings.granted) return 'granted';
  return settings.canAskAgain ? 'undetermined' : 'denied';
}

/**
 * Open the OS settings page for this app.
 *
 * The only thing that can help somebody who has already refused. `openSettings`
 * lands on the app's own page on both platforms, which is as close as either OS
 * allows — neither can be deep-linked to the notifications section itself.
 */
export function openNotificationSettings(): void {
  void Linking.openSettings();
}
