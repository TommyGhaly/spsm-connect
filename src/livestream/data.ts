/**
 * What `/api/live` answers, and how many of the past services to keep.
 *
 * ---------------------------------------------------------------------------
 * ## Why the archive is read from an endpoint here and from a file on the web
 *
 * The website lists past streams out of `archive.json` — a snapshot committed
 * in `apps/website`, refreshed daily by a GitHub Action. Its own `data.ts`
 * argues that at length and the argument is right *for a static export*: every
 * build used to read the channel feed, thirteen requests a time, and that
 * earned a rate limit which failed silently — the build succeeded, the page
 * rendered, and the archive was simply empty.
 *
 * None of that carries over, and one thing about it inverts. A committed
 * snapshot is refreshed by a *deploy*, and this app's deploys go through an app
 * store review. The snapshot rotates completely in about eight days — the
 * church streams most days and twice on many — so a copy bundled into a build
 * would spend nearly all of its life listing liturgies that had already
 * scrolled off the website, and there would be no way to correct it without
 * shipping a binary.
 *
 * So the app reads the live channel through `/api/live`, which was extended to
 * return `recent` for exactly this. It costs nothing: that Function already
 * lists the channel's recent uploads and already asks `videos.list` about them
 * for the live check, and a YouTube quota unit is charged per method rather than
 * per part — see `videosListUrl` in `@spsm/shared`. Same two units a call, same
 * 30-second CDN cache in front of it.
 * ---------------------------------------------------------------------------
 */
import { apiGet } from '@/api/client';
import type { PastStream } from '@spsm/shared';

/**
 * How many past services the screen lists.
 *
 * **Six, where the website shows twelve**, and the difference is the screen
 * rather than the data. Twelve wide thumbnails under a 16:9 player is a page
 * somebody scrolls through rather than reads, on a phone where the player is
 * the thing they came for — and because the church streams most days and twice
 * on many, six still reaches back three or four days. That is the span a reader
 * is actually looking for: the liturgy they missed this morning, or the vespers
 * they missed last night. Anything older they would go to the channel for, and
 * the link at the foot of the list takes them there.
 */
export const MAX_STREAMS = 6;

/** `/api/live`'s answer. `recent` is newest first and excludes the live one. */
export interface LiveRead {
  live: boolean;
  videoId: string | null;
  recent: PastStream[];
}

/**
 * Ask the church's endpoint what is on, and what was.
 *
 * **Throws on anything that is not a readable 200**, and the caller must treat
 * that as "we could not find out" rather than "there is no service". The two
 * are different answers and the screen says different things for them: a failed
 * lookup during a liturgy must not tell somebody homebound there is
 * nothing to watch. `apiGet` already throws `ApiError` for a non-2xx, which is
 * the behaviour this relies on.
 *
 * `recent` is defended rather than trusted, even though it comes from our own
 * Function. A phone can be running against an older deployment of it — the one
 * that answered `{ live, videoId }` and nothing else — and an app that read
 * `undefined.length` on a stale backend would crash on the one screen that most
 * needs to keep working.
 */
export async function readLive(): Promise<LiveRead> {
  const body = await apiGet<{
    live?: unknown;
    videoId?: unknown;
    recent?: unknown;
  }>('/api/live');

  return {
    live: body.live === true,
    videoId: typeof body.videoId === 'string' && body.videoId !== '' ? body.videoId : null,
    recent: Array.isArray(body.recent) ? body.recent.filter(isPastStream) : [],
  };
}

/**
 * Whether one entry is usable.
 *
 * A row needs a video id to link to and a date to be listed under — the list's
 * whole organising principle is the date, so an entry without one has nowhere
 * to go. A missing thumbnail is fine and draws a placeholder; see `Stream`.
 */
function isPastStream(value: unknown): value is PastStream {
  const stream = value as PastStream | null;
  return (
    !!stream &&
    typeof stream.id === 'string' &&
    stream.id !== '' &&
    typeof stream.startedAt === 'string' &&
    !Number.isNaN(Date.parse(stream.startedAt))
  );
}
