/**
 * One day of the month, as a sheet that rises from the foot of the screen.
 *
 * The website's `DaySheet` (features/calendar/DaySheet.tsx and the
 * `.sched-daysheet` rules in globals.css), which replaced the panel the month
 * grid used to open underneath itself. That panel was a screen and a half below
 * the date that opened it on a phone: every tap was followed by a scroll down
 * to read it and a scroll back up to pick the next day. The sheet answers where
 * the thumb already is, and the grid stays dimly visible above it.
 *
 * What it carries, point for point with the website:
 *
 * - **A handle, the weekday in the serif and the date beside it**, Today as a
 *   red badge, and a ✕. Pulling the top down, tapping the dimmed grid, the
 *   Android back gesture and the ✕ all put it away.
 * - **The picked day's week as a strip of seven dates**, with up to three dots
 *   under each — a way of choosing the next day, not a tally.
 * - **The day's entries, swiped sideways a day at a time**, across the whole
 *   padded month the grid is drawing, so past Sunday is next week's Monday and
 *   the strip follows.
 * - **About three quarters of the screen at least**, so a light day does not
 *   come up as a strip, up to nine tenths for a heavy one, and the pictures at
 *   a real size, because the sheet has the room every narrower list does not.
 *
 * ## Built on `Animated` and `PanResponder`, not gesture-handler
 *
 * A `Modal` is its own native window, and on Android gesture-handler's
 * gestures do nothing inside one without a second `GestureHandlerRootView`
 * wrapped round its contents. The responder system needs nothing, and two
 * gestures — a pull and a sideways swipe — do not need a library.
 *
 * ## Why the event sheet is rendered *inside* this one
 *
 * Opening an entry stacks `EventSheet` on top, as the website stacks its
 * `EventDialog` over the day sheet, and closing it returns here rather than to
 * the grid. iOS presents a modal from whichever controller is already showing
 * one, so a second `Modal` mounted as a sibling of this one never appears; as a
 * child of this one's content it presents from this one. Hence `over`.
 */
import { useEffect, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { dayParts, type CalendarOccurrence } from '@spsm/shared';

import { Close } from '@/components/Fields';
import { Heading, Micro, Small } from '@/components/Type';
import { useTheme } from '@/theme/ThemeProvider';

import { Dots } from './Dots';
import { Entry } from './Entry';

/** How far the top has to be pulled, in points, before letting go closes it. */
const DISMISS_PULL = 96;
/** Downward speed, in points per millisecond, that closes it however short the pull. */
const FLICK = 0.6;
/** Sideways travel, in points, that turns to the next or previous day. */
const SWIPE = 56;
/** The website's `sched-daysheet-in` and `-out`. */
const ENTER_MS = 280;
const LEAVE_MS = 200;
/** The website's `min(74dvh, 46rem)` and `90dvh`. */
const MIN_SHARE = 0.74;
const MIN_CEILING = 736;
const MAX_SHARE = 0.9;
/** `@media (min-width: 40rem)`: a strip a metre across is no longer a strip. */
const MAX_WIDTH = 640;
/** The website's `max-width: 5.5rem` on `.sched-daysheet .sched-entry__thumb`. */
const SHEET_THUMB = 88;

const EASE_OUT = Easing.bezier(0.2, 0.9, 0.3, 1);

export function DaySheet({
  days,
  day,
  byDay,
  today,
  loading,
  over,
  onPick,
  onShut,
  onOpen,
}: {
  /** Every day the grid is drawing, padded to whole weeks. */
  days: string[];
  day: string;
  byDay: Map<string, CalendarOccurrence[]>;
  today: string;
  /** Suppresses "Nothing scheduled" before the answer lands. */
  loading: boolean;
  /** Presented on top of this sheet — the event sheet. See the header. */
  over?: ReactNode;
  onPick: (day: string) => void;
  onShut: () => void;
  onOpen: (occurrence: CalendarOccurrence, day: string) => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();

  const reduceMotion = useReduceMotion();

  /*
   * One value for where the sheet is, in points below its resting place, and
   * one for the scrim. Created once — `useState` rather than `useRef` so the
   * value is read during render without the lint rule's complaint.
   */
  const [offset] = useState(() => new Animated.Value(height));
  const [scrim] = useState(() => new Animated.Value(0));
  /** Set once the leave has begun, so a second way out does not replay it. */
  const [leaving, setLeaving] = useState(false);

  /*
   * Which way the last change of day went, so the new day slides in from the
   * side the reader moved towards. `null` on open, when the sheet rises.
   */
  const [came, setCame] = useState<'next' | 'prev' | null>(null);

  useEffect(() => {
    // With reduced motion the website swaps the slide for a fade; here the
    // sheet is simply in place and the scrim fades.
    if (reduceMotion) offset.setValue(0);
    Animated.parallel([
      reduceMotion
        ? Animated.delay(0)
        : Animated.timing(offset, {
            toValue: 0,
            duration: ENTER_MS,
            easing: EASE_OUT,
            useNativeDriver: true,
          }),
      Animated.timing(scrim, {
        toValue: 1,
        duration: ENTER_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [offset, scrim, reduceMotion]);

  /**
   * Put the sheet away: play the leave from wherever a drag left it, then tell
   * the grid. The website's leave keyframe has no `from` for the same reason —
   * a pull carried on, rather than snapped back and replayed.
   */
  const dismiss = () => {
    if (leaving) return;
    setLeaving(true);
    Animated.parallel([
      Animated.timing(offset, {
        toValue: reduceMotion ? 0 : height,
        duration: LEAVE_MS,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(scrim, {
        toValue: 0,
        duration: LEAVE_MS,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => onShut());
  };

  const index = days.indexOf(day);
  const weekStart = Math.max(0, Math.floor(index / 7) * 7);
  const week = days.slice(weekStart, weekStart + 7);
  const monthKey = (days[Math.floor(days.length / 2)] ?? '').slice(0, 7);

  const turn = (by: 1 | -1) => {
    const next = days[index + by];
    if (!next) return;
    setCame(by === 1 ? 'next' : 'prev');
    onPick(next);
  };

  /*
   * The responders are rebuilt each render so they close over the current day
   * and `turn`. A `PanResponder` is a plain object of handlers, so making one
   * per render costs nothing a gesture would notice.
   */

  /* ---- pulling the sheet down -------------------------------------------- */

  const pull = PanResponder.create({
    /*
     * On the move and in the capture phase, so a drag that starts on a date in
     * the strip still pulls the sheet, while a tap on that date stays the
     * date's — a press never moves far enough to be claimed.
     */
    onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderMove: (_, g) => {
      // Downward only. Pulled up, it resists rather than following.
      offset.setValue(g.dy > 0 ? g.dy : g.dy / 6);
    },
    onPanResponderRelease: (_, g) => {
      if (g.dy > DISMISS_PULL || (g.dy > 24 && g.vy > FLICK)) {
        dismiss();
      } else {
        Animated.timing(offset, {
          toValue: 0,
          duration: 220,
          easing: EASE_OUT,
          useNativeDriver: true,
        }).start();
      }
    },
    onPanResponderTerminate: () => offset.setValue(0),
  });

  /* ---- swiping between days ---------------------------------------------- */

  const swipe = PanResponder.create({
    /*
     * Clearly sideways, so a slightly diagonal scroll of the list never turns
     * the day out from under the reader. Captured, because the list is a
     * vertical scroll view and would otherwise keep the touch — it has no use
     * for a sideways one.
     */
    onMoveShouldSetPanResponderCapture: (_, g) =>
      Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onPanResponderRelease: (_, g) => {
      if (Math.abs(g.dx) < SWIPE || Math.abs(g.dx) < Math.abs(g.dy) * 1.5) return;
      turn(g.dx < 0 ? 1 : -1);
    },
  });

  const parts = dayParts(day);
  const entries = byDay.get(day) ?? [];
  const isToday = day === today;

  const sheetWidth = Math.min(width, MAX_WIDTH);
  const minHeight = Math.min(height * MIN_SHARE, MIN_CEILING);
  const maxHeight = height * MAX_SHARE;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={dismiss}>
      <View style={{ flex: 1, justifyContent: 'flex-end', alignItems: 'center' }}>
        {/*
          The scrim as its own layer behind the sheet, the same arrangement the
          shared `Sheet` uses: a press on a parent would be a press on every gap
          inside the sheet as well.
        */}
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            opacity: scrim,
          }}
        >
          <Pressable
            onPress={dismiss}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={{ flex: 1, backgroundColor: theme.color.deep, opacity: 0.4 }}
          />
        </Animated.View>

        <Animated.View
          accessibilityViewIsModal
          style={{
            width: sheetWidth,
            minHeight,
            maxHeight,
            backgroundColor: theme.color.paperRaised,
            borderTopWidth: 3,
            borderTopColor: theme.color.gold,
            borderTopLeftRadius: theme.radius.lg,
            borderTopRightRadius: theme.radius.lg,
            overflow: 'hidden',
            transform: [{ translateY: offset }],
            shadowColor: '#1c1614',
            shadowOpacity: 0.22,
            shadowRadius: 20,
            shadowOffset: { width: 0, height: -12 },
            elevation: 16,
          }}
        >
          {/* The grab area: the handle, the date and the week strip. */}
          <View
            {...pull.panHandlers}
            style={{
              paddingTop: theme.space.sm,
              paddingHorizontal: theme.space.md,
              borderBottomWidth: 1,
              borderBottomColor: theme.color.rule,
            }}
          >
            <View
              style={{
                alignSelf: 'center',
                width: 40,
                height: 5,
                borderRadius: theme.radius.full,
                backgroundColor: theme.color.rule,
                marginBottom: theme.space.sm,
              }}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            />

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
              <View
                accessibilityRole="header"
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  alignItems: 'baseline',
                  columnGap: theme.space.sm,
                  rowGap: 2,
                }}
              >
                <Heading color={isToday ? theme.color.accent : theme.color.ink}>{parts.weekday}</Heading>
                <Text
                  style={{
                    fontFamily: theme.fontFamily.ui,
                    fontSize: theme.fontSize.small,
                    fontWeight: '600',
                    color: theme.color.inkSoft,
                  }}
                >
                  {parts.month} {parts.dayOfMonth}
                </Text>
                {isToday ? (
                  <View
                    style={{
                      alignSelf: 'center',
                      paddingHorizontal: 7,
                      paddingVertical: 1,
                      borderRadius: theme.radius.full,
                      backgroundColor: theme.color.accent,
                    }}
                  >
                    <Micro color={theme.color.inkInverse}>TODAY</Micro>
                  </View>
                ) : null}
              </View>
              <Close onPress={dismiss} what={`${parts.weekday} ${parts.month} ${parts.dayOfMonth}`} />
            </View>

            {/* The week the day is in. */}
            <View
              accessibilityLabel="Choose a day"
              style={{ flexDirection: 'row', gap: 2, paddingVertical: theme.space.sm }}
            >
              {week.map((each) => (
                <StripDay
                  key={each}
                  day={each}
                  entries={byDay.get(each) ?? []}
                  isPicked={each === day}
                  isToday={each === today}
                  inMonth={each.slice(0, 7) === monthKey}
                  onPress={() => {
                    if (each === day) return;
                    setCame(each > day ? 'next' : 'prev');
                    onPick(each);
                  }}
                />
              ))}
            </View>
          </View>

          <View {...swipe.panHandlers} style={{ flexShrink: 1, flexGrow: 1 }}>
            <ScrollView
              contentContainerStyle={{
                padding: theme.space.md,
                paddingBottom: theme.space.lg + insets.bottom,
              }}
            >
              {/* Keyed by day so each change replays the slide, from the side
                  the reader moved towards. */}
              <Page key={day} came={reduceMotion ? null : came}>
                {entries.length === 0 ? (
                  loading ? null : (
                    <View style={{ paddingVertical: theme.space.lg, alignItems: 'center' }}>
                      <Small color={theme.color.inkSoft}>Nothing scheduled</Small>
                    </View>
                  )
                ) : (
                  <View style={{ gap: theme.space.xs }}>
                    {entries.map((occurrence) => (
                      <Entry
                        key={`${occurrence.source}:${occurrence.id}`}
                        occurrence={occurrence}
                        thumb={SHEET_THUMB}
                        onOpen={() => onOpen(occurrence, day)}
                      />
                    ))}
                  </View>
                )}
              </Page>
            </ScrollView>
          </View>
        </Animated.View>
      </View>

      {over}
    </Modal>
  );
}

/**
 * One date in the strip: the weekday's initial, the date in a disc, and up to
 * three dots.
 *
 * Marked as the grid marks them, so the two read as one calendar: today in red
 * numerals with a ring, the picked day a filled disc — in the deep red, or the
 * accent when it is also today — and days from the months either side dimmed.
 */
function StripDay({
  day,
  entries,
  isPicked,
  isToday,
  inMonth,
  onPress,
}: {
  day: string;
  entries: CalendarOccurrence[];
  isPicked: boolean;
  isToday: boolean;
  inMonth: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const parts = dayParts(day);

  const discColor = isPicked ? (isToday ? theme.color.accent : theme.color.deep) : 'transparent';
  const numberColor = isPicked ? theme.color.inkInverse : isToday ? theme.color.accent : theme.color.ink;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: isPicked }}
      accessibilityLabel={`${parts.weekday} ${parts.month} ${parts.dayOfMonth}, ${
        entries.length === 0 ? 'nothing scheduled' : `${entries.length} scheduled`
      }`}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 56,
        alignItems: 'center',
        gap: 2,
        paddingTop: 5,
        paddingBottom: 6,
        borderRadius: theme.radius.md,
        opacity: inMonth ? 1 : 0.5,
        backgroundColor: pressed && !isPicked ? theme.color.goldSoft : 'transparent',
      })}
    >
      <Text
        style={{
          fontFamily: theme.fontFamily.ui,
          fontSize: 11,
          fontWeight: '600',
          letterSpacing: 0.7,
          color: theme.color.inkSoft,
        }}
      >
        {parts.weekdayShort.slice(0, 1).toUpperCase()}
      </Text>
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: theme.radius.full,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: discColor,
          borderWidth: isToday && !isPicked ? 1.5 : 0,
          borderColor: theme.color.accent,
        }}
      >
        <Text
          style={{
            fontFamily: theme.fontFamily.ui,
            fontSize: theme.fontSize.body,
            fontWeight: '600',
            fontVariant: ['tabular-nums'],
            color: numberColor,
          }}
        >
          {parts.dayOfMonth}
        </Text>
      </View>
      <View style={{ height: 6 }}>
        <Dots entries={entries} max={3} count={false} />
      </View>
    </Pressable>
  );
}

/** A day's list, sliding in from the side it was turned towards. */
function Page({ came, children }: { came: 'next' | 'prev' | null; children: ReactNode }) {
  const [shift] = useState(() => new Animated.Value(came === null ? 0 : 1));

  useEffect(() => {
    if (came === null) return;
    Animated.timing(shift, {
      toValue: 0,
      duration: 240,
      easing: EASE_OUT,
      useNativeDriver: true,
    }).start();
  }, [came, shift]);

  const distance = came === 'prev' ? -40 : 40;

  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      style={{
        opacity: shift.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
        transform: [{ translateX: shift.interpolate({ inputRange: [0, 1], outputRange: [0, distance] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}

/** Whether the system's Reduce Motion is on, kept current while mounted. */
function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((on) => live && setReduce(on));
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      live = false;
      subscription.remove();
    };
  }, []);

  return reduce;
}
