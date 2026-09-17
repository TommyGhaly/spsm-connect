/**
 * What somebody would like to do, per week and per half of the camp.
 *
 * Per week because the two weeks do not run the same stations, and per section
 * because elementary and middle school do not either. `campWeekRoleOptions` is
 * the shared function that knows which is which, so this file has no list of
 * roles in it and cannot fall behind the camp's settings.
 *
 * Before anybody has chosen a half or a week, everything is shown and the note
 * says so. That is deliberate: the alternative is an empty panel that looks
 * broken, on a form where the thing to do next is above it.
 */
import { View } from 'react-native';
import {
  CAMP_SECTIONS,
  campDesiredRolesFor,
  campSectionLabel,
  campWeekRangeLabel,
  campWeekRoleOptions,
  toggleDesiredRole,
  type CampConfig,
  type CampSection,
} from '@spsm/shared';

import { Check } from '@/components/Fields';
import { Card } from '@/components/Surface';
import { Label, Micro } from '@/components/Type';
import { useTheme } from '@/theme/ThemeProvider';

export function WeekRoles({
  config,
  byWeek,
  onChange,
  weeksAttending,
  sections,
}: {
  config: CampConfig;
  byWeek: Readonly<Record<string, string[]>>;
  onChange: (next: Record<string, string[]>) => void;
  /** The weeks the days above add up to. */
  weeksAttending: readonly number[];
  sections: readonly CampSection[];
}) {
  const theme = useTheme();

  const chosenSections = CAMP_SECTIONS.filter((section) => sections.includes(section));
  const chosenWeeks = [...new Set(weeksAttending)].sort((a, b) => a - b);

  const sectionsShown = chosenSections.length > 0 ? chosenSections : CAMP_SECTIONS;
  const weeks =
    chosenWeeks.length > 0
      ? chosenWeeks
      : Array.from({ length: Math.max(1, config.weeks) }, (_unused, index) => index + 1);

  const everything = chosenSections.length === 0 || chosenWeeks.length === 0;

  return (
    <View style={{ gap: theme.space.sm }}>
      {everything ? (
        <Micro color={theme.color.inkFaint}>
          Everything the camp runs, week by week. Tick a half of the camp and your weeks
          above and this narrows to yours.
        </Micro>
      ) : null}

      {weeks.map((week) => {
        const range = campWeekRangeLabel(config.weekStarts, week);

        return (
          <Card key={week} gap={theme.space.sm}>
            <Label>{range === `Week ${week}` ? `WEEK ${week}` : `WEEK ${week} — ${range}`}</Label>

            {sectionsShown.map((section) => {
              const chosen = campDesiredRolesFor({ desiredRolesByWeek: byWeek }, week, section);
              const options = campWeekRoleOptions(config, week, section);
              /*
               * A role the camp has since removed from its list, but which this
               * person already asked for. Kept on screen so unticking it is
               * possible — a choice that cannot be seen cannot be withdrawn.
               */
              const extra = chosen.filter((role) => !options.includes(role));

              return (
                <View key={section} style={{ gap: theme.space.xs }}>
                  {sectionsShown.length > 1 ? (
                    <Micro color={theme.color.inkSoft}>{campSectionLabel(section)}</Micro>
                  ) : null}

                  {[...options, ...extra].map((role) => (
                    <Check
                      key={`${section}:${role}`}
                      label={role}
                      checked={chosen.includes(role)}
                      onChange={(on) => onChange(toggleDesiredRole(byWeek, week, section, role, on))}
                    />
                  ))}

                  {options.length === 0 && extra.length === 0 ? (
                    <Micro color={theme.color.inkFaint}>
                      The camp has not listed anything for this week yet.
                    </Micro>
                  ) : null}
                </View>
              );
            })}
          </Card>
        );
      })}
    </View>
  );
}
