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
 * **And the material would not hold still** — which is why, for a while, it
 * was not a material at all but a painted pill. It is real glass again, held
 * still by being told which appearance to wear. See `HeaderCapsule`.
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
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
/*
 * The package's own bar height, imported rather than reimplemented.
 *
 * A deep path into a dependency's build output, which is not free — but the
 * alternative is copying its table (iPad 50, landscape phone 32, portrait
 * phone 44) into this file, and a copy of that table is a copy that will
 * disagree with the package on the first device Apple adds. It is a pure
 * function of three arguments, it is re-exported from that folder's own
 * `index`, and it ships its types.
 *
 * Cheap to unwind: drop back to `undefined` for the height below iOS 26 and
 * the bars are right again to within the 2.7 points `barStatusBarHeight`
 * documents.
 */
import { getDefaultHeaderHeight } from 'expo-router/build/react-navigation/elements';
import { PixelRatio, View, type ScaledSize } from 'react-native';

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
 *
 * ## They are iOS 26's numbers, and that has to be said out loud
 *
 * Every figure in the table was read off an iPhone 17 Pro running iOS 26,
 * where a navigation bar is 116 points tall. On iOS 18 the same bar is the
 * classic one — 44 points under the status bar, which is the 97.67 that
 * `getDefaultHeaderHeight` already computes — so copying these numbers there
 * makes the tabs and the drawer **fifteen points taller than every stack in
 * the app**, which is the one place they are meant to agree.
 *
 * Measured on an iPhone 16 on iOS 18.5, sampling down the left edge for the
 * row where the red stops:
 *
 * | bar                      | before | after |
 * | ------------------------ | ------ | ----- |
 * | Calendar (tabs, React)   |  113.0 |  97.7 |
 * | Bookstore (stack, UIKit) |   97.7 |  97.7 |
 *
 * 97.7 is `44 + (59 - 5.33)`, which is the classic bar to the pixel.
 *
 * So below iOS 26 `barHeight` answers `undefined` and the elements package
 * uses its own default, which is the classic bar it was written against. The
 * override exists to copy iOS 26; on an OS that does not draw iOS 26's bars
 * there is nothing to copy. `BAR_EDGE` and `barStatusBarHeight` still answer,
 * because the package gets both of those slightly wrong on any OS — see their
 * own notes.
 */

/**
 * How far a control sits from the edge of the bar, which is not one number.
 *
 * UIKit moved it: a classic bar puts its button 16 points in, an iOS 26 bar
 * puts its capsule 20. Measured on an iPhone 16 on iOS 18.5, to the left edge
 * of the menu glyph's ink — which is 2.85 points inside its own 20pt box,
 * inside the 40pt control:
 *
 * | bar                      | before | after | UIKit |
 * | ------------------------ | ------ | ----- | ----- |
 * | Calendar (tabs, React)   |   32.7 |  28.7 |     — |
 * | Bookstore (stack, UIKit) |      — |     — |  28.7 |
 *
 * Four points is small and it is the kind of small that reads as sloppiness
 * rather than as a difference: the menu is in the same corner on both bars and
 * does not line up when you tab between them.
 */
export const BAR_EDGE = GLASS ? 20 : 16;
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
 * Where a bar starts laying out its content, below the top of the screen —
 * which on a phone with a Dynamic Island is not the safe-area inset.
 *
 * Two answers, because the two kinds of bar start in two different places.
 *
 * **iOS 26** begins ten points above the inset. Measured; with it, a
 * React-drawn bar and a navigation bar agree to the point on all four numbers
 * in the table above.
 *
 * **Classic**, `5 + 1/scale`, which is the true status bar height and is not
 * this file's invention — it is `getDefaultHeaderHeight`'s own expression,
 * copied rather than approximated so the two cannot drift apart.
 *
 * The gate on both is the package's own: on a phone without an island the
 * inset *is* the status bar and there is nothing to take off it.
 */
const BAR_LIFT = 10;
const CLASSIC_LIFT = 5 + 1 / PixelRatio.get();

/**
 * What to pass as `headerStatusBarHeight`, and the half of the fix that is
 * easy to miss.
 *
 * ## On iOS 26 it is what makes the extra height land in the right place
 *
 * The elements header reserves the whole safe-area inset and centres the bar's
 * contents in whatever is left, so adding height alone pushes the buttons
 * *down* rather than giving them air underneath. Handing it the real origin
 * moves the whole content box up to where UIKit puts its own.
 *
 * ## Below iOS 26 it corrects a disagreement inside the package itself
 *
 * `getDefaultHeaderHeight` takes `5 + 1/scale` off the inset to work out the
 * *height*; the Header component then defaults `headerStatusBarHeight` to the
 * whole inset. So the bar is 44 points tall by one measure and reserves 5.33
 * points too many by the other, and its contents ride half that — 2.7 points —
 * lower than UIKit's. Measured on an iPhone 16 on iOS 18.5, the vertical
 * centre of the menu glyph:
 *
 * | bar                      | before | after | UIKit |
 * | ------------------------ | ------ | ----- | ----- |
 * | Calendar (tabs, React)   |   78.2 |  75.5 |     — |
 * | Bookstore (stack, UIKit) |      — |     — |  75.5 |
 *
 * Which is why this answers on every OS while `barHeight` does not: the height
 * below iOS 26 is already right, and only the origin inside it is out.
 */
export function barStatusBarHeight(topInset: number): number {
  if (topInset <= 50) return topInset;
  return topInset - (GLASS ? BAR_LIFT : CLASSIC_LIFT);
}

/**
 * How tall that bar is: UIKit's content height below that origin, rather than
 * the elements package's own `44 + inset`.
 *
 * Passed as an explicit `headerStyle.height` because that is the only way to
 * move it — and `undefined` below iOS 26, which is how a style property is
 * left unsaid. The two answer together or not at all: the origin without the
 * height, or the height without the origin, is a bar with its contents in the
 * wrong half of it.
 */
export function barHeight(topInset: number, layout: BarLayout): number {
  /*
   * Below iOS 26 the height is already right and only the origin inside it is
   * out — but the two have to be passed together or the bar shrinks by the
   * difference between them. Measured: `headerStatusBarHeight` on its own took
   * the Calendar bar from 97.7 to 92.3, because the package sizes the content
   * box against the inset it was *not* given. So this hands back the package's
   * own answer rather than nothing, and the pair stay consistent.
   */
  return GLASS
    ? barStatusBarHeight(topInset) + BAR_CONTENT
    : getDefaultHeaderHeight(layout, false, topInset);
}

/**
 * What `getDefaultHeaderHeight` needs of the window: its width and height.
 *
 * `useWindowDimensions()` satisfies it. Named here so the two navigators that
 * call `headerChrome` can see what they are being asked for, and so that
 * "the window" is a decision made once — a landscape phone's bar is twelve
 * points shorter than a portrait one's, and this is the only thing that knows.
 */
export type BarLayout = Pick<ScaledSize, 'width' | 'height'>;

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
 * ## It is only the same finish on *some* screens, and that stopped mattering
 *
 * Measured on the galleries stack, same tint, same bar, same build:
 *
 * | stack     | UIKit's back capsule |
 * | --------- | -------------------- |
 * | bookstore | 56, 19, 19           |
 * | galleries | 255, 215, 215        |
 *
 * This is not a second bug, it is the *first* one — real glass samples what is
 * behind it, and what is behind it differs by screen. The back button cannot be
 * taken out of that lottery by choosing a tint, because the tint is not what is
 * varying.
 *
 * What this note used to say next was that our own controls had been taken out
 * of the lottery by being painted, which left them standing against the back
 * button on the screens where it drifted — near-white lozenge, two dark
 * circles. **That is no longer true and the fix was the opposite one:** our
 * capsules are real glass again, so they drift with it rather than against it.
 * Re-measured on the galleries stack, all three controls now read 182, 160,
 * 160. See `HeaderCapsule`.
 *
 * So owning the back button — `hidesSharedBackground` on a custom
 * `unstable_headerLeftItems` entry, the way `headerChromeStack` already does
 * for the bell — is no longer worth what it costs, which is the long-press
 * "back to root" menu UIKit gives a real back button for free. It would buy a
 * fixed colour across screens; it would not buy agreement within a bar, and
 * that is the one the eye actually reads.
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
 * One control's background: the capsule, in the material UIKit uses for one.
 *
 * ## It was a `GlassView`, then a painted pill, and it is a `GlassView` again
 *
 * The middle step was not a mistake, and the thing that made it necessary is
 * still true: **glass samples what is behind it, and behind it is a different
 * thing on every screen.** Measured then, sampling the middle of the capsule:
 *
 * | capsule                         | rgb           |
 * | ------------------------------- | ------------- |
 * | inside a navigation bar         | 246, 216, 208 |
 * | inside a React header (Giving)  | 255, 244, 239 |
 * | inside a React header (Apps)    | 255, 241, 235 |
 *
 * Three shades of nearly-white is not a material, it is a bug that happens to
 * be pretty — so it was painted instead, as a dark wash of `ink` over the bar,
 * fitted to what UIKit's own back button renders as two corners away.
 *
 * ## What the paint could never have
 *
 * A wash is a flat rectangle of colour. Liquid Glass is a lens: it refracts the
 * edge of what is under it, it carries a specular highlight along its rim, and
 * it moves both of those as the device tilts. A pill matched to the *average*
 * colour of real glass is the one thing that is guaranteed to match it in no
 * frame where anything is moving. Beside UIKit's back button — which is real
 * glass, on the same bar, and cannot be painted — that reads as two materials.
 *
 * ## What holds it still: `colorScheme`, and nothing else
 *
 * The three samples above have one thing in common the old note said out loud
 * without using: they are all *pale*. Glass picks a light or a dark appearance,
 * and on these bars it was picking light — the light appearance of a small
 * capsule is near-white whatever is beneath it. `colorScheme` is the lever for
 * exactly that ("override the system appearance when your app has its own theme
 * toggle"), and this app is the case it describes: the bar is `deep` on every
 * screen and never follows the device.
 *
 * It is load-bearing, and the difference is not subtle. Measured on Giving at
 * 3x, sampling the middle of the menu capsule:
 *
 * | `colorScheme` | our capsule   |
 * | ------------- | ------------- |
 * | absent        | 255, 215, 215 |
 * | `'dark'`      |  57,  18,  18 |
 *
 * The first row is the bug, and it is the *same* near-white this file has now
 * recorded three times. The second is within a level or two of the 56, 19, 19
 * that UIKit's own back button renders on the forms stack — the number the
 * painted wash existed to imitate, arrived at here by the material instead of
 * by fitting a colour to it.
 *
 * ## Why there is no `tintColor`
 *
 * Because the obvious value for it erases the capsule. A bar button item is
 * *tinted prominent glass* and the tint is `headerTintColor`, so handing ours
 * the same `headerTint(theme)` looks like the faithful thing to do — and it
 * tints the glass `deep`, over a bar that is already `deep`. Measured, that
 * build's capsule was a bare rim with the bar showing through the middle of it:
 *
 * | tint                  | rim        | fill       |
 * | --------------------- | ---------- | ---------- |
 * | `headerTint(theme)`   | 157, 31, 31 | 72, 16, 16 | <- the bar
 * | none                  | 128, 38, 38 | 57, 18, 18 |
 *
 * Untinted glass on a dark appearance already lands on UIKit's number. The tint
 * is what UIKit needs because UIKit is told nothing else about the bar; we are
 * drawing *on* the bar and can let the material read it.
 *
 * ## What this does not fix, and no longer needs to
 *
 * The capsule is still not one rgb across the app. Measured on the galleries
 * stack, all three controls on the same bar:
 *
 * | control                   | rgb           |
 * | ------------------------- | ------------- |
 * | UIKit's back button       | 182, 160, 160 |
 * | our bell                  | 182, 160, 160 |
 * | our menu                  | 182, 160, 160 |
 *
 * Pale, where Giving is dark — the variance the old note chased, still here.
 * But look at what it costs now: **nothing within a bar.** The three are the
 * same pixel. That is the failure the `headerTint` note below called out as
 * unfixable from here — our dark pill beside UIKit's near-white capsule, "the
 * same mismatch with the two halves swapped" — and it is fixed, because the way
 * to match a material is to be it rather than to guess its average. What varies
 * now varies for every control at once, which is a bar looking like itself.
 *
 * **And the variance itself is gone too, from outside this file.** The pale
 * rows above were a navigation bar wearing the *light* appearance, which
 * expo-router hands it from the app's own light theme; the three controls now
 * read 56, 19, 19 there, the same as everywhere else. `colorScheme` below is
 * what holds a capsule on a header this app draws; `headerSkinStack` in
 * `header.tsx` is what holds one on a bar UIKit draws, and its note has the
 * measurements. Neither is redundant — the two kinds of bar are told by
 * different things.
 *
 * ## `pressed`
 *
 * The glyph dims; the capsule does not. Note the prop that is deliberately not
 * here even in the history: `isInteractive` makes the glass handle the touch
 * itself, and with it set every header control in the app stopped responding —
 * the menu opened nothing, the bell opened nothing, on all four navigators at
 * once.
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
    <GlassView
      // The bar-button material, not `clear`. `clear` is the one for a control
      // floating over a photograph — it has no fill of its own, and in a bar it
      // would leave the glyph sitting on bare red with a rim around it.
      glassEffectStyle="regular"
      colorScheme="dark"
      style={{
        ...box,
        // Clamped here rather than stored as 9999, exactly as the camera button
        // in the tab bar does it: `radius.full` is documented as "pills and
        // avatars, clamped by the consumer". The glass takes its shape from
        // this, so a square corner here is a square capsule on screen.
        borderRadius: Math.min(theme.radius.full, CAPSULE / 2),
      }}
    >
      {glyph}
    </GlassView>
  );
}
