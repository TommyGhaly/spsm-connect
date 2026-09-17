/**
 * Turning a gallery document into something `<Image>` can load.
 *
 * The app's half of the website's `features/programs/media.ts`, and it exists
 * for the reason that file gives at length: the bucket and the origin are
 * resolved in *one* place, because the last time they were not, the origin was
 * hardcoded to production and a site running entirely on emulators still
 * fetched every photograph from the church's real bucket.
 *
 * `posterUrlFor` and `videoUrlFor` themselves are `@spsm/shared` — they take a
 * bucket and an origin precisely so this app can supply its own. Nothing here
 * reimplements them; this only answers "which bucket, which origin" for a phone.
 *
 * ## Why there is no emulator branch
 *
 * The website's `storageOrigin()` swaps in `127.0.0.1:9199` when it is pointed
 * at the emulators. That address means "this device" on a phone, so the same
 * swap here would break rather than help, and a simulator that wants the
 * emulator suite can set `EXPO_PUBLIC_STORAGE_ORIGIN` to the host's LAN address.
 * Unset — which is every real install — it is production, from shared.
 */
import { FIREBASE_STORAGE_ORIGIN, posterUrlFor, videoUrlFor } from '@spsm/shared';

/** What `posterUrl`/`videoUrl` need of a document. Deliberately not `GalleryMedia`. */
export interface MediaLike {
  kind: string;
  renditionPath: string | null;
  posterPath: string | null;
}

/**
 * The church's bucket.
 *
 * Read through a helper rather than inline so the one `??` that decides what an
 * unset bucket means lives in one place. Empty rather than a throw: a missing
 * bucket makes every URL unloadable, which a gallery already has a state for
 * ("still processing"), and is a better outcome on somebody's phone than a
 * screen that crashes on a misconfigured build.
 */
function bucket(): string {
  return process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '';
}

function origin(): string {
  return process.env.EXPO_PUBLIC_STORAGE_ORIGIN ?? FIREBASE_STORAGE_ORIGIN;
}

/** What a grid cell shows: the photograph, or a video's poster frame. */
export function posterUrl(media: MediaLike): string | null {
  return posterUrlFor(bucket(), media, origin());
}

/** The clip itself. Null for a photograph, or a video still being transcoded. */
export function videoUrl(media: MediaLike): string | null {
  return videoUrlFor(bucket(), media, origin());
}

/**
 * A focal point as `expo-image`'s `contentPosition`.
 *
 * The shared `focalPosition()` returns the CSS string `object-position` wants,
 * which is the wrong shape here — RN takes an object — so this does the same
 * clamp and produces the object instead. It is the same fact in two dialects,
 * not a second opinion about where the focal point is.
 *
 * Why it matters at all: a cell has a fixed shape and a photograph does not, so
 * something gets cut, and cutting from the centre is how a group photograph
 * loses the people on the ends. The point an administrator set says what must
 * survive.
 */
export function focalContentPosition(
  focal: { x: number; y: number } | null | undefined,
): { left: `${number}%`; top: `${number}%` } {
  return {
    left: `${clamp01(focal?.x ?? 0.5) * 100}%`,
    top: `${clamp01(focal?.y ?? 0.5) * 100}%`,
  };
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.min(Math.max(value, 0), 1);
}
