/**
 * The small amount of markup the About prose needs, and nothing more.
 *
 * ---------------------------------------------------------------------------
 * The website writes these pages as JSX, because several sentences have an
 * `<i>`, a `<b>` or a `<Link>` in the middle of them and a plain string cannot
 * hold that. Porting them here as JSX would mean either a `<Text>` component
 * per run — every paragraph a tree of twenty elements, unreadable beside the
 * prose it encodes — or dropping the emphasis, which in these paragraphs is
 * not decoration: *Copt*, *homoousios*, *Theotokos* and *Anno Martyrum* are
 * words being named rather than used, and a page that flattens them is saying
 * something slightly different from the one it was copied from.
 *
 * So the paragraphs stay strings, in a markup deliberately small enough to
 * read past:
 *
 *   *italic*        a word being named, or a Latin or Coptic phrase
 *   **bold**        the few places the website sets a run in `<b>`/`<strong>`
 *   [text](/path)   a link to another screen in this app
 *
 * That is the whole language. There is no list, no heading and no image
 * syntax, because those are structure and structure is expressed by the data
 * shape a screen reads — a heading is a field called `heading`, not a line
 * starting with a hash. This renders **one paragraph**; anything that wants to
 * be more than a paragraph is not prose and should not come through here.
 *
 * **No raw markdown library.** A parser that also handles tables, footnotes
 * and raw HTML is a large dependency in which everything the church types is
 * executable structure. Three forms, matched by one regular expression, is the
 * amount of power this needs.
 * ---------------------------------------------------------------------------
 */
import { Fragment } from 'react';
import { Linking, Text } from 'react-native';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';

import { lineHeightFor } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * One run of text, after parsing.
 *
 * `href` and the two emphasis flags are independent on purpose — the website
 * has no link that is also italic, but nothing in the markup forbids one and a
 * type that made them exclusive would turn a harmless string into a crash.
 */
type Run = {
  text: string;
  italic?: boolean;
  bold?: boolean;
  href?: string;
};

/*
 * One expression, three alternatives, in the order they must be tried.
 *
 * `**` before `*`: JavaScript alternation is first-match rather than
 * longest-match, so a bold run tried second is read as an empty italic run
 * followed by a literal asterisk. The `[^*]` inside the italic form stops it
 * swallowing the `**` of a bold run that follows it in the same paragraph.
 */
const MARKUP = /\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\(([^)]+)\)/g;

/** Split a paragraph into runs. Exported for the test that checks it. */
export function parseRuns(source: string): Run[] {
  const runs: Run[] = [];
  let at = 0;

  for (const match of source.matchAll(MARKUP)) {
    const start = match.index;
    if (start > at) runs.push({ text: source.slice(at, start) });

    if (match[1] !== undefined) runs.push({ text: match[1], bold: true });
    else if (match[2] !== undefined) runs.push({ text: match[2], italic: true });
    else if (match[3] !== undefined && match[4] !== undefined) {
      runs.push({ text: match[3], href: match[4] });
    }

    at = start + match[0].length;
  }

  if (at < source.length) runs.push({ text: source.slice(at) });
  return runs;
}

/**
 * The runs of one paragraph, as nested `<Text>`.
 *
 * Nested rather than adjacent, because RN lays nested text out as one
 * paragraph and adjacent `<Text>` siblings as one block each — an italic word
 * mid-sentence would start its own line. The parent carries the size and the
 * colour; each child carries only what it changes.
 *
 * Both fonts come from the theme. An italic run is set in the *display* face
 * rather than in a synthesised oblique: the church's body face ships in one
 * weight, RN has no `fontStyle` synthesis on Android, and a run that silently
 * did nothing would be the worst of the three options.
 */
export function Rich({ children, color }: { children: string; color?: string }) {
  const theme = useTheme();
  const router = useRouter();

  const open = (href: string) => {
    // An in-app route, or the wider web. Nothing in the About prose links out
    // today; this is here so that the first one to does not need a new
    // component, and so a malformed href fails as a no-op rather than a crash.
    if (href.startsWith('/')) router.push(href as Href);
    else void Linking.openURL(href);
  };

  return (
    <Text
      style={{
        color: color ?? theme.color.ink,
        fontFamily: theme.fontFamily.body,
        fontSize: theme.fontSize.body,
        lineHeight: lineHeightFor(theme, 'body', 'relaxed'),
      }}
    >
      {parseRuns(children).map((run, at) => (
        <Fragment key={at}>
          {run.href === undefined ? (
            <Text
              style={{
                fontFamily: run.italic ? theme.fontFamily.display : undefined,
                fontStyle: run.italic ? 'italic' : undefined,
                fontWeight: run.bold ? '700' : undefined,
              }}
            >
              {run.text}
            </Text>
          ) : (
            <Text
              accessibilityRole="link"
              onPress={() => open(run.href as string)}
              style={{ color: theme.color.accent, textDecorationLine: 'underline' }}
            >
              {run.text}
            </Text>
          )}
        </Fragment>
      ))}
    </Text>
  );
}
