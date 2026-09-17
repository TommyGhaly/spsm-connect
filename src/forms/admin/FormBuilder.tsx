/**
 * Building a form, on a phone.
 *
 * A port of the website's `admin/FormBuilder.tsx` — the same settings, the same
 * question types, the same conditions, the same lint, and the same preview that
 * renders through the real `FieldInput` rather than a second implementation of
 * it. The one thing it cannot be is a wide two-column editor, so the sections
 * are stacked and a question opens in place.
 *
 * ## What is deliberately not editable here
 *
 * A built-in's slug (the car park tags and the church's own links point at it),
 * and the vehicle registration's questions (they are code, not fields — a
 * repeating driver list and a fixed colour set Taksis matches on).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import {
  MAX_FIELDS,
  isBuiltInForm,
  isChoiceField,
  isDecorative,
  isKnownFormHost,
  toFormSlug,
  visibleFields,
  type FieldCondition,
  type FormAnswers,
  type FormDraft,
  type FormField,
  type FormFieldType,
  type FormOption,
} from '@spsm/shared';

import { Check, Field, Pair, Picker, Problem, type ChoiceOption } from '@/components/Fields';
import { Icon } from '@/components/Icon';
import { Reorder } from '@/components/Reorder';
import { Button, Card, Screen } from '@/components/Surface';
import { Body, Heading, Label, Micro, Small } from '@/components/Type';
import { useTheme } from '@/theme/ThemeProvider';

import { FieldInput } from '../Fields';
import { readFormForEdit, writeForm } from '../adminData';
import type { WithId } from '../data';
import { PicturePicker } from './PicturePicker';

const TYPE_LABELS: Record<FormFieldType, string> = {
  shortText: 'Short text',
  longText: 'Paragraph',
  email: 'Email',
  phone: 'Phone',
  number: 'Number',
  date: 'Date',
  select: 'Dropdown',
  radio: 'Choose one',
  checkboxes: 'Choose any',
  consent: 'Agreement tickbox',
  heading: 'Section heading',
  photo: 'Photo upload',
};

const TYPE_OPTIONS: ChoiceOption[] = (Object.keys(TYPE_LABELS) as FormFieldType[]).map((type) => ({
  value: type,
  label: TYPE_LABELS[type],
}));

export function FormBuilder({ id }: { id: string }) {
  const theme = useTheme();
  const router = useRouter();
  const [draft, setDraft] = useState<WithId<FormDraft> | null>(null);
  const [missing, setMissing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    let cancelled = false;
    readFormForEdit(id)
      .then((form) => {
        if (cancelled) return;
        if (!form) {
          setMissing(true);
          return;
        }
        // The audit fields are not the builder's to set — `updatedAt` and
        // `updatedBy` are stamped on write and `createdAt` is read back — so
        // they are dropped on the way in rather than carried and rewritten.
        const { createdAt, updatedAt, updatedBy, ...rest } = form;
        void createdAt;
        void updatedAt;
        void updatedBy;
        setDraft(rest);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'That form could not be read.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const edit = useCallback((patch: Partial<FormDraft>) => {
    setDraft((previous) => (previous ? { ...previous, ...patch } : previous));
    setDirty(true);
  }, []);

  const setFields = useCallback((fields: FormField[]) => {
    setDraft((previous) => (previous ? { ...previous, fields } : previous));
    setDirty(true);
  }, []);

  const problems = useMemo(() => (draft ? lint(draft) : []), [draft]);

  async function save() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const { id: formId, ...rest } = draft;
      await writeForm(formId, rest);
      setDirty(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That did not save.');
    } finally {
      setSaving(false);
    }
  }

  if (missing) {
    return (
      <Screen>
        <Card>
          <Heading>That form is gone</Heading>
          <Body color={theme.color.inkSoft}>
            It was deleted, or it never existed. The list of forms is one step back.
          </Body>
        </Card>
      </Screen>
    );
  }

  if (!draft) {
    return (
      <Screen>
        {error ? <Problem>{error}</Problem> : <Body color={theme.color.inkSoft}>Loading…</Body>}
      </Screen>
    );
  }

  return (
    <Screen>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space.sm,
        }}
      >
        <View style={{ flex: 1 }}>
          <Micro color={dirty ? theme.color.accentStrong : theme.color.inkFaint}>
            {dirty ? 'Unsaved changes' : 'Saved'}
          </Micro>
        </View>
        <Button
          label={saving ? 'Saving…' : 'Save'}
          onPress={() => void save()}
          disabled={!dirty}
          busy={saving}
        />
      </View>

      {error ? <Problem>{error}</Problem> : null}

      {/*
        Advice, not a gate. Everything here is publishable in the state it is
        in — an empty form saved on the way to somewhere is a normal Tuesday —
        and a builder that refused to save would lose that work.
      */}
      {problems.length > 0 ? (
        <Card>
          <Label>WORTH CHECKING BEFORE YOU PUBLISH</Label>
          {problems.map((problem) => (
            <Small key={problem} color={theme.color.inkSoft}>
              {`• ${problem}`}
            </Small>
          ))}
        </Card>
      ) : null}

      <View style={{ flexDirection: 'row', gap: theme.space.sm }}>
        <View style={{ flex: 1 }}>
          <Button
            label="Build"
            tone={preview ? 'quiet' : 'primary'}
            onPress={() => setPreview(false)}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            label="Preview"
            tone={preview ? 'primary' : 'quiet'}
            onPress={() => setPreview(true)}
          />
        </View>
      </View>

      {preview ? (
        <Preview form={draft} />
      ) : (
        <>
          <Settings draft={draft} edit={edit} />

          {draft.kind === 'native' ? <FieldList draft={draft} setFields={setFields} /> : null}

          {draft.kind === 'embed' ? (
            <Body color={theme.color.inkSoft}>
              The host draws the questions on this one. There is nothing to build here, and no
              submissions arrive here either — the title, the blurb and the picture above are what
              the church controls.
            </Body>
          ) : null}

          {draft.kind === 'vehicle' ? (
            <Body color={theme.color.inkSoft}>
              The vehicle registration is built in code, not from fields — it has a repeating driver
              list and a fixed colour set that Taksis matches on. Its title, blurb and confirmation
              are editable above; its questions are not.
            </Body>
          ) : null}
        </>
      )}

      <Button label="All forms" tone="quiet" onPress={() => router.back()} />
    </Screen>
  );
}

/* -------------------------------------------------------------------------- */
/* The form itself                                                             */
/* -------------------------------------------------------------------------- */

function Settings({
  draft,
  edit,
}: {
  draft: WithId<FormDraft>;
  edit: (patch: Partial<FormDraft>) => void;
}) {
  const theme = useTheme();
  const builtIn = isBuiltInForm(draft.id);

  return (
    <View style={{ gap: theme.space.md }}>
      <Label>THE FORM</Label>

      <Field
        label="Title"
        value={draft.title}
        onChange={(title) => {
          // The address follows the title until somebody edits it by hand, and
          // never afterwards — renaming a form should not move it out from
          // under a link somebody has already sent.
          const following = !builtIn && draft.slug === toFormSlug(draft.title);
          edit(following ? { title, slug: toFormSlug(title) } : { title });
        }}
      />

      <Field
        label="Address"
        value={draft.slug}
        readOnly={builtIn}
        onChange={(slug) => edit({ slug: toFormSlug(slug) })}
        hint={
          builtIn
            ? `/forms/${draft.slug} — fixed. The car park tags and the church’s own links use it.`
            : `/forms/${draft.slug || '…'}`
        }
      />

      <Field
        label="Blurb"
        value={draft.blurb}
        onChange={(blurb) => edit({ blurb })}
        lines={2}
        hint="One or two sentences, shown on the card and above the form."
      />

      <PicturePicker
        value={draft.image}
        onChange={(image) => edit({ image })}
        formId={draft.slug || draft.id}
      />

      {/*
        The vehicle registration's kind is not offered as a choice. It is the
        only form that writes to Taksis, and that is a property of the code
        behind it rather than a setting.
      */}
      {draft.kind === 'vehicle' ? (
        <Body color={theme.color.inkSoft}>
          This form writes to the Taksis parking system. That cannot be changed here.
        </Body>
      ) : (
        <Picker
          label="Kind"
          value={draft.kind}
          options={[
            { value: 'native', label: 'Built here' },
            {
              value: 'embed',
              label: 'Shown on a page of ours (Tithe.ly, Breeze)',
            },
            { value: 'external', label: 'Links out' },
          ]}
          onChange={(kind) => edit({ kind: kind as FormDraft['kind'] })}
        />
      )}

      {draft.kind === 'external' ? (
        <Field
          label="Link"
          value={draft.externalUrl ?? ''}
          onChange={(url) => edit({ externalUrl: url.trim() || null })}
          placeholder="https://…"
          keyboard="url"
          hint="The card opens this in a browser. Answers go wherever the form is hosted."
        />
      ) : null}

      {draft.kind === 'embed' ? (
        <Field
          label="The form's address"
          value={draft.externalUrl ?? ''}
          onChange={(url) => edit({ externalUrl: url.trim() || null })}
          placeholder="https://stphilopaterstmina.breezechms.com/form/…"
          keyboard="url"
          hint="Framed inside our page. Answers are kept by the host and never reach the church — there is nothing to review here."
        />
      ) : null}

      <Check
        label="Published"
        checked={draft.published}
        onChange={(published) => edit({ published })}
      />
      <Check
        label="Accepting submissions"
        checked={draft.open}
        onChange={(open) => edit({ open })}
      />

      {!draft.open ? (
        <Field
          label="What a closed form says"
          value={draft.closedMessage ?? ''}
          onChange={(closedMessage) => edit({ closedMessage: closedMessage || null })}
          placeholder="Registration closed on 14 September."
          hint="The form still opens, and says this instead of the questions."
        />
      ) : null}

      <Label>AFTER IT IS SENT</Label>

      <Field
        label="Confirmation shown on screen"
        value={draft.confirmationMessage}
        onChange={(confirmationMessage) => edit({ confirmationMessage })}
        lines={2}
      />

      <Field
        label="Confirmation email"
        value={draft.confirmationEmailBody}
        onChange={(confirmationEmailBody) => edit({ confirmationEmailBody })}
        lines={3}
        placeholder="Leave empty to send nothing."
        hint="Sent only when the form asks for an email address. Leave empty for a form where a copy sitting in an inbox would be a privacy problem."
      />

      <Field
        label="Tell these addresses"
        value={draft.notifyEmails.join(', ')}
        onChange={(value) =>
          edit({
            notifyEmails: value
              .split(',')
              .map((entry) => entry.trim().toLowerCase())
              .filter((entry) => entry.includes('@')),
          })
        }
        placeholder="office@…, deacon@…"
        keyboard="email-address"
        hint="Comma separated. Empty means nobody is emailed when one arrives."
      />

      <Label>PAYMENT</Label>

      <Check
        label="This form takes a payment"
        checked={draft.payment.enabled}
        onChange={(enabled) => edit({ payment: { ...draft.payment, enabled } })}
      />

      {draft.payment.enabled ? (
        <>
          <Pair>
            <Field
              label="Base fee"
              value={dollars(draft.payment.baseCents)}
              onChange={(value) =>
                edit({
                  payment: { ...draft.payment, baseCents: toCents(value) },
                })
              }
              keyboard="numeric"
              hint="Charged on any submission. 0 to charge only for chosen options."
            />
            <Field
              label="Receipt says"
              value={draft.payment.label}
              onChange={(label) => edit({ payment: { ...draft.payment, label } })}
              placeholder={draft.title}
            />
          </Pair>
          <Small color={theme.color.inkFaint}>
            Options and number fields can add to this — set their prices below. The total is worked
            out again on the server from this saved definition, so what a screen displays can never
            change what a card is charged.
          </Small>
        </>
      ) : null}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Questions                                                                   */
/* -------------------------------------------------------------------------- */

function FieldList({
  draft,
  setFields,
}: {
  draft: WithId<FormDraft>;
  setFields: (fields: FormField[]) => void;
}) {
  const theme = useTheme();

  /*
   * Which question is open, by its key rather than its position.
   *
   * It was an index, and an index is wrong the moment the list can be
   * reordered: drag question five to the top and the editor that was open on
   * five is now open on whatever moved into fifth place, silently editing a
   * different question. The key survives a move and a removal, which are the
   * two things that renumber this list.
   */
  const [openKey, setOpenKey] = useState<string | null>(null);

  function add(type: FormFieldType) {
    const field = newField(type, draft.fields);
    setFields([...draft.fields, field]);
    setOpenKey(field.key);
  }

  /**
   * Take the question at `from` out and put it back at `to`.
   *
   * The one mutation the order needs, and both ways of reordering go through
   * it: the drag, and the grip's accessibility actions. `to` is the position
   * *after* the removal, which is what `Reorder` documents and what makes "move
   * the first question to the end" `fields.length - 1`.
   */
  function move(from: number, to: number) {
    const next = [...draft.fields];
    const [moved] = next.splice(from, 1);
    if (!moved) return;
    next.splice(to, 0, moved);
    setFields(next);
  }

  return (
    <View style={{ gap: theme.space.sm }}>
      <Label>QUESTIONS</Label>

      {draft.fields.length === 0 ? (
        <Body color={theme.color.inkSoft}>No questions yet.</Body>
      ) : (
        <Micro color={theme.color.inkFaint}>
          Hold a question&rsquo;s handle to pick it up, then drag it where it belongs.
        </Micro>
      )}

      <Reorder
        gap={theme.space.sm}
        onMove={move}
        // A question cannot be edited while it is being carried, and a text
        // input under a dragging finger fights the drag for the gesture.
        onDragStart={() => setOpenKey(null)}
        rows={draft.fields.map((field, index) => ({
          key: field.key,
          label: `${field.label || 'Untitled question'}, ${TYPE_LABELS[field.type]}`,
          content: (
            <Card gap={theme.space.sm}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: theme.space.xs,
                }}
              >
                <Pressable
                  style={{ flex: 1, gap: 2 }}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: openKey === field.key }}
                  accessibilityLabel={`${field.label || 'Untitled question'}, ${TYPE_LABELS[field.type]}`}
                  onPress={() => setOpenKey(openKey === field.key ? null : field.key)}
                >
                  <Small color={theme.color.ink}>{field.label || '(untitled)'}</Small>
                  <Micro color={theme.color.inkFaint}>
                    {[
                      TYPE_LABELS[field.type],
                      field.required ? 'required' : null,
                      field.showWhen ? 'conditional' : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Micro>
                </Pressable>

                {/* The two chevrons that used to sit here are gone: the grip on
                    the left is the way the order is changed now, and it carries
                    the same two moves as accessibility actions for anybody who
                    cannot drag. See `Reorder`. */}
                <Tool
                  label="Remove"
                  icon="close"
                  onPress={() => {
                    setFields(draft.fields.filter((_, position) => position !== index));
                    setOpenKey(null);
                  }}
                />
              </View>

              {openKey === field.key ? (
                <FieldEditor
                  field={field}
                  earlier={draft.fields.slice(0, index)}
                  paid={draft.payment.enabled}
                  onChange={(patch) =>
                    setFields(
                      draft.fields.map((entry, position) =>
                        position === index ? { ...entry, ...patch } : entry,
                      ),
                    )
                  }
                />
              ) : null}
            </Card>
          ),
        }))}
      />

      {draft.fields.length < MAX_FIELDS ? (
        <Picker
          label="Add a question"
          value=""
          placeholder="Choose a type…"
          options={TYPE_OPTIONS}
          onChange={(type) => {
            if (type) add(type as FormFieldType);
          }}
        />
      ) : null}
    </View>
  );
}

function FieldEditor({
  field,
  earlier,
  paid,
  onChange,
}: {
  field: FormField;
  /** Only earlier fields, because a condition may only point backwards. */
  earlier: FormField[];
  paid: boolean;
  onChange: (patch: Partial<FormField>) => void;
}) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.space.sm, paddingTop: theme.space.xs }}>
      <Field label="Label" value={field.label} onChange={(label) => onChange({ label })} />
      <Field
        label="Help text"
        value={field.help ?? ''}
        onChange={(help) => onChange({ help: help || null })}
      />

      {!isDecorative(field.type) ? (
        <Check
          label="Required"
          checked={field.required}
          onChange={(required) => onChange({ required })}
        />
      ) : null}

      {field.type === 'number' ? (
        <>
          <Pair>
            <Field
              label="Min"
              value={field.min === null ? '' : String(field.min)}
              onChange={(value) => onChange({ min: value === '' ? null : Number(value) })}
              keyboard="numeric"
            />
            <Field
              label="Max"
              value={field.max === null ? '' : String(field.max)}
              onChange={(value) => onChange({ max: value === '' ? null : Number(value) })}
              keyboard="numeric"
            />
          </Pair>
          {paid ? (
            <Field
              label="Price each"
              value={dollars(field.unitPriceCents)}
              onChange={(value) => onChange({ unitPriceCents: toCents(value) })}
              keyboard="numeric"
            />
          ) : null}
        </>
      ) : null}

      {isChoiceField(field.type) ? (
        <OptionsEditor field={field} paid={paid} onChange={onChange} />
      ) : null}

      <ConditionEditor field={field} earlier={earlier} onChange={onChange} />

      <Micro color={theme.color.inkFaint}>
        {/* The key is shown and never editable. Submissions are keyed by it and
            conditions point at it, so changing one orphans every answer already
            collected — which is why the builder generates one and leaves it. */}
        {`Key: ${field.key}`}
      </Micro>
    </View>
  );
}

function OptionsEditor({
  field,
  paid,
  onChange,
}: {
  field: FormField;
  paid: boolean;
  onChange: (patch: Partial<FormField>) => void;
}) {
  const theme = useTheme();

  function setOption(index: number, patch: Partial<FormOption>) {
    onChange({
      options: field.options.map((option, position) =>
        position === index ? { ...option, ...patch } : option,
      ),
    });
  }

  return (
    <View style={{ gap: theme.space.sm }}>
      <Label>OPTIONS</Label>

      {field.options.map((option, index) => (
        <View
          key={index}
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: theme.space.xs,
          }}
        >
          <Field
            label={`Option ${index + 1}`}
            value={option.label}
            onChange={(label) => {
              // The stored value follows the label only while nobody has
              // changed it by hand: it is what a submission records and what a
              // condition matches, so an edit to a label must not silently
              // orphan both.
              const following = option.value === toFormSlug(option.label);
              setOption(
                index,
                following ? { label, value: toFormSlug(label) || label } : { label },
              );
            }}
          />
          {paid ? (
            <View style={{ width: 96 }}>
              <Field
                label="Price"
                value={dollars(option.priceCents)}
                onChange={(value) => setOption(index, { priceCents: toCents(value) })}
                keyboard="numeric"
              />
            </View>
          ) : null}
          <Tool
            label={`Remove option ${index + 1}`}
            icon="close"
            onPress={() =>
              onChange({
                options: field.options.filter((_, position) => position !== index),
              })
            }
          />
        </View>
      ))}

      <Button
        label="Add option"
        tone="quiet"
        onPress={() =>
          onChange({
            options: [
              ...field.options,
              {
                value: `option-${field.options.length + 1}`,
                label: '',
                priceCents: 0,
              },
            ],
          })
        }
      />
    </View>
  );
}

/**
 * When a question appears.
 *
 * One condition against one earlier field, not a boolean tree — every real case
 * in the church's forms is exactly this shape, and a builder for arbitrary
 * AND/OR is a builder nobody in the office can use.
 */
function ConditionEditor({
  field,
  earlier,
  onChange,
}: {
  field: FormField;
  earlier: FormField[];
  onChange: (patch: Partial<FormField>) => void;
}) {
  const theme = useTheme();
  const condition = field.showWhen;
  const candidates = earlier.filter((candidate) => !isDecorative(candidate.type));
  const target = candidates.find((candidate) => candidate.key === condition?.field);

  return (
    <View style={{ gap: theme.space.sm }}>
      <Check
        label="Only show this when…"
        checked={condition !== null}
        disabled={candidates.length === 0}
        hint={candidates.length === 0 ? 'Needs a question above it.' : undefined}
        onChange={(on) =>
          onChange({
            showWhen: on ? { field: candidates[0]?.key ?? '', test: 'filled', value: '' } : null,
          })
        }
      />

      {condition ? (
        <View style={{ gap: theme.space.sm, paddingLeft: theme.space.md }}>
          <Picker
            label="Question"
            value={condition.field}
            options={candidates.map((candidate) => ({
              value: candidate.key,
              label: candidate.label || candidate.key,
            }))}
            onChange={(next) => onChange({ showWhen: { ...condition, field: next, value: '' } })}
          />
          <Picker
            label="Test"
            value={condition.test}
            options={[
              { value: 'filled', label: 'is answered' },
              { value: 'equals', label: 'is exactly' },
              { value: 'includes', label: 'includes' },
            ]}
            onChange={(test) =>
              onChange({
                showWhen: {
                  ...condition,
                  test: test as FieldCondition['test'],
                },
              })
            }
          />

          {condition.test !== 'filled' ? (
            target && target.options.length > 0 ? (
              // The options of the field being tested, so a condition cannot be
              // typed as a value that field will never hold.
              <Picker
                label="Value"
                value={condition.value}
                options={target.options.map((option) => ({
                  value: option.value,
                  label: option.label || option.value,
                }))}
                onChange={(value) => onChange({ showWhen: { ...condition, value } })}
              />
            ) : (
              <Field
                label="Value"
                value={condition.value}
                onChange={(value) => onChange({ showWhen: { ...condition, value } })}
              />
            )
          ) : null}
        </View>
      ) : null}

      {condition ? (
        <Micro color={theme.color.inkFaint}>
          A condition may only point at a question above this one.
        </Micro>
      ) : null}
    </View>
  );
}

/**
 * The form as somebody filling it in will see it.
 *
 * Through the real `FieldInput`, which is the whole point of that component
 * living outside this file: a preview that is a second implementation lies to
 * whoever is building the form, usually about the thing they are checking.
 */
function Preview({ form }: { form: WithId<FormDraft> }) {
  const theme = useTheme();
  const [answers, setAnswers] = useState<FormAnswers>({});
  const shown = visibleFields(form.fields, answers);

  return (
    <View style={{ gap: theme.space.md }}>
      <Heading>{form.title}</Heading>
      {form.blurb ? <Body color={theme.color.inkSoft}>{form.blurb}</Body> : null}

      {shown.map((field) => (
        <FieldInput
          key={field.key}
          field={field}
          value={answers[field.key]}
          error={null}
          onChange={(value) => setAnswers((previous) => ({ ...previous, [field.key]: value }))}
          formSlug={form.slug}
        />
      ))}

      <Small color={theme.color.inkFaint}>Preview only — nothing here is sent.</Small>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Small pieces                                                                */
/* -------------------------------------------------------------------------- */

/**
 * A 40pt icon button in a row of controls.
 *
 * One glyph, and it used to be two: a `chevron` with a `flip` that pointed it
 * the other way was how a question was moved up and down. Both went with the
 * chevrons themselves — the order is dragged now, see `Reorder` — and the
 * remaining callers are all the same close cross, so the type says so rather
 * than leaving a variant nothing renders.
 */
function Tool({ label, icon, onPress }: { label: string; icon: 'close'; onPress: () => void }) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={theme.space.xs}
      style={({ pressed }) => ({
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.radius.sm,
        backgroundColor: pressed ? theme.color.accentSoft : 'transparent',
      })}
    >
      <Icon name={icon} size={16} color={theme.color.inkSoft} />
    </Pressable>
  );
}

/** Cents as a dollars string for a text box, and back again. */
function dollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

function toCents(value: string): number {
  const amount = Math.round(Number(value) * 100);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

function newField(type: FormFieldType, existing: FormField[]): FormField {
  const taken = new Set(existing.map((field) => field.key));
  let key: string = type;
  let n = 2;
  while (taken.has(key)) key = `${type}-${n++}`;

  return {
    key,
    type,
    label: '',
    help: null,
    placeholder: null,
    required: false,
    options: isChoiceField(type) ? [{ value: 'option-1', label: '', priceCents: 0 }] : [],
    showWhen: null,
    unitPriceCents: 0,
    min: null,
    max: null,
  };
}

/**
 * Everything worth saying about this form before it is published.
 *
 * Advice rather than validation — nothing here blocks a save. The two that
 * catch real mistakes rather than unfinished work are the duplicate key (two
 * questions writing to one answer) and the condition that can never be true.
 */
function lint(form: WithId<FormDraft>): string[] {
  const problems: string[] = [];

  if (!form.slug) problems.push('The form has no address.');
  if (form.kind === 'external' && !form.externalUrl) {
    problems.push('This form links out, but has no link.');
  }
  if (form.kind === 'embed') {
    if (!form.externalUrl) {
      problems.push('This form is shown from somewhere else, but has no address.');
    } else if (!isKnownFormHost(form.externalUrl)) {
      problems.push(
        'That address is not a Tithe.ly or Breeze one, so it may refuse to appear inside the page.',
      );
    }
  }
  if (form.kind === 'native' && form.fields.length === 0) {
    problems.push('There are no questions.');
  }

  const keys = new Map<string, number>();
  for (const field of form.fields) {
    keys.set(field.key, (keys.get(field.key) ?? 0) + 1);
    if (!field.label.trim()) {
      problems.push(`A ${TYPE_LABELS[field.type].toLowerCase()} has no label.`);
    }
    if (isChoiceField(field.type) && field.options.length === 0) {
      problems.push(`“${field.label || field.key}” has no options.`);
    }
    if (isChoiceField(field.type) && field.options.some((option) => !option.label.trim())) {
      problems.push(`“${field.label || field.key}” has an option with no label.`);
    }
  }
  for (const [key, count] of keys) {
    if (count > 1) problems.push(`Two questions share the key “${key}”.`);
  }

  for (const field of form.fields) {
    const condition = field.showWhen;
    if (!condition || condition.test === 'filled') continue;
    const target = form.fields.find((candidate) => candidate.key === condition.field);
    if (!target) {
      problems.push(`“${field.label || field.key}” depends on a question that is not here.`);
      continue;
    }
    if (target.options.length > 0 && !target.options.some((o) => o.value === condition.value)) {
      problems.push(
        `“${field.label || field.key}” will never show — “${condition.value}” is not one of “${
          target.label || target.key
        }”’s options.`,
      );
    }
  }

  if (form.payment.enabled) {
    const priced =
      form.payment.baseCents > 0 ||
      form.fields.some(
        (field) =>
          field.unitPriceCents > 0 || field.options.some((option) => option.priceCents > 0),
      );
    if (!priced) problems.push('Payment is on, but nothing on the form costs anything.');
  }

  return problems;
}
