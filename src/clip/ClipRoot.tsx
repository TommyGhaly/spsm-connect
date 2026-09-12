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
 * ## Why that matters
 *
 * **15 MB, uncompressed.** Every invocation the parish has is physical — a tag
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
 */
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { AppCheckSpike } from '@/clip/AppCheckSpike';
import { SessionProvider } from '@/session/SessionProvider';
import { ThemeProvider } from '@/theme/ThemeProvider';

export function ClipRoot() {
  /*
   * No navigator. Not a shortcut for the spike's sake — an App Clip has one
   * invocation and one job, and Apple's guidance is that it should be a single
   * task finished in a few taps. When the nine experiences arrive they branch
   * on the invocation URL, which is a switch rather than a stack.
   */
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <SessionProvider>
            <StatusBar style="light" />
            <AppCheckSpike />
          </SessionProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
