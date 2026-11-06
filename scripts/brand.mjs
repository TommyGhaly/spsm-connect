/**
 * Rendering the church's brand — the seal, and type set in the app's face.
 *
 * Extracted from make-icons.mjs when a second script wanted the same seal:
 * make-store-assets.mjs, which builds the Play Store feature graphic and the
 * framed screenshots. Both need the background plate stripped, the artwork
 * trimmed to its own ink, and the wordmark shaped through the same font, and
 * all three of those are subtle enough that a second copy would drift.
 *
 * Nothing here decides how big anything is or what colour it sits on. Those
 * are the callers' business — an icon's fill fraction and a feature graphic's
 * layout have nothing to say to each other — so this module renders and the
 * scripts compose.
 *
 * ## Sharp comes from the Website repo
 *
 * Deliberately not a dependency of this app: it is a large native module
 * needed by scripts that run by hand. README.md already makes `../Website` a
 * hard environmental assumption, and `functions/` there uses sharp to
 * transcode every photograph the church receives, so it is always present.
 */
import { Buffer } from 'node:buffer';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));

export const root = resolve(here, '..');
const websiteRoot = resolve(root, '../Website');

const require = createRequire(join(websiteRoot, 'package.json'));
let loaded;
try {
  loaded = require('sharp');
} catch {
  console.error(
    'Could not load sharp from ../Website/node_modules.\n' +
      'This script needs the Website repo checked out beside this one, with its\n' +
      'dependencies installed. See README.md.',
  );
  process.exit(1);
}

/** Sharp, loaded from ../Website. Re-exported so callers need not repeat the above. */
export const sharp = loaded;

/** The master artwork. One file, in the Website repo, for both frontends. */
const LOGO_SVG = resolve(websiteRoot, 'assets/St Philopater & St. Mena Logo.svg');

/**
 * The theme's two baked colours.
 *
 * Everything else in this app reads `config/theme`, so the church can restyle
 * itself without a release. An icon cannot: it is baked into the binary by the
 * OS installer, and a splash screen is drawn before any JavaScript has run. A
 * store listing is the same kind of thing — it is uploaded, not rendered — so
 * these must stay equal to the `deep` and `inkInverse` tokens in
 * `packages/shared/src/schema/theme.ts`.
 *
 * On why `deep` rather than one of the other reds: the seal's own arch is
 * **#81171c**. `accentStrong` is #731d16 — near enough identical that the arch,
 * and the white lettering on it, dissolve into the background. `accent`
 * (#992a21) is lighter than the arch, which inverts the figure/ground the seal
 * was drawn with. `deep` is darker than the arch, so the arch still reads as a
 * shape, and it is already the colour of the app's navigation bar.
 */
export const BACKGROUND = process.env.ICON_BACKGROUND ?? '#481010';
export const INK_INVERSE = process.env.ICON_INK ?? '#f9efec';

/**
 * The canvas the seal is composed on, and the size of every square icon.
 *
 * Also the resolution `ink()` works at, doubled — see there.
 */
export const SIZE = 1024;

/**
 * The face the app sets its headings in, and how it sets them.
 *
 * `font.display.ios` in theme.ts — the same face the drawer masthead sets the
 * church's name in. Georgia is a system font on macOS, so it is here to be
 * rendered with; it is a system font on iOS too, and Android's `serif` is near
 * enough that baked images and the app's own headings do not read as two
 * different brands.
 *
 * `trackingEm` is `letterSpacing.wide` (0.06em) rather than a number picked by
 * eye. Light type on a dark ground closes up optically — the strokes bloom into
 * the counters — and `wide` is the theme's own answer to that.
 */
export const DISPLAY = { family: 'Georgia', trackingEm: 0.06 };

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

  /*
   * The red arch is the path straight after the plate — see GROUND below for
   * why it is wanted on its own. Asserted for the same reason the plate is.
   */
  const afterPlate = original.slice(original.indexOf(plates[0]) + plates[0].length);
  const arch = afterPlate.match(/<path[^>]*?\/>/)?.[0] ?? '';
  if (!arch.includes(`fill="${ARCH_RED}"`)) {
    throw new Error(
      `Expected the path after the background plate to be the ${ARCH_RED} arch. ` +
        'The artwork has changed; check GROUND in brand.mjs before trusting this script.',
    );
  }

  const stripped = original.replace(plates[0], '');
  const file = join(tmpdir(), 'spsm-seal-transparent.svg');
  await writeFile(file, stripped);

  const archFile = join(tmpdir(), 'spsm-seal-arch.svg');
  await writeFile(archFile, `${original.match(/<svg[^>]*>/)[0]}${arch}</svg>`);

  return { file, archFile };
}

/**
 * The white inside the arch, carried down under the saints' feet to the ribbon.
 *
 * The seal's white field is not one shape. Most of it is two white paths
 * inside the arch, and they stop where the arch does, level with the camels;
 * below that, under St. Mina's feet and between the horse's legs, the artwork
 * relied on the plate stripped above to be white. With the plate gone those
 * pockets show the icon's red ground, and the seal reads as a white dome with
 * the saints standing on a red floor. Tommy: *"the white inner circle should
 * include the part under the saint's legs and that should happen everywhere."*
 *
 * Put back by filling rather than by restoring the plate, since the plate is a
 * rectangle and the whole point of stripping it was that nothing outside the
 * seal is white. What is filled is every transparent pocket enclosed by the
 * artwork. That alone fills nothing, because the arch's two ends stop short of
 * the ribbon and each pocket leaks out through the gap; so for the fill only,
 * a wall is dropped straight down from the inside edge of each end of the arch,
 * which is the line the white field's own sides were already following. The
 * ribbon closes the bottom.
 *
 * Grown by `bleed` pixels before it is painted, so the white runs under the
 * antialiased edge of the artwork around it rather than leaving a hairline of
 * red between the two.
 */
const GROUND = { colour: '#fefefe', alphaCutoff: 128, wall: 2, bleed: 3 };

/** The arch's own red, which is how its path is recognised. */
const ARCH_RED = '#81171c';

async function rasterise(file, width) {
  // rsvg-convert rather than sharp's own SVG support: this file uses a
  // clipPath, and librsvg renders it faithfully where resvg has historically
  // not. The church's logo is not the place to discover a rendering difference.
  // No `-o`: rsvg-convert writes to stdout by default, and naming /dev/stdout
  // explicitly fails with "Error truncating file" because it tries to open it
  // for writing rather than inheriting the pipe.
  const { stdout } = await run('rsvg-convert', ['-w', String(width), file], {
    encoding: 'buffer',
    maxBuffer: 64 * 1024 * 1024,
  });
  return sharp(stdout).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
}

/** The seal at `width`, with GROUND painted under it, as a PNG buffer. */
async function sealOnGround({ file, archFile }, width) {
  const { data, info } = await rasterise(file, width);
  const { data: arch } = await rasterise(archFile, width);
  const { width: W, height: H } = info;
  const solid = (buffer, i) => buffer[i * 4 + 3] >= GROUND.alphaCutoff;

  const wall = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) wall[i] = solid(data, i) ? 1 : 0;

  // One wall per side, from the arch's lowest row on that side down.
  const middle = W >> 1;
  for (const [from, to, step] of [
    [middle, -1, -1],
    [middle, W, 1],
  ]) {
    let end = -1;
    for (let y = H - 1; y >= 0 && end < 0; y--) {
      for (let x = from; x !== to; x += step) if (solid(arch, y * W + x)) end = y;
    }
    // A few rows up, so the wall starts inside the arch rather than at its tip.
    const top = end - 3 * GROUND.wall;
    let inside = -1;
    for (let x = from; x !== to && inside < 0; x += step) if (solid(arch, top * W + x)) inside = x;
    if (end < 0 || inside < 0) throw new Error('Could not find the ends of the arch.');
    for (let y = top; y < H; y++) {
      for (let dx = -GROUND.wall; dx <= GROUND.wall; dx++) wall[y * W + inside + dx] = 1;
    }
  }

  // Flood the outside in from the canvas edge; what it cannot reach is enclosed.
  const outside = new Uint8Array(W * H);
  const stack = [];
  for (let x = 0; x < W; x++) stack.push(x, (H - 1) * W + x);
  for (let y = 0; y < H; y++) stack.push(y * W, y * W + W - 1);
  while (stack.length) {
    const i = stack.pop();
    if (outside[i] || wall[i]) continue;
    outside[i] = 1;
    const x = i % W;
    if (x > 0) stack.push(i - 1);
    if (x < W - 1) stack.push(i + 1);
    if (i >= W) stack.push(i - W);
    if (i < W * (H - 1)) stack.push(i + W);
  }

  const pockets = Buffer.alloc(W * H);
  for (let i = 0; i < W * H; i++) if (!outside[i] && !solid(data, i)) pockets[i] = 255;
  const mask = await sharp(pockets, { raw: { width: W, height: H, channels: 1 } })
    .dilate(GROUND.bleed)
    .extractChannel(0)
    .raw()
    .toBuffer();

  const [r, g, b] = [1, 3, 5].map((at) => parseInt(GROUND.colour.slice(at, at + 2), 16));
  const ground = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    if (mask[i]) ground.set([r, g, b, 255], i * 4);
  }

  const artwork = await sharp(data, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
  return sharp(ground, { raw: { width: W, height: H, channels: 4 } })
    .composite([{ input: artwork }])
    .png()
    .toBuffer();
}

let transparentLogo = null;
let inkBuffer = null;

/**
 * The seal rendered and cropped to its own ink, once, at 2x.
 *
 * Cropped because the logo is a document rather than an icon: it has margins,
 * and they are not symmetric — 2% a side across, 4% above and below. Left in,
 * they are indistinguishable from the icon's background and so read as border
 * on top of whatever border a caller's fill asks for, which is what made the
 * icon look mostly red. Taking them off here means a fill fraction says what
 * it appears to say.
 *
 * 2x so that every caller is scaling the artwork *down*. The largest output
 * wants 0.9 * 1024 = 922px of a seal whose ink is 96% of the render, and at 1x
 * that would be an upscale of a raster — small, but on the sharpest edge in
 * the app, the white lettering on the arch.
 *
 * `threshold: 0` trims only fully-transparent pixels, so the antialiased edge
 * of the lettering survives rather than being shaved.
 */
async function ink() {
  transparentLogo ??= await transparentSvg();
  const seal = await sealOnGround(transparentLogo, SIZE * 2);
  return sharp(seal).trim({ threshold: 0 }).png().toBuffer();
}

/**
 * The trimmed seal, fitted inside a square of `box` pixels.
 *
 * `fit: 'inside'` rather than a bare width because the crop is what decides the
 * aspect now, and hard-coding which side binds would silently letterbox if the
 * logo is ever redrawn taller than it is wide.
 *
 * Returns a **buffer** rather than a sharp instance, and that is not a style
 * choice. Sharp applies operations in a **fixed pipeline order**, not call
 * order: a `resize` runs before a `composite` however it was chained. So
 * handing back a live pipeline invites `seal(x).resize(48, 48)`, which shrinks
 * the canvas first and then tries to paste a 942px seal onto it — "Image to
 * composite must have same dimensions or smaller", about a composite the code
 * never asked for second. A buffer forces a new pipeline for whatever comes
 * next.
 */
export async function sealPixels(box) {
  inkBuffer ??= await ink();
  return sharp(inkBuffer)
    .resize({ width: box, height: box, fit: 'inside' })
    .png()
    .toBuffer();
}

/** The trimmed seal fitted inside a `fraction`-of-`SIZE` square. */
export async function seal(fraction) {
  return sealPixels(Math.round(SIZE * fraction));
}

/**
 * Type, rendered and cropped to its own ink.
 *
 * Trimmed because slack in the canvas becomes invisible margin, which makes
 * type smaller than whatever sizes it later thinks it asked for. On type the
 * trim does a second job: it crops to the cap line and the baseline, so the
 * height *is* the cap height and the image is centred on the letters rather
 * than on a line box whose leading nobody chose. `threshold: 0` takes only
 * fully transparent pixels, so the antialiased edges of the serifs survive.
 *
 * rsvg-convert rather than sharp's own SVG support, as with the seal, and here
 * for a second reason as well: librsvg shapes text through Pango against the
 * system's real fonts, where resvg needs fonts handed to it explicitly. A
 * missing font is not a loud failure in either — it is a fallback face, and
 * nobody notices until the artwork is on a phone or in a store listing.
 *
 * Drawn far larger than it is ever shown and scaled down, exactly as the seal
 * is; a serif with hairlines in it is the sharpest artwork this app has
 * anywhere. The canvas is deliberately far bigger than the text and asserted
 * afterwards, because text has no bounding box until it is shaped — the only
 * honest way to know a string fits is to draw it and look. A longer one
 * silently clipped at the canvas edge would leave a word with its last letter
 * shaved off.
 */
export async function typeInk(text, { fontSize = 400, fill = INK_INVERSE, weight = 'normal' } = {}) {
  const canvas = { width: fontSize * 10 * Math.max(1, text.length / 12), height: fontSize * 2 };
  /*
   * Escaped, because the church's name has an ampersand in it and a raw `&` is
   * not a parse error rsvg-convert explains — it fails with "Error reading
   * SVG" and no line number, which is a genuinely slow thing to diagnose from
   * a caller that only passed a string.
   */
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}">` +
    `<text x="${canvas.width / 2}" y="${canvas.height * 0.7}" text-anchor="middle" ` +
    `font-family="${DISPLAY.family}" font-size="${fontSize}" font-weight="${weight}" ` +
    `letter-spacing="${DISPLAY.trackingEm * fontSize}" fill="${fill}">` +
    `${escaped}</text></svg>`;

  const file = join(tmpdir(), `spsm-type-${Buffer.from(text).toString('hex').slice(0, 24)}.svg`);
  await writeFile(file, svg);
  const { stdout } = await run('rsvg-convert', [file], {
    encoding: 'buffer',
    maxBuffer: 64 * 1024 * 1024,
  });

  const trimmed = await sharp(stdout).trim({ threshold: 0 }).png().toBuffer();
  const { width, height } = await sharp(trimmed).metadata();

  // Half a font size of slack a side. Anything less and the glyph nearest the
  // edge is close enough that its antialiasing may already have been cut.
  if (width > canvas.width - fontSize || height > canvas.height - fontSize) {
    throw new Error(
      `"${text}" is too big for the canvas it is drawn on ` +
        `(${width}x${height} of ${canvas.width}x${canvas.height}), so it may be clipped. ` +
        'Widen `canvas` in typeInk().',
    );
  }

  return trimmed;
}

/** A solid rectangle of `colour`, as a PNG buffer. */
export function plate(width, height, colour = BACKGROUND) {
  return sharp({ create: { width, height, channels: 3, background: colour } })
    .png()
    .toBuffer();
}

/** A transparent rectangle, as a sharp pipeline ready to be composited onto. */
export function blank(width, height) {
  return sharp({
    create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  });
}
