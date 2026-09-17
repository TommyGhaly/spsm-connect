/**
 * The church's design tokens, resolved for this device.
 *
 * `config/theme` in Firestore is the source of truth, and it is world-readable
 * precisely so a client can fetch it without an account. The website does the
 * same thing (apps/website/src/lib/theme.ts) — it just emits CSS custom
 * properties at the end where this emits React Native style values.
 *
 * THE ONE RULE, quoted from packages/shared/src/schema/theme.ts:
 *
 *   > store design intent as unitless numbers. Never a CSS string.
 *
 * The corollary here: never write a literal colour or type size anywhere in
 * this app. A hardcoded #992a21 is a value the church cannot change, and one
 * the two frontends will eventually disagree on.
 */
import {
  CONFIG_DOC_THEME,
  COLLECTIONS,
  DEFAULT_THEME,
  THEME_SCHEMA_VERSION,
  decodeFirestoreFields,
  letterSpacingPoints,
  parseTheme,
  publicDocumentUrl,
  resolveTheme,
  type ResolvedTheme,
  type ThemeTokens,
} from '@spsm/shared';

export type { ResolvedTheme, ThemeTokens };
export { letterSpacingPoints, DEFAULT_THEME, THEME_SCHEMA_VERSION };

/** Where the theme document lives: `config/theme`. */
export const THEME_DOC_PATH = `${COLLECTIONS.config}/${CONFIG_DOC_THEME}`;

/**
 * Fetch and parse `config/theme`.
 *
 * A bare `fetch` against the Firestore REST API rather than the Firestore SDK,
 * exactly as lib/theme.ts does on the web. The document is one world-readable
 * doc read before anything else on screen; going through the SDK would mean
 * waiting for Firebase to initialise to draw the first pixel.
 *
 * Throws on a failed read. The caller decides whether that means "use the
 * cache" or "use DEFAULT_THEME" — this function does not get to decide, because
 * the two answers are different at boot and on refresh.
 */
export async function fetchTheme(): Promise<ThemeTokens> {
  const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
  const apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
  if (!projectId || !apiKey) {
    throw new Error('Firebase project id or api key is missing from the environment.');
  }

  /*
   * No `cache: 'no-cache'` here, unlike the web version: React Native's fetch
   * does not implement the Request cache modes, and passing one is silently
   * ignored rather than honoured. A Cache-Control header is the portable way to
   * say the same thing, and this document is small enough that a miss is cheap.
   */
  const response = await fetch(publicDocumentUrl(projectId, THEME_DOC_PATH, apiKey), {
    headers: { 'Cache-Control': 'no-cache' },
  });
  if (!response.ok) {
    throw new Error(`config/theme read failed: ${response.status}`);
  }

  const body = (await response.json()) as { fields?: Record<string, unknown> };

  /*
   * `parseTheme` is a sanitiser, not a coercer: every field falls back to
   * DEFAULT_THEME independently, colours must match a hex regex, and a document
   * declaring a `minClientVersion` newer than this binary is discarded whole.
   *
   * That last one is the escape hatch that makes a shipped binary safe — the
   * church can publish a theme this version cannot render and know that this
   * version will ignore it rather than draw something broken. It only works if
   * THEME_SCHEMA_VERSION is passed honestly, so pass it and never fake it.
   */
  return parseTheme(decodeFirestoreFields(body.fields ?? {}), THEME_SCHEMA_VERSION);
}

/**
 * Resolve tokens for a screen width.
 *
 * The claim this upholds, from the shared file's own header: *a phone 390pt
 * wide gets the same type size the website gives a 390px viewport.* If that
 * stops being true, the two frontends have drifted.
 */
export function resolveForScreen(
  theme: ThemeTokens,
  platform: 'ios' | 'android',
  viewportWidth: number,
): ResolvedTheme {
  return resolveTheme(theme, { platform, viewportWidth });
}

/**
 * Line height in points for a role.
 *
 * React Native's `lineHeight` is absolute; the token is a unitless ratio. The
 * shared file declines to do this multiplication because it would mean picking
 * a font size per role, which is the caller's business. This is that caller.
 */
export function lineHeightFor(
  theme: ResolvedTheme,
  size: keyof ResolvedTheme['fontSize'],
  leading: keyof ResolvedTheme['lineHeight'] = 'normal',
): number {
  return theme.fontSize[size] * theme.lineHeight[leading];
}
