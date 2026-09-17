/**
 * The shop's divisions: made, named, ordered and removed.
 *
 * ---------------------------------------------------------------------------
 * A sheet with a list in it, where the website has the pill row itself become
 * editable — drag a pill to reorder, double-click to rename, × to remove.
 *
 * That arrangement is right on a mouse and cannot survive a phone, for one
 * reason worth stating rather than hand-waving: **the pill row scrolls
 * sideways.** A long press that turns into a drag and a swipe that scrolls the
 * row are the same gesture until they are not, and whichever one is chosen the
 * other becomes impossible. The website's own notes on this code are three
 * paragraphs about a race between `pointerdown` and `pointermove`; reproducing
 * that on top of a scroll view, to reorder at most twelve things, is machinery
 * maintained for nobody.
 *
 * So the row stays exactly what a shopper sees — a filter — and arranging it
 * happens here, where each category is a full-width row with its name in a box
 * and two arrows that do not have to be told apart from a scroll.
 *
 * ## Written whole, every time, and saved immediately
 *
 * `config/bookstore` holds `sections` as one array, so every edit is a write of
 * the whole list. And unlike stock and categories *on a book*, these are not
 * held for the Save bar: a category is the thing other edits refer to, and a
 * held edit pointing at a category that does not exist yet is a category of bug
 * not worth inventing. The website says the same and for the same reason.
 * ---------------------------------------------------------------------------
 */
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import {
  MAX_SECTIONS,
  MAX_SECTION_LABEL,
  UNSORTED_LABEL,
  sectionId,
  type BookstoreSection,
} from '@spsm/shared';

import { Close, Field, Problem, Sheet } from '@/components/Fields';
import { Icon } from '@/components/Icon';
import { Button } from '@/components/Surface';
import { Body, Heading, Label, Micro, Small } from '@/components/Type';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Mounted only while it is open — `ShopScreen` renders it conditionally — so a
 * half-typed rename and a half-pressed Remove go with it. Holding this open
 * with `null` and an effect to clear its state would be the same behaviour
 * written twice, once in React and once by hand.
 */
export function CategoryEditor({
  sections,
  counts,
  unfiled,
  onClose,
}: {
  /** Every category the parish has, in order — including the empty ones. */
  sections: BookstoreSection[];
  /** How many books are filed under each id. Empty categories show a truthful 0. */
  counts: Map<string | null, number>;
  /** How many books are filed under nothing, or `null` when none are. */
  unfiled: number | null;
  onClose: () => void;
}) {
  const theme = useTheme();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [fresh, setFresh] = useState('');
  /** Which row's name is being retyped, and what it says so far. */
  const [editing, setEditing] = useState<{ id: string; label: string } | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  const save = async (next: BookstoreSection[]) => {
    setBusy(true);
    setFailed(null);
    try {
      const { writeSections } = await import('./adminData');
      await writeSections(next);
    } catch (cause) {
      setFailed(
        cause instanceof Error ? cause.message : 'The categories could not be saved.',
      );
    } finally {
      setBusy(false);
    }
  };

  const shift = (id: string, by: number) => {
    const from = sections.findIndex((row) => row.id === id);
    const to = from + by;
    if (from < 0 || to < 0 || to >= sections.length) return;
    const next = [...sections];
    const [lifted] = next.splice(from, 1);
    if (!lifted) return;
    next.splice(to, 0, lifted);
    void save(next);
  };

  const rename = (id: string) => {
    const clean = (editing?.label ?? '').trim().slice(0, MAX_SECTION_LABEL);
    setEditing(null);
    // An empty name would leave a pill with nothing to read, so it is refused
    // rather than written.
    if (!clean) return;
    if (sections.some((row) => row.id === id && row.label === clean)) return;
    /* The label changes; the id never does. That is what makes renaming a
       category a one-field edit rather than a migration across every book filed
       under it — and what keeps a shopper's filter working mid-rename. */
    void save(sections.map((row) => (row.id === id ? { ...row, label: clean } : row)));
  };

  const add = () => {
    const clean = fresh.trim().slice(0, MAX_SECTION_LABEL);
    if (!clean || sections.length >= MAX_SECTIONS) return;

    const id = sectionId(clean);
    // A second category with the same id would swallow the first one's books,
    // so a repeated name is refused rather than merged.
    if (sections.some((row) => row.id === id)) {
      setFailed(`There is already a category called “${clean}”.`);
      return;
    }
    setFresh('');
    void save([...sections, { id, label: clean }]);
  };

  return (
    <Sheet open onClose={onClose} label="The shop’s categories">
      <View style={{ flexDirection: 'row', gap: theme.space.sm }}>
        <View style={{ flex: 1, gap: theme.space.xs }}>
          <Label>Bookstore</Label>
          <Heading>Categories</Heading>
        </View>
        <Close onPress={onClose} what="the categories" />
      </View>

      <Micro color={theme.color.inkFaint}>
        These are the pills under the search box. A book can be in one of them or in none.
        Up to {MAX_SECTIONS}.
      </Micro>

      {failed ? (
        <Problem>
          <Body color={theme.color.ink}>{failed}</Body>
        </Problem>
      ) : null}

      <View style={{ gap: theme.space.sm }}>
        {sections.map((section, index) => (
          <View
            key={section.id}
            style={{
              gap: theme.space.xs,
              paddingBottom: theme.space.sm,
              borderBottomWidth: 1,
              borderBottomColor: theme.color.rule,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.xs }}>
              <View style={{ flex: 1 }}>
                {editing?.id === section.id ? (
                  <Field
                    label="Name"
                    value={editing.label}
                    onChange={(label) => setEditing({ id: section.id, label })}
                    onBlur={() => rename(section.id)}
                    readOnly={busy}
                  />
                ) : (
                  <Pressable
                    onPress={() => setEditing({ id: section.id, label: section.label })}
                    disabled={busy}
                    accessibilityRole="button"
                    accessibilityLabel={`Rename ${section.label}`}
                    style={{ minHeight: 44, justifyContent: 'center' }}
                  >
                    <Small color={theme.color.ink}>{section.label}</Small>
                    <Micro color={theme.color.inkFaint}>
                      {counts.get(section.id) ?? 0}{' '}
                      {(counts.get(section.id) ?? 0) === 1 ? 'book' : 'books'} · tap to rename
                    </Micro>
                  </Pressable>
                )}
              </View>

              <Arrow
                icon="chevron"
                up
                label={`Move ${section.label} earlier`}
                disabled={busy || index === 0}
                onPress={() => shift(section.id, -1)}
              />
              <Arrow
                icon="chevron"
                up={false}
                label={`Move ${section.label} later`}
                disabled={busy || index === sections.length - 1}
                onPress={() => shift(section.id, 1)}
              />
              <Arrow
                icon="trash"
                up={false}
                danger
                label={`Remove the category ${section.label}`}
                disabled={busy}
                onPress={() => setConfirming(section.id)}
              />
            </View>

            {confirming === section.id ? (
              <View style={{ gap: theme.space.xs }}>
                <Micro color={theme.color.inkSoft}>
                  {/* The one thing somebody needs to know before pressing it:
                      no book is lost, they simply stop being filed. */}
                  Remove “{section.label}”? The {counts.get(section.id) ?? 0}{' '}
                  {(counts.get(section.id) ?? 0) === 1 ? 'book' : 'books'} in it stay on the
                  shop and move to “{UNSORTED_LABEL}”.
                </Micro>
                <View style={{ flexDirection: 'row', gap: theme.space.sm }}>
                  <View style={{ flex: 1 }}>
                    <Button
                      label="Keep it"
                      tone="quiet"
                      onPress={() => setConfirming(null)}
                      disabled={busy}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      label="Remove"
                      tone="danger"
                      disabled={busy}
                      onPress={() => {
                        setConfirming(null);
                        void save(sections.filter((row) => row.id !== section.id));
                      }}
                    />
                  </View>
                </View>
              </View>
            ) : null}
          </View>
        ))}

        {/* The catch-all, said but not offered. There is nothing stored to
            rename, move or remove — it is what `groupProducts` calls whatever
            is left — so showing it as a row with dead controls would be a lie
            about what it is. It is absent entirely once everything is filed. */}
        {unfiled !== null ? (
          <Micro color={theme.color.inkFaint}>
            {unfiled} {unfiled === 1 ? 'book is' : 'books are'} in no category, and the shop
            shows them under “{UNSORTED_LABEL}”.
          </Micro>
        ) : null}
      </View>

      {sections.length < MAX_SECTIONS ? (
        <View style={{ gap: theme.space.sm }}>
          <Field
            label="New category"
            value={fresh}
            onChange={setFresh}
            placeholder="Icons"
            readOnly={busy}
          />
          <Button
            label="Add category"
            tone="quiet"
            onPress={add}
            disabled={busy || fresh.trim() === ''}
            busy={busy}
          />
        </View>
      ) : (
        <Micro color={theme.color.inkFaint}>
          {MAX_SECTIONS} is as many as the shop takes. Remove one to add another.
        </Micro>
      )}
    </Sheet>
  );
}

/** A small square control beside a category's name. */
function Arrow({
  icon,
  up,
  danger = false,
  label,
  disabled,
  onPress,
}: {
  icon: 'chevron' | 'trash';
  /** Chevrons point down; this flips one. */
  up: boolean;
  danger?: boolean;
  label: string;
  disabled: boolean;
  onPress: () => void;
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
        width: 40,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.radius.sm,
        opacity: disabled ? 0.3 : 1,
        backgroundColor: pressed ? theme.color.accentSoft : 'transparent',
      })}
    >
      <View style={icon === 'chevron' && up ? { transform: [{ rotate: '180deg' }] } : undefined}>
        <Icon
          name={icon}
          color={danger ? theme.color.accent : theme.color.ink}
          size={icon === 'trash' ? 16 : 18}
        />
      </View>
    </Pressable>
  );
}
