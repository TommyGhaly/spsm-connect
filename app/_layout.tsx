import { useEffect, useRef } from 'react';
import { Stack, useRouter, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Fault } from '@/diagnostics/Fault';
import { watchForFaults } from '@/diagnostics/report';
import { headerSkinStack } from '@/navigation/header';
import { quietInForeground, watchNotificationTaps } from '@/notify/handle';
import { useNotifyLifecycle } from '@/notify/useNotifyLifecycle';
import { SessionProvider } from '@/session/SessionProvider';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

/*
 * Imported for its side effect and nothing else. `TaskManager.defineTask` has
 * to have run before the OS launches this app headlessly into the drain task,
 * and "before" means at module scope on every start — not lazily from the
 * screen that happens to show the queue, which in a headless launch never
 * mounts. See src/upload/backgroundDrain.ts.
 *
 * The App Clip never reaches this file (it enters at index.clip.ts and does not
 * use the router at all), which is deliberate: a clip may not run background
 * tasks, and defining one would be a crash rather than a no-op.
 */
import '@/upload/backgroundDrain';

/*
 * The same arrangement, for the reminder window. `TaskManager.defineTask` has
 * to have run before the OS launches this app headlessly into the refresh, and
 * the screen that owns the switches never mounts in a headless launch. See
 * src/notify/backgroundReminders.ts.
 *
 * Also kept out of the App Clip, which cannot run background tasks and gets
 * only the ephemeral kind of push — see `excludedPackages` in app.config.ts.
 */
import '@/notify/backgroundReminders';

/*
 * How a notification behaves when it arrives with the app already open: it
 * does not. At module scope rather than in an effect because
 * `setNotificationHandler` is global to the process, and a local reminder can
 * be delivered before any component has mounted — on a cold start into the
 * notification itself, which is exactly when a duplicate banner would show.
 *
 * See the note in src/notify/handle.ts: a banner over the app that sent it is
 * the notification pattern everybody finds irritating, and the screen it is
 * about is one tap away.
 */
quietInForeground();

/*
 * The navigator is its own component so it sits *inside* ThemeProvider and can
 * therefore read the church's colours for the header. A Stack configured above
 * the provider would have to hardcode them, which is the one thing this app
 * does not do.
 */
function RootStack() {
  const theme = useTheme();
  const router = useRouter();

  /*
   * Where a tapped notification goes. Installed here rather than on a screen
   * because a tap can arrive before any screen exists — the cold-start case —
   * and this component is mounted for the life of the app.
   *
   * `router.push` and never the route from the payload: `routeFor` maps it
   * through a fixed table. A push payload is the one input this app receives
   * without having asked for it, and navigating to an arbitrary string from one
   * is how a notification becomes a way to drive somebody's session.
   */
  useEffect(() => watchNotificationTaps((route) => router.push(route)), [router]);

  /*
   * The start-up housekeeping: channels, the reminder horizon, and re-asserting
   * this phone's registration against the grants its owner holds *now*. It asks
   * for no permissions and signs nobody in — see its header.
   *
   * Here rather than in a screen because none of it may depend on somebody
   * opening the settings screen, which most people never will. It reads the
   * session, so it has to be inside SessionProvider, which this component is.
   */
  useNotifyLifecycle();

  /*
   * The other half of the crash reporting, and the half no error boundary can
   * do: a throw outside React, or a promise nobody caught. `ErrorBoundary`
   * above sees only failures during rendering, and those are a minority of what
   * actually goes wrong in an app that talks to a network.
   *
   * The route is handed in as a *function* rather than a value, because the
   * handler is installed once and outlives every screen — closing over today's
   * pathname would file every fault for the rest of the session against
   * whatever screen happened to be open when the app started. The ref is what
   * keeps that function cheap and current without re-installing the handler on
   * every navigation.
   */
  const pathname = usePathname();
  const here = useRef(pathname);
  useEffect(() => {
    here.current = pathname;
  }, [pathname]);
  useEffect(() => watchForFaults(() => here.current), []);

  return (
    <Stack
      screenOptions={{
        /*
         * The skin and not the whole header: `headerSkinStack` is the bar's
         * colours, type and appearance, `headerChrome` adds the menu and the
         * bell. The two screens here are modals presented *over* the app — a
         * menu button on one would navigate the screen underneath it, and the
         * bell has no business interrupting a sign-in. They look like the app;
         * they do not pretend to be a place in it.
         */
        ...headerSkinStack(theme),
        contentStyle: { backgroundColor: theme.color.paper },
      }}
    >
      {/*
        * The drawer group, which is everything with a tab bar or a menu behind
        * it. Its screens draw their own headers; two stacked would be two
        * titles — and until this said `(drawer)` rather than `(tabs)`, that is
        * exactly what it was: a bar reading "(drawer)" above every real one,
        * because a screen this stack does not name gets a default header
        * titled after its own route segment.
        */}
      <Stack.Screen name="(drawer)" options={{ headerShown: false }} />
      <Stack.Screen name="uploads" options={{ title: 'Sending' }} />
      <Stack.Screen name="sign-in" options={{ title: 'Sign in', presentation: 'modal' }} />
    </Stack>
  );
}

/*
 * What expo-router draws when anything below this layout throws while
 * rendering, and it is the reason a bug is no longer a white screen with no way
 * out. The name is the contract — expo-router looks for an export called
 * `ErrorBoundary` on a route — so this alias is not cosmetic. See
 * `src/diagnostics/Fault.tsx`.
 */
export { Fault as ErrorBoundary };

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <SessionProvider>
            <StatusBar style="light" />
            <RootStack />
          </SessionProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
