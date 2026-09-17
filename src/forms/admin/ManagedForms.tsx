/**
 * The forms hub, in the office's hands: the same cards, with what the church
 * controls about each one underneath it.
 *
 * ---------------------------------------------------------------------------
 * This was a screen of its own — `FormsAdmin`, at `/forms/admin` — and the
 * reason it is not any more is that it drew a *second* list of the same seven
 * forms: titles and slugs in plain rows, with none of the photographs that are
 * most of what a card is. So the one question a volunteer actually has when
 * they publish something — does this card look right on the page — was the one
 * question the screen for publishing it could not answer.
 *
 * Now the answer is the page. `CardMedia` here is the same component the
 * parishioner's card uses, not a second rendering of it, so what is under the
 * tickboxes cannot drift from what a parishioner sees.
 *
 * The website reached the same place from the other direction: there this is a
 * drawer *over* `/forms`, with the page still behind it. See `ManageBar` for
 * why the app cannot copy the drawer and what it does instead.
 *
 * ## What is a tick here and what is a screen
 *
 * A tick is one field on one document — published, open, which one the tag
 * opens. All three are facts about the list, they are written the moment they
 * are pressed, and they belong beside the card they describe.
 *
 * Everything with a shape of its own is still a pushed screen: the questions
 * (the builder), the answers (submissions), an import. `ManageBar` has the
 * reasoning.
 *
 * ## Unpublished forms appear here and nowhere else
 *
 * The hub subscribes to `watchPublishedForms`, because that is what a
 * parishioner may see. This reads `readAllForms`, because a form you cannot see
 * is exactly the one you came here to publish. That is also why the two lists
 * are not the same array with a filter over it — they are two different
 * questions answered by two different reads, and the grant is what separates
 * them.
 * ---------------------------------------------------------------------------
 */
import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import {
  DEFAULT_FORMS_PAGE_CONFIG,
  NO_PAYMENT,
  isBuiltInForm,
  keepsNoSubmissions,
  toFormSlug,
  type FormDefinition,
  type FormDraft,
  type FormsPageConfig,
} from '@spsm/shared';

import { Check, Problem } from '@/components/Fields';
import { Reorder } from '@/components/Reorder';
import { Button, Card } from '@/components/Surface';
import { Body, Heading, Label, Micro, Small } from '@/components/Type';
import { useTheme } from '@/theme/ThemeProvider';

import { CardMedia, toCard } from '../FormsHub';
import { readAllForms, readFormsPageConfig, type WithId } from '../data';
import {
  deleteForm,
  setFormFlags,
  setFormOrder,
  setFormsPageConfig,
  writeForm,
} from '../adminData';
import { ManageBar } from './ManageBar';

const KIND_LABEL: Record<FormDefinition['kind'], string> = {
  native: 'built here',
  embed: 'shown here, answers stay with the host',
  external: 'links out',
  vehicle: 'vehicle registration',
};

/**
 * Forms that cannot be unpublished or deleted from here.
 *
 * The two built-ins, plus the vehicle registration by kind — the car park tags
 * and the church's own links point at them, and `firestore.rules` refuses the
 * delete as well. The list withholding the control is the courtesy; the rule is
 * the thing that holds.
 */
function isPermanent(form: WithId<FormDefinition>): boolean {
  return isBuiltInForm(form.id) || form.kind === 'vehicle';
}

/**
 * Whether a tap on the tag opens this row's form.
 *
 * The website's `isTapDestination`, and its note is worth carrying because the
 * comparison looks wrong until you know why it is not:
 *
 * Compares on **slug**, because that is what the setting stores and what the
 * camp — which has no document in `forms` and so no id there — can be named by.
 * A form whose slug was edited in the builder stops matching, and that is the
 * honest answer rather than a bug: the setting names an address, and the
 * address changed. The list draws a warning above itself when nothing matches,
 * and the app and the site both fall back to the vehicle registration
 * meanwhile.
 *
 * `published` is in the test rather than only in the control's `disabled`, so
 * that unpublishing the destination makes the tick go out and the warning
 * appear. A tick left on a form `formSubmit` answers 404 to would be this
 * screen asserting something untrue.
 */
function isTapDestination(form: WithId<FormDefinition>, config: FormsPageConfig): boolean {
  return form.published && form.slug === config.nfcFormSlug;
}

export function ManagedForms({
  managing,
  onManaging,
}: {
  managing: boolean;
  onManaging: (next: boolean) => void;
}) {
  const theme = useTheme();
  const router = useRouter();
  const [forms, setForms] = useState<WithId<FormDefinition>[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  /*
   * The office's two settings, of which this draws one.
   *
   * Seeded with the defaults rather than null, so there is no frame where the
   * tag's destination is unknown and every tick is drawn unticked: the default
   * *is* the answer on a parish that has never set it — the vehicle
   * registration, what the tag in the car park has always opened.
   */
  const [config, setConfig] = useState<FormsPageConfig>(DEFAULT_FORMS_PAGE_CONFIG);

  const refresh = useCallback(async () => {
    try {
      /*
       * Both reads together, because the tick on a row is a fact about the pair
       * — `isTapDestination` compares a form's slug against the setting — and
       * two awaits in sequence would draw the list once against the previous
       * setting. `readFormsPageConfig` resolves its own failures to the
       * defaults and never rejects, so only the forms read can land in `catch`.
       */
      const [rows, settings] = await Promise.all([readAllForms(), readFormsPageConfig()]);
      setForms(rows);
      setConfig(settings);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The forms could not be read.');
    }
  }, []);

  /*
   * On focus rather than on mount: the builder is a screen away, and coming
   * back from it with the old titles on screen would make a save look lost.
   *
   * It runs whether or not the mode is on, which is cheap and buys one thing —
   * pressing Manage forms shows the list immediately rather than showing an
   * empty page and then filling it in.
   */
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  async function create() {
    const id = `form-${Date.now().toString(36)}`;
    try {
      await writeForm(id, blankForm(id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That form could not be created.');
      return;
    }
    await refresh();
    router.push(`/forms/admin/${id}` as never);
  }

  /**
   * Take the row at `from` out and put it back at `to`, then renumber.
   *
   * `to` is the position after the removal, which is what `Reorder` documents
   * and what makes "move the last form to the top" `to === 0`.
   *
   * Optimistic: the drag has already animated the row into the gap by the time
   * this is called, so a list that waited for Firestore before re-rendering
   * would snap the row back to where it came from and then move it again when
   * the write landed.
   */
  async function move(from: number, to: number) {
    if (!forms) return;

    const next = [...forms];
    const [row] = next.splice(from, 1);
    if (!row) return;
    next.splice(to, 0, row);

    setForms(next);
    await setFormOrder(
      next.map((form) => form.id),
      new Map(next.map((form) => [form.id, form.order])),
    );
    await refresh();
  }

  async function flag(id: string, flags: { published?: boolean; open?: boolean }) {
    try {
      await setFormFlags(id, flags);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That change was refused.');
    }
    await refresh();
  }

  /**
   * Point the tag at this form.
   *
   * Optimistic for the same reason `move` is: the tick has to come on under the
   * thumb, and the write is one field on one document. The re-read afterwards
   * is what makes a refused write correct itself rather than leaving a tick on
   * a row the tag does not actually open.
   */
  async function pointTagAt(slug: string) {
    setConfig((previous) => ({ ...previous, nfcFormSlug: slug }));
    try {
      await setFormsPageConfig({ nfcFormSlug: slug });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The tag could not be pointed there.');
    }
    await refresh();
  }

  async function destroy(id: string) {
    try {
      await deleteForm(id);
      setConfirming(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That form could not be deleted.');
    }
    await refresh();
  }

  return (
    <>
      <ManageBar
        managing={managing}
        onManaging={(next) => {
          // Leaving the mode closes a confirmation with it. A "delete for good"
          // left open behind a Done, waiting on the next visit, is a press
          // nobody would remember arming.
          if (!next) setConfirming(null);
          onManaging(next);
        }}
        onSubmissions={() => router.push('/forms/admin/submissions' as never)}
        onNewForm={() => void create()}
        onImport={() => router.push('/forms/admin/import' as never)}
      />

      {/* The bar is drawn in both modes; everything below it belongs to the
          mode. An error from a write is the exception — it is shown either way,
          because a refused write is worth reading after a Done. */}
      {error ? <Problem>{error}</Problem> : null}

      {!managing ? null : (
        <>
          {forms === null ? <Body color={theme.color.inkSoft}>Loading…</Body> : null}
          {forms !== null && forms.length === 0 ? (
            <Body color={theme.color.inkSoft}>No forms yet.</Body>
          ) : null}

          {/*
            The tap destination has no control of its own up here.
            --------------------------------------------------------------------
            The website's note, and the arrangement it argues for: the question
            "which form does the tag open" is asked *about a form*, and every
            other answer this list gives about a form — published, open — is a
            box on its row. A picker above the list would be a second place to
            look and a second vocabulary for one list.

            Only one box is ever ticked, and that is a property of the storage
            rather than of this screen policing it: the destination is one field
            naming one slug, so ticking a box is a single write naming the new
            form, and the box that was ticked before goes out because the
            document says something else now. There is no state where two are
            ticked, and none where a half-landed write leaves zero.

            This paragraph is the exception: it is drawn only when the stored
            destination is no published form on the list, which is the one state
            the boxes cannot express. Nothing is ticked, and without a sentence
            that reads as a bug rather than as a setting gone stale behind a
            rename.
          */}
          {forms !== null && !forms.some((form) => isTapDestination(form, config)) ? (
            <Problem>
              The NFC tag is set to open {config.nfcFormSlug}, which is not a published form
              any more. Until somebody ticks a box below, a tap opens the vehicle
              registration.
            </Problem>
          ) : null}

          <Reorder
            gap={theme.space.md}
            onMove={(from, to) => void move(from, to)}
            // A confirmation open on the row being carried would travel with
            // it, and a Delete button under a dragging finger is the last thing
            // this list should offer.
            onDragStart={() => setConfirming(null)}
            rows={(forms ?? []).map((form) => ({
              key: form.id,
              label: form.title,
              content: (
                <Card gap={theme.space.sm}>
                  {/*
                    The parishioner's own card, pressable, going to the builder.
                    Unpublished forms are drawn exactly like published ones —
                    the Published tick below is what says which is which, and
                    dimming the card would make the thing you came to publish
                    the hardest thing on the page to look at.
                  */}
                  <ManagedPlate
                    form={form}
                    onPress={() => router.push(`/forms/admin/${form.id}` as never)}
                  />

                  <Check
                    label="Published"
                    checked={form.published}
                    disabled={isPermanent(form)}
                    hint={
                      isPermanent(form)
                        ? 'Always on — the church’s own links and the car park tags use it.'
                        : undefined
                    }
                    onChange={(next) => void flag(form.id, { published: next })}
                  />
                  <Check
                    label="Accepting submissions"
                    checked={form.open}
                    onChange={(next) => void flag(form.id, { open: next })}
                  />

                  {/*
                    A tick and not a radio, which is the website's decision and
                    its words: a radio is *for* one-of-many and is deliberately
                    not what this is. A radio group has to be one group — one
                    name, one set of inputs — and these are scattered one per
                    row through a list whose rows can be dragged past each
                    other. The boxes above this one are tickboxes, and a circle
                    among them would read as a different kind of answer to the
                    same kind of question.
                  */}
                  <Check
                    label="Opens from the NFC tag"
                    checked={isTapDestination(form, config)}
                    /*
                     * A form nobody can see is not somewhere to send a tap:
                     * `formSubmit` answers 404 to an unpublished form, so the
                     * tag would open a page that refuses every submission with
                     * nothing on it to say why.
                     */
                    disabled={!form.published}
                    hint={
                      !form.published
                        ? 'Publish it first — a tap has to land on something that accepts answers.'
                        : isTapDestination(form, config)
                          ? 'Tick another form to move it.'
                          : undefined
                    }
                    onChange={(next) => {
                      /*
                       * Unticking is not an edit, it is an empty tag. The only
                       * way out of being the destination is for another form to
                       * become it, so the box does not come off — and it cannot
                       * be left looking off either, because the next read draws
                       * the stored answer.
                       */
                      if (!next) return;
                      void pointTagAt(form.slug);
                    }}
                  />

                  <View style={{ flexDirection: 'row', gap: theme.space.sm }}>
                    {keepsNoSubmissions(form.kind) ? null : (
                      <View style={{ flex: 1 }}>
                        <Button
                          label="Submissions"
                          tone="quiet"
                          onPress={() =>
                            router.push(`/forms/admin/submissions?formId=${form.id}` as never)
                          }
                        />
                      </View>
                    )}
                    {isPermanent(form) ? null : (
                      <View style={{ flex: 1 }}>
                        <Button
                          label="Delete…"
                          tone="danger"
                          onPress={() => setConfirming(form.id)}
                        />
                      </View>
                    )}
                  </View>

                  {/*
                    The confirmation is inline rather than an alert, and it says
                    what survives: a submission is a record of something that
                    happened, and somebody reaching for Delete usually wants
                    Unpublish.
                  */}
                  {confirming === form.id ? (
                    <Card gap={theme.space.sm}>
                      <Label>DELETE {form.title.toUpperCase()}?</Label>
                      <Small color={theme.color.inkSoft}>
                        The form and its questions go for good. Anything already sent in
                        through it stays — and will still be listed under this title. To take
                        it off the Forms tab and keep it, untick Published instead.
                      </Small>
                      <View style={{ flexDirection: 'row', gap: theme.space.sm }}>
                        <View style={{ flex: 1 }}>
                          <Button
                            label="Delete for good"
                            tone="danger"
                            onPress={() => void destroy(form.id)}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Button
                            label="Keep it"
                            tone="quiet"
                            onPress={() => setConfirming(null)}
                          />
                        </View>
                      </View>
                    </Card>
                  ) : null}
                </Card>
              ),
            }))}
          />

          <Small color={theme.color.inkFaint}>
            Deleting a form leaves its submissions in place — they are a record of something
            that happened. Unpublish instead to take a form off the app and the website while
            keeping it.
          </Small>
        </>
      )}
    </>
  );
}

/**
 * One form's card, as the office sees it: the parishioner's plate, and the two
 * facts they need that a parishioner does not.
 *
 * The slug and the kind, because "which of these is the one the car park card
 * points at" is answered by the address rather than by the title, and because
 * an `embed` and a `native` form look identical from outside and behave nothing
 * alike when a submission arrives.
 */
function ManagedPlate({
  form,
  onPress,
}: {
  form: WithId<FormDefinition>;
  onPress: () => void;
}) {
  const theme = useTheme();
  const card = toCard(form);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Edit ${form.title}`}
      style={({ pressed }) => ({
        borderRadius: theme.radius.sm,
        overflow: 'hidden',
        opacity: pressed ? 0.7 : 1,
        gap: theme.space.xs,
      })}
    >
      <CardMedia card={card} />
      <View style={{ gap: 2, paddingTop: theme.space.xs }}>
        <Heading>{form.title}</Heading>
        <Micro color={theme.color.inkFaint}>
          {`/forms/${form.slug} · ${KIND_LABEL[form.kind]}`}
          {form.payment.enabled ? ' · takes payment' : ''}
        </Micro>
      </View>
    </Pressable>
  );
}

/** A new form, in the shape the builder expects. Matches the website's `blankForm`. */
function blankForm(id: string): FormDraft {
  return {
    slug: toFormSlug(id),
    title: 'New form',
    blurb: '',
    icon: 'file',
    image: null,
    order: 100,
    published: false,
    open: true,
    closedMessage: null,
    kind: 'native',
    externalUrl: null,
    pushesToTaksis: false,
    fields: [],
    payment: { ...NO_PAYMENT },
    notifyEmails: [],
    confirmationMessage: 'Thank you — the church office has your submission.',
    confirmationEmailBody: '',
  };
}
