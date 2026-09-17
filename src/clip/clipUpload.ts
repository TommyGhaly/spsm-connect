/**
 * Sending one photograph, without the queue.
 *
 * ---------------------------------------------------------------------------
 * The full app never uploads directly: `upload/pick.ts` writes a row into an
 * SQLite queue and `upload/uploader.ts` drains it, which is what makes a batch
 * of sixty survive the app being closed halfway through.
 *
 * **An App Clip has neither half of that.** `expo-sqlite` is in the clip's
 * `excludedPackages` — a durable queue is meaningless in a process whose
 * storage iOS clears without warning — and background execution, which is what
 * would drain it later, is something a clip may not do at all. So the clip
 * sends in the foreground, one photograph, while somebody is looking at it.
 *
 * That is not a lesser version of the queue; it is the honest shape of the
 * errand. A tag by a door is one photograph, taken and sent before the phone
 * goes back in a pocket.
 *
 * ## The contract is the app's, unchanged
 *
 * Mint a reservation from `galleryUploadUrl`, then PUT the bytes straight to
 * Google Cloud Storage with **both** pinned headers. From
 * `functions/src/galleries/uploadUrl.ts`: the signed URL is pinned to one
 * object name, one content type, and — through `extensionHeaders` — an exact
 * content length. Get either header wrong and GCS refuses the PUT, and because
 * the refusal comes from storage.googleapis.com rather than the Function, there
 * is no Function log to explain it. `upload/uploader.ts` carries the long-form
 * version of this note; keep the two in step.
 * ---------------------------------------------------------------------------
 */
import { File, UploadTask, UploadType } from 'expo-file-system';

import { apiPost } from '@/api/client';
import { condense } from '@/upload/condense';
import { explainUploadFailure, UploadFailure } from '@/upload/errors';

/** What `galleryUploadUrl` answers with. The clip reads two of its fields. */
interface Reservation {
  uploadUrl: string;
  mediaId: string;
  contentType: string;
}

export interface ClipDestination {
  programId: string;
  programEventId: string;
}

/**
 * Condense a capture and send it.
 *
 * Condensing is not an optimisation to be skipped for one file: the re-encode
 * is what drops the EXIF block, and a photograph taken in a church should not
 * arrive carrying the coordinates it was taken at. It also keeps the upload
 * inside a size a phone on church wifi can finish while its owner waits.
 *
 * `onProgress` is fractional, 0 to 1, and is the only thing standing between
 * somebody and a screen that looks stuck.
 */
export async function sendOnePhotograph(
  uri: string,
  contentType: string,
  destination: ClipDestination,
  onProgress: (fraction: number) => void,
): Promise<{ mediaId: string }> {
  const condensed = await condense(uri, contentType);

  const reservation = await apiPost<Reservation>('/api/gallery/upload-url', {
    programId: destination.programId,
    programEventId: destination.programEventId,
    contentType: condensed.contentType,
    byteSize: condensed.byteSize,
  });

  const task = new UploadTask(new File(condensed.uri), reservation.uploadUrl, {
    httpMethod: 'PUT',
    uploadType: UploadType.BINARY_CONTENT,
    headers: {
      'Content-Type': reservation.contentType,
      'x-goog-content-length-range': `${condensed.byteSize},${condensed.byteSize}`,
    },
    /*
     * Foreground, unlike the app's background session. A clip that is no longer
     * on screen is a clip iOS may terminate at any moment, and a transfer that
     * outlives it has nothing to report to and no queue to be retried from.
     * Holding the person here until it lands is the truthful arrangement.
     */
    sessionType: 'foreground',
    onProgress: ({ bytesSent }) => {
      onProgress(condensed.byteSize > 0 ? Math.min(1, bytesSent / condensed.byteSize) : 0);
    },
  });

  const result = await task.uploadAsync();

  // A non-2xx resolves rather than throwing, so it has to be checked by hand.
  // GCS answers XML, and its text is not for somebody using the app.
  if (result.status < 200 || result.status >= 300) {
    throw new UploadFailure(result.status, explainUploadFailure(result.status, result.body));
  }

  return { mediaId: reservation.mediaId };
}
