/**
 * The tab bar: four places somebody goes, and the camera between them.
 *
 * ## What changed, and what the old notes said
 *
 * This was four tabs — Home, Calendar, Photos, More — and its own comment said
 * "four tabs rather than seven because a phone's tab bar stops being readable
 * at five". It then became six, deliberately, with a note that dropping one of
 * them into the drawer was the first thing to try if the labels started
 * truncating. That is what has happened: Photos is a drawer screen now, and the
 * bar is back to five slots with the camera in the middle of them.
 *
 * ## Why Photos, of the six
 *
 * Because it was the one that lost the least. The galleries are a stack four
 * levels deep and the tab bar was never the way anybody moved inside it — you
 * arrive from the drawer or a link, browse down, and swipe back. The other four
 * are single screens where the bar is genuinely the navigation.
 *
 * The cost is real and worth naming: the bar no longer follows you into a
 * gallery, so leaving one means a back-swipe or the drawer rather than a press.
 * See `(drawer)/events/_layout.tsx`.
 *
 * ## The camera
 *
 * Raised, circular, and in the middle — third of five, which is the middle
 * exactly — because sending a photograph is the one thing this app exists for
 * and it should not be a menu item. It is a real route rather than a floating
 * action button: an App Clip invocation and a universal link both have to be
 * able to land on it, and a button that only exists inside a rendered tab bar
 * cannot be a destination.
 *
 * The order around it is not alphabetical and not arbitrary. Calendar and Forms
 * are the church asking you to turn up or to fill something in; Bookstore and
 * Giving are the two that take a payment. Two of each, either side.
 *
 * ## The register
 *
 * `admin/camp/attendance` is a tab only during the camp, and lives in the
 * drawer the rest of the year. `href: null` is what hides it — the route stays
 * navigable, so the drawer link and any deep link still work; it just stops
 * being drawn in the bar. See `useCampWeek` for what "during the camp" means.
 *
 * During that week the bar is six wide and the camera is no longer centred —
 * six slots have no middle. That is the week it is least important: everybody
 * using the register is already in the camp's own screen all day.
 *
 * The URL is the website's, not a convenience: `/admin/camp/attendance` is App
 * Clip experience #9 and a tag pointing at it has to land here.
 *
 * ## The header
 *
 * Menu on the left, announcements on the right — and not only on every tab.
 * That is the header every navigator in the app draws now; it lives in
 * `src/navigation/header.ts` and is spread into `screenOptions` below.
 */
import { Tabs } from 'expo-router';
/*
 * The tab-bar button's own prop type, from expo-router's vendored copy of the
 * navigator rather than from `@react-navigation/bottom-tabs`. SDK 56 stopped
 * supporting imports from the external packages and points at "matching
 * expo-router entry points" instead; this is that module. It is a deep path
 * into `build/`, so it is imported once, here, and nowhere else.
 */
import type { BottomTabBarButtonProps } from 'expo-router/build/react-navigation/bottom-tabs';
import { Pressable, View, useWindowDimensions, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/Icon';
import { headerChrome, headerRoot } from '@/navigation/header';
import { useCampWeek } from '@/camp/useCampWeek';
import { mayAdminScreen } from '@/firebase/grants';
import { useGrants } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';

/*
 * The camera is the anchor, not the first tab declared.
 *
 * Order in this file is order in the bar, and the camera is third so that it
 * sits in the middle — which would otherwise make Calendar the route a deep
 * link falls back to. Somebody who opens `/giving` from a link and then presses
 * back should land on the thing the app is for.
 */
export const unstable_settings = {
  initialRouteName: 'index',
};

export default function TabLayout() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  // The bar is twelve points shorter in landscape; `barHeight` is the only
  // thing that knows, and it needs the window to work it out.
  const window = useWindowDimensions();
  const grants = useGrants();
  const duringCamp = useCampWeek();

  /*
   * Both conditions, and in this order. The grant decides whether the register
   * is reachable at all; the season only decides where the door is. Somebody
   * without `camp` never sees it, in July or in February.
   *
   * Not a security boundary — firestore.rules is — but drawing a tab somebody
   * cannot use is its own kind of lie.
   */
  const mayTakeRegister = mayAdminScreen(grants, 'camp');
  const registerInBar = mayTakeRegister && duringCamp;

  const icon = (name: IconName) =>
    function TabIcon({ color, size }: { color: ColorValue; size: number }) {
      return <Icon name={name} color={color} size={size} />;
    };

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.color.accent,
        tabBarInactiveTintColor: theme.color.inkFaint,
        tabBarStyle: {
          backgroundColor: theme.color.paperRaised,
          borderTopColor: theme.color.rule,
        },
        tabBarLabelStyle: { fontFamily: theme.fontFamily.ui },
        sceneStyle: { backgroundColor: theme.color.paper },

        /*
         * The bar, and the two corners of it, from the one place they are
         * described — every screen of every navigator in this app wears the
         * same one. `headerRoot` because a tab is never pushed onto anything:
         * there is no back button to give the left corner to.
         *
         * The reasoning for the pairing is in `src/navigation/header.ts`. The
         * part worth repeating here is why the bell is a *header* control and
         * not a calendar one: it was inside the calendar's own content until
         * this redesign, which made the notices a fact about one screen. They
         * are not — "the festival is on the 19th" is as true on Giving.
         */
        ...headerChrome(theme, insets.top, window),
        ...headerRoot,
      }}
    >
      <Tabs.Screen name="calendar" options={{ title: 'Calendar', tabBarIcon: icon('calendar') }} />
      {/*
        Forms is a stack — the hub, then whichever form was pressed — so it
        draws its own headers and this one is turned off. Two dark bars, one
        saying "Forms" and one saying "Contact the church office", is what
        leaving it on looks like. The drawer button and the bell are put back
        inside that stack; see `forms/_layout.tsx`.
      */}
      <Tabs.Screen
        name="forms"
        options={{ title: 'Forms', tabBarIcon: icon('file'), headerShown: false }}
      />

      {/*
        The camera draws no header at all. Every other tab wears the parish's
        dark bar with the menu and the bell in it; a viewfinder wearing one is
        a photograph with a strip cut off the top of it, and the two controls
        it carries are both reachable from the drawer that is one swipe away.
        The screen puts its own chrome — the destination, the flash, the flip
        — inside the preview, on scrims, where a camera's controls belong.
      */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Send',
          tabBarLabel: () => null,
          tabBarButton: CameraButton,
          headerShown: false,
        }}
      />

      {/*
        The bookstore is a stack too, for the same reason Forms is: the shop,
        then its orders queue or its figures pushed on top. Editing the shop
        happens on the shelf rather than on a screen of its own, so those two
        are the whole of what the stack adds. See `bookstore/_layout.tsx`.
      */}
      <Tabs.Screen
        name="bookstore"
        options={{ title: 'Bookstore', tabBarIcon: icon('bag'), headerShown: false }}
      />
      <Tabs.Screen name="giving" options={{ title: 'Giving', tabBarIcon: icon('gift') }} />

      <Tabs.Screen
        name="admin/camp/attendance"
        options={{
          title: 'Attendance',
          tabBarIcon: icon('check'),
          href: registerInBar ? undefined : null,
        }}
      />

      {/*
        The camp's other two screens: never in the bar, at any time of year.

        `href: null` unconditionally, which is not the same decision the
        register's line above makes. The register is used all day, at a door, by
        somebody whose thumb should not have to find it — that is what a tab is
        for. These two are read: the front page once a season, to open or close
        the servants' form, and the groups when somebody in the hall asks which
        crew a child is in. Both are one press from the register's own nav and
        from the drawer, and neither is worth a sixth slot in a bar that is
        already at five.

        They are declared here rather than left implicit because a file under a
        `Tabs` directory *is* a tab: without these lines the navigator would
        draw two more, labelled from their filenames, for everybody.
      */}
      <Tabs.Screen name="admin/camp/index" options={{ title: 'Camp', href: null }} />
      <Tabs.Screen name="admin/camp/groups" options={{ title: 'Groups', href: null }} />
    </Tabs>
  );
}

/**
 * The centre button.
 *
 * Its own component rather than a styled `tabBarIcon`, because the shape has to
 * break out of the bar: a filled circle lifted above the rule, which is the one
 * control on this screen that should read as an action rather than a place.
 *
 * The corner is `theme.radius.full`, clamped here rather than stored as 9999 —
 * which is exactly what the shared schema says `full` is for: "pills and
 * avatars, clamped by the consumer". The lift is a spacing token. The diameter
 * and the glyph are plain numbers, like `minHeight: 44` in `Surface` and like
 * the website's own `<Icon size={20} />`: a touch target is a platform
 * minimum, not a thing the church gets to restyle.
 *
 * `onPress` is taken from the props the navigator supplies rather than routing
 * by hand — the navigator owns the tab's own press behaviour, including the
 * second tap that pops a stack back to its root.
 */
function CameraButton({ onPress, accessibilityState }: BottomTabBarButtonProps) {
  const theme = useTheme();
  const selected = accessibilityState?.selected === true;

  // 44pt is Apple's minimum target; this is comfortably over it.
  const diameter = 56;

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Send a photograph"
        accessibilityState={{ selected }}
        style={({ pressed }) => ({
          width: diameter,
          height: diameter,
          borderRadius: Math.min(theme.radius.full, diameter / 2),
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: pressed || selected ? theme.color.accentStrong : theme.color.accent,
          // Lifts the circle over the bar's top rule without the bar having to
          // know about it.
          marginBottom: theme.space.md,
        })}
      >
        <Icon name="camera" color={theme.color.inkInverse} size={26} />
      </Pressable>
    </View>
  );
}
