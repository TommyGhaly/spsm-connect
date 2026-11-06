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
 * Every paragraph, heading, figure, list and timeline entry, and every
 * picture — but as a *path*, not a file. The pictures are the website's
 * `/img/...`, the same files `src/about/media.ts` points the app at, and the
 * clip fetches them over the network as it does the church's edits; the 15 MB
 * budget never sees them. A picture that does not arrive leaves its space and
 * its caption, and the words read whole without it. Not the flythrough, or the
 * tour's three interactive widgets — the hymn, the year and the name in Coptic
 * letters — which say so where they would be.
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
 * `./parts` is React, and only its types are imported, so it resolves to an
 * empty module and the type-only import is stripped before it is ever asked
 * for. `./media` is the real file: it is the one place the app names where a
 * picture lives, and the clip should not keep a second copy of those patterns.
 * Node's own type stripping does the rest — these files are plain data with
 * annotations.
 */
register(
  `data:text/javascript,${encodeURIComponent(`
    export async function resolve(specifier, context, next) {
      if (specifier === './parts') {
        return { url: 'data:text/javascript,', shortCircuit: true };
      }
      if (specifier === './media') {
        return next('./media.ts', context);
      }
      return next(specifier, context);
    }
  `)}`,
);

const about = (name) => pathToFileURL(path.join(root, 'src/about', name)).href;
const future = await import(about('future.ts'));
const tour = await import(about('tour.ts'));

/**
 * `media.ts` answers with an absolute URL on the app's origin. The clip has its
 * own (`ClipConfig.origin`, a build setting), so it gets the path alone and
 * resolves it there — a clip pointed at staging gets staging's pictures.
 */
const pathOf = (url) => new URL(url).pathname;

/** `Plate` in parts.tsx: one picture at column width, its caption under it. */
const plate = (name, captionSlot) => {
  const meta = need(future.FUTURE_PICTURES[name], `future.ts FUTURE_PICTURES.${name}`);
  return {
    t: 'plate',
    src: pathOf(future.future(name)),
    alt: meta.alt,
    text: meta.caption,
    ...(captionSlot ? { slot: captionSlot } : {}),
    aspect: meta.width / meta.height,
  };
};

function need(value, name) {
  if (value === undefined || value === null) {
    throw new Error(`[clip-text] ${name} is missing from src/about — the clip would lose a section.`);
  }
  return value;
}

/* ── Future Plans, in FutureScreen.tsx's order ─────────────────────────── */

const {
  HERO, WHAT, HEADLINE, BUILDING_A, BUILDING_B, BUILDING_C, ALL_OF_IT, BY_USE,
  THE_LAND, WHERE_IT_STANDS, PROGRESS, WHO_IS_DRAWING, TEAM, PAYING, MORE_VIEWS,
  FUTURE_GALLERY,
} = future;

for (const [name, value] of Object.entries({
  HERO, WHAT, HEADLINE, BUILDING_A, BUILDING_B, BUILDING_C, ALL_OF_IT, BY_USE,
  THE_LAND, WHERE_IT_STANDS, PROGRESS, WHO_IS_DRAWING, TEAM, PAYING, MORE_VIEWS,
  FUTURE_GALLERY,
})) need(value, `future.ts ${name}`);

/** `Head` in parts.tsx: `${band}.eyebrow`, `.h2`, `.lede`. */
const head = (band, { eyebrow, title, lede }) => [
  ...(eyebrow ? [{ t: 'eyebrow', text: eyebrow, slot: `${band}.eyebrow` }] : []),
  { t: 'title', text: title, slot: `${band}.h2` },
  ...(lede ? [{ t: 'lede', text: lede, slot: `${band}.lede` }] : []),
];

const building = (band, b, ground, plates) => ({
  ground,
  blocks: [
    { t: 'eyebrow', text: b.tag },
    ...head(band, { title: b.title }),
    { t: 'prose', paragraphs: b.body, slot: `${band}.body` },
    ...plates,
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
      // The flythrough's poster, where FutureScreen puts the film. The film
      // itself stays on the website; the still is the first thing it shows.
      ground: 'plain',
      blocks: [plate('approach')],
    },
    {
      ground: 'plain',
      blocks: [
        ...head('what-is-being-built', { title: WHAT.title }),
        { t: 'prose', paragraphs: WHAT.body, slot: 'what-is-being-built.body' },
        plate('campus-aerial', 'what-is-being-built.cap-campus-aerial'),
        { t: 'figures', items: HEADLINE.map((f) => ({ value: f.value, label: f.label, note: f.note })) },
        plate('piazza', 'what-is-being-built.cap-piazza'),
      ],
    },
    building('the-church', BUILDING_A, 'sunken', [
      plate('steps', 'the-church.cap-steps'),
      plate('west-front', 'the-church.cap-west-front'),
    ]),
    building('youth-and-housing', BUILDING_B, 'plain', [
      plate('youth-center', 'youth-and-housing.cap-youth-center'),
    ]),
    building('the-diocese-centre', BUILDING_C, 'sunken', [
      plate('diocese-center', 'the-diocese-centre.cap-diocese-center'),
    ]),
    {
      ground: 'plain',
      blocks: [
        ...head('more-views', MORE_VIEWS),
        {
          t: 'strip',
          // The 480 tiles are cropped to one size by the optimiser and carry
          // no dimensions; 16:9 is the frame, as FutureScreen says.
          items: Object.entries(future.FUTURE_GALLERY).map(([name, meta]) => ({
            src: pathOf(future.galleryThumb(name)),
            alt: meta.alt,
            note: meta.caption,
            aspect: 16 / 9,
          })),
        },
      ],
    },
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
        plate('roofs-aerial', 'the-land.cap-roofs-aerial'),
        plate('site-plan', 'the-land.cap-site-plan'),
        { t: 'prose', paragraphs: THE_LAND.body, slot: 'the-land.body' },
        plate('massing', 'the-land.cap-massing'),
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
        // The pictures before the words, as TourScreen draws them: somebody at
        // a station wants to see the thing before reading about it.
        {
          t: 'strip',
          items: station.pictures.map((name) => {
            const meta = need(tour.TOUR_PICTURES[name], `tour.ts TOUR_PICTURES.${name}`);
            return {
              src: pathOf(tour.tourSmall(name)),
              alt: meta.alt,
              note: meta.caption,
              aspect: meta.width / meta.height,
            };
          }),
        },
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
