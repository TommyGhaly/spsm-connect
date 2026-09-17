/**
 * Whether a liturgy is being streamed right now, and what was streamed before.
 *
 * The app's `features/livestream/useLiveStatus.ts`, with two changes forced by
 * the platform and one by the extra fact it carries.
 *
 * The platform changes are `AppState` in place of `document.visibilityState` —
 * a backgrounded app is the phone's version of a tab nobody is looking at, and
 * neither should spend the night polling somebody else's server — and a plain
 * `fetch` where the website needs Castr's CORS header, since a native request
 * is not CORS-bound.
 *
 * The extra fact is `recent`. The website has no equivalent because its archive
 * is a file read at build time; here it is read from the same endpoint as the
 * live check. See `data.ts` for why.
 */
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { isStreamOffline, type PastStream } from '@spsm/shared';

import { readLive } from './data';
import type { LiveProbe } from './config';

/**
 * Four states, and the two extra ones each earn their place.
 *
 * `checking` exists so the screen can render something that claims neither
 * while the probe is in flight. Collapsing it into `offline` would flash "no
 * live stream" at someone who opened the app mid-liturgy; into `live`, a black
 * player at everyone else.
 *
 * `unknown` means we asked and could not find out — distinct from `offline`,
 * which means we asked and the answer was no. The screen's response is to say
 * so and offer the way through to the channel, which is what keeps a YouTube
 * markup change or a lapsed API key from quietly hiding a liturgy.
 */
export type LiveStatus = 'checking' | 'live' | 'offline' | 'unknown';

export interface LiveState {
  status: LiveStatus;
  /** The live broadcast's video id, when the probe could name one. */
  videoId: string | null;
  /** Past services, newest first. Empty until the archive is read. */
  recent: PastStream[];
}

/** How often to re-check while the app is in front of somebody. */
const POLL_MS = 60_000;

/** Bounds the Castr probe. Unreachable is treated as live — see below. */
const TIMEOUT_MS = 8_000;

/**
 * Castr's page, or a rejection within `TIMEOUT_MS`.
 *
 * Hand-rolled rather than `AbortSignal.timeout`, which RN does not provide, and
 * an `AbortController` with a timer is the pattern the rest of this app already
 * uses — see `about/Film.tsx`.
 *
 * `calendar/data.ts` notes that an aborted `fetch` here rejects with a plain
 * `Error` whose name is not reliably `AbortError` across the Hermes builds this
 * app runs under, and declines to depend on telling one rejection from another.
 * Nothing below needs to. A timeout and a refusal are the same fact for this
 * probe — we could not read the page — and the caller's `catch` treats both the
 * way it must: Castr fails open, and the player stays.
 */
async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param probe where to read the status, or `null` when there is nothing that
 *   can be asked — which resolves to `live` immediately, so a stream with no
 *   probe behaves exactly as it would with no status check at all. Fail-open is
 *   the rule throughout this feature: wrongly hiding a live liturgy is the one
 *   failure it must not have.
 */
export function useLive(probe: LiveProbe | null): LiveState {
  const [state, setState] = useState<LiveState>({
    status: probe ? 'checking' : 'live',
    videoId: null,
    recent: [],
  });

  /*
   * Depended on rather than `probe` itself. The object is rebuilt on every
   * render by the screen above — `livestreamProbe` returns a fresh literal — so
   * using it as a dependency would restart both effects, and fire fresh
   * requests, on every render.
   */
  const kind = probe?.kind ?? null;
  const url = probe && probe.kind === 'castr' ? probe.url : null;

  /* ---- is it on -------------------------------------------------------- */

  useEffect(() => {
    if (!kind) return;

    // Guards a resolved probe from a previous run overwriting a newer one after
    // the screen unmounts or the settings change under it.
    let current = true;

    async function check() {
      try {
        if (kind === 'castr') {
          const response = await fetchWithTimeout(url!);
          if (!current) return;

          const offline = response.ok && isStreamOffline(await response.text());
          setState((previous) => ({
            ...previous,
            status: offline ? 'offline' : 'live',
            videoId: null,
          }));
          return;
        }

        const read = await readLive();
        if (!current) return;

        /*
         * The archive comes free with this answer, so it is taken here rather
         * than left to the effect below — which is why that effect sits out the
         * `youtube` case entirely. One request, both facts.
         */
        setState({
          status: read.live && read.videoId ? 'live' : 'offline',
          videoId: read.live ? read.videoId : null,
          recent: read.recent,
        });
      } catch {
        if (!current) return;
        /*
         * Unreachable, blocked, or timed out — and the right answer differs by
         * provider, which is the reason these two cases were never merged.
         *
         * Castr fails *open*: its own offline screen is a perfectly good
         * fallback, so showing the player costs a reader one glance at a
         * "Stream Offline" card during a quiet week. YouTube cannot do the
         * same, because putting a player on screen needs a video id and a
         * failed lookup has not got one — so it says it does not know, and the
         * screen offers the channel instead.
         */
        setState((previous) => ({
          ...previous,
          status: kind === 'castr' ? 'live' : 'unknown',
          videoId: null,
        }));
      }
    }

    void check();

    /*
     * Re-check while the screen is open, so somebody who arrives ten minutes
     * early sees the player appear when the liturgy starts rather than having
     * to know to close the app and come back.
     *
     * Only while the app is in the foreground, and a return to the foreground
     * gets an immediate check rather than waiting out the rest of its interval
     * — that is the moment the answer is most likely to have gone stale.
     */
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') void check();
    }, POLL_MS);

    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void check();
    });

    return () => {
      current = false;
      clearInterval(timer);
      subscription.remove();
    };
  }, [kind, url]);

  /* ---- what was on ----------------------------------------------------- */

  useEffect(() => {
    /*
     * Skipped for the YouTube probe, which already carries the archive in the
     * answer it polls for above. Not skipped when there is no probe at all:
     * `null` means the status cannot be asked, and it says nothing about
     * whether the channel has an archive worth listing.
     */
    if (kind === 'youtube') return;

    let current = true;

    async function read() {
      try {
        const { recent } = await readLive();
        if (current) setState((previous) => ({ ...previous, recent }));
      } catch {
        /*
         * No archive, and no word about it. An empty list renders no section at
         * all — see `PastStreams` — which is the honest outcome: the player is
         * what this screen is for, and "we could not list the recent services"
         * is not worth taking space above a liturgy to say.
         */
      }
    }

    void read();

    /*
     * Re-read on every return to the foreground, and on no timer at all. The
     * list changes when a service ends — once or twice a day — so polling it
     * every minute would spend a hundred requests on one change. Coming back to
     * the app is both the cheapest moment to refresh and the only one where a
     * stale list is in front of somebody.
     */
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void read();
    });

    return () => {
      current = false;
      subscription.remove();
    };
  }, [kind]);

  return state;
}
