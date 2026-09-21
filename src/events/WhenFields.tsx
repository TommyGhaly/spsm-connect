/**
 * When the event is: the sentence a parishioner will read, and the controls
 * that change it.
 *
 * A port of the website's `WhenLine`, minus its popover. Over there the panel
 * comes to the line because putting a day, two clock times, two switches, a row
 * of shortcuts and possibly a time zone inline is what made pressing Edit move
 * the top of the page by several hundred pixels. A phone screen is one column
 * and the editor is already a column of fields, so there is nothing for a
 * popover to protect here — the controls simply stand where the line is.
 *
 * Three things are kept from it, and they are the ones that matter:
 *
 *  1. **A day and two clock times**, not two full dates. Almost every event is
 *     one day long, and a pair of date entries makes "9am to 11am" and "9am on
 *     the 3rd to 11am on the 30th" look identical.
 *  2. **The second date exists only when it is needed.** A field that is not on
 *     the screen cannot be filled in wrong.
 *  3. **The result is printed in words**, by the same function the page prints
 *     it with. That is the only honest check on a time-zone conversion: not the
 *     offset, but the sentence somebody will read.
 *
 * ## The fields are typed, and there is no picker
 *
 * The website gets `<input type="date">` and `<input type="time">` free from
 * the browser. React Native has neither, and the community picker is a native
 * dependency to add to two build targets — one of them an App Clip with a 15MB
 * budget — for a form a handful of people use a handful of times a year. So
 * these are text, in the same `YYYY-MM-DD` and `HH:MM` the documents store,
 * checked as they are typed. `calendar/AddEntry` made the same call for the
 * same reason and says so at length; if this turns out to be the thing staff
 * complain about, the picker is a dependency and an afternoon — but it should
 * be added because somebody asked, not on a guess.
 */
import { Pressable, View } from 'react-native';
import {
  COMMON_TIME_ZONES,
  PARISH_TIME_ZONE,
  endInstantOf,
  formatEventWhen,
  startInstantOf,
  zoneAbbreviation,
  type EventFieldKey,
  type EventFormState,
} from '@spsm/shared';

import { Check, Field, Pair, Picker } from '@/components/Fields';
import { Body, Label, Micro, Small } from '@/components/Type';
import { useTheme } from '@/theme/ThemeProvider';

/** How long an event usually is. Enough to cover a class, a liturgy, a festival. */
const DURATIONS: [string, number][] = [
  ['1 hr', 60],
  ['1½ hr', 90],
  ['2 hr', 120],
  ['3 hr', 180],
];

type Setter = <K extends keyof EventFormState>(key: K, value: EventFormState[K]) => void;

/**
 * `HH:MM` plus some minutes, as civil arithmetic — which is what a person means
 * by "two hours later" even on the night the clocks change.
 *
 * Returns the day offset separately, so an event that runs past midnight sets
 * an end *date* rather than an end time earlier than its start.
 */
function laterBy(time: string, minutes: number): { time: string; dayOffset: number } {
  const parts = time.split(':');
  const total = Number(parts[0]) * 60 + Number(parts[1]) + minutes;
  if (!Number.isFinite(total)) return { time, dayOffset: 0 };
  const dayOffset = Math.floor(total / 1440);
  const within = ((total % 1440) + 1440) % 1440;
  const pad = (value: number) => String(value).padStart(2, '0');
  return { time: `${pad(Math.floor(within / 60))}:${pad(within % 60)}`, dayOffset };
}

/** `2026-09-06` a day or two on. UTC arithmetic, because these are civil dates. */
function dayAfter(day: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match || days === 0) return day;
  const shifted = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days);
  return new Date(shifted).toISOString().slice(0, 10);
}

/** The sentence, or a prompt when the fields do not yet name a moment. */
export function sentenceOf(form: EventFormState): { text: string; missing: boolean } {
  const start = startInstantOf(form);
  if (!start) return { text: 'Say when it is', missing: true };
  return {
    text: formatEventWhen(start, endInstantOf(form), form.allDay, form.timeZone),
    missing: false,
  };
}

export function WhenFields({
  form,
  set,
  errorOf,
}: {
  form: EventFormState;
  set: Setter;
  errorOf: (field: EventFieldKey) => string | null;
}) {
  const theme = useTheme();
  const start = startInstantOf(form);
  const { text, missing } = sentenceOf(form);
  const zone = start ? zoneAbbreviation(start, form.timeZone) : '';

  /** Set the end from the start, carrying onto the next day if it wraps. */
  function setDuration(minutes: number) {
    if (!form.startTime) return;
    const { time, dayOffset } = laterBy(form.startTime, minutes);
    set('endTime', time);
    if (dayOffset > 0 && form.date) set('endDate', dayAfter(form.date, dayOffset));
    else if (dayOffset === 0 && form.endDate) set('endDate', '');
  }

  return (
    <View style={{ gap: theme.space.sm }}>
      {/*
        The sentence, above the fields that make it, announced politely as it
        changes. This is the value being edited — the fields are only how it is
        arrived at — and reading the result is the whole reason they are here.
      */}
      <View accessibilityRole="summary" accessibilityLiveRegion="polite">
        <Body color={missing ? theme.color.accentStrong : theme.color.ink}>
          {text}
          {zone && !form.allDay ? <Small color={theme.color.inkFaint}> {zone}</Small> : null}
        </Body>
      </View>

      <Field
        label={form.endDate ? 'First day' : 'Day'}
        value={form.date}
        onChange={(next) => set('date', next)}
        placeholder="2026-09-06"
        keyboard="numbers-and-punctuation"
        hint="Year, month, day."
        error={errorOf('date')}
      />

      {/* The times disappear entirely for an all-day event rather than being
          greyed out. A disabled time field still says "there is a time here and
          you may not have it", which is not what all day means. */}
      {form.allDay ? null : (
        <>
          <Pair>
            <Field
              label="Starts"
              value={form.startTime}
              onChange={(next) => set('startTime', next)}
              placeholder="19:00"
              keyboard="numbers-and-punctuation"
              error={errorOf('startTime')}
            />
            <Field
              label="Ends"
              value={form.endTime}
              onChange={(next) => set('endTime', next)}
              placeholder="21:00"
              keyboard="numbers-and-punctuation"
              hint={form.endTime ? undefined : 'Optional'}
              error={errorOf('endTime')}
            />
          </Pair>

          {/* Shortcuts rather than a control: the end time is a real field
              above, and these only fill it in. */}
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: theme.space.xs }}>
            <Label>LASTS</Label>
            {DURATIONS.map(([label, minutes]) => (
              <Chip
                key={minutes}
                label={label}
                disabled={!form.startTime}
                onPress={() => setDuration(minutes)}
              />
            ))}
            {form.endTime ? (
              <Chip
                label="Open-ended"
                quiet
                onPress={() => {
                  set('endTime', '');
                  set('endDate', '');
                }}
              />
            ) : null}
          </View>
        </>
      )}

      <Check
        label="All day — don’t show a time"
        checked={form.allDay}
        onChange={(on) => {
          set('allDay', on);
          // Cleared rather than kept and hidden. A hidden value that reappears
          // when somebody unticks the box is a value nobody remembers setting.
          if (on) {
            set('startTime', '');
            set('endTime', '');
          }
        }}
      />

      <Check
        label="Runs onto another day"
        checked={Boolean(form.endDate)}
        onChange={(on) => set('endDate', on ? dayAfter(form.date || '', 1) : '')}
      />

      {form.endDate ? (
        <Field
          label="Last day"
          value={form.endDate}
          onChange={(next) => set('endDate', next)}
          placeholder="2026-09-08"
          keyboard="numbers-and-punctuation"
          error={errorOf('endDate')}
        />
      ) : null}

      {/*
        The zone, last and quiet. Almost every event is in the parish's own
        zone, and a picker nobody needs sitting above the times is a decision
        offered to everybody to serve the one festival that is in Cairo.
      */}
      {form.timeZone === PARISH_TIME_ZONE ? (
        <Pressable
          onPress={() => set('timeZone', 'Africa/Cairo')}
          accessibilityRole="button"
          accessibilityLabel="This event is in a different time zone"
          hitSlop={theme.space.xs}
          style={{ paddingVertical: theme.space.xs }}
        >
          <Micro color={theme.color.accent}>This event is in a different time zone</Micro>
        </Pressable>
      ) : (
        <Picker
          label="Time zone"
          value={form.timeZone}
          options={COMMON_TIME_ZONES.map((option) => ({
            value: option,
            label: option.replace(/_/g, ' '),
          }))}
          onChange={(next) => set('timeZone', next)}
        />
      )}
    </View>
  );
}

/** A small press-to-fill button. Not a `Button` — these sit in a row of four. */
function Chip({
  label,
  onPress,
  disabled = false,
  quiet = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  quiet?: boolean;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => ({
        paddingHorizontal: theme.space.sm,
        paddingVertical: theme.space.xs,
        borderRadius: theme.radius.full,
        borderWidth: 1,
        borderColor: quiet ? theme.color.rule : theme.color.accent,
        backgroundColor: pressed ? theme.color.accentSoft : 'transparent',
        opacity: disabled ? 0.4 : 1,
        minHeight: 32,
        justifyContent: 'center',
      })}
    >
      <Micro color={quiet ? theme.color.inkSoft : theme.color.accent}>{label}</Micro>
    </Pressable>
  );
}
