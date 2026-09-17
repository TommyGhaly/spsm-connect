/**
 * The splash screen, continued in JavaScript, so that it can have a wheel.
 *
 * `expo-splash-screen` draws one still image and nothing else: on iOS it is a
 * storyboard and on Android a themed window background, both painted by the OS
 * before this app's JavaScript exists. Nothing in either can spin. So the
 * launch screen is drawn twice — the OS paints the still one, and this takes
 * over the moment React can draw, showing the same lockup at the same size on
 * the same ground with a wheel underneath it.
 *
 * ## The handoff is meant to be invisible
 *
 * Which is why nothing here is chosen. Every value is a copy of what
 * app.config.ts hands the plugin, and three of them have to agree with it:
 *
 *   assets/splash-banner.png   the image, written by scripts/make-icons.mjs
 *   240                        `imageWidth` there, SPLASH_WIDTH_POINTS there
 *   `deep`                     `backgroundColor` there
 *
 * Nothing enforces that, so each of those places names the others in a comment.
 *
 * The native splash is dismissed from `onDisplay` — once this image has
 * actually rendered, rather than when this component mounts. Hiding it on mount
 * uncovers a bare red screen for however long the decode takes, which is the
 * flash the still image exists to prevent.
 *
 * `onDisplay` is also the moment the wheel becomes visible to a human, rather
 * than merely mounted behind a still image of itself, which is why it is
 * reported outwards: ThemeProvider times the dwell from it. See SPLASH_DWELL_MS
 * there.
 */
import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DEFAULT_THEME } from './tokens';

/**
 * `imageWidth` in app.config.ts, in points.
 *
 * A square rather than a width, in both places: the plugin pads the lockup out
 * to `imageWidth` x `imageWidth` and the storyboard aspect-fits that, so this
 * view has to hand the same box to `contentFit: 'contain'` to land on the same
 * pixels. The lockup is taller than it is wide, so what this actually sets is
 * the height — see SPLASH_WIDTH_POINTS in scripts/make-icons.mjs.
 */
const SPLASH_BOX = 240;

export function BootSplash({ onShown }: { onShown?: () => void }) {
  const insets = useSafeAreaInsets();

  /*
   * DEFAULT_THEME rather than the live theme, and this is the one component in
   * the app where that is right. This screen is up *because* the cached tokens
   * have not been read yet, and what it has to match is not the app but the
   * native splash behind it — whose colour is baked into the binary from
   * app.config.ts. If the church changes `deep` in Firestore, the baked image
   * and the baked background both stay as they are until the next release, and
   * so should this.
   */
  const { color, space } = DEFAULT_THEME;

  /*
   * Absolutely filling its parent rather than `flex: 1`, because for most of
   * its life it is a lid: ThemeProvider mounts the app underneath this the
   * moment the theme is in hand, so that the session, App Check and the first
   * screen are all doing their work while the wheel turns. Take the lid off at
   * `flex: 1` and the app would be laid out beside it instead.
   */
  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        { alignItems: 'center', justifyContent: 'center', backgroundColor: color.deep },
      ]}
    >
      <Image
        source={require('../../assets/splash-banner.png')}
        style={{ width: SPLASH_BOX, height: SPLASH_BOX }}
        contentFit="contain"
        onDisplay={() => {
          /*
           * Deliberately unconditional and deliberately swallowed. It is
           * already hidden if something else got there first, and a splash
           * screen that refuses to go away is worse than one that goes early.
           */
          void SplashScreen.hideAsync().catch(() => {});
          onShown?.();
        }}
        /*
         * The app's name is *inside* this artwork, so a screen reader has
         * nothing to say about the image that it will not say about the app a
         * moment later. The wheel below carries the only thing worth
         * announcing here, which is that something is happening.
         */
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      {/*
       * Positioned absolutely so that the lockup stays exactly where the
       * storyboard puts it — centred on the screen, wheel or no wheel. Laying
       * the two out in the same column would push the artwork up by half the
       * wheel and make the handoff a visible jump.
       */}
      <ActivityIndicator
        size="small"
        color={color.inkInverse}
        style={{ position: 'absolute', bottom: insets.bottom + space.xl }}
        accessibilityLabel="Loading"
      />
    </View>
  );
}
