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
 */
import { ScrollView } from 'react-native';
import { type CalendarOccurrence } from '@spsm/shared';

import { Small } from '@/components/Type';
import { useTheme } from '@/theme/ThemeProvider';

import { Entry } from './Entry';

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

  return (
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
  );
}
