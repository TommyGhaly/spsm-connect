/**
 * One day's schedule, under the wheel that picked it.
 *
 * ---------------------------------------------------------------------------
 * A region of its own, and the second half of why the wheel is now a picker.
 *
 * The entries used to be *inside* the wheel, which meant the wheel had to be
 * tall enough for the busiest day of the week and was therefore mostly empty on
 * the other six — and it put one scroll view inside another, so a thumb on the
 * calendar could turn the wheel or move the page with nothing on screen to say
 * which. See the header of `DayWheel` for the whole chain.
 *
 * Here the list is a sibling of the wheel rather than its contents: the page
 * itself does not scroll in the week view, the wheel scrolls days in its own
 * hundred and fifty points at the top, and this scrolls services in whatever is
 * left. Two scrollers, in two places, each obviously about the thing it is
 * sitting in.
 *
 * It only scrolls when it has to. A day with three services is three rows and
 * the region ends; there is no floor it has to fill and no blank paper below
 * it, because the height it is given is the screen's, not the week's busiest
 * day's.
 * ---------------------------------------------------------------------------
 *
 * ## Saying so when it does
 *
 * A list that only sometimes scrolls needs to say which day it is on, and the
 * rules above and below it were not enough on their own: a card sliced off
 * against a line reads as a list going past the edge of its pane, which is
 * true, but it is a *deduction* and it depends on a card happening to land
 * mid-row. A busy day whose fourth service falls tidily on the rule looks
 * finished.
 *
 * So the region says it outright, and only when it is true — see `moreBelow`.
 * The chip is the mate of the chevrons in the wheel: the same glyph, the same
 * faint ink, so "there is more this way" is one mark in both halves of the week
 * view rather than two inventions.
 */
import { useState } from 'react';
import {
  Platform,
  ScrollView,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { type CalendarOccurrence } from '@spsm/shared';

import { Icon } from '@/components/Icon';
import { Micro, Small } from '@/components/Type';
import { useTheme } from '@/theme/ThemeProvider';

import { Entry } from './Entry';

/**
 * Points of overhang below the fold before the chip appears, and before it goes
 * again at the bottom.
 *
 * Not zero, for two different reasons at the two ends. A list that overflows by
 * three points overflows because of a rounding difference between a content
 * height and a viewport height, and a chip inviting somebody to scroll for
 * three points is a chip that does nothing. At the bottom, iOS rubber-banding
 * routinely settles a point or two short of the true end, and a chip that
 * flickers back on after the list has visibly stopped is worse than no chip.
 */
const SLACK = 12;

export function DaySchedule({
  day,
  entries,
  loading,
  onOpen,
}: {
  day: string;
  entries: CalendarOccurrence[];
  /** Suppresses "Nothing scheduled", which would be a lie before the answer lands. */
  loading: boolean;
  onOpen: (occurrence: CalendarOccurrence, day: string) => void;
}) {
  const theme = useTheme();

  const empty = entries.length === 0;

  /**
   * How tall the pane is, how tall the day is, and how far down it the reader
   * has got.
   *
   * Measured rather than counted from `entries.length`. A row is not a fixed
   * height here — the wheel's is, deliberately, and this is the file where that
   * constraint was lifted — so an entry with a long title and a location is
   * taller than a bare one and no arithmetic on the count can say whether six
   * of them fit.
   */
  const [pane, setPane] = useState(0);
  const [content, setContent] = useState(0);
  const [offset, setOffset] = useState(0);

  /**
   * Whether to invite a scroll: there is more day below the fold, and the
   * reader has not already reached it.
   *
   * Both halves matter. The first is the difference between a Saturday and a
   * Tuesday; the second is what stops the chip sitting over the last service of
   * the day insisting there is another one.
   */
  const moreBelow = content - pane - offset > SLACK;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          gap: theme.space.xs,
          paddingBottom: theme.space.sm,
          // So an empty day's sentence sits in the middle of the space rather
          // than at the top of it, which reads as a list that failed to start.
          flexGrow: 1,
          justifyContent: empty ? 'center' : 'flex-start',
          alignItems: empty ? 'center' : 'stretch',
        }}
        showsVerticalScrollIndicator={!empty}
        /*
         * Android's scrollbar is otherwise drawn only while a finger is moving,
         * which means it can only confirm a gesture somebody has already
         * risked. iOS has no equivalent — an always-on bar there is not a thing
         * the platform does, and the chip below is what covers both.
         */
        persistentScrollbar={Platform.OS === 'android'}
        scrollEventThrottle={16}
        onLayout={(event: LayoutChangeEvent) => setPane(event.nativeEvent.layout.height)}
        onContentSizeChange={(_width: number, height: number) => setContent(height)}
        onScroll={(event: NativeSyntheticEvent<NativeScrollEvent>) =>
          setOffset(event.nativeEvent.contentOffset.y)
        }
      >
        {empty ? (
          /*
           * Said plainly rather than left blank — except while the schedule is in
           * flight, when it would be a claim nobody has checked. An empty day and
           * a day whose entries failed to load look identical if the answer is
           * white space, and the reader's question, "is anything on Wednesday?",
           * deserves a sentence rather than an inference.
           */
          loading ? null : <Small color={theme.color.inkFaint}>Nothing scheduled</Small>
        ) : (
          entries.map((occurrence) => (
            <Entry
              key={`${occurrence.source}:${occurrence.id}`}
              occurrence={occurrence}
              onOpen={() => onOpen(occurrence, day)}
            />
          ))
        )}
      </ScrollView>

      {/*
        "More below", over the foot of the list.

        A chip rather than a gradient fade, which was the other candidate and is
        the wrong tool twice over: it needs a literal colour to fade *to*, which
        is the one thing this app does not write (see `tokens.ts`), and a
        softened edge says "this is cut off" without saying what to do about it.
        This says the direction, and it says it in words for the two or three
        readers who will not read a chevron as one.

        Not a button. Tapping it could scroll the list, and every version of
        that is worse than the gesture: one screen is arbitrary, and a control
        that moves the thing behind it then has to decide what it does when the
        thing has nowhere left to go. It is a label, so `pointerEvents` is off
        and a thumb that lands on it drags the service underneath.
      */}
      {moreBelow ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: 'center',
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.space.xs,
              paddingVertical: theme.space.xs,
              paddingHorizontal: theme.space.sm,
              borderRadius: theme.radius.full,
              backgroundColor: theme.color.paperRaised,
              borderWidth: 1,
              borderColor: theme.color.rule,
            }}
          >
            <Micro color={theme.color.inkSoft}>More below</Micro>
            <Icon name="chevron" size={14} color={theme.color.inkSoft} />
          </View>
        </View>
      ) : null}
    </View>
  );
}
