/**
 * The App Clip's entire React tree.
 *
 * It does not go through expo-router, and that is the whole point of it.
 *
 * ## Why the seam is the entry point and not a component
 *
 * The obvious design — keep `expo-router/entry` for both targets and swap one
 * component underneath it — was tried and measured, and it does not work. The
 * router discovers routes with a `require.context` over `app/`, so **every**
 * screen is in the module graph whether or not anything renders it: the tab
 * navigator, the gallery tree, the upload queue, SQLite, the background task.
 * Swapping the shell changed the clip bundle from 1,930 modules to 1,931 — it
 * added the replacement and removed nothing.
 *
 * So the substitution happens one level up, at `index.clip.ts` versus
 * `index.ts`, which is the file `package.json` names as `main`. Metro's `.clip`
 * source extension resolves the entry itself, and the router never enters the
 * graph.
 *
 * Screens borrowed from the full app still import `expo-router`, and they still
 * get one: `metro.config.js` resolves that name to `shims/expo-router.tsx` in
 * the clip build — a router with no route table, whose `push` answers with the
 * clip's own three outcomes. That shim is what makes the tour, the expansion
 * plans, the giving screen and the apps list usable here unforked.
 *
 * ## Why that matters
 *
 * **15 MB, uncompressed.** Every invocation the church has is physical — a tag
 * by a door, a code on a card — and physical invocations do not get the larger
 * budget iOS 17 added for links. The JS is only part of that; the statically
 * linked Firebase frameworks are the bigger share, which is what
 * `excludedPackages` in app.config.ts is for. But a JS graph that drags in
 * SQLite and the photo picker also drags in their native halves, so the two
 * levers only work together.
 *
 * ## What is deliberately absent
 *
 * No `@/upload/backgroundDrain` import: an App Clip may not run background
 * tasks at all, and `TaskManager.defineTask` at module scope in a target with
 * no background capability is a crash rather than a no-op.
 *
 * ## The switch below is the navigator
 *
 * Eight experiences, one binary, and no stack — an App Clip has one invocation
 * and one job, which is Apple's own guidance and also the only shape that fits
 * a process whose storage does not survive to a second visit. `experiences.ts`
 * is the table; `invocation.ts` answers which row the URL asked for.
 */
import { useCallback, useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { AppCheckSpike } from '@/clip/AppCheckSpike';
import { ClipFrame } from '@/clip/ClipFrame';
import { experience, type ClipSlug } from '@/clip/experiences';
import { useInvocation } from '@/clip/invocation';
import { setClipNavigator } from '@/clip/navigate';
import { Apps } from '@/clip/screens/Apps';
import { Bookstore } from '@/clip/screens/Bookstore';
import { Forms } from '@/clip/screens/Forms';
import { Give } from '@/clip/screens/Give';
import { Hub } from '@/clip/screens/Hub';
import { Photos } from '@/clip/screens/Photos';
import { Plans } from '@/clip/screens/Plans';
import { Schedule } from '@/clip/screens/Schedule';
import { Welcome } from '@/clip/screens/Welcome';
import { SessionProvider } from '@/session/SessionProvider';
import { ThemeProvider } from '@/theme/ThemeProvider';

const SCREENS: Record<ClipSlug, () => React.JSX.Element> = {
  give: Give,
  schedule: Schedule,
  apps: Apps,
  welcome: Welcome,
  plans: Plans,
  bookstore: Bookstore,
  forms: Forms,
  photos: Photos,
};

/**
 * The invocation that is not an experience.
 *
 * `AppCheckSpike` answers the one question the whole clip is waiting on — can
 * Firebase App Check mint a token inside an App Clip, where App Attest attests
 * against the *parent* bundle identifier? It is registered in App Store Connect
 * nowhere and printed on nothing. To run it, put this URL in Xcode's App Clip
 * scheme (Run → Arguments → "App Clip Invocation URL"), on a real device, in
 * Release. See README.md, which carries the rest of that procedure.
 */
const DIAGNOSTIC = '/c/appcheck';

export function ClipRoot() {
  const { slug, raw, ready } = useInvocation();
  /*
   * The invocation decides the first screen; after that a borrowed screen may
   * ask for another — `AppsScreen` links to the expansion plans, and the tour
   * links onward through About. `navigate.ts` turns those into this.
   */
  const [chosen, setChosen] = useState<ClipSlug | null>(null);

  const go = useCallback((next: ClipSlug) => setChosen(next), []);

  useEffect(() => {
    setClipNavigator(go);
    return () => setClipNavigator(null);
  }, [go]);

  const current = chosen ?? slug;
  const meta = current ? experience(current) : undefined;
  const Screen = current ? SCREENS[current] : null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <SessionProvider>
            <StatusBar style="light" />
            {raw?.includes(DIAGNOSTIC) ? (
              <AppCheckSpike />
            ) : Screen && meta ? (
              <ClipFrame title={meta.title} sitePath={meta.sitePath}>
                <Screen />
              </ClipFrame>
            ) : (
              /*
               * No URL yet, or one this binary does not know. `ready` holds the
               * hub back for a fifth of a second rather than flashing a menu in
               * front of somebody who tapped a tag — see `invocation.ts`.
               */
              <ClipFrame title={'St. Philopater & St. Mina'}>
                {ready ? <Hub onOpen={go} /> : null}
              </ClipFrame>
            )}
          </SessionProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
