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
import { Animated, Pressable, Text, View } from 'react-native';
import {
  type CalendarView,
  type OccurrenceKind,
} from '@spsm/shared';

import { Micro, Small, Subheading } from '@/components/Type';
import { useTheme } from '@/theme/ThemeProvider';

import { LEGEND, tintFor } from './kinds';

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
              // 34, with the track's 2pt and a hit slop, rather than 44: the
              // calendar is what this screen is for, and every point of
              // chrome is a point off the day.
              height: 34,
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
 * The range between its arrows, as the website sets it: what the arrows change
 * sits where they are, rather than as a heading two rows away.
 */
export function Stepper({
  view,
  label,
  onStep,
}: {
  view: CalendarView;
  /** "November 23–29, 2026". */
  label: string;
  onStep: (delta: number) => void;
}) {
  const theme = useTheme();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.xs }}>
      <Round
        glyph="‹"
        hint={view === 'week' ? 'Previous week' : 'Previous month'}
        onPress={() => onStep(-1)}
      />
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.85}
        accessibilityRole="header"
        style={{
          flex: 1,
          textAlign: 'center',
          fontSize: 17,
          fontWeight: '600',
          color: theme.color.ink,
        }}
      >
        {label}
      </Text>
      <Round
        glyph="›"
        hint={view === 'week' ? 'Next week' : 'Next month'}
        onPress={() => onStep(1)}
      />
    </View>
  );
}

/**
 * Today, as a pill beside the view switch.
 *
 * In the month view it has nothing left to do once the month containing today
 * is on screen. In the week view it stays live even then: the wheel can sit two
 * days off today inside today's week, and this is what brings it back.
 */
export function TodayButton({
  view,
  todayIsHere,
  onToday,
}: {
  view: CalendarView;
  todayIsHere: boolean;
  onToday: () => void;
}) {
  const theme = useTheme();
  const off = view === 'month' && todayIsHere;

  return (
    <Pressable
      onPress={onToday}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: off }}
      hitSlop={6}
      style={({ pressed }) => ({
        height: 34,
        paddingHorizontal: theme.space.md,
        borderRadius: theme.radius.full,
        borderWidth: 1,
        borderColor: theme.color.rule,
        backgroundColor: pressed ? theme.color.accentSoft : theme.color.paperRaised,
        justifyContent: 'center',
        opacity: off ? 0.4 : 1,
      })}
    >
      <Small>Today</Small>
    </Pressable>
  );
}

/** A round arrow button, as the website's. */
function Round({ glyph, hint, onPress }: { glyph: string; hint: string; onPress: () => void }) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={hint}
      hitSlop={6}
      style={({ pressed }) => ({
        width: 34,
        height: 34,
        borderRadius: 17,
        borderWidth: 1,
        borderColor: theme.color.rule,
        backgroundColor: pressed ? theme.color.accentSoft : theme.color.paperRaised,
        alignItems: 'center',
        justifyContent: 'center',
      })}
    >
      <Subheading>{glyph}</Subheading>
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
 * The key: a dot in the kind's colour and one word beside it, on one line —
 * the whole phrase is what a screen reader hears. The website spells each one
 * out across two lines; on a phone that is two lines off the day.
 *
 * Only the kinds actually on screen. "Everything else" is never keyed — it is
 * the absence of a claim, and a row reading "Other" invites the reader to look
 * for a meaning that is not there. The servants mark is a dashed ring rather
 * than a fill, because it sits *on top of* a kind and must not read as a fourth.
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
  if (shown.length === 0 && !showServants) return null;

  const item = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4 };

  return (
    <View
      style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: theme.space.sm, rowGap: 2, flexShrink: 1 }}
      accessibilityRole="summary"
    >
      {shown.map(({ kind, label, short }) => (
        <View key={kind} style={item} accessible accessibilityLabel={label}>
          <View
            style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tintFor(kind, theme) }}
          />
          <Micro color={theme.color.inkSoft}>{short}</Micro>
        </View>
      ))}

      {showServants ? (
        <View style={item}>
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
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
