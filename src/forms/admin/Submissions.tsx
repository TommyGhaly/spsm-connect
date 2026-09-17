/**
 * What came back, for whoever holds the `forms` grant.
 *
 * This screen lists real people's names, phone numbers and answers. What
 * protects those is `firestore.rules` refusing the read without the grant, not
 * the fact that the route is hard to find — but the route checks too, because
 * drawing an empty panel and an error is a worse way to say "not for you".
 *
 * Capped at the most recent 200, like the website's panel: the church's whole
 * forms volume is a few hundred a year, and a cap that says so is a smaller,
 * more honest thing than a pager nobody reaches page two of.
 */
import { useEffect, useMemo, useState } from 'react';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { Linking, Pressable, View } from 'react-native';
import {
  isFormUploadPath,
  type FormAnswer,
  type FormDefinition,
  type SubmissionStatus,
} from '@spsm/shared';

import { Field, Picker, Problem } from '@/components/Fields';
import { Icon } from '@/components/Icon';
import { Button, Card, Screen } from '@/components/Surface';
import { Body, Heading, Label, Micro, Small } from '@/components/Type';
import { money } from '@/payments/money';
import { useTheme } from '@/theme/ThemeProvider';

import { readAllForms, type WithId } from '../data';
import {
  deleteSubmission,
  readSubmissions,
  setSubmissionStatus,
  type SubmissionRow,
} from '../adminData';
import { readFormPhotoUrl } from '../pictures';

const STATUSES: { value: SubmissionStatus; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'seen', label: 'Seen' },
  { value: 'handled', label: 'Handled' },
  { value: 'archived', label: 'Archived' },
];

/** Null is the default view: everything that is not archived. */
type Filter = SubmissionStatus | null;

export function Submissions({ formId }: { formId: string | null }) {
  const theme = useTheme();
  const [selected, setSelected] = useState<string | null>(formId);
  const [forms, setForms] = useState<WithId<FormDefinition>[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>(null);
  const [term, setTerm] = useState('');

  /*
   * What was read, and which form it was read for.
   *
   * One piece of state rather than a list plus a loading flag, because the two
   * can disagree: switching forms has to show "loading" again, and the obvious
   * way to arrange that — clearing the rows as the effect starts — is a
   * synchronous `setState` inside an effect, which is a cascading render and is
   * what `react-hooks/set-state-in-effect` is about. Holding the answer beside
   * the question it answers makes "still loading" something to *derive* rather
   * than something to set.
   */
  const [loaded, setLoaded] = useState<{
    formId: string | null;
    rows: SubmissionRow[];
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const rows = await readSubmissions(selected);
        if (cancelled) return;
        setLoaded({ formId: selected, rows });
        setError(null);
      } catch (cause) {
        if (cancelled) return;
        setError(
          cause instanceof Error
            ? `${cause.message} — if this mentions an index, it is the composite one on formId and submittedAt, and the link in the log builds it.`
            : 'The submissions could not be read.',
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selected]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const all = await readAllForms();
        if (!cancelled) setForms(all);
      } catch {
        /*
         * The titles and the question labels are a nicety — a submission
         * carries its own `formTitle` — so a failed read here degrades the
         * screen rather than stopping it. The read below is the one that
         * matters, and it reports its own failure.
         */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /** Null while the read for the *currently selected* form is still in flight. */
  const rows = loaded && loaded.formId === selected ? loaded.rows : null;
  const all = useMemo(() => rows ?? [], [rows]);

  const counts = useMemo(() => {
    const tally = { new: 0, seen: 0, handled: 0, archived: 0 };
    for (const row of all) tally[row.status] += 1;
    return tally;
  }, [all]);

  /*
   * "Open" is everything that is not archived, which is why the default filter
   * is null rather than 'new' — a submission somebody has seen but not handled
   * is still waiting on them.
   */
  const visible = useMemo(() => {
    const needle = term.trim().toLowerCase();
    return all.filter((row) => {
      if (filter === null ? row.status === 'archived' : row.status !== filter) return false;
      if (!needle) return true;
      return haystack(row).includes(needle);
    });
  }, [all, filter, term]);

  /** Change one row's status where it sits, rather than re-reading the list. */
  function patch(id: string, status: SubmissionStatus) {
    setLoaded((previous) =>
      previous
        ? {
            ...previous,
            rows: previous.rows.map((entry) => (entry.id === id ? { ...entry, status } : entry)),
          }
        : previous,
    );
  }

  function drop(id: string) {
    setLoaded((previous) =>
      previous ? { ...previous, rows: previous.rows.filter((entry) => entry.id !== id) } : previous,
    );
  }

  return (
    <Screen>
      <Picker
        label="Form"
        value={selected ?? ''}
        placeholder="All forms"
        options={[
          { value: '', label: 'All forms' },
          // An external form keeps nothing here, so listing it would offer a
          // filter that can only ever be empty.
          ...forms
            .filter((form) => form.kind !== 'external')
            .map((form) => ({ value: form.id, label: form.title })),
        ]}
        onChange={(next) => setSelected(next || null)}
      />

      <Field
        label="Search"
        value={term}
        onChange={setTerm}
        placeholder="Name, email, or an answer"
        autoCapitalize="none"
      />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.xs }}>
        <Chip
          label="Open"
          count={counts.new + counts.seen + counts.handled}
          on={filter === null}
          onPress={() => setFilter(null)}
        />
        {STATUSES.map((status) => (
          <Chip
            key={status.value}
            label={status.label}
            count={counts[status.value]}
            on={filter === status.value}
            onPress={() => setFilter(status.value)}
          />
        ))}
      </View>

      {error ? <Problem>{error}</Problem> : null}

      {rows === null && !error ? <Body color={theme.color.inkSoft}>Loading…</Body> : null}

      {rows !== null && visible.length === 0 ? (
        <Body color={theme.color.inkSoft}>
          {term.trim()
            ? `Nothing here matches “${term.trim()}”.`
            : filter === null
              ? 'Nothing waiting. Anything archived is under Archived.'
              : `No ${STATUSES.find((s) => s.value === filter)?.label.toLowerCase()} submissions.`}
        </Body>
      ) : null}

      {visible.map((row) => (
        <SubmissionCard
          key={row.id}
          row={row}
          form={forms.find((form) => form.id === row.formId) ?? null}
          onStatus={(status) => {
            // Optimistic: the chip counts and the row move together, and a
            // refused write is re-read on the next load rather than being
            // argued about here.
            patch(row.id, status);
            void setSubmissionStatus(row.id, status);
          }}
          onDeleted={() => drop(row.id)}
        />
      ))}

      {rows !== null && rows.length >= 200 ? (
        <Small color={theme.color.inkFaint}>Showing the 200 most recent.</Small>
      ) : null}
    </Screen>
  );
}

function SubmissionCard({
  row,
  form,
  onStatus,
  onDeleted,
}: {
  row: SubmissionRow;
  /** The definition, for the question labels. Null when the form was deleted. */
  form: WithId<FormDefinition> | null;
  onStatus: (status: SubmissionStatus) => void;
  onDeleted: () => void;
}) {
  const theme = useTheme();
  // A new submission opens expanded: somebody who came here to read it should
  // not have to press it first.
  const [open, setOpen] = useState(row.status === 'new');
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const who = row.submitterName ?? '(no name given)';

  /*
   * The name, email and phone are pulled out into their own row above, so
   * repeating them among the answers is the same fact twice.
   */
  const answers = Object.entries(row.answers).filter(([, answer]) => !redundant(row, answer));

  async function destroy() {
    setDeleting(true);
    setFailed(null);
    try {
      await deleteSubmission(row.id);
      onDeleted();
    } catch (cause) {
      setDeleting(false);
      setFailed(cause instanceof Error ? cause.message : 'The submission could not be deleted.');
    }
  }

  return (
    <Card gap={theme.space.sm}>
      <Pressable
        onPress={() => setOpen(!open)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${who}, ${row.formTitle}`}
        style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.space.sm }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Heading>{who}</Heading>
          <Micro color={theme.color.inkFaint}>
            {[row.formTitle, row.submittedAt ? when(row.submittedAt) : null]
              .filter(Boolean)
              .join(' · ')}
          </Micro>
        </View>

        {row.totalCents > 0 ? (
          <Small color={row.paymentId ? theme.color.accent : theme.color.accentStrong}>
            {row.paymentId ? money(row.totalCents) : `${money(row.totalCents)} owed`}
          </Small>
        ) : null}

        <Icon
          name="chevron"
          size={16}
          color={theme.color.inkFaint}
          // The caret points down when the row is shut and up when it is open,
          // which is the only thing telling somebody the row has more in it.
        />
      </Pressable>

      <Picker
        label="Status"
        value={row.status}
        options={STATUSES}
        onChange={(next) => onStatus(next as SubmissionStatus)}
      />

      {open ? (
        <View style={{ gap: theme.space.sm }}>
          {row.submitterEmail ? (
            <Reach
              icon="mail"
              label={row.submitterEmail}
              onPress={() => void Linking.openURL(`mailto:${row.submitterEmail}`)}
            />
          ) : null}
          {row.submitterPhone ? (
            <Reach
              icon="phone"
              label={row.submitterPhone}
              onPress={() =>
                void Linking.openURL(`tel:${(row.submitterPhone ?? '').replace(/[^\d+]/g, '')}`)
              }
            />
          ) : null}

          {answers.map(([key, answer]) => (
            <View key={key} style={{ gap: 2 }}>
              <Label>{labelFor(form, key).toUpperCase()}</Label>
              {isFormUploadPath(answer) ? (
                <SubmittedPhoto path={answer} />
              ) : (
                <Small color={theme.color.ink}>{render(form, key, answer)}</Small>
              )}
            </View>
          ))}

          {answers.length === 0 && !row.submitterEmail && !row.submitterPhone ? (
            <Body color={theme.color.inkSoft}>This submission carries no answers.</Body>
          ) : null}

          {failed ? <Problem>{failed}</Problem> : null}

          {confirming ? (
            <Card gap={theme.space.sm}>
              <Label>DELETE THIS SUBMISSION?</Label>
              <Small color={theme.color.inkSoft}>
                This destroys it for good — there is no undo and no copy kept.
                {row.paymentId ? ' A payment was taken against this record.' : ''} To take it
                out of the queue and keep the record, set it to Archived instead.
              </Small>
              <Button
                label={deleting ? 'Deleting…' : 'Delete for good'}
                tone="danger"
                onPress={() => void destroy()}
                busy={deleting}
              />
              <Button
                label="Archive instead"
                tone="quiet"
                disabled={deleting}
                onPress={() => {
                  setConfirming(false);
                  onStatus('archived');
                }}
              />
              <Button
                label="Keep it"
                tone="quiet"
                disabled={deleting}
                onPress={() => setConfirming(false)}
              />
            </Card>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
              {row.submittedAt ? (
                <Micro color={theme.color.inkFaint}>
                  {row.submittedAt.toLocaleString(undefined, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </Micro>
              ) : null}
              <View style={{ flex: 1 }} />
              <Pressable
                onPress={() => setConfirming(true)}
                accessibilityRole="button"
                accessibilityLabel={`Delete the submission from ${who}`}
                hitSlop={theme.space.sm}
              >
                <Small color={theme.color.accent}>Delete</Small>
              </Pressable>
            </View>
          )}
        </View>
      ) : null}
    </Card>
  );
}

function Chip({
  label,
  count,
  on,
  onPress,
}: {
  label: string;
  count: number;
  on: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={`${label}, ${count}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.xs,
        minHeight: 36,
        paddingHorizontal: theme.space.sm,
        borderRadius: theme.radius.full,
        borderWidth: 1,
        borderColor: on ? theme.color.accent : theme.color.rule,
        backgroundColor: on || pressed ? theme.color.accentSoft : 'transparent',
      })}
    >
      <Small color={on ? theme.color.accentStrong : theme.color.inkSoft}>{label}</Small>
      <Micro color={theme.color.inkFaint}>{String(count)}</Micro>
    </Pressable>
  );
}

function Reach({
  icon,
  label,
  onPress,
}: {
  icon: 'mail' | 'phone';
  label: string;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={label}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.xs,
        minHeight: 44,
      }}
    >
      <Icon name={icon} size={16} color={theme.color.accent} />
      <Small color={theme.color.accent}>{label}</Small>
    </Pressable>
  );
}

/**
 * A photograph somebody attached, fetched with a staff token.
 *
 * `formUploads/` is readable by nobody else, so this resolves a URL rather than
 * building one — and when the read is refused it shows the path instead, which
 * at least says which object the submission is pointing at.
 */
function SubmittedPhoto({ path }: { path: string }) {
  const theme = useTheme();
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void readFormPhotoUrl(path).then((resolved) => {
      if (cancelled) return;
      if (resolved) setUrl(resolved);
      else setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (failed) return <Micro color={theme.color.inkFaint}>{path}</Micro>;
  if (!url) return <Micro color={theme.color.inkFaint}>Loading photo…</Micro>;

  return (
    <Pressable
      onPress={() => void WebBrowser.openBrowserAsync(url)}
      accessibilityRole="button"
      accessibilityLabel="Open the attached photograph"
    >
      <Image
        source={{ uri: url }}
        style={{
          width: '100%',
          height: 200,
          borderRadius: theme.radius.sm,
          backgroundColor: theme.color.paper,
        }}
        contentFit="cover"
      />
    </Pressable>
  );
}

function haystack(row: SubmissionRow): string {
  return [
    row.submitterName,
    row.submitterEmail,
    row.submitterPhone,
    row.formTitle,
    ...Object.values(row.answers).map((answer) =>
      Array.isArray(answer) ? answer.join(' ') : String(answer),
    ),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function when(at: Date): string {
  const days = Math.round((Date.now() - at.getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 31) return `${days} days ago`;
  return at.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function redundant(row: SubmissionRow, answer: FormAnswer): boolean {
  if (typeof answer !== 'string') return false;
  const value = answer.trim();
  if (!value) return false;
  return (
    value === row.submitterName?.trim() ||
    value === row.submitterEmail?.trim() ||
    value === row.submitterPhone?.trim()
  );
}

function labelFor(form: WithId<FormDefinition> | null, key: string): string {
  return form?.fields.find((field) => field.key === key)?.label || key;
}

/**
 * An answer as words.
 *
 * Through the field's options where there are any, so a review reads "Middle
 * school" rather than the stored `middle-school` — and falls back to the raw
 * value when the question has since been edited out from under the answer.
 */
function render(form: WithId<FormDefinition> | null, key: string, answer: FormAnswer): string {
  const field = form?.fields.find((entry) => entry.key === key);
  const one = (value: string): string =>
    field?.options.find((option) => option.value === value)?.label || value;

  if (Array.isArray(answer)) return answer.map(one).join(', ');
  if (typeof answer === 'boolean') return answer ? 'Yes' : 'No';
  if (typeof answer === 'number') return String(answer);
  return one(answer);
}
