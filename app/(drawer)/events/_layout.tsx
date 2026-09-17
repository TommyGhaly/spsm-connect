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
 * edge-swipe; going elsewhere, the menu in every header.
 *
 * The URL did not change. `(drawer)` and `(tabs)` are both parenthesised, so
 * moving between them contributes no segment: this is still `/events/...`, and
 * every link, App Clip invocation and `router.push` in the app still lands.
 *
 * The drawer screen's own header is off (see `(drawer)/_layout.tsx`) because
 * this stack draws its own, with the level's name in it. Two stacked would be
 * two titles.
 *
 * ## The header this stack used to draw
 *
 * It drew the menu in the **right** corner and no announcements bell — the only
 * place in the app that did either. That was a leftover from when the drawer
 * opened from the right, and it survived the move to a left drawer because the
 * options were spelled out here rather than shared. Both are fixed by taking
 * `headerChrome` like everything else: menu left on the directory, back button
 * left once you are inside a gallery, bell on the right the whole way down.
 *
 * The left edge is the back-swipe here and the drawer gives that gesture up on
 * this screen — `swipeEnabled: false` in `(drawer)/_layout.tsx` — so the menu
 * button in the header is how the drawer is opened from a gallery.
 */
import { Stack } from 'expo-router';

import { headerChromeStack, headerDeepStack, headerRootStack } from '@/navigation/header';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * The directory is underneath every gallery, however you arrived at one.
 *
 * Without this, a route that lands straight on a ministry — a universal link to
 * `/events/mother-of-mercy`, the calendar's `href`, a drawer row — opens that
 * ministry as the *only* screen in this stack, and back goes wherever the app
 * happened to be before. `initialRouteName` puts `index` beneath it, so back
 * from a ministry is "Photos", which is what the website does: its ministry
 * pages' back link is `/events`, labelled "Events". See `GalleryShell`.
 *
 * It is the tree's own shape as well as the website's. `/events` is the parent
 * of every ministry; no ministry is the parent of another, and a back button
 * that went from Mother of Mercy to Summercamp said one was.
 */
export const unstable_settings = {
  initialRouteName: 'index',
};

export default function EventsLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        ...headerChromeStack(theme),
        contentStyle: { backgroundColor: theme.color.paper },
      }}
    >
      {/* The directory, and the root: the menu goes where a pushed screen's
          back button will be. */}
      <Stack.Screen name="index" options={{ title: 'Photos', ...headerRootStack }} />

      {/*
        * No `title` here. Every level sets its own from the document it just
        * read — "Summercamp", "Week 1 2026" — with a `Stack.Screen` of its own,
        * because the name is not known until the read finishes.
        *
        * `headerDeepStack` puts the menu back beside the bell. Inside a gallery
        * the left corner is the back button and the drawer's edge-swipe is off,
        * so without it there is no way to the menu from here at all — which is
        * what the first cut of this header shipped. See the note on it.
        */}
      <Stack.Screen name="[...trail]" options={headerDeepStack} />
    </Stack>
  );
}
