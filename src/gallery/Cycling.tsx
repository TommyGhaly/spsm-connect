/**
 * A tile that cross-fades through a handful of a gathering's photographs.
 *
 * ---------------------------------------------------------------------------
 * The website's ministry plates, its Events menu tiles, and a gallery's
 * side-shelf tiles all cycle; the app's drew one still cover for each. Tommy
 * decided the app should do what the site does — and what the site does, since
 * its commit 2eebb50, is take up to eight photographs *spread across* the whole
 * event (`spreadAcross` in `@spsm/shared`) and open on a random one of them each
 * visit (`useShuffled`), so a camp of six hundred photographs is shown as an
 * overview of the camp rather than as the same picture from its first morning.
 *
 * Three pieces, so each screen takes only what it needs:
 *
 *   - `coversOf` — which photographs, out of a flat window of a ministry's
 *     media. The level summaries already answer this in `summariseChildren`.
 *   - `Crossfade` — the cycle itself, around whatever a caller draws for one
 *     picture. The drawer's 38pt thumbnails use it directly.
 *   - `CyclingPicture` — `Crossfade` around `Picture`, with `NoPictures` for a
 *     gathering with none, which is what the directory and the shelf draw.
 * ---------------------------------------------------------------------------
 */
import { Image } from 'expo-image';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import { SUMMARY_COVERS, hasRenderableFile, spreadAcross } from '@spsm/shared';

import { NoPictures, Picture } from '@/gallery/Picture';
import type { MediaRow } from '@/gallery/data';
import { focalContentPosition, posterUrl } from '@/gallery/media';
import { useShuffled } from '@/gallery/useShuffled';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * How long each picture holds, fade included.
 *
 * **3.2s, the website's figure for every tile that stands still** — the level
 * cards (`CARD_CYCLE_MS`), the side shelf (`SHELF_CYCLE_MS`) and the Events
 * menu (`NAV_CYCLE_MS`), which the site keeps equal on purpose so two of them
 * on screen at once never drift in and out of step.
 *
 * Not the 1.4s of the site's `/events` plates, and the site says why in its own
 * comment on `CYCLE_MS`: those plates drift past on a moving rail at 225px/s
 * and are in front of a reader for a few seconds, so a slow cycle would never
 * be seen. The app's directory is a still column of tiles somebody scrolls
 * through at their own pace — the case the 3.2s was chosen for — and a 200pt
 * photograph turning over every 1.4s beside the words would be the flicker in
 * the corner of the eye the shelf's comment warns about.
 */
export const CYCLE_MS = 3200;

/**
 * How long the cross-fade takes — the website's 500ms `opacity` transition, at
 * its `ease` curve.
 *
 * Paired with `CYCLE_MS`, as on the site: a fade longer than the hold never
 * settles on a single picture. **Change one and check the other.**
 */
export const FADE_MS = 500;

/** CSS's `ease`, which is what the site's transition names. */
const EASE = Easing.bezier(0.25, 0.1, 0.25, 1);

/**
 * How many photographs a tile cycles through — the site's `CYCLE_MAX` and
 * `SUMMARY_COVERS`, both eight, and taken from the shared one so a level's
 * card and a ministry's tile cannot disagree.
 *
 * Only two of them are ever drawn at once (see `Crossfade`), so the count is a
 * question of how long before the tile repeats, not of memory.
 */
export const CYCLE_MAX = SUMMARY_COVERS;

/**
 * The photographs a ministry's tile cycles through, out of a flat window of
 * its media in gallery order.
 *
 * The same three conditions the single cover was chosen by, and all three are
 * load-bearing: a photograph rather than a clip, because a tile has no player;
 * `onPage`, so nothing an administrator has not placed stands for the
 * ministry; and `hasRenderableFile`, so a picture still transcoding is not a
 * tile that blinks to blank once per lap. Then spread across what is left
 * rather than its first few — the site's `programTileMedia`, less the
 * homepage-showcase preference, which is about the site's homepage and has no
 * counterpart here.
 */
export function coversOf(media: readonly MediaRow[]): MediaRow[] {
  return spreadAcross(
    media.filter(
      (item) => item.kind === 'photo' && item.placement.onPage && hasRenderableFile(item),
    ),
    CYCLE_MAX,
  );
}

/**
 * Whether the person has asked the phone for less motion.
 *
 * The app's first reader of the setting: until now nothing in it moved on its
 * own. The site answers `prefers-reduced-motion` on every tile by not starting
 * the cycle and leaving the first picture up, because a slideshow is exactly
 * the unattended movement that setting is about — and this is the same answer,
 * from iOS's Reduce Motion and Android's remove-animations switch.
 *
 * Assumed off until the answer arrives. The first fade is a whole hold away,
 * and the question is answered in well under that.
 */
function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (live) setReduce(value);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      live = false;
      subscription.remove();
    };
  }, []);

  return reduce;
}

/**
 * The cycle, around whatever one picture looks like.
 *
 * ## Two layers, not eight
 *
 * The site stacks every picture and lets opacity choose, so the next one is
 * already decoded when its turn comes. A phone pays for decoded bitmaps in a
 * way a desktop browser mostly does not, and a directory of five ministries ×
 * eight photographs is forty decoded images for a screen that shows five. So
 * this draws the picture showing and the one coming next — the next mounted
 * underneath the hold, invisible, so it has a whole hold to arrive — and
 * nothing else. `memory-disk` caching is what makes the second lap free.
 *
 * ## The fade
 *
 * The one arriving fades in *over* the one leaving, which stays fully opaque
 * beneath it until it is covered. That is the site's `z-index: 1` on the
 * current shot, taken one step further: there the outgoing picture also fades
 * out, so both are partly transparent mid-fade and the ground shows through;
 * here the ground never does.
 *
 * Each layer is keyed by its *step* — how many turns the tile has taken — and
 * its opacity is `progress` mapped across its own step, so the layer that has
 * just faded in becomes "the current one" without anything about it changing:
 * same element, same image, same opacity. Keying by position instead would
 * swap the two images between their views at the end of every fade, which is
 * a reload of both and a visible blink.
 *
 * ## When it does not move
 *
 * With fewer than two pictures, under Reduce Motion, or while `running` is
 * false — the drawer shut, the directory under a ministry's page. Each tile has
 * its own timer rather than one per screen, so a tile is self-contained and a
 * screen does not have to thread a counter through; `delay` is how a screen
 * that wants its tiles to ripple rather than turn in lockstep asks for it.
 */
export function Crossfade({
  items,
  running = true,
  delay = 0,
  render,
}: {
  items: readonly MediaRow[];
  /** False to hold on the current picture — off screen, or a menu shut. */
  running?: boolean;
  /** Extra time before the first turn after a (re)start, for a ripple across a list. */
  delay?: number;
  /**
   * One picture, filling its layer. `fail` is for the image's `onError`: a
   * document naming a rendition whose file is not there drops out of the cycle
   * instead of being a blank lap.
   */
  render: (item: MediaRow, fail: () => void) => ReactNode;
}) {
  const reduce = useReduceMotion();
  const [broken, setBroken] = useState<ReadonlySet<string>>(() => new Set());
  const [step, setStep] = useState(0);
  // State rather than a ref so the value is the same object for the life of
  // the tile without reading a ref during render.
  const [progress] = useState(() => new Animated.Value(0));
  /*
   * Whether the effect below is re-running because a fade just finished, as
   * against starting fresh — on mount, or resuming after the drawer was shut or
   * the screen covered. `delay` is paid on every fresh start and never between
   * turns, so a list of tiles keeps its ripple across a pause instead of all
   * resuming on one frame, and never drifts apart while it runs.
   */
  const turned = useRef(false);

  // A random order per visit, so the tile does not open on the same picture
  // every time. The set itself was chosen upstream, by `coversOf` or
  // `summariseChildren`.
  const shots = useShuffled(items, (item) => item.id).filter((item) => !broken.has(item.id));
  const length = shots.length;
  const moving = running && !reduce && length >= 2;

  useEffect(() => {
    if (!moving) return;

    let finished = false;
    let fade: Animated.CompositeAnimation | null = null;

    // The hold is the gap between fades, so the period — fade included — is
    // `CYCLE_MS`, which is how the site's interval counts it too.
    const timer = setTimeout(
      () => {
        fade = Animated.timing(progress, {
          toValue: step + 1,
          duration: FADE_MS,
          easing: EASE,
          useNativeDriver: true,
        });
        fade.start(({ finished: done }) => {
          if (!done) return;
          finished = true;
          turned.current = true;
          setStep(step + 1);
        });
      },
      CYCLE_MS - FADE_MS + (turned.current ? 0 : delay),
    );
    turned.current = false;

    return () => {
      clearTimeout(timer);
      if (fade && !finished) {
        // Stopped mid-fade — the drawer shut, Reduce Motion switched on. Put
        // the current picture back outright rather than leave a double
        // exposure up until the cycle next starts.
        fade.stop();
        progress.setValue(step);
      }
    };
  }, [moving, step, delay, progress]);

  if (length === 0) return null;

  const fail = (id: string) =>
    setBroken((was) => {
      if (was.has(id)) return was;
      const next = new Set(was);
      next.add(id);
      return next;
    });

  const layers = moving ? [step, step + 1] : [step];

  return (
    <>
      {layers.map((at) => {
        const item = shots[at % length]!;
        return (
          <Animated.View
            key={at}
            style={[
              StyleSheet.absoluteFill,
              {
                opacity:
                  at === 0
                    ? 1
                    : progress.interpolate({
                        inputRange: [at - 1, at],
                        outputRange: [0, 1],
                        extrapolate: 'clamp',
                      }),
              },
            ]}
          >
            {render(item, () => fail(item.id))}
          </Animated.View>
        );
      })}
    </>
  );
}

/**
 * A cycling plate: `Picture` cross-fading through `covers`, or the church's
 * seal for a gathering with none.
 *
 * The plate's own ground is `paperSunken`, so the instant before the first
 * picture arrives reads as a frame waiting for its photograph rather than a
 * hole, and an image that fails mid-lap shows that ground rather than nothing.
 */
export function CyclingPicture({
  covers,
  height,
  rounded = true,
  running,
  delay,
}: {
  covers: readonly MediaRow[];
  height: number;
  rounded?: boolean;
  running?: boolean;
  delay?: number;
}) {
  const theme = useTheme();

  // `NoPictures` rather than an empty plate: see the note on it.
  if (covers.length === 0) return <NoPictures height={height} rounded={rounded} />;

  return (
    <View
      style={{
        height,
        borderRadius: rounded ? theme.radius.sm : 0,
        overflow: 'hidden',
        backgroundColor: theme.color.paperSunken,
      }}
    >
      <Crossfade
        items={covers}
        running={running}
        delay={delay}
        render={(item, fail) => (
          <Picture media={item} height={height} rounded={false} onError={fail} />
        )}
      />
    </View>
  );
}

/**
 * The same cycle at a thumbnail's size, for a row that is a name first and a
 * picture second — the drawer's events.
 *
 * `expo-image` directly rather than `Picture`, for the reason the drawer gave
 * when it had one still cover: `Picture` has a "Processing…" state that at
 * 38pt is a grey box of unreadable text. Hidden from screen readers for the
 * same reason too — the ministry's name is the row's label.
 */
export function CyclingThumb({
  covers,
  size,
  running,
  fallback,
}: {
  covers: readonly MediaRow[];
  size: number;
  running?: boolean;
  /** What the row shows with no photograph to show. */
  fallback: ReactNode;
}) {
  const theme = useTheme();

  if (covers.length === 0) return <>{fallback}</>;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: theme.radius.sm,
        overflow: 'hidden',
        backgroundColor: theme.color.paperSunken,
      }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Crossfade
        items={covers}
        running={running}
        render={(item, fail) => <Thumbnail media={item} onError={fail} />}
      />
    </View>
  );
}

function Thumbnail({ media, onError }: { media: MediaRow; onError: () => void }) {
  // `coversOf` has already promised a file, so a null here is a document that
  // changed under the tile; drawing nothing lets the plate's ground show.
  const url = posterUrl(media);
  if (url === null) return null;

  return (
    <Image
      source={{ uri: url }}
      style={{ width: '100%', height: '100%' }}
      contentFit="cover"
      // A 38pt square is a brutal crop, and the middle of a photograph is very
      // often not the face in it.
      contentPosition={focalContentPosition(media.focal)}
      // A drawer is opened over and over, and the memory tier is what stops
      // these refetching each time — and what makes the second lap free.
      cachePolicy="memory-disk"
      transition={180}
      onError={onError}
    />
  );
}
