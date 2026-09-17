#!/usr/bin/env node
/**
 * Build the store listings' artwork: Play's feature graphic and hi-res icon,
 * and the screenshots for both stores.
 *
 * Run by hand — `npm run store`. Outputs land in `store/` and are committed,
 * for the same reason `assets/` is: so that *how* they were made is recorded
 * and nobody has to redraw anything to change a colour.
 *
 * The seal, the type and the two baked colours come from `brand.mjs`, shared
 * with make-icons.mjs. A store listing is the same kind of artefact an icon is
 * — uploaded rather than rendered — so it cannot read `config/theme` either.
 *
 * ## The two halves of this script
 *
 * `drawn` outputs are composed here from the seal: the feature graphic and the
 * 512px icon. They are pure functions of the artwork and rerun identically.
 *
 * `framed` outputs are **screenshots**, and this script does not take them —
 * `capture-screenshots.sh` drives the simulators and drops raw PNGs into
 * `store/raw/`. What happens here is only the part the stores are fussy about:
 * checking each one is a size its store accepts, and padding the ones that are
 * not. Re-running with an empty `store/raw/` is not an error; it just says so.
 */
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { BACKGROUND, blank, plate, root, sealPixels, sharp, typeInk } from './brand.mjs';

const OUT = join(root, 'store');
const RAW = join(OUT, 'raw');

/**
 * What the feature graphic says, in the words the website already uses.
 *
 * The church's name is `St. Philopater Mercurius & St. Mina` — spelled exactly
 * as `apps/website/src/app/layout.tsx` sets it, **Mina** rather than the
 * *Mena* in the logo's filename. The two frontends disagreeing about the
 * spelling of the church's own name on a store listing is the kind of thing
 * nobody notices until a parishioner does.
 *
 * The third line is the app's tabs, and it is deliberately a list of things
 * that exist rather than a slogan. `app/(drawer)/(tabs)/_layout.tsx` is the
 * source: Calendar, Forms, Send, Bookstore, Giving. Two changes to that list,
 * both on purpose. "Send" is renamed to "Photos", because the tab's label only
 * makes sense once you are looking at the tab bar and a feature graphic has to
 * make sense to somebody who has never opened the app. And it is a **selection
 * of three**, not all five: the line is set to the width of the text column,
 * so every extra tab makes all of them smaller, and the full list came out at
 * a cap height of about 15px — present, and not actually readable at the size
 * Play renders this in a list. Three legible tabs say more than five illegible
 * ones. Keep whatever is here in step with that file; a listing naming a tab
 * that has been removed is a bad first impression.
 */
const FEATURE = {
  eyebrow: 'St. Philopater Mercurius & St. Mina',
  name: 'SPSM Connect',
  tabs: 'Calendar · Photos · Giving',
};

/**
 * Play's feature graphic is **1024x500**, and that is the only size it takes.
 *
 * Two things govern the layout. It is shown at wildly different widths across
 * Play's surfaces and is centre-cropped for some of them, so nothing that has
 * to be read may sit near an edge — `SAFE` keeps the whole lockup inside the
 * middle, and is a fraction of width rather than a pixel inset so it stays
 * right if the size ever changes. And Play draws a round play/install button
 * over the centre of the graphic on listings with a video, which is the reason
 * the seal sits left and the type right rather than the lockup being centred:
 * a centred composition puts the button through the middle of the artwork.
 */
const GRAPHIC = { width: 1024, height: 500, safe: 0.86 };

/** Play's hi-res icon, which is a fixed 512x512 with no alpha. */
const PLAY_ICON = 512;

/**
 * The store's rules about screenshot dimensions, and they are not the same.
 *
 * ## Play
 *
 * Each side between 320 and 3840 px, and **the long side may not be more than
 * twice the short side**. That last one is the trap, because no modern phone
 * satisfies it: a Pixel 9a screenshot is 1080x2424, which is 2.24:1, and Play
 * refuses it. So a tall screenshot is scaled to fit and padded out to exactly
 * 2:1 on `BACKGROUND` — bars down the sides rather than a crop, because a crop
 * of a phone screen takes the tab bar or the header off, and those are the
 * parts of this app worth showing. The bars read as a deliberate frame in the
 * listing, which is what most apps in this position end up doing anyway.
 *
 * ## App Store
 *
 * The opposite problem: Apple wants the *exact* pixel dimensions of a real
 * device and rejects anything else, so these are never resized — they are
 * checked, and a mismatch is a hard failure. A screenshot at the wrong size is
 * a rejected build an hour after upload, and it is much cheaper to hear about
 * it here.
 *
 * 6.9" and 13" are the only two Apple still *requires* for a universal app:
 * an iPhone 17 Pro Max at 1320x2868 and an iPad Pro 13" at 2064x2752. App
 * Store Connect scales those down for every smaller class on its own.
 * `supportsTablet: true` in app.config.ts is what makes the iPad set
 * mandatory rather than optional — drop that and the iPad column goes with it.
 *
 * Each class lists a second pair as well — 1290x2796 and 2048x2732 — because
 * Apple accepts the previous generation's panel for the same slot, and those
 * are what an iPhone 16 Pro Max and an older iPad Pro 13" produce. Somebody
 * capturing on a machine whose Xcode does not have the newest simulators
 * should get working screenshots rather than a failure.
 *
 * Both orientations are listed because `orientation: 'default'` in
 * app.config.ts means the app really does rotate, and App Store Connect takes
 * either for a slot as long as every shot in the set matches.
 */
const RULES = {
  'android/phone': { kind: 'pad', ratio: 2 },
  'ios/6.9': {
    kind: 'exact',
    sizes: [[1320, 2868], [2868, 1320], [1290, 2796], [2796, 1290]],
  },
  'ios/13': {
    kind: 'exact',
    sizes: [[2064, 2752], [2752, 2064], [2048, 2732], [2732, 2048]],
  },
  /*
   * The 6.5" slot, derived from the 6.9" captures rather than photographed.
   *
   * App Store Connect still offers a **6.5-inch** row, and it refuses 6.9"
   * images in it with a message that names only its own four sizes:
   *
   *   Screenshots dimensions should be: 1242 x 2688px, 2688 x 1242px,
   *   1284 x 2778px or 2778 x 1284px
   *
   * That is not a complaint about the files; it is the wrong row. 1320x2868 is
   * correct, in the 6.9" row. But filling 6.5" as well costs nothing and means
   * the upload works whichever row is open, so it is generated here.
   *
   * 1284x2778 of the two portrait options, because it is the larger and so
   * scales the 1320x2868 source down the least.
   *
   * ## Why this is a resize-and-crop rather than a plain crop
   *
   * A plain crop is the tempting reading of "just crop", and the aspects are
   * close enough that it nearly works: 1320:2868 is 0.4603, 1284:2778 is
   * 0.4622. But a pure crop has to take the whole difference out of the pixel
   * grid — 36px of width and **90px of height** — and those 90px come off the
   * top and bottom, which is where the status bar and the tab bar are. That
   * clips the clock and the home indicator.
   *
   * `fit: 'cover'` scales to width and then centre-crops only the overflow:
   * 1320 to 1284 is a factor of 0.9727, which puts the source at 1284x2790,
   * and the crop is the remaining **12px** — 6 off the top and 6 off the
   * bottom, 2pt at 3x. Nothing legible moves. The screens are not re-shot and
   * not re-composed; this is the same photograph, resampled once.
   */
  'ios/6.5': { kind: 'derive', from: 'ios/6.9', size: [1284, 2778] },
};

/**
 * The feature graphic: the seal on the left, the church and the app on the
 * right, on `deep`.
 *
 * Every measurement below is a fraction of the canvas rather than a pixel, so
 * that the one place a size is chosen is `GRAPHIC`. Nothing here is a cap
 * height: each line is fitted to the width of the text column instead, which
 * is what keeps the layout intact when somebody edits a string in FEATURE.
 */
async function featureGraphic() {
  const { width, height, safe } = GRAPHIC;
  const margin = Math.round((width * (1 - safe)) / 2);

  /*
   * The seal, and 0.62 rather than anything larger because the seal and the
   * text column are in direct competition for the same 1024px: every pixel
   * given to the seal comes off `column` below, and the church's name is 35
   * characters that have to stay readable at the size Play renders this in a
   * list. It was tried at 0.78 first, which left a column too narrow for the
   * name and tripped the overrun guard.
   */
  const sealBox = Math.round(height * 0.62);
  const sealPng = await sealPixels(sealBox);
  const sealMeta = await sharp(sealPng).metadata();

  /*
   * The text column: what is left of the safe area once the seal and the
   * gutter have taken theirs. Every line is sized against *this* rather than
   * against a cap height chosen by eye, and that is the whole trick — type set
   * to a fixed cap height either overruns the canvas or leaves it half empty
   * the moment a string changes length, and the church's name is long. Fitting
   * to the column means the layout survives an edit to FEATURE.
   */
  const gutter = Math.round(width * 0.045);
  const textLeft = margin + sealMeta.width + gutter;
  const column = width - margin - textLeft;

  /*
   * How much of the column each line claims. This is the hierarchy, and it is
   * expressed as width rather than size because these three strings are very
   * different lengths — the name is 12 characters and the church's name is 35,
   * so equal widths would make the name enormous and the church's name tiny.
   * The name gets the full column and is the loud one; the other two are set
   * narrower, which at their character counts lands them well below it.
   */
  const lines = [
    { text: FEATURE.eyebrow, fontSize: 200, fill: 0.98 },
    { text: FEATURE.name, fontSize: 400, fill: 1 },
    { text: FEATURE.tabs, fontSize: 200, fill: 0.72 },
  ];

  const rendered = [];
  for (const { text, fontSize, fill } of lines) {
    const ink = await typeInk(text, { fontSize });
    const out = await sharp(ink)
      .resize({ width: Math.round(column * fill) })
      .png()
      .toBuffer();
    rendered.push({ buffer: out, meta: await sharp(out).metadata() });
  }

  // Leading between the three lines, as a fraction of the canvas height. The
  // eyebrow sits closer to the name than the tabs do because it belongs to it.
  const leads = [Math.round(height * 0.045), Math.round(height * 0.07)];
  const textHeight =
    rendered.reduce((total, line) => total + line.meta.height, 0) + leads[0] + leads[1];

  const textTop = Math.round((height - textHeight) / 2);

  /*
   * Fitting to the column makes a horizontal overrun impossible, so what is
   * left to check is the vertical: three lines tall enough to overflow the
   * canvas, which a long string wrapped to a wide column would cause. Loud
   * rather than silently clipped.
   */
  if (textHeight > height - margin) {
    throw new Error(
      `The feature graphic's three lines are ${textHeight}px tall, which does not fit ` +
        `${height}px with margins. Shorten a line in FEATURE, or narrow the fills in ` +
        'featureGraphic().',
    );
  }

  const layers = [
    {
      input: sealPng,
      left: margin,
      top: Math.round((height - sealMeta.height) / 2),
    },
  ];

  let y = textTop;
  rendered.forEach((line, index) => {
    layers.push({ input: line.buffer, left: textLeft, top: y });
    y += line.meta.height + (leads[index] ?? 0);
  });

  /*
   * Flattened, not merely drawn on a coloured plate. Play rejects a feature
   * graphic with an alpha channel, and the difference is invisible until the
   * upload fails — the same trap `icon.png` carries in make-icons.mjs.
   */
  return sharp(await plate(width, height))
    .composite(layers)
    .flatten({ background: BACKGROUND })
    .png()
    .toBuffer();
}

/**
 * Play's 512px icon.
 *
 * Not a resize of `assets/icon.png`: that one is filled to 0.9 of its canvas
 * for a squircle mask, and Play draws this one inside a much tighter rounded
 * square with its own padding on top. 0.82 leaves the seal room to breathe
 * there. Flattened for the same reason the iOS icon is.
 */
async function playIcon() {
  const logo = await sealPixels(Math.round(PLAY_ICON * 0.82));
  return blank(PLAY_ICON, PLAY_ICON)
    .composite([{ input: logo, gravity: 'centre' }])
    .flatten({ background: BACKGROUND })
    .png()
    .toBuffer();
}

/**
 * One raw screenshot, checked against its store's rules and padded if that is
 * what the store needs.
 *
 * Returns the bytes to write plus a one-line note, because the note is the
 * whole point of running this — it is where "this shot is 1080x2424, which
 * Play refuses, so it is now 1080x2160" gets said out loud.
 */
async function conform(buffer, rule) {
  const { width, height } = await sharp(buffer).metadata();

  if (rule.kind === 'derive') {
    const [w, h] = rule.size;
    if (width === w && height === h) return { buffer, note: `${w}x${h}, already` };

    const out = await sharp(buffer)
      .resize(w, h, { fit: 'cover', position: 'centre' })
      .png()
      .toBuffer();

    const scale = Math.max(w / width, h / height);
    const cropped = Math.round(height * scale) - h;
    return {
      buffer: out,
      note: `${width}x${height} → ${w}x${h}, scaled ${scale.toFixed(4)} and ${cropped}px cropped`,
    };
  }

  if (rule.kind === 'exact') {
    const ok = rule.sizes.some(([w, h]) => w === width && h === height);
    if (!ok) {
      const expected = rule.sizes.map(([w, h]) => `${w}x${h}`).join(' or ');
      throw new Error(
        `${width}x${height} is not a size the App Store accepts here — it wants ${expected}. ` +
          'This shot came off the wrong simulator; retake it rather than resizing it, ' +
          'because a scaled screenshot is a rejection too.',
      );
    }
    return { buffer, note: `${width}x${height}, exact` };
  }

  const long = Math.max(width, height);
  const short = Math.min(width, height);
  if (long <= short * rule.ratio) {
    return { buffer, note: `${width}x${height}, within ${rule.ratio}:1` };
  }

  /*
   * Too tall. Keep the long side and widen the canvas to the ratio, rather
   * than keeping the width and cutting the height — padding preserves every
   * pixel of the screen, and a crop would take the tab bar off the bottom.
   */
  const target =
    height > width
      ? { width: Math.ceil(height / rule.ratio), height }
      : { width, height: Math.ceil(width / rule.ratio) };

  const padded = await sharp(buffer)
    .resize({ ...target, fit: 'contain', background: BACKGROUND })
    .flatten({ background: BACKGROUND })
    .png()
    .toBuffer();

  return {
    buffer: padded,
    note: `${width}x${height} → ${target.width}x${target.height}, padded to ${rule.ratio}:1`,
  };
}

/**
 * Every raw screenshot under `store/raw/<set>/`, conformed into
 * `store/screenshots/<set>/`.
 *
 * Missing directories are skipped rather than thrown on: the iOS shots and the
 * Android ones are captured by separate runs on separate machines' patience,
 * and rebuilding the feature graphic should not require both to be present.
 */
async function screenshots() {
  let seen = 0;

  for (const [set, rule] of Object.entries(RULES)) {
    // A derived set has no raw directory of its own — it is built from another
    // set's captures, so it reads from there and writes under its own name.
    const source = rule.from ?? set;

    let names;
    try {
      names = (await readdir(join(RAW, source))).filter((n) => n.endsWith('.png')).sort();
    } catch {
      console.log(`  ${set}: no store/raw/${source}, skipped.`);
      continue;
    }

    if (names.length === 0) {
      console.log(`  ${set}: store/raw/${set} is empty, skipped.`);
      continue;
    }

    const dir = join(OUT, 'screenshots', set);
    await mkdir(dir, { recursive: true });

    for (const name of names) {
      const original = await sharp(join(RAW, source, name)).png().toBuffer();
      const { buffer, note } = await conform(original, rule);
      await writeFile(join(dir, name), buffer);
      console.log(`  ${set}/${name}: ${note}`);
      seen += 1;
    }

    /*
     * Both stores take a minimum of two, and Play wants at least two per form
     * factor before it will let a release out of draft. Worth saying here
     * rather than discovering it in the console at upload time.
     */
    if (names.length < 2) {
      console.log(`  ${set}: only ${names.length} shot — both stores want at least 2.`);
    }
  }

  return seen;
}

async function main() {
  await mkdir(join(OUT, 'android'), { recursive: true });

  await writeFile(join(OUT, 'android', 'feature-graphic.png'), await featureGraphic());
  await writeFile(join(OUT, 'android', 'icon-512.png'), await playIcon());
  console.log(`Feature graphic ${GRAPHIC.width}x${GRAPHIC.height} and ${PLAY_ICON}px Play icon`);
  console.log(`written to store/android/ on ${BACKGROUND}.`);

  console.log('Screenshots:');
  const count = await screenshots();
  if (count === 0) {
    console.log('  Nothing in store/raw/. Run scripts/capture-screenshots.sh first.');
  }

}

await main();
