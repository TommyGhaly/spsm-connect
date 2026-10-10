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
 * that on top of a scroll view, to reorder a row of a dozen pills, is machinery
 * maintained for nobody.
 *
 * So the row stays exactly what a shopper sees — a filter — and arranging it
 * happens here, where each category is a full-width row with its name in a box
 * and two arrows that do not have to be told apart from a scroll.
 *
 * ## Square's categories, and the one thing that is still ours
 *
 * The categories are Square's subcategories of "Bookstore" now, at any depth —
 * the catalog sync mirrors the tree into `config/bookstore.sections`, each one
 * carrying its `parentId`. So making, renaming and removing one go through
 * `squareCategory`, which writes Square first and mirrors the result straight
 * back, and the register files books the same way the shop does. Removing is
 * refused there while a book or a subcategory is still inside — so deleting a
 * row can never leave items in Square pointing at a category that is gone —
 * and this sheet says so before the button is pressed rather than after.
 *
 * The **order** is the exception. Square keeps none for categories, so the
 * pill order is the parish's and stays a Firestore write of the whole list,
 * each row moving only among its own siblings; the sync and the Function both
 * keep that order when they rewrite the list (`orderSections`).
 *
 * None of it is held for the Save bar: a category is the thing other edits
 * refer to, and a held edit pointing at a category that does not exist yet is
 * a category of bug not worth inventing. The website says the same.
 *
 * Nested rows are indented under their parent, and "Add a subcategory" is
 * offered on the top two levels — the two the shop's pill rows can show.
 * ---------------------------------------------------------------------------
 */
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import {
  MAX_SECTIONS,
  MAX_SECTION_LABEL,
  UNSORTED_LABEL,
  childSections,
  countBySection,
  type BookstoreSection,
} from '@spsm/shared';

import { Close, Field, Problem, Sheet } from '@/components/Fields';
import { Icon } from '@/components/Icon';
import { Button } from '@/components/Surface';
import { Body, Heading, Label, Micro, Small } from '@/components/Type';
import { useTheme } from '@/theme/ThemeProvider';

import type { ShopProduct } from '../data';
import { sectionTree } from './ProductFields';

/** How deep a category may be for "Add a subcategory" to be offered under it. */
const MAX_PARENT_DEPTH = 1;

/**
 * Mounted only while it is open — `ShopScreen` renders it conditionally — so a
 * half-typed rename and a half-pressed Remove go with it. Holding this open
 * with `null` and an effect to clear its state would be the same behaviour
 * written twice, once in React and once by hand.
 */
export function CategoryEditor({
  sections,
  products,
  onClose,
}: {
  /** Every category the parish has, in order — including the empty ones. */
  sections: BookstoreSection[];
  /** The shelf, for the counts: what is under each row, and what is in none. */
  products: ShopProduct[];
  onClose: () => void;
}) {
  const theme = useTheme();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [fresh, setFresh] = useState('');
  /** Which row's name is being retyped, and what it says so far. */
  const [editing, setEditing] = useState<{ id: string; label: string } | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  /** Which row a subcategory is being added under, and its name so far. */
  const [addingUnder, setAddingUnder] = useState<{ parentId: string; label: string } | null>(
    null,
  );

  const rows = useMemo(() => sectionTree(sections), [sections]);
  /* Everything under a row, subtree included — what its pill counts. */
  const counts = useMemo(() => countBySection(products, sections), [products, sections]);
  /* What is filed in a row *itself*, which is what Square's refusal counts. */
  const direct = useMemo(() => {
    const map = new Map<string, number>();
    for (const product of products) {
      for (const id of product.categoryIds) map.set(id, (map.get(id) ?? 0) + 1);
    }
    return map;
  }, [products]);
  const unfiled = counts.get(null) ?? 0;

  /** One change, with the sheet held busy and the refusal shown if it comes. */
  const run = async (task: (data: typeof import('./adminData')) => Promise<unknown>) => {
    setBusy(true);
    setFailed(null);
    try {
      await task(await import('./adminData'));
    } catch (cause) {
      setFailed(
        cause instanceof Error ? cause.message : 'The categories could not be saved.',
      );
    } finally {
      setBusy(false);
    }
  };

  /*
   * A new order for one row's siblings, written into the whole list. The
   * siblings take the slots they already held in the full list, in their new
   * order, so no other level moves — and every entry goes back exactly as it
   * came, labels and `parentId` included, because those are Square's.
   */
  const shift = (section: BookstoreSection, by: number) => {
    const level = childSections(sections, section.parentId ?? null);
    const from = level.findIndex((row) => row.id === section.id);
    const to = from + by;
    if (from < 0 || to < 0 || to >= level.length) return;
    const next = [...level];
    const [lifted] = next.splice(from, 1);
    if (!lifted) return;
    next.splice(to, 0, lifted);
    const ids = new Set(next.map((row) => row.id));
    const queue = [...next];
    void run(({ writeSections }) =>
      writeSections(sections.map((row) => (ids.has(row.id) ? queue.shift()! : row))),
    );
  };

  const rename = (section: BookstoreSection) => {
    const clean = (editing?.label ?? '').trim().replace(/\s+/g, ' ').slice(0, MAX_SECTION_LABEL);
    setEditing(null);
    // An empty name would leave a pill with nothing to read, so it is refused
    // rather than written.
    if (!clean || clean === section.label) return;
    /* Renamed in Square, so on the register and in its reports too. The id
       never changes, so every book filed under it stays filed — and a
       shopper's filter keeps working mid-rename. */
    void run(({ renameCategory }) => renameCategory(section.id, clean));
  };

  const add = (label: string, parentId: string | null) => {
    const clean = label.trim().replace(/\s+/g, ' ').slice(0, MAX_SECTION_LABEL);
    if (!clean || sections.length >= MAX_SECTIONS) return;
    // A repeated name on the same level is refused rather than made twice.
    // Square's Function refuses it too; saying so here saves the round trip.
    if (
      childSections(sections, parentId).some(
        (row) => row.label.toLowerCase() === clean.toLowerCase(),
      )
    ) {
      setFailed(`There is already a category called “${clean}” there.`);
      return;
    }
    if (parentId === null) setFresh('');
    else setAddingUnder(null);
    // Made in Square, under the Bookstore or under `parentId`.
    void run(({ createCategory }) => createCategory(clean, parentId));
  };

  return (
    <Sheet
      open
      onClose={onClose}
      label="The shop’s categories"
      header={
        <View style={{ flexDirection: 'row', gap: theme.space.sm }}>
          <View style={{ flex: 1, gap: theme.space.xs }}>
            <Label>Bookstore</Label>
            <Heading>Categories</Heading>
          </View>
          <Close onPress={onClose} what="the categories" />
        </View>
      }
    >

      <Micro color={theme.color.inkFaint}>
        These are the pills under the search box, and they are Square’s categories inside
        “Bookstore”, so the register sees the same ones. A book can be in several, or in none.
        Choosing a category in the shop opens a row of its subcategories.
      </Micro>

      {failed ? (
        <Problem>
          <Body color={theme.color.ink}>{failed}</Body>
        </Problem>
      ) : null}

      <View style={{ gap: theme.space.sm }}>
        {rows.map(({ section, depth }) => {
          const level = childSections(sections, section.parentId ?? null);
          const index = level.findIndex((row) => row.id === section.id);
          const total = counts.get(section.id) ?? 0;
          const inside = direct.get(section.id) ?? 0;
          const children = childSections(sections, section.id).length;

          return (
            <View
              key={section.id}
              style={{
                gap: theme.space.xs,
                paddingLeft: depth * theme.space.md,
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
                      onBlur={() => rename(section)}
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
                        {total} {total === 1 ? 'book' : 'books'}
                        {children > 0 ? ` · ${children} inside` : ''} · tap to rename
                      </Micro>
                    </Pressable>
                  )}
                </View>

                <Arrow
                  icon="chevron"
                  up
                  label={`Move ${section.label} earlier`}
                  disabled={busy || index <= 0}
                  onPress={() => shift(section, -1)}
                />
                <Arrow
                  icon="chevron"
                  up={false}
                  label={`Move ${section.label} later`}
                  disabled={busy || index === level.length - 1}
                  onPress={() => shift(section, 1)}
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
                  {/* Said before the press rather than refused after it:
                      Square will not remove a category with anything inside,
                      and this is the sentence that says what to move first. */}
                  <Micro color={theme.color.inkSoft}>
                    {children > 0
                      ? `“${section.label}” has categories inside it. Remove or move those first.`
                      : inside > 0
                        ? `${inside} ${inside === 1 ? 'book is' : 'books are'} still in “${section.label}”. Untick it on ${inside === 1 ? 'that book' : 'those books'} first.`
                        : `Remove “${section.label}” from Square? Nothing is filed in it.`}
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
                        disabled={busy || children > 0 || inside > 0}
                        onPress={() => {
                          setConfirming(null);
                          void run(({ removeCategory }) => removeCategory(section.id));
                        }}
                      />
                    </View>
                  </View>
                </View>
              ) : null}

              {depth <= MAX_PARENT_DEPTH && sections.length < MAX_SECTIONS ? (
                addingUnder?.parentId === section.id ? (
                  <View style={{ gap: theme.space.xs, paddingLeft: theme.space.md }}>
                    <Field
                      label={`New category inside ${section.label}`}
                      value={addingUnder.label}
                      onChange={(label) => setAddingUnder({ parentId: section.id, label })}
                      readOnly={busy}
                    />
                    <View style={{ flexDirection: 'row', gap: theme.space.sm }}>
                      <View style={{ flex: 1 }}>
                        <Button
                          label="Cancel"
                          tone="quiet"
                          onPress={() => setAddingUnder(null)}
                          disabled={busy}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Button
                          label="Add"
                          onPress={() => add(addingUnder.label, section.id)}
                          disabled={busy || addingUnder.label.trim() === ''}
                          busy={busy}
                        />
                      </View>
                    </View>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => setAddingUnder({ parentId: section.id, label: '' })}
                    disabled={busy}
                    accessibilityRole="button"
                    accessibilityLabel={`Add a category inside ${section.label}`}
                    style={{ minHeight: 36, justifyContent: 'center', paddingLeft: theme.space.md }}
                  >
                    <Micro color={theme.color.accent}>+ Subcategory</Micro>
                  </Pressable>
                )
              ) : null}
            </View>
          );
        })}

        {/* The catch-all, said but not offered. There is nothing stored to
            rename, move or remove — it is what `groupProducts` calls whatever
            is left — so showing it as a row with dead controls would be a lie
            about what it is. It is absent entirely once everything is filed. */}
        {unfiled > 0 && sections.length > 0 ? (
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
            onPress={() => add(fresh, null)}
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
