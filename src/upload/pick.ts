/**
 * Picking photographs and putting them in the queue.
 *
 * The step the whole upload subsystem was written for and did not have. It sits
 * between `expo-image-picker` and `queue.ts`, and its one real job is to run
 * every picked item through `condense()` **before** anything is enqueued, so
 * that the byte size stored on the row is the size that will actually be sent.
 * The signed URL is pinned to an exact length by
 * `x-goog-content-length-range: N,N`, so a row whose `byteSize` is a guess is a
 * row that 400s an hour later with nobody watching.
 *
 * ## One refusal, per item, and the batch still goes
 *
 * A person picks twelve things and one of them is a four-minute video. The
 * website's answer, and this one, is to send the eleven and say what happened
 * to the twelfth — not to refuse the batch. `condense()` throws for exactly two
 * reasons (an unsupported type, and a video over the ceiling), both of which
 * name a number the person can act on, so the message is passed through
 * verbatim rather than replaced with something vaguer.
 *
 * Photographs are never refused for size. The condense ladder drops quality
 * until it fits, and if it never fits it sends the best it managed — that is
 * `condense`'s decision, not this file's.
 */
import * as ImagePicker from 'expo-image-picker';
import { MAX_FILES_PER_BATCH } from '@spsm/shared';

import { syncDrainTask } from './backgroundDrain';
import { condense } from './condense';
import { enqueue } from './queue';
import { drainQueue } from './uploader';

/** Which node in the gallery tree these are being sent to. */
export interface SubmissionTargetRef {
  programId: string;
  programEventId: string;
}

export interface PickOptions extends SubmissionTargetRef {
  /**
   * Raises the video ceiling from `VIDEO_MAX_BYTES` to `ADMIN_MAX_BYTES`.
   *
   * Pass `mayAdminProgramEvent(grants, programId, programEventId)`. It was
   * defaulting to `false` for everybody, which quietly cost administrators the
   * higher limit the shared package goes to the trouble of defining.
   */
  isProgramAdmin: boolean;
}

export interface Refusal {
  /** The file name if the picker gave one, else a short description. */
  name: string;
  /** `condense`'s own words. Show them; they name the number to act on. */
  reason: string;
}

export interface PickOutcome {
  queued: number;
  refused: Refusal[];
  /** True when the person dismissed the picker without choosing. */
  cancelled: boolean;
}

const EMPTY: PickOutcome = { queued: 0, refused: [], cancelled: true };

/** Choose from the library. Multiple selection, capped at the batch limit. */
export async function pickAndQueue(options: PickOptions): Promise<PickOutcome> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    return {
      queued: 0,
      refused: [{ name: 'Photo library', reason: PERMISSION_REFUSED }],
      cancelled: false,
    };
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images', 'videos'],
    allowsMultipleSelection: true,
    selectionLimit: MAX_FILES_PER_BATCH,
    // Never `allowsEditing`. It forces a crop on iOS, and a parishioner who
    // wanted the whole photograph has no way back to it.
    quality: 1,
  });

  if (result.canceled) return EMPTY;
  return queueAssets(result.assets, options);
}

/** Take one now. The App Clip's path, and the one the door tag lands on. */
export async function captureAndQueue(options: PickOptions): Promise<PickOutcome> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    return {
      queued: 0,
      refused: [{ name: 'Camera', reason: PERMISSION_REFUSED }],
      cancelled: false,
    };
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images', 'videos'],
    quality: 1,
  });

  if (result.canceled) return EMPTY;
  return queueAssets(result.assets, options);
}

async function queueAssets(
  assets: readonly ImagePicker.ImagePickerAsset[],
  { programId, programEventId, isProgramAdmin }: PickOptions,
): Promise<PickOutcome> {
  const refused: Refusal[] = [];
  let queued = 0;

  for (const asset of assets) {
    const name = asset.fileName ?? (asset.type === 'video' ? 'A video' : 'A photograph');
    const contentType = contentTypeOf(asset);

    try {
      const condensed = await condense(asset.uri, contentType, { isProgramAdmin });
      await enqueue({
        localUri: condensed.uri,
        contentType: condensed.contentType,
        byteSize: condensed.byteSize,
        originalBytes: condensed.originalBytes,
        kind: condensed.kind,
        programId,
        programEventId,
      });
      queued += 1;
    } catch (error) {
      refused.push({ name, reason: messageOf(error) });
    }
  }

  if (queued > 0) {
    await syncDrainTask();
    /*
     * Not awaited. A drain is a sequence of network round trips and the person
     * is standing in front of the picker waiting to be told what happened;
     * every row is already durable in SQLite, so nothing is lost by letting
     * this run behind the screen that reports the outcome.
     */
    void drainQueue();
  }

  return { queued, refused, cancelled: false };
}

/**
 * A content type for an asset the picker may not have typed.
 *
 * `mimeType` is usually present and is preferred whenever it is. The fallback
 * matters on Android, where a picked item can arrive with none at all, and it
 * has to be a *specific* type rather than `image/*`: `submissionObjectPath` in
 * the shared package derives the stored file's extension from this string, and
 * the signed URL's `Content-Type` must match the header the PUT sends.
 */
function contentTypeOf(asset: ImagePicker.ImagePickerAsset): string {
  if (asset.mimeType) return asset.mimeType;
  return asset.type === 'video' ? 'video/mp4' : 'image/jpeg';
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'That file could not be prepared.';
}

const PERMISSION_REFUSED =
  'SPSM Connect has not been given access. You can grant it in Settings, under SPSM Connect.';
