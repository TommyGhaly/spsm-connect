/**
 * Making a photograph small enough to send, without ever refusing it.
 *
 * This is the mobile port of apps/website/src/lib/downscale.ts, and it follows
 * the same ladder for the same reason. Quoting that file's rationale: dropping
 * WebP quality from 82 to 62 is close to invisible on a photograph, and far
 * kinder than telling somebody their picture is too big.
 *
 * THE RULE, from packages/shared/src/gallery/submissionLimits.ts: **photographs
 * are never refused for size.** They are condensed. Only videos can be refused,
 * because a client cannot re-encode one. `PHOTO_CEILING_BYTES` is a script
 * guard, not a limit a real picture is expected to meet.
 *
 * Every number here comes from @spsm/shared rather than being written again, so
 * the browser and the phone cannot disagree about what "prepared" means.
 *
 * On EXIF: re-encoding drops it, so the GPS strip is a free side effect of the
 * resize below. Do NOT treat that as the guarantee — the server strip in
 * functions/src/galleries.ts is, and it is the one described as "the
 * load-bearing call in this pipeline". This is a courtesy that means a location
 * never leaves the phone in the first place, not the thing being relied on.
 */
import {
  MAX_FILES_PER_BATCH,
  PHOTO_BUDGET_BYTES,
  PHOTO_MAX_EDGE,
  PHOTO_QUALITY,
  maxBytesFor,
  mediaKindForContentType,
  type MediaKind,
} from '@spsm/shared';
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

export { MAX_FILES_PER_BATCH };

/**
 * The ladder, matching lib/downscale.ts rung for rung.
 *
 * Edge first, then quality — a smaller picture at a decent quality reads better
 * than a large one at a poor quality, so the last rung is the only one that
 * gives up resolution.
 */
const LADDER: readonly { edge: number; quality: number }[] = [
  { edge: PHOTO_MAX_EDGE, quality: PHOTO_QUALITY },
  { edge: PHOTO_MAX_EDGE, quality: 72 },
  { edge: PHOTO_MAX_EDGE, quality: 62 },
  { edge: 2048, quality: 62 },
];

export interface Condensed {
  /** A local file URI, ready to send. */
  uri: string;
  contentType: string;
  /** Exact bytes. The signed URL is pinned to this number, so it must be true. */
  byteSize: number;
  kind: MediaKind;
  /** The original's size, for the "we made this smaller" notice. */
  originalBytes: number;
}

function sizeOf(uri: string): number {
  return new File(uri).size ?? 0;
}

/**
 * Prepare one picked item for sending.
 *
 * Videos pass through untouched — there is no re-encode available here, which
 * is exactly why `VIDEO_MAX_BYTES` is the one real size limit on the site.
 * A video over the ceiling throws, and the message names the real number
 * because the person can actually act on it (trim the clip).
 */
export async function condense(
  uri: string,
  contentType: string,
  { isProgramAdmin = false }: { isProgramAdmin?: boolean } = {},
): Promise<Condensed> {
  const kind = mediaKindForContentType(contentType);
  if (!kind) throw new Error('That file is not a photograph or a video.');

  const originalBytes = sizeOf(uri);
  const ceiling = maxBytesFor(kind, isProgramAdmin);

  if (kind === 'video') {
    if (originalBytes > ceiling) {
      throw new Error(
        'That clip is too long to send. Videos cannot be made smaller on a phone — try trimming it first.',
      );
    }
    return { uri, contentType, byteSize: originalBytes, kind, originalBytes };
  }

  /*
   * A photograph already under budget still goes round the ladder once. That
   * looks wasteful and is deliberate: the re-encode is what drops the EXIF
   * block, and a small picture straight off a camera roll is exactly the case
   * where a GPS tag would otherwise sail through untouched.
   */
  let best: { uri: string; byteSize: number } | null = null;

  try {
    // The source's own dimensions, needed because `resize` bounds the axis you
    // name. Naming `width` alone would make a portrait photograph 2560 wide and
    // far taller — the opposite of a size limit.
    const source = await ImageManipulator.manipulate(uri).renderAsync();
    const longEdge = Math.max(source.width, source.height);

    for (const rung of LADDER) {
      /*
       * `withoutEnlargement` semantics, matching the web's Math.min(1, ...):
       * a picture already smaller than the target edge is re-encoded at its own
       * size rather than blown up, which would cost bytes to add nothing.
       */
      const scale = Math.min(1, rung.edge / longEdge);
      const width = Math.max(1, Math.round(source.width * scale));
      const height = Math.max(1, Math.round(source.height * scale));

      // A fresh context per rung: the chained API accumulates transformations,
      // so reusing one would resize an already-resized image.
      const image = await ImageManipulator.manipulate(uri).resize({ width, height }).renderAsync();
      const saved = await image.saveAsync({
        compress: rung.quality / 100,
        format: SaveFormat.WEBP,
      });

      const byteSize = sizeOf(saved.uri);
      best = { uri: saved.uri, byteSize };

      if (byteSize <= PHOTO_BUDGET_BYTES) break;
    }
  } catch {
    // Fall through to the original. See below.
  }

  /*
   * The worst case is the original file handed straight back — a working upload
   * rather than a lost photograph, which is the promise lib/downscale.ts makes
   * in its own header ("Always resolves"). The server transcode will still
   * rotate it and strip its metadata, so nothing about the result is unsafe;
   * it just costs more bandwidth than it should have.
   */
  if (!best) {
    return { uri, contentType, byteSize: originalBytes, kind, originalBytes };
  }

  return {
    uri: best.uri,
    contentType: 'image/webp',
    byteSize: best.byteSize,
    kind,
    originalBytes,
  };
}
