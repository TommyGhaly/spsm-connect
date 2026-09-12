/**
 * App Check — the thing that decides whether this app may upload at all.
 *
 * The website attests with reCAPTCHA Enterprise. That does not exist on a
 * phone, so this uses the platform attestations instead: App Attest on iOS,
 * Play Integrity on Android, registered against the same App Check app in the
 * console.
 *
 * Why it is load-bearing rather than nice to have: `galleryUploadUrl` and
 * `formUploadUrl` read the `X-Firebase-AppCheck` header **by hand** and answer
 * `401 {"error":"unattested"}` without it. Every Function in that repo is
 * `onRequest` rather than `onCall`, so the `enforceAppCheck: true` option does
 * not apply and there is no automatic path. No token, no photographs.
 *
 * Note that App Check is NOT enforced on any Firebase API for this project —
 * docs/gallery-console-setup.md §1 explains that enforcing it on the Storage
 * service broke every <img> on the public site. So Firestore and Storage reads
 * work with or without this; only the two upload endpoints care.
 */
import { getApp } from '@react-native-firebase/app';
import {
  getToken,
  initializeAppCheck,
  ReactNativeFirebaseAppCheckProvider,
  type AppCheck,
} from '@react-native-firebase/app-check';

/*
 * The instance, held because `getToken` takes it as its first argument. There
 * is no `getAppCheck()` accessor that returns an already-initialised one, so
 * losing this reference would mean re-initialising to read a token.
 */
let instance: AppCheck | null = null;

/**
 * Start App Check. Safe to call more than once.
 *
 * `debug` in development because App Attest and Play Integrity both refuse to
 * issue a token to a simulator or an unsigned build. The debug token this
 * prints must be registered in the console before uploads work locally — see
 * docs/gallery-console-setup.md §1d, which covers the same dance for the web.
 */
export function startAppCheck(): AppCheck {
  if (instance) return instance;

  const provider = new ReactNativeFirebaseAppCheckProvider();
  provider.configure({
    apple: {
      /*
       * App Attest needs iOS 14+. The fallback keeps older devices working
       * rather than locking a parishioner on an old iPhone out of the one
       * feature this app exists for.
       */
      provider: __DEV__ ? 'debug' : 'appAttestWithDeviceCheckFallback',
      debugToken: process.env.EXPO_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN,
    },
    android: {
      provider: __DEV__ ? 'debug' : 'playIntegrity',
      debugToken: process.env.EXPO_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN,
    },
    isTokenAutoRefreshEnabled: true,
  });

  instance = initializeAppCheck(getApp(), { provider, isTokenAutoRefreshEnabled: true });
  return instance;
}

/**
 * An App Check token for an upload request, or null.
 *
 * Null rather than a throw: the caller has to turn this into the one refusal in
 * the feature with no self-service remedy, and it wants to say that in its own
 * words rather than surface an SDK error. See explainUploadFailure.
 */
export async function appCheckToken(): Promise<string | null> {
  try {
    const result = await getToken(startAppCheck());
    return result?.token ?? null;
  } catch {
    return null;
  }
}
