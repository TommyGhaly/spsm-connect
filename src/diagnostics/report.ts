/**
 * Telling the church when the app breaks, without telling anybody else.
 *
 * ---------------------------------------------------------------------------
 * The decision this file exists to carry is in
 * `@spsm/shared`'s `analytics/faults.ts`, and the short of it is: the privacy
 * notice promises parishioners that there is "no analytics service, no crash
 * reporter, no advertising identifier" in this app, and that promise is worth
 * more than Crashlytics' dashboard. So a fault becomes one document in the
 * church's own Firestore and no third party is involved at any point.
 *
 * Read them in the Firebase console, under `faults`. Newest first; the app
 * writes nothing else there.
 *
 * ## Three rules, and they are the whole design
 *
 * **1. It never throws.** Everything here is wrapped, including the wrapping.
 * A crash reporter that fails while reporting a crash turns one broken screen
 * into a broken app, and it does it precisely when the app is least able to
 * cope. Every failure is swallowed to a `console.warn` and nothing is retried.
 *
 * **2. It is never awaited by anything a person is doing.** `reportFault` hands
 * back a promise so that a test can wait for it, and every caller in the app
 * drops it. A parishioner whose screen has just failed should not then wait on
 * a network round trip to be told so.
 *
 * **3. It identifies nobody.** No uid, no device id, no email, no installation
 * id — see the shared file for why a uid was offered and refused. `route` is a
 * path, which is a fact about the app and not about the reader.
 *
 * ## Dev builds report too, and are flagged rather than dropped
 *
 * The temptation is `if (__DEV__) return`, and it is wrong twice: it makes the
 * one build where you can actually watch a crash happen the one build that
 * never exercises this code, so the reporter is first tested in production. The
 * `dev` field carries the truth instead, and a console filter drops them.
 * ---------------------------------------------------------------------------
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { addDoc, collection, getFirestore, serverTimestamp } from '@react-native-firebase/firestore';
import {
  COLLECTIONS,
  FAULT_MESSAGE_MAX,
  FAULT_STACK_MAX,
  FAULT_TTL_DAYS,
  faultText,
  type FaultSource,
} from '@spsm/shared';

/**
 * This build's version, read once.
 *
 * `expoConfig.version` is `app.config.ts`'s `version` — the same string that
 * goes on the store listing — so a fault says which release produced it. The
 * fallback is not a lie worth avoiding: a build with no version is a build
 * assembled in a way nobody expects, and '0.0.0' is visible in a console
 * exactly the way it should be.
 */
const VERSION = Constants.expoConfig?.version ?? '0.0.0';

/**
 * Whether a fault has already been sent for this message.
 *
 * A render failure is not a single event: React re-renders, the boundary
 * catches again, and a route that throws on every mount will happily write a
 * document per attempt until the collection is mostly one bug. The key is the
 * message rather than the whole stack so that the same fault from two slightly
 * different frames still collapses.
 *
 * Deliberately per-process and unbounded-but-small: it is cleared when the app
 * restarts, which is the granularity that matters — a crash that survives a
 * relaunch is worth a second document, because it says the bug is not
 * transient.
 */
const alreadySent = new Set<string>();

/**
 * How many faults this process will send, ever.
 *
 * A backstop under the deduplication above, for the failure that generates a
 * *different* message every time — a render loop that throws with a counter in
 * it would otherwise write documents until the phone was put down. Twenty is
 * far more than any real session produces and far fewer than a loop does.
 */
const CEILING = 20;
let sent = 0;

/**
 * Record a fault, if it is new.
 *
 * Resolves either way and rejects never. The boolean says whether a document
 * was written, which is for tests rather than for callers — nothing in the app
 * looks at it.
 */
export async function reportFault(
  error: unknown,
  source: FaultSource,
  route: string,
): Promise<boolean> {
  try {
    const message = faultText(
      error instanceof Error ? error.message : error,
      FAULT_MESSAGE_MAX,
    );

    /*
     * A fault with nothing to say is dropped rather than stored. The rule
     * refuses an empty message anyway — this is here so that the refusal is
     * not the thing that decides it, since the refusal is invisible.
     */
    if (!message) return false;

    const key = `${source}:${message}`;
    if (alreadySent.has(key) || sent >= CEILING) return false;
    alreadySent.add(key);
    sent += 1;

    const stack = faultText(error instanceof Error ? error.stack : '', FAULT_STACK_MAX);

    /*
     * `expiresAt` from the phone's clock, which the rule then checks against
     * its own — the window it allows is a day wider than FAULT_TTL_DAYS so
     * that an ordinary few-minutes-wrong clock is not a rejection, and far
     * narrower than a clock set to 2099.
     */
    const expiresAt = new Date(Date.now() + FAULT_TTL_DAYS * 24 * 60 * 60 * 1000);

    await addDoc(collection(getFirestore(), COLLECTIONS.faults), {
      message,
      stack,
      source,
      route: faultText(route, 200) || '/',
      platform: Platform.OS,
      version: VERSION,
      dev: __DEV__,
      at: serverTimestamp(),
      expiresAt,
    });

    return true;
  } catch (cause) {
    /*
     * The one place this file is allowed to be noisy, and only into the
     * console. If the write was refused, the likeliest reason is that
     * `firestore.rules`' `isFault` and `analytics/faults.ts` have drifted
     * apart, and that is worth seeing while developing.
     */
    console.warn('[faults] could not record a fault', cause);
    return false;
  }
}

/**
 * Catch what no error boundary can: throws outside React, and rejected
 * promises nobody awaited.
 *
 * ---------------------------------------------------------------------------
 * An error boundary only sees errors thrown *during rendering*. A failure in a
 * timer, in a native callback, or in a promise chain with no `.catch` never
 * touches React at all — on Android it is a red screen in development and a
 * silent nothing in production, and it is a large share of what actually goes
 * wrong in an app that talks to a network.
 *
 * `ErrorUtils` is React Native's own global handler and is not in its public
 * types, hence the shape below rather than a cast to `any`. The previous
 * handler is called afterwards in every case: it is the one that shows the red
 * screen in development and that reports to the platform in release, and
 * replacing it rather than wrapping it would trade one blindness for another.
 *
 * Returns a function that puts the previous handler back, which is what makes
 * this testable.
 * ---------------------------------------------------------------------------
 */
type GlobalErrorHandler = (error: unknown, isFatal?: boolean) => void;
type ErrorUtilsShape = {
  getGlobalHandler?: () => GlobalErrorHandler;
  setGlobalHandler?: (handler: GlobalErrorHandler) => void;
};

export function watchForFaults(route: () => string): () => void {
  const errorUtils = (globalThis as { ErrorUtils?: ErrorUtilsShape }).ErrorUtils;

  if (!errorUtils?.setGlobalHandler || !errorUtils.getGlobalHandler) {
    /*
     * Not an error. `ErrorUtils` is React Native's, so it is absent under a
     * plain Node test runner — which is exactly where the rest of this module
     * is unit-tested, and where there is no global handler to wrap.
     */
    return () => {};
  }

  const previous = errorUtils.getGlobalHandler();

  errorUtils.setGlobalHandler((error, isFatal) => {
    void reportFault(error, 'handler', route());
    previous?.(error, isFatal);
  });

  return () => errorUtils.setGlobalHandler?.(previous);
}
