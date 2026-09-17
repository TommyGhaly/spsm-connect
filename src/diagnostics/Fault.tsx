/**
 * The screen somebody sees when the app breaks.
 *
 * ---------------------------------------------------------------------------
 * Until this existed, a thrown error in any screen took the whole app to a
 * white rectangle with no way out but force-quitting it — and told the church
 * nothing, because nobody force-quitting an app files a report.
 *
 * expo-router lets any route export an `ErrorBoundary`, and one exported from
 * the root layout catches everything below it. That is where this is wired in;
 * see `app/_layout.tsx`.
 *
 * ## What it says, and what it refuses to say
 *
 * It does not say "Oops!" and it does not say "Something went wrong" over a
 * cartoon. It says the app failed, that the church has been told, and that the
 * church itself is unaffected — which is the thing a person holding a broken
 * church app actually wants to know, and the same instinct `Unbuilt` had before
 * it was deleted: *nothing is missing from the church, only from this app.*
 *
 * **`retry` first, not a force-quit.** expo-router's `retry` re-mounts the
 * route, which genuinely fixes the common case — a screen that threw on a
 * half-loaded document. If it throws again the boundary simply catches again,
 * and the reporter's own deduplication means the second attempt is not a second
 * document.
 *
 * ## The error text is shown, folded away
 *
 * Not because a parishioner will read it, but because the person they hand the
 * phone to will — and "it just breaks" is not something anybody can act on,
 * while a message and the route it happened on very nearly is. It sits under a
 * disclosure so that it is available without being the first thing anybody
 * sees, and the stack is deliberately not drawn: it is in the fault document,
 * where it is useful, and on a phone screen it is wallpaper.
 * ---------------------------------------------------------------------------
 */
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { usePathname } from 'expo-router';
import type { ErrorBoundaryProps } from 'expo-router';

import { Button, Card, Screen } from '@/components/Surface';
import { Body, Label, Small } from '@/components/Type';
import { useTheme } from '@/theme/ThemeProvider';

import { reportFault } from './report';

export function Fault({ error, retry }: ErrorBoundaryProps) {
  const theme = useTheme();
  const [showing, setShowing] = useState(false);

  /*
   * The route the failure happened on, read here rather than passed in —
   * expo-router hands the boundary the error and nothing else.
   *
   * `usePathname` inside a boundary is safe in a way it looks like it might not
   * be: the boundary renders *outside* the subtree that threw, and the router's
   * own context is above it.
   */
  const route = usePathname();

  /*
   * Reported from an effect rather than during render, because a render may be
   * discarded and re-run and this must happen once per mount. The promise is
   * deliberately dropped — `reportFault` never rejects, and nothing on this
   * screen should wait for the network before drawing.
   */
  useEffect(() => {
    void reportFault(error, 'render', route);
  }, [error, route]);

  return (
    <Screen>
      <Card gap={theme.space.sm}>
        <Label>This screen stopped working</Label>
        <Body color={theme.color.inkSoft}>
          Something in the app failed, and the church has been told what it was. Nothing is wrong at
          the church — only here, on this screen.
        </Body>

        <Button label="Try this screen again" onPress={retry} />
      </Card>

      <Pressable
        onPress={() => setShowing((open) => !open)}
        accessibilityRole="button"
        accessibilityState={{ expanded: showing }}
        style={{ minHeight: 44, justifyContent: 'center' }}
      >
        <Small color={theme.color.accent}>
          {showing ? 'Hide the details' : 'Show the details'}
        </Small>
      </Pressable>

      {showing ? (
        <View style={{ gap: theme.space.xs }}>
          {/*
            * The route and the message, and nothing else. See the header: the
            * stack is in the fault document, which is where it can be read
            * properly.
            */}
          <Label>{route}</Label>
          <Small color={theme.color.inkSoft}>
            {error instanceof Error ? error.message : String(error)}
          </Small>
        </View>
      ) : null}
    </Screen>
  );
}
