/**
 * The shutter: tap for a photograph, hold for a clip, drag up to lock it.
 *
 * ## The one gesture, and what each part of it means
 *
 * A single pan, beginning the moment a finger lands:
 *
 *  - **Released before `HOLD_MS`** — a photograph. The timer never fired, so
 *    nothing was ever recording.
 *  - **Held past `HOLD_MS`** — recording starts under the finger, and lifting
 *    the finger ends it. This is the whole of the interaction for most clips.
 *  - **Dragged up past `LOCK_TRAVEL` while held** — locked. Recording continues
 *    after the finger lifts, and the button becomes a stop.
 *
 * ## Why the up-axis is lock and not zoom
 *
 * Snapchat spends the vertical drag on zoom and has no lock at all. Both were
 * wanted here and there is only one axis under the thumb, so one of them had to
 * move: **lock keeps the shutter, zoom moves to a pinch** on the viewfinder.
 *
 * That is the right way round for this app rather than in general. A lock is
 * load-bearing precisely when a clip runs long — a hymn, a procession, the
 * whole of a deacon's response — and holding a phone dead still with a thumb
 * mashed against the glass for fifty seconds is how you get fifty seconds of
 * shaking. Zoom during a recording is a nicety; a zoom you can reach with two
 * fingers once the shutter is locked is barely even a loss.
 *
 * ## `runOnJS(true)`, deliberately
 *
 * Gesture Handler's callbacks are worklets by default and everything they touch
 * has to be. This gesture's whole job is to call into a camera's imperative
 * ref, start a timer, and flip React state — all of which would be
 * `runOnJS(...)` hops taken one at a time. Running the gesture on the JS thread
 * takes them all at once, and costs nothing that matters: the thing being
 * driven is a native recorder, not a value animating at sixty frames a second.
 */
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Icon } from '@/components/Icon';
import { Micro } from '@/components/Type';
import { useTheme } from '@/theme/ThemeProvider';

/** How long a finger has to stay down before it means "record" and not "take". */
const HOLD_MS = 260;

/** How far up the finger travels to lock, in points. */
const LOCK_TRAVEL = 88;

/** The button. A platform minimum of 44 many times over; this is the target. */
const DIAMETER = 76;
const RING_WIDTH = 5;

export interface ShutterProps {
  /** True from the moment the recorder actually starts. */
  recording: boolean;
  locked: boolean;
  /** When the current recording began, for the ring. Null when not recording. */
  startedAt: number | null;
  /** The cap the recorder was given, in seconds. The ring is a fraction of it. */
  limitSeconds: number;
  /** No destination, no camera, or a send in flight. */
  disabled: boolean;
  onPhoto: () => void;
  onStartVideo: () => void;
  onStopVideo: () => void;
  onLock: () => void;
}

export function Shutter({
  recording,
  locked,
  startedAt,
  limitSeconds,
  disabled,
  onPhoto,
  onStartVideo,
  onStopVideo,
  onLock,
}: ShutterProps) {
  const theme = useTheme();

  const heldRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [travel, setTravel] = useState(0);

  /*
   * Everything the gesture needs to read *at the moment it fires* rather than
   * at the moment it was built, in one ref.
   *
   * The lock is the reason this exists. Gesture Handler keeps the callbacks
   * from the render that began the gesture, so reading `locked` from the prop
   * inside `onFinalize` reads the value from before the lock happened — and
   * stops the recording the lock was supposed to keep running. That is the
   * exact bug the lock exists to prevent.
   *
   * The four handlers ride along for a different reason: the parent passes
   * fresh closures every render, so keeping them here is what lets the gesture
   * itself be built once instead of being replaced underneath a finger that is
   * still down.
   */
  const liveRef = useRef({ locked, recording, onPhoto, onStartVideo, onStopVideo, onLock });

  // In an effect, not during render. A render that React throws away would
  // still have written it, which is precisely what the refs rule guards.
  useEffect(() => {
    liveRef.current = { locked, recording, onPhoto, onStartVideo, onStopVideo, onLock };
  }, [locked, recording, onPhoto, onStartVideo, onStopVideo, onLock]);

  // A timer outliving the component would call into an unmounted camera.
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  /*
   * The three halves of the gesture, as callbacks rather than as arrows
   * written inline below.
   *
   * Not a style preference. A function written inside the `useMemo` is a
   * function created during render as far as the compiler is concerned, so
   * every `liveRef.current` in it reads as a ref touched during render — which
   * is a rule worth keeping rather than silencing, because it is usually
   * right. A `useCallback` is the shape that says "this runs from an event",
   * and these three only ever run from a finger.
   */
  const handleBegin = useCallback(() => {
    heldRef.current = false;
    setTravel(0);
    timerRef.current = setTimeout(() => {
      heldRef.current = true;
      liveRef.current.onStartVideo();
    }, HOLD_MS);
  }, []);

  const handleUpdate = useCallback((translationY: number) => {
    if (!heldRef.current) return;
    // Up is negative. Clamped at both ends so the badge's fill is a fraction,
    // and dragging down cannot push it past its own floor.
    const up = Math.max(0, Math.min(LOCK_TRAVEL, -translationY));
    setTravel(up);
    if (up >= LOCK_TRAVEL && !liveRef.current.locked) {
      liveRef.current.locked = true;
      liveRef.current.onLock();
    }
  }, []);

  const handleFinalize = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setTravel(0);

    if (heldRef.current) {
      heldRef.current = false;
      /*
       * A locked recording survives the finger leaving. That is the point —
       * but *only* if there is actually a recording.
       *
       * `onLock` can fire during the session's reconfiguration, before the
       * recorder exists: the drag passes the threshold while the hold is
       * still being set up. Skipping the stop in that state strands the run
       * with nobody holding it and nothing on screen able to end it, which is
       * the orphan this whole path is arranged to prevent. So the lock only
       * earns its exemption once something is running.
       */
      if (!(liveRef.current.locked && liveRef.current.recording)) {
        liveRef.current.onStopVideo();
      }
      return;
    }

    /*
     * Never held, so the timer was cleared before it fired: a tap.
     *
     * `onFinalize` rather than `onEnd` because it runs for a cancelled gesture
     * too — a finger that slides off the button, or a system alert arriving
     * mid-press. Those must not leave a recording running with nothing on
     * screen able to stop it, and the cost of putting the tap here is that a
     * cancelled press still takes a photograph. That is the right way to be
     * wrong: an unwanted photograph is one press of the discard, and an
     * orphaned recording is a file nobody can reach.
     */
    liveRef.current.onPhoto();
  }, []);

  /*
   * Built once, and rebuilt only when it is switched on or off.
   *
   * Not merely an optimisation. A gesture object replaced mid-interaction is a
   * gesture handed to `GestureDetector` while a finger is still down, and the
   * hold this whole component is about lasts up to a minute.
   */
  /*
   * Locked, so the finger is gone: the button is now a stop, and a stop is a
   * plain press rather than the tap-or-hold gesture.
   *
   * The gesture is switched *off* for it, which it has to be rather than
   * merely ignored. Leaving it armed means the press that stops a locked
   * recording also runs `onBegin` — arming a fresh hold timer — and then
   * `onFinalize`, which sees `heldRef` false, calls it a tap and takes a
   * photograph. Stopping a recording would silently produce one.
   */
  const stopping = recording && locked;

  /*
   * The disable is narrow, and is a false positive rather than a silenced
   * complaint. `react-hooks/refs` fires because a builder called during render
   * is handed callbacks that read refs, and it cannot see that Gesture Handler
   * only ever invokes them from a finger. What the rule actually protects
   * against — a ref read whose value decides what is rendered — is absent
   * here: none of the three return anything, and everything drawn below comes
   * from props and from `travel`, which is state.
   */
  /* eslint-disable react-hooks/refs */
  const pan = useMemo(
    () =>
      Gesture.Pan()
        // The finger has not moved yet when it lands, and the press *is* the
        // gesture — a pan waiting for travel would never see a tap at all.
        .minDistance(0)
        .enabled(!disabled && !stopping)
        .runOnJS(true)
        .onBegin(handleBegin)
        .onUpdate((event) => handleUpdate(event.translationY))
        .onFinalize(handleFinalize),
    [disabled, stopping, handleBegin, handleUpdate, handleFinalize],
  );
  /* eslint-enable react-hooks/refs */


  return (
    <View style={{ alignItems: 'center' }}>
      <LockBadge
        visible={recording && !locked}
        progress={travel / LOCK_TRAVEL}
        locked={locked}
        recording={recording}
      />

      <GestureDetector gesture={pan}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            stopping
              ? 'Stop recording'
              : 'Take a photograph. Hold to record a clip, and drag upwards to keep recording.'
          }
          accessibilityState={{ disabled, busy: recording }}
          /*
           * A press only while it is a stop. The rest of the time the gesture
           * above owns this button outright, and a `Pressable` with an
           * `onPress` would be a second opinion about what a tap means.
           *
           * `onAccessibilityTap` is separate and is always wired, because
           * VoiceOver's double-tap is not a touch the gesture ever sees — a
           * screen reader user would otherwise have a shutter that does
           * nothing at all.
           */
          onPress={stopping ? onStopVideo : undefined}
          /*
           * `accessibilityState` is advisory — it greys the control in the
           * rotor and stops nothing. Without the guard a VoiceOver double-tap
           * fires the shutter with no destination to send to.
           */
          onAccessibilityTap={stopping ? onStopVideo : disabled ? undefined : onPhoto}
          style={{
            width: DIAMETER,
            height: DIAMETER,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: disabled ? 0.4 : 1,
          }}
        >
          {/*
            Keyed on the recording it belongs to, so each one starts its clock
            from nothing. The alternative is resetting the elapsed time from
            inside an effect, which is a cascading render for a value that only
            ever means "this recording" — a remount says the same thing and
            says it before the first frame.
          */}
          <Ring
            key={startedAt ?? 'idle'}
            recording={recording}
            startedAt={startedAt}
            limitSeconds={limitSeconds}
            track={theme.color.inkInverse}
            fill={theme.color.accent}
          />

          {/*
            The inner mark. A white disc at rest, an oxblood disc while
            recording, and an oxblood square once locked — the same three-state
            vocabulary every camera on a phone uses, so nobody has to be taught
            it.
          */}
          <View
            style={{
              position: 'absolute',
              width: recording ? 28 : DIAMETER - RING_WIDTH * 4,
              height: recording ? 28 : DIAMETER - RING_WIDTH * 4,
              borderRadius:
                locked && recording
                  ? theme.radius.sm
                  : Math.min(theme.radius.full, DIAMETER / 2),
              backgroundColor: recording ? theme.color.accent : theme.color.inkInverse,
            }}
          />
        </Pressable>
      </GestureDetector>
    </View>
  );
}

/**
 * The countdown around the button.
 *
 * Its own component holding its own clock, so the twenty ticks a second land on
 * one small SVG rather than on a tree containing a live camera preview. At the
 * default cap this redraws a circle twelve hundred times and nothing else at
 * all.
 *
 * Twenty a second rather than sixty: the arc advances by less than a degree per
 * tick either way, and this is a progress indicator, not an animation.
 */
function Ring({
  recording,
  startedAt,
  limitSeconds,
  track,
  fill,
}: {
  recording: boolean;
  startedAt: number | null;
  limitSeconds: number;
  track: string;
  fill: string;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!recording || startedAt === null) return;
    const tick = setInterval(() => setElapsed(Date.now() - startedAt), 50);
    return () => clearInterval(tick);
  }, [recording, startedAt]);

  const radius = (DIAMETER - RING_WIDTH) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(1, elapsed / (limitSeconds * 1000));

  return (
    <Svg width={DIAMETER} height={DIAMETER} style={{ position: 'absolute' }}>
      <Circle
        cx={DIAMETER / 2}
        cy={DIAMETER / 2}
        r={radius}
        stroke={track}
        strokeWidth={RING_WIDTH}
        fill="none"
        // Dimmed while recording so the oxblood arc reads against it rather
        // than fighting a ring of the same weight.
        opacity={recording ? 0.35 : 1}
      />
      {recording ? (
        <Circle
          cx={DIAMETER / 2}
          cy={DIAMETER / 2}
          r={radius}
          stroke={fill}
          strokeWidth={RING_WIDTH}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
          // Twelve o'clock, not three. SVG starts an arc at the positive x
          // axis, and every clock face people have ever read starts at the top.
          rotation={-90}
          origin={`${DIAMETER / 2}, ${DIAMETER / 2}`}
        />
      ) : null}
    </Svg>
  );
}

/**
 * The target you drag onto, and the confirmation that you hit it.
 *
 * Visible only while a recording is being *held* — once locked there is nothing
 * left to aim at, and the word is replaced by the hint that the button below
 * now stops rather than records.
 */
function LockBadge({
  visible,
  progress,
  locked,
  recording,
}: {
  visible: boolean;
  progress: number;
  locked: boolean;
  recording: boolean;
}) {
  const theme = useTheme();

  // `locked` alone is not enough: it can be set a beat before the recorder
  // starts, and "press to stop" is a lie while there is nothing to stop.
  if (locked && recording) {
    return (
      <View style={{ height: 44, justifyContent: 'center' }}>
        <Micro color={theme.color.inkInverse}>Locked — press to stop</Micro>
      </View>
    );
  }

  // The row keeps its height whether or not anything is in it, so arriving at
  // it does not shove the shutter down the screen mid-recording.
  if (!visible) return <View style={{ height: 44 }} />;

  return (
    <View style={{ height: 44, alignItems: 'center', justifyContent: 'center', gap: 2 }}>
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: theme.radius.full,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1.5,
          borderColor: theme.color.inkInverse,
          // Fills as the finger approaches, so the gesture has a progress and
          // not just a threshold somebody either finds or does not.
          backgroundColor: progress >= 1 ? theme.color.accent : 'transparent',
          opacity: 0.5 + progress * 0.5,
        }}
      >
        <Icon name="lock" color={theme.color.inkInverse} size={16} />
      </View>
    </View>
  );
}
