/**
 * The three containers every screen in this app is built from.
 *
 * `Screen` for the page, `Card` for anything lifted off it, `Button` for the
 * things you press. They exist for the same reason `Type.tsx` does: so that the
 * gutter, the corner radius and the press colour are read from the parish's
 * theme once rather than guessed at on forty screens.
 */
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Small } from './Type';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * A scrolling page with the parish's gutter and a bottom inset.
 *
 * The inset is not decoration: a tab bar and a home indicator both sit over the
 * bottom of the content, and a list that ends flush with the screen edge has
 * its last row permanently half-covered.
 */
export function Screen({
  children,
  scroll = true,
  gap,
}: {
  children: ReactNode;
  /** Turn off for a screen that manages its own scrolling — a FlashList. */
  scroll?: boolean;
  gap?: number;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const padding: ViewStyle = {
    padding: theme.space.gutter,
    paddingBottom: insets.bottom + theme.space.xl,
    gap: gap ?? theme.space.md,
  };

  if (!scroll) {
    return <View style={[{ flex: 1, backgroundColor: theme.color.paper }, padding]}>{children}</View>;
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.color.paper }}
      contentContainerStyle={padding}
      // The queue and the galleries both scroll under a translucent header;
      // this keeps the scrollbar off the rounded corner.
      scrollIndicatorInsets={{ bottom: insets.bottom }}
    >
      {children}
    </ScrollView>
  );
}

export function Card({ children, gap }: { children: ReactNode; gap?: number }) {
  const theme = useTheme();

  return (
    <View
      style={{
        backgroundColor: theme.color.paperRaised,
        borderColor: theme.color.rule,
        borderWidth: 1,
        borderRadius: theme.radius.md,
        padding: theme.space.md,
        gap: gap ?? theme.space.xs,
      }}
    >
      {children}
    </View>
  );
}

export type ButtonTone = 'primary' | 'quiet' | 'danger';

/**
 * A pressable with a label.
 *
 * `danger` is `accent` too — the parish's accent *is* liturgical red, so a
 * destructive button cannot be distinguished by hue here the way it can on a
 * blue-primary site. It is distinguished by being outlined rather than filled,
 * which is also the safer default: the filled button is the one the thumb finds
 * first, and it should never be the one that deletes a photograph.
 */
export function Button({
  label,
  onPress,
  tone = 'primary',
  disabled = false,
  busy = false,
}: {
  label: string;
  onPress: () => void;
  tone?: ButtonTone;
  disabled?: boolean;
  busy?: boolean;
}) {
  const theme = useTheme();
  const inert = disabled || busy;

  const filled = tone === 'primary';
  const edge = tone === 'danger' ? theme.color.accent : theme.color.rule;
  const text = filled ? theme.color.inkInverse : tone === 'danger' ? theme.color.accent : theme.color.ink;

  return (
    <Pressable
      onPress={onPress}
      disabled={inert}
      accessibilityRole="button"
      accessibilityState={{ disabled: inert, busy }}
      style={({ pressed }) => ({
        backgroundColor: filled
          ? pressed
            ? theme.color.accentStrong
            : theme.color.accent
          : pressed
            ? theme.color.accentSoft
            : 'transparent',
        borderColor: filled ? 'transparent' : edge,
        borderWidth: filled ? 0 : 1,
        borderRadius: theme.radius.sm,
        paddingVertical: theme.space.sm,
        paddingHorizontal: theme.space.md,
        opacity: inert ? 0.5 : 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.space.xs,
        // 44pt is Apple's minimum target and the reason this is not just padding.
        minHeight: 44,
      })}
    >
      {busy ? <ActivityIndicator color={text} /> : null}
      <Small color={text}>{label}</Small>
    </Pressable>
  );
}
