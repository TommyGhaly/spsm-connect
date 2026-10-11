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
 * ## Why VisionCamera, and not expo-camera
 *
 * The brief is the phone's own camera: the same lenses behind the same
 * numbers, and a picture as sharp as the one the Camera app takes. expo-camera
 * could not get there from JavaScript. Its `zoom` was a 0–1 fraction of a
 * maximum it never reported, its lenses were physical devices picked out by
 * their *localized* names, and nothing in it said whether an iPhone's
 * telephoto was 2×, 3× or 5× — so the pill read "Tele", and a phone set to
 * Spanish had no pills at all.
 *
 * VisionCamera opens the device the Camera app opens: the virtual triple or
 * dual-wide camera, which hands the picture from one piece of glass to the
 * next as the zoom crosses it, and which reports where those crossings are.
 * That is what lets the row read 0.5, 1, 2, 3 and a pinch run from the ultra
 * wide into the telephoto without a press in between. See `lensModel`.
 *
 * ## Why the video path is slower than the photo path
 *
 * The movie output is in the session only while the shutter is held. A movie
 * output with sound needs an audio input, and an audio input in the session is
 * an open microphone — the orange dot, and somebody's music stopping — for as
 * long as the viewfinder is, which is the whole time this tab is in front. It
 * would also have the session's format negotiated between the photograph and
 * the clip, when every tap of the shutter wants it chosen for the photograph.
 *
 * So the hold adds the output, waits for the session to say it has been
 * reconfigured (`onConfigured`), and only then records. That costs what a
 * reconfiguration costs, and a finger lifted before it is done gets a
 * photograph rather than nothing.
 *
 * ## What is unmounted, and why that matters
 *
 * `Camera` is dropped entirely when the tab is not focused. A camera left
 * running behind four other screens is a battery cost, a privacy indicator
 * burning on the status bar with nothing on screen to explain it, and on
 * Android a device another app cannot open.
 */
import { Image } from 'expo-image';
import * as MediaLibrary from 'expo-media-library';
import { useFocusEffect, useIsFocused, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Platform, Pressable, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Camera,
  CommonResolutions,
  useCameraDevice,
  useCameraPermission,
  useMicrophonePermission,
  usePhotoOutput,
  useVideoOutput,
  type CameraDevice,
  type CameraRef,
  type DeviceFilter,
  type FlashMode,
  type Recorder,
} from 'react-native-vision-camera';
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
 * The cap on a held recording, in seconds, and the size it is held to.
 *
 * The two are one decision. `VIDEO_MAX_BYTES` is 100 MB and a client cannot
 * re-encode a video — `condense` says so in its own header — so a clip over the
 * ceiling is *refused*, after it was recorded, which is the worst possible
 * moment to find out.
 *
 * The bit rate is what keeps that unreachable, not the resolution. The session
 * negotiates one format for every output in it, and the photograph's comes
 * first, so the clip's resolution is a preference the session may overrule —
 * on an iPhone the movie is written at the format's own size. A bit rate is a
 * promise instead: 8 Mbps is about a megabyte a second whatever the frame
 * turns out to be, so a full minute lands near 60 MB.
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
const VIDEO_BIT_RATE = 8_000_000;

/**
 * How long a hold waits for the session to take the movie output.
 *
 * A reconfiguration is a few hundred milliseconds on a recent iPhone and can
 * be seconds on a slow Android (four on the emulator). This is
 * the point past which it is not coming — and the hold then becomes the
 * photograph it would have been had the finger come up.
 */
const CONFIGURE_TIMEOUT_MS = 5000;
/** Tries at starting the recorder, each after the session reconfigures. */
const RECORD_ATTEMPTS = 3;
/** A recording that fails sooner than this was a tap. See `startVideo`. */
const SHORT_FAILURE_MS = 1500;

/**
 * How fast a lens pill moves the zoom, and the two platforms do not even agree
 * on the unit.
 *
 * iOS hands it to `AVCaptureDevice.ramp(toVideoZoomFactor:withRate:)`, where it
 * is doublings per second: 1× to 3× is about one and a half doublings, so 8
 * gets there in a fifth of a second, which is the Camera app's own speed. On
 * Android VisionCamera runs a `ValueAnimator` and the same argument is its
 * duration, in milliseconds.
 */
const ZOOM_RAMP = Platform.OS === 'ios' ? 8 : 200;

/**
 * Every lens on the back, so that the device opened is the virtual one that
 * moves between them. See `lensModel`. The front has one lens and is left to
 * the platform's default.
 */
const BACK_LENSES: DeviceFilter = {
  physicalDevices: ['ultra-wide-angle', 'wide-angle', 'telephoto'],
};

/**
 * How a recording ended: with a file, or not at all.
 */
type RecordOutcome = { ok: true; uri: string } | { ok: false };

/** A zoom, in the session's units, and the device it was set on. */
interface DeviceZoom {
  device: string;
  value: number;
}

export function CameraScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const grants = useGrants();
  const uploads = useUploads();
  const focused = useIsFocused();

  const camera = useCameraPermission();
  const microphone = useMicrophonePermission();

  const cameraRef = useRef<CameraRef | null>(null);

  const [position, setPosition] = useState<'back' | 'front'>('back');
  const [flash, setFlash] = useState<FlashMode>('off');
  /** True while a hold wants the movie output in the session. See the header. */
  const [wantVideo, setWantVideo] = useState(false);

  const device = useCameraDevice(position, position === 'back' ? BACK_LENSES : undefined);
  const lens = useMemo(() => (device ? lensModel(device) : null), [device]);

  /*
   * The zoom, in the session's own units, and which device it belongs to.
   *
   * Keyed on the device because a zoom is only meaningful on the device it was
   * set on: the back camera's 3× is a number the front camera may not even
   * reach, and VisionCamera refuses a zoom outside the range rather than
   * clamping it. Turning the camera round therefore needs no reset — the key
   * stops matching and the new device starts at its own 1×.
   *
   * Two of them, because a pill's glide is run natively and the prop must
   * not cut across it. `shown` is what the pills say and moves the moment
   * one is pressed. `settled` is the `zoom` prop the session is held to,
   * and catches up when the glide lands — setting it at the start would have
   * VisionCamera `setZoom` straight to the end and cancel the ramp. The prop
   * is also what a new session opens at, which is why it has to be right:
   * the hold that adds the movie output must not snap a 3× shot back to 0.5×.
   *
   * The ref is for the gestures, which are built once and cannot close over
   * state.
   */
  const [shown, setShown] = useState<DeviceZoom | null>(null);
  const [settled, setSettled] = useState<DeviceZoom | null>(null);
  const zoomRef = useRef<DeviceZoom | null>(null);
  const lensRef = useRef<{ device: string; model: LensModel } | null>(null);
  useEffect(() => {
    lensRef.current = device && lens ? { device: device.id, model: lens } : null;
  }, [device, lens]);

  const neutralZoom = lens?.neutral ?? 1;
  const shownZoom = device && shown?.device === device.id ? shown.value : neutralZoom;
  const settledZoom = device && settled?.device === device.id ? settled.value : neutralZoom;

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
   * The two outputs, made once each. The photograph's is the reason for the
   * whole screen and is configured for it:
   *
   *  - 4032 × 3024, the main camera's own 12 MP. `condense` brings everything
   *    to 3840 on the long edge, so a 48 MP original would be four times the
   *    capture time and memory for a picture that arrives the same size.
   *  - `'quality'`, which is what lets iOS run Deep Fusion and the full Smart
   *    HDR pass rather than the fast one. It is the single biggest difference
   *    between this and the Camera app's sharpness, and it costs a fraction
   *    of a second after the shutter, not before it.
   *  - JPEG rather than the platform's own HEIC, because the content type is
   *    carried with the capture and the re-encode in `condense` is the same
   *    either way.
   */
  const photoOutput = usePhotoOutput({
    targetResolution: CommonResolutions.UHD_4_3,
    containerFormat: 'jpeg',
    quality: 1,
    qualityPrioritization: 'quality',
  });
  const videoOutput = useVideoOutput({
    targetResolution: CommonResolutions.HD_16_9,
    targetBitRate: VIDEO_BIT_RATE,
    // A denied microphone is a silent clip, not a failed one.
    enableAudio: microphone.hasPermission,
  });
  const outputs = useMemo(
    () => (wantVideo ? [photoOutput, videoOutput] : [photoOutput]),
    [wantVideo, photoOutput, videoOutput],
  );

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
  const recorderRef = useRef<Recorder | null>(null);
  const captureRef = useRef<Capture | null>(null);
  /** Whoever is waiting for the session to finish reconfiguring. */
  const configuredRef = useRef<(() => void)[]>([]);

  /*
   * The one-at-a-time guards that cannot be state, for the reason given at
   * each call site: a second press inside the same frame reads the value from
   * before the first one.
   */
  const sendingRef = useRef(false);
  const pickingRef = useRef(false);
  const shootingRef = useRef(false);

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
   * something. A refusal is not fatal — `enableAudio` above turns a denied
   * microphone into a silent clip rather than a broken one.
   */
  const { canRequestPermission: canAskCamera, requestPermission: requestCamera } = camera;
  const { canRequestPermission: canAskMicrophone, requestPermission: requestMicrophone } =
    microphone;

  useEffect(() => {
    if (!focused) return;
    if (canAskCamera) void requestCamera();
  }, [focused, canAskCamera, requestCamera]);

  useEffect(() => {
    if (!focused || !camera.hasPermission) return;
    if (canAskMicrophone) void requestMicrophone();
  }, [focused, camera.hasPermission, canAskMicrophone, requestMicrophone]);

  /* ---------------------------------------------------------------------- */
  /* Leaving the screen                                                      */
  /* ---------------------------------------------------------------------- */

  /*
   * A recording does not survive the tab losing focus, and the clip is lost
   * with it.
   *
   * `Camera` is unmounted below when `focused` goes false, and the session
   * goes with it, so a recording in flight ends in an error rather than a
   * file. That is worth stating plainly rather than implying a graceful stop
   * that does not happen.
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
        // Disown the recorder, which is what stops a run that is still
        // awaiting from writing state into a screen that has been left.
        runRef.current = null;
        recorderRef.current = null;
        stopRequestedRef.current = false;
        setRecording(false);
        setLocked(false);
        setStartedAt(null);
        setWantVideo(false);
      };
    }, []),
  );

  /* ---------------------------------------------------------------------- */
  /* The session                                                             */
  /* ---------------------------------------------------------------------- */

  const handleConfigured = useCallback(() => {
    const waiting = configuredRef.current;
    configuredRef.current = [];
    for (const resume of waiting) resume();
  }, []);

  /** Resolves true when the session next finishes configuring, false on timeout. */
  const nextConfigured = useCallback(
    () =>
      new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => resolve(false), CONFIGURE_TIMEOUT_MS);
        configuredRef.current.push(() => {
          clearTimeout(timer);
          resolve(true);
        });
      }),
    [],
  );

  /** The zoom as it is now, for gestures that cannot read it from state. */
  const readZoom = useCallback(() => {
    const current = lensRef.current;
    if (!current) return undefined;
    return zoomRef.current?.device === current.device ? zoomRef.current.value : current.model.neutral;
  }, []);

  const handleCameraError = useCallback((error: Error) => {
    /*
     * Interruptions, a device another app has just taken, a capture during a
     * reconfiguration: each of these is answered by the viewfinder still being
     * live to try again, and none is worth a dialog. Kept visible in
     * development, where the default handler's red box would be noise.
     */
    if (__DEV__) console.warn('[camera]', error.message);
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Capture                                                                 */
  /* ---------------------------------------------------------------------- */

  const takePhoto = useCallback(async () => {
    if (captureRef.current !== null || shootingRef.current) return;
    // A ref, because a quick second tap reads last render's state and would
    // take a second photograph over the first one's preview.
    shootingRef.current = true;

    try {
      const photo = await photoOutput.capturePhotoToFile(
        {
          // The front camera has no flash unit; asking for one is ignored
          // natively, but saying so here is clearer than relying on that.
          flashMode: device?.hasFlash ? flash : 'off',
          // The ultra wide's stretched corners, corrected the way the Camera
          // app corrects them. Ignored by lenses that do not need it.
          enableDistortionCorrection: true,
          // Lets a virtual device fuse frames from two lenses at an
          // in-between zoom, which is most of what makes 2× look like glass.
          enableVirtualDeviceFusion: true,
          /*
           * No `location`, which is what keeps GPS out of the file. The EXIF
           * block that remains is dropped by the re-encode in `condense` and
           * stripped again server-side.
           */
        },
        {},
      );
      // Re-checked: the await above is long enough for a recording to have
      // finished and claimed the preview.
      if (captureRef.current !== null) return;
      setRefused([]);
      setCapture({ uri: fileUri(photo.filePath), contentType: 'image/jpeg', kind: 'photo' });
    } catch {
      // A shutter that does not fire is not worth a dialog. The preview simply
      // does not appear, and the viewfinder is still live to try again.
    } finally {
      shootingRef.current = false;
    }
  }, [photoOutput, device, flash]);

  /**
   * Hold the shutter: put the movie output in the session, start recording,
   * and own the recorder until it stops.
   *
   * ## One owner at a time, by token
   *
   * `runRef` is the invocation that currently owns the recorder, and every
   * step below re-checks that it is still the owner before touching state. A
   * second concurrent recording is refused natively ("Active recording already
   * in progress"), but the *state* of two runs interleaving is this file's to
   * keep straight: a superseded run must not reset the state of the run that
   * superseded it.
   *
   * Every `await` here is a place the world can change: a preview can open, a
   * finger can lift, the tab can blur. A guard checked once at the top is a
   * guard that is wrong by the time the loop reaches its second attempt.
   */
  const startVideo = useCallback(async () => {
    if (captureRef.current !== null) return;
    // Somebody is already recording. Without this, holding the shutter during
    // a locked recording would start a second run against the same recorder.
    if (runRef.current !== null) return;

    const run = ++runCounterRef.current;
    runRef.current = run;
    stopRequestedRef.current = false;

    /** Still the invocation that owns the recorder? */
    const owns = () => runRef.current === run;
    /** Not worth starting any more: the finger is gone, or something else is on screen. */
    const abandoned = () => !owns() || stopRequestedRef.current || captureRef.current !== null;

    // Asked for before the state is set, so the configure it causes cannot
    // finish before anybody is listening for it.
    let configured = nextConfigured();
    setWantVideo(true);

    /** True once a file has reached the preview — the only real success. */
    let delivered = false;
    /** When the recorder started, or null if it never did. */
    let recordingSince: number | null = null;

    try {
      for (let attempt = 0; attempt < RECORD_ATTEMPTS; attempt += 1) {
        if (!(await configured) || abandoned()) return;

        /*
         * The outcome is carried *by* a promise rather than written into a
         * variable from the recorder's callbacks, so that it is a value with a
         * type rather than something the compiler has to guess at across a
         * closure.
         */
        let settle: (outcome: RecordOutcome) => void = () => {};
        const finished = new Promise<RecordOutcome>((resolve) => {
          settle = resolve;
        });

        let recorder: Recorder;
        try {
          recorder = await videoOutput.createRecorder({
            maxDuration: MAX_SECONDS,
            maxFileSize: VIDEO_MAX_BYTES,
          });
          await recorder.startRecording(
            (filePath) => settle({ ok: true, uri: fileUri(filePath) }),
            () => settle({ ok: false }),
          );
        } catch {
          /*
           * "Not yet connected": the configure that resolved above was one
           * already in flight — a microphone answer arriving, say — and not
           * the one that adds the movie output. That one is still coming.
           */
          configured = nextConfigured();
          continue;
        }

        if (!owns()) {
          // The tab blurred while the recorder was starting.
          void recorder.cancelRecording().catch(() => {});
          return;
        }

        recordingSince = Date.now();
        recorderRef.current = recorder;
        setRecording(true);
        setStartedAt(recordingSince);

        // The finger came up between the recorder being asked to start and it
        // starting. It asked to stop; it gets the moment it held for.
        if (stopRequestedRef.current) void recorder.stopRecording().catch(() => {});

        const outcome = await finished;

        // The tab may have blurred, or a newer run taken over, while the
        // recording was running. Its file is not this screen's business then.
        if (!owns()) return;

        if (outcome.ok) {
          delivered = true;
          setRefused([]);
          setCapture({ uri: outcome.uri, contentType: contentTypeForVideo(outcome.uri), kind: 'video' });
        }
        return;
      }
    } finally {
      if (owns()) {
        /*
         * A hold too short to become a recording is a tap, and gets a
         * photograph.
         *
         * Without this there is a dead band — long enough to pass `HOLD_MS`,
         * too short to outlast the session reconfiguration — where the finger
         * comes up before the recorder is ready and the person gets *nothing
         * at all*. A press that produces nothing is the one outcome a shutter
         * may never have.
         *
         * The same goes for a recording that *did* start and then failed in
         * its first moments, which is the same dead band seen from the other
         * side. When the session is slow to reconfigure — four seconds on an
         * Android emulator — the release can be queued behind it, arrive
         * just after the recorder starts, and stop a clip a fraction of a
         * second long, which CameraX then refuses to finalise. That press was
         * a tap as far as the person was concerned, and it gets a photograph.
         * A recording that ran for a while and then failed does not: a
         * picture appearing in place of the clip somebody watched themselves
         * record would be a stranger answer than nothing.
         *
         * Taken before the movie output is removed again, and after the
         * configure that added it has finished: a photograph asked for in the
         * middle of a reconfiguration is the one most likely to fail.
         */
        const tapInEffect = recordingSince === null || Date.now() - recordingSince < SHORT_FAILURE_MS;
        if (!delivered && tapInEffect && captureRef.current === null) {
          await configured;
          if (owns()) await takePhoto();
        }
      }

      // Ownership is released exactly once, by whoever still holds it.
      if (owns()) {
        runRef.current = null;
        recorderRef.current = null;
        stopRequestedRef.current = false;
        setRecording(false);
        setLocked(false);
        setStartedAt(null);
        setWantVideo(false);
      }
    }
  }, [nextConfigured, videoOutput, takePhoto]);

  /**
   * Release the shutter, or press a locked one.
   *
   * Records the intent as well as asking, because the release can land before
   * the recorder exists. `startVideo` reads it once the recorder is running.
   */
  const stopVideo = useCallback(() => {
    stopRequestedRef.current = true;
    void recorderRef.current?.stopRecording().catch(() => {});
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
  /* Zoom                                                                    */
  /* ---------------------------------------------------------------------- */

  /**
   * Move the zoom, and remember it against the device it was set on.
   *
   * `ramp` for a pill, which glides the way the Camera app's do — and on a
   * virtual device glides *across* a lens change, which is the whole effect.
   * Straight to the value for a pinch, which is already a stream of small
   * steps under a finger.
   */
  const applyZoom = useCallback((value: number, ramp: boolean) => {
    const current = lensRef.current;
    const view = cameraRef.current;
    if (!current) return;

    // The session's live range, which the constraints can narrow from the
    // device's own. Out of range is a rejection, not a clamp.
    const controller = view?.controller;
    const next = controller
      ? clamp(value, controller.minZoom, Math.min(controller.maxZoom, current.model.max))
      : value;

    const target: DeviceZoom = { device: current.device, value: next };
    zoomRef.current = target;
    setShown(target);

    // A pinch, or a session not up yet: the prop does it, straight there.
    if (!ramp || !view || !controller) {
      setSettled(target);
      return;
    }

    view.startZoomAnimation(next, ZOOM_RAMP).then(
      () => {
        // Only if nothing has moved the zoom since. A pinch that cut across
        // the glide has already settled its own value, and this must not
        // put the pill's back over it.
        if (zoomRef.current === target) setSettled(target);
      },
      () => {
        // Cancelled, which a pinch landing mid-glide does. That pinch is now
        // in charge of the zoom, and nothing is wrong.
      },
    );
  }, []);

  const pinchBase = useRef(1);

  const handlePinchBegin = useCallback(() => {
    pinchBase.current = readZoom() ?? 1;
  }, [readZoom]);

  const handlePinchUpdate = useCallback(
    (scale: number) => {
      const current = lensRef.current;
      if (!current) return;
      /*
       * Multiplied, not added, because that is what a pinch is: spreading the
       * fingers to twice their distance doubles the magnification, from
       * wherever it was. It is also what makes the gesture feel the same at
       * 0.5× as at 5×, where an added step would crawl at one end and leap at
       * the other.
       */
      applyZoom(clamp(pinchBase.current * scale, current.model.min, current.model.max), false);
    },
    [applyZoom],
  );

  /* ---------------------------------------------------------------------- */
  /* Gestures on the viewfinder                                              */
  /* ---------------------------------------------------------------------- */

  /**
   * Turn the camera round. The button's press, and the double tap's.
   *
   * `runRef` rather than the `recording` state, for the reason every other
   * guard in this file gives: a gesture is built once and cannot close over
   * state. Turning round swaps the device the session is recording from, and
   * that is worse from a gesture than from the button, because the button can
   * be greyed out and a finger cannot.
   */
  const flipCamera = useCallback(() => {
    if (runRef.current !== null) return;
    // The zoom needs no reset: it is keyed on the device. See `zoom`.
    setPosition((current) => (current === 'back' ? 'front' : 'back'));
  }, []);

  const handleTap = useCallback((x: number, y: number) => {
    setFocusAt({ x, y, at: Date.now() });
    /*
     * Focus *and* exposure at the point, the way the Camera app does it — the
     * face against a bright window comes up out of the dark, not just into
     * focus. The gesture layer covers the preview exactly, so its coordinates
     * are the preview's.
     *
     * Defaults on purpose: snappy, following the subject if it moves, and
     * handing back to continuous autofocus after a few seconds of nothing.
     * Rejects on a lens that cannot meter a point; the square still showed
     * where the finger landed, and the lens is still focusing on its own.
     */
    cameraRef.current?.focusTo({ x, y }).catch(() => {});
  }, []);

  /*
   * All three gestures built once, for the reason the shutter gives at length:
   * a gesture object replaced mid-pinch is a gesture swapped under a finger.
   *
   * The disable is narrow and is a false positive rather than a silenced
   * complaint. `react-hooks/refs` fires because a builder called during render
   * is handed callbacks that read refs, and it cannot see that Gesture
   * Handler only ever invokes them from a touch — the same reason the handlers
   * above are `useCallback`s. Everything the rule is actually protecting
   * against (a ref read whose value decides what is rendered) is absent: none
   * of these return anything, and the render reads the zoom from state.
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
   * Without it both fire on a double tap: the lens focuses, the camera turns
   * round, and the focus square is drawn on a preview that has just been
   * replaced. Exclusive makes the single tap wait for the double to fail,
   * which costs the focus the length of Gesture Handler's double-tap window —
   * a fifth of a second on a gesture nobody times.
   */
  const viewfinderGestures = useMemo(
    () => Gesture.Simultaneous(pinch, Gesture.Exclusive(doubleTap, tap)),
    [pinch, doubleTap, tap],
  );

  /* ---------------------------------------------------------------------- */
  /* The states before there is a camera                                     */
  /* ---------------------------------------------------------------------- */

  if (!camera.hasPermission) {
    return (
      <NoCamera
        canAskAgain={camera.canRequestPermission}
        onAsk={() => void requestCamera()}
      />
    );
  }

  const busy = sending || capture !== null;

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.deep }}>
      {/*
        Unmounted rather than paused when the tab is not focused. See the
        header — a live camera behind another screen is a battery cost and a
        privacy light with nothing on screen to account for it.

        No device is a simulator, or a phone whose camera another app holds:
        the deep background, and the chrome over it still works.
      */}
      {focused && device ? (
        <Camera
          ref={cameraRef}
          style={{ flex: 1 }}
          device={device}
          isActive
          outputs={outputs}
          /*
           * The front camera is a mirror, in both halves of the screen.
           *
           * `'auto'`, VisionCamera's default, written out because it is a
           * decision: the preview mirrors on the front camera, and so does
           * the file. The other way to make the two agree — un-mirror the
           * preview — was tried with expo-camera and made them agree on the
           * answer nobody wanted. A viewfinder that does not behave like a
           * mirror is wrong from the first frame: you lean left, and the
           * picture of you leans right. Tommy: *"the selfie camera is now
           * inverted... now it starts off inverted."*
           *
           * **This flips writing in the frame**, and that is the known cost:
           * a banner or a name tag behind somebody comes back backwards. It is
           * the trade every phone's "mirror front camera" setting makes, and
           * it is the right way round here because the subject of a selfie at
           * this church is a face, not a sign.
           */
          mirrorMode="auto"
          zoom={settledZoom}
          /*
           * The torch is the only thing "flash on" can mean while a movie is
           * recording; a strobe at the start of a clip is not a light. Left
           * unset on a camera with no torch, which would refuse even 'off' — and
           * on one with no flash, because an emulator's front camera reports a
           * torch it does not have.
           */
          torchMode={device.hasTorch && device.hasFlash ? (recording && flash === 'on' ? 'on' : 'off') : undefined}
          enableDistortionCorrection={device.supportsDistortionCorrection}
          onConfigured={handleConfigured}
          onError={handleCameraError}
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
          // Turning round mid-recording swaps the device the clip is being
          // recorded from. Better greyed out than silently ending a clip.
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

        <ZoomRow
          model={lens}
          zoom={shownZoom}
          onChoose={(value) => applyZoom(value, true)}
        />

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
            disabled={busy || destination.destination === null || !device}
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

/**
 * What the lenses on this side of the phone are, in the sender's numbers.
 *
 * `zoom` and `min`/`max` are the session's units; `factor` is what the pill
 * says, where 1 frames like the main camera.
 */
interface LensModel {
  /** The session zoom that frames like the main camera: "1×". */
  neutral: number;
  min: number;
  /** As far as a pinch goes. See `lensModel`. */
  max: number;
  stops: { factor: number; zoom: number }[];
}

/**
 * The pills this device should offer, and where 1× actually is.
 *
 * ---------------------------------------------------------------------------
 * ## Where 1× is, which is not where the session's 1 is
 *
 * An iPhone's virtual camera counts its zoom from its *widest* lens. On a
 * phone with an ultra wide, a session zoom of 1 is the ultra wide — the
 * Camera app's 0.5× — and the main camera takes over at the first switch-over
 * factor, which is 2. So "1×" is that first switch-over, and every other
 * number is a ratio to it: switch-overs of `[2, 6]` are the main camera and a
 * 3× telephoto, `[2, 10]` a 5×, `[2, 5]` the 12 Pro Max's 2.5×. These are the
 * phone's own numbers, which is the point: nothing here is a table of models
 * that the next iPhone will be missing from.
 *
 * Android's CameraX already counts from the main camera — the ultra wide sits
 * below 1 as the device's `minZoom` — and VisionCamera reports no switch-over
 * factors there, so 1 is 1.
 *
 * ## The 2× that is not a lens
 *
 * Phones with a 48 MP main sensor get a 2× pill on the Camera app with no 2×
 * lens behind it: it is the middle of the sensor read at full resolution,
 * which is as sharp as glass. Offered on the same condition — a photo
 * resolution of 40 MP or more — and only where no real lens is already near
 * it. Android gets it from 2× of zoom range alone: a Pixel's row is 0.5, 1, 2
 * whatever its sensor is, and a crop of a 50 MP sensor is what that 2× is.
 * The back camera only, on both: no phone offers a 2× crop of the selfie
 * camera.
 *
 * ## And the telephoto Android does not get
 *
 * CameraX moves to the telephoto by itself as a pinch crosses it, so the lens
 * is reachable; what is missing is its *number*. VisionCamera's switch-over
 * factors are empty on Android, and the focal lengths it does report are
 * millimetres on sensors of different sizes — a Pixel's 5× comes out of that
 * division as 2.6. A pill that says 2.6 on a 5× lens is a lie told every time
 * the camera opens, so the row stops at what it knows.
 *
 * ## How far a pinch goes
 *
 * Five times the longest lens, and never less than 10× — the Camera app's own
 * limits on every iPhone (15× on a 3×, 25× on a 5×). Beyond that the
 * session's maximum is a digital crop that nobody would send.
 * ---------------------------------------------------------------------------
 */
function lensModel(device: CameraDevice): LensModel {
  const switches = device.zoomLensSwitchFactors;
  const hasUltraWide = device.physicalDevices.some((lens) => lens.type === 'ultra-wide-angle');

  const neutral = (hasUltraWide ? switches[0] : undefined) ?? 1;
  const min = device.minZoom;

  const factors: number[] = [];
  const add = (factor: number) => {
    if (!factors.some((existing) => Math.abs(existing - factor) < 0.05)) factors.push(factor);
  };

  // The ultra wide, when there is room below the main camera for it.
  if (min < neutral * 0.95) add(min / neutral);
  add(1);
  for (const factor of switches) {
    if (factor > neutral * 1.05) add(factor / neutral);
  }

  const near2 = factors.some((factor) => factor > 1.5 && factor < 2.6);
  if (!near2 && device.maxZoom >= neutral * 2 && hasSensorCrop(device)) add(2);

  factors.sort((a, b) => a - b);
  const longest = factors[factors.length - 1] ?? 1;
  const max = Math.min(device.maxZoom, neutral * Math.max(10, longest * 5));

  return {
    neutral,
    min,
    max,
    stops: factors.map((factor) => ({ factor, zoom: factor * neutral })),
  };
}

/** A main sensor with the resolution to crop 2× out of it. See `lensModel`. */
function hasSensorCrop(device: CameraDevice): boolean {
  // The back camera's alone, on both platforms: no phone's own camera offers
  // a 2× crop of the selfie camera, and the front sensors are too small to
  // give one without it showing.
  if (device.position !== 'back') return false;
  if (Platform.OS === 'android') return true;
  return device
    .getSupportedResolutions('photo')
    .some((size) => size.width * size.height >= 40_000_000);
}

/** "0.5", "1", "2.5" — the Camera app's own numbers, with no trailing ".0". */
function formatFactor(factor: number): string {
  const rounded = Math.round(factor * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/**
 * The lens pills, over the viewfinder and above the destination.
 *
 * Where every phone camera puts them, because that is where a thumb already
 * goes looking — and drawn the way the Camera app draws them: the numbers bare,
 * and the lit one carrying the "×" and the zoom as it actually is, so a pinch
 * to 1.4× reads "1.4×" on the 1 pill. Pressing that pill again is the way
 * back to exactly 1×, which is the one-finger undo a pinch never had.
 *
 * Pressable mid-recording, as in the Camera app: a zoom is a change of
 * framing, not of session, and the virtual device carries a clip across a
 * lens change as smoothly as a preview.
 *
 * With a single lens — a front camera — there is nothing to choose between
 * and the row is gone, until a pinch moves away from 1× and the one pill
 * comes back to say where it is and to undo it.
 */
function ZoomRow({
  model,
  zoom,
  onChoose,
}: {
  model: LensModel | null;
  zoom: number;
  onChoose: (zoom: number) => void;
}) {
  const theme = useTheme();

  if (!model) return null;

  const factor = zoom / model.neutral;
  const zoomed = Math.abs(factor - 1) > 0.05;
  if (model.stops.length < 2 && !zoomed) return null;

  // The lit pill: the longest lens at or below the zoom. A pinch past 3×
  // stays on the 3 pill and counts up from there.
  let active = 0;
  model.stops.forEach((stop, index) => {
    if (stop.factor <= factor + 0.01) active = index;
  });

  return (
    <View
      style={{
        flexDirection: 'row',
        alignSelf: 'center',
        alignItems: 'center',
        gap: 2,
        padding: 3,
        borderRadius: theme.radius.full,
        backgroundColor: theme.color.deep,
        opacity: 0.9,
      }}
    >
      {model.stops.map((stop, index) => {
        const lit = index === active;
        const label = lit ? `${formatFactor(factor)}×` : formatFactor(stop.factor);

        return (
          <Pressable
            key={stop.factor}
            onPress={() => onChoose(stop.zoom)}
            accessibilityRole="button"
            accessibilityState={{ selected: lit }}
            accessibilityLabel={`Zoom to ${formatFactor(stop.factor)} times`}
            hitSlop={4}
            style={({ pressed }) => ({
              minWidth: 40,
              height: 34,
              paddingHorizontal: theme.space.xs,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: theme.radius.full,
              /*
                The chosen lens is the light one, which is the inverse of every
                other selected thing in this app — and right here, because the
                whole of this chrome is light-on-dark over a photograph. Filled
                in the church's cream rather than its red: red on the deep scrim
                is barely a change at arm's length in sunlight.
              */
              backgroundColor: lit
                ? theme.color.inkInverse
                : pressed
                  ? theme.color.deep
                  : 'transparent',
            })}
          >
            <Micro color={lit ? theme.color.deep : theme.color.inkInverse}>{label}</Micro>
          </Pressable>
        );
      })}
    </View>
  );
}

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

/**
 * A path VisionCamera wrote, as a uri the rest of the app can read.
 *
 * VisionCamera returns bare filesystem paths; `expo-image`, the image
 * manipulator in `condense` and the upload queue all want `file://`. Left alone
 * when it already is one, so this does not depend on which platform adds it.
 */
function fileUri(path: string): string {
  return path.startsWith('file://') ? path : `file://${path}`;
}
