/**
 * The drawer: everything that is not one of the five things in the tab bar.
 *
 * The tab bar answers "what did you open the app to do". This answers "where
 * else is there", and it is where the galleries, the About pages, the church's
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
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BulletinProvider } from '@/calendar/BulletinProvider';
import { headerChrome, headerRoot } from '@/navigation/header';
import { DrawerContent } from '@/navigation/DrawerContent';
import { useTheme } from '@/theme/ThemeProvider';

export default function DrawerLayout() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  // See the same line in `(tabs)/_layout.tsx`: `barHeight` sizes the bar from
  // the window as well as the inset.
  const window = useWindowDimensions();

  /*
   * The bulletin is read here, above the navigator, because the announcements
   * bell is in every tab header and the notices are not a fact about any one
   * screen. Mounted at the drawer rather than at the root stack so that the
   * modal routes above it — `sign-in`, `uploads` — do not hold a subscription
   * to a document they never show.
   */
  return (
    <BulletinProvider>
      <Drawer
        drawerContent={DrawerContent}
        screenOptions={{
          /*
           * The same header as everywhere else — see `src/navigation/header.ts`
           * — spread first so the drawer's own options below read as the
           * drawer's own. `headerRoot` because these screens are siblings of
           * `(tabs)` rather than children of it: nothing is pushed, so there is
           * no back button competing for the left corner.
           *
           * This is where copying the forms header costs something, and it is
           * worth naming. The right corner used to hold a × that went back to
           * the tabs (`HomeButton`, now deleted); it is the bell on every screen
           * in the app instead. About and Contact keep one way back — the Home
           * row in the drawer's masthead — and it is one press further away than
           * it was. The trade is that no screen in this app now puts a different
           * control in the same corner as another.
           */
          ...headerChrome(theme, insets.top, window),
          ...headerRoot,
          /*
           * Opens from the left, which is where a menu is on every other app on
           * the phone, and where this one's header button now is.
           *
           * **This was `'right'`, and the reason it was is still true**, so it
           * is worth writing down rather than deleting: a left drawer fights
           * the back-swipe. The galleries are a stack four levels deep and an
           * edge-swipe from the left is how you go back, so a drawer on that
           * edge makes every attempt to leave Day 1 a coin toss between popping
           * the stack and opening a menu.
           *
           * What makes the move safe is `swipeEnabled: false` on `events`
           * below. The conflict was only ever inside the gallery stack — it is
           * the one place with somewhere to go back *to* — so the drawer keeps
           * its swipe on the tabs, where the left edge means nothing else, and
           * gives it up on the one screen where it would be ambiguous. The menu
           * button is on every header either way, so nothing becomes
           * unreachable.
           */
          drawerPosition: 'left',
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
        <Drawer.Screen
          name="events"
          options={{
            title: 'Photos',
            headerShown: false,
            // The left edge belongs to the stack's back-swipe here. See
            // `drawerPosition` above.
            swipeEnabled: false,
          }}
        />

        {/*
          * Who administers what, for the superadmin.
          *
          * A stack for the same reason the galleries are — a person is pushed
          * on top of the directory — so it titles itself and draws its own
          * header, and the left edge belongs to its back-swipe. Nothing links
          * here but one row in the drawer's account card, and `SuperadminOnly`
          * refuses to draw for anybody else. See `access/_layout.tsx`.
          */}
        <Drawer.Screen
          name="access"
          options={{
            title: 'Areas',
            headerShown: false,
            swipeEnabled: false,
          }}
        />

        <Drawer.Screen name="about/index" options={{ title: 'About' }} />
        <Drawer.Screen name="about/[page]" options={{ title: 'About' }} />
        <Drawer.Screen name="livestream" options={{ title: 'Watch live' }} />
        <Drawer.Screen name="contact" options={{ title: 'Contact' }} />
        <Drawer.Screen name="apps" options={{ title: 'Our apps' }} />
        <Drawer.Screen name="notifications" options={{ title: 'Notifications' }} />
        <Drawer.Screen name="privacy" options={{ title: 'Privacy' }} />
      </Drawer>
    </BulletinProvider>
  );
}
