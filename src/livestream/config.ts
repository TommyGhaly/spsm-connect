/**
 * The church's livestream settings, and how to ask whether it is on.
 *
 * The app's half of the website's `features/livestream/LivestreamPlayer.tsx`,
 * minus the part that cannot exist here. That component is a *server*
 * component: it decides at build time what can be decided at build time — is a
 * stream configured, what is its embed URL — and leaves "is it live" to a
 * client component. This app has no such line. Everything below happens on the
 * phone, at the moment somebody opens the screen, so the split collapses into
 * one file and one hook.
 *
 * What does not change is where the settings come from. `config/integrations`
 * is the one document that says which provider the church streams through, and
 * it is world-readable on purpose — see the rules for `config/{docId}` — so this
 * needs no session. Somebody watching the liturgy has usually not signed
 * in, and must not have to.
 */
import { useEffect, useState } from 'react';
import { doc, getFirestore, onSnapshot } from '@react-native-firebase/firestore';
import {
  COLLECTIONS,
  CONFIG_DOC_INTEGRATIONS,
  isCastrTarget,
  isYouTubeChannelId,
  parseIntegrationsConfig,
  type LivestreamConfig,
} from '@spsm/shared';

/**
 * Where to read the stream's status, or `null` when nothing can be asked.
 *
 * The website's type, unchanged, and the two cases are still genuinely
 * different questions rather than one question with two URLs.
 *
 * `castr` reads Castr's own player page and looks for their offline card.
 * On the web that works only because Castr sends
 * `access-control-allow-origin: *`; here it works because a native `fetch` is
 * not CORS-bound at all, so the app could read any provider's page. Castr is
 * still the only one whose markup we know how to interpret.
 *
 * `youtube` asks the church's own `/api/live`, which is the only thing that can
 * answer the *second* question a YouTube embed needs and Castr's does not —
 * which video — since the id changes every Sunday.
 */
export type LiveProbe = { kind: 'castr'; url: string } | { kind: 'youtube' };

export interface LivestreamSettings {
  /**
   * False until the first snapshot.
   *
   * The screen waits on this rather than rendering from the defaults, and the
   * reason is the one case the defaults get wrong: `parseIntegrationsConfig`
   * fills `enabled` from its fallback only when the *document* is missing, and
   * a document that exists with the stream switched off is a document we must
   * read before claiming anything. Drawing the player from the defaults for one
   * frame would put a Castr embed on screen for a church that had turned it off.
   */
  ready: boolean;
  config: LivestreamConfig;
}

/**
 * The livestream settings, as a live subscription.
 *
 * A listener rather than a one-shot read, for the same reason `useCampConfig`
 * is one: the interesting changes happen while somebody is looking. A stream
 * switched on five minutes before the liturgy should appear on a screen that is
 * already open, not on the next cold start.
 */
export function useLivestreamConfig(): LivestreamSettings {
  const [settings, setSettings] = useState<LivestreamSettings>(() => ({
    ready: false,
    config: parseIntegrationsConfig(undefined).livestream,
  }));

  useEffect(() => {
    return onSnapshot(
      doc(getFirestore(), COLLECTIONS.config, CONFIG_DOC_INTEGRATIONS),
      (snapshot) => {
        setSettings({
          ready: true,
          config: parseIntegrationsConfig(snapshot.data()).livestream,
        });
      },
      (error) => {
        /*
         * Ready, with the defaults — which point at the church's real Castr
         * player and real YouTube channel, so this is a working screen rather
         * than a graceful failure. The alternative is a phone with no signal
         * showing "loading" until it is closed.
         */
        console.warn('[livestream] could not read the stream settings', error);
        setSettings({ ready: true, config: parseIntegrationsConfig(undefined).livestream });
      },
    );
  }, []);

  return settings;
}

/**
 * How to read this stream's live status, or `null` if it cannot be asked.
 *
 * The website's `livestreamProbe`, unchanged including the detail that looks
 * like a mistake: it tests `config.target` for Castr but `config.archiveChannelId`
 * for YouTube. That is deliberate. `target` is whatever is embedded — a Castr
 * URL, a single video id — while `archiveChannelId` names the church's own
 * channel, and a channel is the only thing whose live status can be looked up.
 */
export function livestreamProbe(config: LivestreamConfig): LiveProbe | null {
  if (!config.enabled) return null;

  const target = config.target.trim();
  if (isCastrTarget(target)) return { kind: 'castr', url: target };

  if (config.platform === 'youtube' && isYouTubeChannelId(config.archiveChannelId.trim())) {
    return { kind: 'youtube' };
  }

  return null;
}

/**
 * The stream's address as something a `WebView` can load, or null.
 *
 * The website's `embedUrl`, with one case removed and one simplified.
 *
 * The removed case is YouTube's: there, a channel id has no embeddable form at
 * all — `youtube.com/embed/live_stream?channel=UC…` was retired, and the live
 * video id has to be resolved by `/api/live` at request time. That is still
 * true, and `null` here still means "ask the probe" rather than "misconfigured".
 *
 * Facebook keeps its plugin wrapper because that is the only way its video
 * embeds, and `custom` is still taken verbatim — it is an address somebody
 * typed into `config/integrations`, and this is not the place to second-guess
 * it beyond refusing a scheme that is not http(s).
 */
export function embedUrl(config: LivestreamConfig): string | null {
  const target = config.target.trim();
  if (!target) return null;

  switch (config.platform) {
    case 'youtube':
      return isYouTubeChannelId(target)
        ? null
        : `https://www.youtube.com/embed/${encodeURIComponent(target)}`;

    case 'facebook':
      return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(target)}&show_text=false`;

    case 'custom':
      return /^https?:\/\//.test(target) ? target : null;
  }
}
