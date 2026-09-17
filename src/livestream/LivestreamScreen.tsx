/**
 * Watch live: the broadcast first, then what came before it.
 *
 * ---------------------------------------------------------------------------
 * That order is the screen, and it is the website's `/livestream` page reasoning
 * verbatim: somebody arriving during a liturgy wants the player and nothing
 * above it, and somebody arriving on a Tuesday wants the most recent service.
 * Putting the archive above the player would serve the second reader at the
 * first one's expense, and the first one is the one in a hurry.
 *
 * **There is no heading over the player, deliberately** — the same choice that
 * makes `/livestream` the one page on the website with no `PageHeader`. A title
 * and a paragraph explaining the screen would push the player down a phone's
 * first screenful, so somebody opening the app mid-liturgy would have to scroll
 * past prose to reach the thing they came for. The drawer already put the words
 * "Watch live" in the header on the way in.
 * ---------------------------------------------------------------------------
 *
 * The two halves come from different services, which is worth knowing when one
 * of them breaks: the live embed from Castr, the archive from the church's
 * YouTube channel, because the church streams to Castr and restreams to
 * YouTube. See `archiveChannelId` in `LivestreamConfig`.
 */
import { ActivityIndicator, View } from 'react-native';

import { Body, Small, Subheading } from '@/components/Type';
import { Card, Screen } from '@/components/Surface';
import { useTheme } from '@/theme/ThemeProvider';

import { MAX_STREAMS } from './data';
import { PastStreams } from './PastStreams';
import { Player } from './Player';
import { embedUrl, livestreamProbe, useLivestreamConfig } from './config';
import { useLive } from './useLive';

export function LivestreamScreen() {
  const theme = useTheme();
  const { ready, config } = useLivestreamConfig();

  /*
   * The probe is derived before the early returns below, because a hook cannot
   * be called conditionally — and `useLive(null)` is the honest value for a
   * screen that has not read its settings yet. It resolves to `live`
   * immediately, which nothing renders until `ready`.
   */
  const probe = ready ? livestreamProbe(config) : null;
  const { status, videoId, recent } = useLive(probe);

  if (!ready) {
    /*
     * One Firestore read, usually a few hundred milliseconds. A spinner rather
     * than the player drawn from the defaults: see `LivestreamSettings.ready`
     * for the case that makes the difference — a church that has switched the
     * stream off would otherwise get a Castr embed for one frame.
     */
    return (
      <Screen>
        <View style={{ paddingVertical: theme.space.xl, alignItems: 'center' }}>
          <ActivityIndicator color={theme.color.accent} />
        </View>
      </Screen>
    );
  }

  if (!config.enabled || config.target === '') {
    return (
      <Screen>
        <Card>
          <Subheading>The stream isn&apos;t set up yet</Subheading>
          <Body color={theme.color.inkSoft}>
            Liturgies aren&apos;t being streamed through the app at the moment. If the church
            is streaming elsewhere, the office can point you to it.
          </Body>
        </Card>
      </Screen>
    );
  }

  const src = embedUrl(config);

  /*
   * Tested against the probe as well as the embed URL, and not simply `!src`.
   * A YouTube channel legitimately has no build-time embed — its live video id
   * changes every Sunday and only `/api/live` can name it — so this is
   * misconfigured only when *neither* half can produce a player: no usable
   * address in the settings, and no probe that could resolve one.
   */
  if (!src && !probe) {
    return (
      <Screen>
        <Card>
          <Subheading>The stream is misconfigured</Subheading>
          <Body color={theme.color.inkSoft}>
            The livestream is switched on but its address can&apos;t be read. A church
            administrator can correct it in the site&apos;s integration settings.
          </Body>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen gap={theme.space.lg}>
      <View style={{ gap: theme.space.sm }}>
        <Player
          src={src}
          status={status}
          videoId={videoId}
          fallbackUrl={config.fallbackUrl}
          // So the standby band does not point at an archive that is not there.
          archived={recent.length > 0}
        />

        {/* "Sundays, 8:00am" and the like, when the church has set one. */}
        {config.scheduleNote !== '' && (
          <Small color={theme.color.inkSoft}>{config.scheduleNote}</Small>
        )}
      </View>

      <PastStreams
        // Sliced here rather than by the endpoint, which returns everything it
        // looked at. Where the list is cut is a fact about this screen's height;
        // see MAX_STREAMS.
        streams={recent.slice(0, MAX_STREAMS)}
        channelUrl={channelUrl(config.archiveChannelId)}
      />
    </Screen>
  );
}

/**
 * The channel's streams page, for the "all past services" row.
 *
 * `/streams` rather than `/live`, and that is the same preference
 * `LivestreamConfig.fallbackUrl` documents: YouTube answers a channel's `/live`
 * URL with the next *scheduled* broadcast when nothing is on, so a premiere the
 * church set up and never ran would become the app's "watch here" link
 * indefinitely. `/streams` is the archive, which is what this row promises.
 */
function channelUrl(channelId: string): string {
  const id = channelId.trim();
  return id === '' ? '' : `https://www.youtube.com/channel/${encodeURIComponent(id)}/streams`;
}
