/**
 * The drawer: everything that is not one of the five things in the tab bar.
 *
 * The tab bar answers "what did you open the app to do". This answers "where
 * else is there", and it is where the galleries, the About pages, the parish's
 * own apps, contact, the livestream and the register-out-of-season live.
 *
 * ## Why a drawer and not a "More" tab
 *
 * A More tab spends one of five scarce slots on a list of links. A drawer costs
 * nothing in the bar — it opens from the header — and it can hold twenty rows
 * without any of them being a compromise. The screen this replaces, `more.tsx`,
 * had exactly three cards in it and a comment explaining that a list of six
 * things that do nothing is worse than a short list that works. The drawer is
 * where that list can grow honestly.
 *
 * ## Routes here are siblings of the tabs, not children
 *
 * `(tabs)` is one drawer screen; `/about`, `/contact` and the rest are others.
 * Opening one from the drawer replaces the tab view rather than nesting inside
 * it, which is the ordinary drawer contract and keeps every URL equal to the
 * website's — both groups are parenthesised, so neither contributes a segment.
 */
import { Drawer } from 'expo-router/drawer';

import { DrawerContent } from '@/navigation/DrawerContent';
import { useTheme } from '@/theme/ThemeProvider';

export default function DrawerLayout() {
  const theme = useTheme();

  return (
    <Drawer
      drawerContent={DrawerContent}
      screenOptions={{
        headerStyle: { backgroundColor: theme.color.deep },
        headerTintColor: theme.color.inkInverse,
        headerTitleStyle: {
          fontFamily: theme.fontFamily.ui,
          fontSize: theme.fontSize.subheading,
        },
        /*
         * Opens from the right. A left drawer fights the back-swipe: the
         * galleries are a stack four levels deep and an edge-swipe from the left
         * is how you go back, so putting the drawer there means every attempt to
         * leave Day 1 is a coin toss between popping and opening a menu.
         */
        drawerPosition: 'right',
        drawerStyle: { backgroundColor: theme.color.paper },
        drawerActiveTintColor: theme.color.accent,
        drawerInactiveTintColor: theme.color.ink,
        sceneStyle: { backgroundColor: theme.color.paper },
      }}
    >
      {/*
        * The tabs carry their own headers, so this one is off — otherwise every
        * screen in the app wears two. The drawer is opened from the tab
        * screens' own headers instead; see `DrawerButton`.
        */}
      <Drawer.Screen name="(tabs)" options={{ headerShown: false }} />

      {/*
        * The galleries, which were the Photos tab until the camera took the
        * middle of the bar. Same reason the tabs have no header here: this one
        * is a stack that titles itself from the level it is showing, so it
        * draws its own. See `events/_layout.tsx`.
        */}
      <Drawer.Screen name="events" options={{ title: 'Photos', headerShown: false }} />

      <Drawer.Screen name="about/index" options={{ title: 'About' }} />
      <Drawer.Screen name="about/[page]" options={{ title: 'About' }} />
      <Drawer.Screen name="beliefs" options={{ title: 'Our faith' }} />
      <Drawer.Screen name="welcome" options={{ title: 'Welcome' }} />
      <Drawer.Screen name="livestream" options={{ title: 'Watch live' }} />
      <Drawer.Screen name="contact" options={{ title: 'Contact' }} />
      <Drawer.Screen name="apps" options={{ title: 'Our apps' }} />
      <Drawer.Screen name="privacy" options={{ title: 'Privacy' }} />
    </Drawer>
  );
}
