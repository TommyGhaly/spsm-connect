/**
 * Where the About pages' pictures come from.
 *
 * ---------------------------------------------------------------------------
 * **The files are the website's, fetched over the network, not bundled.**
 * There are sixty-odd of them across the five pages — icons, manuscripts,
 * museum objects and ten architectural renderings — and `scripts/
 * optimize-assets.mjs` in the Website repo already emits every one at two
 * widths under `public/img/`. Copying them into `assets/` here would add
 * something like fifteen megabytes to the download of an app whose whole job
 * is elsewhere, and would fork them: a replaced picture on the website would
 * stay replaced only there until somebody remembered to re-run the copy.
 *
 * `expo-image` caches to disk, so a page costs its pictures once per device
 * rather than once per visit. The cost this *does* carry, and it is real: the
 * About pages need a network the first time they are opened. The words do not —
 * they are in the binary, below — so a page on a bad connection renders whole
 * and fills its plates in as they land. That is the right way round for a
 * history whose pictures are illustrations of it.
 *
 * The origin is the same one `api/client.ts` talks to, and deliberately reads
 * the same environment variable: Firebase Hosting serves `/img/**` and the
 * `/api/**` rewrites from one host, and a build pointed at a staging site
 * should get that site's pictures too.
 * ---------------------------------------------------------------------------
 */

const ORIGIN = process.env.EXPO_PUBLIC_API_ORIGIN ?? 'https://spsm-database.web.app';

/**
 * An absolute URL for a path under the website's `public/`.
 *
 * The four picture sets below all call this rather than interpolating the
 * origin themselves, so that the host is named once in this app.
 */
export function siteUrl(path: string): string {
  return `${ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
}

/*
 * The per-set helpers, matching the names the website uses for the same files
 * (`whoSmall`, `beliefLarge`, `saintFull`, …) so that a picture can be traced
 * from a screen here to the optimiser block that emits it without a detour.
 *
 * Which width each set is emitted at is not uniform and is not ours to pick —
 * `future` is 800/1600 because the renderings are wide, `saints` is 520/1100
 * because two of the sources are small. The phone always wants the larger of
 * the pair: a full-width plate on a 390pt retina screen is 1170 device pixels,
 * which the 640 files would draw soft. The small files are here for the two
 * grids that draw at a third of the width.
 */

export const whoPicture = (name: string) => siteUrl(`/img/who/${name}-1280.webp`);
export const beliefPicture = (name: string) => siteUrl(`/img/belief/${name}-1280.webp`);
export const saintPicture = (name: string) => siteUrl(`/img/saints/${name}-1100.webp`);
export const saintThumb = (name: string) => siteUrl(`/img/saints/${name}-520.webp`);
export const tourPicture = (name: string) => siteUrl(`/img/tour/${name}-1280.webp`);
export const tourThumb = (name: string) => siteUrl(`/img/tour/${name}-640.webp`);
export const futurePicture = (name: string) => siteUrl(`/img/future/${name}-1600.webp`);
export const futureThumb = (name: string) => siteUrl(`/img/future/${name}-480.webp`);

/**
 * A consulting firm's mark.
 *
 * Seven of the nine have one; `code-red` and `dillis-roy` have no published
 * mark at all, which is why the row of marks and the list of names are two
 * different things on the website and are two different things here. A firm
 * without artwork is a complete row in the list rather than a hole in the row.
 *
 * These are **third-party trademarks**, used to identify the firms working on
 * this project and nothing else. They are resized and converted and not
 * otherwise touched — no crop, no recolour, no redraw.
 */
export const firmLogo = (slug: string) => siteUrl(`/img/future/logos/${slug}-480.webp`);

/**
 * A cleric's portrait.
 *
 * `@2x` unconditionally: the frame is a 136pt circle at every width and every
 * phone this runs on is at least 2x, so the 1x file is never the right choice.
 * `bundledPortrait` on the website makes the same call from the other end.
 */
export const clergyPortrait = (slug: string) => siteUrl(`/img/clergy/${slug}@2x.webp`);
