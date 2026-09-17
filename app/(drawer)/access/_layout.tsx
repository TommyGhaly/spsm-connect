/**
 * Areas is a stack, not a screen.
 *
 * The website draws the church's people and one person's allocation side by
 * side; a phone has room for one at a time, so the directory is the root here
 * and a person is pushed on top of it. That makes going *into* somebody a push,
 * and the way back out the stack's own back button and the edge-swipe — the
 * same shape the galleries and the forms have.
 *
 * ## The route is `/access`, as on the website
 *
 * Not `/areas`, though the screen is called Areas in both places. The website's
 * route is `/access` and the app follows it, so a link in an email or a
 * universal link lands in the same place whichever it opens in. The *title* is
 * the church's word for the thing; the path is the programme's.
 *
 * ## Unlisted, and reached from the account card
 *
 * Nothing links here except one row in the drawer's account card, which renders
 * for the superadmin and for nobody else. That is a convenience rather than a
 * protection and does not need to be one: `allow update: if isSuper()` on
 * `/members/{uid}` refuses every write from anybody else, `allow read` refuses
 * the directory, and `SuperadminOnly` refuses to draw. Somebody who types the
 * path gets told plainly.
 *
 * The drawer screen's own header is off — see `(drawer)/_layout.tsx` — because
 * this stack draws its own, with the person's name in it. Two stacked would be
 * two titles.
 */
import { Stack } from 'expo-router';

import { headerChromeStack, headerDeepStack, headerRootStack } from '@/navigation/header';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * The directory is underneath a person, however you arrived at one.
 *
 * Without this, a route that lands straight on somebody — a deep link, a
 * `router.push` from anywhere but the list — opens that person as the *only*
 * screen in this stack, and back goes wherever the app happened to be before.
 */
export const unstable_settings = {
  initialRouteName: 'index',
};

export default function AccessLayout() {
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
      <Stack.Screen name="index" options={{ title: 'Areas', ...headerRootStack }} />

      {/*
        * No `title` here. `PersonScreen` sets it to the person's name once the
        * member document has been read, which is also what the back button on
        * this screen says.
        *
        * `headerDeepStack` puts the menu back beside the bell. Inside this
        * stack the left corner is the back button and the drawer's edge-swipe
        * is off, so without it there is no way to the menu from here at all.
        */}
      <Stack.Screen name="[uid]" options={{ title: 'Areas', ...headerDeepStack }} />
    </Stack>
  );
}
