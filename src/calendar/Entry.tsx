/**
 * One thing on one day.
 *
 * The website's `features/calendar/Entry.tsx`, in React Native, and the layout
 * decision it records is the one worth preserving: **the trailing detail is
 * flat, and the end time is not.**
 *
 * Location and note run on after the title, dimmed, costing nothing when they
 * are absent — three separate lines made a Saturday with five services 320
 * pixels tall inside a wheel that has to be as tall as the busiest day in the
 * week, and everything scrolled. The end time was flattened along with them and
 * should not have been: "8 AM" alone answers when to arrive and silently drops
 * how long the thing runs, which is the question somebody planning a Saturday
 * is actually asking. So it sits under the start, small, costing one short line
 * on the entries that have one and nothing at all on the rest.
 *
 * ---------------------------------------------------------------------------
 * A row on its own ground, and the colour carried in two places.
 *
 * This used to be text on the page with a 3pt rule down its left edge, and the
 * note above that rule argued a wash "puts a tint behind every line of text on
 * the screen". The rule is still here and that argument still holds for the
 * *body*. What changed is the ground underneath: six services on bare paper is
 * six blocks of text separated by four points of air, and the eye has to do the
 * grouping that a container would have done for it. Each entry now sits on
 * `paperRaised` with the church's card radius, so a day reads as a stack of
 * things rather than as a paragraph — and the paper the app is built on is a
 * pale red, so a raised row is a lift rather than a box drawn round the text.
 *
 * The colour then has two jobs and two strengths. The bar down the edge is the
 * hue at full strength, which is what makes a week scannable by kind from
 * across the row. The time chip is the same kind at `washFor` strength, which
 * is the only tint in the system pale enough to put words on — see the note
 * there. The clock itself is `ink` rather than the kind's colour, which is a
 * legibility fix and not a retreat: gold on cream measured about 2.9:1, so the
 * one piece of text every reader is actually hunting for was the least legible
 * thing in the row.
 * ---------------------------------------------------------------------------
 *
 * ## The whole row is the control here, and on the website only the title is
 *
 * That is not drift. A row can contain a telephone number, and on the web a
 * link inside a button is invalid HTML that browsers unnest — so the row could
 * not be the control. React Native has no such rule: a nested `Pressable`
 * simply wins the touch it is under, so the contact stays dialable inside a row
 * that is itself pressable. On a phone the larger target is worth having.
 */
import { Image } from 'expo-image';
import { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { formatClock, kindOf, type CalendarOccurrence } from '@spsm/shared';

import { Body, Micro, Small } from '@/components/Type';
import { useTheme } from '@/theme/ThemeProvider';

import { tintFor, washFor } from './kinds';

/** The time column. Wide enough for "11:30 AM" and not a character wider. */
const WHEN_WIDTH = 76;

/** The bar down the left edge, at the width a dashed one still reads as dashed. */
const BAR = 4;

export function Entry({
  occurrence,
  onOpen,
}: {
  occurrence: CalendarOccurrence;
  onOpen: () => void;
}) {
  const theme = useTheme();
  // Through `kindOf`, never off `.kind` directly — it is null for everything
  // read from Breeze or the bulletin, where the title is all there is.
  const kind = kindOf(occurrence);
  const tint = tintFor(kind, theme);
  const wash = washFor(kind, theme);
  const servants = occurrence.source === 'servants';

  /*
   * Location and note, in that order, on the end of the title's line. The
   * contact keeps its own element so the number stays dialable; the rest is
   * plain text.
   */
  const aside = [occurrence.location, occurrence.description].filter((part) => part !== '');

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`${occurrence.title}, ${whenLabel(occurrence)}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        borderRadius: theme.radius.md,
        // Clips the bar to the corner radius, so the colour ends where the card
        // does instead of squaring off its top-left.
        overflow: 'hidden',
        // Held, the row takes its own kind's tint rather than the accent's — a
        // gathering confirming itself in red said "liturgy" for as long as the
        // thumb was down. The website does the same on hover.
        backgroundColor: pressed ? wash : theme.color.paperRaised,
      })}
    >
      {/*
        Colour by kind, at full strength, on the edge rather than behind the
        words. Dashed for a servants entry — a marking on top of a kind rather
        than a kind of its own, so a servants-only liturgy is still red.

        A border rather than a background, for the one reason that matters: a
        filled view cannot be dashed, and the dash is what carries "servants".
      */}
      <View
        style={{
          width: 0,
          alignSelf: 'stretch',
          borderLeftWidth: BAR,
          borderLeftColor: tint,
          borderStyle: servants ? 'dashed' : 'solid',
        }}
      />

      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          gap: theme.space.sm,
          padding: theme.space.sm,
        }}
      >
        <View style={{ width: WHEN_WIDTH, gap: 2 }}>
          <When occurrence={occurrence} wash={wash} />

          {/*
            Only when there is an end, and only when it says something the
            start did not. Breeze hands back a zero-length entry as an end
            equal to its start, and "8 AM / until 8 AM" reads as a mistake in
            the data rather than as an event with no stated finish.

            "to" rather than "until", which is what the row said before: at this
            width the longer word wraps a two-word line, and the sentence a
            screen reader is read is built by `whenLabel` and still says until.
          */}
          {!occurrence.allDay &&
          occurrence.endTime &&
          occurrence.endTime !== occurrence.startTime ? (
            <Micro color={theme.color.inkFaint} align="center">
              to {formatClock(occurrence.endTime)}
            </Micro>
          ) : null}
        </View>

        <View style={{ flex: 1, gap: 2 }}>
          <Body>{occurrence.title}</Body>

          {/*
            Both marks on one line, and only ever one of them in practice — an
            entry comes from one source. The row is here so that if that ever
            stops being true they sit beside each other rather than stacking.
          */}
          {servants || occurrence.source === 'manual' ? (
            <View style={{ flexDirection: 'row', gap: theme.space.xs }}>
              {servants ? <Tag label="Servants" tone={theme.color.accent} /> : null}
              {occurrence.source === 'manual' ? (
                <Tag label="Added" tone={theme.color.inkFaint} />
              ) : null}
            </View>
          ) : null}

          {aside.length > 0 ? (
            <Small color={theme.color.inkSoft}>{aside.join(' · ')}</Small>
          ) : null}
          {occurrence.contact ? <Contact contact={occurrence.contact} /> : null}
        </View>

        {occurrence.imageUrl ? <Thumb url={occurrence.imageUrl} /> : null}
      </View>
    </Pressable>
  );
}

/**
 * The start time, on the kind's own tint.
 *
 * Split at the space so the meridiem can be set small: "5:00" is the number
 * somebody is reading off the row and "PM" is a qualifier on it, and at one
 * size they compete for the same glance. `formatClock` always emits the pair
 * with a single space between them, so the split is total — but the fallback
 * prints whatever came back rather than dropping it, because a chip with half a
 * time in it would be worse than an ugly one.
 */
function When({ occurrence, wash }: { occurrence: CalendarOccurrence; wash: string }) {
  const theme = useTheme();

  const chip = {
    backgroundColor: wash,
    borderRadius: theme.radius.sm,
    paddingVertical: theme.space.xs,
    paddingHorizontal: theme.space.xs,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexDirection: 'row' as const,
    gap: 2,
    minHeight: 34,
  };

  if (occurrence.allDay) {
    return (
      <View style={chip}>
        <Micro color={theme.color.inkSoft}>All day</Micro>
      </View>
    );
  }

  const [clock, meridiem] = formatClock(occurrence.startTime).split(' ');

  return (
    <View style={chip}>
      <Small>{clock}</Small>
      {meridiem ? <Micro color={theme.color.inkSoft}>{meridiem}</Micro> : null}
    </View>
  );
}

/** What a screen reader hears before the title, so the row reads as a plan. */
function whenLabel(occurrence: CalendarOccurrence): string {
  if (occurrence.allDay) return 'all day';
  const start = formatClock(occurrence.startTime);
  const end =
    occurrence.endTime && occurrence.endTime !== occurrence.startTime
      ? ` until ${formatClock(occurrence.endTime)}`
      : '';
  return `${start}${end}`;
}

/**
 * "Servants", "Added".
 *
 * Filled at the tone's own soft strength rather than outlined in it. A dashed
 * outline is how this app says *servants only*, on the bar down the edge of
 * this very row — spending it again on a pill six points away said the two
 * marks were related, and they are not: one is a kind of entry and the other is
 * a note about where the row came from.
 */
function Tag({ label, tone }: { label: string; tone: string }) {
  const theme = useTheme();

  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor:
          tone === theme.color.accent ? theme.color.accentSoft : theme.color.paperSunken,
        borderRadius: theme.radius.full,
        paddingHorizontal: theme.space.sm,
        paddingVertical: 1,
      }}
    >
      <Micro color={tone}>{label}</Micro>
    </View>
  );
}

/**
 * "Servant Michael · (508) 555-0142", with the number dialable.
 *
 * The bulletin is the only source that carries one, and it is the most useful
 * thing on the sheet: the point of putting a contact on an event is that
 * somebody can reach them — and this is the surface where that is one tap.
 */
function Contact({ contact }: { contact: string }) {
  const theme = useTheme();
  const [name, phone] = contact.split(' · ');

  if (!phone) return <Small color={theme.color.inkSoft}>{contact}</Small>;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.xs }}>
      <Small color={theme.color.inkSoft}>{name} ·</Small>
      <Pressable
        // Stripped to digits for the dialler, printed as the church wrote it.
        onPress={() => void Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`)}
        accessibilityRole="button"
        accessibilityLabel={`Call ${name ?? ''} on ${phone}`}
        hitSlop={theme.space.xs}
      >
        <Small color={theme.color.accent}>{phone}</Small>
      </Pressable>
    </View>
  );
}

/**
 * The bulletin's photograph, or nothing at all if it will not load.
 *
 * These are hotlinks into the announcements project's storage bucket — the
 * bulletin is read through and never mirrored, and that applies to its images
 * too. The other project can delete one at any time, and a broken frame with a
 * border on it is an empty grey box that reads as the app having failed rather
 * than as an event with no picture.
 */
function Thumb({ url }: { url: string }) {
  const theme = useTheme();
  const [broken, setBroken] = useState(false);
  if (broken) return null;

  return (
    <Image
      source={{ uri: url }}
      // Decoration: the event's name is beside it, and describing the
      // photograph would have a screen reader read the entry twice.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onError={() => setBroken(true)}
      contentFit="cover"
      style={{
        width: 44,
        height: 44,
        borderRadius: theme.radius.sm,
        backgroundColor: theme.color.paperSunken,
      }}
    />
  );
}
