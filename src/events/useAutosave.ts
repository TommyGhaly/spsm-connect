/**
 * Write a value a moment after it stops changing, and say so.
 *
 * A port of the website's `features/events/useAutosave.ts`. The event editor
 * has no Save button — typing is the save — and that only works if two things
 * are true: a write can never be lost by leaving the screen, and the person can
 * always tell which of the two states they are in. Both are this hook's job,
 * which is why the status is as much of its output as the writing is.
 *
 * ## Why the comparison is a serialisation
 *
 * `value` is a form object rebuilt on every keystroke, so referential equality
 * says "changed" always. The alternative — a dirty flag set by every `set()` —
 * is a flag that has to be cleared correctly in six places and is wrong the
 * first time somebody forgets one. `JSON.stringify` is a few microseconds on an
 * object this size and cannot drift out of step with the value it describes.
 *
 * ## What happens when a write is in flight
 *
 * Keystrokes during a save are not dropped and do not queue a write each:
 * `dirtyDuringSave` records that the value moved on, and one further write is
 * scheduled when the current one lands. Each write sends the whole document, so
 * the last one wins and the intermediate ones are worth nothing.
 *
 * ## Leaving
 *
 * Two exits, and a phone has a third the website does not. Pressing Done
 * flushes; unmounting flushes, which covers the back gesture and the drawer;
 * and `AppState` going inactive flushes, which covers the home button, a phone
 * call and the app switcher — the moments iOS may never hand control back
 * from. The website's `pagehide` is the same idea and was written for the same
 * case, a browser being backgrounded on a phone.
 *
 * The write a background flush starts may not finish. That is why the editor
 * says what state it is in rather than relying on this, and why `Done` is a
 * flush somebody can watch land.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

export type AutosaveState =
  /** Everything typed has been written. */
  | { kind: 'clean' }
  /** Typed, waiting for the pause. */
  | { kind: 'pending' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: number }
  /**
   * There is a change and it cannot be written yet — the form does not
   * currently describe a saveable event. Said out loud rather than looking
   * clean, because "your typing is safe" is the promise this hook makes.
   */
  | { kind: 'held'; why: string }
  | { kind: 'error'; message: string };

export interface Autosave<T> {
  state: AutosaveState;
  /** True when there is anything not yet written. */
  dirty: boolean;
  /** Write now, and wait for it. */
  flush: () => Promise<void>;
  /**
   * Declare this value already written, without writing it.
   *
   * For the moment the editor replaces the form with something it has just
   * read, or with a photograph it has just saved by another path. Without it
   * the hook sees a form that differs from its record, concludes somebody
   * typed, and writes back exactly what it was handed.
   *
   * Cancels the timer as well as recording the value, which is the half that is
   * easy to forget and is the actual bug.
   */
  markSaved: (value: T) => void;
}

export function useAutosave<T>({
  value,
  save,
  enabled,
  /**
   * Null when the value cannot be written, with the reason. The event editor
   * passes one while the date field is empty mid-retype.
   */
  hold = null,
  delay = 900,
}: {
  value: T;
  save: (value: T) => Promise<void>;
  enabled: boolean;
  hold?: string | null;
  delay?: number;
}): Autosave<T> {
  const [state, setState] = useState<AutosaveState>({ kind: 'clean' });
  const [dirty, setDirty] = useState(false);

  /** The serialisation of the last value successfully written. */
  const written = useRef<string>(JSON.stringify(value));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saving = useRef(false);
  const dirtyDuringSave = useRef(false);

  /*
   * Kept in refs so `flush` and the background handler are stable and always
   * see the current value rather than the one captured when they were made.
   *
   * Written in an effect rather than in the render body, which is where the
   * website's copy writes them. React Compiler is on in this app and refuses a
   * ref write during render — "Cannot update ref during render", and it is a
   * lint *error*, not advice — because a render may be discarded or re-run and
   * a ref mutated in one that never commits is a ref holding a value that was
   * never on screen.
   *
   * Nothing here is worse for the move. These refs are read from a timer, from
   * `AppState`, and from `flush` — all of them after a commit, by which point
   * this effect has run. No dependency array on purpose: every render is a
   * chance for one of the three to have changed.
   */
  const latest = useRef(value);
  const saveRef = useRef(save);
  const holdRef = useRef(hold);

  useEffect(() => {
    latest.current = value;
    saveRef.current = save;
    holdRef.current = hold;
  });

  /*
   * One pass over "is there anything to write, and may it be written".
   *
   * A loop rather than the recursive call the website's copy makes at the end
   * of its `finally`. React Compiler is on here and refuses to optimise a
   * `useCallback` whose body names itself — "Could not preserve existing
   * memoization", a lint error — and the recursion was only ever expressing
   * "go round again", which is what a loop says without the knot.
   */
  const write = useCallback(async () => {
    if (saving.current) {
      /*
       * Keystrokes during a save are not dropped and do not queue a write
       * each: this records that the value moved on, and the pass already
       * running goes round once more when it lands. Every write sends the
       * whole document, so the last one wins and the intermediate ones are
       * worth nothing.
       */
      dirtyDuringSave.current = true;
      return;
    }

    saving.current = true;
    try {
      for (;;) {
        dirtyDuringSave.current = false;

        const snapshot = latest.current;
        const serialised = JSON.stringify(snapshot);
        if (serialised === written.current) {
          setDirty(false);
          break;
        }

        const held = holdRef.current;
        if (held) {
          setState({ kind: 'held', why: held });
          break;
        }

        setState({ kind: 'saving' });
        await saveRef.current(snapshot);

        /*
         * The serialisation of the value that was *sent*, not of the current
         * one. Recording the current value would mark keystrokes made during
         * the write as already saved.
         */
        written.current = serialised;
        setState({ kind: 'saved', at: Date.now() });
        setDirty(JSON.stringify(latest.current) !== written.current);

        if (!dirtyDuringSave.current) break;
      }
    } catch (error) {
      setState({
        kind: 'error',
        message:
          error instanceof Error && error.message
            ? error.message
            : 'That could not be saved. What you typed is still on this screen.',
      });
    } finally {
      saving.current = false;
      dirtyDuringSave.current = false;
    }
  }, []);

  /* The debounce. */
  useEffect(() => {
    if (!enabled) return;

    const serialised = JSON.stringify(value);
    if (serialised === written.current) {
      setDirty(false);
      // Deliberately does not clear a `saved` state: "Saved" should stay
      // readable for a moment after the write, and this effect re-runs on every
      // render including the one that set it.
      setState((was) => (was.kind === 'pending' || was.kind === 'held' ? { kind: 'clean' } : was));
      return;
    }

    setDirty(true);
    setState(hold ? { kind: 'held', why: hold } : { kind: 'pending' });

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void write(), delay);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [value, enabled, hold, delay, write]);

  /* Being backgrounded, and — on unmount — leaving the screen. */
  useEffect(() => {
    if (!enabled) return;

    const leave = () => {
      if (timer.current) clearTimeout(timer.current);
      void write();
    };

    const subscription = AppState.addEventListener('change', (next) => {
      // `inactive` as well as `background`: on iOS it is the state during the
      // app-switcher swipe, and an app swiped away never sees `background`.
      if (next !== 'active') leave();
    });

    return () => {
      subscription.remove();
      /*
       * And on unmount, which is the ordinary case: leaving the editor unmounts
       * it, and a pause shorter than the debounce would otherwise lose the last
       * thing typed.
       */
      leave();
    };
  }, [enabled, write]);

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    await write();
  }, [write]);

  const markSaved = useCallback((saved: T) => {
    if (timer.current) clearTimeout(timer.current);
    written.current = JSON.stringify(saved);
    dirtyDuringSave.current = false;
    setDirty(false);
    setState({ kind: 'clean' });
  }, []);

  return { state, dirty, flush, markSaved };
}
