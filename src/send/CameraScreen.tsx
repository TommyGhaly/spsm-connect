/**
 * The viewfinder — the screen this app is for, open on arrival.
 *
 * ## Why the camera is the screen and not a button on it
 *
 * This tab used to be a card with "Take a photograph" on it, which handed off
 * to the system picker's camera. That is two presses and a modal between
 * somebody seeing a thing and catching it, and the thing is usually a child at
 * an altar who will not be there in two presses' time. The camera is live the
 * moment the tab is, which is what everybody already expects from the round
 * button in the middle of the bar.
 *
 * ## The one rule of `theme/tokens.ts`, and the one place it bends
 *
 * Never write a literal colour. Nothing here does. But a viewfinder is a
 * photograph rather than paper, so the chrome over it does not follow light and
 * dark — it is `inkInverse` on scrims of `deep` in both, which is the same
 * decision every camera on every phone has made.
 *
 * ## Mode, and why the video path is slower than the photo path
 *
 * `mode` is not a label on the session, it *is* the session: on iOS,
 * `mode: 'video'` swaps the capture preset to `videoQuality`'s and adds the
 * audio input, and `mode: 'picture'` tears the movie output back down (see
 * `CameraSessionManager.setCameraMode`). So leaving it on `'video'` to make
 * recording instant would silently cap **every photograph** at 720p — the
 * primary thing this app does, degraded to speed up the secondary one.
 *
 * So the switch happens on the hold, and it costs what a session
 * reconfiguration costs. `mode` is a prop whose setter hops to a serial session
 * queue with no callback to wait on, so there is nothing to await: this settles
 * for a beat, tries, and retries a few times if the movie output is not up yet
 * (`CameraOutputNotReadyException`). Slow devices take longer and get more
 * attempts rather than a longer wait imposed on everybody.
 *
 * ## What is unmounted, and why that matters
 *
 * `CameraView` is dropped entirely when the tab is not focused. A camera left
 * running behind four other screens is a battery cost, a privacy indicator
 * burning on the status bar with nothing on screen to explain it, and on
 * Android a device another app cannot open.
 */
import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
  type CameraMode,
  type CameraType,
  type FlashMode,
} from 'expo-camera';
import { Image } from 'expo-image';
import * as MediaLibrary from 'expo-media-library';
import { useFocusEffect, useIsFocused, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Platform, Pressable, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VIDEO_MAX_BYTES } from '@spsm/shared';

import { Button, Card, Screen } from '@/components/Surface';
import { Icon } from '@/components/Icon';
import { Body, Label, Micro, Small } from '@/components/Type';
import { mayAdminProgramEvent } from '@/firebase/grants';
import { useGrants } from '@/session/SessionProvider';
import { pickAndQueue, queueCapture, type PickOutcome } from '@/upload/pick';
import { useUploads } from '@/upload/useUploads';
import { useTheme } from '@/theme/ThemeProvider';

import { DestinationBar } from './DestinationBar';
import { Preview, type Capture } from './Preview';
import { Shutter } from './Shutter';
import { useDestination } from './useDestination';

/**
 * The cap on a held recording, in seconds, and the quality it records at.
 *
 * The two are one decision. `VIDEO_MAX_BYTES` is 100 MB and a client cannot
 * re-encode a video — `condense` says so in its own header — so a clip over the
 * ceiling is *refused*, after it was recorded, which is the worst possible
 * moment to find out. 720p runs at roughly 0.6–1 MB per second on a phone, so a
 * full minute lands near 40–60 MB and the refusal is unreachable by
 * construction. At 1080p a long minute can pass 100 MB, and somebody would
 * occasionally lose a recording they had already taken.
 *
 * `maxFileSize` is passed as well, and the two together with `condense`'s own
 * check make three independent guards on the same number. That is not
 * redundancy for its own sake: the first two stop the recording cleanly and
 * keep what was recorded, and the third is what stops a *picked* file.
 *
 * The recorder's cap is `VIDEO_MAX_BYTES` for everybody, including the
 * administrators `maxBytesFor` gives no video ceiling to. The cap has to be
 * chosen when recording *starts*, and the destination can be changed on the
 * preview afterwards — so an uncapped recording made against a ministry you
 * administer could be retargeted to one you do not and then be refused, after
 * it had already been taken. That is precisely the outcome the paragraph
 * above claims is unreachable, and the claim is only true if the recorder is
 * capped unconditionally. An administrator who needs to send something larger
 * still can: from the library, where the file already exists and the ceiling
 * is judged against the destination it is actually going to.
 */
const MAX_SECONDS = 60;
const VIDEO_QUALITY = '720p' as const;

/** How long to let the session settle after `mode` changes, before recording. */
const SESSION_SETTLE_MS = 180;
/** Extra tries, at the same spacing, for a device still reconfiguring. */
const RECORD_ATTEMPTS = 8;
/**
 * How long to wait before believing a `recordAsync` that has not rejected.
 *
 * "Not ready" rejects on the next turn of the loop — it is a nil check in the
 * native module — so anything still pending after this is a recording that
 * genuinely started. Long enough not to race the bridge, short enough that
 * the ring does not visibly lag the finger.
 */
const EARLY_FAILURE_MS = 80;
/** How often to re-ask a recorder that was told to stop before it existed. */
const STOP_RETRY_MS = 120;

/**
 * How a recording ended: with a file, or not at all.
 *
 * `ok: false` covers both of `recordAsync`'s rejections — the movie output not
 * being ready, and the view unmounting mid-recording — which are told apart by
 * *when* they arrive rather than by what they are.
 */
type RecordOutcome = { ok: true; uri: string | null } | { ok: false; uri: null };

export function CameraScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const grants = useGrants();
  const uploads = useUploads();
  const focused = useIsFocused();

  const [camera, requestCamera] = useCameraPermissions();
  const [microphone, requestMicrophone] = useMicrophonePermissions();

  const cameraRef = useRef<CameraView | null>(null);

  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState<FlashMode>('off');
  const [mode, setMode] = useState<CameraMode>('picture');
  const [zoom, setZoom] = useState(0);
  const [autofocus, setAutofocus] = useState<'on' | 'off'>('on');
  const [focusAt, setFocusAt] = useState<{ x: number; y: number; at: number } | null>(null);

  const [recording, setRecording] = useState(false);
  const [locked, setLocked] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  const [capture, setCapture] = useState<Capture | null>(null);
  const [sending, setSending] = useState(false);
  const [refused, setRefused] = useState<PickOutcome['refused']>([]);
  const [sent, setSent] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  const destination = useDestination();

  /*
   * The recorder's ownership, and the two facts a running `startVideo` has to
   * re-read across its awaits.
   *
   * `runRef` holds the invocation that currently owns the recorder, or null.
   * A single boolean was not enough and was actively harmful: two overlapping
   * holds both set it, so an abort raised by the first was cleared by the
   * second and the first went on to start a recording nobody was holding.
   *
   * `captureRef` mirrors `capture` because a preview can open during an await
   * and React state read from a closure is the value from before it did.
   */
  const runRef = useRef<number | null>(null);
  const runCounterRef = useRef(0);
  const stopRequestedRef = useRef(false);
  const captureRef = useRef<Capture | null>(null);

  /*
   * The two one-at-a-time guards that cannot be state, for the reason given
   * at each call site: a second press inside the same frame reads the value
   * from before the first one.
   */
  const sendingRef = useRef(false);
  const pickingRef = useRef(false);

  useEffect(() => {
    captureRef.current = capture;
  }, [capture]);

  /* ---------------------------------------------------------------------- */
  /* Permissions                                                             */
  /* ---------------------------------------------------------------------- */

  /*
   * Asked for on arrival rather than behind a button, because the button would
   * say "turn on the camera" on a screen whose entire purpose is a camera —
   * a press that exists only to be pressed.
   *
   * Both at once, and the microphone genuinely is up-front rather than
   * over-asking: holding the shutter records sound, that is half of what the
   * feature is for, and the alternative is interrupting somebody's first
   * recording with a system sheet at the moment they are trying to catch
   * something. A refusal is not fatal — `mute` below turns a denied microphone
   * into a silent clip rather than a broken one.
   */
  useEffect(() => {
    if (!focused) return;
    if (camera && !camera.granted && camera.canAskAgain) void requestCamera();
  }, [focused, camera, requestCamera]);

  useEffect(() => {
    if (!focused || !camera?.granted) return;
    if (microphone && !microphone.granted && microphone.canAskAgain) void requestMicrophone();
  }, [focused, camera?.granted, microphone, requestMicrophone]);

  /* ---------------------------------------------------------------------- */
  /* Leaving the screen                                                      */
  /* ---------------------------------------------------------------------- */

  /*
   * A recording does not survive the tab losing focus, and the clip is lost
   * with it.
   *
   * `CameraView` is unmounted below when `focused` goes false, and on iOS the
   * view's `deinit` *rejects* the pending `recordAsync` rather than resolving
   * it with what had been written — so leaving the tab mid-recording loses
   * the clip outright. That is worth stating plainly rather than implying a
   * graceful stop that does not happen.
   *
   * It is also the right behaviour to keep: a clip somebody walked away from
   * halfway through is not a clip they meant to send, and salvaging it would
   * mean a preview appearing over whatever screen they went to instead. What
   * this cleanup exists for is the *state* — without it the screen believes
   * it is still recording and comes back with a ring counting up from
   * something that ended minutes ago.
   */
  useFocusEffect(
    useCallback(() => {
      return () => {
        /*
         * Disown the recorder rather than only resetting the picture of it.
         * `CameraView` unmounts on blur and its `deinit` *rejects* the pending
         * `recordAsync` on iOS, so the run is finished whether or not it has
         * a file; dropping the token is what stops it writing state into a
         * screen that has been left.
         */
        runRef.current = null;
        stopRequestedRef.current = false;
        setRecording(false);
        setLocked(false);
        setStartedAt(null);
        setMode('picture');
      };
    }, []),
  );

  /* ---------------------------------------------------------------------- */
  /* Capture                                                                 */
  /* ---------------------------------------------------------------------- */

  const takePhoto = useCallback(async () => {
    const view = cameraRef.current;
    if (!view || captureRef.current !== null) return;

    try {
      const photo = await view.takePictureAsync({
        // Full quality out of the camera. `condense` is what makes it small,
        // and it does a better job from a better original — compressing twice
        // is how a photograph ends up looking like a photograph of a screen.
        quality: 1,
        // The EXIF block is dropped by the re-encode in `condense` and stripped
        // again server-side. Not asking for it here means the GPS tag never
        // exists in this process at all.
        exif: false,
      });
      // Re-checked: the await above is long enough for a recording to have
      // finished and claimed the preview.
      if (!photo || captureRef.current !== null) return;
      setRefused([]);
      setCapture({ uri: photo.uri, contentType: 'image/jpeg', kind: 'photo' });
    } catch {
      // A shutter that does not fire is not worth a dialog. The preview simply
      // does not appear, and the viewfinder is still live to try again.
    }
  }, []);

  /**
   * Hold the shutter: switch the session to video, start recording, and own
   * the recorder until it stops.
   *
   * ## One owner at a time, by token
   *
   * `runRef` is the invocation that currently owns the recorder, and every
   * step below re-checks that it is still the owner before touching state.
   * This is not defensive padding — it is the only thing standing between this
   * function and a second concurrent `recordAsync`, which on iOS returns a
   * promise that is *never settled or rejected*
   * (`CameraVideoRecording.swift`: `guard !isRecording && promise == nil else
   * { return }`) and on Android reassigns the active CameraX recording out
   * from under the first one.
   *
   * Every `await` here is a place the world can change: a preview can open, a
   * finger can lift, the tab can blur. A guard checked once at the top is a
   * guard that is wrong by the time the loop reaches its second attempt.
   */
  const startVideo = useCallback(async () => {
    const view = cameraRef.current;
    if (!view) return;
    if (captureRef.current !== null) return;
    // Somebody is already recording. Without this, holding the shutter during
    // a recording starts a second one that can never resolve.
    if (runRef.current !== null) return;

    const run = ++runCounterRef.current;
    runRef.current = run;
    stopRequestedRef.current = false;
    setMode('video');

    /** Still the invocation that owns the recorder? */
    const owns = () => runRef.current === run;

    /*
     * Fixed at `VIDEO_MAX_BYTES` for everybody, including administrators who
     * have no video ceiling at all in `maxBytesFor`.
     *
     * The cap has to be decided when the recording *starts* and the
     * destination can be changed on the preview *afterwards*. Giving an
     * administrator an uncapped recorder therefore makes the guarantee at the
     * top of this file false: record uncapped against a ministry you
     * administer, retarget to one you do not, and `condense` refuses a clip
     * that has already been taken. An administrator who needs to send
     * something larger can still pick it from their library, where the file
     * already exists and the ceiling is judged against the real destination.
     */
    let everStarted = false;

    try {
      for (let attempt = 0; attempt < RECORD_ATTEMPTS; attempt += 1) {
        await wait(SESSION_SETTLE_MS);
        // Re-checked every round: the finger may be gone, a preview may have
        // opened, or the tab may have blurred while this was waiting.
        if (!owns() || stopRequestedRef.current || captureRef.current !== null) return;

        const startedTime = Date.now();

        /*
         * The promise is watched rather than awaited outright, because its two
         * failure modes are opposite and have to be told apart.
         *
         * A rejection in the first few milliseconds is `CameraOutputNotReady`
         * — the movie output has not finished being configured — and the right
         * answer is to go round again. A rejection *later* means a recording
         * genuinely ran and then failed, most often `CameraUnmounted` from the
         * tab blurring, and retrying that just calls `recordAsync` repeatedly
         * against a view that is being torn down.
         */
        /*
         * The outcome is carried *by* the promise rather than written into a
         * variable from its callbacks, so that it is a value with a type
         * rather than something the compiler has to guess at across a
         * closure. Awaited twice below, which is free — a promise settles
         * once and hands the same answer to every reader.
         */
        const watched: Promise<RecordOutcome> = view
          .recordAsync({
            maxDuration: MAX_SECONDS,
            maxFileSize: VIDEO_MAX_BYTES,
          })
          .then(
            (result) => ({ ok: true as const, uri: result?.uri ?? null }),
            () => ({ ok: false as const, uri: null }),
          );

        const early = await Promise.race([watched, wait(EARLY_FAILURE_MS).then(() => null)]);
        // Rejected within the window: the movie output was not up yet. Again.
        if (early && !early.ok) continue;
        if (!owns()) return;

        everStarted = true;
        setRecording(true);
        setStartedAt(startedTime);

        /*
         * `stopRecording` asks the *native* recorder to stop, and it is a
         * silent no-op if the recorder has not physically started — which is
         * exactly the window a quick hold releases in. So the request is kept
         * as intent and re-sent until the promise actually settles.
         *
         * Without this, lifting a finger a moment too early leaves a
         * recording running that nothing on screen can stop, and it ends by
         * dumping a full sixty seconds of unasked-for audio into the preview.
         */
        const nag = setInterval(() => {
          if (stopRequestedRef.current) view.stopRecording();
        }, STOP_RETRY_MS);

        let finished: RecordOutcome;
        try {
          finished = await watched;
        } finally {
          clearInterval(nag);
        }

        // The tab may have blurred, or a newer run taken over, while the
        // recording was running. Its file is not this screen's business then.
        if (!owns()) return;

        if (finished.ok && finished.uri) {
          setRefused([]);
          setCapture({
            uri: finished.uri,
            contentType: contentTypeForVideo(finished.uri),
            kind: 'video',
          });
        }
        return;
      }
    } finally {
      /*
       * Ownership is released exactly once, by whoever still holds it. A run
       * that was superseded must not reset the state of the run that
       * superseded it.
       */
      if (owns()) {
        runRef.current = null;
        stopRequestedRef.current = false;
        setRecording(false);
        setLocked(false);
        setStartedAt(null);
        setMode('picture');

        /*
         * A hold too short to become a recording is a tap, and gets a
         * photograph.
         *
         * Without this there is a dead band of a few hundred milliseconds —
         * long enough to pass `HOLD_MS`, too short to outlast the session
         * reconfiguration — where the finger comes up before the recorder is
         * ready and the person gets *nothing at all*. A press that produces
         * nothing is the one outcome a shutter may never have.
         *
         * The caveat, stated rather than glossed: `mode` has just been set
         * back to `'picture'` but that setter is asynchronous too, so this
         * photograph can occasionally come off the video preset at 720p. It is
         * the rarest path in this file, and a slightly smaller photograph
         * beats no photograph by a distance.
         */
        if (!everStarted && captureRef.current === null) await takePhoto();
      }
    }
  }, [takePhoto]);

  /**
   * Release the shutter, or press a locked one.
   *
   * Records the intent as well as asking, because the ask can land before the
   * native recorder exists. `startVideo` re-sends it until it takes.
   */
  const stopVideo = useCallback(() => {
    stopRequestedRef.current = true;
    cameraRef.current?.stopRecording();
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Sending                                                                 */
  /* ---------------------------------------------------------------------- */

  const send = useCallback(async () => {
    const target = destination.destination;
    if (!capture || !target) return;
    /*
     * A ref, not the `sending` state, and not the button's `disabled`.
     *
     * Both of those are last render's values, so two presses inside one frame
     * both pass — and this is the one guard in the file whose failure is
     * *durable*: `queueCapture` twice on the same uri is the same photograph
     * enqueued twice, uploaded twice, and sitting twice in an administrator's
     * review queue for somebody to notice and delete by hand.
     */
    if (sendingRef.current) return;
    sendingRef.current = true;

    setSending(true);
    setRefused([]);
    try {
      const outcome = await queueCapture(
        {
          uri: capture.uri,
          contentType: capture.contentType,
          name: capture.kind === 'video' ? 'Your clip' : 'Your photograph',
        },
        {
          programId: target.programId,
          programEventId: target.programEventId,
          isProgramAdmin: mayAdminProgramEvent(grants, target.programId, target.programEventId),
        },
      );

      if (outcome.queued > 0) {
        setCapture(null);
        setSent(capture.kind === 'video' ? 'Your clip is on its way.' : 'Your photograph is on its way.');
        return;
      }
      // Refused. The preview stays, because "try trimming it first" is advice
      // you can only take while you still have the thing.
      setRefused(outcome.refused);
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }, [capture, destination.destination, grants]);

  // The confirmation is a sentence, not a screen. It clears itself.
  useEffect(() => {
    if (sent === null) return;
    const timer = setTimeout(() => setSent(null), 2600);
    return () => clearTimeout(timer);
  }, [sent]);

  const fromLibrary = useCallback(async () => {
    const target = destination.destination;
    if (!target) return;
    // As above: `picking` is last render's answer, and the picker is slow
    // enough to open that a second press lands well before it re-renders.
    if (pickingRef.current) return;
    pickingRef.current = true;

    setPicking(true);
    try {
      const outcome = await pickAndQueue({
        programId: target.programId,
        programEventId: target.programEventId,
        isProgramAdmin: mayAdminProgramEvent(grants, target.programId, target.programEventId),
      });
      if (outcome.cancelled) return;
      if (outcome.queued > 0) {
        setSent(
          outcome.queued === 1
            ? 'One photograph is on its way.'
            : `${outcome.queued} photographs are on their way.`,
        );
      }
      // A batch's refusals belong on the same surface as a capture's.
      setRefused(outcome.refused);
    } finally {
      pickingRef.current = false;
      setPicking(false);
    }
  }, [destination.destination, grants]);

  /* ---------------------------------------------------------------------- */
  /* Gestures on the viewfinder                                              */
  /* ---------------------------------------------------------------------- */

  const zoomBase = useRef(0);

  /*
   * The current zoom, for a gesture built once that therefore cannot close
   * over the state. `onBegin` needs to know where the last pinch left off.
   */
  const zoomRef = useRef(zoom);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  const handlePinchBegin = useCallback(() => {
    zoomBase.current = zoomRef.current;
  }, []);

  const handlePinchUpdate = useCallback((scale: number) => {
    /*
     * `zoom` is a 0–1 fraction of the device's maximum, not a factor, so the
     * pinch scale cannot be multiplied into it — doubling the gesture would
     * otherwise jump from halfway to fully zoomed. It is added as a
     * displacement instead, damped, which makes the whole range reachable in
     * about two comfortable pinches.
     */
    setZoom(clamp(zoomBase.current + (scale - 1) * 0.35, 0, 1));
  }, []);

  /**
   * Turn the camera round. The button's press, and the double tap's.
   *
   * `runRef` rather than the `recording` state, for the reason every other
   * guard in this file gives: a gesture is built once and cannot close over
   * state. The refusal itself is the documented one — "flipping camera during
   * a recording results in stopping it" — and it is worse from a gesture than
   * from the button, because the button can be greyed out and a finger cannot.
   */
  const flipCamera = useCallback(() => {
    if (runRef.current !== null) return;
    setFacing((current) => (current === 'back' ? 'front' : 'back'));
  }, []);

  const handleTap = useCallback((x: number, y: number) => {
    setFocusAt({ x, y, at: Date.now() });
    /*
     * A focus *retrigger*, not a focus at the point — and the difference is
     * worth being honest about.
     *
     * `CameraView` in SDK 57 has no point-of-interest API: `autofocus` is
     * `'on' | 'off'` and nothing takes a coordinate. Dropping it and putting it
     * back is what makes the lens hunt again, which is the useful half of the
     * gesture when the camera has locked onto a pew instead of a face. Where
     * you tap does not weight it. The square is drawn where the finger landed
     * because that is where somebody looks for the feedback, and it is a real
     * indication that focus was re-run.
     */
    setAutofocus('off');
    setTimeout(() => setAutofocus('on'), 60);
  }, []);

  /*
   * Both gestures built once, for the reason the shutter gives at length: a
   * gesture object replaced mid-pinch is a gesture swapped under a finger.
   *
   * The disable is narrow and is a false positive rather than a silenced
   * complaint. `react-hooks/refs` fires because a builder called during render
   * is handed callbacks that read refs, and it cannot see that Gesture
   * Handler only ever invokes them from a touch — the same reason the handlers
   * above are `useCallback`s. Everything the rule is actually protecting
   * against (a ref read whose value decides what is rendered) is absent: none
   * of these three return anything, and the render reads `zoom` from state.
   */
  /* eslint-disable react-hooks/refs */
  const pinch = useMemo(
    () => Gesture.Pinch().runOnJS(true).onBegin(handlePinchBegin).onUpdate((event) => handlePinchUpdate(event.scale)),
    [handlePinchBegin, handlePinchUpdate],
  );

  const tap = useMemo(
    () => Gesture.Tap().runOnJS(true).onEnd((event) => handleTap(event.x, event.y)),
    [handleTap],
  );

  // Two taps anywhere on the viewfinder turns the camera round, which is what
  // every other camera on the phone does and therefore what a finger tries
  // before it goes looking for the button in the corner.
  const doubleTap = useMemo(
    () => Gesture.Tap().numberOfTaps(2).runOnJS(true).onEnd(() => flipCamera()),
    [flipCamera],
  );
  /* eslint-enable react-hooks/refs */

  /*
   * `Exclusive`, so the single tap loses to the double one.
   *
   * Without it both fire on a double tap: the lens re-hunts, the camera turns
   * round, and the focus square is drawn on a preview that has just been
   * replaced. Exclusive makes the single tap wait for the double to fail,
   * which costs the focus retrigger the length of Gesture Handler's
   * double-tap window — a fifth of a second on a gesture nobody times.
   */
  const viewfinderGestures = useMemo(
    () => Gesture.Simultaneous(pinch, Gesture.Exclusive(doubleTap, tap)),
    [pinch, doubleTap, tap],
  );

  /* ---------------------------------------------------------------------- */
  /* The states before there is a camera                                     */
  /* ---------------------------------------------------------------------- */

  if (!camera) {
    // The hook has not answered yet. One frame, usually.
    return <View style={{ flex: 1, backgroundColor: theme.color.deep }} />;
  }

  if (!camera.granted) {
    return <NoCamera canAskAgain={camera.canAskAgain} onAsk={() => void requestCamera()} />;
  }

  const busy = sending || capture !== null;

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.deep }}>
      {/*
        Unmounted rather than paused when the tab is not focused. See the
        header — a live camera behind another screen is a battery cost and a
        privacy light with nothing on screen to account for it.
      */}
      {focused ? (
        <CameraView
          ref={cameraRef}
          /*
           * The front camera is a mirror, in both halves of the screen.
           *
           * The two have to agree, and there are only two ways to make them:
           * un-mirror the preview, or mirror the file. This is the second, and
           * the first was tried — the preview carried a `scaleX: -1` and the
           * `mirror` prop stayed false. It made the halves agree on the answer
           * nobody wanted. A viewfinder that does not behave like a mirror is
           * wrong from the first frame, before anything is even taken: you
           * raise the phone, lean left, and the picture of you leans right.
           * Tommy: *"the selfie camera is now inverted... now it starts off
           * inverted."* Every camera on the phone mirrors this preview, so a
           * hand learns the mirror long before it meets this app.
           *
           * So the preview is left exactly as the platform draws it — the
           * transform is gone, not set to identity — and the capture is
           * mirrored to match what was on screen when the shutter went.
           *
           * **This flips writing in the frame**, and that is the known cost of
           * the choice: a banner or a name tag behind somebody comes back
           * backwards. It is the trade every phone's "mirror front camera"
           * setting makes, and it is the right way round here because the
           * subject of a selfie at this church is a face, not a sign — and
           * because the alternative surprises somebody *after* the only moment
           * they could have reframed.
           *
           * `facing === 'front'` rather than a bare `true`, and it is not
           * belt-and-braces. Photo capture is guarded natively on both
           * platforms (`presetCamera == .front`, `lensFacing == FRONT`) but
           * **iOS video recording is not**: `CameraVideoRecording.swift` sets
           * `isVideoMirrored` from this prop alone, so a constant `true` would
           * flip every clip taken with the back camera.
           */
          mirror={facing === 'front'}
          style={{ flex: 1 }}
          facing={facing}
          flash={flash}
          mode={mode}
          videoQuality={VIDEO_QUALITY}
          zoom={zoom}
          autofocus={autofocus}
          // The torch is the only thing "flash on" can mean while a movie is
          // recording; a strobe at the start of a clip is not a light.
          enableTorch={recording && flash === 'on'}
          // A denied microphone is a silent clip, not a failed one.
          mute={!microphone?.granted}
        />
      ) : (
        <View style={{ flex: 1 }} />
      )}

      {/*
        The gesture surface, between the preview and the chrome. It is its own
        layer rather than the camera's parent so that the controls drawn after
        it keep their own presses — a pinch handler wrapped around everything
        swallows the shutter.
      */}
      <GestureDetector gesture={viewfinderGestures}>
        <View style={StyleFill} collapsable={false} />
      </GestureDetector>

      {/*
        Keyed on the tap, so tapping twice in the same place shows it twice.
        A component that stayed mounted would have to reset itself from an
        effect, which is a cascading render to say what a remount says for
        free.
      */}
      <FocusRing key={focusAt?.at ?? 'none'} focusAt={focusAt} />

      {zoom > 0.01 ? (
        <View
          style={{
            position: 'absolute',
            alignSelf: 'center',
            top: insets.top + 56,
            paddingHorizontal: theme.space.xs,
            paddingVertical: 2,
            borderRadius: theme.radius.full,
            backgroundColor: theme.color.deep,
            opacity: 0.8,
          }}
        >
          <Micro color={theme.color.inkInverse}>{`${(1 + zoom * 9).toFixed(1)}×`}</Micro>
        </View>
      ) : null}

      {/* -------------------------------------------------------------- */}
      {/* Top: what is sending, and the two camera controls               */}
      {/* -------------------------------------------------------------- */}
      <View
        style={{
          position: 'absolute',
          top: insets.top + theme.space.xs,
          left: theme.space.md,
          right: theme.space.md,
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space.xs,
        }}
      >
        <View style={{ flex: 1, alignItems: 'flex-start' }}>
          <SendingPill uploads={uploads} onPress={() => router.push('/uploads')} />
        </View>

        <Round
          icon={flash === 'off' ? 'flashOff' : 'flash'}
          label={`Flash ${flash}. Press to change.`}
          badge={flash === 'auto' ? 'A' : null}
          onPress={() => setFlash(nextFlash(flash))}
        />
        <Round
          icon="flip"
          label="Switch between the front and back cameras"
          // Documented: "Flipping camera during a recording results in
          // stopping it." Better greyed out than silently truncating a clip.
          disabled={recording}
          onPress={flipCamera}
        />
      </View>

      {/* -------------------------------------------------------------- */}
      {/* Bottom: where it goes, and the shutter                          */}
      {/* -------------------------------------------------------------- */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          gap: theme.space.sm,
          paddingHorizontal: theme.space.md,
          /*
           * Clears the raised camera button in the tab bar below.
           *
           * That circle is 56pt with a `space.md` lift inside a bar around
           * 49pt tall, so it overhangs the scene by roughly twenty points. A
           * shutter placed on the bottom edge would sit underneath it, and the
           * bar's button would eat the presses meant for this one.
           */
          paddingBottom: theme.space.xl,
        }}
      >
        {sent ? (
          <View
            style={{
              alignSelf: 'center',
              paddingHorizontal: theme.space.sm,
              paddingVertical: theme.space.xs,
              borderRadius: theme.radius.full,
              backgroundColor: theme.color.deep,
              opacity: 0.9,
            }}
          >
            <Small color={theme.color.inkInverse}>{sent}</Small>
          </View>
        ) : null}

        {refused.length > 0 && capture === null ? (
          <View
            style={{
              gap: 2,
              padding: theme.space.sm,
              borderRadius: theme.radius.md,
              backgroundColor: theme.color.deep,
              opacity: 0.92,
            }}
          >
            {refused.map((refusal) => (
              <Small key={`${refusal.name}:${refusal.reason}`} color={theme.color.inkInverse}>
                {refusal.reason}
              </Small>
            ))}
          </View>
        ) : null}

        <DestinationBar
          destination={destination.destination}
          fallback={destination.fallback}
          ready={destination.ready}
          overridden={destination.overridden}
          onChoose={destination.choose}
          onRevert={destination.revert}
        />

        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1, alignItems: 'flex-start' }}>
            <LibraryButton onPress={() => void fromLibrary()} busy={picking} />
          </View>

          <Shutter
            recording={recording}
            locked={locked}
            startedAt={startedAt}
            limitSeconds={MAX_SECONDS}
            disabled={busy || destination.destination === null}
            onPhoto={() => void takePhoto()}
            onStartVideo={() => void startVideo()}
            onStopVideo={stopVideo}
            onLock={() => setLocked(true)}
          />

          {/* Balances the library button so the shutter is centred. */}
          <View style={{ flex: 1 }} />
        </View>
      </View>

      {capture ? (
        <Preview
          capture={capture}
          destination={destination.destination}
          fallback={destination.fallback}
          overridden={destination.overridden}
          sending={sending}
          refused={refused}
          onChoose={destination.choose}
          onRevert={destination.revert}
          onDiscard={() => {
            setCapture(null);
            setRefused([]);
          }}
          onSend={() => void send()}
        />
      ) : null}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* The pieces                                                                  */
/* -------------------------------------------------------------------------- */

/** A round control on the scrim. The two at the top corners are both this. */
function Round({
  icon,
  label,
  onPress,
  disabled,
  badge,
}: {
  icon: 'flash' | 'flashOff' | 'flip';
  label: string;
  onPress: () => void;
  disabled?: boolean;
  badge?: string | null;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled === true }}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.radius.full,
        backgroundColor: theme.color.deep,
        opacity: disabled ? 0.3 : pressed ? 0.6 : 0.85,
      })}
    >
      <Icon name={icon} color={theme.color.inkInverse} size={20} />
      {badge ? (
        <View style={{ position: 'absolute', right: 7, bottom: 6 }}>
          <Micro color={theme.color.inkInverse}>{badge}</Micro>
        </View>
      ) : null}
    </Pressable>
  );
}

/**
 * The way to the library, with the last photograph on it when that is free.
 *
 * "When that is free" is the whole design. A real thumbnail needs the media
 * library's permission, and asking for it at launch — on a screen whose own
 * camera prompt has just appeared — to decorate a button is three prompts deep
 * before anybody has taken anything. So this *checks* without asking: somebody
 * who has already granted it (by choosing from their library once) gets the
 * thumbnail, and everybody else gets the icon. Pressing it is what asks, and by
 * then the press has explained why.
 *
 * **iOS only, and not by preference.** On Android the thumbnail needs
 * `READ_MEDIA_IMAGES`, and Play's Photo and Video Permissions policy rejects a
 * build that declares it unless the need is frequent and central — which a
 * decorated button is not. `app.config.ts` therefore passes
 * `granularPermissions: []` to expo-media-library, so the permission is not in
 * the Android manifest and this query could only ever be denied. The check
 * below would handle that on its own; the platform test is here so the reason
 * sits next to the code it explains, rather than looking like an Android bug
 * the next time somebody sees an icon where a photograph is on iPhone.
 * Choosing photographs is unaffected on both platforms — that goes through the
 * system picker in `upload/pick.ts`, which needs no permission.
 */
function LibraryButton({ onPress, busy }: { onPress: () => void; busy: boolean }) {
  const theme = useTheme();
  const [thumbnail, setThumbnail] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;

    let live = true;
    void (async () => {
      // `getPermissionsAsync`, never `requestPermissionsAsync`. This must not
      // be able to raise a system prompt.
      const permission = await MediaLibrary.getPermissionsAsync();
      if (!live || !permission.granted) return;

      /*
       * The SDK 57 query builder, not `getAssetsAsync`. The old paged API is
       * still exported and still warns; `Query` is what replaced it, and
       * `exe()` returns `Asset` objects whose uri is itself a call — the id an
       * asset carries is a `ph://` or `content://` identifier, not a path.
       */
      const [newest] = await new MediaLibrary.Query()
        .eq(MediaLibrary.AssetField.MEDIA_TYPE, MediaLibrary.MediaType.IMAGE)
        .orderBy({ key: MediaLibrary.AssetField.CREATION_TIME, ascending: false })
        .limit(1)
        .exe();
      if (!newest) return;

      const uri = await newest.getUri();
      if (live) setThumbnail(uri);
    })().catch(() => {
      // A decoration. Its failure is the icon, which is also fine.
    });
    return () => {
      live = false;
    };
  }, []);

  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel="Choose photographs from my library"
      style={({ pressed }) => ({
        width: 46,
        height: 46,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.radius.md,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: theme.color.inkInverse,
        backgroundColor: theme.color.deep,
        opacity: busy ? 0.4 : pressed ? 0.6 : 0.85,
      })}
    >
      {thumbnail ? (
        <Image source={{ uri: thumbnail }} contentFit="cover" style={StyleFill} />
      ) : (
        <Icon name="photos" color={theme.color.inkInverse} size={20} />
      )}
    </Pressable>
  );
}

/**
 * "3 sending", top left, and only when there is something to say.
 *
 * The old card screen carried this and the camera replaced that screen, so it
 * had to go somewhere — and a failed upload that nobody is told about is the
 * one outcome this whole subsystem exists to prevent. It is a pill rather than
 * a panel because on most days it says nothing at all.
 */
function SendingPill({
  uploads,
  onPress,
}: {
  uploads: ReturnType<typeof useUploads>;
  onPress: () => void;
}) {
  const theme = useTheme();

  if (uploads.loading || uploads.rows.length === 0) return null;
  if (uploads.outstanding === 0 && uploads.failed === 0) return null;

  const failed = uploads.failed > 0;
  const line = failed
    ? `${uploads.failed} did not send`
    : `${uploads.outstanding} sending`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${line}. Press to see what is sending.`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.xs,
        minHeight: 32,
        paddingHorizontal: theme.space.sm,
        borderRadius: theme.radius.full,
        backgroundColor: failed ? theme.color.accent : theme.color.deep,
        opacity: pressed ? 0.7 : 0.9,
      })}
    >
      <Small color={theme.color.inkInverse}>{line}</Small>
    </Pressable>
  );
}

/**
 * The square where the finger landed.
 *
 * Drawn for a beat and gone. `at` is part of the state rather than a separate
 * counter so that tapping the same spot twice re-shows it — a key made of the
 * coordinates alone would be the same key, and nothing would happen.
 */
function FocusRing({ focusAt }: { focusAt: { x: number; y: number; at: number } | null }) {
  const theme = useTheme();
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setGone(true), 900);
    return () => clearTimeout(timer);
  }, []);

  if (!focusAt || gone) return null;

  const size = 72;

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: focusAt.x - size / 2,
        top: focusAt.y - size / 2,
        width: size,
        height: size,
        borderRadius: theme.radius.sm,
        borderWidth: 1.5,
        borderColor: theme.color.gold,
      }}
    />
  );
}

/**
 * No camera, and what can be done about it.
 *
 * Two different situations and two different sentences. `canAskAgain` means the
 * prompt has not been answered or the system will show it again, so there is a
 * button that works. Once it is false the app cannot ask at all and the only
 * true thing to say is where the switch actually is — a button that silently
 * does nothing is worse than no button.
 */
function NoCamera({ canAskAgain, onAsk }: { canAskAgain: boolean; onAsk: () => void }) {
  const theme = useTheme();

  return (
    <Screen>
      <Card gap={theme.space.sm}>
        <Label>The camera</Label>
        <Body color={theme.color.inkSoft}>
          SPSM Connect needs your camera so you can send photographs to the church galleries.
          Nothing is published until an administrator has looked at it.
        </Body>
        {canAskAgain ? (
          <Button label="Turn on the camera" onPress={onAsk} />
        ) : (
          <Button label="Open Settings" onPress={() => void Linking.openSettings()} tone="quiet" />
        )}
      </Card>
    </Screen>
  );
}

/* -------------------------------------------------------------------------- */
/* Small things                                                                */
/* -------------------------------------------------------------------------- */

const StyleFill = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
} as const;

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Off → on → auto, the order every phone camera cycles in. */
function nextFlash(flash: FlashMode): FlashMode {
  if (flash === 'off') return 'on';
  if (flash === 'on') return 'auto';
  return 'off';
}

/**
 * The type of a file the recorder just wrote.
 *
 * iOS writes QuickTime and Android writes MP4, and the difference is not
 * cosmetic: `submissionObjectPath` derives the stored object's extension from
 * this string, and the signed URL pins a `Content-Type` that the PUT's header
 * has to match exactly. Calling a `.mov` an `video/mp4` gets a 403 an hour
 * later with nobody watching.
 */
function contentTypeForVideo(uri: string): string {
  return uri.toLowerCase().endsWith('.mov') ? 'video/quicktime' : 'video/mp4';
}
