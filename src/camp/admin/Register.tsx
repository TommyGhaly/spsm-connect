/**
 * `/admin/camp/attendance` — the register, in a hand, at a door.
 *
 * ---------------------------------------------------------------------------
 * The port of the website's `AttendanceScreen`, and the one camp screen that is
 * *better* on a phone than on a laptop: a servant standing at the hall door at
 * nine in the morning is not carrying a laptop. Everything the website decided
 * holds here, and none of it is re-litigated:
 *
 *  - **A tick and a time, not a name.** Recording who collected each child was
 *    offered and turned down; `by` carries the uid of whoever tapped.
 *  - **Children only.** Servants carry `days` too and are deliberately absent.
 *    "Four missing from 3rd grade" has to be four nine-year-olds, not three
 *    nine-year-olds and a servant stuck in traffic.
 *  - **Every tick is a merge of one field path**, never a read-modify-write.
 *    Two servants marking the same morning from two devices, and a replacing
 *    write would put back a register missing every tick the other made in
 *    between — silently, with no conflict to report. See `markAttendance`.
 *
 * ## The two halves, and the day
 *
 * The morning is *who showed up*: every child down for today, plus anybody who
 * turned up who was not, one tick each. The afternoon is *who is still here and
 * who is collecting them*: only the children who actually arrived, with a
 * guardian's name and number beside each one — and on a phone that number is a
 * tap that dials, which is the whole reason somebody standing outside at three
 * o'clock wants this screen rather than the laptop in the office.
 *
 * The half is derived from the clock and then overridable at any time, so a
 * pickup at eleven is one tap away rather than impossible. The day opens on
 * `nearestCampDay` — today during camp, and the closest day either side of it
 * the rest of the year.
 *
 * ## The day picker is the website's, laid out for a thumb
 *
 * A row of five weekday tabs per week, each carrying the date under the
 * weekday, headed by the week's own range. Same control, same order, same
 * labels, same `CampDayKey`s underneath — a servant who has used the website's
 * register is not learning a second thing. What changed is only that five tabs
 * share the width of a phone instead of sitting in a strip beside a heading.
 *
 * ## One scroller, not a list
 *
 * A `ScrollView` of every row rather than a `FlashList`. A camp season is a few
 * hundred children and one day's sections are fewer, the rows are cheap, and
 * the sectioning is the thing that makes the screen readable — a virtualised
 * list with sticky headers would buy frames this screen does not need and cost
 * the one property it does: that scrolling back up to a grade you have already
 * done shows exactly what you left there.
 * ---------------------------------------------------------------------------
 */
import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import {
  CAMP_AFTERNOON_FROM_HOUR,
  CAMP_WEEKDAYS,
  attendanceByGrade,
  attendanceByGroup,
  attendancePresence,
  attendanceRows,
  attendanceTally,
  campDayDateLabel,
  campDayHeading,
  campDayKey,
  campHalfForDay,
  campPeople,
  campWeekRangeLabel,
  campWeekdayLabel,
  everyoneCollected,
  nearestCampDay,
  parseCampDayKey,
  toDate,
  type CampAllocationDraft,
  type CampAttendanceEntry,
  type CampAttendanceRow,
  type CampAttendanceSection,
  type CampDayKey,
  type CampHalf,
  type CampPersonKey,
  type CampRegistration,
} from '@spsm/shared';

import { Icon } from '@/components/Icon';
import { Card } from '@/components/Surface';
import { Body, Label, Micro, Small, Subheading } from '@/components/Type';
import { useTheme } from '@/theme/ThemeProvider';

import { CampLoading, CampProblem, CampShell } from './CampShell';
import {
  markAttendance,
  subscribeAllocation,
  subscribeAttendance,
  subscribeRegistrations,
  type WithId,
} from './data';
import { useCampAdmin } from './session';

/** How often the clock is asked again, so noon turns the day over by itself. */
const CLOCK_MS = 30_000;

export function Register() {
  const theme = useTheme();
  const session = useCampAdmin();
  const { ready, canEdit, config, uid } = session;
  const { programId, season, weeks, weekStarts } = config;

  const [registrations, setRegistrations] = useState<WithId<CampRegistration>[] | null>(null);
  const [allocation, setAllocation] = useState<CampAllocationDraft | null>(null);
  const [entries, setEntries] = useState<Record<CampPersonKey, CampAttendanceEntry>>({});
  const [dayExists, setDayExists] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [cut, setCut] = useState<'grade' | 'group'>('grade');

  /*
   * The day: `nearestCampDay` until somebody picks one, and then theirs.
   *
   * Derived rather than stored, and that is worth the sentence. The camp's dates
   * arrive a moment after the screen does — `useCampConfig` is a listener, so
   * the first render has no `weekStarts` at all — and a `day` held in state
   * would be week one Monday, computed against nothing, and would stay there.
   * The website fixes that with an effect that recomputes the day when the
   * dates land and a `pinnedDay` flag to stop it overriding a choice. Two
   * pieces of state and an effect, to express "the answer follows the config
   * unless a person has said otherwise" — which is one `??`.
   *
   * So `picked` is the only state, and null means "whatever today is nearest
   * to". The register therefore opens on the right day the instant the dates
   * arrive, with no second render to watch for.
   */
  const [picked, setPicked] = useState<CampDayKey | null>(null);
  const day = picked ?? nearestCampDay(weekStarts, weeks);

  /*
   * The clock, asked again every half minute.
   *
   * Not decoration: the register is opened at nine and is still open at noon, on
   * a phone nobody has touched for an hour, and "it turns over at twelve" has to
   * mean that rather than "it would have, if somebody had reopened the app".
   * Half a minute is plenty — this drives one boundary a day and nothing here
   * renders a running clock.
   */
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), CLOCK_MS);
    return () => clearInterval(timer);
  }, []);

  /*
   * The half: derived from the day and the clock until somebody says otherwise.
   *
   * Cleared whenever the day changes, so picking Thursday re-applies the rule
   * rather than carrying Tuesday's choice across. Within one day a manual
   * choice wins for as long as that day is open, noon included — a servant who
   * went to the morning list at 12:20 to tick in a late arrival would not thank
   * us for taking it away thirty seconds later.
   */
  const [pinnedHalf, setPinnedHalf] = useState<CampHalf | null>(null);
  const half = pinnedHalf ?? campHalfForDay(weekStarts, day, now);

  useEffect(() => {
    if (!ready || !canEdit) return;
    return subscribeRegistrations(programId, season, setRegistrations, (cause) =>
      setProblem(cause.message),
    );
  }, [ready, canEdit, programId, season]);

  useEffect(() => {
    if (!ready || !canEdit) return;
    return subscribeAllocation(
      programId,
      season,
      setAllocation,
      // The register still works with no groups arranged: the By group cut puts
      // everybody in one section at the end and says so. Not worth an error.
      () => setAllocation(null),
    );
  }, [ready, canEdit, programId, season]);

  useEffect(() => {
    if (!ready || !canEdit) return;
    return subscribeAttendance(
      programId,
      season,
      day,
      (snapshot) => {
        setEntries(snapshot.entries);
        setDayExists(snapshot.exists);
      },
      (cause) => setProblem(cause.message),
    );
  }, [ready, canEdit, programId, season, day]);

  const people = useMemo(() => campPeople(registrations ?? []), [registrations]);
  const rows = useMemo(() => attendanceRows(people, day, entries), [people, day, entries]);
  const tally = useMemo(() => attendanceTally(rows), [rows]);
  const presence = useMemo(() => attendancePresence(rows), [rows]);

  // The morning is cut the way the pills say; the afternoon is cut the same way
  // over the children on site alone, which is the half's whole point.
  const sections = useMemo(() => {
    const subject = half === 'afternoon' ? presence.onSite : rows;
    return cut === 'group'
      ? // The board is one arrangement per week, so the register has to say
        // which week it is reading. The day key already knows.
        attendanceByGroup(subject, allocation, parseCampDayKey(day)?.week ?? 1)
      : attendanceByGrade(subject);
  }, [half, presence.onSite, rows, cut, allocation, day]);

  function tick(key: CampPersonKey, which: 'arrived' | 'collected', on: boolean) {
    void markAttendance({
      programId,
      season,
      day,
      key,
      which,
      on,
      uid,
      exists: dayExists,
    }).catch((cause: Error) => setProblem(cause.message));
  }

  if (!ready || !canEdit) {
    return (
      <CampShell session={session} tab="attendance">
        {problem ? <CampProblem error={problem} /> : null}
      </CampShell>
    );
  }

  if (registrations === null) {
    return (
      <CampShell session={session} tab="attendance">
        {problem ? <CampProblem error={problem} /> : <CampLoading what="attendance" />}
      </CampShell>
    );
  }

  return (
    <CampShell session={session} tab="attendance">
      {problem ? <CampProblem error={problem} /> : null}

      <DayPicker
        weeks={weeks}
        weekStarts={weekStarts}
        day={day}
        onPick={(next) => {
          // A new day is a new question. Thursday afternoon does not mean the
          // servant wants Friday afternoon, and the rule guesses better than
          // the last tap did.
          setPinnedHalf(null);
          setPicked(next);
        }}
      />

      <Card gap={theme.space.sm}>
        <HalfSwitch half={half} onPick={setPinnedHalf} />

        {pinnedHalf ? (
          <Pressable
            onPress={() => setPinnedHalf(null)}
            accessibilityRole="button"
            style={{ minHeight: 32, justifyContent: 'center' }}
          >
            <Micro color={theme.color.accent}>Follow the clock</Micro>
          </Pressable>
        ) : (
          <Micro color={theme.color.inkFaint}>
            {half === 'morning'
              ? `Turns over at ${CAMP_AFTERNOON_FROM_HOUR % 12 || 12} pm`
              : 'Following the clock'}
          </Micro>
        )}

        {half === 'morning' ? (
          <Body>
            <Body color={theme.color.accentStrong}>{tally.in}</Body>
            {` of ${tally.expected} in`}
            {tally.missing > 0 ? `  ·  ${tally.missing} not here yet` : ''}
            {tally.extra > 0 ? `  ·  ${tally.extra} not expected today` : ''}
          </Body>
        ) : (
          <Body>
            <Body color={theme.color.accentStrong}>{tally.here}</Body>
            {` still on site  ·  ${tally.gone} gone home`}
            {/*
              * Walk-ins, counted in the afternoon as well as the morning. The
              * list has always held them — anybody ticked in is on it, down for
              * today or not — but a servant reading "14 still on site" against
              * a morning that expected twelve had no way to see that the extra
              * two are the two who swapped days, and a count that cannot be
              * reconciled is a count somebody stops trusting.
              */}
            {tally.extra > 0 ? `  ·  ${tally.extra} not down for today` : ''}
            {tally.expected > 0 && everyoneCollected(tally)
              ? '  ·  everybody has gone home'
              : ''}
          </Body>
        )}

        <CutSwitch cut={cut} onPick={setCut} />
      </Card>

      {half === 'afternoon' && presence.onSite.length === 0 ? (
        <Card>
          <Body color={theme.color.inkSoft}>
            {presence.goneHome.length > 0
              ? 'Everybody who came today has gone home.'
              : `Nobody has been ticked in for ${campDayHeading(weekStarts, day)} yet.`}
          </Body>
        </Card>
      ) : sections.length === 0 ? (
        <Card>
          <Body color={theme.color.inkSoft}>
            Nobody is registered for {campDayHeading(weekStarts, day)}.
          </Body>
        </Card>
      ) : (
        sections.map((section) => (
          <Section key={section.id} section={section} half={half} onTick={tick} />
        ))
      )}

      {half === 'afternoon' ? (
        <>
          <GoneHome rows={presence.goneHome} onTick={tick} />
          {/*
            * The one thing the afternoon cannot do, said out loud.
            *
            * A child collected who was never ticked in used to be markable from
            * this screen, because a servant at a gate has to be able to record
            * what has just happened. The half took the control away, so it says
            * where the control went instead of leaving somebody tapping at a
            * name that is not on the list.
            */}
          <Micro color={theme.color.inkFaint}>
            Collecting a child who was never ticked in? Mark them in on the morning list
            first.
          </Micro>
        </>
      ) : null}
    </CampShell>
  );
}

/* ---------------------------------------------------------------------------
 * The day, the half, and the cut
 * ------------------------------------------------------------------------ */

/**
 * Which day of camp is being ticked.
 *
 * One card per week, headed by the week's range, holding a row of five weekday
 * tabs — the website's control exactly, with the five tabs sharing the width of
 * a phone. The date under the weekday is the load-bearing part: a servant is
 * answering a question about *today*, and "Tue" alone in the middle of a
 * fortnight is two possible days.
 */
function DayPicker({
  weeks,
  weekStarts,
  day,
  onPick,
}: {
  weeks: number;
  weekStarts: readonly string[];
  day: CampDayKey;
  onPick: (day: CampDayKey) => void;
}) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.space.sm }}>
      {Array.from({ length: Math.max(1, weeks) }, (_unused, index) => index + 1).map((week) => {
        const range = campWeekRangeLabel(weekStarts, week);

        return (
          <Card key={week} gap={theme.space.xs}>
            <Label color={theme.color.inkFaint}>
              {range === `Week ${week}` ? `WEEK ${week}` : `WEEK ${week} · ${range}`}
            </Label>

            <View
              accessibilityRole="tablist"
              accessibilityLabel={`Week ${week}`}
              style={{ flexDirection: 'row', gap: theme.space.xs }}
            >
              {CAMP_WEEKDAYS.map((weekday) => {
                const key = campDayKey(week, weekday);
                const on = key === day;
                const date = campDayDateLabel(weekStarts, key);

                return (
                  <Pressable
                    key={key}
                    onPress={() => onPick(key)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={date || campWeekdayLabel(weekday)}
                    style={({ pressed }) => ({
                      flex: 1,
                      minHeight: 48,
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 1,
                      borderWidth: 1,
                      borderColor: on ? theme.color.accent : theme.color.rule,
                      borderRadius: theme.radius.sm,
                      backgroundColor: on
                        ? theme.color.accent
                        : pressed
                          ? theme.color.accentSoft
                          : theme.color.paper,
                    })}
                  >
                    <Small color={on ? theme.color.inkInverse : theme.color.ink}>
                      {campWeekdayLabel(weekday)}
                    </Small>
                    {/*
                      * Just the day of the month: the month is in the heading
                      * above and repeating it ten times is noise. This is the
                      * website's `date.split(' ').pop()` — "Wed, Jun 24" ends
                      * in the number.
                      */}
                    {date ? (
                      <Micro color={on ? theme.color.inkInverse : theme.color.inkFaint}>
                        {date.split(' ').pop()}
                      </Micro>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </Card>
        );
      })}
    </View>
  );
}

/**
 * Morning or afternoon.
 *
 * Two tabs rather than a sliding switch. A switch has an off state and a state
 * it is *going* to, and this is neither — it is two named lists, one of which
 * is showing, and both names have to be readable by a thumb at a gate.
 */
function HalfSwitch({
  half,
  onPick,
}: {
  half: CampHalf;
  onPick: (half: CampHalf) => void;
}) {
  const theme = useTheme();

  const halves: { value: CampHalf; label: string; says: string }[] = [
    { value: 'morning', label: 'Morning', says: 'who showed up' },
    { value: 'afternoon', label: 'Afternoon', says: 'who is still here' },
  ];

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel="Which half of the day"
      style={{ flexDirection: 'row', gap: theme.space.xs }}
    >
      {halves.map((entry) => {
        const on = half === entry.value;

        return (
          <Pressable
            key={entry.value}
            onPress={() => onPick(entry.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${entry.label}, ${entry.says}`}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: 52,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: on ? theme.color.accent : theme.color.rule,
              borderRadius: theme.radius.sm,
              backgroundColor: on
                ? theme.color.accentSoft
                : pressed
                  ? theme.color.paperSunken
                  : theme.color.paper,
            })}
          >
            <Small color={on ? theme.color.accentStrong : theme.color.ink}>{entry.label}</Small>
            <Micro color={theme.color.inkFaint}>{entry.says}</Micro>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * By grade, or by the groups the camp arranged.
 *
 * Grade is the default and is what was asked for; groups is what the person
 * actually holding the phone wants, because they are standing with *their* nine
 * children and not with the thirty-one third-graders. A servant who has to
 * scroll a grade to find their group will mark paper instead.
 */
function CutSwitch({
  cut,
  onPick,
}: {
  cut: 'grade' | 'group';
  onPick: (cut: 'grade' | 'group') => void;
}) {
  const theme = useTheme();

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel="How the register is cut"
      style={{
        flexDirection: 'row',
        backgroundColor: theme.color.paperSunken,
        borderRadius: theme.radius.full,
        padding: 2,
      }}
    >
      {(['grade', 'group'] as const).map((value) => {
        const on = cut === value;

        return (
          <Pressable
            key={value}
            onPress={() => onPick(value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: 36,
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
              {value === 'grade' ? 'By grade' : 'By group'}
            </Small>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ---------------------------------------------------------------------------
 * The list
 * ------------------------------------------------------------------------ */

function Section({
  section,
  half,
  onTick,
}: {
  section: CampAttendanceSection;
  half: CampHalf;
  onTick: (key: CampPersonKey, which: 'arrived' | 'collected', on: boolean) => void;
}) {
  const theme = useTheme();

  return (
    <Card gap={theme.space.xs}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: theme.space.sm }}>
        <Subheading>{section.name}</Subheading>
        <View style={{ flex: 1 }} />
        <Micro color={theme.color.inkFaint}>
          {half === 'afternoon'
            ? `${section.rows.length} still here`
            : `${section.tally.in} of ${section.tally.expected} in${
                section.tally.missing > 0 ? ` · ${section.tally.missing} missing` : ''
              }`}
        </Micro>
      </View>

      <View>
        {section.rows.map((row, index) => (
          <Row
            key={row.person.key}
            row={row}
            half={half}
            first={index === 0}
            onTick={onTick}
          />
        ))}
      </View>
    </Card>
  );
}

/**
 * The children who have gone home, in a drawer under the afternoon.
 *
 * Kept rather than dropped so that a "Left" tapped on the wrong row is one tap
 * from being taken back, and shut so that the top of the screen is always the
 * list that has to reach empty.
 */
function GoneHome({
  rows,
  onTick,
}: {
  rows: readonly CampAttendanceRow[];
  onTick: (key: CampPersonKey, which: 'arrived' | 'collected', on: boolean) => void;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  if (rows.length === 0) return null;

  return (
    <Card gap={theme.space.xs}>
      <Pressable
        onPress={() => setOpen(!open)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space.sm,
          minHeight: 44,
        }}
      >
        <Icon name="chevron" size={16} color={theme.color.inkSoft} />
        <Small>
          Gone home · {rows.length} {rows.length === 1 ? 'child' : 'children'}
        </Small>
      </Pressable>

      {open ? (
        <View>
          {rows.map((row, index) => (
            <Row
              key={row.person.key}
              row={row}
              half="afternoon"
              first={index === 0}
              onTick={onTick}
            />
          ))}
        </View>
      ) : null}
    </Card>
  );
}

function Row({
  row,
  half,
  first,
  onTick,
}: {
  row: CampAttendanceRow;
  half: CampHalf;
  /** Hairlines between rows rather than around each one, so the first has none. */
  first: boolean;
  onTick: (key: CampPersonKey, which: 'arrived' | 'collected', on: boolean) => void;
}) {
  const theme = useTheme();
  const arrived = row.entry?.arrived ?? null;
  const collected = row.entry?.collected ?? null;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.sm,
        paddingVertical: theme.space.xs,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: theme.color.rule,
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        {/*
          * The name, and nothing medical.
          *
          * An allergy chip used to sit here on the website and came off: a
          * register is a tick at a door, and what the kitchen and the first-aid
          * box need belongs where somebody can act on it — the roster and the
          * group board — not on the one screen whose whole job is a name and a
          * time.
          */}
        <Small>{row.person.name || 'Unnamed'}</Small>

        {/* A child not down for today is still tickable — camps take walk-ins
            and a parent swaps Tuesday for Wednesday at the gate. The flag is so
            the count above reads honestly, not a refusal. */}
        {!row.expected ? (
          <Micro color={theme.color.inkFaint}>not down for today</Micro>
        ) : null}

        {half === 'afternoon' ? (
          <Guardian
            name={row.person.contactName}
            phone={row.person.contactPhone}
            arrivedAt={arrived?.at}
          />
        ) : null}
      </View>

      {half === 'morning' ? (
        <Tick
          label="In"
          on={arrived !== null}
          at={arrived?.at}
          onChange={(on) => onTick(row.person.key, 'arrived', on)}
          who={row.person.name}
        />
      ) : (
        <Tick
          label="Left"
          on={collected !== null}
          at={collected?.at}
          onChange={(on) => onTick(row.person.key, 'collected', on)}
          who={row.person.name}
        />
      )}
    </View>
  );
}

/**
 * Who is collecting, and their number as something that dials.
 *
 * The registration's contact, which is the guardian on a family registration.
 * A real dial rather than text on a screen, because this is read on a phone,
 * standing outside, by somebody who needs to ring a mother who is late — and
 * the punctuation has to come out or some dialers choke on it.
 *
 * The arrival time goes here too, so a "Left" tapped by mistake is visibly
 * still ticked in.
 */
function Guardian({
  name,
  phone,
  arrivedAt,
}: {
  name: string;
  phone: string;
  arrivedAt?: unknown;
}) {
  const theme = useTheme();
  const who = name.trim();
  const number = phone.trim();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.xs }}>
      {!who && !number ? (
        <Micro color={theme.color.inkFaint}>No contact on the registration</Micro>
      ) : (
        <>
          {who ? <Micro color={theme.color.inkSoft}>{who}</Micro> : null}
          {number ? (
            <Pressable
              onPress={() => void Linking.openURL(`tel:${number.replace(/[^\d+]/g, '')}`)}
              accessibilityRole="button"
              accessibilityLabel={`Ring ${who || number}`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 3, minHeight: 28 }}
            >
              <Icon name="phone" size={12} color={theme.color.accent} />
              <Micro color={theme.color.accent}>{number}</Micro>
            </Pressable>
          ) : null}
        </>
      )}
      {arrivedAt ? <Micro color={theme.color.inkFaint}>· in {timeOf(arrivedAt)}</Micro> : null}
    </View>
  );
}

/**
 * The tick itself: a label and the time it happened.
 *
 * Wide and 48pt tall, because it is pressed two hundred times in twenty minutes
 * by somebody holding a phone in one hand and a door in the other. The time on
 * it is what makes a second press safe — you can see what you are taking back.
 */
function Tick({
  label,
  on,
  at,
  onChange,
  who,
}: {
  label: string;
  on: boolean;
  at?: unknown;
  onChange: (on: boolean) => void;
  who: string;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={() => onChange(!on)}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={on ? `${label}, ${timeOf(at)}. Undo for ${who}` : `${label} for ${who}`}
      style={({ pressed }) => ({
        minWidth: 76,
        minHeight: 48,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: on ? theme.color.accent : theme.color.rule,
        borderRadius: theme.radius.sm,
        backgroundColor: on
          ? theme.color.accent
          : pressed
            ? theme.color.accentSoft
            : theme.color.paper,
      })}
    >
      <Small color={on ? theme.color.inkInverse : theme.color.ink}>{label}</Small>
      <Micro color={on ? theme.color.inkInverse : theme.color.inkFaint}>
        {on ? timeOf(at) : '—'}
      </Micro>
    </Pressable>
  );
}

function timeOf(at: unknown): string {
  const when = toDate(at as Parameters<typeof toDate>[0]);
  return when ? when.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '—';
}
