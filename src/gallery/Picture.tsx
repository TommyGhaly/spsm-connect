/**
 * One photograph, drawn.
 *
 * `expo-image` rather than RN's `<Image>`, for the two reasons that matter on
 * this screen: it has a real disk cache, so scrolling back up a gallery does not
 * refetch forty files over a church's wifi, and it has `contentPosition`, which
 * is how the administrator's focal point survives the crop.
 *
 * ## "Processing…" is a state, not an error
 *
 * A photograph is approved the moment somebody says so, and the transcode
 * Function writes `renditionPath` some seconds later. In between, the document
 * is approved, publicly readable, and has no file to draw — so this renders the
 * church's own ground and says so, rather than a broken image. `posterUrl`
 * returning null is exactly that state; see `hasRenderableFile` in
 * `@spsm/shared`, which is the same fact the summaries read.
 */
import { Image } from 'expo-image';
import { View } from 'react-native';

import { siteUrl } from '@/about/media';
import { Small } from '@/components/Type';
import { focalContentPosition, posterUrl } from '@/gallery/media';
import type { MediaRow } from '@/gallery/data';
import { useTheme } from '@/theme/ThemeProvider';

export function Picture({
  media,
  /** The cell's height. Width always fills whatever the parent gives it. */
  height,
  rounded = true,
}: {
  media: MediaRow;
  height: number;
  rounded?: boolean;
}) {
  const theme = useTheme();
  const url = posterUrl(media);
  const radius = rounded ? theme.radius.sm : 0;

  if (url === null) {
    return (
      <View
        style={{
          height,
          borderRadius: radius,
          backgroundColor: theme.color.paperRaised,
          borderColor: theme.color.rule,
          borderWidth: 1,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Small color={theme.color.inkFaint}>Processing…</Small>
      </View>
    );
  }

  return (
    <View style={{ height, borderRadius: radius, overflow: 'hidden' }}>
      <Image
        source={{ uri: url }}
        style={{ width: '100%', height: '100%' }}
        contentFit="cover"
        contentPosition={focalContentPosition(media.focal)}
        /*
         * `memory-disk`, not the default `disk`: a gallery is scrolled up and
         * down, and the memory tier is what makes the second pass instant.
         * A short fade covers the decode so a cell does not snap into place.
         */
        cachePolicy="memory-disk"
        transition={180}
        // The caption is the church's own words for the photograph. When there
        // are none, an empty label is better than the file name: it tells a
        // screen reader there is a picture here and nothing more is known.
        accessibilityLabel={media.caption || 'Church photograph'}
        // A poster frame with no way to play the clip would be a lie by
        // omission, so a video says it is one.
        placeholderContentFit="cover"
      />
      {media.kind === 'video' ? <VideoMark /> : null}
    </View>
  );
}

/**
 * The corner mark that says "this is a clip".
 *
 * A word rather than the `play` glyph, and deliberately: this build has no
 * player, so a play triangle would be a button that does nothing. When the
 * lightbox lands it becomes the triangle and this comment goes.
 */
function VideoMark() {
  const theme = useTheme();

  return (
    <View
      style={{
        position: 'absolute',
        left: theme.space.xs,
        bottom: theme.space.xs,
        paddingHorizontal: theme.space.xs,
        paddingVertical: 2,
        borderRadius: theme.radius.sm,
        backgroundColor: theme.color.deep,
      }}
    >
      <Small color={theme.color.inkInverse}>Clip</Small>
    </View>
  );
}

/**
 * The plate for a ministry or a level with no photographs of its own yet.
 *
 * **The website's own placeholder, ported.** `.program-card__cover--empty` is
 * the church seal on `--color-deep`, centred, at 4.5rem and nine-tenths
 * opacity, and this is that rule in React Native style values. The two sections
 * show the same thing for the same ministry, which is the property the whole of
 * `gallery/data.ts` exists to keep.
 *
 * It replaced a bordered empty rectangle here. On a page of wide tiles that read
 * as a section still loading rather than as a gathering nobody has photographed
 * yet — which is the same complaint the website answered with the seal.
 *
 * Not a stock photograph, and the reason is worth keeping: a picture of
 * somebody else's gathering under "Mother of Mercy" is a claim about the
 * ministry, and a false one. The seal is the church saying "ours, and nothing
 * here yet", which is what is true.
 *
 * The file is fetched from the site like every other picture in this app rather
 * than bundled — see the block at the top of `about/media.ts`. `seal-192.png` is
 * the largest of the three the site emits and the plate draws it at 72pt or
 * less, so it is never upscaled.
 */
const SEAL = siteUrl('/brand/seal-192.png');

export function NoPictures({
  /** The cell's height, matching whatever `Picture` would have been given. */
  height,
  rounded = true,
}: {
  height: number;
  rounded?: boolean;
}) {
  const theme = useTheme();

  /*
   * The website's 4.5rem against a 4:3 tile — about two fifths of the plate —
   * rather than a constant, because these plates are 200pt on the directory and
   * 160pt on a level's card. Capped so a tall plate does not turn the seal into
   * the subject.
   */
  const seal = Math.round(Math.min(height * 0.4, 72));

  return (
    <View
      style={{
        height,
        borderRadius: rounded ? theme.radius.sm : 0,
        overflow: 'hidden',
        backgroundColor: theme.color.deep,
        alignItems: 'center',
        justifyContent: 'center',
        // The website's `opacity: 0.9`, and on the whole plate as it is there:
        // it takes the edge off the deep ground as well as off the seal, which
        // is what keeps a row of empty tiles from reading as a row of holes.
        opacity: 0.9,
      }}
    >
      <Image
        source={{ uri: SEAL }}
        style={{ width: seal, height: seal }}
        contentFit="contain"
        // One file on every empty plate in the section, so the memory tier earns
        // its keep the moment a second one is drawn in the same list.
        cachePolicy="memory-disk"
        transition={180}
        // Decoration. The line under the plate — "No photographs yet", "Nothing
        // yet" — is what says what is here, and a screen reader announcing the
        // seal as well would only get in the way of it.
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
    </View>
  );
}
