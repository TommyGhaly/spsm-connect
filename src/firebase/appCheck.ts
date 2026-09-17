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
       * rather than locking somebody on an old iPhone out of the one
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

/**
 * The same thing, but it says *why* it failed.
 *
 * ---------------------------------------------------------------------------
 * For the App Clip spike, and for nothing else — `appCheckToken` above is what
 * the upload path uses, and it is right to swallow this.
 *
 * The spike exists to answer one question, and a bare null cannot answer it. At
 * least three quite different things produce a null in an App Clip, and they
 * have three different remedies:
 *
 *   - **App Attest is unsupported in this process.** The SDK checks
 *     `DCAppAttestService.isSupported` before anything else and rejects with
 *     its own "unsupported attestation provider" error — see
 *     `GACAppAttestProvider.m`'s `isAppAttestSupported`. If this is the answer,
 *     no amount of Firebase configuration fixes it and the clip is read-only.
 *
 *   - **The attestation was refused by the Firebase backend**, which is what a
 *     bundle identifier disagreement looks like. Apple builds the relying-party
 *     identifier from the team id and *the bundle it is running in*, so a clip
 *     attests as `org.spsm.connect.Clip` — while the plist it ships is the
 *     parent app's and names `org.spsm.connect`. That is fixable: a second
 *     Firebase iOS app for the clip's own bundle id, with its own plist and its
 *     own App Attest registration.
 *
 *   - **Something ordinary** — no network, a clock far enough out to invalidate
 *     the challenge, a missing entitlement.
 *
 * Returning the error rather than a boolean is what lets one run on one device
 * tell those apart, instead of three runs guessing.
 * ---------------------------------------------------------------------------
 */
export type AppCheckAttempt =
  /*
   * Discriminated on `ok` rather than on `token`, because `token: string` is
   * not a literal type and so cannot narrow the union — TypeScript would refuse
   * `attempt.reason` in the falsy branch of `attempt.token ? … : …`.
   */
  { ok: true; token: string } | { ok: false; reason: string };

export async function appCheckTokenOrReason(): Promise<AppCheckAttempt> {
  try {
    const result = await getToken(startAppCheck());
    if (result?.token) return { ok: true, token: result.token };
    return { ok: false, reason: 'The SDK returned no token and no error.' };
  } catch (cause) {
    /*
     * The message verbatim, plus the code when there is one. RNFB surfaces the
     * native error's `code` (`app-check/unknown`, and so on) and the underlying
     * description is where "unsupported attestation provider" actually appears.
     */
    const code =
      typeof cause === 'object' && cause !== null && 'code' in cause
        ? String((cause as { code: unknown }).code)
        : '';
    const message = cause instanceof Error ? cause.message : String(cause);
    return { ok: false, reason: code ? `${code} — ${message}` : message };
  }
}
