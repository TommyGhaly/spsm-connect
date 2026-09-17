/**
 * The chrome every clip experience is drawn inside.
 *
 * Three parts, and each of them is answering a question somebody holding an
 * unfamiliar phone screen actually has:
 *
 *   **A title bar.** *What is this?* An App Clip opens with no app icon in a
 *   dock, no tab bar, and no history — the card said "St. Philopater & St. Mina"
 *   and then vanished. The bar is the only thing on screen that says whose app
 *   this is, so it says the church's name and what the tag was for.
 *
 *   **The experience.** Whatever the invocation URL asked for, given the whole
 *   of the middle and its own scrolling. Screens borrowed from the full app
 *   bring their own `Screen`; nothing is wrapped in a second scroll view.
 *
 *   **A foot.** *How do I keep this?* Apple's own overlay — see `handoff.ts` —
 *   and beside it the website page, for somebody who wants the thing but not
 *   the app. Both are offers rather than interruptions: no clip screen in this
 *   folder opens an install prompt on its own.
 *
 * There is no back button, because there is nowhere back to. A clip has one
 * invocation and one job — Apple's own guidance — and the way out is finishing
 * or swiping away.
 */
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Label, Small, Subheading } from '@/components/Type';
import { useTheme } from '@/theme/ThemeProvider';

import { openSite, recommendApp } from './handoff';
import { PressableText } from './PressableText';

export function ClipFrame({
  title,
  /** The page on the website that says the same thing. Omitted for the hub. */
  sitePath,
  children,
}: {
  title: string;
  sitePath?: string;
  children: ReactNode;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.paper }}>
      <View
        style={{
          paddingTop: insets.top + theme.space.sm,
          paddingBottom: theme.space.sm,
          paddingHorizontal: theme.space.gutter,
          backgroundColor: theme.color.deep,
          gap: 2,
        }}
      >
        <Label color={theme.color.inkInverse}>{'ST. PHILOPATER & ST. MINA'}</Label>
        <Subheading color={theme.color.inkInverse}>{title}</Subheading>
      </View>

      <View style={{ flex: 1 }}>{children}</View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.space.md,
          paddingHorizontal: theme.space.gutter,
          paddingTop: theme.space.sm,
          paddingBottom: insets.bottom + theme.space.sm,
          borderTopWidth: 1,
          borderTopColor: theme.color.rule,
          backgroundColor: theme.color.paperRaised,
        }}
      >
        <PressableText
          label="Get SPSM Connect"
          hint="Opens the App Store card for the full app"
          color={theme.color.accent}
          onPress={recommendApp}
        />
        {sitePath ? (
          <PressableText
            label="Open on the website"
            color={theme.color.inkSoft}
            onPress={() => openSite(sitePath, theme)}
          />
        ) : (
          <Small color={theme.color.inkFaint}>spsmwayland.org</Small>
        )}
      </View>
    </View>
  );
}
