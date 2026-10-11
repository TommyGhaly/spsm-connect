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
 *   - an illustration in a gold-framed window — a scene, not an icon, from
 *     `scripts/nfc-scenes/<slug>.svg`;
 *   - the name;
 *   - TAP YOUR PHONE, with the contactless mark;
 *   - the URL, lowercase and with `www.`, for a phone that cannot read NFC.
 *
 * ## The scenes
 *
 * Each is a standalone 400x400 SVG, drawn to be clipped to the circle of radius
 * 200 at its centre, and opened on its own in any viewer to work on it. Their
 * ids are prefixed with the slug, because every one is inlined into a sticker
 * that has defs of its own. They have to render in librsvg, which is what
 * draws the PNGs: no `<textPath>`, no CSS, no `<foreignObject>`.
 *
 * ## Size
 *
 * Drawn on a 1000-unit circle and written as SVG (scales to anything) and as a
 * 1200x1200 PNG with a transparent corner, which is 400 dpi at 3 inches. Sticker
 * printers that cut to shape add their own bleed from the circle's edge; for one
 * that wants it in the file, `--bleed` paints the ground out to the square.
 * `--only <slug>` renders one, which is the loop for working on a scene.
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

const run = promisify(execFile);

const ORIGIN = 'www.spsmwayland.org';
const PNG_SIZE = 1200;
const BLEED = process.argv.includes('--bleed');
const ONLY = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;

/*
 * One palette for all nine, Taksis's included: on a wall of tags they read as
 * one set, and the illustration is what tells them apart.
 *
 * The church's maroon and the website's gold (`--color-gold`, #b08d43), both
 * pushed brighter than the theme's own values. The theme is tuned for text on
 * a screen; a sticker on a church wall is lit by whatever is in the room and
 * has to carry from across it.
 */
const PALETTE = {
  ink: INK,
  accent: '#c4261a',
  groundIn: '#6a1811',
  groundOut: '#330906',
  band: '#a8231a',
  bandEdge: '#6a120b',
  trimHigh: '#fff0b8',
  trim: '#dcae45',
  trimLow: '#a07824',
  lettering: '#ffeab0',
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
  { slug: 'forms', label: 'Parish Forms' },
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
 * A Coptic cross, centred on 0,0 and `s` across: four equal arms, each ending
 * in the three knobs that make it Coptic rather than Greek.
 */
function copticCross(s, fill) {
  const arm = `
    <rect x="${-0.1 * s}" y="${-0.36 * s}" width="${0.2 * s}" height="${0.36 * s}" rx="${0.03 * s}"/>
    <circle cx="0" cy="${-0.42 * s}" r="${0.08 * s}"/>
    <circle cx="${-0.12 * s}" cy="${-0.34 * s}" r="${0.065 * s}"/>
    <circle cx="${0.12 * s}" cy="${-0.34 * s}" r="${0.065 * s}"/>`;
  return `<g fill="${fill}">${[0, 90, 180, 270]
    .map((deg) => `<g transform="rotate(${deg})">${arm}</g>`)
    .join('')}<circle r="${0.14 * s}"/></g>`;
}

/** Dots evenly round a circle — the beading inside the ribbon. */
function beads(c, radius, count, r, fill, opacity) {
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2;
    return `<circle cx="${(c + radius * Math.sin(a)).toFixed(1)}" cy="${(c - radius * Math.cos(a)).toFixed(1)}" r="${r}"/>`;
  })
    .join('')
    .replace(/^/, `<g fill="${fill}" opacity="${opacity}">`)
    .concat('</g>');
}

/** A scene file's contents, re-rooted in a window `size` across at x, y. */
function window_(scene, x, y, size) {
  const inner = scene.slice(scene.indexOf('>', scene.indexOf('<svg')) + 1, scene.lastIndexOf('</svg>'));
  return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 400 400">${inner}</svg>`;
}

function stickerSvg({ slug, label, fontSize: size_ }, scene) {
  const p = PALETTE;
  const size = 1000;
  const c = size / 2;

  /* The ribbon is the band between these two; the field is inside it. */
  const outer = 488;
  const field = 418;
  const view = { cy: 322, r: 214 };

  const fontSize = size_ ?? Math.round(Math.min(78, 560 / Math.max(label.length, 5)));
  const url = `${ORIGIN}/c/${slug}`;

  const ground = BLEED
    ? `<rect width="${size}" height="${size}" fill="url(#band)"/>`
    : `<circle cx="${c}" cy="${c}" r="${c}" fill="url(#band)"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <radialGradient id="band" cx="50%" cy="50%" r="50%">
      <stop offset="80%" stop-color="${p.band}"/>
      <stop offset="100%" stop-color="${p.bandEdge}"/>
    </radialGradient>
    <radialGradient id="ground" cx="50%" cy="36%" r="60%">
      <stop offset="0%" stop-color="${p.groundIn}"/>
      <stop offset="100%" stop-color="${p.groundOut}"/>
    </radialGradient>
    <linearGradient id="trim" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${p.trimHigh}"/>
      <stop offset="50%" stop-color="${p.trim}"/>
      <stop offset="100%" stop-color="${p.trimLow}"/>
    </linearGradient>
    <!-- The scenes were drawn dim and candlelit; this lifts them to match the frame. -->
    <filter id="vivid" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
      <feColorMatrix type="saturate" values="1.3"/>
      <feComponentTransfer>
        <feFuncR type="linear" slope="1.12" intercept="0.02"/>
        <feFuncG type="linear" slope="1.12" intercept="0.02"/>
        <feFuncB type="linear" slope="1.12" intercept="0.02"/>
      </feComponentTransfer>
    </filter>
    <clipPath id="viewClip"><circle cx="${c}" cy="${view.cy}" r="${view.r}"/></clipPath>
  </defs>

  ${ground}
  <circle cx="${c}" cy="${c}" r="${outer}" fill="none" stroke="url(#trim)" stroke-width="7"/>
  <circle cx="${c}" cy="${c}" r="${outer - 11}" fill="none" stroke="${p.trim}" stroke-width="1.5" opacity="0.7"/>
  ${rim('ST. PHILOPATER & ST. MINA', p.lettering, c, { radius: 436, size: 30, tracking: 5 })}
  <g transform="translate(${c - 451} ${c})">${copticCross(34, 'url(#trim)')}</g>
  <g transform="translate(${c + 451} ${c})">${copticCross(34, 'url(#trim)')}</g>
  <g transform="translate(${c} ${c + 451})">${copticCross(30, 'url(#trim)')}</g>

  <circle cx="${c}" cy="${c}" r="${field}" fill="url(#ground)"/>
  <circle cx="${c}" cy="${c}" r="${field}" fill="none" stroke="url(#trim)" stroke-width="5"/>
  ${beads(c, field - 12, 96, 2.6, p.trim, 0.75)}

  <circle cx="${c}" cy="${view.cy}" r="${view.r}" fill="${p.groundOut}"/>
  <g clip-path="url(#viewClip)"><g filter="url(#vivid)">${scene ? window_(scene, c - view.r, view.cy - view.r, view.r * 2) : ''}</g></g>
  <circle cx="${c}" cy="${view.cy}" r="${view.r}" fill="none" stroke="url(#trim)" stroke-width="8"/>
  <circle cx="${c}" cy="${view.cy}" r="${view.r + 10}" fill="none" stroke="${p.trim}" stroke-width="1.5" opacity="0.7"/>

  <text x="${c}" y="${view.cy + view.r + 92}" text-anchor="middle" font-family="Georgia" font-size="${fontSize}"
        font-weight="bold" letter-spacing="${fontSize * 0.1}" fill="${p.ink}">${escape(label.toUpperCase())}</text>

  <rect x="${c - 220}" y="676" width="440" height="78" rx="39" fill="${p.accent}" stroke="url(#trim)" stroke-width="3"/>
  <g transform="translate(${c - 160} 715) scale(0.72)">${contactless(p.ink)}</g>
  <text x="${c + 34}" y="726" text-anchor="middle" font-family="Georgia" font-size="31" font-weight="bold"
        letter-spacing="2" fill="${p.ink}">TAP YOUR PHONE</text>

  <text x="${c}" y="812" text-anchor="middle" font-family="Georgia" font-size="25" fill="${p.ink}" opacity="0.85">${escape(url)}</text>
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

  const pngs = [];
  for (const sticker of STICKERS.filter((s) => !ONLY || s.slug === ONLY)) {
    const scene = await readFile(join(root, 'scripts', 'nfc-scenes', `${sticker.slug}.svg`), 'utf8').catch(() => {
      console.warn(`  ${sticker.slug}: no scene yet, window left empty.`);
      return null;
    });
    const svgFile = join(out, `${sticker.slug}.svg`);
    await writeFile(svgFile, stickerSvg(sticker, scene));
    const { stdout } = await run('rsvg-convert', ['-w', String(PNG_SIZE), '-h', String(PNG_SIZE), svgFile], {
      encoding: 'buffer',
      maxBuffer: 64 * 1024 * 1024,
    });
    await writeFile(join(out, `${sticker.slug}.png`), stdout);
    pngs.push(stdout);
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

  console.log(`\nWritten to store/nfc-stickers/ (${BLEED ? 'square bleed' : 'circle'}), plus sheet.png.`);
}

await main();
