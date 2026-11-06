/**
 * The illustrated scenes in `scripts/nfc-scenes/`, made ready to place.
 *
 * ---------------------------------------------------------------------------
 * Shared by make-nfc-stickers.mjs and make-clip-cards.mjs, because the tag and
 * the card somebody sees a second after tapping it should be the same picture.
 *
 * Each scene is a 400x400 square, but neither the sticker nor the card shows
 * one as a square. The sticker shrinks each scene until both its top and its
 * subject fit between the rim and the words, and the card stands a whole scene
 * beside a panel of type. Either way there is more to fill than the square, so
 * `extendScene` carries each scene's full-width backgrounds (sky, wall, lawn,
 * floor, desk) out past its edges. It does not blur and it does not repeat
 * anything: the wall keeps going, and so does the lawn.
 *
 * It works by rewriting the scenes' own shapes, so it holds only while they are
 * drawn the way they are now: backgrounds as `<rect>`s or `M0 …` paths that span
 * the full width. A new scene drawn the same way extends for free; one that is
 * not shows its square's edge, which the sheet makes obvious.
 * ---------------------------------------------------------------------------
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { root, sharp } from './brand.mjs';

/** How far past its square each scene is carried, in the scene's own units. */
const PAD = 160;

/**
 * Where each scene's picture is, in scene units (0 at the top, 400 at the
 * bottom). `top` is the highest detail that must show; `focus` is the lowest
 * that must clear the words under it. Measured by eye off the scenes, and the
 * reason they are per scene: a phone held up fills the square from the top, a
 * car park has sky above the church, and a blueprint on a table sits right at
 * the bottom.
 */
export const FRAMING = {
  give: { top: 45, focus: 340 },
  schedule: { top: 25, focus: 348 },
  apps: { top: 42, focus: 328 },
  welcome: { top: 25, focus: 320 },
  plans: { top: 50, focus: 392 },
  bookstore: { top: 70, focus: 300 },
  forms: { top: 48, focus: 330 },
  photos: { top: 40, focus: 318 },
  'register-vehicle': { top: 62, focus: 345 },
};

/**
 * The scene's markup, without its `<svg>` wrapper — or null if it is not drawn yet.
 *
 * A scene may show a real picture from this repo as `<image href="assets/…">`,
 * which is how `apps` puts the app's own icon on the phone rather than a
 * drawing of it: a hand-drawn seal was close enough to look deliberate and
 * wrong enough to look like somebody else's app. Inlined as a data URI here,
 * since rsvg-convert renders from a temporary file and the sticker SVGs are
 * shipped on their own, and neither can reach back into the repo. Shrunk first;
 * the tile is about 130px on the largest of them.
 */
export async function readScene(slug) {
  const source = await readFile(join(root, 'scripts', 'nfc-scenes', `${slug}.svg`), 'utf8').catch(() => null);
  if (!source) return null;
  let inner = source.slice(source.indexOf('>', source.indexOf('<svg')) + 1, source.lastIndexOf('</svg>'));
  for (const path of new Set([...inner.matchAll(/href="(assets\/[^"]+\.png)"/g)].map((m) => m[1]))) {
    const png = await sharp(join(root, path)).resize(256).png().toBuffer();
    inner = inner.replaceAll(`href="${path}"`, `href="data:image/png;base64,${png.toString('base64')}"`);
  }
  return inner;
}

/**
 * The scene with its full-width backgrounds carried `PAD` units out to the
 * left, the right and the top, and down below its bottom edge.
 *
 * Full-width rects grow on every side they touch; `M0 …` paths that reach x=400
 * have their 0 and 400 moved out, and if they also stand on the bottom edge,
 * their 400s there move down. Curves inside a path keep their control points,
 * so a hill's crest is unchanged and only its ends run on.
 */
export function extendScene(inner) {
  const out = 400 + PAD;
  let s = inner
    .replace(/<rect width="400" height="400"/g, `<rect x="${-PAD}" y="${-PAD}" width="${400 + 2 * PAD}" height="${400 + 2 * PAD}"`)
    .replace(/<rect x="0" y="([-\d.]+)" width="400"/g, `<rect x="${-PAD}" y="$1" width="${400 + 2 * PAD}"`)
    .replace(/<rect y="([-\d.]+)" width="400"/g, `<rect x="${-PAD}" y="$1" width="${400 + 2 * PAD}"`)
    .replace(/d="(M0 [^"]*)"/g, (whole, d) =>
      /(H|L)400|400 [\d.]+ ?(V|L|Z)/.test(d)
        ? `d="${d
            .replace(/^M0 /, `M${-PAD} `)
            .replace(/H0\b/g, `H${-PAD}`)
            .replace(/L0 /g, `L${-PAD} `)
            .replace(/H400\b/g, `H${out}`)
            .replace(/L400 /g, `L${out} `)
            .replace(/ 400 ([\d.]+)(?=[VLZ ])/g, ` ${out} $1`)}"`
        : whole,
    );

  /* Down: whatever stands on the bottom edge carries on below it. */
  return s
    .replace(/d="(M-?\d[^"]*)"/g, (whole, d) =>
      /(V400|[\d.-]+ 400)(?=[ZLHVC ]|$)/.test(d) && d.includes(`${-PAD}`)
        ? `d="${d.replace(/V400(?![\d.])/g, `V${out}`).replace(/(L|M|^|\s)(-?[\d.]+) 400(?![\d.])/g, `$1$2 ${out}`)}"`
        : whole,
    )
    .replace(/<rect ([^>]*?)y="([\d.]+)" ([^>]*?)height="([\d.]+)"/g, (whole, a, y, b, h) =>
      Math.abs(+y + +h - 400) < 0.01 && whole.includes(`x="${-PAD}"`) ? `<rect ${a}y="${y}" ${b}height="${+h + PAD}"` : whole,
    );
}
