/**
 * The palette and the eight symbols, shared by every baked clip asset.
 *
 * ---------------------------------------------------------------------------
 * Lifted out of make-clip-cards.mjs when a second script wanted the same
 * drawings: make-nfc-stickers.mjs, which prints them on the tags those cards
 * appear over. The tag and the card somebody sees a second later should be
 * the same picture, and two copies of a hand-drawn SVG drift.
 * ---------------------------------------------------------------------------
 */

/**
 * The palette, from `DEFAULT_THEME` in @spsm/shared's schema/theme.ts.
 *
 * Hardcoded for the reason every baked asset's colours are: this is drawn once
 * and uploaded to App Store Connect by hand, so it cannot read a theme document
 * the church might change next year. If the church changes `deep` or `accent`,
 * rerun this and re-upload — the same contract `npm run icons` has.
 */
export const INK = '#f9efec'; // inkInverse
export const ACCENT = '#992a21'; // accent
export const DEEP = '#481010'; // deep

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
export const SUBJECT_MID = '#eab9b0';
export const SUBJECT_LOW = '#c86d5f';
/** For bands and panels *inside* a symbol, which still have to read against it. */
export const SUBJECT_BAND = '#a8392e';

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
export const GROUND_IN = '#2b0d0d';
export const GROUND_OUT = '#120505';

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
export const SYMBOLS = {
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
