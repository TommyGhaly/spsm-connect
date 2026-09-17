/**
 * What the four kinds look like, and what they are called.
 *
 * ---------------------------------------------------------------------------
 * Colour means *what a thing is*, not *where it came from*.
 *
 * The same rule as the website's `tonesOf` in features/calendar/Entry.tsx, and
 * it is worth restating because this file used to disagree with it: the screen
 * tinted `study` with `inkSoft` and `gathering` with `accentStrong`, which made
 * a Bible study look like faded body text and a volleyball tournament look like
 * a darker liturgy. A liturgy is liturgical red, teaching is gold, a gathering
 * is azure, and a title the classifier could not place makes no colour claim at
 * all — a neutral rule still separates the row.
 *
 * `azure` is the palette's one cool colour and nothing on the website uses it
 * any more; the theme schema keeps it precisely so this app can. See the note
 * over `azure` in packages/shared/src/schema/theme.ts.
 * ---------------------------------------------------------------------------
 *
 * Servants-only entries are *not* a fifth colour. They are a marking laid over
 * whichever kind the entry already has — a servants-only liturgy is still red —
 * which is why that distinction lives in `Entry` as a badge and a dashed rule
 * rather than here as a hue.
 */
import type { OccurrenceKind } from '@spsm/shared';

import type { ResolvedTheme } from '@/theme/tokens';

/** The four kinds, as the church's own colours. Never a literal. */
export function tintFor(kind: OccurrenceKind, theme: ResolvedTheme): string {
  switch (kind) {
    case 'liturgy':
      return theme.color.accent;
    case 'study':
      return theme.color.gold;
    case 'gathering':
      return theme.color.azure;
    default:
      return theme.color.rule;
  }
}

/**
 * The legend, in the website's own wording and its own order.
 *
 * `other` is deliberately absent, for the reason the website's `Legend` gives:
 * it is the absence of a claim, and a row reading "Other" invites the reader to
 * look for a meaning that is not there.
 *
 * `short` is this app's own, and exists because of the shape of the screen
 * rather than a disagreement about the wording. The page's phrases run to three
 * chips across two lines on a phone, and the key sits in a fixed footer under a
 * calendar that is competing for the same points; one word each fits on one
 * line, and beside a coloured dot one word is all the reader is matching on.
 * The full phrase is still what a screen reader is given.
 */
export const LEGEND: readonly { kind: OccurrenceKind; label: string; short: string }[] = [
  { kind: 'liturgy', label: 'Liturgies & prayers', short: 'Liturgy' },
  { kind: 'study', label: 'Classes & studies', short: 'Class' },
  { kind: 'gathering', label: 'Meetings & gatherings', short: 'Gathering' },
];

/**
 * The same four kinds as a question rather than as a key.
 *
 * The legend explains a colour somebody is looking at; this is asked of
 * somebody typing an entry in, so it names the thing instead of the category.
 */
export const KIND_LABELS: Record<OccurrenceKind, string> = {
  liturgy: 'Liturgy or prayer',
  study: 'Class or study',
  gathering: 'Meeting or gathering',
  other: 'Something else',
};

/**
 * The same four kinds as a fill rather than as a line.
 *
 * A tint you can put text on, which `tintFor` is not: `gold` on `goldSoft` is
 * about 2.6:1 and fails at every size in the scale. So the pair divides the
 * work — the hue is carried at full strength by something *drawn* (a rule, a
 * dot, a bar), and the fill behind any actual words is one of these, which are
 * all pale enough to keep `ink` and `inkFaint` above 4.5:1.
 *
 * `other` gets `paperSunken` rather than nothing, because it is used where a
 * shape needs a ground — a time chip with no fill is a hole in the row. It is
 * the palette's neutral band, so an unclassified entry still makes no colour
 * claim; it just isn't transparent.
 */
export function washFor(kind: OccurrenceKind, theme: ResolvedTheme): string {
  switch (kind) {
    case 'liturgy':
      return theme.color.accentSoft;
    case 'study':
      return theme.color.goldSoft;
    case 'gathering':
      return theme.color.azureSoft;
    default:
      return theme.color.paperSunken;
  }
}
