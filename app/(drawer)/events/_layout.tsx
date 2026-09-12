/**
 * The galleries are a stack, not a screen.
 *
 * A gallery is a tree and browsing it is pushing — Summercamp, then 2026 Week 1,
 * then Day 1 — so this is a navigator rather than a page.
 *
 * ## It used to be a tab, and now it is a drawer screen
 *
 * The old note here said keeping the stack inside the tab group was the point:
 * the bar stayed visible four levels down, so Home and Calendar were one press
 * away. That is the thing this move gives up, knowingly — the camera needed the
 * middle of the bar and five slots is the readable limit. See
 * `(tabs)/_layout.tsx` for why Photos was the one to move.
 *
 * What replaces the bar, going down, is the stack's own back button and the
 * edge-swipe; going elsewhere, the drawer button in every header. Which is why
 * the drawer opens from the *right* — an edge-swipe from the left is how you
 * leave Day 1, and the two would be fighting over the same gesture.
 *
 * The URL did not change. `(drawer)` and `(tabs)` are both parenthesised, so
 * moving between them contributes no segment: this is still `/events/...`, and
 * every link, App Clip invocation and `router.push` in the app still lands.
 *
 * The drawer screen's own header is off (see `(drawer)/_layout.tsx`) because
 * this stack draws its own, with the level's name in it. Two stacked would be
 * two titles.
 */
import { Stack } from 'expo-router';

import { DrawerButton } from '@/navigation/DrawerButton';
import { useTheme } from '@/theme/ThemeProvider';

export default function EventsLayout() {
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
        /*
         * This stack draws its own headers, so it does not inherit the drawer
         * button the tab screens get from `(tabs)/_layout`. Without this the
         * galleries — where somebody spends the most time, and now the one
         * place with no tab bar — would be the one place the menu cannot be
         * opened.
         *
         * On every level, not just the root: four levels into a gallery is
         * exactly where somebody decides they want to be somewhere else.
         */
        headerRight: DrawerButton,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Photos' }} />
      {/*
        * No `title` here. Every level sets its own from the document it just
        * read — "Summercamp", "Week 1 2026" — with a `Stack.Screen` of its own,
        * because the name is not known until the read finishes.
        */}
      <Stack.Screen name="[...trail]" />
    </Stack>
  );
}
