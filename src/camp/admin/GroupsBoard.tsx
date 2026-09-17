/**
 * `/admin/camp/groups` — the arrangement, as it was arranged. Read only.
 *
 * ---------------------------------------------------------------------------
 * ## Why this reads and does not write
 *
 * The website's groups screen is four and a half thousand lines of drag and
 * drop: nine grade panels, colour swatches, a pool of unplaced children, merge
 * grips, a dealer that fills a band in one press, and a conflict check for the
 * two people arranging it at the same table the week before camp. None of that
 * is work for a phone, and a phone-sized version of it would be a worse version
 * of the one thing that screen has to get right — a child is in exactly one
 * place, and a mis-drop puts them in somebody else's crew.
 *
 * What a phone is *for* is the other half of the same subject, and it is the
 * half the website is bad at: **standing in the hall on the Monday morning
 * asking which crew this child is in, and who is leading it.** That question is
 * asked twenty times an hour by people who are not near a laptop, and it is
 * answered by reading. So this screen reads.
 *
 * The arrangement is live — `subscribeAllocation`, not a one-shot read — so a
 * child moved on the laptop in the office changes the heading they are listed
 * under here within a second. That is the whole reason this is worth having
 * beside the register: the two screens agree, all day, without anybody
 * refreshing anything.
 *
 * ## What is drawn, and in what order
 *
 * Bands in the order the board holds them, their groups in panel order, each
 * group's servants first with the leader marked and then its children. Same
 * order, same names, same colours as the website draws — a servant who has seen
 * the board on a laptop is reading the same thing here.
 *
 * Stations come last, because they are *who runs sports and who is in the
 * kitchen* rather than where a child is, and the question this screen exists
 * for is about a child.
 *
 * Anybody the board has not placed is named at the end rather than hidden. On
 * the first morning of camp that is the whole camp, which is exactly the right
 * way for an unarranged season to look.
 * ---------------------------------------------------------------------------
 */
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import {
  arrangedWeeks,
  campColourOf,
  campComesInWeek,
  campGradeLabel,
  campGradeShort,
  campPeople,
  campWeekRangeLabel,
  resolveAllocation,
  weekBoardOf,
  type CampAllocationDraft,
  type CampBand,
  type CampGroup,
  type CampPerson,
  type CampPersonKey,
  type CampRegistration,
  type CampStation,
  type ResolvedAllocation,
} from '@spsm/shared';

import { Card } from '@/components/Surface';
import { Body, Label, Micro, Small, Subheading } from '@/components/Type';
import { useTheme } from '@/theme/ThemeProvider';

import { CampLoading, CampProblem, CampShell } from './CampShell';
import {
  subscribeAllocation,
  subscribeRegistrations,
  type WithId,
} from './data';
import { useCampAdmin } from './session';

export function GroupsBoard() {
  const theme = useTheme();
  const session = useCampAdmin();
  const { ready, canEdit, config } = session;
  const { programId, season, weekStarts } = config;

  const [registrations, setRegistrations] = useState<WithId<CampRegistration>[] | null>(null);
  const [allocation, setAllocation] = useState<CampAllocationDraft | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [picked, setPicked] = useState<number | null>(null);

  useEffect(() => {
    if (!ready || !canEdit) return;
    return subscribeRegistrations(programId, season, setRegistrations, (cause) =>
      setProblem(cause.message),
    );
  }, [ready, canEdit, programId, season]);

  useEffect(() => {
    if (!ready || !canEdit) return;
    return subscribeAllocation(programId, season, setAllocation, (cause) =>
      setProblem(cause.message),
    );
  }, [ready, canEdit, programId, season]);

  const weeks = useMemo(
    () => (allocation ? arrangedWeeks(allocation) : []),
    [allocation],
  );

  /*
   * The week: the first one with something in it, until somebody picks another.
   *
   * Derived rather than stored. A camp that arranged only week two has to open
   * on week two — not on an empty week one with a switch nobody would think to
   * press — and the arrangement arrives a moment after the screen does, so a
   * `week` held in state would be 1 and would stay there. Falling back through
   * `weeks.includes` also covers the case where the week somebody chose stops
   * being arranged under them, which is a console edit rather than an ordinary
   * Tuesday but costs one comparison to survive.
   */
  const week = picked !== null && weeks.includes(picked) ? picked : (weeks[0] ?? 1);

  const people = useMemo(() => campPeople(registrations ?? []), [registrations]);
  const board = useMemo(
    () => (allocation ? weekBoardOf(allocation, week) : null),
    [allocation, week],
  );
  const resolved = useMemo(
    () => (allocation ? resolveAllocation(allocation, week, people) : null),
    [allocation, week, people],
  );

  if (!ready || !canEdit) {
    return (
      <CampShell session={session} tab="groups">
        {problem ? <CampProblem error={problem} /> : null}
      </CampShell>
    );
  }

  if (registrations === null || allocation === null || board === null || resolved === null) {
    return (
      <CampShell session={session} tab="groups">
        {problem ? <CampProblem error={problem} /> : <CampLoading what="the groups" />}
      </CampShell>
    );
  }

  const nothingArranged = board.bands.length === 0 && board.stations.length === 0;

  return (
    <CampShell session={session} tab="groups">
      {problem ? <CampProblem error={problem} /> : null}

      {/* Only when there is a choice to make. One arranged week and the switch
          is a control with one option, which is a label pretending to be a
          control. */}
      {weeks.length > 1 ? (
        <WeekSwitch
          weeks={weeks}
          week={week}
          weekStarts={weekStarts}
          onPick={setPicked}
        />
      ) : null}

      {nothingArranged ? (
        <Card gap={theme.space.xs}>
          <Label>NOTHING ARRANGED YET</Label>
          <Body color={theme.color.inkSoft}>
            {weeks.length === 0
              ? `Nobody has been put into a group for ${season || 'this season'}. The board is arranged at /admin/camp/groups on the church website.`
              : `Week ${week} has not been arranged. Another week has been — try the switch above.`}
          </Body>
        </Card>
      ) : (
        <>
          {board.bands.map((band) => (
            <Band key={band.id} band={band} week={week} resolved={resolved} />
          ))}

          {board.stations.length > 0 ? (
            <>
              <Label>ACTIVITIES</Label>
              {board.stations.map((station) => (
                <Station key={station.id} station={station} resolved={resolved} />
              ))}
            </>
          ) : null}

          <Unplaced resolved={resolved} week={week} />
        </>
      )}

      <Card gap={theme.space.xs}>
        <Label>ARRANGED ON THE WEBSITE</Label>
        <Body color={theme.color.inkSoft}>
          This is the arrangement as it stands, and it updates as somebody changes it.
          Moving a child between crews, naming a leader and renaming a group are all done
          at /admin/camp/groups on the church website — a board of two hundred children is
          not something to drag around on a phone.
        </Body>
      </Card>
    </CampShell>
  );
}

/* ---------------------------------------------------------------------------
 * The week
 * ------------------------------------------------------------------------ */

function WeekSwitch({
  weeks,
  week,
  weekStarts,
  onPick,
}: {
  weeks: readonly number[];
  week: number;
  weekStarts: readonly string[];
  onPick: (week: number) => void;
}) {
  const theme = useTheme();

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel="Which week"
      style={{
        flexDirection: 'row',
        backgroundColor: theme.color.paperSunken,
        borderRadius: theme.radius.full,
        padding: 2,
      }}
    >
      {weeks.map((entry) => {
        const on = entry === week;
        const range = campWeekRangeLabel(weekStarts, entry);

        return (
          <Pressable
            key={entry}
            onPress={() => onPick(entry)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: 44,
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
            <Small color={on ? theme.color.inkInverse : theme.color.ink}>Week {entry}</Small>
            {range === `Week ${entry}` ? null : (
              <Micro color={on ? theme.color.inkInverse : theme.color.inkFaint}>{range}</Micro>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

/* ---------------------------------------------------------------------------
 * A band, its crews, its stations
 * ------------------------------------------------------------------------ */

function Band({
  band,
  week,
  resolved,
}: {
  band: CampBand;
  week: number;
  resolved: ResolvedAllocation;
}) {
  const theme = useTheme();
  const colour = campColourOf(band.colour);

  /* Worth printing a child's own grade on their line only when the band covers
     more than one. On a single-grade card it is the card's own heading, once
     per child. */
  const manyGrades = band.grades.length > 1;

  return (
    <Card gap={theme.space.sm}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
        {/* The band's colour, which is the thing a parent is told at the gate —
            so it is drawn rather than named. `campColourOf` and not
            `campColour`, because a band with no colour yet is a state and the
            grey it draws in must not be mistaken for red. */}
        <View
          style={{
            width: 14,
            height: 14,
            borderRadius: Math.min(theme.radius.full, 7),
            backgroundColor: colour.hex,
            borderWidth: 1,
            borderColor: theme.color.rule,
          }}
        />
        <Subheading>{band.name || 'Unnamed'}</Subheading>
        <View style={{ flex: 1 }} />
        <Micro color={theme.color.inkFaint}>{colour.label}</Micro>
      </View>

      {band.grades.length > 0 ? (
        <Micro color={theme.color.inkSoft}>
          {band.grades.map((grade) => campGradeLabel(grade)).join(' · ')}
        </Micro>
      ) : null}

      {band.note ? <Micro color={theme.color.inkFaint}>{band.note}</Micro> : null}

      {band.groups.length === 0 ? (
        <Micro color={theme.color.inkFaint}>No crews in this band yet.</Micro>
      ) : (
        band.groups.map((group) => (
          <Group
            key={group.id}
            group={group}
            week={week}
            resolved={resolved}
            manyGrades={manyGrades}
          />
        ))
      )}
    </Card>
  );
}

function Group({
  group,
  week,
  resolved,
  manyGrades,
}: {
  group: CampGroup;
  week: number;
  resolved: ResolvedAllocation;
  manyGrades: boolean;
}) {
  const theme = useTheme();

  const children = peopleOf(group.childKeys, resolved);
  const servants = peopleOf(group.servantKeys, resolved);

  /*
   * How many of this crew's children are actually coming this week.
   *
   * A crew of nine where four are only down for the other week is a crew of
   * five on the Monday, and a servant reading "9" at the door counts heads
   * twice trying to work out who is missing. `campComesInWeek` is the same
   * question the website's meters ask.
   */
  const coming = children.filter((person) => campComesInWeek(person, week)).length;

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: theme.color.rule,
        borderRadius: theme.radius.sm,
        backgroundColor: theme.color.paper,
        padding: theme.space.sm,
        gap: theme.space.xs,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: theme.space.sm }}>
        <Small>{group.name || 'Unnamed crew'}</Small>
        <View style={{ flex: 1 }} />
        <Micro color={theme.color.inkFaint}>
          {coming === children.length
            ? `${children.length} ${children.length === 1 ? 'child' : 'children'}`
            : `${coming} of ${children.length} this week`}
          {servants.length > 0 ? ` · ${servants.length} serving` : ''}
        </Micro>
      </View>

      {servants.length > 0 ? (
        <View style={{ gap: 1 }}>
          {servants.map((person) => (
            <Micro
              key={person.key}
              color={person.key === group.leaderKey ? theme.color.accentStrong : theme.color.inkSoft}
            >
              {/* The leader marked in the line rather than sorted to the top:
                  the board holds the servants in the order somebody put them
                  in, and reordering them here would disagree with the laptop. */}
              {person.key === group.leaderKey ? `${person.name} — leading` : person.name}
            </Micro>
          ))}
        </View>
      ) : (
        <Micro color={theme.color.inkFaint}>Nobody serving this crew yet.</Micro>
      )}

      {children.length === 0 ? (
        <Micro color={theme.color.inkFaint}>No children in it yet.</Micro>
      ) : (
        <View style={{ gap: 1 }}>
          {children.map((person) => (
            <Micro
              key={person.key}
              color={person.withdrawn ? theme.color.inkFaint : theme.color.ink}
            >
              {person.name}
              {manyGrades && person.grade ? ` · ${campGradeShort(person.grade)}` : ''}
              {/* Placed and withdrawn is a state to show, not to resolve
                  quietly: it is a place somebody still has to deal with. */}
              {person.withdrawn ? ' · withdrawn' : ''}
              {!campComesInWeek(person, week) ? ' · not this week' : ''}
            </Micro>
          ))}
        </View>
      )}

      {group.note ? <Micro color={theme.color.inkFaint}>{group.note}</Micro> : null}
    </View>
  );
}

function Station({
  station,
  resolved,
}: {
  station: CampStation;
  resolved: ResolvedAllocation;
}) {
  const theme = useTheme();
  const colour = campColourOf(station.colour);
  const servants = peopleOf(station.servantKeys, resolved);

  return (
    <Card gap={theme.space.xs}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
        <View
          style={{
            width: 10,
            height: 10,
            borderRadius: Math.min(theme.radius.full, 5),
            backgroundColor: colour.hex,
          }}
        />
        <Small>{station.name || 'Unnamed activity'}</Small>
        <View style={{ flex: 1 }} />
        {station.location ? (
          <Micro color={theme.color.inkFaint}>{station.location}</Micro>
        ) : null}
      </View>

      {servants.length === 0 ? (
        <Micro color={theme.color.inkFaint}>Nobody on it yet.</Micro>
      ) : (
        <View style={{ gap: 1 }}>
          {servants.map((person) => (
            <Micro
              key={person.key}
              color={
                person.key === station.leaderKey ? theme.color.accentStrong : theme.color.inkSoft
              }
            >
              {person.key === station.leaderKey ? `${person.name} — running it` : person.name}
            </Micro>
          ))}
        </View>
      )}
    </Card>
  );
}

/**
 * Everybody the board has not placed, named rather than hidden.
 *
 * Shut by default and opened by a press, because on the first morning of camp
 * this is the whole camp and an open list of two hundred names above the
 * arrangement is not what anybody came for. Withdrawn children are dropped —
 * an unplaced child who is not coming is not an arrangement anybody has to
 * finish.
 */
function Unplaced({ resolved, week }: { resolved: ResolvedAllocation; week: number }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  const children = resolved.freeChildren.filter(
    (person) => !person.withdrawn && campComesInWeek(person, week),
  );
  const servants = resolved.freeServants.filter(
    (person) => !person.withdrawn && campComesInWeek(person, week),
  );

  if (children.length === 0 && servants.length === 0) return null;

  return (
    <Card gap={theme.space.xs}>
      <Pressable
        onPress={() => setOpen(!open)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={{ minHeight: 44, justifyContent: 'center' }}
      >
        <Label>NOT IN A GROUP YET</Label>
        <Small color={theme.color.inkSoft}>
          {children.length} {children.length === 1 ? 'child' : 'children'}
          {servants.length > 0
            ? `, ${servants.length} ${servants.length === 1 ? 'servant' : 'servants'}`
            : ''}
          {open ? '' : ' — tap to read'}
        </Small>
      </Pressable>

      {open ? (
        <View style={{ gap: 1 }}>
          {children.map((person) => (
            <Micro key={person.key} color={theme.color.ink}>
              {person.name}
              {person.grade ? ` · ${campGradeShort(person.grade)}` : ''}
            </Micro>
          ))}
          {servants.map((person) => (
            <Micro key={person.key} color={theme.color.inkSoft}>
              {person.name} · serving
            </Micro>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

/**
 * Placed keys as people, in the order the board holds them.
 *
 * A key matching nobody is dropped. It is a registration deleted after its
 * children were allocated, which `resolveAllocation` reports as dangling and
 * the website offers to clear — telling somebody about it here would be raising
 * a data problem on a screen whose whole job is to answer "which crew".
 */
function peopleOf(
  keys: readonly CampPersonKey[],
  resolved: ResolvedAllocation,
): CampPerson[] {
  const out: CampPerson[] = [];
  for (const key of keys) {
    const person = resolved.byKey.get(key);
    if (person) out.push(person);
  }
  return out;
}
