/**
 * Turning a refusal into words worth reading.
 *
 * The port of apps/website/src/lib/storageErrors.ts, and it carries that file's
 * central warning: **never surface a raw 401.** On the web a 401 means an App
 * Check failure at least as often as a lapsed session, so "please authenticate"
 * sends people to fix the one thing that is not wrong. On a phone it is worse,
 * because the remedy is different again — App Attest or Play Integrity refused
 * to vouch for this build, and there is nothing the person holding it can do.
 *
 * The Functions in this project write their refusals to be shown verbatim.
 * Where one has spoken, prefer its words to anything invented here.
 */

/**
 * The message for an `unattested` 401.
 *
 * The web's version talks about privacy blockers and old browsers, which is
 * right there and meaningless here. Attestation on a phone fails for reasons
 * the user cannot act on — a simulator, a build signed with the wrong team, a
 * debug token that was never registered — so this says so plainly rather than
 * suggesting a remedy that does not exist.
 */
export const UNATTESTED =
  'This copy of the app could not prove it is genuine, so the church cannot accept photographs from it. ' +
  'If you installed it from the App Store or Google Play, please report this — it is not something you can fix.';

/**
 * Explain a failed PUT to Cloud Storage.
 *
 * These come from storage.googleapis.com rather than from a Function, so there
 * is no `{ error }` to quote and no Function log to read afterwards. The status
 * is nearly all there is to go on; the body is XML written for a developer.
 */
export function explainUploadFailure(status: number, _body?: string): string {
  switch (status) {
    case 400:
      /*
       * Very often the content-length pin. The signed URL carries
       * `x-goog-content-length-range: N,N` and GCS rejects a body that is not
       * exactly N bytes — which in practice means the file changed between
       * being measured and being sent.
       */
      return 'That photograph changed while it was being sent. Please try it again.';
    case 401:
    case 403:
      // The five-minute window closed, or the URL was signed for another object.
      return 'That upload slot expired before the photograph finished sending. Please try it again.';
    case 408:
    case 504:
      return 'The connection was too slow to finish sending that photograph. Please try again on a better signal.';
    case 429:
      return 'The church is receiving a great many photographs just now. Please try again in a few minutes.';
    default:
      if (status >= 500) {
        return 'Something went wrong at the other end while sending that photograph. Please try it again.';
      }
      return 'That photograph could not be sent. Please try it again.';
  }
}

/**
 * Whether a failure is worth offering a retry for.
 *
 * A 413 is not: the clip really is too big and trying again changes nothing.
 * A 429 is, but not immediately — that one is a daily cap, and the Function's
 * own message already says "tomorrow".
 */
export function worthRetrying(status: number): boolean {
  if (status === 413) return false;
  if (status === 409) return false; // The gallery stopped taking photographs.
  return true;
}

/**
 * A failed send, carrying the status that caused it.
 *
 * Added when `worthRetrying` above turned out to have no caller. It could not
 * have one: `uploader.ts` threw a bare `Error` holding only the sentence from
 * `explainUploadFailure`, so by the time a row reached the queue the status was
 * gone and nothing downstream could tell "too large, and will be next time"
 * from "the network dropped". The retry button was therefore offered for every
 * failure including the two that can never succeed.
 *
 * The message stays the human-readable one — this only preserves the
 * number beside it.
 */
export class UploadFailure extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'UploadFailure';
    this.status = status;
  }
}
