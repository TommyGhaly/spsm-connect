/**
 * The flythrough, in the App Clip: a still, and Safari for the film itself.
 *
 * ---------------------------------------------------------------------------
 * Metro resolves `./Film` to this file when BUILDING_FOR_APP_CLIP is set — the
 * `.clip` source extension in `metro.config.js`, the same mechanism that swaps
 * `index.ts` for `index.clip.ts`.
 *
 * `Film.tsx` plays the film in a `WebView`, and `react-native-webview` is in
 * the clip target's `excludedPackages`: 15 MB is the budget for everything a
 * physical invocation may download, and a browser engine's worth of framework
 * to play one 3½-minute video is not a trade the expansion-plans card can
 * afford. Importing it anyway would not degrade — an excluded native module is
 * a crash on import, which would take the whole Plans experience down.
 *
 * So the band keeps its place in the page and its poster, and the film opens in
 * real Safari over the clip. That is a better player than the embedded one in
 * every respect except that it is not embedded: AirPlay works, the scrubber is
 * the system's, and the captions are the ones the church wrote.
 *
 * What is lost is the chapter list, which is the part that needs a page to seek
 * inside. It is on the website's own version of this page, which is where the
 * button below lands.
 * ---------------------------------------------------------------------------
 */
import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';

import { Label, Small } from '@/components/Type';
import { openExternal } from '@/clip/handoff';
import { useTheme } from '@/theme/ThemeProvider';

import { Rich } from './Rich';
import { FLYTHROUGH } from './future';

export function Film() {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.space.xs }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Play the flythrough. ${FLYTHROUGH.length}.`}
        onPress={() => openExternal(FLYTHROUGH.src, theme)}
        style={{
          borderRadius: theme.radius.md,
          overflow: 'hidden',
          backgroundColor: theme.color.paperSunken,
          aspectRatio: FLYTHROUGH.width / FLYTHROUGH.height,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Image
          source={{ uri: FLYTHROUGH.poster }}
          style={{ position: 'absolute', width: '100%', height: '100%' }}
          contentFit="cover"
          accessible={false}
          transition={200}
        />
        {/*
         * A disc with a triangle in it, drawn rather than fetched: the clip has
         * one icon set and the play glyph is not in it, and a shape this simple
         * is not worth a network round trip on a card that has to open fast.
         */}
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            backgroundColor: theme.color.paper,
            opacity: 0.92,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <View
            style={{
              marginLeft: 6,
              borderTopWidth: 13,
              borderBottomWidth: 13,
              borderLeftWidth: 22,
              borderTopColor: 'transparent',
              borderBottomColor: 'transparent',
              borderLeftColor: theme.color.accent,
            }}
          />
        </View>
      </Pressable>

      <Label>{FLYTHROUGH.length.toUpperCase()}, SILENT</Label>
      <Rich color={theme.color.inkSoft}>{FLYTHROUGH.caption}</Rich>
      <Small color={theme.color.inkSoft}>
        The film opens in Safari, over this card. The chapter list that jumps to
        a part of it is on the church’s website.
      </Small>
    </View>
  );
}
