/**
 * One header, for every navigator in the app.
 *
 * The app has four navigators that draw a bar — the tabs, the forms stack, the
 * galleries stack and the drawer itself — and until this file existed each of
 * them spelled the same four style properties out again. They drifted, which is
 * the ordinary fate of a block of code copied four times: the galleries ended
 * up with the menu in the *right* corner and no announcements bell at all, so
 * the one screen somebody spends the longest in was the one screen where
 * both controls were somewhere else.
 *
 * ## The shape, and why it is this one
 *
 * **Menu on the left. Announcements on the right. The church's dark red
 * between them.**
 *
 * The two corners answer the two questions somebody arrives with, and they are
 * deliberately not the same kind of thing: the left is *where else is there*,
 * the right is *what am I being told*. Menu-left is the convention every other
 * app on the phone has already taught; that leaves the right — the corner a
 * thumb reaches without regripping — for the one control that changes week to
 * week. Neither is a fact about any one screen, which is why neither is
 * configured per screen.
 *
 * ## Inside a stack, the left corner belongs to the stack
 *
 * `headerChrome` is what goes on a navigator's `screenOptions`; `headerRoot` is
 * added to the *root* screen of a stack only. A pushed screen has a back button
 * there instead, because going back is the way out that screen actually needs,
 * and the menu is one press further away for the duration. This is what the
 * forms stack already did and it is now what the galleries do too.
 *
 * A navigator whose every screen is a root — the tabs, the drawer — spreads
 * both.
 *
 * ## What this is not for
 *
 * The root stack's modals (`sign-in`, `uploads`). They are presented *over* the
 * app rather than inside it, they have their own dismissal, and a menu button
 * on a modal would navigate the screen underneath it. They keep the colours and
 * take neither control; see `app/_layout.tsx`.
 */
import { AnnouncementsButton } from './AnnouncementsButton';
import { DrawerButton } from './DrawerButton';
import { barHeight, BarSlot, barStatusBarHeight, headerTint } from './HeaderCapsule';

import type { ResolvedTheme } from '@/theme/tokens';

/**
 * The bar's own surface: the church's dark red, and the UI face on top of it.
 *
 * Separate from `headerChrome` for one caller — the root stack, whose modals
 * should look like this app without wearing its two controls.
 *
 * A function of the theme rather than a constant, because every value in it
 * comes from `config/theme` — the church can change the red and the type scale,
 * and a header that had memorised either would be the one surface that did not
 * follow.
 */
export function headerSkin(theme: ResolvedTheme) {
  return {
    headerStyle: { backgroundColor: theme.color.deep },

    /*
     * The tint is the *controls*, not the title — and on iOS 26 it is the
     * capsule under a control rather than the control itself.
     *
     * That last part is the whole reason `headerTint` exists as its own
     * function rather than being shared with the colour our own glyphs use;
     * its note has the measurements. The short version: UIKit fills the glass
     * capsule with this and picks its own chevron colour for contrast, so
     * handing it white gets a pale lozenge beside our two dark circles.
     *
     * The title keeps its own colour, stated here rather than inherited,
     * because nothing is drawn behind the title: it is white on the red bar on
     * every device and every OS version.
     */
    headerTintColor: headerTint(theme),
    headerTitleStyle: {
      fontFamily: theme.fontFamily.ui,
      fontSize: theme.fontSize.subheading,
      color: theme.color.inkInverse,
    },
  } as const;
}

/**
 * The bar this app draws itself, with the announcements bell in its right
 * corner: the tabs and the drawer.
 *
 * `topInset` is `useSafeAreaInsets().top`, and it is a parameter rather than a
 * hook call because this is not a component. It buys the one thing a React
 * header cannot work out for itself — see `barHeight`. Without it these bars
 * stand six points shorter than a navigation bar, which is exactly the
 * difference between the forms header looking considered and the tabs' looking
 * cramped.
 */
export function headerChrome(theme: ResolvedTheme, topInset: number) {
  return {
    ...headerSkin(theme),
    headerStyle: { backgroundColor: theme.color.deep, height: barHeight(topInset) },

    /*
     * The true status bar, not the whole safe-area inset. Without it the extra
     * height added above lands *under* the controls instead of around them —
     * see `statusBarHeight`.
     */
    headerStatusBarHeight: barStatusBarHeight(topInset),

    /*
     * The bell follows you everywhere, including four levels into a gallery and
     * into a form. "The festival is on the 19th" is as true on Giving as on the
     * calendar, and a bell that appeared on some screens and not others is one
     * nobody would learn the position of.
     *
     * It reads the bulletin from `BulletinProvider`, mounted once above the
     * drawer, so every header in the app shares a single read of it.
     */
    headerRight: () => (
      <BarSlot>
        <AnnouncementsButton />
      </BarSlot>
    ),
  } as const;
}

/**
 * The left corner, for a screen that has no back button to put there.
 *
 * Every screen of the tabs and of the drawer; the root screen of a stack.
 */
export const headerRoot = {
  headerLeft: () => (
    <BarSlot>
      <DrawerButton />
    </BarSlot>
  ),
} as const;

/* -- the same header, asked for the way a native stack needs it ------------ */

/**
 * `headerChrome` for the two navigators whose header is a real
 * `UINavigationBar` — the forms stack and the galleries.
 *
 * ## Why these two cannot take the plain options
 *
 * Because iOS 26 would draw a *second* capsule. A bar button item gets a glass
 * background from UIKit whether or not the view inside it has one, so a control
 * that draws its own — which every header control in this app now does, so that
 * the tabs and the drawer can have them too — comes out wearing two. The
 * `hidesSharedBackground` flag is the one that turns UIKit's off, and it is
 * per-item: it can only be set through the items API, not through the
 * `headerLeft`/`headerRight` elements.
 *
 * Note what is deliberately *not* suppressed: the back button on a pushed
 * screen. That one is still UIKit's, capsule and all, which is exactly what it
 * should be — it is the system's control, it carries the back-swipe and the
 * long-press menu, and `HeaderCapsule` sizes ours to match it rather than the
 * other way round.
 *
 * ## `unstable_`
 *
 * The prefix is expo-router's and it means what it says. It is worth the risk
 * here because the alternative is one of the two finishes being wrong on some
 * screens, and it is cheap to unwind: both uses are in this file, and dropping
 * back to `headerLeft`/`headerRight` costs a duplicated capsule, not a broken
 * screen.
 */
export function headerChromeStack(theme: ResolvedTheme) {
  return {
    ...headerSkin(theme),
    unstable_headerRightItems: () => [
      { type: 'custom' as const, element: <AnnouncementsButton />, hidesSharedBackground: true },
    ],
  };
}

/** `headerRoot` for a native stack: the root screen's menu, without UIKit's capsule. */
export const headerRootStack = {
  unstable_headerLeftItems: () => [
    { type: 'custom' as const, element: <DrawerButton />, hidesSharedBackground: true },
  ],
};

/**
 * A pushed screen that still has to be able to open the menu: the bell moves
 * over and the menu joins it on the right.
 *
 * ## Why this is not the rule for every pushed screen
 *
 * Because on most of them the menu is not gone, only one press further away.
 * Push a form and the tab bar is still on screen — leave the stack, open the
 * menu from any tab. **The galleries are the exception, and they are the reason
 * this exists.** They are a drawer screen rather than a tab, so there is no bar
 * underneath; the left corner is the back button; and the drawer's edge-swipe
 * is turned off on that screen precisely so it cannot be confused with the
 * stack's back-swipe (`swipeEnabled: false` in `(drawer)/_layout.tsx`). Four
 * levels into Summercamp, with nothing but a back button, the menu is not one
 * press away — it is four, and then it is on a different screen.
 *
 * The version of this stack before the shared header had `headerRight:
 * DrawerButton` on *every* level for exactly this reason, and its comment said
 * so: "four levels into a gallery is exactly where somebody decides they want
 * to be somewhere else". Making the header uniform quietly deleted that, which
 * is the kind of regression a tidy-up is supposed to be incapable of.
 *
 * The menu is the outer of the two, in the corner it used to have to itself.
 */
export const headerDeepStack = {
  unstable_headerRightItems: () => [
    { type: 'custom' as const, element: <AnnouncementsButton />, hidesSharedBackground: true },
    { type: 'custom' as const, element: <DrawerButton />, hidesSharedBackground: true },
  ],
};
