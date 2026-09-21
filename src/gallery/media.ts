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
import { FIREBASE_STORAGE_ORIGIN, mediaUrl, posterUrlFor, videoUrlFor } from '@spsm/shared';

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

/**
 * Any world-readable object in the bucket, by its path.
 *
 * The website's `lib/storage.ts` under a shorter name, and it lives here rather
 * than beside its caller for the reason this file's header gives: the bucket
 * and the origin are answered in one place, and the last time they were not, a
 * build pointed entirely at the emulators still fetched from the parish's real
 * bucket. An event's `heroImagePath` is the caller that made this general —
 * `posterUrl` above takes a gallery document and there is no document here,
 * only a path somebody typed into `events/{slug}/`.
 *
 * Null rather than a broken URL when the path is empty or the bucket is unset:
 * a missing photograph is a gap the page lays out around, and a broken image
 * looks like a fault in the app.
 *
 * Only for prefixes `storage.rules` makes world-readable — `events/`,
 * `clergy/`, `content/`, `products/`, `galleries/`. Pointed at `submissions/`
 * it produces a URL that 403s, which is the quarantine working.
 */
export function storageUrl(path: string | null | undefined): string | null {
  if (!path) return null;

  const name = path.replace(/^\/+/, '');
  const target = bucket();
  if (!target || !name) return null;

  return mediaUrl(target, name, origin());
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
