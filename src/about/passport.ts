/**
 * The digital version of the passport card.
 *
 * ---------------------------------------------------------------------------
 * The in-person tour hands out a card that collects a stamp at each of the six
 * stations, and a full card is worth two dollars off a dessert. This is that,
 * on the phone — a port of the website's `features/tour/passport.ts`, with
 * `AsyncStorage` where that has `localStorage`.
 *
 * **No account, no write, nothing leaves the phone.** That is not a shortcut —
 * it is the only version of this feature worth building. The visitors are
 * members of the public at a festival, many of them children; the church has
 * no reason to hold a record of who walked which station, and asking a
 * stranger to sign in to collect a sticker would empty the hall. Storage on
 * the device means the reward is on the honour system, exactly as a paper card
 * is: someone determined to get two dollars off a dessert can delete the app,
 * and they could also have drawn six stamps on a card with a pen.
 *
 * **The one thing this app has that the website does not is durability.** The
 * web version's stated cost is that a visitor who switches from Safari to
 * Chrome, or opens a private window, starts over. `AsyncStorage` survives both
 * — and survives the phone going to sleep in a pocket between stations, which
 * is the case that actually happens in a hall.
 *
 * `AsyncStorage` is already a dependency here (the upload queue and the
 * session both use it), so this costs nothing to add.
 * ---------------------------------------------------------------------------
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';

import { STATIONS } from './tour';

/**
 * Versioned, so the shape can change without reading somebody's stale array as
 * if it were the current one. Deliberately the website's key with an `app`
 * segment rather than the same string: the two stores are separate anyway, and
 * a shared-looking key would suggest they sync.
 */
const KEY = 'spsm.app.tour.passport.v1';

async function read(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    /*
     * Filter against the real station list rather than trusting what is in
     * storage: a renamed station would otherwise leave a stamp that counts
     * toward the six but matches nothing on screen, and the passport would
     * read "6 of 6" with a station still blank.
     */
    const known = new Set(STATIONS.map((station) => station.id));
    return parsed.filter((id): id is string => typeof id === 'string' && known.has(id));
  } catch {
    // Unreadable storage must not take the screen down with it. An empty
    // passport is a working passport.
    return [];
  }
}

export type Passport = {
  /** The stations stamped so far. Empty until storage has been read. */
  stamped: ReadonlySet<string>;
  /**
   * Whether storage has been consulted yet. The count and the reward wait on
   * this, so a returning visitor does not see "0 of 6" for a frame before
   * their four stamps land.
   */
  ready: boolean;
  stamp: (id: string) => void;
  reset: () => void;
  /**
   * Bumped by every `reset`. The scroll tripwire watches it, because clearing
   * the passport while looking at station 4 must not have station 4 stamp
   * itself again the same second — see `TourScreen`.
   */
  resetSeq: number;
  count: number;
  complete: boolean;
};

export function usePassport(): Passport {
  const [stamped, setStamped] = useState<ReadonlySet<string>>(() => new Set());
  const [ready, setReady] = useState(false);
  const [resetSeq, setResetSeq] = useState(0);
  // Guards a write landing after the screen has gone, which RN warns about and
  // which would be a set on an unmounted component.
  const live = useRef(true);

  useEffect(() => {
    live.current = true;
    void (async () => {
      const saved = await read();
      if (!live.current) return;
      setStamped(new Set(saved));
      setReady(true);
    })();
    return () => {
      live.current = false;
    };
  }, []);

  const save = useCallback((next: ReadonlySet<string>) => {
    // Fire and forget. A failed write costs this visit's passport on the next
    // launch and nothing else; making the caller await it would make a stamp
    // feel slow for no gain the visitor can perceive.
    void AsyncStorage.setItem(KEY, JSON.stringify([...next])).catch(() => {
      /* Out of space, or storage denied. The passport still works this visit. */
    });
  }, []);

  const stamp = useCallback(
    (id: string) => {
      /*
       * A functional update, not `stamped` from the closure. Two stations
       * scrolled past in one frame is an ordinary thing on a phone, and read
       * the state directly and the second stamp overwrites the first.
       */
      setStamped((current) => {
        if (current.has(id)) return current;
        const next = new Set(current).add(id);
        save(next);
        return next;
      });
    },
    [save],
  );

  const reset = useCallback(() => {
    const empty = new Set<string>();
    setStamped(empty);
    save(empty);
    setResetSeq((seq) => seq + 1);
  }, [save]);

  return {
    stamped,
    ready,
    stamp,
    reset,
    resetSeq,
    count: stamped.size,
    complete: ready && stamped.size === STATIONS.length,
  };
}
