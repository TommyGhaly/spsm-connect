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
 * ## It is Taksis's card, in this church's colours
 *
 * The parish's other app already has one — `car.png`, the vehicle registration
 * card — and the two apps belong to the same church and will be seen by the same
 * people, often in the same car park. So the *composition* is deliberately
 * copied from it rather than invented:
 *
 *   - a near-black ground with a soft radial glow behind the subject;
 *   - one large flat symbol, centred high, filled with a light-to-brand
 *     gradient and floated over a blurred shadow;
 *   - the name under it in tracked uppercase;
 *   - a short accent rule beneath that.
 *
 * What is *not* copied is the palette or the type. Taksis is blue on black and
 * sets its label in a heavy geometric sans; this church is `deep` maroon and
 * sets everything in Georgia, which is what `brand.mjs` bakes into the icons and
 * the splash. Same family, different member — a card that copied the blue too
 * would say Taksis to anybody who has both.
 *
 * ## The eight symbols are the app's own tab glyphs
 *
 * A gift, a calendar, four tiles, a doorway, a building, a bag, a document, a
 * camera. Redrawn here as filled shapes rather than reused from
 * `components/Icon.tsx` — those are React Native SVG *elements*, which cannot be
 * rendered by a Node script, and they are 1.6px strokes designed to be read at
 * 24px. At 500px on a card a hairline outline looks like a mistake. The
 * silhouettes match so that the card and the tab bar are recognisably the same
 * drawing.
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

const run = promisify(execFile);

/** Apple's size for an App Clip card header image, and the only one it takes. */
const CARD = { width: 1800, height: 1200 };

/**
 * The palette, from `DEFAULT_THEME` in @spsm/shared's schema/theme.ts.
 *
 * Hardcoded for the reason every baked asset's colours are: this is drawn once
 * and uploaded to App Store Connect by hand, so it cannot read a theme document
 * the church might change next year. If the church changes `deep` or `accent`,
 * rerun this and re-upload — the same contract `npm run icons` has.
 */
const INK = '#f9efec'; // inkInverse
const ACCENT = '#992a21'; // accent
const DEEP = '#481010'; // deep

/*
 * The subject's own two tones, and they are lighter than `accent` on purpose.
 *
 * The first attempt ran the gradient all the way down to `accent`, which is the
 * church's red — and against a ground made of that same red darkened, the bottom
 * half of every symbol sank into the background. Taksis's card works because its
 * car never gets darker than a mid blue while the ground is nearly black: the
 * whole subject stays above the ground in lightness, and the brand colour is
 * carried by the *glow* instead.
 *
 * So these are `accent` lifted toward `inkInverse` — unmistakably the same red
 * family, never dark enough to disappear into it.
 */
const SUBJECT_MID = '#eab9b0';
const SUBJECT_LOW = '#c86d5f';
/** For bands and panels *inside* a symbol, which still have to read against it. */
const SUBJECT_BAND = '#a8392e';

/*
 * The ground is darker than `deep`, and that is the one real departure.
 *
 * `deep` at #481010 is the splash screen and the icon background, and a
 * full-bleed 1800x1200 field of it is a lot of red — the subject stops reading
 * against it, because subject and ground end up the same hue at similar
 * lightness. Taksis solves this by going near-black and letting the brand colour
 * return as the glow and the subject. These two are `deep` taken well down
 * toward black, so the card is still unmistakably this church's red without
 * flattening the thing it is supposed to show.
 */
const GROUND_IN = '#2b0d0d';
const GROUND_OUT = '#120505';

/**
 * The eight, in the order they are registered.
 *
 * `label` is what is drawn on the image and is *not* always the App Store
 * Connect `title`: "Send a Photograph" is 16 characters of tracked uppercase and
 * becomes a thin ribbon of type at this width, so the card says PHOTOGRAPHS and
 * lets the title underneath say the rest. Where the title is already short it is
 * used unchanged.
 */
const CARDS = [
  { slug: 'give', label: 'Give', symbol: 'gift' },
  { slug: 'schedule', label: 'This Week', symbol: 'calendar' },
  { slug: 'apps', label: 'Our Apps', symbol: 'apps' },
  { slug: 'welcome', label: 'Welcome', symbol: 'door' },
  { slug: 'plans', label: 'Our Plans', symbol: 'building' },
  { slug: 'bookstore', label: 'Bookstore', symbol: 'bag' },
  { slug: 'forms', label: 'Parish Forms', symbol: 'form' },
  { slug: 'photos', label: 'Photographs', symbol: 'camera' },
];

/**
 * The symbols, each drawn inside a 512x512 box with its own origin at 0,0.
 *
 * Filled shapes, not strokes — see the header. Every one is built from
 * rectangles, rounded rectangles and circles so that it survives being scaled to
 * 500px without the softness a traced outline would show, and so that the
 * gradient reads across the whole silhouette rather than along a thin line.
 *
 * `fill="url(#subject)"` on the outer shape and `fill="#120505"` on anything
 * that should read as a hole: punching real holes would need even-odd paths per
 * shape, and a cut-out in the ground colour is indistinguishable at this size
 * because the ground behind the subject is that colour.
 */
const SYMBOLS = {
  /* An offering: a gift box, the Giving tab's glyph. */
  gift: `
    <rect x="56" y="216" width="400" height="48" rx="16" fill="url(#subject)"/>
    <rect x="88" y="264" width="336" height="200" rx="20" fill="url(#subject)"/>
    <rect x="232" y="216" width="48" height="248" fill="${SUBJECT_BAND}" opacity="0.85"/>
    <path d="M256 216c-40-72-140-96-140-32 0 26 26 32 60 32z" fill="url(#subject)"/>
    <path d="M256 216c40-72 140-96 140-32 0 26-26 32-60 32z" fill="url(#subject)"/>
  `,
  /* The church calendar. */
  calendar: `
    <rect x="48" y="96" width="416" height="368" rx="36" fill="url(#subject)"/>
    <rect x="48" y="96" width="416" height="96" rx="36" fill="${SUBJECT_BAND}"/>
    <rect x="48" y="156" width="416" height="36" fill="${SUBJECT_BAND}"/>
    <rect x="128" y="56" width="40" height="88" rx="20" fill="url(#subject)"/>
    <rect x="344" y="56" width="40" height="88" rx="20" fill="url(#subject)"/>
    <g fill="${SUBJECT_BAND}" opacity="0.8">
      <rect x="104" y="240" width="56" height="52" rx="14"/>
      <rect x="196" y="240" width="56" height="52" rx="14"/>
      <rect x="288" y="240" width="56" height="52" rx="14"/>
      <rect x="104" y="324" width="56" height="52" rx="14"/>
      <rect x="196" y="324" width="56" height="52" rx="14"/>
      <rect x="288" y="324" width="56" height="52" rx="14"/>
      <rect x="352" y="240" width="56" height="52" rx="14"/>
    </g>
  `,
  /* The parish's other apps. Four tiles, which mean "apps" and nothing else. */
  apps: `
    <rect x="64" y="64" width="176" height="176" rx="40" fill="url(#subject)"/>
    <rect x="272" y="64" width="176" height="176" rx="40" fill="url(#subject)"/>
    <rect x="64" y="272" width="176" height="176" rx="40" fill="url(#subject)"/>
    <rect x="272" y="272" width="176" height="176" rx="40" fill="url(#subject)"/>
  `,
  /* A doorway, open. The newcomer glyph — deliberately not a door that reads
     as "sign out", which is the trap Icon.tsx's own note records. */
  door: `
    <path d="M112 456V136a40 40 0 0 1 40-40h208a40 40 0 0 1 40 40v320z" fill="url(#subject)"/>
    <path d="M168 456V176a24 24 0 0 1 24-24h128a24 24 0 0 1 24 24v280z" fill="${SUBJECT_BAND}" opacity="0.9"/>
    <circle cx="300" cy="308" r="18" fill="url(#subject)"/>
    <rect x="72" y="448" width="368" height="32" rx="16" fill="url(#subject)"/>
  `,
  /* The expansion: three buildings, which is what the plans are. */
  building: `
    <rect x="56" y="248" width="128" height="216" rx="14" fill="url(#subject)"/>
    <rect x="196" y="144" width="140" height="320" rx="14" fill="url(#subject)"/>
    <rect x="348" y="216" width="112" height="248" rx="14" fill="url(#subject)"/>
    <path d="M266 64l70 80H196z" fill="url(#subject)"/>
    <g fill="${SUBJECT_BAND}" opacity="0.8">
      <rect x="88" y="288" width="30" height="34" rx="8"/>
      <rect x="132" y="288" width="30" height="34" rx="8"/>
      <rect x="88" y="352" width="30" height="34" rx="8"/>
      <rect x="132" y="352" width="30" height="34" rx="8"/>
      <rect x="230" y="192" width="34" height="38" rx="9"/>
      <rect x="282" y="192" width="34" height="38" rx="9"/>
      <rect x="230" y="258" width="34" height="38" rx="9"/>
      <rect x="282" y="258" width="34" height="38" rx="9"/>
      <rect x="230" y="324" width="34" height="38" rx="9"/>
      <rect x="282" y="324" width="34" height="38" rx="9"/>
      <rect x="378" y="260" width="30" height="34" rx="8"/>
      <rect x="418" y="260" width="30" height="34" rx="8"/>
      <rect x="378" y="324" width="30" height="34" rx="8"/>
      <rect x="418" y="324" width="30" height="34" rx="8"/>
    </g>
  `,
  /* The bookstore. A shop bag rather than a trolley — the church sells books. */
  bag: `
    <path d="M96 176h320l28 264a40 40 0 0 1-40 44H108a40 40 0 0 1-40-44z" fill="url(#subject)"/>
    <path d="M176 208V144a80 80 0 0 1 160 0v64" fill="none" stroke="url(#subject)" stroke-width="36" stroke-linecap="round"/>
  `,
  /* A church form. A sheet with lines on it, and a signature rule. */
  form: `
    <path d="M104 72h204l100 100v308a32 32 0 0 1-32 32H104a32 32 0 0 1-32-32V104a32 32 0 0 1 32-32z" fill="url(#subject)"/>
    <path d="M308 72l100 100H308z" fill="${SUBJECT_BAND}" opacity="0.8"/>
    <g fill="${SUBJECT_BAND}" opacity="0.8">
      <rect x="128" y="224" width="224" height="26" rx="13"/>
      <rect x="128" y="286" width="224" height="26" rx="13"/>
      <rect x="128" y="348" width="140" height="26" rx="13"/>
    </g>
  `,
  /* The camera, which is the app's home screen. */
  camera: `
    <path d="M88 152h84l36-56h136l36 56h84a40 40 0 0 1 40 40v216a40 40 0 0 1-40 40H88a40 40 0 0 1-40-40V192a40 40 0 0 1 40-40z" fill="url(#subject)"/>
    <circle cx="256" cy="300" r="104" fill="${SUBJECT_BAND}" opacity="0.9"/>
    <circle cx="256" cy="300" r="62" fill="url(#subject)"/>
  `,
};

/**
 * One card, as SVG.
 *
 * The whole thing is one document rather than a composite of rasterised parts,
 * because everything here — the ground, the glow, the gradient on the subject,
 * the shadow, the type — is something SVG does natively and sharp would need a
 * separate pass for. `rsvg-convert` rasterises it in one go, and the font is
 * resolved by fontconfig exactly as it is in `brand.mjs`'s `typeInk`.
 */
function cardSvg({ label, symbol }) {
  const { width, height } = CARD;

  /*
   * The subject's box, and the numbers that set the whole composition.
   *
   * 500px tall, centred horizontally and sitting high — its centre is at 40% of
   * the height rather than 50%, which leaves the lower third for the name and
   * the rule without either crowding the other. Taksis's proportions, measured
   * off the card.
   */
  const box = 660;
  const subjectLeft = (width - box) / 2;
  const subjectTop = height * 0.4 - box / 2;
  const scale = box / 512;

  /*
   * Tracked uppercase, and the size is derived from the label's length rather
   * than fixed: "Give" and "Parish Forms" differ by a factor of three in
   * character count, and one size for both would either shrink the short label
   * to nothing or run the long one off the card. 1180px of usable width divided
   * by the character count, clamped so a very short word does not become
   * absurd.
   */
  const letters = label.length;
  const fontSize = Math.round(Math.min(132, Math.max(76, 1180 / Math.max(letters, 5))));
  const tracking = fontSize * 0.14;

  const escaped = label
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <radialGradient id="ground" cx="50%" cy="40%" r="78%">
      <stop offset="0%" stop-color="${GROUND_IN}"/>
      <stop offset="100%" stop-color="${GROUND_OUT}"/>
    </radialGradient>

    <!-- The glow behind the subject. Accent at low alpha, falling to nothing
         well inside the edges, so the card has a light source rather than a
         coloured rectangle. -->
    <radialGradient id="glow" cx="50%" cy="40%" r="46%">
      <stop offset="0%" stop-color="${ACCENT}" stop-opacity="0.55"/>
      <stop offset="60%" stop-color="${DEEP}" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="${DEEP}" stop-opacity="0"/>
    </radialGradient>

    <!-- Light at the top, brand colour at the bottom: the same direction
         Taksis's car is lit from, so the two cards agree about where the
         light is. -->
    <linearGradient id="subject" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="45%" stop-color="${SUBJECT_MID}"/>
      <stop offset="100%" stop-color="${SUBJECT_LOW}"/>
    </linearGradient>

    <filter id="soften" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="34"/>
    </filter>
  </defs>

  <rect width="${width}" height="${height}" fill="url(#ground)"/>
  <rect width="${width}" height="${height}" fill="url(#glow)"/>

  <!-- The shadow the subject floats over. An ellipse rather than a real
       projection: it only has to say the symbol is above the ground. -->
  <ellipse cx="${width / 2}" cy="${subjectTop + box * 0.98}" rx="${box * 0.42}" ry="${box * 0.055}"
           fill="#000000" opacity="0.5" filter="url(#soften)"/>

  <g transform="translate(${subjectLeft} ${subjectTop}) scale(${scale})">
    ${SYMBOLS[symbol]}
  </g>

  <text x="${width / 2}" y="${height * 0.775}" text-anchor="middle"
        font-family="Georgia" font-size="${fontSize}" font-weight="bold"
        letter-spacing="${tracking}" fill="${INK}">${escaped.toUpperCase()}</text>

  <rect x="${width / 2 - 165}" y="${height * 0.822}" width="330" height="8" rx="4" fill="${ACCENT}"/>
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

  const mine = CARDS.map((card) => card.slug);
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
    await writeFile(file, cardSvg(card));

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
    console.log(`  ${card.slug.padEnd(10)} ${card.label}`);
  }

  console.log(`\nWritten to store/clip-cards/. Upload each in App Store Connect →`);
  console.log(`Advanced App Clip Experiences → the experience for /c/<slug>.`);
}

await main();
