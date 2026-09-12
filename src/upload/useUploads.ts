/**
 * The queue, as a React value.
 *
 * SQLite has no change notification, and the writers are not all in this
 * process's control flow anyway — `uploader.ts` records progress from inside a
 * background URLSession callback, and the headless drain task writes rows with
 * no React tree mounted at all. So this polls. That is not a shortcut around a
 * subscription that exists; there is no subscription to be had.
 *
 * ## Why it is one self-rescheduling timer rather than `setInterval`
 *
 * Two things fall out of it, and the second is the reason.
 *
 * First, it polls **only while something is in flight**. Each pass decides
 * whether to book the next one, so a queue that has finished stops costing a
 * wake-up per second for the rest of the app's life; picking a photograph
 * starts it again.
 *
 * Second, every `setState` happens inside a timer callback rather than in an
 * effect body. That is the shape React actually asks for when synchronising
 * with an external store — an effect body that sets state synchronously causes
 * a cascading render, and the lint rule that says so is right here rather than
 * merely strict. The first read is booked with a zero delay for exactly this
 * reason: it runs immediately after the commit, not during it.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { syncDrainTask } from './backgroundDrain';
import {
  allRows,
  clearFinished as clearFinishedRows,
  remove as removeRow,
  retry as retryRow,
  retryAll as retryAllRows,
  type QueueRow,
} from './queue';
import { drainQueue, isDraining } from './uploader';

/** How often to re-read while work is outstanding. */
const POLL_MS = 900;

export interface Uploads {
  rows: QueueRow[];
  /** Rows still to send. What a badge would count. */
  outstanding: number;
  failed: number;
  draining: boolean;
  /** True until the first read returns; distinguishes "empty" from "not yet". */
  loading: boolean;
  retry: (id: string) => Promise<void>;
  retryAll: () => Promise<void>;
  remove: (id: string) => Promise<void>;
  clearFinished: () => Promise<void>;
  /** Start a drain now. Safe to call while one is running; it is guarded. */
  drainNow: () => Promise<void>;
}

export function useUploads(): Uploads {
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [draining, setDraining] = useState(false);

  /*
   * The way to ask for a read from outside the effect below.
   *
   * A ref rather than a `useCallback` because the loop has to be able to book
   * its own next pass — a memoised callback that names itself is a value
   * referring to its own identity, which is both a lint error and a real
   * hazard: every re-render makes a new one, and a timer booked by the old one
   * keeps the old one alive. A plain closure inside the effect can recurse
   * safely; this ref is only how `act` and the buttons reach it.
   */
  const pokeRef = useRef<() => void>(() => {});

  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    /** Read the table, then decide whether to book another pass. */
    async function tick(): Promise<void> {
      try {
        const next = await allRows();
        if (!live) return;

        setRows(next);
        setDraining(isDraining());

        const busy =
          isDraining() || next.some((row) => row.state === 'queued' || row.state === 'uploading');

        if (timer) clearTimeout(timer);
        /*
         * No timer at all when there is nothing to watch. The queue cannot
         * change again without something in this app calling `poke`, which
         * books one — so an idle app costs nothing here.
         */
        timer = busy ? setTimeout(() => void tick(), POLL_MS) : null;
      } catch {
        /*
         * The table is created on first open, so a read can only fail if the
         * database is genuinely unavailable. Keeping the rows already on screen
         * beats blanking a list somebody is watching — and no timer is booked,
         * so a broken database does not become a spin.
         */
      } finally {
        if (live) setLoading(false);
      }
    }

    function poke(): void {
      if (timer) clearTimeout(timer);
      // Zero, not immediate: this runs after the commit rather than during it.
      timer = setTimeout(() => void tick(), 0);
    }

    pokeRef.current = poke;
    poke();

    /*
     * Coming back to the foreground is the moment a stalled queue most needs a
     * push: the background task may never have run (it is unavailable on the
     * simulator and rationed on device), and a reservation may have gone stale
     * while the app was away — `nextReady()` drops those, so the drain that
     * follows mints a fresh URL rather than PUTting at a swept document.
     */
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      poke();
      void drainQueue().then(poke);
    });

    return () => {
      live = false;
      if (timer) clearTimeout(timer);
      subscription.remove();
      pokeRef.current = () => {};
    };
  }, []);

  const act = useCallback(async (action: () => Promise<void>): Promise<void> => {
    await action();
    await syncDrainTask();
    pokeRef.current();
  }, []);

  return {
    rows,
    outstanding: rows.filter((row) => row.state === 'queued' || row.state === 'uploading').length,
    failed: rows.filter((row) => row.state === 'failed').length,
    draining,
    loading,
    retry: (id) =>
      act(async () => {
        await retryRow(id);
        void drainQueue();
      }),
    retryAll: () =>
      act(async () => {
        await retryAllRows();
        void drainQueue();
      }),
    remove: (id) => act(() => removeRow(id)),
    clearFinished: () => act(() => clearFinishedRows()),
    drainNow: () => act(() => drainQueue()),
  };
}
