/**
 * "Send to: Summercamp · Day 3" — the pill at the bottom, and the sheet it opens.
 *
 * ## Why this is on screen at all, rather than being a setting
 *
 * Because a photograph filed in the wrong place is not a mistake anybody
 * notices. It uploads, it succeeds, and it sits in an administrator's review
 * queue attached to the wrong ministry — where the only person who knew where
 * it should have gone is the one person no longer looking at it. The pill is
 * small, permanent, and always says the true answer, so the wrong answer is
 * something you can see before the shutter rather than after.
 *
 * ## Why it is a pill and not a row of controls
 *
 * The viewfinder is the content. Every point spent on chrome is a point of the
 * photograph somebody cannot see, and the destination is a thing people read
 * far more often than they change — so it reads as one line and costs a press
 * to edit.
 *
 * ## The sheet is lazy, per ministry
 *
 * `listDestinationPrograms` is one query; the levels inside a ministry are one
 * more, taken when that ministry is opened. A church with a dozen ministries is
 * a dozen queries nobody asked for on a sheet where exactly one row is going to
 * be touched. See `listDestinationsIn`.
 */
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import type { SubmissionTarget } from '@spsm/shared';

import { Close, Sheet } from '@/components/Fields';
import { Icon } from '@/components/Icon';
import { Body, Heading, Label, Micro, Small } from '@/components/Type';
import { useTheme } from '@/theme/ThemeProvider';

import {
  destinationLabel,
  listDestinationPrograms,
  listDestinationsIn,
  sameDestination,
  type Destination,
  type DestinationProgram,
} from './destination';

export function DestinationBar({
  destination,
  fallback,
  ready,
  overridden,
  onChoose,
  onRevert,
}: {
  destination: Destination | null;
  fallback: Destination | null;
  ready: boolean;
  overridden: boolean;
  onChoose: (destination: Destination) => void;
  onRevert: () => void;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  /*
   * Three different sentences for three different truths, and none of them is
   * an error. Not known yet; known to be nothing; known. The middle one is the
   * whole argument of `mainSection.ts`'s header — a stale pointer, a deleted
   * ministry, a closed one and an aeroplane all arrive here identically, and
   * the church's own words are the only honest thing to say about all four.
   */
  const line = !ready
    ? 'Finding out what is happening…'
    : destination
      ? destinationLabel(destination)
      : 'The church is not collecting photographs';

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={
          destination
            ? `Sending to ${destinationLabel(destination)}. Press to change.`
            : 'Choose where to send photographs'
        }
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space.xs,
          alignSelf: 'center',
          maxWidth: '92%',
          paddingVertical: theme.space.xs,
          paddingHorizontal: theme.space.sm,
          borderRadius: theme.radius.full,
          borderWidth: 1,
          borderColor: theme.color.inkInverse,
          /*
           * The scrim behind the words, not a card.
           *
           * `deep` at a low opacity rather than a literal black: the one rule
           * of `theme/tokens.ts` is that this app never writes a colour, and a
           * viewfinder is still not an excuse to start. What it *is* an excuse
           * for is ignoring light and dark — a camera preview is a photograph,
           * so the chrome over it is light-on-dark in either theme.
           */
          backgroundColor: theme.color.deep,
          opacity: pressed ? 0.75 : 0.92,
        })}
      >
        {overridden ? (
          <Icon name="pencil" color={theme.color.inkInverse} size={13} />
        ) : null}
        <Small color={theme.color.inkInverse} numberOfLines={1}>
          {line}
        </Small>
        <Icon name="chevron" color={theme.color.inkInverse} size={14} />
      </Pressable>

      <DestinationSheet
        open={open}
        onClose={() => setOpen(false)}
        current={destination}
        fallback={fallback}
        overridden={overridden}
        onChoose={(next) => {
          onChoose(next);
          setOpen(false);
        }}
        onRevert={() => {
          onRevert();
          setOpen(false);
        }}
      />
    </>
  );
}

function DestinationSheet({
  open,
  onClose,
  current,
  fallback,
  overridden,
  onChoose,
  onRevert,
}: {
  open: boolean;
  onClose: () => void;
  current: Destination | null;
  fallback: Destination | null;
  overridden: boolean;
  onChoose: (destination: Destination) => void;
  onRevert: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} label="Choose where to send photographs">
      {/*
        The contents are mounted with the sheet rather than kept alive behind
        it, which is what makes "reload every time it opens" free: the state
        below *starts* empty and starts expanded on the right ministry, so
        there is nothing to reset and no effect to reset it from.
      */}
      {open ? (
        <SheetBody
          current={current}
          fallback={fallback}
          overridden={overridden}
          onClose={onClose}
          onChoose={onChoose}
          onRevert={onRevert}
        />
      ) : null}
    </Sheet>
  );
}

function SheetBody({
  current,
  fallback,
  overridden,
  onClose,
  onChoose,
  onRevert,
}: {
  current: Destination | null;
  fallback: Destination | null;
  overridden: boolean;
  onClose: () => void;
  onChoose: (destination: Destination) => void;
  onRevert: () => void;
}) {
  const theme = useTheme();
  const [programs, setPrograms] = useState<DestinationProgram[] | null>(null);
  // Open on whatever the camera is pointed at, so the common correction —
  // same ministry, different day — is one press deep rather than two.
  const [expanded, setExpanded] = useState<string | null>(current?.programId ?? null);

  /*
   * Read once per opening.
   *
   * A ministry created during a camp week should appear the next time somebody
   * looks, and this is a handful of documents — caching it across openings
   * would trade a real staleness for an imaginary saving. Not an `onSnapshot`:
   * the sheet is open for seconds at a time.
   */
  useEffect(() => {
    let live = true;
    void listDestinationPrograms().then((rows) => {
      if (live) setPrograms(rows);
    });
    return () => {
      live = false;
    };
  }, []);

  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Heading>Send to</Heading>
          <Small color={theme.color.inkSoft}>
            Photographs are reviewed by the church before anybody else sees them.
          </Small>
        </View>
        <Close onPress={onClose} what="this list" />
      </View>

      {/*
        The way back, and only when there is somewhere to go back to.

        Named rather than labelled "reset", because the sender never chose a
        default and telling them to "reset" is telling them to undo something
        they did not do. What they are going back *to* is the church's own
        current answer — which the listener has kept fresh underneath, so this
        is today's answer and not the one from when the screen opened.
      */}
      {overridden && fallback ? (
        <Pressable
          onPress={onRevert}
          accessibilityRole="button"
          style={({ pressed }) => ({
            padding: theme.space.sm,
            gap: 2,
            borderRadius: theme.radius.md,
            borderWidth: 1,
            borderColor: theme.color.rule,
            backgroundColor: pressed ? theme.color.paperSunken : 'transparent',
          })}
        >
          <Label>The church is collecting for</Label>
          <Body>{destinationLabel(fallback)}</Body>
          <Micro color={theme.color.inkSoft}>Press to use that instead</Micro>
        </Pressable>
      ) : null}

      {programs === null ? (
        <Body color={theme.color.inkSoft}>Reading the ministries…</Body>
      ) : programs.length === 0 ? (
        <Body color={theme.color.inkSoft}>
          No ministry is collecting photographs at the moment.
        </Body>
      ) : (
        programs.map((program) => (
          <ProgramRow
            key={program.id}
            program={program}
            expanded={expanded === program.id}
            current={current}
            onToggle={() => setExpanded(expanded === program.id ? null : program.id)}
            onChoose={onChoose}
          />
        ))
      )}
    </>
  );
}

/** One ministry, and — once opened — everywhere inside it. */
function ProgramRow({
  program,
  expanded,
  current,
  onToggle,
  onChoose,
}: {
  program: DestinationProgram;
  expanded: boolean;
  current: Destination | null;
  onToggle: () => void;
  onChoose: (destination: Destination) => void;
}) {
  const theme = useTheme();
  const [targets, setTargets] = useState<
    { target: SubmissionTarget; destination: Destination }[] | null
  >(null);

  /*
   * Once per ministry, and only once it is opened. `targets !== null` is the
   * guard that makes collapsing and re-opening free rather than another query.
   */
  useEffect(() => {
    if (!expanded || targets !== null) return;
    let live = true;
    void listDestinationsIn(program).then((rows) => {
      if (live) setTargets(rows);
    });
    return () => {
      live = false;
    };
  }, [expanded, targets, program]);

  const holdsCurrent = current?.programId === program.id;

  return (
    <View style={{ gap: theme.space.xs }}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space.xs,
          paddingVertical: theme.space.xs,
          backgroundColor: pressed ? theme.color.paperSunken : 'transparent',
          borderRadius: theme.radius.sm,
        })}
      >
        <Icon
          name="chevron"
          color={holdsCurrent ? theme.color.accent : theme.color.inkFaint}
          size={16}
        />
        <Label color={holdsCurrent ? theme.color.accent : undefined}>{program.name}</Label>
      </Pressable>

      {expanded ? (
        targets === null ? (
          <View style={{ paddingLeft: theme.space.md }}>
            <Small color={theme.color.inkSoft}>Reading the levels…</Small>
          </View>
        ) : (
          targets.map(({ target, destination }) => (
            <TargetRow
              key={target.id}
              target={target}
              chosen={sameDestination(current, destination)}
              onPress={() => onChoose(destination)}
            />
          ))
        )
      ) : null}
    </View>
  );
}

/**
 * One level, indented by its depth.
 *
 * The ministry's own row comes back from `submissionTargets` at depth 0 and is
 * a real destination — filing on the ministry rather than on a level is a
 * documented state, and it is what a ministry with no levels yet offers. It is
 * labelled here rather than left to look like a duplicate of the heading above
 * it, because "Summercamp" appearing twice in a row with no explanation is
 * exactly the thing that makes somebody press the wrong one.
 */
function TargetRow({
  target,
  chosen,
  onPress,
}: {
  target: SubmissionTarget;
  chosen: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: chosen }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.xs,
        minHeight: 44,
        paddingVertical: theme.space.xs,
        paddingRight: theme.space.xs,
        // One step of indent per level of the tree, from the depth the shared
        // flattener already worked out. `+1` so nothing sits under the
        // ministry's own pressable above.
        paddingLeft: theme.space.md + target.depth * theme.space.md,
        borderRadius: theme.radius.sm,
        backgroundColor: pressed ? theme.color.paperSunken : 'transparent',
      })}
    >
      <View style={{ width: 18 }}>
        {chosen ? <Icon name="check" color={theme.color.accent} size={18} /> : null}
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <Body color={chosen ? theme.color.accent : undefined}>
          {target.title === '' ? 'Untitled' : target.title}
        </Body>
        {target.isProgram ? (
          <Micro color={theme.color.inkSoft}>The ministry itself, not a level inside it</Micro>
        ) : null}
      </View>
    </Pressable>
  );
}
