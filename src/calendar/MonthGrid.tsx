/**
 * A month, as a grid you scan by date.
 *
 * ---------------------------------------------------------------------------
 * Quiet by default; the day you ask for, in a sheet.
 *
 * The cells carry a date and one coloured dot per entry, and nothing else. That
 * is enough to see that Saturdays are heavy and Wednesdays are empty, and
 * enough to see where the liturgies fall, because the dots are coloured by what
 * the thing is. The website tried the other way first — four lines of "9 PM /
 * High School Online Bible Study" per day across 35 cells — and it was complete
 * and unreadable: nothing stood out because everything was shouting, and the
 * grid's actual job, telling you the *shape* of the month at a glance, was
 * buried under about four hundred words. On a phone the cells are 48 points
 * wide, so the question does not even arise.
 *
 * Tapping a day raises it as a sheet from the foot of the screen — the website's
 * own narrow-screen behaviour, `DaySheet`, rather than an invention. Its wide
 * layout opens a whole *week* in the cells on hover, and there is no hover on a
 * touch screen and no room in a 48-point cell to open anything into. The sheet
 * replaced a panel under the grid, on both surfaces, because on a phone that
 * panel was a scroll away from the date that opened it; see `DaySheet.tsx`.
 * ---------------------------------------------------------------------------
 *
 * The website's version is a `<table>`, and argues for it: a month view is
 * tabular data, and a screen reader announces "Wednesday, 19" on arrival in a
 * cell because the column header says so. React Native has no table, and no
 * equivalent of `scope="col"` — so every cell states its own full date in its
 * accessibility label instead. That is more verbose and it is the only way the
 * column is recoverable by ear.
 */
import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { dayParts, type CalendarOccurrence, type ViewRange } from '@spsm/shared';

import { Label, Micro } from '@/components/Type';
import { useTheme } from '@/theme/ThemeProvider';

import { DaySheet } from './DaySheet';
import { Dots } from './Dots';

/**
 * Monday first, matching `WEEK_STARTS_ON` in @spsm/shared.
 *
 * These two have to agree and there is nothing in the type system that makes
 * them: `monthRange` decides which day each column *is*, and this decides what
 * each column is *called*. Get them out of step and every event silently sits
 * one column from where it belongs, with the grid still looking perfectly
 * plausible.
 */
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function MonthGrid({
  range,
  byDay,
  today,
  loading,
  over,
  onOpen,
}: {
  range: ViewRange;
  byDay: Map<string, CalendarOccurrence[]>;
  today: string;
  /** Suppresses "Nothing scheduled" in the sheet before the answer lands. */
  loading: boolean;
  /**
   * The event sheet. Presented from inside the day sheet while that is up, so
   * it stacks on top of it — see `DaySheet` for why it cannot be a sibling —
   * and beside the grid otherwise.
   */
  over: ReactNode;
  onOpen: (occurrence: CalendarOccurrence, day: string) => void;
}) {
  const theme = useTheme();

  /** The day the sheet is open on, until the sheet is put away. */
  const [picked, setPicked] = useState<string | null>(null);

  /*
   * A day from last month must not stay open into this one. Adjusted during
   * render rather than in an effect — React's own documented shape for "reset
   * state when a value changes", and the same pattern `CalendarScreen` uses for
   * the denied note.
   */
  const [pickedFrom, setPickedFrom] = useState(range.from);
  if (pickedFrom !== range.from) {
    setPickedFrom(range.from);
    setPicked(null);
  }

  /*
   * `range.days` is already padded to whole weeks by `monthRange`, so the rows
   * are a straight slice by seven. Every row gets exactly seven cells; a short
   * one would silently unalign every column from its heading.
   */
  const weeks: string[][] = [];
  for (let index = 0; index < range.days.length; index += 7) {
    weeks.push(range.days.slice(index, index + 7));
  }

  // Which month this grid is *of*, so the padding days from the months either
  // side can be dimmed. Taken from the middle of the range rather than from its
  // first day, which by definition often belongs to the previous month.
  const monthKey = (range.days[Math.floor(range.days.length / 2)] ?? '').slice(0, 7);

  return (
    <View style={{ gap: theme.space.sm }}>
      <View style={{ flexDirection: 'row' }}>
        {WEEKDAYS.map((weekday) => (
          <View key={weekday} style={{ flex: 1, alignItems: 'center' }}>
            <Label>{weekday}</Label>
          </View>
        ))}
      </View>

      <View style={{ gap: 2 }}>
        {weeks.map((week) => (
          <View key={week[0]} style={{ flexDirection: 'row', gap: 2 }}>
            {week.map((day) => (
              <DayCell
                key={day}
                day={day}
                entries={byDay.get(day) ?? []}
                inMonth={day.slice(0, 7) === monthKey}
                isToday={day === today}
                isPicked={day === picked}
                onPick={() => setPicked(day)}
              />
            ))}
          </View>
        ))}
      </View>

      {picked ? (
        <DaySheet
          days={range.days}
          day={picked}
          byDay={byDay}
          today={today}
          loading={loading}
          over={over}
          onPick={setPicked}
          onShut={() => setPicked(null)}
          onOpen={onOpen}
        />
      ) : (
        over
      )}
    </View>
  );
}

function DayCell({
  day,
  entries,
  inMonth,
  isToday,
  isPicked,
  onPick,
}: {
  day: string;
  entries: CalendarOccurrence[];
  inMonth: boolean;
  isToday: boolean;
  isPicked: boolean;
  onPick: () => void;
}) {
  const theme = useTheme();
  const parts = dayParts(day);

  const label = `${parts.weekday} ${parts.month} ${parts.dayOfMonth}${isToday ? ', today' : ''} — ${
    entries.length === 0 ? 'nothing scheduled' : `${entries.length} scheduled`
  }`;

  /*
   * The date in a disc, and the disc is what today is marked on.
   *
   * Today used to be a wash over the whole cell, which is the loudest mark the
   * grid has and was spent on the one day the reader is least likely to be
   * hunting for — they know what today is. Worse, the picked day was marked
   * with a thin accent outline on the same cell, so on the common gesture of
   * tapping today the two marks landed on top of each other and neither read.
   *
   * A filled disc is the convention every calendar on the phone already uses,
   * it is the size of one numeral rather than of a cell, and it leaves the
   * cell's own background free to say the other thing: which day the sheet is on.
   */
  const face = (
    <>
      <View
        style={{
          minWidth: 24,
          height: 24,
          paddingHorizontal: 2,
          borderRadius: theme.radius.full,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isToday ? theme.color.accent : 'transparent',
        }}
      >
        <Micro
          color={
            isToday
              ? theme.color.inkInverse
              : inMonth
                ? theme.color.ink
                : theme.color.inkFaint
          }
        >
          {parts.dayOfMonth}
        </Micro>
      </View>
      {entries.length > 0 ? <Dots entries={entries} max={3} /> : null}
    </>
  );

  const box = {
    flex: 1,
    minHeight: 56,
    paddingVertical: theme.space.xs,
    paddingHorizontal: 2,
    alignItems: 'center' as const,
    gap: 3,
    borderRadius: theme.radius.sm,
    backgroundColor: isPicked
      ? theme.color.accentSoft
      : inMonth
        ? theme.color.paperRaised
        : 'transparent',
  };

  /*
   * A day with nothing on it is not a button.
   *
   * The dots are the answer to "is anything on the 12th", and a cell that can
   * be pressed to be told "nothing" a second time is a control with no work to
   * do. The website draws the same distinction, for the same reason.
   */
  if (entries.length === 0) {
    return (
      <View style={box} accessible accessibilityLabel={label}>
        {face}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPick}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Opens the day"
      accessibilityState={{ selected: isPicked }}
      style={({ pressed }) => [box, pressed ? { backgroundColor: theme.color.paperSunken } : null]}
    >
      {face}
    </Pressable>
  );
}
