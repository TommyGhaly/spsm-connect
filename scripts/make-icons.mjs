#!/usr/bin/env node
/**
 * Build the app's icons from the parish seal.
 *
 * Run by hand, rarely — `npm run icons`. The outputs are committed; this exists
 * so that *how* they were made is recorded, and so the next person changing the
 * background colour does not have to redraw anything.
 *
 * ## Why these colours cannot come from the theme at runtime
 *
 * Everything else in this app reads `config/theme`, so the parish can restyle
 * itself without a release. An icon cannot: it is baked into the binary by the
 * OS installer, and a splash screen is drawn before any JavaScript has run.
 * `app.config.ts` already carries two documented literal-colour exceptions for
 * exactly this reason, and `BACKGROUND` below is the same exception — it must
 * stay equal to the `deep` token in `packages/shared/src/schema/theme.ts`.
 *
 * ## Why `deep` and not one of the other reds
 *
 * The seal's own arch is **#81171c**. `accentStrong` is #731d16 — near enough
 * identical that the arch, and the white lettering on it, dissolve into the
 * background. `accent` (#992a21) is lighter than the arch, which inverts the
 * figure/ground the seal was drawn with. `deep` (#481010) is darker than the
 * arch, so the arch still reads as a shape, and it is already the colour of the
 * app's navigation bar.
 *
 * ## Sharp comes from the Website repo
 *
 * Deliberately not a dependency of this app: it is a large native module needed
 * by one script that runs by hand. README.md already makes `../Website` a hard
 * environmental assumption, and `functions/` there uses sharp to transcode
 * every photograph the parish receives, so it is always present.
 */
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const websiteRoot = resolve(root, '../Website');

const require = createRequire(join(websiteRoot, 'package.json'));
let sharp;
try {
  sharp = require('sharp');
} catch {
  console.error(
    'Could not load sharp from ../Website/node_modules.\n' +
      'This script needs the Website repo checked out beside this one, with its\n' +
      'dependencies installed. See README.md.',
  );
  process.exit(1);
}

/** The master artwork. One file, in the Website repo, for both frontends. */
const LOGO_SVG = resolve(websiteRoot, 'assets/St Philopater & St. Mena Logo.svg');

/** `deep` in packages/shared/src/schema/theme.ts. Keep the two in step. */
const BACKGROUND = process.env.ICON_BACKGROUND ?? '#481010';

const OUT = resolve(root, 'assets');
const SIZE = 1024;

/**
 * How much of the canvas the seal fills, per output.
 *
 * iOS masks the icon to a squircle whose corners cut about 22% in, so 78% would
 * be touching. Android's adaptive icon is harsher still: the launcher may crop
 * to a circle of 66% diameter and animates within that, so anything outside the
 * inner two-thirds can be shaved off at any moment.
 */
const FILL = { ios: 0.74, androidForeground: 0.62, splash: 0.86 };

/**
 * The logo's first path is a **full-canvas white rectangle** — a background
 * plate, not artwork. Rendered as-is the seal comes out as a white sticker,
 * which on a dark red ground is worse than not having an icon at all.
 *
 * It is removed rather than worked around. Making white transparent after the
 * fact is not available: the seal has 39 other near-white paths in it — the
 * saints' robes, the highlights, the lettering — and a colour-keyed knockout
 * would eat them.
 *
 * Identified by the one coordinate only the plate has (it extends past the
 * viewBox), and the count is asserted. If the logo is ever redrawn and this
 * stops matching, this fails loudly rather than silently shipping the sticker.
 * `apps/website/public/brand/seal-*.png` are the same artwork already stripped,
 * which is the other way to confirm the plate is not meant to be there.
 */
const BACKGROUND_PLATE = /<path[^>]*?fill="#fdfdfd"[^>]*?\/>/g;

async function transparentSvg() {
  const original = await readFile(LOGO_SVG, 'utf8');
  const plates = (original.match(BACKGROUND_PLATE) ?? []).filter((path) =>
    path.includes('1441.985'),
  );

  if (plates.length !== 1) {
    throw new Error(
      `Expected exactly one full-canvas background plate in the logo, found ${plates.length}. ` +
        'The artwork has changed; check what is behind the seal before trusting this script.',
    );
  }

  const stripped = original.replace(plates[0], '');
  const file = join(tmpdir(), 'spsm-seal-transparent.svg');
  await writeFile(file, stripped);
  return file;
}

let transparentLogo = null;

async function seal(fraction) {
  transparentLogo ??= await transparentSvg();
  const width = Math.round(SIZE * fraction);
  // rsvg-convert rather than sharp's own SVG support: this file uses a
  // clipPath, and librsvg renders it faithfully where resvg has historically
  // not. The parish's logo is not the place to discover a rendering difference.
  // No `-o`: rsvg-convert writes to stdout by default, and naming /dev/stdout
  // explicitly fails with "Error truncating file" because it tries to open it
  // for writing rather than inheriting the pipe.
  const { stdout } = await run('rsvg-convert', ['-w', String(width), transparentLogo], {
    encoding: 'buffer',
    maxBuffer: 64 * 1024 * 1024,
  });
  return sharp(stdout);
}

/**
 * The seal centred on a transparent square, as a finished PNG buffer.
 *
 * A buffer rather than a sharp instance, and that is not a style choice. Sharp
 * applies operations in a **fixed pipeline order**, not call order: a `resize`
 * runs before a `composite` however it was chained. So
 * `centred(0.92).resize(48, 48)` shrinks the canvas to 48px first and then
 * tries to paste a 942px seal onto it — "Image to composite must have same
 * dimensions or smaller", about a composite the code never asked for second.
 * Returning a buffer forces a new pipeline for whatever the caller does next.
 */
async function centred(fraction) {
  const logo = await seal(fraction);
  return sharp({
    create: {
      width: SIZE,
      height: SIZE,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: await logo.png().toBuffer(), gravity: 'centre' }])
    .png()
    .toBuffer();
}

async function main() {
  await mkdir(OUT, { recursive: true });

  /*
   * The App Store rejects an icon with an alpha channel, so this one is
   * flattened rather than merely drawn on a coloured square — the difference is
   * invisible until the upload fails.
   */
  await writeFile(
    join(OUT, 'icon.png'),
    await sharp(await centred(FILL.ios)).flatten({ background: BACKGROUND }).png().toBuffer(),
  );

  /*
   * Transparent. `expo-splash-screen` draws it over its own `backgroundColor`,
   * which app.config.ts sets to the same value as BACKGROUND — baking the
   * colour in here as well would show a hard square edge on any device whose
   * splash is letterboxed.
   */
  await writeFile(join(OUT, 'splash-icon.png'), await centred(FILL.splash));

  // Android draws the foreground over the background layer, so this is
  // transparent and pulled well inside the safe zone.
  await writeFile(join(OUT, 'android-icon-foreground.png'), await centred(FILL.androidForeground));

  await writeFile(
    join(OUT, 'android-icon-background.png'),
    await sharp({ create: { width: SIZE, height: SIZE, channels: 3, background: BACKGROUND } })
      .png()
      .toBuffer(),
  );

  // The web favicon, which is the only one that wants the seal small and plain.
  await writeFile(
    join(OUT, 'favicon.png'),
    await sharp(await centred(0.92))
      .flatten({ background: BACKGROUND })
      .resize(48, 48)
      .png()
      .toBuffer(),
  );

  console.log(`Icons written to assets/ on ${BACKGROUND}.`);
  console.log('Note: android-icon-monochrome.png is NOT generated — a themed');
  console.log('icon is a single-colour silhouette, and this seal has no');
  console.log('meaningful one. It needs drawing by hand or dropping.');
}

await main();
