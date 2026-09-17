/**
 * Add something the church is doing that no source knows about.
 *
 * ---------------------------------------------------------------------------
 * On the calendar, and in a sheet in the middle of it.
 *
 * On this screen rather than one of its own, which is the programme's settled
 * pattern — the shop is edited on its cards, a form in a drawer on /forms — and
 * it earns it here particularly well: whoever is adding a service is looking at
 * the week they are adding it to, and the day field opens on it.
 *
 * The form is deliberately short. Everything on it is something a calendar
 * needs; anything that only a *page* would need is absent, because an entry
 * that deserves a page should be an `Event`, which is made in the Firestore
 * console.
 * ---------------------------------------------------------------------------
 *
 * ---------------------------------------------------------------------------
 * The day and the times are typed, and there is no picker.
 *
 * The website gets `<input type="date">` and `<input type="time">` free from
 * the browser; React Native has neither, and the community picker is a native
 * dependency to add to two build targets — one of which is an App Clip with a
 * 15 MB budget — for a form a handful of people use a handful of times a year.
 *
 * So the fields are text, in the same `YYYY-MM-DD` and `HH:MM` the documents
 * store, validated before the button will do anything. The day is filled in
 * from what the reader is looking at, which is the common case typed for them.
 * If this turns out to be the thing staff complain about, the picker is a
 * dependency and an afternoon — but it should be added because somebody asked,
 * not on a guess.
 * ---------------------------------------------------------------------------
 */
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { EMPTY_SCHEDULE_ENTRY, SCHEDULE_KINDS, type ScheduleEntry } from '@spsm/shared';

import { Icon } from '@/components/Icon';
import { Button } from '@/components/Surface';
import { Label, Small } from '@/components/Type';
import { useTheme } from '@/theme/ThemeProvider';

import { addScheduleEntry } from './adminData';
import { Close, Field, Pair, Problem, Sheet } from '@/components/Fields';
import { KIND_LABELS, tintFor } from './kinds';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

export function AddEntry({
  defaultDay,
  onAdded,
  compact = false,
}: {
  defaultDay: string;
  onAdded: () => void;
  /**
   * A round button in the calendar's own control row rather than a full-width
   * one at the foot of the screen.
   *
   * The week view is laid out to fit the window instead of scrolling, so every
   * band across it is height taken off the day being read — and a bar reading
   * "Add to the schedule" is fifty of them spent on a control that the handful
   * of people with the `events` grant press a handful of times a year. Beside
   * the stepper it is where they are already looking when they decide to add
   * something, and it costs nobody else anything.
   */
  compact?: boolean;
}) {
  const theme = useTheme();

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ScheduleEntry>({ ...EMPTY_SCHEDULE_ENTRY, day: defaultDay });
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const set = <K extends keyof ScheduleEntry>(field: K, value: ScheduleEntry[K]) =>
    setDraft((current) => ({ ...current, [field]: value }));

  /*
   * Every field that has to be *shaped* right, checked where it is typed rather
   * than on submit. A refusal after pressing Add would come from Firestore's
   * rules, which say nothing about date formats and would report this as a
   * permission problem.
   */
  const dayIsBad = draft.day !== '' && !DAY.test(draft.day);
  const endDayIsBad =
    draft.endDay !== '' && (!DAY.test(draft.endDay) || draft.endDay < draft.day);
  const startIsBad = draft.startTime !== '' && !CLOCK.test(draft.startTime);
  const endIsBad = draft.endTime !== '' && !CLOCK.test(draft.endTime);

  const ready =
    draft.title.trim() !== '' &&
    DAY.test(draft.day) &&
    !endDayIsBad &&
    !startIsBad &&
    !endIsBad;

  function begin() {
    setDraft({ ...EMPTY_SCHEDULE_ENTRY, day: defaultDay });
    setProblem(null);
    setOpen(true);
  }

  function add() {
    if (!ready) return;
    setBusy(true);
    setProblem(null);

    void addScheduleEntry({
      ...draft,
      title: draft.title.trim(),
      // An entry with no start time is an all-day entry. The parser says the
      // same thing; doing it here too means the stored document is already
      // coherent rather than relying on being read back through it.
      allDay: draft.startTime === '',
      endDay: draft.endDay === '' ? draft.day : draft.endDay,
    })
      .then(() => {
        setOpen(false);
        onAdded();
      })
      .catch((error: unknown) => {
        setProblem(error instanceof Error ? error.message : String(error));
      })
      .finally(() => setBusy(false));
  }

  return (
    <>
      {compact ? (
        <Pressable
          onPress={begin}
          accessibilityRole="button"
          accessibilityLabel="Add to the schedule"
          style={({ pressed }) => ({
            width: 44,
            height: 44,
            borderRadius: theme.radius.full,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: pressed ? theme.color.accentSoft : theme.color.paperRaised,
            borderWidth: 1,
            borderColor: theme.color.rule,
          })}
        >
          <Icon name="plus" color={theme.color.accent} />
        </Pressable>
      ) : (
        <Button label="Add to the schedule" tone="quiet" onPress={begin} />
      )}

      <Sheet open={open} onClose={() => setOpen(false)} label="Add to the schedule">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
          <View style={{ flex: 1 }}>
            <Label>Add to the schedule</Label>
          </View>
          <Close onPress={() => setOpen(false)} what="this form" />
        </View>

        <Field
          label="What is it?"
          value={draft.title}
          onChange={(value) => set('title', value)}
          placeholder="Choir practice"
        />

        <Pair>
          <Field
            label="Day"
            value={draft.day}
            onChange={(value) => set('day', value)}
            placeholder="2026-09-13"
            keyboard="numbers-and-punctuation"
            invalid={dayIsBad}
            hint="Year-month-day"
          />
          <Field
            label="Until"
            value={draft.endDay}
            onChange={(value) => set('endDay', value)}
            placeholder="Optional"
            keyboard="numbers-and-punctuation"
            invalid={endDayIsBad}
            hint="Only if it runs over days"
          />
        </Pair>

        <Pair>
          <Field
            label="Starts"
            value={draft.startTime}
            onChange={(value) => set('startTime', value)}
            placeholder="18:30"
            keyboard="numbers-and-punctuation"
            invalid={startIsBad}
            hint="24-hour"
          />
          <Field
            label="Ends"
            value={draft.endTime}
            onChange={(value) => set('endTime', value)}
            placeholder="Optional"
            keyboard="numbers-and-punctuation"
            invalid={endIsBad}
          />
        </Pair>
        <Small color={theme.color.inkFaint}>
          Leave the start time empty for something that runs all day.
        </Small>

        {/*
          Asked rather than guessed. Every other source has its kind read off
          its title because there is nothing else to go on; here somebody is
          typing the thing in, so asking is both more accurate and less work.
        */}
        <View style={{ gap: theme.space.xs }}>
          <Label>KIND</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.xs }}>
            {SCHEDULE_KINDS.map((kind) => {
              const on = draft.kind === kind;
              return (
                <Pressable
                  key={kind}
                  onPress={() => set('kind', kind)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={KIND_LABELS[kind]}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: theme.space.xs,
                    borderColor: on ? theme.color.accent : theme.color.rule,
                    borderWidth: 1,
                    borderRadius: theme.radius.full,
                    paddingHorizontal: theme.space.sm,
                    minHeight: 44,
                    backgroundColor: pressed || on ? theme.color.accentSoft : 'transparent',
                  })}
                >
                  <View
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: theme.radius.full,
                      backgroundColor: tintFor(kind, theme),
                    }}
                  />
                  <Small>{KIND_LABELS[kind]}</Small>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Field
          label="Where"
          value={draft.location}
          onChange={(value) => set('location', value)}
          placeholder="Church hall"
        />
        <Field
          label="Note"
          value={draft.note}
          onChange={(value) => set('note', value)}
          placeholder="Optional"
          lines={2}
        />

        {dayIsBad || endDayIsBad || startIsBad || endIsBad ? (
          <Problem>
            Dates are written 2026-09-13 and times 18:30, and the last day cannot come before the
            first.
          </Problem>
        ) : null}
        {problem ? <Problem>{problem}</Problem> : null}

        <Button label={busy ? 'Adding…' : 'Add'} onPress={add} busy={busy} disabled={!ready} />
        <Button label="Cancel" tone="quiet" onPress={() => setOpen(false)} disabled={busy} />
      </Sheet>
    </>
  );
}
