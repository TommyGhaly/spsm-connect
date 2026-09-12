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
 * parish's own ground and says so, rather than a broken image. `posterUrl`
 * returning null is exactly that state; see `hasRenderableFile` in
 * `@spsm/shared`, which is the same fact the summaries read.
 */
import { Image } from 'expo-image';
import { View } from 'react-native';

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
        // The caption is the parish's own words for the photograph. When there
        // are none, an empty label is better than the file name: it tells a
        // screen reader there is a picture here and nothing more is known.
        accessibilityLabel={media.caption || 'Parish photograph'}
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
