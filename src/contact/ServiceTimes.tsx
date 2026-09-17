/**
 * The regular weekly schedule.
 *
 * Distinct from the bulletin, and the difference matters: this is what happens
 * *every* week, so it is true whether or not anyone published a bulletin. The
 * bulletin is one specific week, including its exceptions. A visitor asking
 * "when is liturgy?" wants this one.
 *
 * ---------------------------------------------------------------------------
 * ## The rows are the calendar's rows
 *
 * A service on this page and a service on the Calendar tab are the same kind of
 * thing to the person reading them, so they are drawn the same way: a raised
 * row with the church's card radius, a bar down the left edge carrying the
 * kind's colour at full strength, and the time in a chip on that kind's wash.
 * That is `calendar/Entry.tsx`'s language, and the colours come from the same
 * `tintFor`/`washFor` so the two screens cannot drift apart.
 *
 * What is deliberately *not* carried over is the press. A calendar entry opens
 * a sheet with a location, a description and a contact in it; a service time is
 * three strings and there is nothing behind it to open. A row that looks
 * pressable and does nothing is worse than a row that does not.
 *
 * ## Times print as written
 *
 * The same rule the bulletin follows, and the reason `ServiceTime.time` is free
 * text: the source is a human writing a schedule — "8:00 – 11:30 AM" — not an
 * instant, and re-deriving a start and an end from it to fill the chip the way
 * the calendar does would invent two facts from one string. Only a trailing
 * meridiem is split off, so the number the reader is hunting for is set at the
 * size a number should be and "AM" does not compete with it.
 * ---------------------------------------------------------------------------
 */
import { View } from 'react-native';
import { occurrenceKind, type ServiceTime } from '@spsm/shared';

import { Card } from '@/components/Surface';
import { Body, Micro, Small, Subheading } from '@/components/Type';
import { tintFor, washFor } from '@/calendar/kinds';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * The time column. Wider than the calendar's 76, because that one holds a
 * single clock ("11:30 AM") and these hold a range.
 */
const WHEN_WIDTH = 104;

/** The bar down the left edge, at the calendar's width. */
const BAR = 4;

export function ServiceTimes({ services }: { services: ServiceTime[] }) {
  const theme = useTheme();

  if (services.length === 0) {
    return (
      <Card>
        <Subheading>Service times aren&apos;t published yet</Subheading>
        <Body color={theme.color.inkSoft}>
          The weekly schedule hasn&apos;t been added yet. This week&apos;s services are on the
          calendar, and the church office can confirm the regular times.
        </Body>
      </Card>
    );
  }

  /*
   * Grouped by day so a day with three services reads as one block rather than
   * three repetitions of the same day name. A `Map` because insertion order is
   * the church's order — `serviceTimes` is stored in the order it should be
   * listed, and sorting it here would be this screen overruling the office.
   */
  const byDay = new Map<string, ServiceTime[]>();
  for (const service of services) {
    const existing = byDay.get(service.day);
    if (existing) existing.push(service);
    else byDay.set(service.day, [service]);
  }

  return (
    <View style={{ gap: theme.space.md }}>
      {[...byDay.entries()].map(([day, entries]) => (
        <View key={day} style={{ gap: theme.space.xs }}>
          {/* A day with no name is a half-finished edit rather than a day, so
              the heading is skipped instead of printing an empty line. */}
          {day !== '' && <Subheading>{day}</Subheading>}

          {entries.map((service) => (
            <Service key={`${service.name}-${service.time}`} service={service} />
          ))}
        </View>
      ))}
    </View>
  );
}

/** One service, in the calendar's row. */
function Service({ service }: { service: ServiceTime }) {
  const theme = useTheme();

  // By what the service *is*, from its own title — the same classifier the
  // calendar puts every untyped entry through. A liturgy is liturgical red.
  const kind = occurrenceKind(service.name);
  const tint = tintFor(kind, theme);
  const wash = washFor(kind, theme);

  const [clock, meridiem] = splitMeridiem(service.time);

  return (
    <View
      // Read as one line rather than as a time and a name, which is what a
      // screen reader would otherwise announce as two separate texts.
      accessible
      accessibilityLabel={service.time === '' ? service.name : `${service.name}, ${service.time}`}
      style={{
        flexDirection: 'row',
        borderRadius: theme.radius.md,
        // Clips the bar to the corner radius, so the colour ends where the row
        // does instead of squaring off its top-left.
        overflow: 'hidden',
        backgroundColor: theme.color.paperRaised,
      }}
    >
      <View
        style={{
          width: 0,
          alignSelf: 'stretch',
          borderLeftWidth: BAR,
          borderLeftColor: tint,
        }}
      />

      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space.sm,
          padding: theme.space.sm,
        }}
      >
        {/* Only where there is a time. A row whose chip is an empty tinted box
            reads as a time that failed to load. */}
        {service.time !== '' && (
          <View
            style={{
              width: WHEN_WIDTH,
              backgroundColor: wash,
              borderRadius: theme.radius.sm,
              paddingVertical: theme.space.xs,
              paddingHorizontal: theme.space.xs,
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              minHeight: 34,
            }}
          >
            <Small>{clock}</Small>
            {meridiem !== '' && <Micro color={theme.color.inkSoft}>{meridiem}</Micro>}
          </View>
        )}

        <View style={{ flex: 1 }}>
          <Body>{service.name}</Body>
        </View>
      </View>
    </View>
  );
}

/**
 * "8:00 – 11:30 AM" → ["8:00 – 11:30", "AM"].
 *
 * A trailing meridiem and nothing else. Anything the office writes that does
 * not end in one — "after Liturgy", "8am", "sunset" — comes back whole and is
 * printed as it was typed, which is the promise this field makes.
 */
function splitMeridiem(time: string): [string, string] {
  const match = /^(.*\S)\s+([AaPp]\.?[Mm]\.?)$/.exec(time.trim());
  if (!match?.[1] || !match[2]) return [time.trim(), ''];
  return [match[1], match[2]];
}
