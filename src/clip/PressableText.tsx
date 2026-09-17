/**
 * A word you can press.
 *
 * `Surface.tsx`'s `Button` is the app's pressable and is the right thing nearly
 * everywhere; this is the smaller case it deliberately does not cover — a link
 * in a strip of chrome, where a filled or outlined control would read as the
 * screen's main action and compete with the one that is.
 *
 * The 44pt minimum is the part that is not decoration: it is Apple's touch
 * target, and a line of 13pt text is 17pt tall.
 */
import { Pressable } from 'react-native';

import { Small } from '@/components/Type';

export function PressableText({
  label,
  hint,
  color,
  onPress,
}: {
  label: string;
  hint?: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityHint={hint}
      style={({ pressed }) => ({
        minHeight: 44,
        justifyContent: 'center',
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Small color={color}>{label}</Small>
    </Pressable>
  );
}
