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
 * issue a token to a simulator or an unsigned build. The token that selects
 * must be registered in the console before uploads work locally; one is, on
 * both the iOS and the Android app, and it is pinned in `.env` — see the note
 * there, and docs/gallery-console-setup.md §1d for the same dance on the web.
 *
 * ## Why the debug token is read behind `__DEV__`
 *
 * Because it is a credential, and `EXPO_PUBLIC_*` is not a runtime lookup —
 * Metro **inlines** it into the bundle by textual match. Referenced
 * unconditionally, the secret is a string literal in whatever bundle gets
 * built, release included, where anything that can read the binary can mint
 * App Check tokens for this app and walk past the one guard the upload
 * endpoint has. Behind `__DEV__` the reference is in a branch the release
 * minifier folds away with `__DEV__ === false`, so the literal is not there to
 * find.
 *
 * It costs nothing: the value is only ever *used* on the `debug` path, which
 * is selected by the same constant.
 */
export function startAppCheck(): AppCheck {
  if (instance) return instance;

  // One statement, so there is one place to reason about the inlining above
  // rather than two that have to agree.
  const debugToken = __DEV__ ? process.env.EXPO_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN : undefined;

  const provider = new ReactNativeFirebaseAppCheckProvider();
  provider.configure({
    apple: {
      /*
       * App Attest needs iOS 14+. The fallback keeps older devices working
       * rather than locking somebody on an old iPhone out of the one
       * feature this app exists for.
       */
      provider: __DEV__ ? 'debug' : 'appAttestWithDeviceCheckFallback',
      debugToken,
    },
    android: {
      provider: __DEV__ ? 'debug' : 'playIntegrity',
      debugToken,
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
  const attempt = await appCheckTokenOrReason();
  if (attempt.ok) return attempt.token;

  /*
   * Silent in a shipped build, and never silent in development.
   *
   * The swallow is right for somebody holding the app — the caller turns a
   * null into the one sentence there is to say, and an SDK error in its place
   * would be worse. It is exactly wrong while building the thing: a null here
   * makes *every* photograph fail with `401 unattested` from the Function, and
   * the commonest cause is a debug token that was never registered — App
   * Attest and Play Integrity both refuse a simulator outright. That is a
   * two-minute fix in the Firebase console and an afternoon of guessing
   * without a line in the log to point at it.
   *
   * See README and `.env.example`: register the token the native log prints at
   * launch, then put it in `EXPO_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN`.
   */
  if (__DEV__) {
    console.warn(
      `[appCheck] No attestation token, so uploads will be refused 401 "unattested". ${attempt.reason}`,
    );
  }
  return null;
}

/**
 * The same thing, but it says *why* it failed.
 *
 * ---------------------------------------------------------------------------
 * `appCheckToken` above is built on this and throws the reason away in a
 * shipped build, which is right: the person holding the app cannot act on any
 * of it. Everybody else can, and the reasons are not variations of one thing —
 * they have different remedies, which is the whole argument for keeping them:
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
 *   - **A debug token nobody registered**, which is every simulator run and
 *     the commonest of these by a distance. `__DEV__` selects the debug
 *     provider precisely because App Attest refuses a simulator, and the debug
 *     provider's token is only worth anything once it is in the console's
 *     allow list. Until it is, the exchange fails here and every upload comes
 *     back `401 unattested`.
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
  for (let attempt = 0; ; attempt += 1) {
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

      if (notReadyYet(code, message) && attempt < NOT_READY_ATTEMPTS) {
        await pause(NOT_READY_WAIT_MS);
        continue;
      }

      return { ok: false, reason: code ? `${code} — ${message}` : message };
    }
  }
}

/**
 * Whether this failure is "ask again in a moment" rather than "no".
 *
 * ## The race this exists for, which cost a working upload every launch
 *
 * `initializeAppCheck` looks synchronous and is not. RNFB's modular wrapper is
 * literally `void (appCheck).initializeAppCheck(options); return appCheck;` —
 * it **discards the promise** and hands back the instance, while the native
 * `configureProvider` is still in flight on the other side of the bridge. And
 * RNFB fails *closed* in that window, by design: its own documentation says
 * that before initialisation completes, `getToken` rejects with
 * `appCheck/provider-not-ready`.
 *
 * So `startAppCheck()` immediately followed by `getToken()` — which is exactly
 * what `appCheckToken` does, and exactly what the first upload after a launch
 * does — can lose. The native log shows both halves plainly:
 *
 *     getTokenWithCompletion: provider not ready (nil delegateProvider)
 *     …configureProvider: __FIRAPP_DEFAULT/debug/(not shown)
 *
 * A lost race is indistinguishable from a refused attestation everywhere
 * downstream: no header, `401 {"error":"unattested"}`, a failed row, and a
 * person told their photograph could not be sent by an app that would have
 * sent it a second later. A relaunch with anything already in the queue makes
 * it worse, because `drainQueue` runs at the moment the provider is least
 * likely to be up.
 *
 * Retrying is the whole fix and it is narrow: only this code, only a handful
 * of short waits. Everything else — an unsupported provider, a refused
 * attestation, an unregistered debug token — answers the same way every time
 * and is reported at once rather than after a second of waiting.
 *
 * The code is matched on both shapes because it crosses a bridge: the native
 * `userInfo` says `provider-not-ready` and RNFB namespaces it to
 * `appCheck/provider-not-ready` on the way out.
 */
function notReadyYet(code: string, message: string): boolean {
  return code.includes('provider-not-ready') || message.includes('provider is not ready');
}

/** Six tries over about a second, which is far longer than a bridge hop. */
const NOT_READY_ATTEMPTS = 6;
const NOT_READY_WAIT_MS = 180;

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
