/**
 * The parish calendar: this week.
 *
 * The website's `ChurchCalendar.tsx` opens on the month, because a month grid
 * is the orienting view for somebody arriving without a specific question. A
 * phone cannot draw that grid — the website's own `MonthView` is a table with
 * hover-to-expand, and there is no touch equivalent of hover — so this opens on
 * the week and steps by weeks. The month view arrives when there is a design
 * for it that is not a shrunken table.
 *
 * ## What is shared, and what is not
 *
 * Everything that decides *what* is on the calendar is in `@spsm/shared` and is
 * not re-decided here: `weekRange` and `step` do the arithmetic,
 * `mergeCalendarSources` reconciles four descriptions of the same week,
 * `applyCalendarDetails` lays the parish's annotations over the survivors, and
 * `groupByDay` buckets the result. This file is layout and state.
 *
 * That division is the whole reason the package exists. The bulletin and Breeze
 * describe the same Tuesday Liturgy and agree on almost none of the wording;
 * which of the two the reader sees must not depend on whether they opened the
 * website or the app.
 *
 * ## Two orderings that matter
 *
 * **Details go on after the merge, never before.** A note is attached to an
 * occurrence id, and the merge is what decides which of two descriptions of the
 * same service keeps its id. Annotating first would put the note on the copy
 * that loses.
 *
 * **A refused servants request falls back to the parish calendar**, not to
 * nothing. The token disagreed with what this screen believed — a grant
 * changed, or the session outlived it — and the parish schedule is still the
 * right thing to be looking at.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import {
  PARISH_TIME_ZONE,
  applyCalendarDetails,
  dayParts,
  formatClock,
  groupByDay,
  kindOf,
  mergeCalendarSources,
  step,
  todayIn,
  weekRange,
  type CalendarDetail,
  type CalendarOccurrence,
  type OccurrenceKind,
} from '@spsm/shared';

import { Card, Screen } from '@/components/Surface';
import { Body, Label, Small, Subheading, Title } from '@/components/Type';
import { useSession } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';

import {
  getBulletinOccurrences,
  getFeatureOccurrences,
  getSchedule,
  getStaffLayers,
  type ScheduleResult,
} from './data';

export function CalendarScreen() {
  const theme = useTheme();
  const { isPerson } = useSession();

  /*
   * Initialised straight away, unlike the website's, which holds `null` until
   * an effect runs. That `null` exists because the page is prerendered into
   * static HTML on a build machine and a lazy initialiser would bake the build
   * day into the markup. There is no prerender here — the first render happens
   * on the phone, in the reader's own present — so the honest value is
   * available immediately and a skeleton frame would be theatre.
   */
  const [anchor, setAnchor] = useState(() => todayIn(PARISH_TIME_ZONE));
  const today = useMemo(() => todayIn(PARISH_TIME_ZONE), []);

  const range = useMemo(() => weekRange(anchor), [anchor]);

  /* ---- who is reading ---------------------------------------------------- */

  /*
   * Sign-in is Microsoft-only and restricted to the parish's Entra directory,
   * so having a session *is* being on the rota — the same reasoning
   * `servantEvents` uses in firestore.rules, where the check is `signedIn()`
   * and nothing finer. `isPerson` excludes the anonymous session the upload
   * path creates, which is the distinction that matters here.
   */
  const isServant = isPerson;
  const [wantServants, setWantServants] = useState(true);
  const [deniedNote, setDeniedNote] = useState<string | null>(null);

  /*
   * Signing in or out clears the note, because it is about a calendar nobody is
   * going to be served any more.
   *
   * Adjusted during render rather than in an effect — React's own documented
   * shape for "reset state when a value changes". An effect would render once
   * with the stale note, then again without it, which is the cascading render
   * the lint rule is there to prevent; this re-renders before anything is
   * committed to the screen.
   */
  const [noteBelongsTo, setNoteBelongsTo] = useState(isServant);
  if (noteBelongsTo !== isServant) {
    setNoteBelongsTo(isServant);
    setDeniedNote(null);
  }

  const askingForServants = isServant && wantServants;

  /* ---- the three quiet sources, each fetched once ------------------------- */

  const [bulletin, setBulletin] = useState<CalendarOccurrence[]>([]);
  const [features, setFeatures] = useState<CalendarOccurrence[]>([]);
  const [layers, setLayers] = useState<{
    entries: CalendarOccurrence[];
    details: Map<string, CalendarDetail>;
  }>({ entries: [], details: new Map() });

  useEffect(() => {
    let live = true;
    void getBulletinOccurrences().then((next) => live && setBulletin(next));
    void getFeatureOccurrences().then((next) => live && setFeatures(next));
    void getStaffLayers().then((next) => live && setLayers(next));
    return () => {
      live = false;
    };
  }, []);

  /* ---- the schedule ------------------------------------------------------- */

  /**
   * The answer, and which week it answers for.
   *
   * Stored together rather than as a result plus a pending counter, because
   * `CalendarFeed` already carries `from` and `to` — echoed back, its own
   * docstring says, "so a stale response can be told from a fresh one". Keeping
   * the asked-for range beside the answer means "is this the week on screen"
   * is a comparison rather than a tally, and the double-decrement bookkeeping
   * the website needs for its counter has nothing to go wrong in.
   */
  const [answer, setAnswer] = useState<{ key: string; result: ScheduleResult } | null>(null);
  const latest = useRef(0);

  const key = `${range.from}..${range.to}:${askingForServants ? 'servants' : 'parish'}`;

  useEffect(() => {
    latest.current += 1;
    const sequence = latest.current;

    void (async () => {
      const next = await getSchedule(range.from, range.to, { servants: askingForServants });

      /*
       * The guard that makes the arrows work. Stepping quickly fires a request
       * per tap and they do not come back in order — Breeze is slower for a
       * range it has not cached, so the *older* request often lands last.
       * Without this the calendar settles on whichever answer arrived last
       * rather than on the week being looked at.
       */
      if (sequence !== latest.current) return;

      if (next.kind === 'denied') {
        setDeniedNote(next.message);
        setWantServants(false);
        return;
      }

      setAnswer({ key, result: next });
    })();
  }, [range, askingForServants, key]);

  const result = answer?.key === key ? answer.result : null;
  const busy = result === null;

  /* ---- what to draw ------------------------------------------------------- */

  const byDay = useMemo(() => {
    const schedule = result?.kind === 'ok' ? result.feed.occurrences : [];

    const inRange = (entries: CalendarOccurrence[]) =>
      entries.filter((entry) => entry.endDay >= range.from && entry.day <= range.to);

    return groupByDay(
      applyCalendarDetails(
        mergeCalendarSources([
          inRange(layers.entries),
          inRange(features),
          inRange(bulletin),
          schedule,
        ]),
        layers.details,
      ),
    );
  }, [result, features, bulletin, layers, range]);

  const includesServants = result?.kind === 'ok' && result.feed.includesServants;
  const goto = useCallback((delta: number) => setAnchor((at) => step('week', at, delta)), []);

  return (
    <Screen>
      <View style={{ gap: theme.space.xs }}>
        <Title>{range.label}</Title>
        <View style={{ flexDirection: 'row', gap: theme.space.xs, alignItems: 'center' }}>
          <Step label="‹" hint="Previous week" onPress={() => goto(-1)} />
          <Step label="Today" onPress={() => setAnchor(today)} />
          <Step label="›" hint="Next week" onPress={() => goto(1)} />
          {busy ? <Small color={theme.color.inkFaint}>Updating…</Small> : null}
        </View>
      </View>

      {isServant ? (
        <ServantSwitch
          on={askingForServants}
          included={includesServants}
          onToggle={() => setWantServants((was) => !was)}
        />
      ) : null}

      {deniedNote ? (
        <Card>
          <Label>The servants schedule</Label>
          <Body color={theme.color.inkSoft}>{deniedNote}</Body>
        </Card>
      ) : null}

      {result?.kind === 'unset' ? (
        <Card>
          <Label>Not set up yet</Label>
          <Body color={theme.color.inkSoft}>
            The parish has not connected a calendar yet. Nothing is missing from the parish — only
            from this app.
          </Body>
        </Card>
      ) : null}

      {result?.kind === 'error' && result.message !== '' ? (
        <Card>
          <Label>The calendar could not be read</Label>
          <Body color={theme.color.inkSoft}>{result.message}</Body>
        </Card>
      ) : null}

      {range.days.map((day) => (
        <Day
          key={day}
          day={day}
          today={today}
          occurrences={byDay.get(day) ?? []}
          loading={busy}
        />
      ))}
    </Screen>
  );
}

/* -------------------------------------------------------------------------- */

function Step({ label, hint, onPress }: { label: string; hint?: string; onPress: () => void }) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={hint ?? label}
      style={({ pressed }) => ({
        borderColor: theme.color.rule,
        borderWidth: 1,
        borderRadius: theme.radius.sm,
        paddingVertical: theme.space.xs,
        paddingHorizontal: theme.space.sm,
        backgroundColor: pressed ? theme.color.accentSoft : 'transparent',
        minHeight: 44,
        minWidth: 44,
        alignItems: 'center',
        justifyContent: 'center',
      })}
    >
      <Small>{label}</Small>
    </Pressable>
  );
}

/**
 * The servants switch.
 *
 * A switch rather than nothing at all, because a servant is also a parishioner:
 * "what is the parish doing this week" and "what am I on the hook for" are
 * different questions, and the internal entries are noise against the first.
 *
 * `included` is read from the feed rather than inferred from the occurrences,
 * because "no servants entries this week" and "you were not shown the servants
 * calendar" look identical in the data and mean completely different things.
 */
function ServantSwitch({
  on,
  included,
  onToggle,
}: {
  on: boolean;
  included: boolean;
  onToggle: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      style={({ pressed }) => ({
        backgroundColor: pressed ? theme.color.accentSoft : theme.color.paperRaised,
        borderColor: on ? theme.color.accent : theme.color.rule,
        borderWidth: 1,
        borderRadius: theme.radius.md,
        padding: theme.space.md,
        gap: theme.space.xs,
        minHeight: 44,
      })}
    >
      <Label>{on ? 'Showing the servants schedule' : 'Parish schedule only'}</Label>
      <Small color={theme.color.inkSoft}>
        {on && included
          ? 'Your rota is included below. Tap to hide it.'
          : on
            ? 'Asking for your rota.'
            : 'Tap to include what you are serving.'}
      </Small>
    </Pressable>
  );
}

/**
 * One day, and everything on it.
 *
 * Empty days are drawn rather than skipped. A week with Tuesday missing reads
 * as a rendering fault; a week with an empty Tuesday reads as a quiet Tuesday,
 * which is the true thing.
 */
function Day({
  day,
  today,
  occurrences,
  loading,
}: {
  day: string;
  today: string;
  occurrences: CalendarOccurrence[];
  /** Suppresses "Nothing on", which would be a lie before the answer lands. */
  loading: boolean;
}) {
  const theme = useTheme();
  const parts = dayParts(day);
  const isToday = day === today;

  return (
    <View style={{ gap: theme.space.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: theme.space.xs }}>
        <Subheading color={isToday ? theme.color.accent : theme.color.ink}>
          {parts.weekday}
        </Subheading>
        <Small color={theme.color.inkFaint}>
          {parts.month} {parts.dayOfMonth}
        </Small>
        {isToday ? <Small color={theme.color.accent}>Today</Small> : null}
      </View>

      {occurrences.length === 0 ? (
        loading ? null : <Small color={theme.color.inkFaint}>Nothing on</Small>
      ) : (
        occurrences.map((occurrence) => (
          <Entry key={`${occurrence.source}:${occurrence.id}`} occurrence={occurrence} />
        ))
      )}
    </View>
  );
}

/** The four kinds, as the parish's own colours. Never a literal. */
function tintFor(kind: OccurrenceKind, theme: ReturnType<typeof useTheme>): string {
  switch (kind) {
    case 'liturgy':
      return theme.color.accent;
    case 'study':
      return theme.color.inkSoft;
    case 'gathering':
      return theme.color.accentStrong;
    default:
      return theme.color.rule;
  }
}

function Entry({ occurrence }: { occurrence: CalendarOccurrence }) {
  const theme = useTheme();
  // Through `kindOf`, never off `.kind` directly — it is null for everything
  // read from Breeze or the bulletin, where the title is all there is.
  const kind = kindOf(occurrence);

  const when = occurrence.allDay
    ? 'All day'
    : [formatClock(occurrence.startTime), formatClock(occurrence.endTime)]
        .filter((part) => part !== '')
        .join(' – ');

  return (
    <Card gap={theme.space.xs}>
      <View style={{ flexDirection: 'row', gap: theme.space.sm }}>
        <View
          style={{
            width: 3,
            borderRadius: 2,
            backgroundColor: tintFor(kind, theme),
          }}
        />
        <View style={{ flex: 1, gap: 2 }}>
          <Small color={theme.color.inkFaint}>{when}</Small>
          <Body>{occurrence.title}</Body>

          {occurrence.location !== '' ? (
            <Small color={theme.color.inkSoft}>{occurrence.location}</Small>
          ) : null}
          {occurrence.description !== '' ? (
            <Small color={theme.color.inkSoft}>{occurrence.description}</Small>
          ) : null}
          {occurrence.contact ? (
            <Small color={theme.color.inkSoft}>{occurrence.contact}</Small>
          ) : null}

          {occurrence.source === 'servants' ? (
            <Small color={theme.color.accent}>Servants</Small>
          ) : null}
        </View>
      </View>
    </Card>
  );
}
