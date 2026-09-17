/**
 * The three containers every screen in this app is built from.
 *
 * `Screen` for the page, `Card` for anything lifted off it, `Button` for the
 * things you press. They exist for the same reason `Type.tsx` does: so that the
 * gutter, the corner radius and the press colour are read from the church's
 * theme once rather than guessed at on forty screens.
 */
import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Small } from './Type';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * The page's own scroller, handed to whatever is drawn inside it.
 *
 * ## Why a context and not three props
 *
 * Because the thing that needs it is never the screen's own child. The form
 * builder's question list is four components deep — `FormBuilder` → `FieldList`
 * → `Reorder` — and it needs to scroll the page and to stop it while a
 * question is being dragged. Threading a ref, an offset and a setter through
 * every layer between would put three props on two components that have no
 * interest in any of them, and would have to be done again for the next screen
 * that wants a drag.
 *
 * ## Why the offset is a ref and not state
 *
 * A drag reads it at the display's refresh rate. As state it would re-render
 * the page on every frame of every scroll in the app, which is a real cost paid
 * by every screen for the benefit of the one that drags.
 */
export interface Scroller {
  ref: React.RefObject<ScrollView | null>;
  /** Where the page is scrolled to, live. Points. */
  offset: React.RefObject<number>;
  /** The furthest it can scroll — content height less the viewport. Points. */
  max: React.RefObject<number>;
  /**
   * Turn the page's own scrolling off.
   *
   * A nested drag has to: Gesture Handler will hand the pan the finger, but a
   * `ScrollView` that has already begun keeps its momentum, and the row then
   * travels at the sum of the two.
   */
  setEnabled: (enabled: boolean) => void;
}

const ScrollerContext = createContext<Scroller | null>(null);

/**
 * The enclosing `Screen`'s scroller, or null on a screen that does not scroll.
 *
 * Null rather than throwing, because everything that wants this works without
 * it — a drag with no scroller simply cannot reach past the fold, which is a
 * smaller loss than a component that refuses to render.
 */
export function useScroller(): Scroller | null {
  return useContext(ScrollerContext);
}

/**
 * A scrolling page with the church's gutter and a bottom inset.
 *
 * The inset is not decoration: a tab bar and a home indicator both sit over the
 * bottom of the content, and a list that ends flush with the screen edge has
 * its last row permanently half-covered.
 */
export function Screen({
  children,
  scroll = true,
  gap,
  padBottom,
}: {
  children: ReactNode;
  /** Turn off for a screen that manages its own scrolling — a FlashList. */
  scroll?: boolean;
  gap?: number;
  /**
   * Replaces the generous bottom pad on a screen that does not scroll.
   *
   * The default is an inset plus `xl`, which is right for a list: the reader
   * has to be able to push the last row clear of the tab bar and the home
   * indicator to read it. A screen laid out to fit the window has no last row
   * to push anywhere, and the same forty points is then dead paper between its
   * last control and the tab bar — about a tenth of the screen on a phone, on a
   * layout that is already rationing height.
   */
  padBottom?: number;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const ref = useRef<ScrollView | null>(null);
  const offset = useRef(0);
  const max = useRef(0);
  const viewport = useRef(0);
  const content = useRef(0);
  const [enabled, setEnabled] = useState(true);

  const scroller = useMemo<Scroller>(() => ({ ref, offset, max, setEnabled }), []);

  const padding: ViewStyle = {
    padding: theme.space.gutter,
    paddingBottom: padBottom ?? insets.bottom + theme.space.xl,
    gap: gap ?? theme.space.md,
  };

  if (!scroll) {
    return <View style={[{ flex: 1, backgroundColor: theme.color.paper }, padding]}>{children}</View>;
  }

  return (
    <ScrollerContext.Provider value={scroller}>
      <ScrollView
        ref={ref}
        style={{ backgroundColor: theme.color.paper }}
        contentContainerStyle={padding}
        scrollEnabled={enabled}
        /*
         * Every sixteen milliseconds, which is as often as it can be asked for.
         *
         * The default is 0 — meaning "once per gesture" — and a drag reading a
         * once-per-gesture offset is a drag reading where the page was when the
         * finger landed. It costs one bridge message a frame while a finger is
         * on the glass and nothing at all when it is not, and it is recorded
         * into a ref, so no React work follows from it.
         */
        scrollEventThrottle={16}
        onScroll={(event) => {
          offset.current = event.nativeEvent.contentOffset.y;
        }}
        onLayout={(event) => {
          viewport.current = event.nativeEvent.layout.height;
          max.current = Math.max(0, content.current - viewport.current);
        }}
        onContentSizeChange={(_width, height) => {
          content.current = height;
          max.current = Math.max(0, height - viewport.current);
        }}
        // The queue and the galleries both scroll under a translucent header;
        // this keeps the scrollbar off the rounded corner.
        scrollIndicatorInsets={{ bottom: insets.bottom }}
      >
        {children}
      </ScrollView>
    </ScrollerContext.Provider>
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
 * `danger` is `accent` too — the church's accent *is* liturgical red, so a
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
