/**
 * A list whose rows are put in order by dragging them.
 *
 * Built for the form builder's questions, which is the one list in this app
 * whose order is the thing being authored rather than a consequence of
 * something else: a form is read top to bottom, so "which question comes third"
 * is a decision somebody makes and then changes their mind about four times.
 *
 * ## What it replaces, and why that had to go
 *
 * A pair of chevrons on every row. They are not wrong so much as they are
 * priced per press: moving the last question of eleven to the top is ten
 * presses, each one re-rendering the list under a thumb that has to find the
 * button again because the row it was attached to has moved. The website has a
 * mouse and can afford a long row of small controls; a phone cannot, and the
 * gesture a phone *does* have for "this goes there" is picking the thing up.
 *
 * ## The four problems a drag inside a scrolling page has
 *
 * Every one of these is the reason for a specific piece of this file, so they
 * are worth naming rather than discovering.
 *
 * **1. The page and the row both want the vertical drag.** A finger moving down
 * is either scrolling or carrying a question, and nothing about the movement
 * itself says which. Resolved by making the drag cost a deliberate act: it
 * activates only on the grip, and only after `HOLD_MS` of stillness —
 * `activateAfterLongPress`. A flick anywhere, grip included, still scrolls.
 *
 * **2. Once it has activated, the page must stop.** Gesture Handler hands the
 * drag to the pan, but the enclosing `ScrollView` has already begun and would
 * keep its momentum — the row would then travel at the sum of the two.
 * `Scroller.setEnabled` is what turns it off for the duration.
 *
 * **3. The row you want may be off the screen.** `MAX_FIELDS` is sixty. A drag
 * that can only reach what is currently visible cannot move question fifty to
 * the top, which is exactly the move somebody makes after building a form back
 * to front. The drag scrolls the page under itself when the finger nears an
 * edge — `EDGE` and `EDGE_SPEED` below.
 *
 * **4. Rows are not the same height.** The builder's cards expand in place, so
 * one row may be a line of text and its neighbour half a screen of inputs.
 * Every offset here is measured rather than assumed — `onLayout` per row — and
 * the caller is asked to collapse whatever is open when a drag begins, which
 * `onDragStart` exists for. Nobody is editing a question while carrying it.
 *
 * Problems 2 and 3 both need the page's scroller, and neither can be handed it
 * by this component's parent — see `useScroller` in `Surface.tsx` for why that
 * arrives by context.
 *
 * ## Dragging is not the only way
 *
 * A grip is a target you have to see and a gesture you have to be able to make,
 * which rules out VoiceOver and rules out anybody whose hands do not do a
 * steady quarter-second hold. The grip therefore carries `increment` and
 * `decrement` accessibility actions — "move up", "move down" — so the two
 * chevrons this replaces are still there for assistive technology, just not on
 * the screen. Deleting them outright is the version of this change that would
 * have been a regression rather than an improvement.
 */
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { Icon } from './Icon';
import { useScroller } from './Surface';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * How long the grip is held before the row comes up.
 *
 * Long enough that a scroll begun on the grip is still a scroll, short enough
 * that it does not feel like the row is stuck. 240ms is what the camera's
 * shutter uses to tell a tap from a hold (`HOLD_MS` in `Shutter.tsx`); the two
 * interactions are unrelated, but a phone should not have two different ideas
 * about how long a deliberate press lasts.
 */
const HOLD_MS = 240;

/** How close to the top or bottom of the page the finger gets before it scrolls. */
const EDGE = 96;

/** Points per frame at the very edge, tapering to nothing at `EDGE`. */
const EDGE_SPEED = 9;

/** How much the carried row swells, to say it is off the page. */
const LIFT = 1.03;

/**
 * How far down the grip sits from the top of its row.
 *
 * `Card`'s padding is `space.md` — 16 — and its first line of type starts
 * there. This lands the dots on that line rather than on the card's border.
 */
const GRIP_DROP = 18;

/** One row, as this component needs it. */
export interface ReorderRow {
  /**
   * Stable across a reorder.
   *
   * The index will not do. React reuses a row's state by key, so keying on
   * position means moving a question hands its open editor and its text cursor
   * to whatever question took its place.
   */
  key: string;
  /** What a screen reader calls it — "Your full name, Short text". */
  label: string;
  content: ReactNode;
}

export function Reorder({
  rows,
  onMove,
  onDragStart,
  gap,
}: {
  rows: readonly ReorderRow[];
  /**
   * Commit: the row at `from` belongs at `to`.
   *
   * Indices into `rows` as it was handed in, and `to` is where the row lands
   * *after* it has been taken out — which is what a `splice` out then a
   * `splice` in does, and the only reading under which "move the first row to
   * the end" is `to === rows.length - 1`.
   */
  onMove: (from: number, to: number) => void;
  /**
   * Called once as a row lifts, before anything moves.
   *
   * The builder collapses its open question here. Two reasons, and the second
   * is the load-bearing one: a half-screen of inputs is unpleasant to carry,
   * and a text input under a finger that is being dragged is a text input
   * fighting the drag for the gesture.
   */
  onDragStart?: (index: number) => void;
  gap?: number;
}) {
  const theme = useTheme();
  const scroller = useScroller();
  const viewport = useWindowDimensions();
  const space = gap ?? theme.space.sm;

  /*
   * Which row is in the air, where it has got to, and how tall it is.
   *
   * State, because the whole list re-renders around a lifted row — the gap
   * opens somewhere else and the row itself gains a shadow. Set only when the
   * *target* changes, which is a handful of times in a drag, rather than on
   * every frame of the finger.
   *
   * The height is carried here rather than read out of `layout` while
   * rendering, and that is correctness and not lint-appeasement: a ref read
   * during render is a value React has not been told about, so the gap would be
   * drawn from whatever the height happened to be at the last render. Written
   * from the gesture — where reading the ref is exactly right — it is always the
   * height as measured after `onDragStart` collapsed whatever was open.
   */
  const [held, setHeld] = useState<{
    index: number;
    target: number;
    height: number;
  } | null>(null);

  /*
   * Where the finger has taken the carried row. An `Animated.Value` and not
   * state, because it changes every frame and nothing in the tree depends on
   * what it is.
   *
   * `useMemo` rather than the usual `useRef(...).current`, because this value
   * *is* read while rendering — it goes into the carried row's `transform` —
   * and a ref read during render is the thing `react-hooks/refs` is right to
   * object to. A memo with no dependencies is as stable as a ref and is not a
   * ref, which is the honest description of what this is: one object, made
   * once, handed to the animation driver.
   */
  const lift = useMemo(() => new Animated.Value(0), []);

  /*
   * Everything the gesture needs that must not go through a render.
   *
   * Gesture Handler calls `onUpdate` at the display's refresh rate. Reading the
   * row heights out of state there would re-render this component sixty times a
   * second to move one view — and, worse, the callbacks would close over a
   * stale copy, because a gesture built once keeps the closures it was built
   * with (see the `useMemo` below).
   */
  const layout = useRef<{ heights: number[] }>({ heights: [] });
  const drag = useRef({
    index: -1,
    target: -1,
    /** How far the finger itself has moved since the lift. */
    fingerY: 0,
    /** How far the page has scrolled itself since, which counts as finger travel too. */
    scrolled: 0,
    /** The auto-scroll's frame timer, non-null only while it is running. */
    edge: null as ReturnType<typeof setInterval> | null,
  }).current;

  /**
   * Which index the carried row is over, from how far it has travelled.
   *
   * Measured against the *midpoints* of the rows it is passing rather than
   * their edges, which is what makes a row swap when it is half over its
   * neighbour instead of when it has cleared it completely. The alternative
   * feels like the list is reluctant.
   *
   * `space` is in the sums because the gap travels with the row. Leaving it out
   * puts every swap one gap late, and the error compounds over a long drag.
   */
  const targetFor = useCallback(
    (from: number, dy: number): number => {
      const { heights } = layout.current;
      if (heights.length === 0) return from;

      let target = from;

      if (dy > 0) {
        let travelled = 0;
        for (let next = from + 1; next < heights.length; next += 1) {
          const height = heights[next] ?? 0;
          travelled += height + space;
          if (dy < travelled - height / 2) break;
          target = next;
        }
      } else if (dy < 0) {
        let travelled = 0;
        for (let next = from - 1; next >= 0; next -= 1) {
          const height = heights[next] ?? 0;
          travelled += height + space;
          if (-dy < travelled - height / 2) break;
          target = next;
        }
      }

      return target;
    },
    [space],
  );

  /** Move the carried row and work out what it is now over. Shared by finger and edge. */
  const carryTo = useCallback(
    (dy: number) => {
      lift.setValue(dy);

      const target = targetFor(drag.index, dy);
      if (target !== drag.target) {
        drag.target = target;
        setHeld({
          index: drag.index,
          target,
          height: layout.current.heights[drag.index] ?? 0,
        });
      }
    },
    [drag, lift, targetFor],
  );

  const stopEdge = useCallback(() => {
    if (drag.edge === null) return;
    clearInterval(drag.edge);
    drag.edge = null;
  }, [drag]);

  /**
   * Scroll the page under the finger while it sits near an edge.
   *
   * A frame timer rather than something driven by the gesture, because the
   * finger asking for this has by definition stopped moving: there are no more
   * `onUpdate` calls to hang it off. Its own travel is added to `drag.scrolled`
   * so that the carried row stays under the finger and the target keeps
   * advancing as new rows arrive from the edge.
   *
   * `speed` is read afresh each frame from the ref rather than captured, so a
   * finger easing away from the edge slows down instead of having to lift and
   * land again.
   */
  const speedRef = useRef(0);
  const runEdge = useCallback(() => {
    if (drag.edge !== null) return;

    drag.edge = setInterval(() => {
      const view = scroller?.ref.current;
      if (!view || drag.index < 0) return;

      const from = scroller.offset.current;
      const to = Math.max(0, Math.min(from + speedRef.current, scroller.max.current));
      const moved = to - from;
      // Already against the end of the page. Nothing to do, and no reason to
      // stop the timer: the finger may still be asking, and the list may still
      // grow under it.
      if (moved === 0) return;

      /*
       * Written back here rather than waited for.
       *
       * `onScroll` will report this offset a frame or two later, and until it
       * does, a timer running at 16ms would read the *old* offset and compute
       * the same target again — scrolling by one step and then stalling.
       */
      scroller.offset.current = to;
      view.scrollTo({ y: to, animated: false });

      drag.scrolled += moved;
      carryTo(drag.scrolled + drag.fingerY);
    }, 16);
  }, [carryTo, drag, scroller]);

  /*
   * Every callback below reads and writes `drag` and `layout`, which is what a
   * ref is for: they are entered from a finger rather than from a render, and
   * nothing drawn is decided by them — the tree comes from `rows` and from
   * `held`, which is state.
   */
  const gestureFor = useCallback(
    (index: number) =>
      Gesture.Pan()
        .activateAfterLongPress(HOLD_MS)
        .runOnJS(true)
        .onStart(() => {
          drag.index = index;
          drag.target = index;
          drag.scrolled = 0;
          drag.fingerY = 0;
          lift.setValue(0);

          onDragStart?.(index);
          scroller?.setEnabled(false);
          setHeld({
            index,
            target: index,
            height: layout.current.heights[index] ?? 0,
          });
        })
        .onUpdate((event) => {
          if (drag.index < 0) return;

          drag.fingerY = event.translationY;
          carryTo(drag.fingerY + drag.scrolled);

          /*
           * The edge test is on where the *finger* is on the glass, not on how
           * far the row has travelled: the whole point of it is that the finger
           * has run out of screen.
           *
           * Against the window rather than against this list, and that is the
           * right frame even though the list is what scrolls. A list of sixty
           * questions is taller than the window, so it has no visible bottom to
           * be near — "the finger has nowhere left to go" is a fact about the
           * glass. It costs a zone that overlaps the header and the tab bar,
           * which a finger only reaches when it is already asking to scroll.
           */
          if (!scroller) return;

          const y = event.absoluteY;

          if (y < EDGE) {
            speedRef.current = -taper(EDGE - y);
            runEdge();
          } else if (y > viewport.height - EDGE) {
            speedRef.current = taper(y - (viewport.height - EDGE));
            runEdge();
          } else {
            stopEdge();
          }
        })
        .onFinalize(() => {
          stopEdge();

          const { index: from, target: to } = drag;
          drag.index = -1;
          drag.target = -1;

          if (from < 0) {
            // The hold never completed, so nothing was ever lifted. The page's
            // scrolling was not turned off either, but turning it back on is
            // cheap and being certain it is on is worth more than being tidy.
            scroller?.setEnabled(true);
            return;
          }

          /*
           * Settle first, commit second, and the order is the whole reason this
           * is not one line.
           *
           * Committing immediately re-renders the list with the row in its new
           * home while the row's own `translateY` still says "wherever the
           * finger left it" — so the row visibly jumps its own height and then
           * animates back. Animating it into the gap that is already open and
           * committing on arrival means the row is in the right place *before*
           * the list changes underneath it, so the commit changes nothing that
           * can be seen.
           */
          const { heights } = layout.current;
          let rest = 0;
          for (let step = from + 1; step <= to; step += 1) rest += (heights[step] ?? 0) + space;
          for (let step = to; step < from; step += 1) rest -= (heights[step] ?? 0) + space;

          Animated.timing(lift, {
            toValue: rest,
            duration: 160,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }).start(() => {
            lift.setValue(0);
            setHeld(null);
            scroller?.setEnabled(true);
            if (to !== from) onMove(from, to);
          });
        }),
    [carryTo, drag, lift, onDragStart, onMove, runEdge, scroller, space, stopEdge, viewport.height],
  );

  /*
   * One gesture per row, rebuilt only when the number of rows changes.
   *
   * Rebuilding a gesture while a finger is down is the hazard `Shutter.tsx`
   * documents, and a drag lasts seconds. `rows.length` rather than `rows`,
   * because the identity of the rows changes on every keystroke in an open
   * editor and none of these callbacks reads a row.
   */
  const gestures = useMemo(
    /*
     * The `refs` disable is the false positive `Shutter.tsx` documents in the
     * same words: `gestureFor` closes over `drag` and `layout`, so calling it
     * here looks to the rule like reading a ref during render. Nothing is read
     * — the closures are only entered from a finger, and what this returns is
     * one gesture object per row, not a value anything is drawn from.
     *
     * The `exhaustive-deps` disable is the deliberate `rows.length`; see above.
     */
    // eslint-disable-next-line react-hooks/refs
    () => rows.map((_, index) => gestureFor(index)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows.length, gestureFor],
  );

  return (
    <View style={{ gap: space }}>
      {rows.map((row, index) => {
        const carried = held?.index === index;

        /*
         * How far a row that is *not* being carried steps aside.
         *
         * Exactly one row's worth — the carried one's — and only for the rows
         * between where it was and where it is going. A row outside that span
         * does not move, because the carried row neither left nor arrived on
         * its side of the list.
         */
        let shift = 0;
        if (held && !carried) {
          const { index: from, target: to, height: mine } = held;
          if (index > from && index <= to) shift = -(mine + space);
          if (index >= to && index < from) shift = mine + space;
        }

        return (
          <Animated.View
            key={row.key}
            onLayout={(event) => {
              layout.current.heights[index] = event.nativeEvent.layout.height;
            }}
            style={{
              /* The carried row is drawn over its neighbours rather than
                 between them. Without this it slides *under* the row it is
                 passing, which reads as the list eating it. */
              zIndex: carried ? 2 : 1,
              transform: carried
                ? [{ translateY: lift }, { scale: LIFT }]
                : [{ translateY: shift }],
              /*
               * Native shadow properties rather than a theme token, because the
               * church's three shadows live under `web` in the theme document
               * and `resolveTheme` does not carry them into the resolved theme
               * this app reads. The colour is still the theme's.
               */
              shadowColor: theme.color.ink,
              shadowOffset: { width: 0, height: carried ? 10 : 0 },
              shadowOpacity: carried ? 0.22 : 0,
              shadowRadius: carried ? 18 : 0,
              // Android draws no shadow from the four properties above.
              elevation: carried ? 12 : 0,
            }}
          >
            {/*
              The detector is on the grip alone, and that is a correction.

              It wrapped the whole row first, on the argument that
              `activateAfterLongPress` made the rest of the row safe: a finger
              that lands on a card and *moves* has scrolled the page before the
              hold could complete. True, and it misses the case that is not a
              flick — a finger that lands anywhere on a card, rests for a
              quarter of a second, and then moves. That picks the card up, and
              resting a thumb before scrolling is something people do without
              meaning anything by it. Caught by driving the simulator: a plain
              swipe down the middle of a card reordered the list.

              So the grip is the only thing inside the detector. The lift and
              the shadow stay on the `Animated.View` above, which never needed
              to be the detector's child — what moves and what is held are two
              different questions.
            */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <GestureDetector gesture={gestures[index]!}>
                <Grip label={row.label} index={index} count={rows.length} onMove={onMove} />
              </GestureDetector>
              <View style={{ flex: 1 }}>{row.content}</View>
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}

/**
 * How fast the page scrolls, from how far past the edge line the finger is.
 *
 * Tapered rather than constant, so that resting a finger just inside the edge
 * creeps and pushing it to the very bottom of the glass moves properly. A
 * constant makes the only usable speed the fast one, and a fast one that starts
 * the instant the line is crossed makes the list feel yanked.
 */
function taper(past: number): number {
  return Math.min(1, past / EDGE) * EDGE_SPEED;
}

/**
 * The handle: six dots, and the two accessibility actions that are the
 * non-dragging way to do the same job.
 *
 * Its own component so the column keeps a fixed width whatever the row does,
 * and so the actions sit on the element a finger reaches for — a screen reader
 * announcing "reorder" and offering nothing to do about it is the failure this
 * is guarding against.
 */
function Grip({
  label,
  index,
  count,
  onMove,
}: {
  label: string;
  index: number;
  count: number;
  onMove: (from: number, to: number) => void;
}) {
  const theme = useTheme();

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={`Reorder ${label}`}
      accessibilityHint={`Position ${index + 1} of ${count}. Swipe up or down to move it, or hold and drag.`}
      accessibilityActions={[
        { name: 'increment', label: 'Move up' },
        { name: 'decrement', label: 'Move down' },
      ]}
      onAccessibilityAction={(event) => {
        /*
         * `increment` is *up*, which is backwards from the index and forwards
         * from the list. VoiceOver's swipe-up means "more", and what somebody
         * means by more of a question's position is nearer the top — the first
         * question, not the highest index.
         */
        if (event.nativeEvent.actionName === 'increment' && index > 0) onMove(index, index - 1);
        if (event.nativeEvent.actionName === 'decrement' && index < count - 1) {
          onMove(index, index + 1);
        }
      }}
      style={{
        // Narrow, and the 44pt target is the row it is attached to. A grip wide
        // enough to be its own target would take a fifth of a 390pt screen away
        // from the question it is meant to be beside.
        width: 32,
        alignItems: 'center',
        /*
         * Level with the top of the row, not centred on it.
         *
         * The rows this is used on are cards, and a card can be most of a
         * screen tall — a form with two tickboxes, a hint and three buttons.
         * Centred, the grip floats in the middle of all that with nothing
         * beside it and reads as a mark on the page rather than a handle for
         * the thing above it. Level with the title it is unmistakably *that
         * card's*.
         *
         * `GRIP_DROP` rather than zero because a card's own padding puts its
         * title a little below its edge, and a handle level with the border
         * looks attached to the gap instead of to the name.
         */
        paddingTop: GRIP_DROP,
      }}
    >
      <Icon name="grip" color={theme.color.inkFaint} size={18} />
    </View>
  );
}
