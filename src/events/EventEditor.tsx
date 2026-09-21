/**
 * The event page, editable.
 *
 * ## The rule this is built to
 *
 * **The editor is the page with editable words in it, not the page with a form
 * over it.** The title is where the title was. The date line is where the date
 * line was. The description is the paragraph. Where a control has to exist that
 * the page has no place for — a category, a sign-up link — it goes below, in a
 * fold, and is named as something the page does not show. That is the website's
 * rule, and Tommy's words for it: *"i don't even want an admin page i'm talking
 * about the edit in place on the page."*
 *
 * It is also already this app's pattern. The shop is edited on its cards and
 * the forms hub on its rows, both for the reason `ManageBar` gives: in-place
 * editing is what lets one screen be both the parishioner's and the office's,
 * instead of a second list of the same things in a different vocabulary.
 *
 * ## Typing is the save, and there is nothing else
 *
 * No Save button, no Publish button, no draft. Keystrokes are written to the
 * event a second after they stop, and that is the entire model. What it costs,
 * since nothing on the screen says it: there is no undo, and the website reads
 * this same document, so a mistyped title is the parish's title about a second
 * later. The mechanics are in `useAutosave` and the trade is argued in
 * `adminData.ts`.
 *
 * ## What the website's copy has here that this does not
 *
 * **A re-read on the way in.** Over there the page's HTML is baked at build
 * time, so the editor opens on a copy that may be days old and has to fetch the
 * document again before it dares write every field back. This app reads
 * Firestore to draw the page in the first place, seconds ago, so the row it is
 * handed *is* the fresh read.
 *
 * **Delete, and its undo window.** Deliberately absent — see `adminData.ts`.
 * The only way to take an event off the website is to delete it, that cannot be
 * undone once the window passes, and a bin on a phone is a bin pressed by
 * accident. It stays in the browser.
 */
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';

/*
 * The form model is `@spsm/shared`'s, not this folder's: the website's editor
 * reads the same one, so "what counts as a mistake" has one answer rather than
 * two that drift. What stays here is the drawing.
 */
import {
  EVENT_AUDIENCE_LABELS,
  EVENT_AUDIENCE_OPTIONS,
  EVENT_CATEGORY_LABELS,
  EVENT_CATEGORY_OPTIONS,
  applyDraft,
  eventMistakes,
  eventStillMissing,
  eventToForm,
  formToDraft,
  startInstantOf,
  type EventFieldKey,
  type EventFormState,
} from '@spsm/shared';

import { Field, Picker } from '@/components/Fields';
import { Icon } from '@/components/Icon';
import { Button } from '@/components/Surface';
import { Label, Micro, Small } from '@/components/Type';
import { storageUrl } from '@/gallery/media';
import { useTheme } from '@/theme/ThemeProvider';

import { removeEventFile, updateEvent, uploadEventHero } from './adminData';
import type { EventDoc } from './data';
import { useAutosave, type AutosaveState } from './useAutosave';
import { WhenFields } from './WhenFields';

const HERO_HEIGHT = 200;

/** What the photograph is doing, when it is doing anything worth saying. */
type HeroStatus =
  | { kind: 'idle' }
  | { kind: 'working'; what: string }
  | { kind: 'problem'; message: string };

export function EventEditor({
  event,
  onSaved,
  onDone,
}: {
  event: EventDoc;
  /** Hands each saved row up, so the page underneath is never a step behind. */
  onSaved: (event: EventDoc) => void;
  onDone: () => void;
}) {
  const theme = useTheme();

  const [form, setForm] = useState<EventFormState>(() => eventToForm(event));
  const [hero, setHero] = useState<HeroStatus>({ kind: 'idle' });
  const [more, setMore] = useState(false);
  const [tag, setTag] = useState('');

  const set = useCallback(<K extends keyof EventFormState>(key: K, value: EventFormState[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }));
  }, []);

  /* ---- autosave ------------------------------------------------------- */

  const save = useCallback(
    async (value: EventFormState) => {
      const draft = formToDraft(value);
      if (!draft) return;
      await updateEvent(event.id, draft);
      /*
       * The page under the editor is told what was written rather than made to
       * read it back. `updateEvent` stamps `updatedAt` with a server timestamp,
       * so a re-read would be a round trip for the one field nothing here
       * shows — and every value that *is* shown is one that was just sent.
       */
      onSaved(applyDraft(event, draft));
    },
    [event, onSaved],
  );

  const autosave = useAutosave({
    value: form,
    save,
    enabled: true,
    hold: startInstantOf(form) ? null : 'Waiting for a date it can be saved with',
  });

  /* ---- what is wrong with it ------------------------------------------ */

  /*
   * Two lists. `mistakes` are wrong — an end before a start, a link that is not
   * a link — and are drawn on the field they belong to. `stillMissing` are
   * things an unfinished event has not got round to, and are said once, in the
   * bar, in the ordinary voice. Nothing is blocked by either, because saving is
   * not an action any more.
   */
  const wrong = useMemo(() => eventMistakes(form), [form]);
  const missing = useMemo(() => eventStillMissing(form), [form]);
  const errorOf = useCallback(
    (field: EventFieldKey): string | null =>
      wrong.find((problem) => problem.field === field)?.message ?? null,
    [wrong],
  );

  /* ---- the photograph -------------------------------------------------- */

  /**
   * Write the form, and then tidy up the file it stopped pointing at.
   *
   * In that order, always. Deleting first and saving second leaves the page
   * showing a photograph that is already gone from the bucket if the write
   * fails — a broken image, which reads as a fault in the app rather than as
   * the removal somebody asked for.
   */
  const settleHero = useCallback(
    async (next: EventFormState, discard: string | null) => {
      setForm(next);

      /*
       * The one state in which this cannot finish. `formToDraft` answers null while
       * the date field is empty mid-retype, so the write would be a no-op and
       * deleting the old file would strand the document pointing at nothing.
       * The picture still leaves the page — that is what was asked for, and it
       * is saved as soon as the date is typed — but the file stays, and the
       * person is told rather than left to find out.
       */
      if (!formToDraft(next)) {
        setHero({
          kind: 'problem',
          message:
            'Taken off the page. The old file stays in storage until this event has a date it ' +
            'can be saved with.',
        });
        return;
      }

      try {
        await save(next);
        // Autosave's record is advanced by hand, or it sees a form that differs
        // from what it believes is written and immediately writes it again.
        autosave.markSaved(next);
        setHero({ kind: 'idle' });
      } catch (error) {
        setHero({ kind: 'problem', message: messageOf(error, 'That could not be saved.') });
        return;
      }

      if (!discard || discard === next.heroImagePath) return;
      try {
        await removeEventFile(discard);
      } catch (error) {
        /*
         * Said out loud rather than logged. A removal that only half happened
         * has to be visible to the person who asked for it, and the sentence
         * has to say which half worked — the old file is still served at the
         * URL it was shared under until somebody opens this event in a browser,
         * where the website's own sweep will collect it.
         */
        setHero({
          kind: 'problem',
          message: `The event is saved, but the old photograph is still in storage: ${messageOf(
            error,
            'it could not be deleted',
          )}`,
        });
      }
    },
    [autosave, save],
  );

  const pickHero = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setHero({
        kind: 'problem',
        message:
          'SPSM Connect has not been given access to your photographs. Allow it in Settings, ' +
          'then try again.',
      });
      return;
    }

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      // Never `allowsEditing`. It forces a crop on iOS, and somebody who wanted
      // the whole photograph has no way back to it.
      quality: 1,
    });
    if (picked.canceled) return;

    const asset = picked.assets[0];
    if (!asset) return;

    setHero({ kind: 'working', what: 'Sending the photograph…' });
    const uploaded = await uploadEventHero(form.slug, asset);
    if (!uploaded.ok) {
      setHero({ kind: 'problem', message: uploaded.reason });
      return;
    }

    setHero({ kind: 'working', what: 'Saving…' });
    /*
     * Replacing is a removal too, and the old object goes. It used to be kept
     * on the website on the grounds that discarding the change would leave the
     * event pointing at a deleted file — there is nothing to discard now,
     * because the form is already on its way to the document.
     */
    await settleHero({ ...form, heroImagePath: uploaded.path }, form.heroImagePath);
  }, [form, settleHero]);

  const shot = storageUrl(form.heroImagePath);

  /* ---- the editor ------------------------------------------------------ */

  return (
    <>
      <StatusBar
        state={autosave.state}
        missing={missing.map((problem) => problem.message)}
        onDone={() => {
          // Flushed rather than trusted to the unmount handler, so Done is a
          // promise that what is on screen has been written.
          void autosave.flush().then(onDone);
        }}
      />

      <View style={{ gap: theme.space.xs }}>
        {shot ? (
          <Image
            source={{ uri: shot }}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            contentFit="cover"
            style={{
              width: '100%',
              height: HERO_HEIGHT,
              borderRadius: theme.radius.md,
              backgroundColor: theme.color.paperSunken,
            }}
          />
        ) : (
          <View
            style={{
              width: '100%',
              height: HERO_HEIGHT,
              borderRadius: theme.radius.md,
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: theme.color.rule,
              backgroundColor: theme.color.paperSunken,
              alignItems: 'center',
              justifyContent: 'center',
              gap: theme.space.xs,
            }}
          >
            <Icon name="photos" size={24} color={theme.color.inkFaint} />
            <Micro color={theme.color.inkFaint}>No photograph on this page</Micro>
          </View>
        )}

        <View style={{ flexDirection: 'row', gap: theme.space.sm }}>
          <View style={{ flex: 1 }}>
            <Button
              label={shot ? 'Replace photograph' : 'Add a photograph'}
              tone="quiet"
              busy={hero.kind === 'working'}
              onPress={() => void pickHero()}
            />
          </View>
          {shot ? (
            <View style={{ flex: 1 }}>
              <Button
                label="Remove"
                tone="quiet"
                busy={hero.kind === 'working'}
                onPress={() => void settleHero({ ...form, heroImagePath: null }, form.heroImagePath)}
              />
            </View>
          ) : null}
        </View>

        {hero.kind === 'working' ? <Micro color={theme.color.inkSoft}>{hero.what}</Micro> : null}
        {hero.kind === 'problem' ? (
          <Micro color={theme.color.accentStrong}>{hero.message}</Micro>
        ) : null}
      </View>

      <Field
        label="The name of this event"
        value={form.title}
        onChange={(next) => set('title', next)}
        placeholder="Name this event"
        error={errorOf('title')}
      />

      <WhenFields form={form} set={set} errorOf={errorOf} />

      <Field
        label="Where it is"
        value={form.locationName}
        onChange={(next) => set('locationName', next)}
        placeholder="Where is it?"
      />

      {/* The street address appears once there is somewhere to put it. An empty
          second field beside an empty first one is two questions where the page
          asks one. */}
      {form.locationName.trim() ? (
        <Field
          label="Street address"
          value={form.locationAddress}
          onChange={(next) => set('locationAddress', next)}
          placeholder="Street address, if it is not the church"
        />
      ) : null}

      <Field
        label="Description"
        value={form.body}
        onChange={(next) => set('body', next)}
        placeholder="What is it, who is it for, what should somebody bring?"
        lines={8}
        hint="A blank line starts a new paragraph. *italic* and **bold** work."
        error={errorOf('body')}
      />

      {/* Edited here and shown nowhere on this page. Said so, rather than left
          as a field whose effect is invisible from where you are standing. */}
      <Field
        label="One line for the calendar"
        value={form.summary}
        onChange={(next) => set('summary', next.slice(0, 200))}
        placeholder="A six-week introduction to writing icons."
        lines={2}
        hint={`Not shown on this page — it is what the calendar and the home screen print. ${
          200 - form.summary.length
        } characters left.`}
        error={errorOf('summary')}
      />

      <Fold
        title="Filing and sign-ups"
        value={`${EVENT_CATEGORY_LABELS[form.category]} · ${EVENT_AUDIENCE_LABELS[
          form.audience
        ].toLowerCase()}${
          form.tags.length > 0
            ? ` · ${form.tags.length} ${form.tags.length === 1 ? 'tag' : 'tags'}`
            : ''
        }`}
        open={more}
        onToggle={() => setMore((was) => !was)}
      >
        <Picker
          label="What kind of event is it?"
          value={form.category}
          options={EVENT_CATEGORY_OPTIONS}
          onChange={(next) => set('category', next as EventFormState['category'])}
        />

        {/*
          Carried because the field is on the document and the website writes
          it — not because it does anything. Nothing on either surface reads
          `audience`: the servants' own schedule is the separate
          `servantEvents` collection, guarded by a path rule, and everything in
          `events` is world-readable. The website's hint here promises that
          servants-only events never reach the public calendar, and that
          promise is not kept by any code. So this one says what is true.
        */}
        <Picker
          label="Who is it for?"
          value={form.audience}
          options={EVENT_AUDIENCE_OPTIONS}
          onChange={(next) => set('audience', next as EventFormState['audience'])}
          hint="Filing only. Every event on this page is public — the servants’ own schedule is kept somewhere else entirely."
        />

        <Tags
          tags={form.tags}
          draft={tag}
          onDraft={setTag}
          onChange={(next) => set('tags', next)}
        />

        <Field
          label="Sign-up link"
          value={form.registrationUrl}
          onChange={(next) => set('registrationUrl', next)}
          placeholder="https://…"
          keyboard="url"
          hint="An external sign-up page. A form built in this app cannot be linked here yet."
          error={errorOf('registrationUrl')}
        />

        <Field
          label="Online link"
          value={form.meetingUrl}
          onChange={(next) => set('meetingUrl', next)}
          placeholder="https://…"
          keyboard="url"
          hint="For an event people can join remotely."
          error={errorOf('meetingUrl')}
        />

        {/* Shown and not editable. Changing it while standing on the page it
            names would move the page out from under you, and it is the address
            anything already shared points at. */}
        <Micro color={theme.color.inkFaint}>
          This page is at /events/{form.slug}. A web address cannot be changed once an event
          exists — every link already shared points at it.
        </Micro>
      </Fold>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* The bar                                                                    */
/* -------------------------------------------------------------------------- */

/** How the autosave state reads to a person. */
function statusOf(state: AutosaveState): { text: string; tone: 'quiet' | 'ok' | 'warn' | 'bad' } | null {
  switch (state.kind) {
    case 'saving':
    case 'pending':
      // Both are "Saving…" deliberately. The difference between "waiting for
      // you to stop typing" and "writing" is the hook's business, not the
      // reader's, and two words for it invite the question of which is which.
      return { text: 'Saving…', tone: 'quiet' };
    case 'saved':
      return { text: 'Saved', tone: 'ok' };
    case 'held':
      return { text: state.why, tone: 'warn' };
    case 'error':
      return { text: state.message, tone: 'bad' };
    case 'clean':
      return null;
  }
}

/**
 * Whether the typing has landed, and the way out.
 *
 * At the top of the screen rather than floating over the bottom of it, which is
 * where the website puts the same bar. Two reasons, and neither is taste: this
 * screen is one long `ScrollView` and a pinned overlay would have to be
 * positioned outside it, and the control it replaces — "Edit this page" — was
 * in exactly this spot a moment ago, so Done appears under the thumb that
 * pressed Edit.
 */
function StatusBar({
  state,
  missing,
  onDone,
}: {
  state: AutosaveState;
  missing: string[];
  onDone: () => void;
}) {
  const theme = useTheme();
  const status = statusOf(state);

  const color =
    status?.tone === 'ok'
      ? theme.color.ink
      : status?.tone === 'bad' || status?.tone === 'warn'
        ? theme.color.accentStrong
        : theme.color.inkSoft;

  return (
    <View
      style={{
        gap: theme.space.sm,
        padding: theme.space.sm,
        borderRadius: theme.radius.sm,
        borderWidth: 1,
        borderColor: theme.color.rule,
        backgroundColor: theme.color.paperSunken,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
        {/*
          Announced politely, so a screen reader says "Saved" without
          interrupting itself mid-word on every keystroke.
        */}
        <View style={{ flex: 1 }} accessibilityLiveRegion="polite">
          <Small color={color}>{status?.text ?? 'Editing this page'}</Small>
        </View>
        <Button label="Done" onPress={onDone} />
      </View>

      {missing.length > 0 ? (
        // One sentence rather than a list. Two items is the most there can be.
        <Micro color={theme.color.inkSoft}>Still to write: {missing.join(' and ')}.</Micro>
      ) : null}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Two small controls the app did not already have                            */
/* -------------------------------------------------------------------------- */

/**
 * A section that is shut until somebody wants it, with its current value on the
 * closed row.
 *
 * The value is the point. A fold whose closed state says only "Filing and
 * sign-ups" makes somebody open it to find out whether anything in it needs
 * attention; one that says "Festival · the whole church · 2 tags" answers that
 * from outside.
 */
function Fold({
  title,
  value,
  open,
  onToggle,
  children,
}: {
  title: string;
  value: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.space.sm }}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={title}
        accessibilityValue={{ text: value }}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space.sm,
          minHeight: 44,
          paddingHorizontal: theme.space.sm,
          borderRadius: theme.radius.sm,
          borderWidth: 1,
          borderColor: theme.color.rule,
          backgroundColor: pressed ? theme.color.accentSoft : 'transparent',
        })}
      >
        <View style={{ flex: 1, gap: 2, paddingVertical: theme.space.xs }}>
          <Label>{title.toUpperCase()}</Label>
          <Micro color={theme.color.inkSoft}>{value}</Micro>
        </View>
        <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
          <Icon name="chevron" size={16} color={theme.color.inkFaint} />
        </View>
      </Pressable>

      {open ? <View style={{ gap: theme.space.md }}>{children}</View> : null}
    </View>
  );
}

/**
 * Tags, as a real list rather than a comma-separated string.
 *
 * The website's `TagField` takes each one on Enter. A phone keyboard's return
 * key is not reliably in reach inside a scrolling form, so the same job is done
 * by a button beside the box — and the tags themselves are chips that can be
 * taken off one at a time, which is the half that a text field cannot do at all
 * without somebody counting commas.
 */
function Tags({
  tags,
  draft,
  onDraft,
  onChange,
}: {
  tags: string[];
  draft: string;
  onDraft: (next: string) => void;
  onChange: (next: string[]) => void;
}) {
  const theme = useTheme();

  const add = () => {
    const cleaned = draft.trim().toLowerCase();
    // Silently ignored rather than refused: a duplicate is not a mistake worth
    // a sentence, and the tag is already on the row above where they can see it.
    if (cleaned && !tags.includes(cleaned)) onChange([...tags, cleaned]);
    onDraft('');
  };

  return (
    <View style={{ gap: theme.space.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: theme.space.sm }}>
        <Field
          label="Tags"
          value={draft}
          onChange={onDraft}
          placeholder="youth"
          autoCapitalize="none"
          hint="For grouping and filtering. Nothing on the page shows them."
        />
        <View style={{ paddingBottom: 18 }}>
          <Button label="Add" tone="quiet" onPress={add} disabled={!draft.trim()} />
        </View>
      </View>

      {tags.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.xs }}>
          {tags.map((one) => (
            <Pressable
              key={one}
              onPress={() => onChange(tags.filter((entry) => entry !== one))}
              accessibilityRole="button"
              accessibilityLabel={`Remove the tag ${one}`}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.space.xs,
                paddingHorizontal: theme.space.sm,
                paddingVertical: theme.space.xs,
                minHeight: 32,
                borderRadius: theme.radius.full,
                borderWidth: 1,
                borderColor: theme.color.rule,
                backgroundColor: pressed ? theme.color.accentSoft : 'transparent',
              })}
            >
              <Micro color={theme.color.ink}>{one}</Micro>
              <Icon name="close" size={10} color={theme.color.inkFaint} />
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
