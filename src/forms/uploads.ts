/**
 * Putting pictures into Storage — two paths, with opposite permissions.
 *
 * The website's `features/forms/uploads.ts`, and the split it names is the
 * whole design rather than an implementation detail:
 *
 *   forms/        world-readable. It is the picture on a public card, and only
 *                 somebody holding the `forms` grant may write one.
 *   formUploads/  readable by nobody but staff. It holds photographs members of
 *                 the public attach to a form, and a world-readable quarantine
 *                 would make every one of them findable by anyone who guessed a
 *                 path. No client may write it at all — see below.
 *
 * ## Why an attachment does not go through the Storage SDK
 *
 * `storage.rules` refuses every client create under `formUploads/`. That is not
 * an oversight to work around: App Check enforcement on the Storage *service*
 * had to be switched off on 2026-09-03 because it also refused every `<img>` on
 * the public site, and the anonymous create rule that had been standing behind
 * it went with it. `POST /api/forms/upload-url` replaced it, and can ask three
 * things a storage rule never could — is this a real client, how many has this
 * session sent today, and is the form still open.
 *
 * So an attachment is a signed URL and a PUT straight to Google Cloud Storage,
 * exactly as a gallery photograph is. `src/upload/uploader.ts` is the long-form
 * version of the same contract, and the note there about the two pinned headers
 * applies here unchanged: get either wrong and GCS refuses the PUT, with no
 * Function log to explain it because the Function is not in the path.
 *
 * ## Nothing here touches the Storage SDK, and that is load-bearing
 *
 * The two functions that do — the staff picture upload and the staff read of a
 * quarantined photograph — are in `pictures.ts`. They were in this file, and the
 * split is for the App Clip: `@react-native-firebase/storage` is in the clip's
 * `excludedPackages`, so importing it there is a crash on import, and this file
 * is reachable from a clip through the photograph field on a parish form.
 * Both of those functions are staff-only and no clip can reach them.
 *
 * So: **keep this file free of `@react-native-firebase/storage`.** Anything
 * needing it belongs next door.
 */
import { File, UploadTask, UploadType } from 'expo-file-system';
import { FORM_PHOTO_MAX_BYTES, toFormSlug } from '@spsm/shared';

import { ApiError, apiPost } from '@/api/client';
import { condense } from '@/upload/condense';

/** What a picked photograph is, whichever picker produced it. */
export interface PickedImage {
  uri: string;
  /** May be absent on Android; `condense` is given a specific type either way. */
  mimeType?: string | null;
  fileName?: string | null;
}

export type UploadOutcome = { ok: true; path: string } | { ok: false; reason: string };

/**
 * The one refusal with no self-service remedy, worded the way the website words
 * it. Shared verbatim with the gallery path: same fault, same cause, same fix.
 */
const UNATTESTED =
  'This copy of the app could not prove it is genuine, so the church server refused the ' +
  'photograph. Update SPSM Connect from the App Store, or try again on another network.';

/**
 * A photograph attached by whoever is filling in a form.
 *
 * Returns a **path**, never a URL, and that is not tidiness: `formUploads/` is
 * deliberately unreadable to the person who just wrote to it, so there is no
 * URL for them to be given. The submission records the path and the staff panel
 * resolves it with a staff token when somebody reviews it.
 *
 * Condensed first, through the same ladder a gallery photograph goes down. Two
 * things that buys, and the second is the one that matters here: a phone
 * photograph is several megabytes over church wifi, and the re-encode is what
 * drops the EXIF block — a stranger attaching a picture of their car should not
 * also be attaching the GPS coordinates it was taken at.
 */
export async function uploadFormPhoto(
  formSlug: string,
  picked: PickedImage,
): Promise<UploadOutcome> {
  const slug = toFormSlug(formSlug);
  if (!slug) return { ok: false, reason: 'This form cannot accept photographs.' };

  let prepared: { uri: string; contentType: string; byteSize: number };
  try {
    const condensed = await condense(picked.uri, contentTypeOf(picked));
    prepared = {
      uri: condensed.uri,
      contentType: condensed.contentType,
      byteSize: condensed.byteSize,
    };
  } catch (error) {
    // `condense` throws with words that name the number to act on. Pass them
    // through rather than replacing them with something vaguer.
    return { ok: false, reason: messageOf(error, 'That photograph could not be prepared.') };
  }

  /*
   * The polite half of the ceiling. The endpoint enforces it — this is the
   * enforcement's twin, and it exists so a refusal reads as a sentence about
   * the file rather than as a 400 from a server.
   */
  if (prepared.byteSize > FORM_PHOTO_MAX_BYTES) {
    return {
      ok: false,
      reason: `That photograph is ${Math.round(prepared.byteSize / 1024 / 1024)}MB, which is too large to send.`,
    };
  }

  let slot: { uploadUrl: string; path: string; downloadToken: string };
  try {
    slot = await apiPost('/api/forms/upload-url', {
      formSlug: slug,
      fileName: picked.fileName ?? 'photo.jpg',
      contentType: prepared.contentType,
      byteSize: prepared.byteSize,
    });
  } catch (error) {
    if (error instanceof ApiError && error.code === 'unattested') {
      return { ok: false, reason: UNATTESTED };
    }
    return { ok: false, reason: messageOf(error, 'That photograph could not be sent.') };
  }

  /*
   * All three headers were signed into the URL. The content type and the exact
   * length pin what may be sent; the download token is what makes the object
   * readable by the staff panel later. A mismatch on any of them is refused by
   * Cloud Storage rather than quietly accepted, so none is decoration.
   */
  const task = new UploadTask(new File(prepared.uri), slot.uploadUrl, {
    httpMethod: 'PUT',
    uploadType: UploadType.BINARY_CONTENT,
    headers: {
      'Content-Type': prepared.contentType,
      'x-goog-content-length-range': `${prepared.byteSize},${prepared.byteSize}`,
      'x-goog-meta-firebaseStorageDownloadTokens': slot.downloadToken,
    },
  });

  try {
    const result = await task.uploadAsync();
    if (result.status < 200 || result.status >= 300) {
      console.error('[forms] photo upload failed', result.status, result.body);
      return { ok: false, reason: 'That photograph could not be sent. Please try again.' };
    }
  } catch (error) {
    return { ok: false, reason: messageOf(error, 'That photograph could not be sent.') };
  }

  return { ok: true, path: slot.path };
}

/**
 * A content type for an asset the picker may not have typed.
 *
 * Specific rather than `image/*`, for the reason `src/upload/pick.ts` gives:
 * the signed URL's content type must match the header the PUT sends, and a
 * wildcard matches nothing.
 */
function contentTypeOf(picked: PickedImage): string {
  return picked.mimeType ?? 'image/jpeg';
}

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
