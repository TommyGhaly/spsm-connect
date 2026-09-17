/**
 * Telling the church which phone this is.
 *
 * ---------------------------------------------------------------------------
 * ## Why the token comes from messaging and not from expo-notifications
 *
 * Both libraries can hand out a push token and they are not the same token.
 * `Notifications.getDevicePushTokenAsync()` returns the **APNs** device token on
 * iOS — the raw one Apple issues — and the Firebase Admin SDK cannot address
 * it: `messaging().send()` takes an FCM registration token and nothing else.
 * Registering an APNs token would produce a `pushDevices` row that every send
 * rejects as invalid, and `send.ts` would then dutifully prune it.
 *
 * `getToken()` from @react-native-firebase/messaging returns the FCM token on
 * both platforms, which is what the parish's Functions can actually send to. So
 * messaging owns the remote side here and expo-notifications owns the local
 * one, which is the division `app.config.ts` explains where the two plugins are
 * registered.
 *
 * ## Registration is a statement of current state, not an event
 *
 * `register` is called on every start and after every change to the switches,
 * and it always sends the whole picture: this token, these notices. That makes
 * it idempotent and means there is no sequence of taps and restarts that can
 * leave the server holding something different from what the screen shows.
 *
 * The `refreshedAt` the endpoint writes is what makes a dead device findable
 * later; a phone that stops calling here has been reinstalled or thrown away.
 *
 * ## Anonymous sessions
 *
 * This needs a real session, and nearly nobody has one — sign-in is Microsoft
 * restricted to the parish tenant, so a signed-in user *is* a servant. That is
 * fine and needs no special case: `pushRegister` intersects the request with
 * the caller's grants, an anonymous caller holds none, and no row is kept. What
 * this module must **not** do is call `uploadIdToken()`, which signs in
 * anonymously when nobody is signed in — see firebase/auth.ts. Minting an
 * anonymous account so that it can be told it has no permissions is a pointless
 * account and a pointless write. So `register` refuses early when there is no
 * person, and that is the one check in this file.
 * ---------------------------------------------------------------------------
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import {
  getMessaging,
  getToken,
  onTokenRefresh,
  registerDeviceForRemoteMessages,
} from '@react-native-firebase/messaging';
import { noAdminNotices, type AdminNotice, type AdminNoticePrefs } from '@spsm/shared';

import { apiPost } from '@/api/client';
import { currentUser } from '@/firebase/auth';

/** What the endpoint answers. `notices` is the truth after intersection. */
export interface Registration {
  registered: boolean;
  /** What was actually saved — the request ANDed with the caller's grants. */
  notices: AdminNoticePrefs;
  /** What this person is entitled to ask for, per the server. */
  entitled: AdminNotice[];
}

/**
 * This installation's FCM token, or null.
 *
 * `registerDeviceForRemoteMessages` first, and on iOS it is required rather
 * than defensive: `getToken` cannot return an FCM token until the device has an
 * APNs token to exchange for one, and asking too early rejects with
 * `messaging/unregistered`. It is a no-op on Android and on a second call.
 *
 * Null on the iOS simulator, which cannot register for remote notifications at
 * all — the same constraint App Attest and the background drain already put on
 * this app. That is a fact to design around, not an error: the settings screen
 * still works, the reminder half still works, and only the admin half is
 * untestable without a real device.
 */
export async function pushToken(): Promise<string | null> {
  try {
    const messaging = getMessaging();
    if (Platform.OS === 'ios') await registerDeviceForRemoteMessages(messaging);
    const token = await getToken(messaging);
    return token === '' ? null : token;
  } catch (error) {
    console.warn('[notify] no push token on this device:', error);
    return null;
  }
}

/**
 * Save this phone's subscriptions.
 *
 * Returns null when there is nothing to register — no session, or no token —
 * which the settings screen shows as the admin section being unavailable rather
 * than as a failure. Throws `ApiError` for a real refusal from the endpoint,
 * because that one has a sentence worth showing.
 */
export async function register(notices: AdminNoticePrefs): Promise<Registration | null> {
  const user = currentUser();
  // See the header: no anonymous registration, and deliberately no sign-in.
  if (!user || user.isAnonymous) return null;

  const token = await pushToken();
  if (!token) return null;

  return apiPost<Registration>('/api/push/register', {
    token,
    platform: Platform.OS === 'android' ? 'android' : 'ios',
    notices,
    /*
     * For triaging a bad release, and nothing else. `nativeAppVersion` is the
     * binary's version rather than the OTA bundle's, which is the one that
     * matters for a notification bug — the native delegate is the part that
     * differs between builds.
     */
    appVersion: Constants.expoConfig?.version ?? null,
  });
}

/**
 * Stop sending to this phone.
 *
 * A separate call rather than `register(noAdminNotices())` — which the endpoint
 * would also treat as a removal — because `remove` is honoured without reading
 * the caller's grants at all. A servant whose grants have gone still has a
 * phone that would otherwise keep ringing, and turning notifications off must
 * never be refusable. See the note in register.ts.
 */
export async function unregister(): Promise<void> {
  const user = currentUser();
  if (!user || user.isAnonymous) return;

  const token = await pushToken();
  if (!token) return;

  await apiPost('/api/push/register', { token, remove: true });
}

/**
 * Re-register when the OS reissues the token.
 *
 * Not a rare event: FCM rotates a token on reinstall, on a restore to a new
 * phone, and when it decides the old one is stale. The old token is invalid
 * from that moment, so a device that does not do this goes quiet and the only
 * evidence is `send.ts` pruning a row nobody knew was dead.
 *
 * The prefs are read through a getter rather than captured as a value, and the
 * getter is async on purpose: this listener outlives any particular render, a
 * token can rotate hours after it was installed, and what should be registered
 * then is whatever the switches say *at that moment*. Passing
 * `loadNoticePrefs` reads them off disk when the rotation happens, which means
 * there is no cached copy anywhere that could fall out of step.
 *
 * Returns the unsubscribe.
 */
export function watchToken(current: () => Promise<AdminNoticePrefs>): () => void {
  return onTokenRefresh(getMessaging(), () => {
    void current()
      .then((notices) => register(notices))
      .catch((error: unknown) => {
        // Nothing to show: no screen is necessarily open, and the next app
        // start registers again from scratch.
        console.warn('[notify] could not re-register a refreshed token:', error);
      });
  });
}

/** The shipped state: subscribed to nothing. Re-exported so screens need one import. */
export { noAdminNotices };
