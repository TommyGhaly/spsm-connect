/**
 * The NFC tag stickers — one per App Clip link, Taksis's included.
 *
 * ---------------------------------------------------------------------------
 * What this is for. Each `/c/<slug>` URL is written to an NFC tag, and the tag
 * is stuck by a door, on a table or on the bookstall. The sticker over it has
 * to say what it is and what to do with it, and it says the first with a
 * picture rather than a paragraph. Top to bottom:
 *
 *   - the church's name over the rim, so it reads as the parish's tag;
 *   - the scene from `scripts/nfc-scenes/<slug>.svg`, filling the sticker;
 *   - the name, on a maroon shade that rises over the foot of the picture;
 *   - TAP YOUR PHONE, with the contactless mark;
 *   - the URL, lowercase and with `www.`, for a phone that cannot read NFC.
 *
 * ## No border, and why
 *
 * The printer (Seritag) cuts to about 1mm. A ring or a change of colour near the
 * cut shows plainly when the print lands off-centre, so nothing here is drawn
 * concentric with the edge: the picture and the shade run straight out to it.
 * An off-centre cut trims a sliver of picture, which nobody can see.
 *
 * ## The scenes
 *
 * Each is a standalone 400x400 SVG, opened on its own in any viewer to work on
 * it. Their ids are prefixed with the slug, because every one is inlined into a
 * sticker that has defs of its own. They have to render in librsvg, which is
 * what draws the PNGs: no `<textPath>`, no CSS, no `<foreignObject>`. Each is
 * framed by its entry in `FRAMING` (scene-art.mjs) and widened by
 * `extendScene`, so that its top and its subject both show.
 *
 * ## Size, and bleed
 *
 * Drawn on a 1000-unit circle. `store/nfc-stickers/<slug>.{svg,png}` is the
 * circle, 1200px (400 dpi at 3 inches), for looking at and for `sheet.png`.
 * `store/nfc-stickers/bleed/` is what goes to the printer: the same art on a
 * square carried `BLEED_MM` past the cut on every side, so a cut that wanders
 * lands on picture rather than on bare stock. `--only <slug>` renders one, which
 * is the loop for working on a scene.
 *
 * ## Taksis
 *
 * `/c/register-vehicle` is Taksis's, not this app's. Its sticker lives here and
 * wears the same colours because the tags are bought, printed and stuck up
 * together, and they should look like one set on the church's walls.
 * ---------------------------------------------------------------------------
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { root, sharp } from './brand.mjs';
import { INK } from './clip-symbols.mjs';
import { FRAMING, extendScene, readScene } from './scene-art.mjs';

const run = promisify(execFile);

const ORIGIN = 'www.spsmwayland.org';
const PNG_SIZE = 1200;
/** The sticker is 3 inches across, on a 1000-unit circle. */
const MM = 1000 / 76.2;
/** How far the printer's file carries the art past the cut. */
const BLEED_MM = 2;
const ONLY = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;

/*
 * One palette for all nine, Taksis's included: on a wall of tags they read as
 * one set, and the picture is what tells them apart. The church's maroon, with
 * the red pushed brighter than the theme's for a sticker lit by whatever is in
 * the room.
 */
const PALETTE = {
  ink: INK,
  maroon: '#7a1a12',
  deep: '#4f0e09',
  shade: '#1a0503',
  accent: '#c4261a',
  url: '#f3d7d2',
};

/** The nine. `label` is the sticker's name, set in tracked capitals. */
const STICKERS = [
  { slug: 'give', label: 'Give' },
  { slug: 'schedule', label: 'This Week' },
  { slug: 'apps', label: 'Our Apps' },
  /* Too long for the length rule below, so it carries its own size. */
  { slug: 'welcome', label: 'Welcome Newcomers', fontSize: 50 },
  { slug: 'plans', label: 'Our Plans' },
  { slug: 'bookstore', label: 'Bookstore' },
  { slug: 'forms', label: 'Church Forms' },
  { slug: 'photos', label: 'Photographs' },
  { slug: 'register-vehicle', label: 'Register Car', taksis: true },
];

const escape = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The contactless mark: a dot and three widening arcs, centred on 0,0. */
function contactless(color) {
  const arcs = [18, 34, 50]
    .map((r) => {
      const dy = r * 0.78;
      const dx = Math.sqrt(r * r - dy * dy);
      return `<path d="M${dx - 26} ${-dy}A${r} ${r} 0 0 1 ${dx - 26} ${dy}" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round"/>`;
    })
    .join('');
  return `<circle cx="-30" cy="0" r="7" fill="${color}"/>${arcs}`;
}

/*
 * Georgia Bold's advance widths for the rim's capitals, in ems — near enough
 * to space letters evenly around an arc.
 */
const ADVANCE = {
  ' ': 0.27, '.': 0.3, ',': 0.3, '·': 0.34, '&': 0.82,
  A: 0.73, B: 0.74, C: 0.72, D: 0.8, E: 0.7, F: 0.64, G: 0.78, H: 0.86, I: 0.42,
  K: 0.78, L: 0.66, M: 0.98, N: 0.8, O: 0.78, P: 0.68, R: 0.76, S: 0.62, T: 0.67,
  U: 0.8, V: 0.72, W: 1.05, X: 0.74, Y: 0.7,
};

/**
 * Text set around the rim, one rotated letter at a time — over the top, or
 * along the bottom reading left to right with its tops toward the centre.
 *
 * Not `<textPath>`, which librsvg does not implement: it renders nothing and
 * says nothing, so the rim simply comes out blank.
 */
function rim(text, color, c, { radius, size, tracking, bottom = false }) {
  const widths = [...text].map((ch) => (ADVANCE[ch] ?? 0.7) * size + tracking);
  const total = widths.reduce((a, b) => a + b, 0) - tracking;
  let angle = -total / radius / 2;
  return [...text]
    .map((ch, i) => {
      const mid = angle + (widths[i] - tracking) / 2 / radius;
      angle += widths[i] / radius;
      if (ch === ' ') return '';
      const x = c + radius * Math.sin(mid);
      const y = bottom ? c + radius * Math.cos(mid) : c - radius * Math.cos(mid);
      const deg = ((bottom ? -mid : mid) * 180) / Math.PI;
      return `<text transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${deg.toFixed(2)})" text-anchor="middle" font-family="Georgia" font-size="${size}" font-weight="bold" fill="${color}">${escape(ch)}</text>`;
    })
    .join('');
}

/**
 * One sticker. With `bleed`, the canvas grows `BLEED_MM` past the circle on
 * every side and nothing is clipped to it; without, it is the circle alone.
 */
function stickerSvg({ slug, label, fontSize: size_ }, scene, { bleed = false } = {}) {
  const p = PALETTE;
  const size = 1000;
  const c = size / 2;
  const b = bleed ? BLEED_MM * MM : 0;
  const box = `${-b} ${-b} ${size + 2 * b} ${size + 2 * b}`;
  const span = { x: -b, y: -b, w: size + 2 * b };

  /*
   * The scene is scaled so its `top` lands just under the rim's lettering and
   * its `focus` just over the name, and centred across. Wherever that leaves
   * the square short of the edge, `extendScene` has carried its background on.
   */
  const { top, focus } = FRAMING[slug];
  const scale = 610 / (focus - top);
  const sceneX = c - 200 * scale;
  const sceneY = 690 - focus * scale;

  const fontSize = size_ ?? Math.round(Math.min(64, 560 / Math.max(label.length, 5)));
  const url = `${ORIGIN}/c/${slug}`;
  const px = Math.round(PNG_SIZE * (size + 2 * b) / size);

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${px}" height="${px}" viewBox="${box}">
  <defs>
    <!-- Behind the church's name, so it reads over a bright sky. -->
    <linearGradient id="topShade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${p.shade}" stop-opacity="0.7"/>
      <stop offset="1" stop-color="${p.shade}" stop-opacity="0"/>
    </linearGradient>
    <!-- The shade the words sit on: clear over the picture, nearly solid by the URL. -->
    <linearGradient id="lowShade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${p.deep}" stop-opacity="0"/>
      <stop offset="0.25" stop-color="${p.deep}" stop-opacity="0.85"/>
      <stop offset="1" stop-color="${p.deep}" stop-opacity="0.97"/>
    </linearGradient>
    <clipPath id="disc"><circle cx="${c}" cy="${c}" r="${c}"/></clipPath>
  </defs>

  <g${bleed ? '' : ' clip-path="url(#disc)"'}>
    <rect x="${span.x}" y="${span.y}" width="${span.w}" height="${span.w}" fill="${p.deep}"/>
    ${scene ? `<g transform="translate(${sceneX.toFixed(1)} ${sceneY.toFixed(1)}) scale(${scale.toFixed(4)})">${extendScene(scene)}</g>` : ''}
    <rect x="${span.x}" y="${span.y}" width="${span.w}" height="${230 + b}" fill="url(#topShade)"/>
    <rect x="${span.x}" y="610" width="${span.w}" height="${390 + b}" fill="url(#lowShade)"/>
  </g>

  ${rim('ST. PHILOPATER & ST. MINA', p.ink, c, { radius: 436, size: 27, tracking: 5 })}

  <text x="${c}" y="752" text-anchor="middle" font-family="Georgia" font-size="${fontSize}"
        font-weight="bold" letter-spacing="${fontSize * 0.1}" fill="${p.ink}">${escape(label.toUpperCase())}</text>

  <rect x="${c - 220}" y="778" width="440" height="78" rx="39" fill="${p.ink}"/>
  <g transform="translate(${c - 160} 817) scale(0.72)">${contactless(p.accent)}</g>
  <text x="${c + 34}" y="828" text-anchor="middle" font-family="Georgia" font-size="31" font-weight="bold"
        letter-spacing="2" fill="${p.maroon}">TAP YOUR PHONE</text>

  <text x="${c}" y="900" text-anchor="middle" font-family="Georgia" font-size="23" fill="${p.url}">${escape(url)}</text>
</svg>`;
}

async function checkAgainstExperiences() {
  const source = await readFile(join(root, 'src/clip/experiences.ts'), 'utf8');
  const table = source.slice(source.indexOf('export const EXPERIENCES'));
  const slugs = [...table.matchAll(/slug:\s*'([a-z-]+)'/g)].map((match) => match[1]);
  const mine = STICKERS.filter((s) => !s.taksis).map((s) => s.slug);
  const missing = slugs.filter((slug) => !mine.includes(slug));
  const extra = mine.filter((slug) => !slugs.includes(slug));
  if (missing.length || extra.length) {
    throw new Error(
      'STICKERS and src/clip/experiences.ts disagree.' +
        (missing.length ? ` No sticker for: ${missing.join(', ')}.` : '') +
        (extra.length ? ` No experience for: ${extra.join(', ')}.` : ''),
    );
  }
}

async function main() {
  await checkAgainstExperiences();
  const out = join(root, 'store', 'nfc-stickers');
  await mkdir(out, { recursive: true });

  await mkdir(join(out, 'bleed'), { recursive: true });

  const pngs = [];
  for (const sticker of STICKERS.filter((s) => !ONLY || s.slug === ONLY)) {
    const scene = await readScene(sticker.slug);
    if (!scene) console.warn(`  ${sticker.slug}: no scene yet, picture left empty.`);

    for (const [dir, bleed] of [[out, false], [join(out, 'bleed'), true]]) {
      const svgFile = join(dir, `${sticker.slug}.svg`);
      await writeFile(svgFile, stickerSvg(sticker, scene, { bleed }));
      const { stdout } = await run('rsvg-convert', [svgFile], { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 });
      await writeFile(join(dir, `${sticker.slug}.png`), stdout);
      if (!bleed) pngs.push(stdout);
    }
    console.log(`  ${sticker.slug.padEnd(17)} https://${ORIGIN}/c/${sticker.slug}`);
  }

  if (ONLY) return;

  /* All nine on one sheet, for checking them side by side or sending a proof. */
  const cell = 600;
  const gap = 40;
  const cols = 3;
  const rows = Math.ceil(pngs.length / cols);
  const tiles = await Promise.all(pngs.map((png) => sharp(png).resize(cell, cell).toBuffer()));
  await sharp({
    create: {
      width: cols * cell + (cols + 1) * gap,
      height: rows * cell + (rows + 1) * gap,
      channels: 4,
      background: '#ece6e3',
    },
  })
    .composite(
      tiles.map((input, i) => ({
        input,
        left: gap + (i % cols) * (cell + gap),
        top: gap + Math.floor(i / cols) * (cell + gap),
      })),
    )
    .png()
    .toFile(join(out, 'sheet.png'));

  console.log(`\nWritten to store/nfc-stickers/ (circles, plus sheet.png) and bleed/ (${BLEED_MM}mm past the cut, for the printer).`);
}

await main();
