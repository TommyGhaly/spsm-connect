/**
 * The per-book fields the book's sheet and the add form share: which categories
 * it is filed in, what it weighs, whether Media Mail may carry it, and whether
 * sales tax applies.
 *
 * The mobile port of three pieces of the website's `EditControls.tsx` —
 * `CategoryChecklist`, `ShippingFields` and `TaxableField` — kept together here
 * because both callers draw all three, in the same order, and a form that
 * files a new book one way and an existing book another is two forms.
 *
 * None of these write anything. On a saved book they feed `usePendingEdit`, so
 * the change waits for the Save bar like a stock count; on the add form they
 * are plain state, sent with the rest when the book is created. Which of the
 * two is the caller's business.
 */
import { useState } from 'react';
import { View } from 'react-native';
import {
  childSections,
  formatWeight,
  ouncesToPounds,
  parseWeight,
  UNSORTED_LABEL,
  type BookstoreSection,
} from '@spsm/shared';

import { Check, Field } from '@/components/Fields';
import { Micro } from '@/components/Type';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Every category, in tree order — each one followed by its own children, at any
 * depth — with how deep it sits. The checklist indents by this; the category
 * editor draws its rows from it too.
 */
export function sectionTree(
  sections: readonly BookstoreSection[],
): { section: BookstoreSection; depth: number }[] {
  const rows: { section: BookstoreSection; depth: number }[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const section of childSections(sections, parentId)) {
      rows.push({ section, depth });
      // Square nests without a limit; eight is deeper than any shop needs and
      // a guard against a parent loop that Square should never send.
      if (depth < 8) walk(section.id, depth + 1);
    }
  };
  walk(null, 0);
  return rows;
}

/**
 * Which categories a book is filed in, as a checklist of the whole tree.
 *
 * Checkboxes rather than the single picker this replaced, because a book can
 * be in several — Square allows it and the parish asked for it. Indented by
 * depth so "Arabic books" reads as part of "Books". Ticking a subcategory does
 * not tick its parent: the shop already shows a subcategory's books under the
 * parent's pill, so ticking both would only file it twice.
 */
export function CategoryChecklist({
  sections,
  chosen,
  busy,
  onChange,
}: {
  sections: readonly BookstoreSection[];
  chosen: readonly string[];
  busy: boolean;
  onChange: (next: readonly string[]) => void;
}) {
  const theme = useTheme();

  return (
    <View style={{ gap: 0 }}>
      {sectionTree(sections).map(({ section, depth }) => (
        <View key={section.id} style={{ paddingLeft: depth * theme.space.md }}>
          <Check
            label={section.label}
            checked={chosen.includes(section.id)}
            disabled={busy}
            onChange={(on) =>
              onChange(on ? [...chosen, section.id] : chosen.filter((id) => id !== section.id))
            }
          />
        </View>
      ))}
      <Micro color={theme.color.inkFaint}>
        {chosen.length === 0
          ? `In no category — it shows under “${UNSORTED_LABEL}”.`
          : 'Saved to Square too, so the register files it the same way.'}
      </Micro>
    </View>
  );
}

/**
 * The two facts live postage needs about a book.
 *
 * Weighed in pounds, stored in ounces — the parish weighs things in pounds, and
 * `parseWeight` converts. The box keeps its own text, because what somebody is
 * halfway through typing — `1.` on the way to `1.5` — is not yet a weight, and
 * pushing every keystroke through the parser would rewrite the box under their
 * thumb. Only text that reads as a weight, or an emptied box, is passed up;
 * nonsense stays on screen with a line saying what is wanted.
 *
 * The caller keys this on the book, so the text re-seeds when the sheet moves
 * to another one. It deliberately does not re-seed when the held value
 * changes, for the same reason it keeps its own text at all.
 */
export function ShippingFields({
  weightOz,
  mediaMail,
  busy,
  onChange,
}: {
  weightOz: number | null;
  mediaMail: boolean;
  busy: boolean;
  onChange: (next: { weightOz: number | null; mediaMail: boolean }) => void;
}) {
  const theme = useTheme();
  const [text, setText] = useState(weightOz === null ? '' : ouncesToPounds(weightOz));
  const parsed = parseWeight(text);
  const wrong = parsed === undefined;

  return (
    <View style={{ gap: theme.space.xs }}>
      <Field
        label="Weight, in pounds"
        value={text}
        onChange={(next) => {
          setText(next);
          const weight = parseWeight(next);
          if (weight !== undefined) onChange({ weightOz: weight, mediaMail });
        }}
        keyboard="numbers-and-punctuation"
        placeholder="1.5"
        invalid={wrong}
        readOnly={busy}
        error={wrong ? 'Type pounds, like 2 or 1.5.' : null}
        hint={
          wrong
            ? undefined
            : parsed === null
              ? 'Not weighed — a delivery with this in it is charged the flat rate.'
              : `${formatWeight(parsed)} a copy, before the box.`
        }
      />
      <Check
        label="Book or media (Media Mail)"
        checked={mediaMail}
        disabled={busy}
        onChange={(on) => onChange({ weightOz, mediaMail: on })}
        hint="Media Mail is offered only when everything in the order is a book or media."
      />
    </View>
  );
}

/**
 * Whether Massachusetts sales tax applies to this book.
 *
 * Off unless somebody turns it on. Books used in worship are exempt; gifts and
 * goods generally are not — the hint says so in a line, because the person
 * ticking it is a volunteer, not an accountant. The rate is the shop's, set
 * once under Shipping & tax.
 */
export function TaxableField({
  taxable,
  busy,
  onChange,
}: {
  taxable: boolean;
  busy: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <Check
      label="Charge sales tax on this item"
      checked={taxable}
      disabled={busy}
      onChange={onChange}
      hint={
        taxable
          ? 'Tax is added at checkout and shown as its own line.'
          : 'Not taxed. Leave off for books used in worship; tick for gifts and goods.'
      }
    />
  );
}
