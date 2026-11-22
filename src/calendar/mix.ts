/**
 * `color-mix(in srgb, a share, b)` for two `#rrggbb` colours, which is what
 * every theme colour is (`hex()` in the shared schema rejects anything else).
 * The website mixes its schedule colours this way — a time in its kind's tone
 * at 55% against the ink, so gold on cream still passes contrast — and this
 * gives the app the same colour rather than an approximation of it.
 *
 * Falls back to `a` for anything it cannot read rather than drawing black.
 */
export function mix(a: string, b: string, share: number): string {
  const pa = parse(a);
  const pb = parse(b);
  if (!pa || !pb) return a;
  const channel = (i: number) => Math.round(pa[i]! * share + pb[i]! * (1 - share));
  return `#${[0, 1, 2].map((i) => channel(i).toString(16).padStart(2, '0')).join('')}`;
}

function parse(hex: string): [number, number, number] | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const value = parseInt(match[1]!, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}
