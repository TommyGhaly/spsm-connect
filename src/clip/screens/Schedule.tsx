/**
 * `/c/schedule` — the parish calendar, week or month, read-only.
 *
 * ---------------------------------------------------------------------------
 * The same two views the full app has, drawn by the same components: `DayWheel`
 * and `DaySchedule` for a week, `MonthGrid` for a month, with the app's own
 * `ViewSwitch`, `Stepper`, `BusyRule` and `Legend` around them. Those five moved
 * out of `CalendarScreen.tsx` into `calendar/ViewControls.tsx` so this screen
 * could have them without importing that one — which would bring the editor,
 * the event sheet and, through it, `expo-notifications`, a package this target
 * excludes.
 *
 * ## What this is not
 *
 * Not `CalendarScreen`. Four things on that screen need an account, and an App
 * Clip's storage does not survive to a second visit: the servants' rota behind
 * a Microsoft sign-in, the sign-in offer itself, the add-an-entry control, and
 * the detail sheet's staff half. Public scope only here — `{ servants: false }`
 * — and tapping an occurrence opens the church's own calendar page rather than
 * a sheet that would be half-empty without a session.
 *
 * It also reads only `/api/calendar`, where the app merges the bulletin and the
 * staff annotation layers over it. Those are enrichments of a schedule that
 * renders without them, and each is another round trip on a screen somebody
 * opened by holding a phone to a wall.
 * ---------------------------------------------------------------------------
 */
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import {
  PARISH_TIME_ZONE,
  groupByDay,
  kindOf,
  rangeFor,
  step,
  todayIn,
  type CalendarView,
  type OccurrenceKind,
} from '@spsm/shared';

import { Card, Screen } from '@/components/Surface';
import { Body, Heading, Label } from '@/components/Type';
import { DaySchedule } from '@/calendar/DaySchedule';
import { DayWheel } from '@/calendar/DayWheel';
import { MonthGrid } from '@/calendar/MonthGrid';
import { BusyRule, Legend, Stepper, ViewSwitch, whereLabel } from '@/calendar/ViewControls';
import { getSchedule, type ScheduleResult } from '@/calendar/data';
import { openSite } from '@/clip/handoff';
import { useTheme } from '@/theme/ThemeProvider';

export function Schedule() {
  const theme = useTheme();

  const today = useMemo(() => todayIn(PARISH_TIME_ZONE), []);
  const [view, setView] = useState<CalendarView>('week');
  const [anchor, setAnchor] = useState(today);
  /*
   * The answer, tagged with the range it answers. `busy` is derived from the
   * tag rather than being a second piece of state set at the top of the effect
   * below — which would be a synchronous setState in an effect, a cascading
   * render, and one more thing that can disagree with the range on screen.
   */
  const [answer, setAnswer] = useState<{ from: string; to: string; result: ScheduleResult } | null>(
    null,
  );
  const [recentre, setRecentre] = useState(0);

  const range = useMemo(() => rangeFor(view, anchor), [view, anchor]);
  const todayIsHere = today >= range.from && today <= range.to;

  /**
   * The day the wheel opens on: today when today is in the range, and the
   * first day of it otherwise. Adjusted during render rather than in an effect
   * — React's own shape for "reset state when a value changes", and the same
   * one `MonthGrid` uses for its open day.
   */
  const [picked, setPicked] = useState(today);
  const [pickedFrom, setPickedFrom] = useState(range.from);
  if (pickedFrom !== range.from) {
    setPickedFrom(range.from);
    setPicked(todayIsHere ? today : range.from);
  }

  /*
   * A sequence guard rather than an `AbortSignal`, for the reason
   * `calendar/data.ts` gives: an aborted fetch in React Native rejects with an
   * error whose name is not reliably `AbortError`, and a guard that silently
   * stops working is worse than none. Two quick presses of the stepper race,
   * and the check is made where the answer is used.
   */
  useEffect(() => {
    let live = true;

    void getSchedule(range.from, range.to, { servants: false }).then((next) => {
      if (!live) return;
      setAnswer({ from: range.from, to: range.to, result: next });
    });

    return () => {
      live = false;
    };
  }, [range.from, range.to]);

  const busy = !answer || answer.from !== range.from || answer.to !== range.to;
  /*
   * The previous range's answer stays on screen while the next one is in
   * flight, with the busy rule saying so — the same arrangement as the app's
   * calendar. `MonthGrid` and `DayWheel` both draw only the days in `range`, so
   * what a stale answer shows is less, never something from the wrong week.
   */
  const result = answer?.result ?? null;

  const occurrences = useMemo(
    () => (result?.kind === 'ok' ? result.feed.occurrences : []),
    [result],
  );
  const byDay = useMemo(() => groupByDay(occurrences), [occurrences]);
  const kindsShown = useMemo(
    () => new Set<OccurrenceKind>(occurrences.map((occurrence) => kindOf(occurrence))),
    [occurrences],
  );

  /*
   * Every occurrence opens the church's own calendar page for that day. The
   * app shows a sheet; half of what is in it — the staff annotation, the
   * reminder — needs a session or a notification permission that a clip cannot
   * usefully hold, and the website's page is a complete answer that costs this
   * binary nothing.
   */
  const open = (_: unknown, day: string) => openSite(`/calendar?day=${day}`, theme);

  const week = view === 'week';

  return (
    <Screen scroll={!week} gap={theme.space.sm} padBottom={week ? theme.space.gutter : undefined}>
      <View style={{ gap: theme.space.sm }}>
        <Label color={todayIsHere ? theme.color.accent : theme.color.inkFaint}>
          {whereLabel(view, range, today)}
        </Label>
        <Heading>{range.label}</Heading>

        <BusyRule busy={busy} />

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
          <ViewSwitch view={view} onPick={setView} />
          <View style={{ flex: 1 }} />
          <Stepper
            view={view}
            onStep={(delta) => setAnchor((at) => step(view, at, delta))}
            onToday={() => {
              setAnchor(today);
              setRecentre((count) => count + 1);
            }}
            todayIsHere={todayIsHere}
          />
        </View>
      </View>

      {result?.kind === 'unset' ? (
        <Card>
          <Label>NOT SET UP YET</Label>
          <Body color={theme.color.inkSoft}>
            The church has not connected a calendar yet. Nothing is missing from
            the church — only from this screen.
          </Body>
        </Card>
      ) : null}

      {/*
        Drawn above the calendar rather than instead of it: a failed read leaves
        whatever landed last on screen, and a week that is only half-answered is
        still worth more than a card where the liturgies were.
      */}
      {result?.kind === 'error' && result.message !== '' ? (
        <Card>
          <Label>THE CALENDAR COULD NOT BE READ</Label>
          <Body color={theme.color.inkSoft}>{result.message}</Body>
        </Card>
      ) : null}

      {week ? (
        <>
          <DayWheel
            range={range}
            byDay={byDay}
            today={today}
            picked={picked}
            onPick={setPicked}
            recentre={recentre}
          />
          {/* The rules that say where the scrolling band starts and ends — see
              the note on the same pair in `CalendarScreen`. */}
          <View style={{ height: 1, backgroundColor: theme.color.rule }} />
          <DaySchedule
            day={picked}
            entries={byDay.get(picked) ?? []}
            loading={busy}
            onOpen={open}
          />
          <View style={{ height: 1, backgroundColor: theme.color.rule }} />
        </>
      ) : (
        <MonthGrid range={range} byDay={byDay} today={today} loading={busy} onOpen={open} />
      )}

      <Legend kinds={kindsShown} showServants={false} />
    </Screen>
  );
}
