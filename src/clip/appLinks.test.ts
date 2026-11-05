/**
 * The links this app opens, kept the same on Android as on iOS.
 *
 * iOS reads its list from the website's `apple-app-site-association`. Android
 * reads it from `ANDROID_LINK_PATHS` in app.config.ts, compiled into the app.
 * Nothing at build time compares the two, and when they differ a tag opens the
 * app on one phone and the browser on the other, so this does.
 */
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

import config, { ANDROID_LINK_PATHS } from '../../app.config';
import { CLIP_PREFIX, EXPERIENCES } from './experiences';

/** The Website repo sits beside this one, as `../Website`. */
const AASA = resolve(__dirname, '../../../Website/apps/website/public/.well-known/apple-app-site-association');

/** An Android entry in the shape AASA writes it: `/events/` prefix is `/events/*`. */
function asAasa(entry: (typeof ANDROID_LINK_PATHS)[number]): string {
  return 'exact' in entry ? entry.exact : `${entry.prefix}*`;
}

describe('Android app links', () => {
  it('claims paths, not whole hosts', () => {
    const filters = config.android?.intentFilters ?? [];
    expect(filters).toHaveLength(1);
    const data = filters[0]!.data as Record<string, string>[];
    const paths = data.filter((entry) => entry.path || entry.pathPrefix || entry.pathPattern);
    expect(paths.length).toBe(ANDROID_LINK_PATHS.length);
  });

  it('includes every App Clip experience', () => {
    const claimed = new Set(ANDROID_LINK_PATHS.map(asAasa));
    for (const { slug } of EXPERIENCES) {
      expect(claimed).toContain(`${CLIP_PREFIX}/${slug}`);
    }
  });

  it('leaves the Taksis car-park tag to Taksis', () => {
    const claimed = ANDROID_LINK_PATHS.map(asAasa);
    expect(claimed).not.toContain('/c/register-vehicle');
    expect(claimed.some((path) => path.startsWith('/c') && path.endsWith('*'))).toBe(false);
  });

  const haveWebsite = existsSync(AASA);
  (haveWebsite ? it : it.skip)('matches the iOS association file exactly', () => {
    const aasa = JSON.parse(readFileSync(AASA, 'utf8')) as {
      applinks: { details: { appIDs: string[]; components: { '/': string }[] }[] };
    };
    const ours = aasa.applinks.details.find((detail) =>
      detail.appIDs.some((id) => id.endsWith('.org.spsm.connect')),
    );
    expect(ours).toBeDefined();
    const ios = ours!.components.map((component) => component['/']).sort();
    const android = ANDROID_LINK_PATHS.map(asAasa).sort();
    expect(android).toEqual(ios);
  });
});
