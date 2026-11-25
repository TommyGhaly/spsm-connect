/**
 * The week view: the seven dates across the top as tabs, and under them a wheel
 * you scroll through the days.
 *
 * ---------------------------------------------------------------------------
 * The website's `WeekView` and the App Clip's `DayWheel`, as a scroll view.
 *
 * Every day is a slot at least the height of the wheel less a strip above and
 * below, and taller if the day needs it. The scroll view snaps to a list of
 * stops — the top of every day, and the end of any day too long to fit — one
 * stop per flick however hard (`disableIntervalMomentum`, the native spelling
 * of the website's `scroll-snap-stop: always`). So a flick on a short day
 * turns to the next one, and on a long day it first brings the rest of it into
 * view and then turns.
 *
 * **One scroller, on purpose.** The day's services used to scroll inside the
 * card, and on iOS a scroll view nested in another keeps the gesture at its
 * end rather than handing it on — the wheel could not be turned past a busy
 * Monday at all. Letting the day be as tall as it is, and the wheel stop at its
 * end, is the same reading order without a second thing to scroll.
 *
 * The neighbours are folded: in the centre a slot shows its card, and as it
 * leaves it fades to a single line of date and dots at the edge nearest the
 * middle, tilting away as it goes. All of that is interpolated straight off
 * the scroll offset on the native driver, so the wheel turns under the thumb
 * rather than catching up after it.
 *
 * The tabs are the clip's, not the website's pips. Pips down the side cost the
 * card the width its pictures need; a strip across the top does the same two
 * jobs (where am I in the week, take me to Saturday).
 * ---------------------------------------------------------------------------
 *
 * A day too long for the band says so with a "More" pill at the foot of the
 * wheel, faded out by the scroll offset as its end comes into view.
 */
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView,
} from 'react-native';
import { dayParts, type CalendarOccurrence, type ViewRange } from '@spsm/shared';

import { Icon } from '@/components/Icon';
import { useTheme } from '@/theme/ThemeProvider';

import { Dots } from './Dots';
import { Entry } from './Entry';
import { mix } from './mix';

/** How much of the day above and below shows: one folded line. */
const PEEK = 30;

/** Degrees of tilt per slot away from the centre. The website's own 14. */
const TILT = 14;

export function WeekDays({
  range,
  byDay,
  today,
  picked,
  onPick,
  loading,
  onOpen,
}: {
  range: ViewRange;
  byDay: Map<string, CalendarOccurrence[]>;
  today: string;
  picked: string;
  onPick: (day: string) => void;
  /** Suppresses "Nothing scheduled", which would be a lie before the answer lands. */
  loading: boolean;
  onOpen: (occurrence: CalendarOccurrence, day: string) => void;
}) {
  const theme = useTheme();
  const days = range.days;
  const index = Math.max(0, days.indexOf(picked));

  const [height, setHeight] = useState(0);
  /** The band: the height every day gets at least. */
  const slot = Math.max(0, height - 2 * PEEK);

  /** Each day's own height, measured; the band until it has been. */
  const [measured, setMeasured] = useState<Record<string, number>>({});
  const heights = days.map((day) => Math.max(slot, measured[day] ?? slot));
  /** Where each day starts, as a scroll offset: its top on the band's top. */
  const starts = heights.map((_, i) => heights.slice(0, i).reduce((sum, h) => sum + h, 0));
  /** How far past the band each day runs. */
  const overs = heights.map((h) => Math.max(0, h - slot));

  /*
   * The stops: the top of every day, and for a long one its end too — with a
   * stop in between every four-fifths of the band, so a very long day is read
   * a screenful at a time rather than skipped.
   */
  const stops: number[] = [];
  starts.forEach((start, i) => {
    const over = overs[i] ?? 0;
    stops.push(start);
    for (let step = slot * 0.8; step < over; step += slot * 0.8) stops.push(start + step);
    if (over > 0) stops.push(start + over);
  });

  // In state rather than a ref, as `BusyRule` keeps its pulse: it is read
  // during render to build the interpolations.
  const [offset] = useState(() => new Animated.Value(0));
  const wheel = useRef<ScrollView>(null);

  /*
   * Where the wheel last came to rest, so a pick that *came from* the wheel is
   * not scrolled to a second time — and a pick from a tab, or Today, or a new
   * week, is.
   */
  const restedOn = useRef(-1);

  // A new week, or a new height, puts the wheel back where it has to start.
  useEffect(() => {
    restedOn.current = -1;
  }, [range.from, slot]);

  useEffect(() => {
    if (slot === 0) return;
    if (restedOn.current === index) return;
    // Animated only for a turn within the week the wheel is already showing.
    const animated = restedOn.current !== -1;
    restedOn.current = index;
    wheel.current?.scrollTo({ y: starts[index] ?? 0, animated });
    // `starts` follows `measured`, which only grows a day and never moves one
    // that is already in place; a re-measure is not a reason to scroll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, slot, range.from]);

  /** The day the wheel has come to rest on: the one whose span holds `y`. */
  const settle = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (slot === 0) return;
    const y = event.nativeEvent.contentOffset.y;
    let at = 0;
    starts.forEach((start, i) => {
      if (y >= start - slot / 2) at = i;
    });
    const day = days[at];
    if (!day) return;
    restedOn.current = at;
    if (day !== picked) onPick(day);
  };

  return (
    <View style={{ flex: 1, gap: theme.space.xs }}>
      <Strip range={range} byDay={byDay} today={today} picked={picked} onPick={onPick} />

      <View
        style={{ flex: 1 }}
        onLayout={(event) => setHeight(Math.floor(event.nativeEvent.layout.height))}
      >
        {/* The band: two hairlines round the centred slot, behind the wheel. */}
        {slot > 0 ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: PEEK - 1,
              height: slot + 2,
              borderTopWidth: 1,
              borderBottomWidth: 1,
              borderColor: mix(theme.color.gold, theme.color.paper, 0.4),
            }}
          />
        ) : null}

        {slot > 0 ? (
          <Animated.ScrollView
            ref={wheel}
            showsVerticalScrollIndicator={false}
            snapToOffsets={stops}
            decelerationRate="fast"
            disableIntervalMomentum
            contentContainerStyle={{ paddingVertical: PEEK }}
            scrollEventThrottle={16}
            onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: offset } } }], {
              useNativeDriver: true,
            })}
            onMomentumScrollEnd={settle}
            accessibilityLabel={`Day by day, ${range.label}`}
          >
            {days.map((day, i) => {
              const top = starts[i] ?? 0;
              const end = top + (overs[i] ?? 0);
              const near = slot * 0.55;
              // Whole while any of it is in the band, gone half a band out.
              const cardOpacity = offset.interpolate({
                inputRange: [top - near, top, end, end + near],
                outputRange: [0, 1, 1, 0],
                extrapolate: 'clamp',
              });
              // Above the band (the wheel has scrolled past it): its line at
              // the bottom of the slot, which is the sliver still on screen.
              const asAbove = offset.interpolate({
                inputRange: [end, end + near],
                outputRange: [0, 1],
                extrapolate: 'clamp',
              });
              const asBelow = offset.interpolate({
                inputRange: [top - near, top],
                outputRange: [1, 0],
                extrapolate: 'clamp',
              });
              const tilt = offset.interpolate({
                inputRange: [top - slot, top, end, end + slot],
                outputRange: [`${-TILT}deg`, '0deg', '0deg', `${TILT}deg`],
                extrapolate: 'clamp',
              });

              return (
                <Animated.View
                  key={day}
                  style={{ minHeight: slot, transform: [{ perspective: 900 }, { rotateX: tilt }] }}
                  onLayout={(event) => {
                    const h = Math.ceil(event.nativeEvent.layout.height);
                    setMeasured((was) => (was[day] === h ? was : { ...was, [day]: h }));
                  }}
                >
                  <Animated.View
                    style={{ flexGrow: 1, opacity: cardOpacity }}
                    // Only the day in front takes a touch: the others are
                    // transparent, and a tap on a peek must not open a service
                    // nobody can see.
                    pointerEvents={i === index ? 'auto' : 'none'}
                  >
                    <DayCard
                      day={day}
                      entries={byDay.get(day) ?? []}
                      today={today}
                      loading={loading}
                      onOpen={onOpen}
                      minHeight={slot}
                    />
                  </Animated.View>

                  <Animated.View
                    pointerEvents="none"
                    style={{ position: 'absolute', left: 0, right: 0, bottom: 0, opacity: asAbove }}
                  >
                    <PeekLine day={day} entries={byDay.get(day) ?? []} today={today} />
                  </Animated.View>
                  <Animated.View
                    pointerEvents="none"
                    style={{ position: 'absolute', left: 0, right: 0, top: 0, opacity: asBelow }}
                  >
                    <PeekLine day={day} entries={byDay.get(day) ?? []} today={today} />
                  </Animated.View>
                </Animated.View>
              );
            })}
          </Animated.ScrollView>
        ) : null}

        {/*
          "More", for a day longer than the band: in the strip just under the
          band — where the next day's peek would be, and which that long day is
          covering anyway — so it sits over nothing anybody is reading. Fades
          out as the day's end comes into view. Not a control.
        */}
        {slot > 0
          ? days.map((day, i) => {
              const over = overs[i] ?? 0;
              if (over <= 4) return null;
              const top = starts[i] ?? 0;
              return (
                <Animated.View
                  key={day}
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: PEEK + slot + 3,
                    alignItems: 'center',
                    opacity: offset.interpolate({
                      inputRange: [top - slot * 0.3, top, top + over - 8, top + over],
                      outputRange: [0, 1, 1, 0],
                      extrapolate: 'clamp',
                    }),
                  }}
                >
                  <MorePill />
                </Animated.View>
              );
            })
          : null}
      </View>
    </View>
  );
}

/* ── The tabs ───────────────────────────────────────────────────────────── */

/**
 * The seven dates, one compact cell each: the weekday in small gold capitals,
 * the date, and a dot per entry in its kind's colour.
 *
 * The day the wheel is on is a solid red disc with the date in white — the
 * tab you are on, said in one mark rather than an outline that read as a
 * stamp. Today, when it is not that day, is its date in bold red, which is how
 * the phone's own Calendar marks it, so the two never look alike.
 */
function Strip({
  range,
  byDay,
  today,
  picked,
  onPick,
}: {
  range: ViewRange;
  byDay: Map<string, CalendarOccurrence[]>;
  today: string;
  picked: string;
  onPick: (day: string) => void;
}) {
  const theme = useTheme();

  return (
    <View style={{ flexDirection: 'row' }} accessibilityRole="tablist">
      {range.days.map((day) => {
        const parts = dayParts(day);
        const entries = byDay.get(day) ?? [];
        const isToday = day === today;
        const isPicked = day === picked;

        return (
          <Pressable
            key={day}
            onPress={() => onPick(day)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isPicked }}
            accessibilityLabel={`${parts.weekday} ${parts.month} ${parts.dayOfMonth}${
              isToday ? ', today' : ''
            }, ${entries.length === 0 ? 'nothing scheduled' : `${entries.length} scheduled`}`}
            style={{ flex: 1, alignItems: 'center', gap: 2 }}
          >
            <Text
              style={{
                fontSize: 10,
                fontWeight: '600',
                letterSpacing: 0.8,
                color: theme.color.gold,
              }}
            >
              {parts.weekdayShort.toUpperCase()}
            </Text>
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isPicked ? theme.color.accent : 'transparent',
              }}
            >
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: isPicked || isToday ? '700' : '500',
                  fontVariant: ['tabular-nums'],
                  color: isPicked
                    ? theme.color.inkInverse
                    : isToday
                      ? theme.color.accent
                      : theme.color.ink,
                }}
              >
                {parts.dayOfMonth}
              </Text>
            </View>
            <View style={{ height: 6 }}>
              <Dots entries={entries} max={5} count={false} />
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ── A neighbour ────────────────────────────────────────────────────────── */

/**
 * `.sched-wheel__peek`: a day above or below the centre, as its date and a dot
 * per entry — a position indicator, not a second schedule, so no titles.
 */
function PeekLine({
  day,
  entries,
  today,
}: {
  day: string;
  entries: CalendarOccurrence[];
  today: string;
}) {
  const theme = useTheme();
  const parts = dayParts(day);
  const isToday = day === today;

  return (
    <View
      style={{
        height: PEEK,
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.sm,
        paddingHorizontal: theme.space.md,
        // A step down from the card rather than a ghost of it: at 0.6 in the
        // faintest ink the neighbouring days were hard to read at all.
        opacity: 0.9,
      }}
    >
      <Text
        style={{
          fontSize: 12,
          fontWeight: '600',
          letterSpacing: 0.8,
          fontVariant: ['tabular-nums'],
          color: isToday ? theme.color.accent : theme.color.inkSoft,
        }}
      >
        {parts.weekdayShort.toUpperCase()} {parts.dayOfMonth}
      </Text>
      {isToday ? <TodayPill /> : null}
      {entries.length > 0 ? (
        <Dots entries={entries} count={false} />
      ) : (
        <Text style={{ fontSize: 12, color: theme.color.inkSoft }}>Nothing scheduled</Text>
      )}
    </View>
  );
}

/* ── The day ────────────────────────────────────────────────────────────── */

/**
 * `.sched-wheel__card`: raised paper, a hairline, rounded corners; the weekday
 * with the date on the right and a rule beneath, then the day's services. For
 * today, the weekday in red with a TODAY pill and a red edge down the left.
 */
function DayCard({
  day,
  entries,
  today,
  loading,
  onOpen,
  minHeight,
}: {
  day: string;
  entries: CalendarOccurrence[];
  today: string;
  loading: boolean;
  onOpen: (occurrence: CalendarOccurrence, day: string) => void;
  /** The band, so a quiet day still fills it. */
  minHeight: number;
}) {
  const theme = useTheme();
  const parts = dayParts(day);
  const isToday = day === today;
  const empty = entries.length === 0;

  return (
    <View
      style={{
        flexGrow: 1,
        minHeight,
        backgroundColor: theme.color.paperRaised,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: isToday
          ? mix(theme.color.accent, theme.color.paperRaised, 0.4)
          : theme.color.rule,
        overflow: 'hidden',
      }}
    >
      {isToday ? (
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 3,
            backgroundColor: theme.color.accent,
          }}
        />
      ) : null}

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space.sm,
          marginHorizontal: theme.space.md,
          paddingTop: 8,
          paddingBottom: 6,
          borderBottomWidth: 1,
          borderBottomColor: theme.color.rule,
        }}
        accessibilityRole="header"
      >
        <Text
          style={{
            fontSize: 17,
            fontWeight: '600',
            color: isToday ? theme.color.accent : theme.color.ink,
          }}
        >
          {parts.weekday}
        </Text>
        {isToday ? <TodayPill /> : null}
        <View style={{ flex: 1 }} />
        <Text
          style={{
            fontSize: 13,
            fontWeight: '500',
            letterSpacing: 0.6,
            fontVariant: ['tabular-nums'],
            color: theme.color.inkFaint,
          }}
        >
          {parts.month.toUpperCase()} {parts.dayOfMonth}
        </Text>
      </View>

      <View
        style={{
          flexGrow: 1,
          gap: 2,
          paddingHorizontal: theme.space.sm,
          paddingTop: theme.space.xs,
          paddingBottom: theme.space.sm,
          justifyContent: empty ? 'center' : 'flex-start',
        }}
      >
        {empty ? (
          loading ? null : (
            <Text
              style={{
                textAlign: 'center',
                fontStyle: 'italic',
                fontSize: theme.fontSize.small,
                color: theme.color.inkFaint,
              }}
            >
              Nothing scheduled
            </Text>
          )
        ) : (
          entries.map((occurrence) => (
            <Entry
              key={`${occurrence.source}:${occurrence.id}`}
              occurrence={occurrence}
              onOpen={() => onOpen(occurrence, day)}
            />
          ))
        )}
      </View>
    </View>
  );
}

function MorePill() {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 999,
        backgroundColor: theme.color.paperRaised,
        borderWidth: 1,
        borderColor: theme.color.accent,
      }}
    >
      <Icon name="chevron" size={12} color={theme.color.accent} />
      <Text style={{ fontSize: 12, fontWeight: '600', color: theme.color.accent }}>More</Text>
    </View>
  );
}

function TodayPill() {
  const theme = useTheme();
  return (
    <View
      style={{
        backgroundColor: theme.color.accent,
        borderRadius: 999,
        paddingHorizontal: 6,
        paddingVertical: 1,
      }}
    >
      <Text
        style={{
          fontSize: 10,
          fontWeight: '700',
          letterSpacing: 0.6,
          color: theme.color.inkInverse,
        }}
      >
        TODAY
      </Text>
    </View>
  );
}
