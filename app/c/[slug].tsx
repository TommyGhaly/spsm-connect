/**
 * `/c/<slug>` in the **full app** — the other side of an App Clip invocation.
 *
 * ---------------------------------------------------------------------------
 * These eight URLs are printed on tags and cards around the church, and iOS
 * resolves one of them in whichever way costs the person least:
 *
 *   - **App not installed** → the App Clip card, and `src/clip/ClipRoot.tsx`
 *     draws the experience.
 *   - **App installed** → the app opens instead, at this route, because
 *     `apple-app-site-association` lists these paths under SPSM Connect's own
 *     `applinks` and `ios.associatedDomains` claims the domain.
 *
 * The second case is why this file exists. Without it a tag would open a `/c/…`
 * route the app does not have, and somebody with the app installed — the
 * church's own regulars — would get the not-found screen from a plaque on the
 * wall.
 *
 * ## It redirects rather than rendering
 *
 * `/c/schedule` is not a screen. It is a name for one, kept stable because it
 * is stamped on metal, and `experiences.ts` maps it to whatever route draws
 * that thing today. Reorganising the app's routes is then free; re-printing the
 * tags is not.
 *
 * `replace`, never `push`: a redirect that leaves itself on the stack gives the
 * back gesture a blank screen to return to.
 * ---------------------------------------------------------------------------
 */
import { useEffect } from 'react';
import { Redirect, useLocalSearchParams, type Href } from 'expo-router';

import { Screen } from '@/components/Surface';
import { Body, Label } from '@/components/Type';
import { experience } from '@/clip/experiences';

export default function ClipLanding() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const meta = experience(slug ?? '');

  useEffect(() => {
    if (!meta) {
      // Worth a line in the console, because the likeliest cause is a tag
      // printed for an experience a newer build added and this one has not.
      console.warn(`[clip] no experience called "${slug}" in this version of the app.`);
    }
  }, [meta, slug]);

  if (meta) {
    /*
     * Cast because `appPath` is a plain string and typed routes want a literal
     * union. The alternative — typing the table as `Href` — would tie a file
     * the App Clip also imports to expo-router's generated types, and the clip
     * has no router. The table's own header lists this file as one of the four
     * places a row has to agree with; that agreement is what the cast rests on.
     */
    return <Redirect href={meta.appPath as Href} />;
  }

  return (
    <Screen>
      <Label>NOT IN THIS VERSION</Label>
      <Body>
        That tag points at something this version of SPSM Connect does not have
        yet. Updating the app from the App Store should sort it.
      </Body>
    </Screen>
  );
}
