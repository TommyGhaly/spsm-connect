#!/usr/bin/env node
/**
 * Build the app's icons from the church seal, and the splash banner from the
 * app's name.
 *
 * Run by hand, rarely — `npm run icons`. The outputs are committed; this exists
 * so that *how* they were made is recorded, and so the next person changing the
 * background colour does not have to redraw anything.
 *
 * The seal, the type and the two baked colours come from `brand.mjs`, which
 * make-store-assets.mjs shares. What lives here is only what an *icon* has to
 * decide: how much of its canvas the seal fills, and how the splash lockup is
 * stacked.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  BACKGROUND,
  SIZE,
  blank,
  plate,
  root,
  seal,
  sharp,
  typeInk,
} from './brand.mjs';

const OUT = join(root, 'assets');

/**
 * The type half of the splash screen: the app's name, set above the seal.
 *
 * The splash was the seal on its own, and the seal on its own is not much of a
 * greeting. A launch image is up for a few hundred milliseconds before the
 * first frame of JS, and full-colour artwork — two saints, a camel, a horse
 * and two rings of lettering — does not resolve into any of that in that long;
 * what it says in a flash is "a red circle". The name is the thing a launch
 * screen can actually get across, and the seal is what the church is. So the
 * splash is both, the name above the seal, and `LOCKUP` below is what sets the
 * two relative to one another.
 *
 * ## Why an image of type rather than text
 *
 * `expo-splash-screen` takes an `image` and a `backgroundColor` and nothing
 * else — there is no text option, and there cannot be one: on iOS the splash
 * is a storyboard and on Android a themed window background, both drawn by the
 * OS before any JavaScript exists to lay out a `<Text>`. So the wordmark is
 * baked. The face and tracking are `DISPLAY` in brand.mjs.
 */
const WORDMARK = { text: 'SPSM Connect', fontSize: 400 };

/**
 * Where the name sits relative to the seal, as fractions of the canvas width.
 *
 * Composited here rather than laid out on the phone because
 * `expo-splash-screen` takes exactly one image — see the note above WORDMARK.
 *
 * The seal takes the full width and the name is inset from it, which is the
 * way round it has to be. The seal is an arch: its widest points are the tails
 * of the banner across its middle, and type set to the measure of those tails
 * overhangs the arch above them and reads as wider than the artwork it belongs
 * to. 0.92 lines the name up with the arch instead.
 *
 * The gap is real space rather than leading: both halves are trimmed to their
 * own ink, so it is measured from the baseline of the type to the topmost
 * pixel of the seal. 0.07 was tried first and is too tight — the top of the
 * seal is a white dome, and a baseline that close to it reads as the type
 * resting on the artwork rather than standing above it.
 */
const LOCKUP = { seal: 1, wordmark: 0.92, gap: 0.1 };

/**
 * How big the splash is drawn on screen, in points. `imageWidth` in
 * app.config.ts must equal this; nothing enforces it, so keep the two in step.
 *
 * Read it as the side of a square rather than as a width. `expo-splash-screen`
 * pads whatever it is handed out to `imageWidth` x `imageWidth` — confirmed in
 * the generated ios/SPSMConnect/Images.xcassets/SplashScreenLogo.imageset,
 * where a 2860x291 wordmark came out 260x260 — and the storyboard aspect-fits
 * that square. So the longer side of the lockup is what binds, and with the
 * name stacked on top of it the lockup is slightly taller than it is wide.
 *
 * 240 puts the seal at 224pt — a shade over the 200pt it had when it was the
 * whole splash screen — and the name above it at a cap height of 21pt, which
 * is a little over the theme's `heading`. `npm run icons` prints both,
 * measured, so change this and read what it says rather than predicting it.
 */
const SPLASH_WIDTH_POINTS = 240;

/**
 * How much of the canvas the seal fills, per output.
 *
 * Measured on the **trimmed** seal — see `sealPixels()` in brand.mjs, which
 * crops the render to the artwork's own bounding box first. That matters when
 * comparing these to the numbers that were here before: the logo carries about
 * 4% slack at its sides and 8% above and below, and the old fills were of the
 * render including that slack. 0.74 of the canvas was 0.71 of actual seal
 * across and only 0.62 of it down, which is where the wide red border came
 * from.
 *
 * The trimmed seal is 1.14:1, so width is always the binding dimension and
 * these are width fractions; the height that falls out is 1/1.14 of them.
 *
 * iOS masks the icon to a squircle. Its corners cut roughly 22% in, but they
 * cut *corners* — at 0.90 across, the seal's own corners sit at (51, 106) from
 * the canvas edge, comfortably inside the curve, and they are transparent
 * anyway because the seal is an arch. The full-width points are the banner's
 * tails at mid-height, where the mask takes nothing.
 *
 * Android's adaptive icon is the harsh one and is deliberately left where it
 * was: the launcher may crop to a circle of 66% diameter and animates within
 * that, so anything outside the inner two-thirds can be shaved off at any
 * moment. 0.59 is already past what a *rectangle* may claim there (a 1.14:1
 * box only fits that circle up to 0.50) and survives solely because the seal's
 * corners are empty. There is no room above it.
 */
const FILL = { ios: 0.9, androidForeground: 0.59, splash: 0.86 };

/**
 * The seal centred on a transparent square, as a finished PNG buffer.
 */
async function centred(fraction) {
  const logo = await seal(fraction);
  return blank(SIZE, SIZE)
    .composite([{ input: logo, gravity: 'centre' }])
    .png()
    .toBuffer();
}

/**
 * The splash screen: the name, a gap, and the seal, on one transparent canvas.
 *
 * Transparent rather than drawn on `BACKGROUND`, like every other output here:
 * `expo-splash-screen` paints its own `backgroundColor` behind this, and a
 * baked-in ground would show as a hard square edge over it.
 *
 * Composited at `SIZE` across, which is more than the 720 device pixels the
 * widest phone asks for at `SPLASH_WIDTH_POINTS`, so both halves are scaled
 * down by the OS rather than up. The height falls out of the two pieces and
 * the gap rather than being chosen — see LOCKUP.
 */
async function splashBanner() {
  const sealPng = await seal(LOCKUP.seal);
  const sealBox = await sharp(sealPng).metadata();

  const namePng = await sharp(await typeInk(WORDMARK.text, { fontSize: WORDMARK.fontSize }))
    .resize({ width: Math.round(SIZE * LOCKUP.wordmark) })
    .png()
    .toBuffer();
  const nameBox = await sharp(namePng).metadata();

  const gap = Math.round(SIZE * LOCKUP.gap);
  const height = nameBox.height + gap + sealBox.height;

  /*
   * What `imageWidth` actually buys, measured rather than predicted, because
   * it is the number somebody changing SPLASH_WIDTH_POINTS wants and there is
   * no way to see it on the phone — the splash is gone before it can be read.
   * `max` because the OS aspect-fits the lockup into a square of that side, so
   * whichever dimension is longer is the one that binds.
   */
  const scale = SPLASH_WIDTH_POINTS / Math.max(SIZE, height);
  console.log(
    `Splash lockup: ${SIZE}x${height}. At imageWidth ${SPLASH_WIDTH_POINTS} the seal is ` +
      `${Math.round(sealBox.width * scale)}pt wide and the name has a cap height of ` +
      `${Math.round(nameBox.height * scale)}pt.`,
  );

  return blank(SIZE, height)
    .composite([
      { input: namePng, top: 0, left: Math.round((SIZE - nameBox.width) / 2) },
      { input: sealPng, top: nameBox.height + gap, left: Math.round((SIZE - sealBox.width) / 2) },
    ])
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

  /*
   * The splash screen: the same seal with the app's name above it. See
   * WORDMARK for why the name is baked into an image at all.
   */
  await writeFile(join(OUT, 'splash-banner.png'), await splashBanner());

  // Android draws the foreground over the background layer, so this is
  // transparent and pulled well inside the safe zone.
  await writeFile(join(OUT, 'android-icon-foreground.png'), await centred(FILL.androidForeground));

  await writeFile(join(OUT, 'android-icon-background.png'), await plate(SIZE, SIZE));

  // The web favicon, which is the only one that wants the seal small and plain.
  await writeFile(
    join(OUT, 'favicon.png'),
    await sharp(await centred(0.92))
      .flatten({ background: BACKGROUND })
      .resize(48, 48)
      .png()
      .toBuffer(),
  );

  /*
   * The Android notification icon, and the reason it is not just another size
   * of the seal.
   *
   * Android draws the small status-bar icon as a **silhouette**: it keeps the
   * alpha channel and throws the colours away, filling every opaque pixel with
   * the tint from `expo-notifications`' `color` option. So the seal — two
   * saints, a camel, a horse and two rings of lettering, all of it opaque —
   * arrives as a solid white blob, which is the single most common way this
   * goes wrong and it only shows up on a real Android device.
   *
   * What works is artwork that is already *mostly transparent*, carrying its
   * meaning in the holes. This is the same problem as the themed launcher icon
   * that is deliberately not generated below, and it has the same honest
   * answer: this seal does not reduce to one colour. So rather than ship a
   * white square, this writes the seal's alpha as-is at 96px and leaves the
   * note — if the parish wants a proper notification glyph it needs drawing by
   * hand, most likely just the cross.
   *
   * 96px because that is the xxhdpi size Android asks for and the largest it
   * uses; it downscales for the rest.
   */
  await writeFile(
    join(OUT, 'notification-icon.png'),
    await sharp(await seal(1))
      .resize(96, 96, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer(),
  );

  console.log(`Icons written to assets/ on ${BACKGROUND}.`);
  console.log(
    `If SPLASH_WIDTH_POINTS changed, app.config.ts wants imageWidth: ${SPLASH_WIDTH_POINTS}.`,
  );
  console.log('Note: android-icon-monochrome.png is NOT generated — a themed');
  console.log('icon is a single-colour silhouette, and this seal has no');
  console.log('meaningful one. It needs drawing by hand or dropping.');
  console.log('Note: notification-icon.png IS generated, but Android renders it');
  console.log('as a flat silhouette — check it on a device. See the note in this');
  console.log('script; a hand-drawn cross would read far better than the seal.');
}

await main();
