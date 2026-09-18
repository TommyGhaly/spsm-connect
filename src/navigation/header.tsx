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
 * should look like this app without wearing its two controls. The root stack
 * takes it through `headerSkinStack`, because its bars are real ones.
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
 * `headerSkin` for a real `UINavigationBar`, which needs one thing more: being
 * told that it is a dark bar.
 *
 * ## The bug this fixes: the glowing header
 *
 * Reported as the bookstore header "glowing", and as the galleries "glitching".
 * Both are one thing. Measured on an iPhone 17 Pro at 3×, sampling inside a
 * control's capsule away from its glyph:
 *
 * | bar                       | capsule       |
 * | ------------------------- | ------------- |
 * | drawer (React-drawn)      |  57,  18,  18 |
 * | bookstore, shelf at top   | 182, 160, 160 |
 * | bookstore, after a scroll |  56,  19,  19 |
 * | bookstore, tab away, back | 255, 215, 215 |
 *
 * Three different capsules for one control, on bars that are the same red. The
 * pale rows are the glow, and the galleries' flicker is the same numbers
 * arriving one per frame as photographs pass under the bar.
 *
 * ## Why a navigation bar did this and our own headers did not
 *
 * Because expo-router tells the bar what appearance to wear, and it reads that
 * from the *app's* theme:
 *
 *     experimental_userInterfaceStyle: dark ? 'dark' : 'light'
 *
 * — `useHeaderConfigProps`, one line above the spread of these very
 * `unstable_nativeProps`. This app's react-navigation theme is the light one,
 * because the app *is* light: `paper` under everything. So every real bar in it
 * was being told `'light'` — and a bar button item on iOS 26 is glass, so a
 * light appearance is a near-white lens over whatever is behind the bar. What
 * is behind the bar is the screen's own content, scrolled under it, which is
 * why the same control came out at three different values depending on what
 * happened to be up there.
 *
 * The tabs' and the drawer's headers are React views. Nothing tells them an
 * appearance, so the `colorScheme="dark"` our capsules already carry (see
 * `HeaderCapsule`) is the only thing deciding, and they were the steady ones
 * all along. This is the same fix, applied to the bars that were overruling it.
 *
 * With the bar told the truth, all of the rows above read 56, 19, 19 — at rest,
 * mid-scroll, and with a photograph under the bar — which is the number UIKit's
 * *own* back button renders beside them, and within a level of the drawer's
 * 57, 18, 18. Every bar in the app, one capsule.
 *
 * ## Why not the other two fixes that also work
 *
 * `scrollEdgeEffects: { top: 'hidden' }` removes what the glass samples rather
 * than how it samples it, and measured just as dark — but only sometimes. That
 * option is applied once, when the prop changes, by walking the screen's first
 * descendants for a scroll view (`RNSScrollEdgeEffectApplicator`); on a cold
 * launch the shelf's list is not there yet, nothing is found, and it is never
 * retried. It fixed the bookstore on a Fast Refresh and did nothing at all on a
 * relaunch, which is worse than not fixing it.
 *
 * A `tintColor` on the capsule holds still too, and it was measured (24, 18,
 * 16). It is the wrong fix for the same reason painting the capsule was: it
 * steadies *our* two controls and leaves UIKit's back button in the lottery,
 * one capsule away. The appearance is the only one of the three that the
 * back button hears.
 *
 * ## `experimental_`
 *
 * RNS's prefix, and its note says it does not support changing while a screen
 * is visible. Ours never changes: the bar is `deep` on every screen, on a
 * device whose own appearance it has never followed. The risk is the name
 * moving, and the cost of that is this one line.
 */
export function headerSkinStack(theme: ResolvedTheme) {
  return {
    ...headerSkin(theme),
    unstable_nativeProps: {
      headerConfig: { experimental_userInterfaceStyle: 'dark' as const },
    },
  } as const;
}

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
    ...headerSkinStack(theme),
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
