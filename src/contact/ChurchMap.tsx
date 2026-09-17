/**
 * Where the church is, on Google's map. Live, and draggable.
 *
 * ---------------------------------------------------------------------------
 * The website's `ParishMap`, and it inherits that file's history: the map was
 * Leaflet and OpenStreetMap until OSM's own label for 169 Rice Rd turned out to
 * be "Church of the Holy Spirit" — almost certainly the congregation that had
 * the building before this one. The coordinate was right and the tiles said
 * somebody else's name under it, which is not a thing our side can fix. Google
 * lists the building correctly, so the map comes from Google.
 *
 * ## The frame is Google's own embed, interactive, exactly as on the web page
 *
 * Drag, pinch, zoom, satellite and Street View all work, because this is the
 * same Maps Embed API iframe the website frames — it needs no key and costs
 * nothing. What it cannot take is a custom marker: the pin is Google's red
 * teardrop and no parameter changes it, so the church's Coptic cross is off
 * this map here as it is there.
 *
 * **The map keeps the gestures that land on it**, and that takes a lock rather
 * than good manners. A `ScrollView` cancels the touches it has handed to a
 * child the moment it decides a drag is a scroll, so the first version of this
 * scrolled the page under the reader's thumb and the map never moved at all —
 * the embed's own handlers were getting a touch that was taken away from them a
 * few milliseconds later. `onPageScroll` is the page turning its own scrolling
 * off while a finger is down here, which is what leaves the gesture with
 * Google's map.
 *
 * The band is padded to the church's gutter on both sides, so there is a strip
 * of paper either side of the frame to scroll the page on, and the page can
 * always be moved from the heading above or the buttons below.
 *
 * ## Why the source is a document rather than the embed URL
 *
 * Because a `WebView` loads a URL as a *top-level document*, and the Embed API
 * refuses that outright — the frame renders the sentence "The Google Maps Embed
 * API must be used in an iframe." and nothing else. `mapDocument` is the iframe
 * the API is asking for, on the church's own origin. See its note.
 * ---------------------------------------------------------------------------
 */
import { Linking, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { ParishConfig } from '@spsm/shared';

import { siteUrl } from '@/about/media';
import { Button } from '@/components/Surface';
import { useTheme } from '@/theme/ThemeProvider';

import { appleMapsUrl, googleMapsUrl, mapDocument, mapEmbedUrl, postalAddress } from './config';

export function ChurchMap({
  church,
  onPageScroll,
}: {
  church: ParishConfig;
  /**
   * Turns the page's own scrolling off while a finger is on the map, and on
   * again when it lifts. Required rather than optional: a map rendered inside a
   * scroller without it is a map that cannot be panned, which is the bug this
   * prop exists to fix, and an optional one would let the next screen to use
   * this component reintroduce it silently.
   */
  onPageScroll: (enabled: boolean) => void;
}) {
  const theme = useTheme();

  const address = postalAddress(church.address);
  const embed = mapEmbedUrl(church);

  /*
   * No address, no map — not a placeholder and not a map of somewhere
   * approximate. The section simply does not exist until somebody fills
   * `config/parish` in; a pin dropped on a guessed point looks exactly as
   * authoritative as a right one.
   */
  if (!embed) return null;

  return (
    <View style={{ gap: theme.space.sm }}>
      <View
        // The accessible name of the frame, and what a screen reader announces
        // on landing here. "Google Maps" would say what the widget is rather
        // than what it shows — the website's own note, on the same string.
        accessibilityLabel={`Map of the church at ${address}`}
        /*
         * The lock, taken on the way down and given back on the way up. Both
         * ends matter: `onTouchCancel` fires when the system takes the gesture
         * away — a notification pulled down mid-drag — and without it the page
         * would stay frozen until the screen was left and opened again.
         */
        onTouchStart={() => onPageScroll(false)}
        onTouchEnd={() => onPageScroll(true)}
        onTouchCancel={() => onPageScroll(true)}
        style={{
          width: '100%',
          aspectRatio: 4 / 3,
          borderRadius: theme.radius.md,
          borderWidth: 1,
          borderColor: theme.color.rule,
          // Clips the tiles to the corner radius; without it the WebView's own
          // white page squares off the frame.
          overflow: 'hidden',
          // Behind the map while it loads, so the frame reads as something
          // arriving rather than as a hole in the page.
          backgroundColor: theme.color.paperSunken,
        }}
      >
        <WebView
          /*
           * A document of ours with Google's iframe in it, on the church's own
           * origin — not the embed URL itself, which refuses to load as a
           * top-level page. See `mapDocument`.
           */
          source={{ html: mapDocument(embed), baseUrl: siteUrl('/') }}
          // The document is loaded as a string, so the frame has no origin of
          // its own to whitelist against; the map inside it is Google's.
          originWhitelist={['*']}
          /*
           * Android only, and it is what lets the map pan inside the page: the
           * two scrollers have to be told they are nested or the outer one eats
           * every drag before the map sees it. iOS resolves the same conflict
           * on its own, in the map's favour.
           */
          nestedScrollEnabled
          /*
           * The frame's *own* scroller, off — and this is the other half of
           * making the map draggable, not a tidy-up. `WKWebView` puts a
           * `UIScrollView` over the page, and it takes a pan before the page
           * ever sees a `touchmove`. The document inside is exactly one
           * viewport tall and has nothing to scroll, so that pan produced no
           * movement at all: a locked page and a map that would not budge.
           */
          scrollEnabled={false}
          bounces={false}
          style={{ backgroundColor: theme.color.paperSunken }}
        />
      </View>

      {/*
        The links are not a fallback for the map; they are the better answer for
        anyone who wants to *go* there — the website's own words. Both apps,
        because the phone in the reader's hand has one of them set up and we do
        not know which. Stacked rather than side by side: two buttons across a
        phone are two columns of mostly air, and these labels are not short.
      */}
      <Button
        label="Directions in Apple Maps"
        tone="quiet"
        onPress={() => void Linking.openURL(appleMapsUrl(church))}
      />
      <Button
        label="Directions in Google Maps"
        tone="quiet"
        onPress={() => void Linking.openURL(googleMapsUrl(church))}
      />
    </View>
  );
}
