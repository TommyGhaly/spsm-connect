/**
 * The words of the two long About pages, for the App Clip.
 *
 * ---------------------------------------------------------------------------
 * `/c/plans` and `/c/welcome` used to carry two paragraphs each, written by
 * hand in Swift, because the clip cannot run the app's JavaScript and a Swift
 * copy of `src/about/future.ts` (497 lines) and `src/about/tour.ts` (842) would
 * be a second original that goes stale. This removes the copy rather than the
 * text: it reads those two files — the same ones the app's About screens draw
 * from — and writes their words into `ios-appclip/SPSMConnectClip/
 * AboutText.swift`, which the clip compiles in.
 *
 * Run by `plugins/withNativeClip.js` on every prebuild, so the clip cannot fall
 * behind the app; `npm run clip-text` runs it by hand. The output is committed
 * for the same reason `store/` is: a diff shows when the words changed.
 *
 * ## What it keeps, and what it leaves on the website
 *
 * Every paragraph, heading, figure, list and timeline entry. Not the pictures
 * (15 MB), the flythrough, or the tour's three interactive widgets — the hymn,
 * the year and the name in Coptic letters — which say so where they would be.
 *
 * ## The slot ids are the website's
 *
 * Each block carries the id the app's own screen reads it under —
 * `the-church.body`, `station-3.h2` — so that the clip can lay
 * `aboutOverrides/{slug}` over it exactly the way `src/about/overrides.tsx`
 * does, and an edit made on the website shows in the clip with no release. The
 * ids below are copied from `FutureScreen.tsx`, `TourScreen.tsx` and
 * `parts.tsx`; change a band id there and change it here.
 * ---------------------------------------------------------------------------
 */
import { register } from 'node:module';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'ios-appclip/SPSMConnectClip/AboutText.swift');

/*
 * `./media` builds image URLs from the app's config, and `./parts` is React.
 * Neither is text, so both resolve to a stub: every picture becomes `null`,
 * and the type-only import of `./parts` is stripped before it is ever asked
 * for. Node's own type stripping does the rest — these two files are plain
 * data with annotations.
 */
const stub = `data:text/javascript,${encodeURIComponent(
  [
    'const none = () => null;',
    'export const siteUrl = (p) => p;',
    'export const tourPicture = none, tourThumb = none;',
    'export const futurePicture = none, futureThumb = none, firmLogo = none;',
  ].join('\n'),
)}`;

register(
  `data:text/javascript,${encodeURIComponent(`
    export async function resolve(specifier, context, next) {
      if (specifier === './media' || specifier === './parts') {
        return { url: ${JSON.stringify(stub)}, shortCircuit: true };
      }
      return next(specifier, context);
    }
  `)}`,
);

const about = (name) => pathToFileURL(path.join(root, 'src/about', name)).href;
const future = await import(about('future.ts'));
const tour = await import(about('tour.ts'));

function need(value, name) {
  if (value === undefined || value === null) {
    throw new Error(`[clip-text] ${name} is missing from src/about — the clip would lose a section.`);
  }
  return value;
}

/* ── Future Plans, in FutureScreen.tsx's order ─────────────────────────── */

const {
  HERO, WHAT, HEADLINE, BUILDING_A, BUILDING_B, BUILDING_C, ALL_OF_IT, BY_USE,
  THE_LAND, WHERE_IT_STANDS, PROGRESS, WHO_IS_DRAWING, TEAM, PAYING,
} = future;

for (const [name, value] of Object.entries({
  HERO, WHAT, HEADLINE, BUILDING_A, BUILDING_B, BUILDING_C, ALL_OF_IT, BY_USE,
  THE_LAND, WHERE_IT_STANDS, PROGRESS, WHO_IS_DRAWING, TEAM, PAYING,
})) need(value, `future.ts ${name}`);

/** `Head` in parts.tsx: `${band}.eyebrow`, `.h2`, `.lede`. */
const head = (band, { eyebrow, title, lede }) => [
  ...(eyebrow ? [{ t: 'eyebrow', text: eyebrow, slot: `${band}.eyebrow` }] : []),
  { t: 'title', text: title, slot: `${band}.h2` },
  ...(lede ? [{ t: 'lede', text: lede, slot: `${band}.lede` }] : []),
];

const building = (band, b, ground) => ({
  ground,
  blocks: [
    { t: 'eyebrow', text: b.tag },
    ...head(band, { title: b.title }),
    { t: 'prose', paragraphs: b.body, slot: `${band}.body` },
  ],
});

const area = new Intl.NumberFormat('en-US');

const futurePlans = {
  sections: [
    {
      ground: 'deep',
      blocks: [
        { t: 'eyebrow', text: HERO.eyebrow, slot: 'future-hero.eyebrow' },
        { t: 'title', text: HERO.title, slot: 'future-hero.title' },
        { t: 'lede', text: HERO.lede, slot: 'future-hero.lede' },
      ],
    },
    {
      ground: 'plain',
      blocks: [
        ...head('what-is-being-built', { title: WHAT.title }),
        { t: 'prose', paragraphs: WHAT.body, slot: 'what-is-being-built.body' },
        { t: 'figures', items: HEADLINE.map((f) => ({ value: f.value, label: f.label, note: f.note })) },
      ],
    },
    building('the-church', BUILDING_A, 'sunken'),
    building('youth-and-housing', BUILDING_B, 'plain'),
    building('the-diocese-centre', BUILDING_C, 'sunken'),
    {
      ground: 'tinted',
      blocks: [
        ...head('all-of-it', ALL_OF_IT),
        {
          t: 'list',
          items: BY_USE.map((row) => ({
            term: row.use,
            detail: row.of,
            note: `${area.format(row.area)} square feet`,
          })),
        },
      ],
    },
    {
      ground: 'plain',
      blocks: [
        ...head('the-land', THE_LAND),
        { t: 'prose', paragraphs: THE_LAND.body, slot: 'the-land.body' },
      ],
    },
    {
      ground: 'sunken',
      blocks: [
        ...head('where-it-stands', WHERE_IT_STANDS),
        { t: 'timeline', items: PROGRESS.map((m) => ({ when: m.when, what: m.what })) },
        { t: 'prose', paragraphs: WHERE_IT_STANDS.foot, slot: 'where-it-stands.foot' },
      ],
    },
    {
      ground: 'tinted',
      blocks: [
        ...head('who-is-drawing-it', WHO_IS_DRAWING),
        {
          t: 'list',
          // Role first, firm second — the order FutureScreen gives and why.
          items: TEAM.map((m) => ({
            term: m.role,
            termSlot: `who-is-drawing-it.firm-${m.slug}-role`,
            detail: m.firm,
            detailSlot: `who-is-drawing-it.firm-${m.slug}-name`,
            ...(m.town ? { note: m.town, noteSlot: `who-is-drawing-it.firm-${m.slug}-town` } : {}),
          })),
        },
        { t: 'small', text: WHO_IS_DRAWING.credit },
      ],
    },
    {
      ground: 'deep',
      blocks: [
        ...head('paying-for-it', { title: PAYING.title }),
        { t: 'lede', text: PAYING.lede, slot: 'paying-for-it.lede' },
        { t: 'prose', paragraphs: [PAYING.fund], slot: 'paying-for-it.fund' },
        { t: 'give', text: 'Give to the construction fund' },
        { t: 'small', text: PAYING.note, slot: 'paying-for-it.note' },
      ],
    },
  ],
};

/* ── The welcome tour, in TourScreen.tsx's order ───────────────────────── */

need(tour.HERO, 'tour.ts HERO');
need(tour.STATIONS, 'tour.ts STATIONS');

const WIDGETS = {
  hymn: 'A Coptic hymn, to listen to, is on the church’s website.',
  year: 'The Coptic year, month by month, is on the church’s website.',
  name: 'Writing your name in Coptic letters is on the church’s website.',
};

function block(b) {
  switch (b.kind) {
    case 'prose':
      return [{ t: 'prose', paragraphs: b.paragraphs }];
    case 'aside':
      return [{ t: 'aside', text: b.text }];
    case 'quote':
      return [{ t: 'quote', label: b.label, paragraphs: b.paragraphs }];
    case 'folds':
      return b.entries.map((entry) => ({
        t: 'fold',
        label: entry.label,
        ...(entry.aside ? { text: entry.aside } : {}),
        paragraphs: entry.body,
        ...(entry.parts ? { items: entry.parts.map((p) => ({ term: p.term, detail: p.detail })) } : {}),
      }));
    case 'sides':
      return b.sides.map((side) => ({
        t: 'list',
        label: side.label,
        items: side.items.map((item) => ({ term: item })),
      }));
    case 'steps':
      return [{
        t: 'steps',
        items: b.steps.map((s) => ({ term: s.title, note: s.service, paragraphs: s.body })),
      }];
    case 'hymn':
    case 'year':
    case 'name':
      return [{ t: 'elsewhere', text: WIDGETS[b.kind] }];
    default:
      throw new Error(`[clip-text] tour.ts has a block kind the clip does not know: ${b.kind}`);
  }
}

const welcome = {
  sections: [
    {
      ground: 'deep',
      blocks: [
        { t: 'eyebrow', text: tour.HERO.eyebrow, slot: 'tour-hero.eyebrow' },
        { t: 'title', text: tour.HERO.title, slot: 'tour-hero.title' },
        { t: 'lede', text: tour.HERO.lede, slot: 'tour-hero.lede' },
      ],
    },
    ...tour.STATIONS.map((station) => ({
      ground: 'plain',
      // A station is long; the clip folds each one shut under its heading.
      fold: true,
      number: station.number,
      blocks: [
        ...head(station.id, { title: station.title, lede: station.lede }),
        ...station.sections.flatMap((section) => [
          { t: 'subhead', text: section.title },
          ...section.blocks.flatMap(block),
        ]),
      ],
    })),
  ],
};

/* ── Out ───────────────────────────────────────────────────────────────── */

const json = JSON.stringify({ 'future-plans': futurePlans, 'welcome-newcomers': welcome });
if (json.includes('"""#')) throw new Error('[clip-text] the text contains the Swift raw-string terminator');

const swift = `// Generated by scripts/make-clip-text.mjs from src/about/future.ts and
// src/about/tour.ts. Do not edit: change those files and run \`npm run clip-text\`
// (prebuild runs it too). See that script's header for what this is.

enum AboutText {
    static let json = #"""
${json}
"""#
}
`;

writeFileSync(output, swift);
console.log(
  `[clip-text] wrote ${path.relative(root, output)} — ${(swift.length / 1024).toFixed(1)} KB, ` +
    `${futurePlans.sections.length} plan sections, ${tour.STATIONS.length} tour stations`,
);
