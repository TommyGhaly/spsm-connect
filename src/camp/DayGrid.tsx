/**
 * Which weeks, and which days of them.
 *
 * The website's `features/camp/DayGrid.tsx` in `weekFirst` mode, which is the
 * only mode the public sign-up uses: tick a week and you have the whole of it,
 * then untick anything you cannot make. The days appear only once a week is on,
 * because ten unticked boxes are a wall on a phone and nobody serves two days
 * of a week they have not said they are coming to.
 */
import { View } from 'react-native';
import {
  CAMP_WEEKDAYS,
  campDayDateLabel,
  campDayKey,
  campWeekKeys,
  campWeekRangeLabel,
  campWeekdayLabel,
  type CampDayKey,
} from '@spsm/shared';

import { Check } from '@/components/Fields';
import { Card } from '@/components/Surface';
import { Label, Micro, Small } from '@/components/Type';
import { useTheme } from '@/theme/ThemeProvider';

export function DayGrid({
  weeks,
  weekStarts,
  days,
  onChange,
}: {
  weeks: number;
  weekStarts: readonly string[];
  days: readonly CampDayKey[];
  onChange: (days: CampDayKey[]) => void;
}) {
  const theme = useTheme();
  const chosen = new Set(days);

  function toggleDay(key: CampDayKey) {
    const next = new Set(chosen);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange([...next]);
  }

  /**
   * The week's own tick.
   *
   * "On" means *any* day of it is chosen, not all five — somebody who has
   * unticked Wednesday is still coming that week, and a box that unticked
   * itself when they did would be arguing with them. Pressing it when it is on
   * clears the week.
   */
  function toggleWeek(week: number) {
    const keys = campWeekKeys(week);
    const next = new Set(chosen);
    const on = keys.some((key) => next.has(key));
    if (on) for (const key of keys) next.delete(key);
    else for (const key of keys) next.add(key);
    onChange([...next]);
  }

  return (
    <View style={{ gap: theme.space.sm }}>
      {Array.from({ length: Math.max(1, weeks) }, (_unused, index) => index + 1).map((week) => {
        const keys = campWeekKeys(week);
        const all = keys.every((key) => chosen.has(key));
        const any = keys.some((key) => chosen.has(key));
        const range = campWeekRangeLabel(weekStarts, week);

        return (
          <Card key={week} gap={theme.space.xs}>
            <Check
              label={range === `Week ${week}` ? `Week ${week}` : `Week ${week} — ${range}`}
              checked={any}
              onChange={() => toggleWeek(week)}
            />

            {any ? (
              <>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.xs }}>
                  {CAMP_WEEKDAYS.map((weekday) => {
                    const key = campDayKey(week, weekday);
                    const date = campDayDateLabel(weekStarts, key);
                    return (
                      <View key={key} style={{ minWidth: 92 }}>
                        <Check
                          label={campWeekdayLabel(weekday)}
                          // The day of the month under the name, when the camp
                          // has been dated. "Tue 14" is what somebody checks
                          // against their own calendar.
                          hint={date ? date.split(' ').pop() : undefined}
                          checked={chosen.has(key)}
                          onChange={() => toggleDay(key)}
                        />
                      </View>
                    );
                  })}
                </View>

                <Micro color={theme.color.inkFaint}>
                  {all ? 'The whole week. Untick any day you cannot make.' : 'Some of the week.'}
                </Micro>
              </>
            ) : null}
          </Card>
        );
      })}

      {weeks < 1 ? (
        <>
          <Label>NOT SET UP YET</Label>
          <Small color={theme.color.inkSoft}>
            The camp has not published its weeks. Ring the church office to say you would
            like to serve.
          </Small>
        </>
      ) : null}
    </View>
  );
}
