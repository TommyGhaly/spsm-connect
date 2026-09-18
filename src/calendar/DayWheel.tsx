/**
 * The seven days of the week, as a wheel you turn.
 *
 * ---------------------------------------------------------------------------
 * It picks a day. It used to *be* the day, and that was the whole problem.
 *
 * The first version put each day's entire schedule inside the wheel: the
 * centred day rendered its services in full and the other six collapsed to a
 * line. That forced three things, each following from the last.
 *
 * **Every slot had to be the same height, and that height had to be the
 * busiest day's.** If a slot sized itself to its own contents then centring a
 * day would grow it, which moves everything below it, which changes what is
 * centred — the wheel hunts and never settles. So the slot was measured across
 * all seven days and the tallest won.
 *
 * **Which meant a quiet day was mostly empty.** A Saturday with six services
 * set the slot at seven hundred points; a Tuesday with one then drew a single
 * row centred in seven hundred points of blank paper, and the blank was on
 * screen whether or not anything was in it.
 *
 * **And the wheel was a scroll view inside the page's scroll view.** Two
 * vertical scrollers stacked in the same column, one of them six hundred points
 * tall, so a thumb anywhere on the calendar could turn the wheel or move the
 * page and there was no way to tell which by looking.
 *
 * A wheel is a picker, and a picker's rows are short and all the same. That is
 * the fix, and everything else falls out of it: rows are a fixed {@link ROW}
 * points tall, so nothing is measured, the snap interval is exact, and there is
 * no slot big enough to be empty. The day it picks is rendered *beside* it, by
 * `DaySchedule`, in a region of its own — so the two scrollers are siblings in
 * separate parts of the screen rather than one inside the other.
 * ---------------------------------------------------------------------------
 *
 * What the phone does that the browser cannot: the tilt and the fade are driven
 * straight off the scroll offset through the native driver, so they are
 * continuous rather than a transition between two settled states — the wheel
 * turns under the thumb instead of catching up after it. `snapToInterval` with
 * `disableIntervalMomentum` is the native spelling of `scroll-snap-stop:
 * always`: one day per gesture, however hard the flick.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView,
} from 'react-native';
import { dayParts, type CalendarOccurrence, type ViewRange } from '@spsm/shared';

import { Icon } from '@/components/Icon';
import { Micro, Small, Subheading } from '@/components/Type';
import { useTheme } from '@/theme/ThemeProvider';

import { Dots } from './Dots';

/**
 * One day, in points. Fixed, and that is the point of the file.
 *
 * 52 rather than the 44 of a minimum touch target: the row carries a weekday, a
 * date in a disc the size of the month grid's, and a run of dots, and at 44 the
 * disc touches the row above it.
 */
const ROW = 52;

/** Rows either side of the centred one. One, and the tilt implies the rest. */
const PEEK = 1;

/** Degrees of tilt per row away from the centre. The website's own 14. */
const TILT = 14;

export function DayWheel({
  range,
  byDay,
  today,
  picked,
  onPick,
  recentre,
}: {
  range: ViewRange;
  byDay: Map<string, CalendarOccurrence[]>;
  today: string;
  /** The day whose schedule is on screen. Held by the screen, not by the wheel. */
  picked: string;
  onPick: (day: string) => void;
  /**
   * Bumped by the Today button to bring the wheel back to today.
   *
   * A counter rather than a boolean, because the interesting case is pressing
   * Today when the week on screen *already* contains it — the reader has turned
   * the wheel off today and wants to come back. Nothing else about the props
   * changes, so there would be no edge for an effect to fire on.
   */
  recentre: number;
}) {
  const theme = useTheme();

  const scroller = useRef<ScrollView>(null);
  const [scrollY] = useState(() => new Animated.Value(0));

  const index = Math.max(0, range.days.indexOf(picked));

  /**
   * Put the wheel on the picked day when something other than the wheel
   * decided it: a new week, or the Today button.
   *
   * Keyed rather than dependent, so a pick made *by* the wheel — which changes
   * `index` and nothing else — does not land here. Not animated either: a week
   * that arrives already on Wednesday is a week that was *drawn* that way, and
   * sliding into place would say something moved when nothing did.
   */
  const jumpFor = `${range.from}:${recentre}`;
  const jumped = useRef('');

  useEffect(() => {
    if (jumped.current === jumpFor) return;
    jumped.current = jumpFor;

    scroller.current?.scrollTo({ y: index * ROW, animated: false });

    /*
     * And tell the animated value where the wheel now is, which is not
     * something it can find out for itself: a programmatic `scrollTo` with
     * `animated: false` emits no scroll event on either platform, so the value
     * driving the tilt and the fade would stay wherever the last *gesture* left
     * it. On a first render that is zero, and the week opens with Monday lit
     * and today greyed out at the bottom — a fault that corrects itself the
     * instant anybody touches it, which is the worst kind.
     */
    scrollY.setValue(index * ROW);
  }, [jumpFor, index, scrollY]);

  const onScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
        useNativeDriver: true,
        /*
         * Compared against the day already on screen rather than against a
         * count of its own, which is what keeps the wheel and the screen from
         * arguing: turning the wheel through four days fires this at every
         * notch, and three of those four calls are the day the screen is
         * already showing. The jump above is keyed on the week rather than on
         * the day, so a pick made *by* the wheel never scrolls it again.
         */
        listener: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
          const next = Math.min(
            range.days.length - 1,
            Math.max(0, Math.round(event.nativeEvent.contentOffset.y / ROW)),
          );

          const day = range.days[next];
          if (day && day !== picked) onPick(day);
        },
      }),
    [scrollY, range.days, picked, onPick],
  );

  /**
   * How a row leans, shrinks and fades with its distance from the centre.
   *
   * Only transform and opacity respond to that distance, and deliberately: both
   * are composited, so neither can change the layout and feed back into which
   * row is centred.
   */
  const leanOf = (row: number) => {
    const centre = row * ROW;
    const at = (steps: number) => centre + steps * ROW;

    return {
      opacity: scrollY.interpolate({
        inputRange: [at(-2), at(-1), centre, at(1), at(2)],
        outputRange: [0.15, 0.55, 1, 0.55, 0.15],
        extrapolate: 'clamp' as const,
      }),
      transform: [
        { perspective: 640 },
        {
          rotateX: scrollY.interpolate({
            inputRange: [at(-2), at(2)],
            outputRange: [`-${TILT * 2}deg`, `${TILT * 2}deg`],
            extrapolate: 'clamp' as const,
          }),
        },
        {
          scale: scrollY.interpolate({
            inputRange: [at(-2), at(-1), centre, at(1), at(2)],
            outputRange: [0.84, 0.93, 1, 0.93, 0.84],
            extrapolate: 'clamp' as const,
          }),
        },
      ],
    };
  };

  /**
   * How far the wheel can turn, in points. Read by the two chevrons below to
   * know when there is nothing left in their direction.
   */
  const travel = Math.max(0, (range.days.length - 1) * ROW);

  return (
    <View>
      {/*
        The selection band, behind the wheel.

        A raised, rounded band rather than the pair of hairlines this had while
        the rows were whole schedules. Hairlines were right when the thing
        between them was half the screen and a fill would have put a second
        background behind six services; a fill is right now that it is one row,
        because that is what a picker's selection looks like and the reader is
        being asked to read it as a control.
      */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: PEEK * ROW,
          height: ROW,
          borderRadius: theme.radius.md,
          backgroundColor: theme.color.paperRaised,
          borderWidth: 1,
          borderColor: theme.color.rule,
        }}
      />

      {/*
        The one thing the wheel could not say for itself: that it turns.

        Everything else here is a *consequence* of turning — the tilt, the fade,
        the band — and all of it is legible only once something has moved. Still,
        on the first frame, the wheel is a lit row with two dim rows near it,
        which is what a disabled list looks like as readily as what a picker
        looks like. Somebody who does not try the gesture never sees the answer,
        and the complaint was exactly that: not knowing there was anything to
        try.

        So a pair of chevrons, in the band, on the side the rows leave empty.
        Two rather than one, because the wheel goes both ways and a lone
        down-arrow reads as "more below" — a list's mark, not a dial's.

        Each fades with the offset, through the same native driver as the tilt:
        the up one is gone on Sunday and the down one on Saturday, so the pair
        is also where the reader is in the week. `pointerEvents` is off on the
        wrapper — the row underneath is the tap target, and a chevron that
        swallowed a tap on Wednesday would be a mark that lies about being a
        button.
      */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          right: theme.space.sm,
          top: PEEK * ROW,
          height: ROW,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Animated.View
          style={{
            // Pointing up: the same glyph the rest of the app uses for a
            // disclosure, turned over, rather than a second path to keep in
            // step with the website's — see `Icon`'s header.
            transform: [{ rotate: '180deg' }],
            // The two glyphs nest rather than stack. 1.6 of stroke twice over
            // with the viewBox's own slack between them reads as a gap in a
            // 52pt row; pulled together they read as one mark with two ends.
            marginBottom: -5,
            opacity: scrollY.interpolate({
              inputRange: [0, ROW * 0.5],
              outputRange: [0, 1],
              extrapolate: 'clamp',
            }),
          }}
        >
          <Icon name="chevron" size={16} color={theme.color.inkFaint} />
        </Animated.View>
        <Animated.View
          style={{
            opacity: scrollY.interpolate({
              // A week is always seven days, so `travel` is never zero in
              // practice — but a range of one day would make this a flat
              // interpolation, which throws. Guarded by the `max` below.
              inputRange: [Math.max(0, travel - ROW * 0.5), Math.max(1, travel)],
              outputRange: [1, 0],
              extrapolate: 'clamp',
            }),
          }}
        >
          <Icon name="chevron" size={16} color={theme.color.inkFaint} />
        </Animated.View>
      </View>

      <Animated.ScrollView
        ref={scroller}
        style={{ height: ROW * (PEEK * 2 + 1) }}
        /* The padding is what lets the first and last days reach the centre.
           Without it Monday can never be picked — there is nothing above it to
           scroll — and the wheel opens jammed against its top. */
        contentContainerStyle={{ paddingVertical: PEEK * ROW }}
        // A bar down the side of a picker is not a thing.
        showsVerticalScrollIndicator={false}
        snapToInterval={ROW}
        snapToAlignment="start"
        // One day per gesture, however hard the flick. Without it a single hard
        // swipe carries through three or four days and lands wherever the
        // momentum ran out, which is what makes a wheel feel twitchy.
        disableIntervalMomentum
        decelerationRate="fast"
        scrollEventThrottle={16}
        onScroll={onScroll}
        accessibilityLabel={`Pick a day, ${range.label}`}
        // Said, because the chevrons cannot be: they are a drawing, and a
        // drawing of an affordance is not available to somebody who is having
        // this row read to them rather than looking at it.
        accessibilityHint="Swipe up or down to turn through the week."
      >
        {range.days.map((day, row) => (
          <Animated.View key={day} style={[{ height: ROW }, leanOf(row)]}>
            <DayRow
              day={day}
              entries={byDay.get(day) ?? []}
              isToday={day === today}
              isPicked={row === index}
              // The rows either side are on screen and a tap on one is the
              // obvious way to reach it. Animated, because this one *is* a
              // move: the reader asked the wheel to turn.
              onPress={() => scroller.current?.scrollTo({ y: row * ROW, animated: true })}
            />
          </Animated.View>
        ))}
      </Animated.ScrollView>
    </View>
  );
}

/* -------------------------------------------------------------------------- */

/** One day: what it is called, what date it is, and how full it is. */
function DayRow({
  day,
  entries,
  isToday,
  isPicked,
  onPress,
}: {
  day: string;
  entries: CalendarOccurrence[];
  isToday: boolean;
  isPicked: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const parts = dayParts(day);

  return (
    <Pressable
      onPress={onPress}
      /*
       * `tab` rather than `button`: this marks which of a set of seven is the
       * one being read. A button would say each row does something of its own.
       */
      accessibilityRole="tab"
      accessibilityState={{ selected: isPicked }}
      accessibilityLabel={`${parts.weekday} ${parts.month} ${parts.dayOfMonth}${
        isToday ? ', today' : ''
      } — ${entries.length === 0 ? 'nothing scheduled' : `${entries.length} scheduled`}`}
      style={{
        height: ROW,
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.sm,
        paddingHorizontal: theme.space.sm,
      }}
    >
      <Small color={theme.color.inkFaint}>{parts.weekdayShort.toUpperCase()}</Small>

      {/*
        The date in a disc, and the disc is what today is marked on — the same
        mark the month grid uses, so "today" is one shape everywhere on this
        screen rather than a badge here and a fill there.
      */}
      <View
        style={{
          minWidth: 30,
          height: 30,
          paddingHorizontal: 2,
          borderRadius: theme.radius.full,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isToday ? theme.color.accent : 'transparent',
        }}
      >
        <Subheading color={isToday ? theme.color.inkInverse : theme.color.ink}>
          {parts.dayOfMonth}
        </Subheading>
      </View>

      {entries.length > 0 ? (
        <Dots entries={entries} />
      ) : (
        <Micro color={theme.color.inkFaint}>Nothing scheduled</Micro>
      )}

      <View style={{ flex: 1 }} />
    </Pressable>
  );
}
