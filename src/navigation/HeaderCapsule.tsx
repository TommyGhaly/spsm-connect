/**
 * The capsule the header's two controls sit in, and the measurements that make
 * one bar look like another.
 *
 * ## Where the capsules came from, and why only two screens had them
 *
 * Nobody wrote them. iOS 26 draws a Liquid Glass capsule behind every bar
 * button item of a real `UINavigationBar` on its own — so the forms stack and
 * the gallery stack, the two navigators whose header *is* a navigation bar,
 * wore capsules, and the tabs and the drawer, whose headers are React views
 * drawn by `@react-navigation/elements`, wore none. Same two buttons, two
 * finishes, depending on a fact about the navigator that nobody can
 * see.
 *
 * The capsules are the better half of that accident, so the app draws them
 * everywhere now. What that took is below, and none of it is taste: every
 * number here was measured off the screen, because "make the other headers look
 * like the forms header" is a claim that can be checked and was.
 *
 * ## The things that were wrong with the free version
 *
 * **The glyphs were the wrong colour, twice.** `headerTintColor` was
 * `inkInverse` — correct against the church's dark red and nearly invisible
 * against the pale capsule the first fix painted on top of that red. So the
 * tint became `deep` and our glyphs went dark with it, which was correct for a
 * pale capsule and wrong again the moment the capsule was measured properly and
 * turned out to want to be dark. It is settled now, and it took two functions
 * rather than one because the two things are not the same thing: `headerTint`
 * is what UIKit fills its capsule with, `headerGlyphColor` is what we draw our
 * glyphs in. Both of those notes carry the measurements. The title was never in
 * question — it is white on every device, because nothing is drawn behind it.
 *
 * **The capsules were the shape of our padding.** iOS sizes the capsule to the
 * view it is given, and it was being given a 22pt glyph in a 44pt-tall box with
 * 16pt of padding on each side: a wide lozenge on the left, a wider one on the
 * right, neither the same as the other. The capsule is a fixed square now and
 * the spacing lives outside it, so the two are one circle each.
 *
 * **The badge was clipped by an edge that had not existed.** It sat 2pt inside
 * the old 44pt box, which put it under the capsule's rounded corner. It hangs
 * off the capsule now, the way a badge on an app icon does.
 *
 * **The bars themselves did not match** — height, inset, and the air under the
 * capsule. See `BAR_EDGE` and the table with it.
 *
 * **And the material would not hold still.** See `HeaderCapsule`.
 *
 * ## Where there are no capsules
 *
 * `isLiquidGlassAvailable()` is false on Android and on iOS before 26, and
 * there the controls go back to a white glyph on the church's red, which is
 * what they have always been on those devices. The question that function
 * answers here is not "can this device blur" but "is this an OS whose own bars
 * put their buttons in capsules" — on one that does not, a pill would be an
 * affectation rather than a convention.
 *
 * It is also the only thing `GLASS` still decides about colour, and it decides
 * it in one place: `headerTint`, because `headerTintColor` means a capsule fill
 * on iOS 26 and a glyph colour everywhere else. Our own glyphs are white on
 * both paths.
 */
import type { ReactNode } from 'react';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import type { ResolvedTheme } from '@/theme/tokens';

/**
 * Whether this device draws Liquid Glass at all.
 *
 * A module constant rather than a hook: it is a fact about the OS the app was
 * launched on, it cannot change while the app is running, and every header in
 * the app asks it.
 */
export const GLASS = isLiquidGlassAvailable();

/**
 * The capsule's side, and the glyph inside it.
 *
 * Plain numbers, like `minHeight: 44` in `Surface` and the 56pt camera button
 * in the tab bar, and for the same reason: this is a control whose size is a
 * platform convention rather than a thing the church gets to restyle. 40pt is
 * what UIKit gives a bar button item's capsule on iOS 26, and matching it is
 * the whole point — a pushed screen's *back* button is still drawn by UIKit,
 * beside ours, and two capsules of different sizes in one bar would be worse
 * than the inconsistency this file exists to fix.
 *
 * The glyph drops from 22 to 20 to sit inside the capsule with room around it.
 */
export const CAPSULE = 40;
export const GLYPH = 20;

/**
 * How much of the church's ink goes over the bar to make a capsule.
 *
 * Fitted to the measurement in `HeaderCapsule`'s note rather than chosen, and
 * then checked: UIKit's own glass renders **(56, 19, 19)** on the **(72, 16,
 * 16)** bar, and `ink` at this weight renders **(56, 18, 17)** — two channels
 * one and two levels out, which is below anything an eye resolves against a
 * dark red. 0.28 was the first guess and came out at (60, 18, 17); those four
 * levels of red were visible, as the capsule being the lighter of the two.
 *
 * A bare number because the theme has no scrim token and this is the only place
 * in the app that needs one. If a second place ever does, it belongs in
 * `config/theme` rather than being copied — a wash is design intent, and the
 * rule at the top of `tokens.ts` is about exactly that.
 */
const CAPSULE_WASH = 0.37;

/**
 * The measurements a React-drawn bar has to copy from UIKit's.
 *
 * ## Read off the screen, not guessed
 *
 * These are not taste. A navigation bar and an `@react-navigation/elements`
 * header disagree about every dimension, and the disagreement is exactly what
 * made the forms header look considered and the tabs' look cramped. Measured on
 * an iPhone 17 Pro, in points:
 *
 * |                     | UIKit | elements |
 * | ------------------- | ----- | -------- |
 * | bar height          | 116.0 |    106.7 |
 * | capsule from edge   |  20.0 |     24.0 |
 * | air below capsule   |  12.0 |      2.3 |
 *
 * The last row is the one the eye reads: the capsule all but touching the
 * bottom edge of its own bar. Nine points of height, and the capsule sitting in
 * the middle of them instead of at the bottom, is the whole difference.
 *
 * `BAR_CONTENT` is the bar below the status bar — 116 less the status bar,
 * rounded to the point. Plain numbers, like the 44 in `Surface` and the 56pt
 * camera button: platform dimensions copied so the app agrees with itself, not
 * the church's to restyle.
 *
 * All of this is for the tabs and the drawer only — see `BarSlot` and
 * `barHeight`. A real bar button item gets the real thing for free.
 */
export const BAR_EDGE = 20;
export const BAR_CONTENT = 64;

/**
 * A header control on a bar this app draws itself, held off the edge the way
 * UIKit holds one off.
 *
 * The margin is here rather than on the buttons because the buttons are also
 * handed to a real navigation bar, which has already done this — and did it
 * twice, visibly, on the build where they carried their own.
 */
export function BarSlot({ children }: { children: ReactNode }) {
  return <View style={{ marginHorizontal: BAR_EDGE }}>{children}</View>;
}

/**
 * Where UIKit starts its bar's content, measured from the top of the screen.
 *
 * Not the safe-area inset: on a phone with a Dynamic Island the inset runs ten
 * points below where a navigation bar begins laying out, and the elements
 * package's own guess at that (`inset - 5.33`, in `getDefaultHeaderHeight`) is
 * about five points short of it. Ten is what the screen says — with it, a
 * React-drawn bar and a navigation bar agree to the point on all four numbers
 * in the table above.
 *
 * The gate is the same one the elements package uses for its own adjustment: on
 * a phone without an island the inset *is* the status bar, and there is nothing
 * to take off it.
 */
const BAR_LIFT = 10;

/**
 * What to pass as `headerStatusBarHeight`, and the half of the fix that is easy
 * to miss.
 *
 * The elements header reserves the whole safe-area inset and centres the bar's
 * contents in whatever is left, so adding height alone pushes the buttons
 * *down* rather than giving them air underneath. Handing it the real origin
 * moves the whole content box up to where UIKit puts its own.
 */
export function barStatusBarHeight(topInset: number) {
  return topInset > 50 ? topInset - BAR_LIFT : topInset;
}

/**
 * How tall that bar is: UIKit's content height below that origin, rather than
 * the elements package's own `44 + inset`.
 *
 * Passed as an explicit `headerStyle.height` because that is the only way to
 * move it.
 */
export function barHeight(topInset: number) {
  return barStatusBarHeight(topInset) + BAR_CONTENT;
}

/**
 * What colour the glyph inside a capsule *we* draw is: white, always.
 *
 * ## This and `headerTint` used to be one function, and that was the bug
 *
 * One function fed two things that only look like the same thing:
 * `headerTintColor`, which is UIKit's, and the colour of the menu and the bell,
 * which is ours. It returned `GLASS ? deep : inkInverse` for both — and that
 * expression is *correct for UIKit* and wrong for us, for a reason nothing in
 * the code said out loud. See `headerTint`.
 *
 * Ours is white because the capsule under it is a dark wash of the church's
 * dark red — see `HeaderCapsule` — and white is also what UIKit's own chevron
 * and the header's title already are on that bar. A function rather than a
 * constant because the colour is still the theme's to choose, and a function of
 * the theme alone because no screen gets a say: a bar that is dark red
 * everywhere cannot have a control that is legible on it here and not there.
 */
export function headerGlyphColor(theme: ResolvedTheme) {
  return theme.color.inkInverse;
}

/**
 * What goes in `headerTintColor` — which on iOS 26 is not a glyph colour.
 *
 * ## The thing that has to be written down
 *
 * A bar button item in an iOS 26 `UINavigationBar` is *tinted prominent glass*:
 * the tint colour fills the **capsule**, and UIKit picks the glyph's colour
 * itself, for contrast against whatever the capsule came out as. Measured on the
 * forms stack, sampling the back button at 3×:
 *
 * | `headerTintColor` | UIKit's capsule | UIKit's chevron |
 * | ----------------- | --------------- | --------------- |
 * | `deep`            | 56, 19, 19      | pale            |
 * | `inkInverse`      | 182, 160, 160   | dark            |
 *
 * So handing it white — the colour we want our *glyphs* to be — produces a pale
 * lozenge in the left corner beside our two dark circles, which is the same
 * mismatch as the one being fixed with the two halves swapped. It is handed
 * `deep`, and on the bookstore stack UIKit's capsule then comes out (56, 19, 19)
 * against our (56, 18, 17): the same finish, arrived at by the platform.
 *
 * ## But it is only the same finish on *some* screens, and that is not fixable
 * ## from here
 *
 * Measured on the galleries stack, same tint, same bar, same build:
 *
 * | stack     | UIKit's back capsule |
 * | --------- | -------------------- |
 * | bookstore | 56, 19, 19           |
 * | galleries | 255, 215, 215        |
 *
 * Near-white, next to our two dark circles. This is not a second bug, it is the
 * *first* one — the instability `HeaderCapsule`'s note documents, seen from the
 * other side: the back button is real glass, real glass samples what is behind
 * it, and what is behind it differs by screen. Painting our own capsules is what
 * took our two controls out of that lottery; the back button cannot be taken out
 * of it by choosing a tint, because the tint is not what is varying.
 *
 * Taking it out would mean owning the back button — `hidesSharedBackground` on a
 * custom `unstable_headerLeftItems` entry, the way `headerChromeStack` already
 * does for the bell — and that costs the long-press "back to root" menu UIKit
 * gives a real back button for free. Worth doing; not worth doing quietly as
 * part of a colour fix, which is why it is written down here instead.
 *
 * Below iOS 26 there is no capsule and no glass, and `headerTintColor` means
 * what it has always meant — the glyph itself. `deep` on a `deep` bar would be
 * invisible, so that case gets white. This is the one place in the app where
 * `GLASS` changes a colour rather than whether a shape is drawn.
 */
export function headerTint(theme: ResolvedTheme) {
  return GLASS ? theme.color.deep : theme.color.inkInverse;
}

/**
 * One control's background: the capsule.
 *
 * ## Why this is a painted pill and not a `GlassView`
 *
 * It was a `GlassView` — the same `UIVisualEffectView` UIKit puts behind its
 * own bar buttons — and that is exactly what it could not stay, because the
 * material is not the same object in the two places this renders.
 *
 * Measured, sampling the middle of the capsule on four screens:
 *
 * | capsule                         | rgb           |
 * | ------------------------------- | ------------- |
 * | inside a navigation bar         | 246, 216, 208 |
 * | inside a React header (Giving)  | 255, 244, 239 |
 * | inside a React header (Apps)    | 255, 241, 235 |
 *
 * Glass samples what is behind it, and behind it is a different thing on every
 * screen — photographs under one bar, pale paper under another, and inside a
 * bar button item something different again. Tinting it did not fix that;
 * neither did an opaque backing, which the material then lightened by a
 * different amount in each place. Three shades of nearly-white is not a
 * material, it is a bug that happens to be pretty.
 *
 * Painting it is still the answer. **What was painted was wrong**, and the
 * table above says why without noticing it: those three samples were all taken
 * on bars with pale content behind them. The bar this app actually ships is
 * `deep`, the church's dark red, on every screen — and on a dark bar iOS 26's
 * own glass goes *dark*, not pale.
 *
 * Measured again, on the forms stack at 3×, sampling across the bar:
 *
 * | thing                                    | rgb          |
 * | ---------------------------------------- | ------------ |
 * | the bar itself (`deep`)                  | 72, 16, 16   |
 * | UIKit's back-button capsule, real glass  | 56, 19, 19   |
 * | our painted capsule (`accentSoft`)       | 246, 216, 208 |
 *
 * So the two controls on the same bar were photographic negatives of each
 * other: a dark lozenge with a white chevron in the left corner, a pale pink
 * circle with a dark red bell in the right. Nothing in the old note is false —
 * `accentSoft` *is* what glass renders as over pale paper — it was matching the
 * wrong bar.
 *
 * The capsule is now a dark wash over the red, which is what UIKit does two
 * corners away, and the glyphs on it are white, which is what UIKit's chevron
 * and the header's own title already were. `headerGlyphColor` collapsed to one
 * answer as a result.
 *
 * `isLiquidGlassAvailable()` still decides whether a capsule is drawn at all.
 * That is the honest use of it: the question is not "can we blur" but "is this
 * an OS whose own bars put their buttons in capsules", and on one that does
 * not, a pill would be an affectation rather than a convention.
 *
 * ## `pressed`
 *
 * The glyph dims; the capsule does not. Note the `GlassView` prop that is
 * deliberately not here even in the history: `isInteractive` makes the glass
 * handle the touch itself, and with it set every header control in the app
 * stopped responding — the menu opened nothing, the bell opened nothing, on all
 * four navigators at once.
 */
export function HeaderCapsule({
  children,
  pressed = false,
}: {
  children: ReactNode;
  pressed?: boolean;
}) {
  const theme = useTheme();

  const box = {
    width: CAPSULE,
    height: CAPSULE,
    alignItems: 'center',
    justifyContent: 'center',
  } as const;

  const glyph = <View style={{ opacity: pressed ? 0.5 : 1, ...box }}>{children}</View>;

  if (!GLASS) {
    return <View style={box}>{glyph}</View>;
  }

  return (
    <View
      style={{
        ...box,
        // Clamped here rather than stored as 9999, exactly as the camera button
        // in the tab bar does it: `radius.full` is documented as "pills and
        // avatars, clamped by the consumer".
        borderRadius: Math.min(theme.radius.full, CAPSULE / 2),
      }}
    >
      {/*
        The wash, as its own view under the glyph rather than a background
        colour on the box.

        Because the amount of it is the whole point and `opacity` is the only
        way to say "some of this colour" without writing a literal: the theme
        stores hex, `ink` has no alpha, and `#1c161447` would be exactly the
        hardcoded colour `tokens.ts` forbids. On the box itself the opacity
        would fade the glyph with it — a white bell at 28% on dark red is not a
        bell — so the wash and the glyph are siblings and only one of them is
        translucent.

        `ink` and not black: the church's ink is warm (`#1c1614`-ish), and a
        neutral black over `deep` greys the red in a way the measurement above
        says UIKit does not — its capsule keeps the hue and loses about a fifth
        of the red channel, which is what a warm ink at this weight does.
      */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          borderRadius: Math.min(theme.radius.full, CAPSULE / 2),
          backgroundColor: theme.color.ink,
          opacity: CAPSULE_WASH,
        }}
      />
      {glyph}
    </View>
  );
}
