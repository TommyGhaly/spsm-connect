/**
 * The church calendar: this week, or this month.
 *
 * ---------------------------------------------------------------------------
 * It opens on the week. The website opens on the month.
 *
 * That is the one deliberate difference between the two surfaces, and it is
 * about how big the thing in your hand is rather than about taste. A month grid
 * is the orienting view for somebody arriving at a *page* without a specific
 * question — thirty-five cells, and the shape of the month reads at a glance.
 * Thirty-five cells on a phone are forty-eight points wide: enough to say "this
 * Saturday is busy" and not enough to say what with, so every answer costs a
 * second gesture. The week is the view a phone can actually finish a question
 * in, and it is what somebody standing in the narthex on a Tuesday wants.
 *
 * The month is still here, one tap away, and it is a real month rather than a
 * shrunken table — dots by kind in the cells, and the day you tap opened in
 * full below the grid. That is the website's own narrow-screen behaviour
 * (`MonthView`'s `DayPanel`), not an invention for this app.
 * ---------------------------------------------------------------------------
 *
 * ## What is shared, and what is not
 *
 * Everything that decides *what* is on the calendar is in `@spsm/shared` and is
 * not re-decided here: `rangeFor` and `step` do the arithmetic,
 * `mergeCalendarSources` reconciles four descriptions of the same week,
 * `applyCalendarDetails` lays the church's annotations over the survivors, and
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
 * **A refused servants request falls back to the church calendar**, not to
 * nothing. The token disagreed with what this screen believed — a grant
 * changed, or the session outlived it — and the church schedule is still the
 * right thing to be looking at.
 *
 * ## The one thing this screen cannot do for itself
 *
 * Navigate. `src/calendar/` is rendered by the App Clip as well as by the tab,
 * and the clip never imports expo-router — see the wrapper at
 * `app/(drawer)/(tabs)/calendar.tsx`. So "read more about this" arrives as
 * `onOpenPage` from whoever is hosting the screen, and is simply absent for a
 * host with nowhere to send anybody.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import {
  ACCOUNT_SUBJECT_VALUE,
  PARISH_TIME_ZONE,
  applyCalendarDetails,
  groupByDay,
  kindOf,
  mergeCalendarSources,
  rangeFor,
  step,
  todayIn,
  type CalendarDetail,
  type CalendarOccurrence,
  type CalendarView,
  type OccurrenceKind,
} from '@spsm/shared';

import { Button, Card, Screen } from '@/components/Surface';
import { Body, Heading, Label, Micro, Small } from '@/components/Type';
import { signInWithMicrosoft } from '@/firebase/auth';
import { mayAdminScreen } from '@/firebase/grants';
import { useSession } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';

import { AddEntry } from './AddEntry';
import { useBulletin } from './BulletinProvider';
import { EventSheet } from './EventSheet';
import { DaySchedule } from './DaySchedule';
import { DayWheel } from './DayWheel';
import { MonthGrid } from './MonthGrid';
/*
 * The chrome the App Clip's `/c/schedule` draws too — the view switch, the
 * stepper, the busy rule, the legend, and the "this week / 3 weeks ago" label.
 * It was private to this file until the clip needed it; see `ViewControls.tsx`
 * for why importing this screen instead was not an option.
 */
import { BusyRule, Legend, Stepper, ViewSwitch, whereLabel } from './ViewControls';
import { getFeatureOccurrences, getSchedule, getStaffLayers, type ScheduleResult } from './data';

export function CalendarScreen({
  onOpenPage,
}: {
  /** Opens a feature event's own page. Absent in the App Clip, which has none. */
  onOpenPage?: (href: string) => void;
}) {
  const theme = useTheme();
  const { isPerson, grants, loading: sessionLoading } = useSession();

  /**
   * Week first. See the header for why this is the one place the two surfaces
   * disagree on purpose.
   */
  const [view, setView] = useState<CalendarView>('week');

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

  const range = useMemo(() => rangeFor(view, anchor), [view, anchor]);

  /**
   * Bumped by the Today button, so the wheel re-centres even when the week did
   * not change. See the prop of the same name on `DayWheel`.
   */
  const [recentre, setRecentre] = useState(0);

  /**
   * The day the week view is reading, which the wheel picks and the schedule
   * below it renders.
   *
   * Held here rather than inside the wheel because two things need it and they
   * are siblings, not parent and child — which is the arrangement that got the
   * entries out of the wheel and the wheel out of the page's scroll view.
   */
  const [picked, setPicked] = useState(() => todayIn(PARISH_TIME_ZONE));

  /* ---- who is reading ---------------------------------------------------- */

  /*
   * Sign-in is Microsoft-only and restricted to the church's Entra directory,
   * so having a session *is* being on the rota — the same reasoning
   * `servantEvents` uses in firestore.rules, where the check is `signedIn()`
   * and nothing finer. `isPerson` excludes the anonymous session the upload
   * path creates, which is the distinction that matters here.
   */
  const isServant = isPerson;
  const [wantServants, setWantServants] = useState(true);
  const [deniedNote, setDeniedNote] = useState<string | null>(null);

  /*
   * Whether to draw the edit controls — the `events` grant, and not a role.
   *
   * The same screen `firestore.rules` names on `scheduleEntries` and
   * `calendarDetails`, which is what makes this a hint rather than a boundary:
   * somebody who patched this check out of their own build still cannot write,
   * because the rules read the grant and not the button.
   */
  const mayEdit = mayAdminScreen(grants, 'events');

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

  /*
   * A day from last week must not stay picked into this one, and the day a new
   * week opens on is today when today is in it.
   *
   * Adjusted during render rather than in an effect — React's own documented
   * shape for "reset state when a value changes", and the same pattern the
   * denied note above uses. In an effect this would render one frame of next
   * week's wheel sitting on a day that is not in it.
   */
  const opensOn = today >= range.from && today <= range.to ? today : range.from;
  const [pickedFor, setPickedFor] = useState(range.from);
  if (pickedFor !== range.from) {
    setPickedFor(range.from);
    setPicked(opensOn);
  }

  const askingForServants = isServant && wantServants;

  /* ---- the three quiet sources ------------------------------------------- */

  /*
   * The bulletin is read by a provider rather than by this screen, because the
   * announcements bell is header chrome on every tab now and five screens
   * firing their own `/api/bulletin` would be five reads of another Firebase
   * project for one document that changes weekly. Its default is an empty
   * bulletin rather than a throw, so the App Clip can still render this screen
   * without mounting the provider — see `BulletinProvider`.
   */
  const bulletin = useBulletin();
  const [features, setFeatures] = useState<CalendarOccurrence[]>([]);
  const [layers, setLayers] = useState<{
    entries: CalendarOccurrence[];
    details: Map<string, CalendarDetail>;
  }>({ entries: [], details: new Map() });

  /**
   * Bumped after any staff write, so the layers re-read.
   *
   * A listener would be live without it, but it would also hold a Firestore
   * subscription open on a screen most people read once — and the only
   * writer is the person looking at it, who does not need to be told about
   * their own edit by the server.
   */
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let live = true;
    void getFeatureOccurrences().then((next) => live && setFeatures(next));
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    let live = true;
    void getStaffLayers().then((next) => live && setLayers(next));
    return () => {
      live = false;
    };
  }, [reload]);

  /* ---- the schedule ------------------------------------------------------- */

  /**
   * The answer, and which range it answers for.
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

  const key = `${range.from}..${range.to}:${askingForServants ? 'servants' : 'church'}`;

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
          inRange(bulletin.occurrences),
          schedule,
        ]),
        layers.details,
      ),
    );
  }, [result, features, bulletin.occurrences, layers, range]);

  const includesServants = result?.kind === 'ok' && result.feed.includesServants;

  /**
   * Which kinds are on the calendar in front of the reader.
   *
   * The key used to name all three every time. A key is read off the thing it
   * explains, so a row for "Classes & studies" in a week with no class in it is
   * a colour the reader then goes looking for — and in the month view, where
   * three lines of it sit under a grid of dots, it was the largest block of
   * text on the screen explaining the smallest marks.
   *
   * Through `kindOf`, the way every other tint in this screen is decided.
   */
  const kindsShown = useMemo(() => {
    const seen = new Set<OccurrenceKind>();
    for (const entries of byDay.values()) {
      for (const occurrence of entries) seen.add(kindOf(occurrence));
    }
    return seen;
  }, [byDay]);

  const goto = useCallback(
    (delta: number) => setAnchor((at) => step(view, at, delta)),
    [view],
  );

  /** The occurrence the sheet is showing, and which of its days was tapped. */
  const [opened, setOpened] = useState<{ occurrence: CalendarOccurrence; day: string } | null>(null);

  /*
   * Re-read from `byDay` rather than kept as the object that was tapped, so
   * that saving a detail updates the open sheet instead of leaving it showing
   * what was true a moment ago.
   */
  const openedNow =
    opened === null
      ? null
      : ((byDay.get(opened.day) ?? []).find((entry) => entry.id === opened.occurrence.id) ??
        opened.occurrence);

  /*
   * Whether today is in the range on screen. Read twice: `Stepper` decides
   * whether Today has anything left to do (its own prop says when), and
   * `AddEntry` uses it to pick the day its form opens on.
   */
  const todayIsHere = today >= range.from && today <= range.to;

  /*
   * The week view is laid out to fit the window; the month view scrolls.
   *
   * That difference is the whole answer to two scroll views stacked in one
   * column. In the week the page is fixed — header, wheel, the day's schedule
   * in whatever height is left, the key and the switch at the foot — so the
   * only things that scroll are the wheel and the list, side by side in
   * separate parts of the screen. The month has nothing in it that scrolls of
   * its own: a grid is a grid, and the day panel it opens is as long as the day
   * is, so the page is the right thing to move.
   */
  const fixed = view === 'week';

  return (
    <Screen
      scroll={!fixed}
      gap={theme.space.sm}
      padBottom={fixed ? theme.space.gutter : undefined}
    >
      <View style={{ gap: theme.space.sm }}>
        {/*
          Where this week sits relative to the one the reader is in, and then
          which week it actually is.

          The eyebrow is the fix for a question the screen could not answer:
          "September 7–13, 2026" is a fact about a range and says nothing about
          *now*, so three taps of the forward arrow left the reader holding a
          date they had to work out for themselves. Today being marked in the
          wheel only helps on the weeks that contain it — which are exactly the
          weeks the reader was not lost on.

          The announcements bell used to live in this row; it is header chrome
          on every tab now — `src/navigation/AnnouncementsButton.tsx`, wired
          into the tabs' `screenOptions` — which is where a mark that is about
          the whole week rather than about the calendar belongs.
        */}
        <Label color={todayIsHere ? theme.color.accent : theme.color.inkFaint}>
          {whereLabel(view, range, today)}
        </Label>
        {/*
          `Heading` and not `Title`, alone among this app's screens.

          The week view is laid out to fit the window, so every point the header
          takes is a point off the day being read — and at `title` the range ran
          to twenty-eight points of serif for a line nobody has to read twice.
          The eyebrow above it is what the reader is actually orienting by.
        */}
        <Heading>{range.label}</Heading>

        <BusyRule busy={busy} />

        {/*
          Two groups of controls and nothing in between, which is the whole
          reason the working state became a rule above rather than the word
          "Updating…" in the gap. Five separately outlined boxes in one row
          gave no clue which of them belonged together, and the slack between
          them was carrying a message.
        */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
          <ViewSwitch view={view} onPick={setView} />

          <View style={{ flex: 1 }} />

          {/*
            The add control sits with the calendar rather than on a screen of
            its own — the programme's settled pattern, and it earns it here:
            whoever is adding a service is looking at the week they are adding
            it to. It defaults to the day in view, so adding something to the
            week you are reading is one field shorter.
          */}
          {mayEdit ? (
            <AddEntry
              compact
              defaultDay={fixed ? picked : todayIsHere ? today : range.from}
              onAdded={() => setReload((count) => count + 1)}
            />
          ) : null}

          <Stepper
            view={view}
            onStep={goto}
            onToday={() => {
              setAnchor(today);
              setRecentre((count) => count + 1);
            }}
            todayIsHere={todayIsHere}
          />
        </View>
      </View>

      {deniedNote ? (
        <Card>
          <Label>The servants schedule was not available</Label>
          <Body color={theme.color.inkSoft}>{deniedNote}</Body>
          <Small color={theme.color.inkFaint}>
            The rest of the calendar below is the church schedule, which is unaffected.
          </Small>
        </Card>
      ) : null}

      {result?.kind === 'unset' ? (
        <Card>
          <Label>Not set up yet</Label>
          <Body color={theme.color.inkSoft}>
            The church has not connected a calendar yet. Nothing is missing from the church — only
            from this app.
          </Body>
        </Card>
      ) : null}

      {/*
        The grid is still drawn under this, and that is the point: the church's
        own events and the bulletin are already in `byDay`, so an unreachable
        Breeze costs the reader the liturgies and not the screen.
      */}
      {result?.kind === 'error' && result.message !== '' ? (
        <Card>
          <Label>The calendar could not be read</Label>
          <Body color={theme.color.inkSoft}>{result.message}</Body>
        </Card>
      ) : null}

      {fixed ? (
        <>
          <DayWheel
            range={range}
            byDay={byDay}
            today={today}
            picked={picked}
            onPick={setPicked}
            recentre={recentre}
          />
          {/*
            The rules over and under the day's schedule.

            It scrolls in a fixed band between the wheel and the foot, so a
            long day meets both edges mid-row. A card sliced off against
            nothing reads as a card that failed to draw; against a line it
            reads as a list going on past the edge of its pane, which is what
            it is. The pair is also what tells the reader there are two
            scrollable things here and where one ends — the complaint that
            started all of this was not being able to tell.
          */}
          <View style={{ height: 1, backgroundColor: theme.color.rule }} />

          <DaySchedule
            day={picked}
            entries={byDay.get(picked) ?? []}
            loading={busy}
            onOpen={(occurrence, day) => setOpened({ occurrence, day })}
          />
        </>
      ) : (
        <MonthGrid
          range={range}
          byDay={byDay}
          today={today}
          loading={busy}
          onOpen={(occurrence, day) => setOpened({ occurrence, day })}
        />
      )}

      {/* The other half of the pair; see the note on the first. */}
      {fixed ? <View style={{ height: 1, backgroundColor: theme.color.rule }} /> : null}

      <Legend kinds={kindsShown} showServants={includesServants} />

      {/*
        The servants switch sits at the foot rather than above the calendar.

        It is a control a few dozen people touch once, and above the grid it was
        the first thing between the stepper and the week — a band explaining a
        distinction to somebody who had come to find out when the Liturgy is.
        Down here it is still the first thing a servant looks for, because it is
        the only outlined thing on the screen.
      */}
      {isServant ? (
        <ServantSwitch
          on={askingForServants}
          included={includesServants}
          onToggle={() => {
            setDeniedNote(null);
            setWantServants((was) => !was);
          }}
        />
      ) : sessionLoading ? null : (
        <SignInOffer onOpenPage={onOpenPage} />
      )}

      <EventSheet
        occurrence={openedNow}
        day={opened?.day ?? null}
        detail={openedNow ? (layers.details.get(openedNow.id) ?? null) : null}
        mayEdit={mayEdit}
        onOpenPage={onOpenPage}
        onClose={() => setOpened(null)}
        onChanged={() => setReload((count) => count + 1)}
      />
    </Screen>
  );
}

/**
 * The servants switch.
 *
 * A switch rather than nothing at all, because a servant is also an ordinary member of the congregation:
 * "what is the church doing this week" and "what am I on the hook for" are
 * different questions, and the internal entries — tentative plans, which van is
 * out, blocked-off prep days — are noise against the first one. Off, this
 * screen is exactly what everybody else sees.
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

  /*
   * One line, and the state on the right.
   *
   * It was a padded card with a label over a sentence of instruction — "Tap to
   * include what you are serving" — which is three lines of chrome under a
   * calendar to say what the control's own two words say. A switch does not
   * need to be told it can be tapped; what it needs to say is whether it is on,
   * and that is now the word on the right rather than a paraphrase underneath.
   *
   * The one state worth more than a word is `on` without `included`: the rota
   * has been asked for and has not arrived. "Asking…" is that, and it is the
   * only reason this reads the feed rather than the toggle.
   */
  const state = on ? (included ? 'Shown' : 'Asking…') : 'Hidden';

  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.sm,
        backgroundColor: pressed
          ? theme.color.paperSunken
          : on
            ? theme.color.accentSoft
            : theme.color.paperRaised,
        borderColor: on ? theme.color.accent : theme.color.rule,
        borderWidth: 1,
        borderRadius: theme.radius.full,
        paddingVertical: theme.space.sm,
        paddingHorizontal: theme.space.md,
        minHeight: 44,
      })}
    >
      {/* The same dashed ring the key uses for a servants entry, so the switch
          and the thing it switches on are marked alike. */}
      <View
        style={{
          width: 10,
          height: 10,
          borderRadius: theme.radius.full,
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: on ? theme.color.accent : theme.color.inkFaint,
        }}
      />
      <Small>Servants schedule</Small>
      <View style={{ flex: 1 }} />
      <Small color={on ? theme.color.accent : theme.color.inkFaint}>{state}</Small>
    </Pressable>
  );
}

/**
 * The signed-out half of the servants switch, in the place the switch occupies
 * for somebody who has signed in.
 *
 * ---------------------------------------------------------------------------
 * Deliberately quiet, and much shorter than the website's.
 *
 * /calendar carries three columns of it: how to sign in, what to do when it
 * refuses you, and how to be given an account — because on the web the sign-in
 * control is a circle at the top of a page and the failure is somebody's
 * personal Outlook address being turned away by a single-tenant directory.
 *
 * Here the button is right there and it opens Microsoft itself, so two of those
 * three columns have nothing to explain. What survives is the refusal, because
 * it is the one thing nobody works out on their own: a personal Microsoft,
 * Outlook or Hotmail address is not broken, it is not a church account. Asking
 * for an account is what /contact is for, on both surfaces.
 * ---------------------------------------------------------------------------
 */
function SignInOffer({ onOpenPage }: { onOpenPage?: (href: string) => void }) {
  const theme = useTheme();
  const { refresh } = useSession();

  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setProblem(null);
    try {
      await signInWithMicrosoft();
      await refresh();
    } catch (error) {
      /*
       * Includes the ordinary case of somebody closing the Microsoft sheet,
       * which is not worth an alarming word. The provider's own message is
       * shown because it distinguishes "you cancelled" from "that account is
       * not in this church's tenant", and the second one needs saying.
       */
      setProblem(error instanceof Error ? error.message : 'Signing in did not work.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: theme.space.sm }}>
      <Small color={theme.color.inkSoft}>
        Serving? Sign in and your rota appears in the calendar above, marked.
      </Small>
      <Button
        label={busy ? 'Opening sign-in…' : 'Sign in with church account'}
        tone="quiet"
        onPress={() => void go()}
        busy={busy}
      />
      {/*
        The refusal, and only once there has been one.

        It used to be printed under the button on every visit, which put a
        paragraph about Hotmail addresses at the foot of the church calendar for
        the several hundred readers who will never press the button. It is the
        one thing nobody works out on their own — so it is still said, at the
        moment it explains something that has just happened to the reader.
      */}
      {problem ? (
        <View style={{ gap: theme.space.xs }}>
          <Small color={theme.color.accent}>{problem}</Small>
          <Micro color={theme.color.inkFaint}>
            A personal Microsoft, Outlook or Hotmail address is refused: only accounts in the
            church&rsquo;s own directory can sign in.
          </Micro>
          {/*
            The third of the website's three columns, which used to have nowhere
            to go: asking for an account is what the contact form is for, and it
            now exists in the app. `about` opens it on the right subject, so
            nobody has to work out which of the eight this is — the value is the
            one `@spsm/shared` names, not a string spelled out here.

            Through `onOpenPage` rather than a router, because this screen is
            also the App Clip's and the clip has no routes. A host with nowhere
            to send anybody simply does not get the button.
          */}
          {onOpenPage ? (
            <Button
              label="Ask the office for an account"
              tone="quiet"
              onPress={() => onOpenPage(`/forms/contact?about=${ACCOUNT_SUBJECT_VALUE}`)}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
