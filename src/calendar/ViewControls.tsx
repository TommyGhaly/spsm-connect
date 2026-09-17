/**
 * The calendar's chrome, shared by the two screens that draw a calendar.
 *
 * ---------------------------------------------------------------------------
 * All of this was private to `CalendarScreen.tsx`, and it moved here for the
 * App Clip: `/c/schedule` offers the same week and month views, over the same
 * feed, and had no way to reach these without importing the whole screen —
 * which brings `AddEntry`, `EventSheet` and, through that, `RemindAboutThis`
 * and `expo-notifications`, a package in the clip target's `excludedPackages`
 * where an import is a crash rather than a missing feature.
 *
 * So: anything both screens draw lives here, and nothing in this file may
 * import an admin path, a session, or a notification. What stayed behind in
 * `CalendarScreen` is everything a signed-in servant sees — the rota switch,
 * the sign-in offer, the editor.
 * ---------------------------------------------------------------------------
 */
import { useEffect, useState } from 'react';
import { Animated, Pressable, View } from 'react-native';
import {
  rangeFor,
  type CalendarView,
  type OccurrenceKind,
  type ViewRange,
} from '@spsm/shared';

import { Micro, Small, Subheading } from '@/components/Type';
import { useTheme } from '@/theme/ThemeProvider';

import { LEGEND, tintFor, washFor } from './kinds';

/**
 * "THIS WEEK", "NEXT WEEK", "3 WEEKS AGO" — where the range sits relative to now.
 *
 * Counted in whole views rather than in days, because that is the step the
 * arrows take: two presses of forward is "2 weeks ahead" and reads as an
 * undo-able distance, where "14 days ahead" reads as arithmetic somebody did.
 *
 * The month's own count comes off the middle of the range and not its first
 * day, which by definition often belongs to the month before — `monthRange`
 * pads its grid out to whole weeks.
 */
export function whereLabel(view: CalendarView, range: ViewRange, today: string): string {
  const home = rangeFor(view, today);

  const monthIndex = (of: ViewRange) => {
    const mid = of.days[Math.floor(of.days.length / 2)] ?? of.from;
    return Number(mid.slice(0, 4)) * 12 + Number(mid.slice(5, 7));
  };

  const away =
    view === 'week'
      ? Math.round(
          (Date.parse(`${range.from}T00:00:00Z`) - Date.parse(`${home.from}T00:00:00Z`)) /
            (7 * 24 * 60 * 60 * 1000),
        )
      : monthIndex(range) - monthIndex(home);

  const unit = view === 'week' ? 'week' : 'month';

  if (away === 0) return `This ${unit}`;
  if (away === 1) return `Next ${unit}`;
  if (away === -1) return `Last ${unit}`;
  return away > 0 ? `${away} ${unit}s ahead` : `${-away} ${unit}s ago`;
}

/**
 * Week or month.
 *
 * A pair of buttons rather than a `Switch`: this is a choice between two
 * renderings of the same thing, and a switch would claim one of them is the
 * absence of the other.
 */
export function ViewSwitch({
  view,
  onPick,
}: {
  view: CalendarView;
  onPick: (next: CalendarView) => void;
}) {
  const theme = useTheme();

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel="Calendar view"
      /*
       * A pill riding on a sunken track, rather than two cells inside a
       * hairline box. The box gave the unselected half a border of its own, so
       * both halves looked like controls and the selected one looked like a
       * control that happened to be red; the track is plainly a groove with one
       * thing in it. It is also the only sunken surface on the screen, which is
       * what keeps a filled accent pill from competing with the calendar.
       */
      style={{
        flexDirection: 'row',
        backgroundColor: theme.color.paperSunken,
        borderRadius: theme.radius.full,
        padding: 2,
      }}
    >
      {(['week', 'month'] as const).map((value) => {
        const on = view === value;

        return (
          <Pressable
            key={value}
            onPress={() => onPick(value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={({ pressed }) => ({
              paddingHorizontal: theme.space.md,
              minHeight: 44,
              minWidth: 44,
              borderRadius: theme.radius.full,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: on
                ? theme.color.accent
                : pressed
                  ? theme.color.paperRaised
                  : 'transparent',
            })}
          >
            <Small color={on ? theme.color.inkInverse : theme.color.ink}>
              {value === 'week' ? 'Week' : 'Month'}
            </Small>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Back, today, forward — one control with three parts.
 *
 * These were three separately outlined buttons with four points of air between
 * them, which said they were three unrelated things; they are one thing, and
 * the middle of them is the home position of the other two. Joined, with
 * hairlines where they meet, the group reads as a stepper and takes less width
 * than the boxes did.
 *
 * The arrows are set at `subheading` rather than `small`. A chevron is a shape
 * and not a word: at the size of the label beside it, it is a speck.
 */
export function Stepper({
  view,
  onStep,
  onToday,
  todayIsHere,
}: {
  view: CalendarView;
  onStep: (delta: number) => void;
  onToday: () => void;
  /**
   * In the month view, Today has nothing left to do once the month containing
   * today is on screen. In the week view it stays live even then, and that is
   * the point: the wheel can be turned two days off today while today is still
   * in the range, and disabling it would take away the one control that brings
   * it back.
   */
  todayIsHere: boolean;
}) {
  const theme = useTheme();

  const divider = (
    <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: theme.color.rule }} />
  );

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'stretch',
        backgroundColor: theme.color.paperRaised,
        borderColor: theme.color.rule,
        borderWidth: 1,
        borderRadius: theme.radius.full,
        overflow: 'hidden',
      }}
    >
      <Step
        label="‹"
        big
        hint={view === 'week' ? 'Previous week' : 'Previous month'}
        onPress={() => onStep(-1)}
      />
      {divider}
      <Step label="Today" onPress={onToday} disabled={view === 'month' && todayIsHere} />
      {divider}
      <Step
        label="›"
        big
        hint={view === 'week' ? 'Next week' : 'Next month'}
        onPress={() => onStep(1)}
      />
    </View>
  );
}

/** One part of the stepper. The group draws the edge; this draws the target. */
function Step({
  label,
  hint,
  big = false,
  onPress,
  disabled = false,
}: {
  label: string;
  hint?: string;
  /** A chevron rather than a word, set at the size a chevron needs. */
  big?: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={hint ?? label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => ({
        paddingHorizontal: theme.space.sm,
        backgroundColor: pressed ? theme.color.accentSoft : 'transparent',
        opacity: disabled ? 0.4 : 1,
        minHeight: 44,
        minWidth: 44,
        alignItems: 'center',
        justifyContent: 'center',
      })}
    >
      {big ? <Subheading>{label}</Subheading> : <Small>{label}</Small>}
    </Pressable>
  );
}

/**
 * That the screen is fetching, said as a line rather than as a word.
 *
 * "Updating…" sat in the gap between the two groups of controls, which meant
 * the one piece of chrome that appears and disappears was in the middle of the
 * one row that must not move. It is now a two-point rule under the title: the
 * height is always there, so nothing shifts, and what changes is a colour.
 *
 * Gold rather than the accent. This is not a problem — it is the app doing what
 * it was asked — and red is how everything wrong on this screen is drawn, from
 * a refused rota to a calendar that could not be read.
 *
 * It keeps a `progressbar` role while it is running and gives it up when it is
 * not, so the announcement the word used to make is still made, and a hairline
 * is not a stop on the way through the screen for the rest of the time.
 */
export function BusyRule({ busy }: { busy: boolean }) {
  const theme = useTheme();
  const [pulse] = useState(() => new Animated.Value(0.3));

  useEffect(() => {
    if (!busy) return;

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.3, duration: 600, useNativeDriver: true }),
      ]),
    );
    loop.start();

    // Stopped rather than left to run against an unmounted view, and reset so
    // the next fetch starts dim instead of wherever this one was interrupted.
    return () => {
      loop.stop();
      pulse.setValue(0.3);
    };
  }, [busy, pulse]);

  return (
    <Animated.View
      accessible={busy}
      accessibilityRole="progressbar"
      accessibilityLabel={busy ? 'Updating the calendar' : undefined}
      style={{
        height: 2,
        borderRadius: theme.radius.full,
        backgroundColor: busy ? theme.color.gold : 'transparent',
        opacity: busy ? pulse : 0,
      }}
    />
  );
}

/**
 * What the colours mean — for the colours that are on the screen.
 *
 * Only the kinds present in the range, which is what `kinds` carries; a week
 * with no class in it does not explain gold. `other` is absent whatever is on
 * the calendar, for its own reason: it is the absence of a claim — the
 * classifier could not place the title — and a row reading "Other" invites the
 * reader to look for a meaning that is not there.
 *
 * Chips rather than a line of dots and captions. Each one is filled with the
 * kind's own `washFor`, so the key is a small sample of the tint the reader has
 * just seen behind a time, and the dot on it is the full-strength hue off the
 * bar down the row's edge. Both marks the entry uses, in one object.
 */
export function Legend({
  kinds,
  showServants,
}: {
  kinds: ReadonlySet<OccurrenceKind>;
  showServants: boolean;
}) {
  const theme = useTheme();

  const shown = LEGEND.filter(({ kind }) => kinds.has(kind));

  // Nothing on the calendar, or nothing classified. A key to an empty grid is
  // an explanation of marks that are not there.
  if (shown.length === 0 && !showServants) return null;

  const chip = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.space.xs,
    borderRadius: theme.radius.full,
    paddingVertical: theme.space.xs,
    paddingHorizontal: theme.space.sm,
  };

  return (
    <View
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.xs }}
      accessibilityRole="summary"
    >
      {shown.map(({ kind, label, short }) => (
        <View
          key={kind}
          style={[chip, { backgroundColor: washFor(kind, theme) }]}
          /* One word to look at, the whole phrase to listen to. */
          accessible
          accessibilityLabel={label}
        >
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: theme.radius.full,
              backgroundColor: tintFor(kind, theme),
            }}
          />
          <Micro color={theme.color.inkSoft}>{short}</Micro>
        </View>
      ))}

      {showServants ? (
        <View
          style={[chip, { backgroundColor: theme.color.paperSunken }]}
          accessible
          accessibilityLabel="Servants only"
        >
          {/* A ring rather than a fill: "servants only" sits *on top of* a
              kind, so it must not read as a fourth one. */}
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: theme.radius.full,
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: theme.color.inkFaint,
            }}
          />
          <Micro color={theme.color.inkSoft}>Servants</Micro>
        </View>
      ) : null}
    </View>
  );
}
