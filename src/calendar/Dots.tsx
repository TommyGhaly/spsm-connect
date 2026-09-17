/**
 * How full a day is, and roughly what of.
 *
 * One coloured dot per entry, in the kind's own tint. Read in three places —
 * the day wheel's rows, the month grid's cells, and nothing else — which is why
 * it is a file rather than an export off whichever of them was written first.
 *
 * Capped, and the remainder counted. A month cell is about forty-eight points
 * wide and a Saturday with eight things on it wrapped its dots onto a second
 * line, which made that one cell taller than the rest of its row — the grid
 * developing a bulge over the busiest day, which is the opposite of what the
 * dots are for. `+3` says the same "and more" in the width of one dot.
 */
import { View } from 'react-native';
import { kindOf, type CalendarOccurrence } from '@spsm/shared';

import { Micro } from '@/components/Type';
import { useTheme } from '@/theme/ThemeProvider';

import { tintFor } from './kinds';

export function Dots({ entries, max = 8 }: { entries: CalendarOccurrence[]; max?: number }) {
  const theme = useTheme();

  const shown = entries.slice(0, max);
  const rest = entries.length - shown.length;

  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', gap: 3, flexShrink: 1 }}
      // The count is in the label of whatever contains this — a row, a cell —
      // and hearing it a second time as a run of dots says nothing.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {shown.map((occurrence) => (
        <View
          key={`${occurrence.source}:${occurrence.id}`}
          style={{
            width: 6,
            height: 6,
            borderRadius: theme.radius.full,
            backgroundColor: tintFor(kindOf(occurrence), theme),
          }}
        />
      ))}
      {rest > 0 ? <Micro color={theme.color.inkFaint}>+{rest}</Micro> : null}
    </View>
  );
}
