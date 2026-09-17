/**
 * The player, or an honest notice in its place when nothing is being streamed.
 *
 * The website's `LiveFrame`, and it keeps that component's central decision:
 * **the standby state is not a video-shaped box.** Saying "nothing is on"
 * inside a 16:9 rectangle is a large empty area carrying one sentence, and on a
 * phone it pushed the recent services — the thing there actually is to watch —
 * off the bottom of the screen. A band a few lines tall states the same fact
 * and leaves the list where a reader can see it without scrolling.
 */
import { WebView } from 'react-native-webview';
import { View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

import { Body, Label, Small, Subheading } from '@/components/Type';
import { siteUrl } from '@/about/media';
import { useTheme } from '@/theme/ThemeProvider';
import type { ResolvedTheme } from '@/theme/tokens';

import { withAutoplay, youtubeEmbed } from './embed';
import type { LiveStatus } from './useLive';

export function Player({
  src,
  status,
  videoId,
  fallbackUrl,
  archived,
}: {
  /**
   * The embed URL the settings name, or null when only the probe can name one
   * — the normal case for a YouTube channel, whose live video id changes every
   * Sunday. See `embedUrl`.
   */
  src: string | null;
  status: LiveStatus;
  /** The live broadcast, when the probe could name one. Beats `src`. */
  videoId: string | null;
  /** Where to watch if the player here will not do. May be empty. */
  fallbackUrl: string;
  /**
   * Whether there are past services listed under this.
   *
   * Only the standby band uses it, and only to avoid making a claim that is
   * false: it tells the reader the recent services are below, and when the
   * archive could not be read there is nothing below. That happens on a bad
   * connection, and on a phone running against a deployment of `/api/live`
   * older than the one that answers `recent`.
   */
  archived: boolean;
}) {
  const theme = useTheme();

  /*
   * The probe's answer wins over the settings'. On a YouTube channel the
   * settings have nothing to offer; on a pinned video id they have last week's.
   *
   * `src` goes through `withAutoplay` rather than being used as-is because it
   * may be a Facebook or custom embed, which want different parameters or none.
   */
  const playing = videoId ? youtubeEmbed(videoId) : src && withAutoplay(src);

  if (status === 'live' && playing) {
    return (
      <View style={{ gap: theme.space.sm }}>
        <View
          style={{
            width: '100%',
            aspectRatio: 16 / 9,
            borderRadius: theme.radius.md,
            // Clips the video to the corner radius. Without it the WebView's
            // own white page squares off the card.
            overflow: 'hidden',
            // Behind the player while it loads, so the frame reads as a screen
            // waiting rather than as a hole in the page.
            backgroundColor: theme.color.ink,
          }}
        >
          <WebView
            /*
             * The embed goes in an `<iframe>` on a page of our own, and is
             * **not** loaded as the WebView's own URL. That was the first
             * attempt and YouTube refuses it: navigating straight to
             * `youtube.com/embed/<id>` sends no `Referer`, and the embed
             * endpoint answers "Video player configuration error — Error 153",
             * which is its way of saying it will not play for a page it cannot
             * identify. Measured in the simulator on 2026-09-15, on a video
             * that plays perfectly well framed.
             *
             * `baseUrl` is what fixes it: it gives the document a real origin —
             * the church's own, the same one the website's player is framed by
             * — so the iframe sends the referrer YouTube is looking for. This
             * is also the shape `about/Film.tsx` already uses for its video,
             * and it matches the website, which has always used an iframe.
             */
            source={{ html: frame(playing), baseUrl: siteUrl('/livestream') }}
            /*
             * The two that make the stream start by itself. Without
             * `allowsInlineMediaPlayback` iOS throws the video into its own
             * fullscreen player the moment it plays; without the second, the
             * platform refuses to start it at all and the frame sits paused.
             *
             * Together they are also why `embed.ts` does not ask for `mute=1`
             * the way the website has to — the note there has the detail.
             */
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            allowsFullscreenVideo
            // The page is ours and holds one full-bleed iframe, so there is
            // nothing to scroll — and a scrollable WebView inside a scrolling
            // screen would fight the reader's thumb for the same gesture.
            scrollEnabled={false}
            style={{ backgroundColor: theme.color.ink }}
          />
        </View>

        {/*
          Only ever beside a player. The website's note explains why this is not
          rendered unconditionally: from a level up it followed the standby band
          too, offering help with a player that was not on screen and a link to
          a stream that was not on.

          Note there is no "the stream starts muted" line, which the website
          does carry. It would not be true here — see `embed.ts`.
        */}
        {fallbackUrl !== '' && (
          <Small
            color={theme.color.inkSoft}
            onPress={() => void WebBrowser.openBrowserAsync(fallbackUrl)}
            accessibilityRole="link"
          >
            Trouble with the player? Watch on the church&apos;s channel instead →
          </Small>
        )}
      </View>
    );
  }

  return (
    <Standby status={status} fallbackUrl={fallbackUrl} archived={archived} theme={theme} />
  );
}

/**
 * The one-element page the player is framed in.
 *
 * Small enough to read at a glance, which is the point: everything that decides
 * whether the liturgy plays is either in this string or in the `WebView` props
 * above, and nothing else is in the way.
 *
 * `allow="autoplay"` is not decoration. The website's note says it plainly and
 * it is true inside a WebView too: without `autoplay` in the iframe's
 * permission list the browser refuses the autoplay the URL asked for, and the
 * player sits paused. `encrypted-media` and `fullscreen` are there for the same
 * reason — an iframe is denied by default what it is not granted, and the
 * fullscreen button in the player's own controls is one of those grants.
 *
 * The source is interpolated rather than escaped, and that is safe here for a
 * reason worth stating: it is built by `embed.ts` from either a YouTube video
 * id run through `encodeURIComponent` or a URL from `config/integrations`,
 * which only a superadmin can write. It is never a value from somebody using the app.
 */
function frame(src: string): string {
  return `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;height:100%;background:#000;overflow:hidden}iframe{border:0;display:block;width:100%;height:100%}</style>
<iframe src="${src}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
}

/**
 * The band that stands in for the player.
 *
 * `accessibilityLiveRegion` so the swap is announced. Somebody using a screen
 * reader who lands here during the probe would otherwise be told nothing at
 * all, and then have the screen silently change under them when the liturgy
 * starts.
 */
function Standby({
  status,
  fallbackUrl,
  archived,
  theme,
}: {
  status: LiveStatus;
  fallbackUrl: string;
  archived: boolean;
  theme: ResolvedTheme;
}) {
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        backgroundColor: theme.color.paperSunken,
        borderColor: theme.color.rule,
        borderWidth: 1,
        borderRadius: theme.radius.md,
        padding: theme.space.md,
        gap: theme.space.xs,
      }}
    >
      {status === 'checking' ? (
        <Label>Checking for a live service…</Label>
      ) : status === 'offline' ? (
        <>
          <Subheading>No live stream right now</Subheading>
          <Body color={theme.color.inkSoft}>
            The player appears here on its own when a service begins.
            {archived ? ' Until then, the most recent services are below.' : ''}
          </Body>
        </>
      ) : (
        /*
         * `unknown`, or live with nothing playable. Both mean the same thing to
         * a reader — we cannot show it here — and neither may be dressed up as
         * "there is no service", because there may well be one in progress. The
         * way out is the whole point of this branch.
         */
        <>
          <Subheading>We can&apos;t check the stream right now</Subheading>
          <Body color={theme.color.inkSoft}>
            If a service is in progress, it will be on the church&apos;s YouTube channel.
          </Body>
          {fallbackUrl !== '' && (
            <Small
              color={theme.color.accent}
              onPress={() => void WebBrowser.openBrowserAsync(fallbackUrl)}
              accessibilityRole="link"
            >
              Open the church&apos;s channel →
            </Small>
          )}
        </>
      )}
    </View>
  );
}
