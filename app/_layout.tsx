import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

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
 * The navigator is its own component so it sits *inside* ThemeProvider and can
 * therefore read the parish's colours for the header. A Stack configured above
 * the provider would have to hardcode them, which is the one thing this app
 * does not do.
 */
function RootStack() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.color.deep },
        headerTintColor: theme.color.inkInverse,
        headerTitleStyle: {
          fontFamily: theme.fontFamily.ui,
          fontSize: theme.fontSize.subheading,
        },
        contentStyle: { backgroundColor: theme.color.paper },
      }}
    >
      {/* The tab group draws its own headers; two stacked would be two titles. */}
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="uploads" options={{ title: 'Sending' }} />
      <Stack.Screen name="sign-in" options={{ title: 'Sign in', presentation: 'modal' }} />
    </Stack>
  );
}

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
