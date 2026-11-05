/**
 * The App Clip card images — one per experience, 1800x1200.
 *
 * ---------------------------------------------------------------------------
 * What this is for. There is one App Clip binary and **eight experiences**
 * registered against it in App Store Connect, each with its own invocation URL,
 * title, subtitle and *image*. This writes the eight images. The card is what
 * somebody sees at the bottom of the screen when they tap a tag by a door, and
 * it is the only thing about this app most of them will ever look at.
 *
 * ## It is the sticker's picture
 *
 * Somebody taps a tag by a door, and the card rises a second later. The tag has
 * a picture on it (the scene in `scripts/nfc-scenes/<slug>.svg`) and the card
 * shows the same one, whole, at the right, so they know at a glance that the
 * phone has understood which tag it was. The name sits in a maroon column on
 * the left, over the scene's own background carried on by `extendScene`, with
 * the church's name above it.
 *
 * This replaced a card modelled on Taksis's `car.png`: one flat symbol, lit, on
 * near-black. It matched Taksis, but a gift-box symbol said *a* gift; the scene
 * says this church's candles and offering box, and it matches the tag, which is
 * the thing in the person's hand.
 *
 * ## Apple's rules, and the one judgement call
 *
 * **1800x1200, PNG or JPEG, no alpha.** Flattened at the end for the same
 * reason Play's feature graphic is: the upload fails on transparency and the
 * difference is invisible until it does.
 *
 * Apple's guidance is that the header image should carry no text, because the
 * title and subtitle are separate fields drawn *under* it. This puts the name in
 * anyway, and the reason is the one Taksis already answered in practice: these
 * invocations are physical. Somebody is holding a phone over a tag by a door and
 * the card appears half-covered by their own hand — the image is the part they
 * see first, and a symbol alone does not say which of eight things they just
 * tapped. The subtitle still does the explaining; this only names it.
 *
 * ## Keeping it honest
 *
 * `CARDS` below must agree with `src/clip/experiences.ts`, which is the table
 * everything else is generated from. It is duplicated here rather than imported
 * because that file is TypeScript and this is a plain Node script, which is the
 * same reason `FEATURE` is duplicated in make-store-assets.mjs. `npm run
 * clip-cards` checks the slugs against it and fails if they have drifted.
 * ---------------------------------------------------------------------------
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { root, sharp } from './brand.mjs';
import { ACCENT, DEEP, GROUND_OUT, INK } from './clip-symbols.mjs';
import { extendScene, readScene } from './scene-art.mjs';

const run = promisify(execFile);

/** Apple's size for an App Clip card header image, and the only one it takes. */
const CARD = { width: 1800, height: 1200 };

/**
 * The eight, in the order they are registered, and Taksis's.
 *
 * `lines` is what is drawn on the image, one entry per line, and is *not*
 * always the App Store Connect `title`: the card sets the name large and
 * stacked in a column beside the picture, so "Send a Photograph" becomes
 * PHOTOGRAPHS and lets the title underneath say the rest. They are the
 * stickers' names, so the tag and the card say the same word.
 */
const CARDS = [
  { slug: 'give', lines: ['Give'] },
  { slug: 'schedule', lines: ['This', 'Week'] },
  { slug: 'apps', lines: ['Our', 'Apps'] },
  { slug: 'welcome', lines: ['Welcome'] },
  { slug: 'plans', lines: ['Our', 'Plans'] },
  { slug: 'bookstore', lines: ['Book-', 'store'] },
  { slug: 'forms', lines: ['Parish', 'Forms'] },
  { slug: 'photos', lines: ['Photo-', 'graphs'] },
  /*
   * Taksis's, not this app's: uploaded against Taksis's own App Clip
   * experience for /c/register-vehicle. Drawn here so it is laid out like the
   * other eight, but in Taksis's blue rather than the church's maroon: it is
   * the card for Taksis's App Clip, and should say Taksis.
   */
  { slug: 'register-vehicle', lines: ['Register', 'Car'], taksis: true, palette: 'taksis' },
];

/**
 * The card's colours. The church's are its theme's; Taksis's are its tint
 * (`#147efb`) on a navy panel, and its scene, drawn in the church's reds like
 * every scene, has its red and blue channels swapped — so the red car and the
 * red night sky turn blue, and the warm lights turn a cool white-blue with them.
 */
const PALETTES = {
  church: { deep: DEEP, accent: ACCENT, foot: GROUND_OUT, sceneFilter: null },
  taksis: {
    deep: '#071a33',
    accent: '#147efb',
    foot: '#020812',
    sceneFilter: '0 0 1 0 0  0 1 0 0 0  1 0 0 0 0  0 0 0 1 0',
  },
};

/**
 * One card, as SVG.
 *
 * The picture is the sticker's: the whole scene, 1200px square, standing at
 * the right of the card, with its backgrounds carried on leftwards by
 * `extendScene` under a maroon panel that holds the name. Somebody who has just
 * tapped a tag sees the same picture rise up their screen, and that is what
 * tells them they tapped the right thing; a symbol said *a* gift, and the scene
 * says this church's offering box.
 *
 * The name is stacked, one word to a line and a long word hyphenated, and sized by its
 * longest line so the column is as wide as the panel allows and no wider.
 */
function cardSvg({ lines, palette = 'church' }, scene) {
  const { width, height } = CARD;
  const { deep, accent, foot, sceneFilter } = PALETTES[palette];
  const sceneX = width - height;
  const scale = height / 400;

  const left = 130;
  const column = 600;
  const longest = Math.max(...lines.map((line) => line.length));
  const fontSize = Math.round(Math.min(160, column / (longest * 0.8)));
  const leading = fontSize * 1.02;
  const nameTop = height / 2 - ((lines.length - 1) * leading) / 2 + fontSize * 0.36;

  const escape = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <!-- The panel: solid behind the name, gone by the time it reaches the subject. -->
    <linearGradient id="panel" x1="0" y1="0" x2="${width}" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${deep}" stop-opacity="0.97"/>
      <stop offset="${(640 / width).toFixed(3)}" stop-color="${deep}" stop-opacity="0.9"/>
      <stop offset="${(930 / width).toFixed(3)}" stop-color="${deep}" stop-opacity="0"/>
    </linearGradient>
    <!-- A little weight at the foot, where the card meets the sheet's title. -->
    <linearGradient id="foot" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0.75" stop-color="${foot}" stop-opacity="0"/>
      <stop offset="1" stop-color="${foot}" stop-opacity="0.45"/>
    </linearGradient>
    ${sceneFilter ? `<filter id="recolour" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="${sceneFilter}"/></filter>` : ''}
  </defs>

  <rect width="${width}" height="${height}" fill="${deep}"/>
  ${scene ? `<g${sceneFilter ? ' filter="url(#recolour)"' : ''}><g transform="translate(${sceneX} 0) scale(${scale})">${extendScene(scene)}</g></g>` : ''}
  <rect width="${width}" height="${height}" fill="url(#panel)"/>
  <rect width="${width}" height="${height}" fill="url(#foot)"/>

  <text x="${left}" y="${nameTop - fontSize - 70}" font-family="Georgia" font-size="29" font-weight="bold"
        letter-spacing="5" fill="${INK}" opacity="0.8">ST. PHILOPATER &amp; ST. MINA</text>
  <rect x="${left}" y="${nameTop - fontSize - 40}" width="120" height="7" rx="3.5" fill="${accent}"/>

  ${lines
    .map(
      (line, i) => `<text x="${left - fontSize * 0.04}" y="${(nameTop + i * leading).toFixed(1)}" font-family="Georgia"
        font-size="${fontSize}" font-weight="bold" letter-spacing="${fontSize * 0.04}" fill="${INK}">${escape(line.toUpperCase())}</text>`,
    )
    .join('\n  ')}
</svg>`;
}

/**
 * Check the eight slugs still match `src/clip/experiences.ts`.
 *
 * Read as text rather than imported — that file is TypeScript. A regex over its
 * `slug:` lines is crude and is enough for the one failure that matters: an
 * experience added, removed or renamed there, leaving a card that names nothing
 * or an experience with no card. Silence here would mean uploading eight images
 * for nine experiences and not noticing until a tag showed the wrong one.
 */
async function checkAgainstExperiences() {
  const source = await readFile(join(root, 'src/clip/experiences.ts'), 'utf8');
  const table = source.slice(source.indexOf('export const EXPERIENCES'));
  const slugs = [...table.matchAll(/slug:\s*'([a-z-]+)'/g)].map((match) => match[1]);

  const mine = CARDS.filter((card) => !card.taksis).map((card) => card.slug);
  const missing = slugs.filter((slug) => !mine.includes(slug));
  const extra = mine.filter((slug) => !slugs.includes(slug));

  if (missing.length || extra.length) {
    throw new Error(
      'CARDS and src/clip/experiences.ts disagree.' +
        (missing.length ? ` No card for: ${missing.join(', ')}.` : '') +
        (extra.length ? ` No experience for: ${extra.join(', ')}.` : ''),
    );
  }

  return slugs.length;
}

async function main() {
  const counted = await checkAgainstExperiences();
  const out = join(root, 'store', 'clip-cards');
  await mkdir(out, { recursive: true });

  console.log(`App Clip cards — ${CARD.width}x${CARD.height}, ${counted} experiences.`);

  for (const card of CARDS) {
    const file = join(tmpdir(), `spsm-clip-${card.slug}.svg`);
    await writeFile(file, cardSvg(card, await readScene(card.slug)));

    const { stdout } = await run('rsvg-convert', [file], {
      encoding: 'buffer',
      maxBuffer: 128 * 1024 * 1024,
    });

    /*
     * Flattened onto the ground colour. Apple rejects a header image with an
     * alpha channel, and rsvg-convert always writes one.
     */
    const png = await sharp(stdout)
      .flatten({ background: GROUND_OUT })
      .png()
      .toBuffer();

    const meta = await sharp(png).metadata();
    if (meta.width !== CARD.width || meta.height !== CARD.height) {
      throw new Error(
        `${card.slug} rendered ${meta.width}x${meta.height}, not ${CARD.width}x${CARD.height}.`,
      );
    }
    if (meta.hasAlpha) {
      throw new Error(`${card.slug} still has an alpha channel; Apple will refuse it.`);
    }

    await writeFile(join(out, `${card.slug}.png`), png);
    console.log(`  ${card.slug.padEnd(16)} ${card.lines.join(' ').replace('- ', '')}${card.taksis ? '  (Taksis\'s, upload in Taksis)' : ''}`);
  }

  console.log(`\nWritten to store/clip-cards/. Upload each in App Store Connect →`);
  console.log(`Advanced App Clip Experiences → the experience for /c/<slug>.`);
}

await main();
