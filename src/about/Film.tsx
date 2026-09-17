/**
 * The flythrough, and the list of what is in it.
 *
 * ---------------------------------------------------------------------------
 * A `WebView` around a plain `<video>`, which is how this app plays a film
 * without a native video module it needs nowhere else — `react-native-webview`
 * is already here for other screens. The page inside is four lines long and
 * loads no script; the player is the platform's own, so the controls, the
 * scrubber and full-screen are the ones the reader already knows.
 *
 * `preload="none"` behind the poster. See `FLYTHROUGH` in `future.ts` for why
 * this app does not autoplay a 33 MB file the website is right to autoplay.
 *
 * ## The chapters are the website's, read from the same file
 *
 * `future-flythrough.vtt` is the cue track the website builds its chapter list
 * from. Fetching and parsing it here rather than transcribing the twelve cues
 * means a re-cut film renames them in both places at once — the same argument
 * the whole `overrides.tsx` layer makes, applied to a file instead of a
 * document. A failed fetch drops the list and leaves the player, which is the
 * ordinary failure: a film with no chapter list is a working film.
 * ---------------------------------------------------------------------------
 */
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { Label, Small } from '@/components/Type';
import { Rich } from './Rich';
import { FLYTHROUGH } from './future';
import { useTheme } from '@/theme/ThemeProvider';

type Chapter = { at: number; clock: string; what: string };

/**
 * Parse WEBVTT into cues.
 *
 * Deliberately small: cue ids, `NOTE` blocks and settings on the timing line
 * are all skipped, and anything that is not `hh:mm:ss.mmm --> …` is passed
 * over. A cue's text is the lines under its timing, joined.
 */
export function parseVtt(source: string): Chapter[] {
  const chapters: Chapter[] = [];

  for (const block of source.split(/\r?\n\r?\n/)) {
    const lines = block.split(/\r?\n/).filter((line) => line.trim() !== '');
    const timingAt = lines.findIndex((line) => line.includes('-->'));
    if (timingAt === -1) continue;
    if (lines[0]?.startsWith('NOTE')) continue;

    const start = lines[timingAt]?.split('-->')[0]?.trim();
    const stamp = /^(?:(\d+):)?(\d+):(\d+)(?:\.(\d+))?$/.exec(start ?? '');
    if (!stamp) continue;

    const seconds =
      Number(stamp[1] ?? 0) * 3600 + Number(stamp[2] ?? 0) * 60 + Number(stamp[3] ?? 0);
    const text = lines.slice(timingAt + 1).join(' ').trim();
    if (text === '') continue;

    const minutes = Math.floor(seconds / 60);
    chapters.push({
      at: seconds,
      clock: `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`,
      // The website shows the cue's first sentence as the chapter label, with
      // the full stop trimmed. Same rule, so the two lists read identically.
      what: (text.split(/(?<=\.)\s+/)[0] ?? text).replace(/\.$/, ''),
    });
  }

  return chapters;
}

/** The four lines of HTML the player lives in. */
function page(seek: number): string {
  return `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;background:#000;height:100%}video{width:100%;height:100%;object-fit:contain}</style>
<video id="v" controls playsinline preload="none" crossorigin="anonymous" poster="${FLYTHROUGH.poster}">
  <source src="${FLYTHROUGH.src}" type="video/mp4">
  <track kind="captions" src="${FLYTHROUGH.captions}" srclang="en" label="What you are looking at" default>
</video>
<script>
  var v = document.getElementById('v');
  var to = ${seek};
  if (to > 0) { v.currentTime = to; v.play().catch(function(){}); }
</script>`;
}

export function Film() {
  const theme = useTheme();
  const [chapters, setChapters] = useState<Chapter[]>([]);
  /*
   * Bumped on every chapter press, and used as the WebView's `key` so the page
   * is rebuilt at the new time. A message bridge would be the tidier way to
   * seek a playing video, and it is not worth a script channel into a page
   * that exists to hold one element.
   */
  const [seek, setSeek] = useState(0);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    void (async () => {
      try {
        const response = await fetch(FLYTHROUGH.captions, { signal: controller.signal });
        if (!response.ok) return;
        setChapters(parseVtt(await response.text()));
      } catch {
        /* No chapter list. The player stays. */
      }
    })();

    return () => controller.abort();
  }, []);

  return (
    <View style={{ gap: theme.space.sm }}>
      <View
        style={{
          width: '100%',
          aspectRatio: FLYTHROUGH.width / FLYTHROUGH.height,
          borderRadius: theme.radius.md,
          overflow: 'hidden',
          backgroundColor: theme.color.ink,
        }}
      >
        <WebView
          key={nonce}
          source={{ html: page(seek), baseUrl: FLYTHROUGH.src }}
          originWhitelist={['*']}
          // Without this the platform refuses to start playback from a tap
          // inside a WebView and the control does nothing.
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          scrollEnabled={false}
          style={{ backgroundColor: theme.color.ink }}
        />
      </View>

      {chapters.length > 0 ? (
        <View
          accessibilityRole="menu"
          accessibilityLabel="Jump to a part of the walk-through"
          style={{ gap: theme.space.xs }}
        >
          {chapters.map((chapter) => (
            <Pressable
              key={chapter.at}
              onPress={() => {
                setSeek(chapter.at);
                setNonce((n) => n + 1);
              }}
              accessibilityRole="button"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.space.md,
                minHeight: 44,
              }}
            >
              <Label color={theme.color.accent}>{chapter.clock}</Label>
              <View style={{ flex: 1 }}>
                <Small color={theme.color.ink}>{chapter.what}</Small>
              </View>
            </Pressable>
          ))}
        </View>
      ) : (
        <Small color={theme.color.inkSoft}>{FLYTHROUGH.fallback}</Small>
      )}

      <Rich color={theme.color.inkSoft}>{FLYTHROUGH.caption}</Rich>
    </View>
  );
}
