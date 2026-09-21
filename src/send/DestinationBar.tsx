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
import { Heading, Label, Micro, Small } from '@/components/Type';
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
    <Sheet
      open={open}
      onClose={onClose}
      label="Choose where to send photographs"
      header={<Head onClose={onClose} />}
    >
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
          onChoose={onChoose}
          onRevert={onRevert}
        />
      ) : null}
    </Sheet>
  );
}

/** Pinned above the scroller, so the way out does not scroll off a long list. */
function Head({ onClose }: { onClose: () => void }) {
  const theme = useTheme();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Heading>Send to</Heading>
        <Small color={theme.color.inkSoft}>
          Photographs are reviewed by the church before anybody else sees them.
        </Small>
      </View>
      <Close onPress={onClose} what="this list" />
    </View>
  );
}

function SheetBody({
  current,
  fallback,
  overridden,
  onChoose,
  onRevert,
}: {
  current: Destination | null;
  fallback: Destination | null;
  overridden: boolean;
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
          accessibilityLabel={
            `Go back to ${destinationLabel(fallback)}, ` +
            'which is what the church is collecting for'
          }
          /*
            Tinted rather than outlined. This is an offer and not a field, and
            an outlined box directly above an outlined list of ministries read
            as the first row of that list — which is the one thing it must not
            be, because pressing it files somewhere else entirely. A soft wash
            of the accent and the arrow beside it say "back to" at a glance.
          */
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.space.sm,
            padding: theme.space.sm,
            borderRadius: theme.radius.md,
            backgroundColor: pressed ? theme.color.accentSoft : theme.color.paperSunken,
          })}
        >
          <Icon name="back" color={theme.color.accent} size={18} />
          <View style={{ flex: 1, gap: 2 }}>
            <Label color={theme.color.accent}>The church is collecting for</Label>
            <Small numberOfLines={2}>{destinationLabel(fallback)}</Small>
            <Micro color={theme.color.inkSoft}>Press to use that instead</Micro>
          </View>
        </Pressable>
      ) : null}

      {programs === null ? (
        <Small color={theme.color.inkSoft}>Reading the ministries…</Small>
      ) : programs.length === 0 ? (
        <Small color={theme.color.inkSoft}>
          No ministry is collecting photographs at the moment.
        </Small>
      ) : (
        /*
          One card holding every ministry, rather than a dozen loose rows.
          ----------------------------------------------------------------------
          The rows used to sit directly in the scroller, which put the sheet's
          own `space.md` between each of them: a column of unattached lines with
          more gap than line, and nothing to say where one ministry's levels
          ended and the next ministry began. Grouping them is what the rest of
          the app does with a list of choices, and it is what makes an indent
          mean "inside this" rather than "further right".

          `overflow: hidden` so the pressed wash and the open ministry's own
          shading stop at the rounded corners instead of squaring them off.
        */
        <View
          style={{
            borderRadius: theme.radius.md,
            borderWidth: 1,
            borderColor: theme.color.rule,
            overflow: 'hidden',
          }}
        >
          {programs.map((program, index) => (
            <ProgramRow
              key={program.id}
              program={program}
              expanded={expanded === program.id}
              current={current}
              last={index === programs.length - 1}
              onToggle={() => setExpanded(expanded === program.id ? null : program.id)}
              onChoose={onChoose}
            />
          ))}
        </View>
      )}
    </>
  );
}

/**
 * One ministry: a row that opens, and everywhere inside it once it has.
 *
 * ## What the row says when it is shut
 *
 * Which ministry it is, and — if the camera is pointed at something inside it —
 * where exactly. That second line is the reason this is not just a heading: the
 * common question at the pill is "am I still sending to the right day?", and
 * before it existed the only way to answer it was to open the ministry and read
 * down the list for the tick. A ministry that holds nothing current says
 * nothing extra, so the line never becomes furniture.
 *
 * ## The chevron turns
 *
 * It did not, and a chevron that points the same way open and shut is a chevron
 * that has stopped meaning anything. Half a turn, which is `DrawerContent`'s
 * own disclosure and therefore the app's: one drawing, and the rotation is what
 * says the row is a disclosure rather than a link to somewhere else.
 */
function ProgramRow({
  program,
  expanded,
  current,
  last,
  onToggle,
  onChoose,
}: {
  program: DestinationProgram;
  expanded: boolean;
  current: Destination | null;
  /** The last ministry in the card, which keeps no rule under it. */
  last: boolean;
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
    <View>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={
          holdsCurrent && current
            ? `${program.name}, sending to ${current.nodeTitle ?? 'the ministry itself'}`
            : program.name
        }
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space.sm,
          paddingHorizontal: theme.space.sm,
          paddingVertical: theme.space.xs,
          // The same 46 the drawer's own disclosure row is. A list somebody
          // scans with a thumb while holding a camera is not the place to go
          // under it.
          minHeight: 46,
          /*
           * Shaded while it is open, so the levels below plainly belong to it.
           * This is the only thing tying a six-deep indent back to its parent
           * once the parent has scrolled to the top of the sheet.
           */
          backgroundColor: pressed
            ? theme.color.paperSunken
            : expanded
              ? theme.color.paperSunken
              : 'transparent',
          // Dropped under the last shut ministry, because the card's own border
          // is already there and two lines a point apart is a thick line.
          borderBottomWidth: last && !expanded ? 0 : 1,
          borderBottomColor: theme.color.rule,
        })}
      >
        <View style={{ flex: 1, gap: 1 }}>
          {/*
            The UI face and sentence case, where this was an uppercase `Label`.
            Uppercase micro is the app's *eyebrow* — the thing written above a
            card to say what kind of card it is — and eleven of them stacked
            read as eleven headings with no content rather than as the list of
            choices they are.
          */}
          <Small numberOfLines={1}>{program.name}</Small>
          {holdsCurrent && current ? (
            <Micro color={theme.color.accent} numberOfLines={1}>
              Sending to {current.nodeTitle ?? 'the ministry itself'}
            </Micro>
          ) : null}
        </View>

        {/* The tick that is on the chosen row inside, repeated on the closed
            ministry that holds it. Hidden from assistive technology because the
            row's own label says the same thing in words. */}
        {holdsCurrent ? (
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Icon name="check" color={theme.color.accent} size={16} />
          </View>
        ) : null}

        <View style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}>
          <Icon name="chevron" color={theme.color.inkFaint} size={18} />
        </View>
      </Pressable>

      {expanded ? (
        <View
          style={{
            paddingVertical: theme.space.xs,
            borderBottomWidth: last ? 0 : 1,
            borderBottomColor: theme.color.rule,
          }}
        >
          {/*
            A rule down the left of the levels, and the levels themselves on
            plain paper.
            ------------------------------------------------------------------
            The whole open block was shaded at first, which grouped it but made
            a ministry with six years in it a slab of tint halfway down the
            sheet — and left the chosen row, which is a *wash* of the accent,
            competing with the shading instead of standing out of it. A single
            line does the same job: everything to the right of it is inside the
            ministry above, and the only filled thing in the card is the row
            you have picked.
          */}
          <View
            style={{
              marginLeft: theme.space.sm,
              borderLeftWidth: 2,
              borderLeftColor: theme.color.rule,
            }}
          >
            {targets === null ? (
              <View style={{ paddingHorizontal: theme.space.md, paddingVertical: theme.space.xs }}>
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
            )}
          </View>
        </View>
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
 * marked here rather than left to look like a duplicate of the row above it,
 * because "Summercamp" appearing twice with no explanation is exactly the thing
 * that makes somebody press the wrong one. The mark is two words at the end of
 * the line and not the sentence it used to be: "The ministry itself, not a
 * level inside it", set under every such row, was longer than the rows it was
 * explaining and made the top of every ministry look like a warning.
 *
 * ## The chosen row is filled, not coloured
 *
 * It was the title in the accent with a tick beside it, which on a sheet where
 * the ministry's name is *also* in the accent left two red things and no way to
 * tell which one you had picked. A washed bar reads as a selection at arm's
 * length, which is the distance this is used from.
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
      accessibilityLabel={
        target.isProgram
          ? `${target.title === '' ? 'Untitled' : target.title}, ` +
            'the ministry itself rather than a level inside it'
          : target.title === ''
            ? 'Untitled'
            : target.title
      }
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.xs,
        minHeight: 44,
        paddingVertical: theme.space.xs,
        paddingRight: theme.space.sm,
        // One step of indent per level of the tree, from the depth the shared
        // flattener already worked out. `+1` so nothing sits under the
        // ministry's own pressable above.
        paddingLeft: theme.space.sm + target.depth * theme.space.md,
        backgroundColor: chosen
          ? theme.color.accentSoft
          : pressed
            ? theme.color.paperSunken
            : 'transparent',
      })}
    >
      {/* Held open whether or not there is a tick in it, so the titles line up
          down the column instead of shifting a glyph's width when one is
          chosen. */}
      <View style={{ width: 20, alignItems: 'center' }}>
        {chosen ? <Icon name="check" color={theme.color.accent} size={18} /> : null}
      </View>

      <View style={{ flex: 1 }}>
        <Small color={chosen ? theme.color.accent : undefined} numberOfLines={2}>
          {target.title === '' ? 'Untitled' : target.title}
        </Small>
      </View>

      {/* At the end of the line rather than under it, and lowercase, so it
          reads as a note on the row instead of a second row. */}
      {target.isProgram ? (
        <Micro color={theme.color.inkFaint} numberOfLines={1}>
          whole ministry
        </Micro>
      ) : null}
    </Pressable>
  );
}
