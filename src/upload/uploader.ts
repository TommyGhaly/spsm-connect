/**
 * The send loop.
 *
 * Reads from the SQLite queue, mints one reservation per file immediately
 * before sending that file, and PUTs the bytes straight to Google Cloud
 * Storage. Sequential, one at a time, exactly as the website does it.
 *
 * THE CONTRACT, from functions/src/galleries/uploadUrl.ts. The signed URL is
 * pinned three ways — to one object name, to one content type, and through
 * `extensionHeaders` to an exact content length. That last pin is why the
 * `x-goog-content-length-range` header below is not optional decoration:
 *
 *   > Without the last of these the URL would be a five-minute licence to
 *   > upload a file of any size, which would make every check above decorative.
 *
 * Get either header wrong and GCS refuses the PUT — and because the refusal
 * comes from storage.googleapis.com rather than the Function, there will be no
 * Function log to explain it.
 */
import { submissionObjectPath } from '@spsm/shared';
import { File, UploadTask, UploadType } from 'expo-file-system';

import { ApiError, apiPost } from '@/api/client';

import { explainUploadFailure, UNATTESTED, UploadFailure } from './errors';
import {
  markDone,
  markFailed,
  nextReady,
  recordProgress,
  saveReservation,
  type QueueRow,
} from './queue';

/** What `galleryUploadUrl` answers with. */
interface Reservation {
  uploadUrl: string;
  mediaId: string;
  sourcePath: string;
  contentType: string;
  expiresAt: number;
}

/**
 * Ask for an upload slot.
 *
 * The Function writes the whole galleryMedia document before it signs anything
 * — "so nothing hands out an upload slot for a submission that then fails to
 * record" — which is why a reservation is worth persisting and a failed send is
 * worth retrying rather than starting over.
 */
async function mint(row: QueueRow): Promise<Reservation> {
  try {
    return await apiPost<Reservation>('/api/gallery/upload-url', {
      programId: row.programId,
      programEventId: row.programEventId,
      contentType: row.contentType,
      byteSize: row.byteSize,
    });
  } catch (error) {
    /*
     * `unattested`, translated. This was the one refusal in the feature that
     * reached the uploads screen as a machine code — the Function answers
     * `{"error":"unattested"}`, `apiPost` prefers a Function's own words to
     * anything invented, and the row therefore read "Did not send —
     * unattested". Which is worse than useless: every send fails, the queue
     * fills, and the only thing on screen to explain it is a word nobody
     * outside this repository has ever seen.
     *
     * `errors.ts` has had the sentence for this all along and had no caller
     * for it. This is the caller. It is the only code this maps, because it
     * is the only one the endpoint states as a code rather than as a sentence
     * written to be read.
     */
    if (error instanceof ApiError && error.status === 401 && error.code === 'unattested') {
      throw new UploadFailure(401, UNATTESTED);
    }
    throw error;
  }
}

async function send(row: QueueRow, reservation: Reservation): Promise<void> {
  const file = new File(row.localUri);

  /*
   * A last look at the size on disk. The reservation was signed for exactly the
   * number the queue recorded at condense time; if the file has changed since,
   * the PUT is going to be refused by GCS with an opaque error, and saying so
   * here is far kinder than letting that happen.
   */
  const actual = file.size ?? 0;
  if (actual !== row.byteSize) {
    throw new Error('That photograph changed on disk before it could be sent. Please pick it again.');
  }

  const task = new UploadTask(file, reservation.uploadUrl, {
    httpMethod: 'PUT',
    uploadType: UploadType.BINARY_CONTENT,
    headers: {
      'Content-Type': reservation.contentType,
      'x-goog-content-length-range': `${row.byteSize},${row.byteSize}`,
    },
    /*
     * iOS hands the transfer to NSURLSession's background session, so it keeps
     * going when the app is suspended. Note what that does NOT cover: if the app
     * is terminated the JS task is gone, promise and progress with it. That is
     * the whole reason the queue is on disk — on relaunch this loop picks the
     * row up again and re-mints if the reservation went stale.
     */
    sessionType: 'background',
    onProgress: ({ bytesSent }) => {
      void recordProgress(row.id, bytesSent);
    },
  });

  const result = await task.uploadAsync();

  /*
   * A non-2xx resolves rather than throwing, so it has to be checked by hand.
   * GCS answers XML here, not JSON, and its text is not for somebody using the app —
   * explainUploadFailure turns the status into words worth reading.
   */
  if (result.status < 200 || result.status >= 300) {
    throw new UploadFailure(result.status, explainUploadFailure(result.status, result.body));
  }
}

let running = false;

/**
 * Drain the queue.
 *
 * Safe to call repeatedly and from several places — a screen mounting, the app
 * coming back to the foreground, a background task waking up. The guard makes
 * every call after the first a no-op rather than a second concurrent drain.
 */
export async function drainQueue(): Promise<void> {
  if (running) return;
  running = true;

  try {
    for (;;) {
      // Re-read each time: this clears a stale reservation as a side effect,
      // and picks up anything enqueued while the previous file was in flight.
      const row = await nextReady();
      if (!row) break;

      try {
        let reservation: Reservation;
        if (row.uploadUrl && row.mediaId) {
          // Still fresh — reuse it rather than writing a second galleryMedia
          // document for a photograph that already has one.
          reservation = {
            uploadUrl: row.uploadUrl,
            mediaId: row.mediaId,
            sourcePath: submissionObjectPath(row.programEventId, row.mediaId, row.contentType),
            contentType: row.contentType,
            expiresAt: 0,
          };
        } else {
          reservation = await mint(row);
          await saveReservation(row.id, {
            mediaId: reservation.mediaId,
            uploadUrl: reservation.uploadUrl,
          });
        }

        await send(row, reservation);
        await markDone(row.id);
      } catch (error) {
        /*
         * One failure stops this file, not the batch. Somebody emptying a
         * camp's worth of photographs should not lose the other fifty-nine
         * because one of them was a screenshot in a format nobody expected.
         */
        await markFailed(
          row.id,
          error instanceof Error ? error.message : 'That upload failed.',
          statusOf(error),
        );
      }
    }
  } finally {
    running = false;
  }
}

export function isDraining(): boolean {
  return running;
}

/**
 * The HTTP status behind a failure, or null when there was not one.
 *
 * Two shapes reach the catch above and both carry a status: `ApiError` from
 * `mint()` (the Function refused the reservation) and `UploadFailure` from
 * `send()` (the bucket refused the bytes). Everything else — a disk read that
 * failed, a file that vanished between picking and sending — has no status at
 * all, and null is the honest answer rather than a made-up 500. The queue reads
 * null as "worth another try", which is right: those are the transient ones.
 */
function statusOf(error: unknown): number | null {
  if (error instanceof UploadFailure) return error.status;
  if (error instanceof ApiError) return error.status;
  return null;
}
