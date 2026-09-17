/**
 * The back catalogue, under the live player.
 *
 * ---------------------------------------------------------------------------
 * **Led by the date and time, with no title shown, and that is the whole
 * design.** It is the website's `PastStreams.tsx` and its reasoning holds
 * exactly: every broadcast on the church's channel is published under the
 * identical name — "St Philopater & St Mina Coptic Orthodox Church Live
 * Stream" — so printing it gives six identical headings and pushes the one
 * field that actually differs into small grey type beneath them. When each
 * service happened *is* the title here.
 *
 * Consequently there is no summary line either. Nothing in the listing says
 * which liturgy this was or who served it, and inventing a description for a
 * recording nobody has watched would be worse than the gap.
 * ---------------------------------------------------------------------------
 *
 * ## These hand off to YouTube rather than playing in the app
 *
 * The website links out because six iframes on one page is a slow page. The
 * reason here is better than that one. `Linking.openURL` on a
 * `youtube.com/watch` address opens the **YouTube app** where it is installed,
 * and that app can do things this screen cannot: keep the audio going when the
 * phone is locked, cast to a television, pick a quality on a weak connection.
 * A two-hour liturgy is exactly the recording somebody wants those for, so
 * handing it over is a better outcome than a `WebView` — and the phones without
 * YouTube installed fall back to the browser, which is where the website's link
 * would have put them anyway.
 *
 * Same convention as the store links on the Giving screen and the phone numbers
 * in the calendar: `Linking` when another app should take it, `WebBrowser` when
 * the page belongs to us.
 */
import { Image } from 'expo-image';
import { Linking, Pressable, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import {
  PARISH_TIME_ZONE,
  formatClock,
  instantToWallClock,
  partOfDay,
  type PastStream,
} from '@spsm/shared';

import { Icon } from '@/components/Icon';
import { Label, Small } from '@/components/Type';
import { useTheme } from '@/theme/ThemeProvider';

import { watchUrl } from './embed';

/** The thumbnail, at 16:9 and the width a date still fits beside. */
const THUMB_WIDTH = 116;

export function PastStreams({
  streams,
  channelUrl,
}: {
  streams: PastStream[];
  /** The church's channel, for the row at the foot. May be empty. */
  channelUrl: string;
}) {
  const theme = useTheme();

  /*
   * The section is omitted entirely rather than rendering an empty state, which
   * is the website's rule and is if anything more right here. An empty list
   * means the endpoint could not be reached, not that the church has never
   * streamed — and "no past services" would be a claim about the church rather
   * than about the network. The player above says what it can about being
   * offline; this stays quiet.
   */
  if (streams.length === 0) return null;

  return (
    <View style={{ gap: theme.space.sm }}>
      <View style={{ gap: 2 }}>
        <Label>Recent services</Label>
        <Small color={theme.color.inkSoft}>
          Previous liturgies from the church&apos;s channel, most recent first.
        </Small>
      </View>

      <View style={{ gap: theme.space.xs }}>
        {label(streams).map(({ stream, day, detail }) => (
          <Stream key={stream.id} stream={stream} day={day} detail={detail} />
        ))}
      </View>

      {/*
        The way past the six. The website has no equivalent and does not need
        one — it lists twelve, which is most of what the channel holds anyway.
        Cutting the list to six on a phone makes "where are the rest" a fair
        question, and this answers it rather than leaving the list looking like
        the whole archive. `WebBrowser` rather than `Linking` here: a channel
        page is a page to browse, not a video to play, so it belongs over the
        app rather than in another one.
      */}
      {channelUrl !== '' && (
        <Small
          color={theme.color.accent}
          onPress={() => void WebBrowser.openBrowserAsync(channelUrl)}
          accessibilityRole="link"
        >
          All past services on the church&apos;s channel →
        </Small>
      )}
    </View>
  );
}

/**
 * What each row is called — and it is computed for the whole list at once,
 * because uniqueness is a property of the list and not of any row in it.
 *
 * ---------------------------------------------------------------------------
 * A row is called "Sunday, September 13" over "Morning" — the day, and what
 * distinguishes it from the other service that day. The clock replaces the part
 * of day only where the part of day is not enough.
 *
 * The website's version is `formatDate` + `formatPartOfDay` unconditionally,
 * and its note argues the part of day is right where a clock time is not: a
 * past liturgy is not an appointment anyone can still keep, so "7:52 AM" spends
 * precision on a recording nobody is going to arrive at, and implies a
 * punctuality the source cannot support — a stream starts when somebody presses
 * a button, not when the service does. All true, and kept.
 *
 * What that argument misses is that the part of day sometimes fails to name the
 * row at all. **Measured against the church's own channel on 2026-09-15**,
 * which is what put this here: there were broadcasts at 6:57 AM *and* 7:30 AM
 * that morning, and both came out as "Tuesday, September 15" over "Morning".
 * Two identical rows pointing at two different recordings is worse than a clock
 * time — the reader cannot tell which is which, and pressing one is a coin
 * toss. The church streams twice on many days, so this is the common case
 * rather than a curiosity.
 *
 * So the clock is a tie-break and nothing more: rows whose label is already
 * unique keep the plainer wording, and only a collision pays for the precision.
 * `formatClock` is the church's own formatter, the one the calendar's entries
 * use, so a time here reads exactly as a time does there — "6:57 AM", and "8
 * AM" on the hour.
 *
 * The year is dropped throughout, which the website keeps. Six rows reach back
 * three or four days; a year on every one of them is four identical characters
 * in a row on a screen that is rationing width, and it cannot disambiguate
 * anything at this range.
 * ---------------------------------------------------------------------------
 */
export function label(
  streams: PastStream[],
): { stream: PastStream; day: string; detail: string }[] {
  const rows = streams.map((stream) => {
    const started = new Date(stream.startedAt);
    // One conversion into the church's zone, reused for both halves. See
    // `formatDay` for why the zone is not a detail.
    const wallClock = instantToWallClock(started, PARISH_TIME_ZONE);

    return {
      stream,
      day: formatDay(started),
      part: partOfDay(started, PARISH_TIME_ZONE),
      clock: formatClock(wallClock.slice(11)),
    };
  });

  const seen = new Map<string, number>();
  for (const row of rows) {
    const key = `${row.day} ${row.part}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }

  return rows.map((row) => ({
    stream: row.stream,
    day: row.day,
    detail: (seen.get(`${row.day} ${row.part}`) ?? 0) > 1 && row.clock !== '' ? row.clock : row.part,
  }));
}

function Stream({
  stream,
  day,
  detail,
}: {
  stream: PastStream;
  day: string;
  detail: string;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={() => void Linking.openURL(watchUrl(stream.id))}
      accessibilityRole="button"
      // Joined for the spoken label, where the two lines are one phrase and the
      // separator the screen draws as a line break should be heard as a pause.
      accessibilityLabel={`Watch the service from ${day}, ${detail}, on YouTube`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.sm,
        padding: theme.space.xs,
        borderRadius: theme.radius.md,
        overflow: 'hidden',
        backgroundColor: pressed ? theme.color.accentSoft : theme.color.paperRaised,
      })}
    >
      <View
        style={{
          width: THUMB_WIDTH,
          aspectRatio: 16 / 9,
          borderRadius: theme.radius.sm,
          overflow: 'hidden',
          // Drawn whether or not a picture arrives, so a thumbnail YouTube will
          // not serve leaves a dark rectangle rather than a gap the row
          // collapses into. The website uses a CSS background for this.
          backgroundColor: theme.color.ink,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {stream.thumbnailUrl !== '' && (
          <Image
            source={{ uri: stream.thumbnailUrl }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            // These are hotlinked from YouTube's CDN and never change once a
            // stream has ended, so they are worth keeping on disk.
            cachePolicy="disk"
            // Decoration: the row already says when the service was, and that
            // is its label. A frame of a liturgy adds nothing to read.
            accessible={false}
          />
        )}

        {/*
          The play glyph over the picture, which is what makes a still read as a
          recording rather than as a photograph of the church. `inkInverse`
          because it sits on the thumbnail, not on the paper.
        */}
        <View style={{ position: 'absolute' }}>
          <Icon name="play" size={26} color={theme.color.inkInverse} />
        </View>
      </View>

      {/*
        Two lines by design, rather than one line that wraps.
        "Tuesday, September 15 · 7:30 AM" does not fit beside a thumbnail on a
        phone, and joined with a separator it broke wherever the width ran out —
        leaving a stranded "AM" under half a date. Split at the comma the reader
        would pause at anyway, it costs the same two lines and reads as a
        hierarchy: the day names the service, the time distinguishes it from the
        other one that day.
      */}
      <View style={{ flex: 1, gap: 1 }}>
        <Small color={theme.color.ink}>{day}</Small>
        <Small color={theme.color.inkSoft}>{detail}</Small>
      </View>

      <Icon name="next" size={18} color={theme.color.inkFaint} />
    </Pressable>
  );
}

/**
 * "Sunday, September 13", in the church's own zone.
 *
 * The zone is not a detail. A liturgy that began at 7:52 on a Sunday morning in
 * Wayland is 11:52 UTC the same day, but an evening service at 19:30 is 23:30 —
 * and one at 20:00 has already become Monday. Formatted against the phone's
 * zone, somebody reading this from anywhere west of the church would see
 * some of these services listed under the wrong day.
 */
function formatDay(at: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: PARISH_TIME_ZONE,
  }).format(at);
}
