/**
 * The control that opens the drawer, for any header below it.
 *
 * Not the navigation object it is handed, and not its parent either: it climbs
 * until it finds the navigator that can actually open a drawer. This renders in
 * two places at different depths — a tab screen's header, where the drawer is
 * one level up, and a gallery header, where the stack is inside the drawer and
 * it is also one level up but was two while the galleries were a tab. Hardcoding
 * "the parent" makes this a button that silently does nothing the moment
 * something moves, because `openDrawer` on the wrong navigator is not a type
 * error; it is `undefined`.
 */
import { useNavigation } from 'expo-router';
import { Pressable } from 'react-native';

import { Icon } from '@/components/Icon';
import { HeaderCapsule, GLYPH, headerGlyphColor } from './HeaderCapsule';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * The two methods this needs, and nothing else.
 *
 * Structural rather than expo-router's own navigator type, because that type is
 * generic in the param list and `openDrawer` only exists on one navigator in
 * the tree anyway. Describing the climb as "something that might open a drawer,
 * and might have a parent" is the honest shape: both are checked at runtime.
 */
interface Climbable {
  openDrawer?: () => void;
  getParent?: () => Climbable | undefined;
}

function openNearestDrawer(from: Climbable) {
  let navigator: Climbable | undefined = from;

  while (navigator) {
    if (typeof navigator.openDrawer === 'function') {
      navigator.openDrawer();
      return;
    }
    navigator = navigator.getParent?.();
  }
}

export function DrawerButton() {
  const theme = useTheme();
  const navigation = useNavigation();

  return (
    <Pressable
      onPress={() => openNearestDrawer(navigation)}
      accessibilityRole="button"
      accessibilityLabel="Open the menu"
      /*
       * The 44pt target is made of hit slop rather than padding now. Padding is
       * what the glass capsule is sized from — it is drawn around whatever view
       * UIKit is handed — so 16pt of it each side is what turned a circle into
       * a lozenge. Slop is outside the view and invisible to the glass.
       */
      hitSlop={theme.space.sm}
      style={{ justifyContent: 'center' }}
    >
      {({ pressed }) => (
        <HeaderCapsule pressed={pressed}>
          <Icon name="menu" color={headerGlyphColor(theme)} size={GLYPH} />
        </HeaderCapsule>
      )}
    </Pressable>
  );
}
