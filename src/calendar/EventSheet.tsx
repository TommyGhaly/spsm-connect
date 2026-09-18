/**
 * One occurrence, opened.
 *
 * The website's `EventDialog`, and the division of labour is the same:
 *
 *   any occurrence     staff may add or change a *detail* — a note, a location,
 *                      a contact, a link. Never a title or a time; those belong
 *                      to whichever source the entry came from.
 *   `manual` only      staff may delete the whole thing, because the church
 *                      owns it outright.
 *
 * ---------------------------------------------------------------------------
 * There is no link to the entry's own page, unless somebody hands us one.
 *
 * A feature event carries `href` — `/events/summercamp` — and the app has that
 * screen. It cannot be reached from here directly: `src/calendar/` is rendered
 * by the App Clip as well as by the tab, and the clip never imports
 * expo-router. (See the route file at `app/(drawer)/(tabs)/calendar.tsx`, which
 * is a wrapper for exactly this reason.) So navigation arrives as a function
 * from whoever is hosting the screen, and the row is simply absent for a host
 * that has nowhere to send anybody — which is the truth in a clip.
 * ---------------------------------------------------------------------------
 */
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import {
  EMPTY_CALENDAR_DETAIL,
  dayParts,
  formatClock,
  isSafeLink,
  kindOf,
  type CalendarDetail,
  type CalendarOccurrence,
} from '@spsm/shared';
import { Image } from 'expo-image';

import { Button } from '@/components/Surface';
import { Body, Heading, Label, Small } from '@/components/Type';
import { useTheme } from '@/theme/ThemeProvider';

import { removeCalendarDetail, removeScheduleEntry, saveCalendarDetail } from './adminData';
import { Close, Field, Pair, Problem, Sheet } from '@/components/Fields';
import { RemindAboutThis } from '@/notify/RemindAboutThis';
import { tintFor } from './kinds';

export function EventSheet({
  occurrence,
  day,
  detail,
  mayEdit,
  onOpenPage,
  onClose,
  onChanged,
}: {
  /** Null when nothing is open; the sheet is mounted either way. */
  occurrence: CalendarOccurrence | null;
  day: string | null;
  detail: CalendarDetail | null;
  mayEdit: boolean;
  onOpenPage: ((href: string) => void) | undefined;
  onClose: () => void;
  onChanged: () => void;
}) {
  const theme = useTheme();

  /*
   * Unmounted rather than held open-but-empty. The website's `<dialog>` has to
   * stay in the tree because the element *is* the open/closed state; a `Modal`
   * carries its own visibility, and a sheet with nothing in it is a sheet that
   * can be opened by a bug.
   */
  if (occurrence === null) return null;

  const parts = day ? dayParts(day) : null;
  const when = occurrence.allDay
    ? 'All day'
    : occurrence.startTime
      ? `${formatClock(occurrence.startTime)}${
          occurrence.endTime && occurrence.endTime !== occurrence.startTime
            ? ` until ${formatClock(occurrence.endTime)}`
            : ''
        }`
      : '';

  return (
    <Sheet
      open
      onClose={onClose}
      label={occurrence.title}
      header={
        <View style={{ flexDirection: 'row', gap: theme.space.sm }}>
          <View style={{ flex: 1, gap: theme.space.xs }}>
            <Heading color={tintFor(kindOf(occurrence), theme)}>{occurrence.title}</Heading>
            {parts ? (
              <Small color={theme.color.inkSoft}>
                {parts.weekday} {parts.month} {parts.dayOfMonth}
                {when === '' ? '' : ` · ${when}`}
              </Small>
            ) : null}
          </View>
          <Close onPress={onClose} what={occurrence.title} />
        </View>
      }
    >

      {occurrence.imageUrl ? (
        <Image
          source={{ uri: occurrence.imageUrl }}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          contentFit="cover"
          style={{
            width: '100%',
            height: 160,
            borderRadius: theme.radius.md,
            backgroundColor: theme.color.paperSunken,
          }}
        />
      ) : null}

      <View style={{ gap: theme.space.sm }}>
        {/*
          * Above the facts, because it is the one thing in this sheet that is
          * an *action* rather than a reading of the event. Renders nothing at
          * all when calendar reminders are switched off — see its header.
          */}
        <RemindAboutThis occurrence={occurrence} />

        {occurrence.location !== '' ? <Fact term="Where" detail={occurrence.location} /> : null}
        {occurrence.description !== '' ? <Fact term="Notes" detail={occurrence.description} /> : null}
        {occurrence.contact ? <ContactFact contact={occurrence.contact} /> : null}

        {occurrence.link ? (
          <View style={{ gap: theme.space.xs }}>
            <Label>Link</Label>
            {/* Opened in the in-app browser rather than handed to Safari: it
                comes back to the calendar, which is where the reader was. */}
            <Pressable
              onPress={() => void WebBrowser.openBrowserAsync(occurrence.link?.url ?? '')}
              accessibilityRole="link"
              accessibilityLabel={occurrence.link.label}
            >
              <Body color={theme.color.accent}>{occurrence.link.label}</Body>
            </Pressable>
          </View>
        ) : null}

        {occurrence.href && onOpenPage ? (
          <View style={{ gap: theme.space.xs }}>
            <Label>Page</Label>
            <Pressable
              onPress={() => {
                onOpenPage(occurrence.href ?? '');
                onClose();
              }}
              accessibilityRole="link"
            >
              <Body color={theme.color.accent}>Read more about this</Body>
            </Pressable>
          </View>
        ) : null}

        {!hasAnything(occurrence) && !mayEdit ? (
          <Small color={theme.color.inkFaint}>Nothing more is recorded about this one.</Small>
        ) : null}
      </View>

      {mayEdit ? (
        <DetailForm
          occurrence={occurrence}
          detail={detail}
          onChanged={onChanged}
          onDone={onClose}
        />
      ) : null}
    </Sheet>
  );
}

/** Whether the sheet has anything to say beyond the title and the time. */
function hasAnything(occurrence: CalendarOccurrence): boolean {
  return (
    occurrence.location !== '' ||
    occurrence.description !== '' ||
    occurrence.contact !== null ||
    occurrence.link !== null ||
    occurrence.href !== null
  );
}

function Fact({ term, detail }: { term: string; detail: string }) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.space.xs }}>
      <Label>{term.toUpperCase()}</Label>
      <Body color={theme.color.inkSoft}>{detail}</Body>
    </View>
  );
}

function ContactFact({ contact }: { contact: string }) {
  const theme = useTheme();
  const [name, phone] = contact.split(' · ');

  return (
    <View style={{ gap: theme.space.xs }}>
      <Label>CONTACT</Label>
      {phone ? (
        <Pressable
          onPress={() => void Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`)}
          accessibilityRole="button"
          accessibilityLabel={`Call ${name ?? ''} on ${phone}`}
        >
          <Body color={theme.color.inkSoft}>
            {name} · <Body color={theme.color.accent}>{phone}</Body>
          </Body>
        </Pressable>
      ) : (
        <Body color={theme.color.inkSoft}>{contact}</Body>
      )}
    </View>
  );
}

/**
 * The staff editing form.
 *
 * Title and time are shown above and are **not** fields. They belong to
 * whichever source the occurrence came from, and an app that quietly disagreed
 * with Breeze about when the Liturgy starts would be worse than one that says
 * less. What is editable is what no source supplies.
 */
function DetailForm({
  occurrence,
  detail,
  onChanged,
  onDone,
}: {
  occurrence: CalendarOccurrence;
  detail: CalendarDetail | null;
  onChanged: () => void;
  onDone: () => void;
}) {
  const theme = useTheme();

  const [draft, setDraft] = useState<CalendarDetail>(
    detail ?? { ...EMPTY_CALENDAR_DETAIL, occurrenceId: occurrence.id },
  );
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  /*
   * A different occurrence in the same sheet is a different draft. Adjusted
   * during render rather than in an effect, which is React's own shape for
   * resetting state when a prop changes — and here it matters more than usual,
   * because an effect would leave one frame in which the form on screen is the
   * *previous* entry's notes over this entry's title.
   */
  const [draftFor, setDraftFor] = useState(occurrence.id);
  if (draftFor !== occurrence.id) {
    setDraftFor(occurrence.id);
    setDraft(detail ?? { ...EMPTY_CALENDAR_DETAIL, occurrenceId: occurrence.id });
    setProblem(null);
  }

  const set = (field: keyof CalendarDetail) => (value: string) =>
    setDraft((current) => ({ ...current, [field]: value }));

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setProblem(null);
    try {
      await action();
      onChanged();
    } catch (error) {
      // The raw message: whoever sees this is the person who can fix it, and a
      // rules refusal reads very differently from a network failure.
      setProblem(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  const linkIsBad = draft.linkUrl !== '' && !isSafeLink(draft.linkUrl);

  return (
    <View style={{ gap: theme.space.sm, borderTopWidth: 1, borderTopColor: theme.color.rule, paddingTop: theme.space.md }}>
      <Label>Details</Label>
      <Small color={theme.color.inkFaint}>
        Anyone can see these. The title and the time come from{' '}
        {occurrence.source === 'manual' ? 'this entry' : sourceName(occurrence.source)} and are not
        edited here.
      </Small>

      <Field
        label="Note"
        value={draft.note}
        onChange={set('note')}
        placeholder="Bring a jacket — we are in the hall this week."
        lines={2}
      />
      <Field
        label="Where"
        value={draft.location}
        onChange={set('location')}
        placeholder="Church hall, lower level"
      />

      <Pair>
        <Field
          label="Contact"
          value={draft.contactName}
          onChange={set('contactName')}
          placeholder="Servant Michael"
        />
        <Field
          label="Phone"
          value={draft.contactPhone}
          onChange={set('contactPhone')}
          placeholder="(508) 555-0142"
          keyboard="phone-pad"
        />
      </Pair>

      <Field
        label="Link"
        value={draft.linkUrl}
        onChange={set('linkUrl')}
        placeholder="https://zoom.us/j/…"
        keyboard="url"
        invalid={linkIsBad}
      />
      <Field
        label="Link text"
        value={draft.linkLabel}
        onChange={set('linkLabel')}
        placeholder="Join on Zoom"
        hint="Left blank, the link is named after its address."
      />

      {linkIsBad ? <Problem>A link has to start with http:// or https://.</Problem> : null}
      {problem ? <Problem>{problem}</Problem> : null}

      <Button
        label={busy ? 'Saving…' : 'Save details'}
        busy={busy}
        disabled={linkIsBad}
        onPress={() =>
          void run(async () => {
            const { occurrenceId: _ignored, ...rest } = draft;
            await saveCalendarDetail(occurrence.id, rest);
            onDone();
          })
        }
      />

      {detail ? (
        <Button
          label="Clear details"
          tone="quiet"
          disabled={busy}
          onPress={() => void run(() => removeCalendarDetail(occurrence.id))}
        />
      ) : null}

      {/*
        Only for `manual`. Everything else was read from somewhere the church
        maintains separately, and deleting a liturgy here would not delete it
        from Breeze — it would make the app disagree until the next read put it
        back. See packages/shared/src/schema/scheduleAdmin.ts.
      */}
      {occurrence.source === 'manual' ? (
        <Button
          label="Remove this entry"
          tone="danger"
          disabled={busy}
          onPress={() =>
            void run(async () => {
              await removeScheduleEntry(occurrence.id);
              onDone();
            })
          }
        />
      ) : null}
    </View>
  );
}

function sourceName(source: CalendarOccurrence['source']): string {
  if (source === 'bulletin') return 'the weekly bulletin';
  if (source === 'feature') return "the event's own page";
  return 'the church calendar in Breeze';
}
