/**
 * The Photos tab is a stack, not a screen.
 *
 * A gallery is a tree and browsing it is pushing — Summercamp, then 2026 Week 1,
 * then Day 1 — so the tab holds a navigator rather than a page. Keeping it
 * *inside* the tab group is the point: the tab bar stays visible four levels
 * down, and Home and Calendar are one press away rather than one press away
 * after a back-swipe out of a modal.
 *
 * The tab's own header is off (see `(tabs)/_layout.tsx`) because this stack
 * draws its own, with the level's name in it. Two stacked would be two titles.
 */
import { Stack } from 'expo-router';

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
