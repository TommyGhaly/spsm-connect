/**
 * The two store badges, for any app the church links to.
 *
 * ---------------------------------------------------------------------------
 * The website's `components/StoreBadges.tsx`, in React Native. Same two files,
 * same two heights, same rules — because a reader who taps through from the
 * site to the app should be looking at the same black pill in both places.
 *
 * **The badges are not ours to touch.** Apple's may not be recoloured,
 * recomposed, redrawn or reworded, and Google's may not be modified and needs
 * clear space around it. Which is why the press state below is a transform and
 * nothing else: a tint, a shadow, an opacity fade or a rounded corner of ours
 * would each be a modification, and a scale is the artwork at a different size,
 * which is the one change both vendors do allow.
 *
 * ## Bundled, where the rest of the website's pictures are fetched
 *
 * `about/media.ts` explains at length why sixty illustrations are pulled off
 * the website rather than shipped in the binary, and every word of it is still
 * true — of illustrations. These two are not illustrations. They are the only
 * affordance on the card: an App Store badge that has not loaded is not a
 * picture missing from a page, it is a link that cannot be tapped, on the one
 * screen whose entire purpose is four links. So they are in `assets/brand/`,
 * cost about twenty kilobytes together, and work on a phone with no signal
 * standing in the church basement — which is exactly where somebody is when
 * another person tells them to install Taksis.
 *
 * `assets/brand/google-play-badge.png` is Google's shipped file, copied byte
 * for byte from the website's `public/brand/`. Apple publishes an SVG, and
 * `expo-image`'s iOS decoder is documented as not handling every valid path —
 * this badge is full of arc commands — so it is rasterised from that same
 * official file at 4x (479x160) with `rsvg-convert` and nothing else is done to
 * it. If either vendor reissues their artwork, replace the file; do not edit
 * one.
 *
 * ## The two heights are not equal, on purpose
 *
 * Apple's artwork fills its box, so its box is the pill. Google's file is the
 * badge sitting inside its own mandated clear space — measured on the shipped
 * PNG, a 564x168 pill in a 646x250 file, inset 41 on every edge. Give the two
 * images the same height and the Play pill draws a fifth shorter than the App
 * Store one, which reads as two different sizes. So the Play box is scaled up
 * until its pill lands on `PILL_HEIGHT`, and the clear space that scaling
 * multiplied is taken back out of the layout with a negative margin: the image
 * still paints its full self — nothing is cropped, Google's padding is not
 * touched — but the space it *claims* is the pill, so the row can centre the
 * two against each other and the gap measures pill to pill.
 *
 * Do not "fix" this by setting both heights to the same number, and do not crop
 * the padding out of the PNG. The numbers below are measured, not assumed; the
 * website's `.store-badge--play` derives the same three from the same ratios.
 * ---------------------------------------------------------------------------
 */
import { Image } from 'expo-image';
import { Linking, Pressable, View } from 'react-native';
import type { ImageSourcePropType } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

/**
 * The height both black pills are drawn at, and the only number to change if
 * they ever want to be bigger.
 *
 * 44, which is the website's 2.75rem and also Apple's minimum touch target —
 * the pill *is* the target here, so the two constraints happen to be the same
 * one. Below this the Play badge's "GET IT ON" line starts to go to mush on a
 * 2x screen.
 */
const PILL_HEIGHT = 44;

/** Apple's viewBox, 119.664x40, preserved by the raster. The box is the pill. */
const APPLE_WIDTH = (PILL_HEIGHT * 119.66407) / 40;

/** Google's shipped PNG, and the black pill inside it. Measured on the file. */
const PLAY_FILE = { width: 646, height: 250, inset: 41 } as const;
const PLAY_PILL_HEIGHT = 168;

const PLAY_BOX_HEIGHT = (PILL_HEIGHT * PLAY_FILE.height) / PLAY_PILL_HEIGHT;
const PLAY_BOX_WIDTH = (PLAY_BOX_HEIGHT * PLAY_FILE.width) / PLAY_FILE.height;
/** The clear space at this size, which is what the negative margin gives back. */
const PLAY_INSET = (PLAY_BOX_HEIGHT * PLAY_FILE.inset) / PLAY_FILE.height;

const APPLE_BADGE = require('../../assets/brand/app-store-badge.png') as ImageSourcePropType;
const PLAY_BADGE = require('../../assets/brand/google-play-badge.png') as ImageSourcePropType;

/**
 * Either URL may be omitted. An app on one store shows one badge, and an app on
 * neither renders nothing at all — both vendors' terms cover a badge linking to
 * something that cannot be installed.
 */
export function StoreBadges({
  ios,
  android,
  /**
   * Names the app in each badge's accessible name.
   *
   * Two apps on one screen would otherwise give VoiceOver two links both
   * announcing "Download on the App Store", with nothing to say which is which.
   * The badge cannot carry the name — that would be rewording Apple's artwork —
   * so it goes in the label beside it, exactly as the website appends it in a
   * visually hidden span.
   */
  appName,
}: {
  ios?: string | undefined;
  android?: string | undefined;
  appName: string;
}) {
  const theme = useTheme();

  if (!ios && !android) return null;

  return (
    <View
      style={{
        flexDirection: 'row',
        // Wraps rather than squeezing. Both pills at this height need about
        // 280pt, which every phone the app supports has inside a card — but a
        // reader at the largest accessibility text sizes is not the case this
        // was measured against, and one badge above the other is a better
        // failure than one badge half off the card.
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: theme.space.md,
      }}
    >
      {ios ? (
        <Badge
          source={APPLE_BADGE}
          url={ios}
          label={`Download on the App Store — ${appName}`}
          width={APPLE_WIDTH}
          height={PILL_HEIGHT}
        />
      ) : null}
      {android ? (
        <Badge
          source={PLAY_BADGE}
          url={android}
          label={`Get it on Google Play — ${appName}`}
          width={PLAY_BOX_WIDTH}
          height={PLAY_BOX_HEIGHT}
          // See the header: the box is the pill plus Google's clear space, and
          // the layout is told about the pill.
          clearSpace={PLAY_INSET}
        />
      ) : null}
    </View>
  );
}

/**
 * One badge, as a link.
 *
 * `Linking` rather than the in-app browser, for the reason the giving card
 * gives: a store address is claimed by the store's own app, and opening it any
 * other way puts a reader on a web page about an app instead of on the page
 * that installs it.
 */
function Badge({
  source,
  url,
  label,
  width,
  height,
  clearSpace = 0,
}: {
  source: ImageSourcePropType;
  url: string;
  label: string;
  width: number;
  height: number;
  /**
   * Transparent artwork around the pill, which the badge paints and the row
   * does not count.
   *
   * A negative margin rather than a smaller image: Yoga sizes the view at
   * `width`/`height` and takes the margin off the space it *claims*, so the
   * full file is still painted and only the layout is told about the pill. It
   * overlaps into the card's own padding, which is wider than this, so nothing
   * is ever clipped at an edge.
   */
  clearSpace?: number;
}) {
  return (
    <Pressable
      onPress={() => void Linking.openURL(url)}
      accessibilityRole="link"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        width,
        height,
        margin: -clearSpace,
        // A press is the badge, slightly smaller. Nothing is tinted, dimmed or
        // outlined — see the header.
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}
    >
      <Image
        source={source}
        contentFit="contain"
        // The Pressable is the link and carries the name; an image announcing
        // itself inside it would have VoiceOver read the badge twice.
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ width: '100%', height: '100%' }}
      />
    </Pressable>
  );
}
