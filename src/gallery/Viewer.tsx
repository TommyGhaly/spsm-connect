/**
 * The gallery's lightbox: one photograph at a time, full screen, swiped
 * sideways through the whole level.
 *
 * The website opens a `<dialog>` from every tile; this is the same errand on a
 * phone, and it is what lets the mosaic draw small cells at all — see the
 * header of `Mosaic`.
 *
 * - A horizontal pager rather than a single picture with arrows, because a
 *   swipe is what a thumb already does in every photo app on the phone.
 * - Each page is its own zooming `ScrollView`. iOS pinches natively there;
 *   Android shows the photograph whole and does not zoom, which is a smaller
 *   loss than a gesture library's worth of code for one screen.
 * - A clip plays on its own page with the platform's controls, and only while
 *   it is the page being looked at — sixty players for one swipe would be sixty
 *   network streams.
 */
import { Image } from 'expo-image';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useEffect, useRef } from 'react';
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { Body, Small } from '@/components/Type';
import { useTheme } from '@/theme/ThemeProvider';

import type { MediaRow } from './data';
import { focalContentPosition, posterUrl, videoUrl } from './media';

export function Viewer({
  items,
  /** The page showing, or null when the viewer is closed. */
  index,
  onIndex,
  onClose,
}: {
  items: readonly MediaRow[];
  index: number | null;
  onIndex: (index: number) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const list = useRef<FlatList<MediaRow>>(null);

  const current = index === null ? null : items[index];

  /*
   * A turned phone changes the page width under a pager that is mid-swipe, and
   * the offset it remembers is then a fraction of a page out. Snap back to the
   * photograph that was showing.
   */
  useEffect(() => {
    if (index === null) return;
    list.current?.scrollToOffset({ offset: index * width, animated: false });
    // Only on a width change; following `index` here would fight the swipe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width]);

  const settle = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const at = Math.round(event.nativeEvent.contentOffset.x / width);
    if (at !== index && at >= 0 && at < items.length) onIndex(at);
  };

  return (
    <Modal
      visible={index !== null}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      supportedOrientations={['portrait', 'landscape']}
    >
      <StatusBar barStyle="light-content" />
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {index !== null ? (
          <FlatList
            ref={list}
            data={items}
            keyExtractor={(item) => item.id}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={index}
            getItemLayout={(_, at) => ({ length: width, offset: width * at, index: at })}
            onMomentumScrollEnd={settle}
            windowSize={3}
            initialNumToRender={1}
            maxToRenderPerBatch={2}
            renderItem={({ item, index: at }) => (
              <Page media={item} width={width} height={height} active={at === index} />
            )}
          />
        ) : null}

        {/* The chrome, over the photograph rather than beside it, on a scrim so
            it reads on a white sky as well as a dark hall. */}
        <View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            paddingTop: insets.top + theme.space.xs,
            paddingHorizontal: theme.space.gutter,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Small color="rgba(255,255,255,0.85)">
            {index === null ? '' : `${index + 1} of ${items.length}`}
          </Small>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={theme.space.sm}
            style={({ pressed }) => ({
              width: 40,
              height: 40,
              borderRadius: theme.radius.full,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: pressed ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.16)',
            })}
          >
            <Icon name="close" size={20} color="#fff" />
          </Pressable>
        </View>

        {current?.caption ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              paddingTop: theme.space.lg,
              paddingBottom: insets.bottom + theme.space.md,
              paddingHorizontal: theme.space.gutter,
              backgroundColor: 'rgba(0,0,0,0.55)',
            }}
          >
            <Body color="#fff">{current.caption}</Body>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

function Page({
  media,
  width,
  height,
  active,
}: {
  media: MediaRow;
  width: number;
  height: number;
  active: boolean;
}) {
  const clip = media.kind === 'video' ? videoUrl(media) : null;

  if (clip && active) {
    return (
      <View style={{ width, height }}>
        <Clip uri={clip} />
      </View>
    );
  }

  const url = posterUrl(media);
  const picture = url ? (
    <Image
      source={{ uri: url }}
      style={{ width, height }}
      contentFit="contain"
      contentPosition={focalContentPosition(media.focal)}
      cachePolicy="memory-disk"
      transition={120}
      accessibilityLabel={media.caption || 'Church photograph'}
    />
  ) : (
    <View style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
      <Small color="rgba(255,255,255,0.7)">Processing…</Small>
    </View>
  );

  if (Platform.OS !== 'ios') return <View style={{ width, height }}>{picture}</View>;

  /*
   * `maximumZoomScale` is the whole of pinch-to-zoom on iOS. The key on the
   * photograph's id resets the zoom when the page is recycled for another one.
   */
  return (
    <ScrollView
      key={media.id}
      style={{ width, height }}
      maximumZoomScale={3}
      minimumZoomScale={1}
      centerContent
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      bouncesZoom
    >
      {picture}
    </ScrollView>
  );
}

/** Its own component because `useVideoPlayer` is a hook; see `VideoPreview`. */
function Clip({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.play();
  });

  return (
    <VideoView
      player={player}
      style={{ flex: 1 }}
      contentFit="contain"
      nativeControls
      allowsPictureInPicture={false}
    />
  );
}
