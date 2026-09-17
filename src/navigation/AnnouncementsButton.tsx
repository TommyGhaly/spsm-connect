/**
 * The week's notices, in the right of every tab header.
 *
 * The pairing is the point, and it is why this sits beside `DrawerButton`
 * rather than in `src/calendar/`. The two corners of the bar now answer the two
 * different questions somebody arrives with: *where else is there* on the
 * left, *what am I being told* on the right. Both are constant across the tabs,
 * so neither is something to go looking for.
 *
 * It was a control inside the calendar's own content until this redesign, which
 * made the notices a fact about one screen. They are not — "the festival is on
 * the 19th" is as true on Giving as on the calendar — and a bell that appeared
 * on one tab of five was a bell nobody would think to press.
 *
 * ## Why it opens as a notification
 *
 * The bulletin's announcements have no hour and no day. The website prints them
 * above the week under their own heading, where a page has the room; a phone
 * does not, and a stack of undated notices at the top of the calendar pushes
 * the schedule below the fold.
 *
 * A notification is the one panel everybody already knows is *transient* — it
 * arrived, you read it, you dismiss it — which is exactly the standing of a
 * church notice against a Tuesday Liturgy. A drawer or a sixth tab would have
 * filed them as a place you go, and nobody goes to the announcements.
 *
 * ## Why it is anchored rather than centred
 *
 * A centred modal is a different promise: it is the app stopping to ask
 * something. This has to read as having *come out of the bell* — so the panel
 * hangs from the bell's own measured position and points back at it with a
 * caret.
 *
 * The measurement is the price of the `Modal`, and the `Modal` is not
 * negotiable: a panel drawn inside the header is clipped by it, and once the
 * panel is in a modal root it no longer shares a layout parent with the button.
 * `measureInWindow` is what recovers the relationship — window coordinates are
 * the one frame both of them are in.
 *
 * ## The badge
 *
 * Cleared when the tray is opened, and only for as long as the app is running.
 * Not persisted, and that is a decision rather than a shortcut: the source is a
 * singleton the announcements project overwrites every week (see the header of
 * `schema/bulletin.ts`), so a stored "seen" set would be keyed on ids that
 * silently become another week's. A badge that is wrong on a Sunday morning is
 * worse than a badge that comes back after a relaunch.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useBulletin } from '@/calendar/BulletinProvider';
import { Icon } from '@/components/Icon';
import { CAPSULE, HeaderCapsule, GLYPH, headerGlyphColor } from './HeaderCapsule';
import { Body, Label, Micro, Small } from '@/components/Type';
import { lineHeightFor } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

import type { BulletinNotice } from '@/calendar/data';

/**
 * How wide the panel is allowed to get once there is room — a tablet.
 *
 * Well past the ~68-character measure the website holds prose to, and that is
 * the trade being made: a notice is two or three sentences read once, not a
 * page to settle into, and every line the text does *not* wrap onto is a line
 * of height that does not have to be scrolled for.
 */
const MAX_PANEL_WIDTH = 480;

/** The caret's side before it is turned 45°. */
const CARET = 10;

export function AnnouncementsButton() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  /*
   * How far the panel keeps off the edges of the screen — and deliberately not
   * `space.gutter`, which is what every other surface in this app uses.
   *
   * The gutter is page padding: it exists so that prose does not run into the
   * bezel on a screen that is all prose. This is one floating card over
   * everything else, and the church writes notices in paragraphs — the festival
   * one runs to six lines — so the wider it is, the fewer lines it wraps onto
   * and the less of it falls below the fold. A gutter each side was costing it
   * about a line of text for margin nothing was reading.
   */
  const inset = theme.space.sm;

  const { notices, weekLabel } = useBulletin();

  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(false);

  /*
   * Where the panel hangs from, in window coordinates.
   *
   * The bell's own middle is carried alongside the edge, because the panel is
   * *not* the width of the button: it spans nearly the whole screen, so the
   * caret's offset from its right edge is the distance between two things
   * neither of which is fixed. Keeping the raw measurement here and doing the
   * arithmetic at render is what fixed the bug below.
   *
   * ## The panel used to fall off the screen
   *
   * It hung from `right` alone, which was fine while the bell was the last
   * thing in the bar: `right` was a gutter, and a nearly-full-width panel fit
   * inside it. Then the galleries put the menu *outside* the bell — see
   * `headerDeepStack` — and `right` became 90-odd points, which put the left
   * edge of a 386pt panel 76 points off the side of the screen. Every notice in
   * it was cut down its first word.
   *
   * So the panel's own edge is clamped at render, where its width is known, and
   * the caret is derived from the clamped edge rather than from the bell. The
   * panel stays on the screen; the caret keeps pointing at the glyph.
   *
   * Seeded with a usable guess rather than `null`, so that a press always opens
   * something. `measureInWindow` is asynchronous and its callback is not
   * guaranteed to run for a view that is mid-layout; a bell that silently does
   * nothing is the worst failure available here. The guess assumes a standard
   * header below the inset, which is what it is on every screen this renders
   * on.
   */
  const [anchor, setAnchor] = useState({
    top: insets.top + CAPSULE + theme.space.xs,
    right: inset,
    centreX: windowWidth - inset - CAPSULE / 2,
  });

  const [bell, setBell] = useState<View | null>(null);

  const show = useCallback(() => {
    setOpen(true);
    setSeen(true);

    bell?.measureInWindow((x, y, width, height) => {
      // A view that has not been laid out measures as zeroes, or as NaN on
      // Android. Keeping the previous anchor beats hanging the panel off the
      // top-left corner of the screen.
      if (!Number.isFinite(x) || !Number.isFinite(y) || height === 0) return;

      setAnchor({
        top: y + height + theme.space.xs,
        right: Math.max(inset, windowWidth - (x + width)),
        centreX: x + width / 2,
      });
    });
  }, [bell, inset, theme.space.xs, windowWidth]);

  const hide = useCallback(() => setOpen(false), []);

  /*
   * One driver for the whole entrance — backdrop and panel both read off it, so
   * they cannot get out of step.
   *
   * `useNativeDriver` because every property animated here is one the native
   * driver supports. That is also why the panel *falls* rather than growing:
   * scaling from the bell would need a transform origin, RN's is the centre,
   * and faking it with a compensating translate is a lot of arithmetic for an
   * effect a 10pt drop already reads as.
   *
   * Held in `useState` with a lazy initialiser rather than the `useRef(new
   * Animated.Value(0)).current` every RN example uses. Both give one value for
   * the lifetime of the component, but the second is a ref read during render,
   * which `react-hooks/refs` refuses — correctly, since the value is passed
   * into the style of what is being rendered. `useState` says the same thing
   * without lying about where the value is used.
   */
  const [entrance] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!open) {
      entrance.setValue(0);
      return;
    }

    const animation = Animated.spring(entrance, {
      toValue: 1,
      useNativeDriver: true,
      // Overdamped. A notification settles; it does not bounce.
      damping: 18,
      stiffness: 220,
      mass: 0.7,
    });
    animation.start();
    return () => animation.stop();
  }, [open, entrance]);

  const panelWidth = Math.min(windowWidth - inset * 2, MAX_PANEL_WIDTH);

  /*
   * How far the panel's right edge is from the screen's — the bell's own offset
   * where there is room for it, and no further left than keeps the panel's left
   * edge on the screen. On a phone the panel is the window less both insets, so
   * the second term wins and the panel is simply centred in the window; on a
   * tablet, where it is 480pt of a much wider screen, it really does hang from
   * the bell.
   */
  const panelRight = Math.min(
    Math.max(anchor.right, inset),
    Math.max(inset, windowWidth - panelWidth - inset),
  );

  /*
   * The caret has to stay on the panel's own rounded top edge — a caret over a
   * corner is a caret pointing at nothing. The clamp is what makes a very
   * narrow screen, where the gutter pushes the panel past the glyph, degrade to
   * "as close as it can get" rather than to a floating diamond.
   *
   * The panel's right edge is at `windowWidth - panelRight`; the glyph's middle
   * is `anchor.centreX`. The caret sits on the difference.
   */
  const caretRight = Math.min(
    Math.max(windowWidth - panelRight - anchor.centreX - CARET / 2, theme.radius.md),
    panelWidth - theme.radius.md - CARET,
  );

  /*
   * The panel runs to just above the home indicator, and no further.
   *
   * A ceiling rather than a fixed height, so two notices stay a small card and
   * twelve become a scrolling list — but the ceiling is now everything the
   * screen has. It used to hold `space.xl` back from the bottom, which looked
   * considered and was in practice 40pt of blank paper standing between a
   * reader and the last notice of the week. `insets.bottom` is kept because the
   * home indicator is not blank paper; it is a control that would sit on top of
   * the text.
   *
   * Note this deliberately ignores the tab bar underneath. The panel is in a
   * modal over it, the bar is not interactive while the panel is open, and
   * stopping short of something the reader cannot press either way would be
   * giving up a third of the screen to a rectangle.
   *
   * The floor is there for the pathological case — a bell measured near the
   * bottom edge — where the arithmetic would otherwise give a panel too short
   * to show its own heading.
   */
  const maxPanelHeight = Math.max(160, windowHeight - anchor.top - insets.bottom - inset);

  const count = notices.length;
  const unread = count > 0 && !seen;

  return (
    <>
      <Pressable
        ref={setBell}
        onPress={show}
        accessibilityRole="button"
        accessibilityLabel={
          count === 0
            ? 'Announcements. Nothing this week.'
            : count === 1
              ? 'Announcements. One this week.'
              : `Announcements. ${count} this week.`
        }
        accessibilityState={{ expanded: open }}
        /*
         * The mirror of `DrawerButton` on the other side of the bar: the same
         * capsule and the same slop around it, and no padding on either any
         * more — padding is what the glass capsule is sized from, and 16pt of
         * it is what turned these two into lozenges of different widths. What
         * holds them off the edge of the screen is the bar: UIKit's own inset
         * on a navigation bar, `BarSlot` on the ones this app draws.
         */
        hitSlop={theme.space.sm}
        style={{ justifyContent: 'center' }}
      >
        {({ pressed }) => (
          <View>
            {/*
             * The bell goes quiet on a week with no notices — no badge — but it
             * is not hidden, and it does not dim either. A control that appears
             * and disappears between weeks is one nobody learns the position
             * of, and "Nothing this week" is itself an answer worth being able
             * to ask for.
             */}
            <HeaderCapsule pressed={pressed}>
              <Icon name="bell" size={GLYPH} color={headerGlyphColor(theme)} />
            </HeaderCapsule>
            {count > 0 ? <Badge count={count} unread={unread} /> : null}
          </View>
        )}
      </Pressable>

      <Modal
        visible={open}
        transparent
        // The entrance is animated by hand against a measured anchor, so the
        // platform's own presentation would be a second, conflicting one.
        animationType="none"
        onRequestClose={hide}
        /*
         * Android puts a modal in its own window, and without this that window
         * begins below the status bar — which would put everything in it a
         * status bar's height out of step with the `measureInWindow`
         * coordinates the panel is positioned from. iOS ignores the prop.
         */
        statusBarTranslucent
      >
        <View style={{ flex: 1 }}>
          {/*
           * Barely-there backdrop. A notification does not dim the app it
           * arrives over; all that has to be true is that a tap anywhere sends
           * it away.
           */}
          <Pressable
            onPress={hide}
            accessibilityLabel="Close announcements"
            style={StyleSheet.absoluteFill}
          >
            <Animated.View
              style={{
                flex: 1,
                backgroundColor: theme.color.ink,
                opacity: entrance.interpolate({ inputRange: [0, 1], outputRange: [0, 0.15] }),
              }}
            />
          </Pressable>

          <Animated.View
            /*
             * `accessibilityViewIsModal` on the panel rather than on the
             * backdrop: it is what stops VoiceOver walking back out into the
             * screen underneath, and it has to be on the thing the reader is
             * meant to stay inside.
             */
            accessibilityViewIsModal
            style={{
              position: 'absolute',
              top: anchor.top,
              right: panelRight,
              width: panelWidth,
              opacity: entrance,
              transform: [
                { translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) },
              ],
            }}
          >
            <Panel
              notices={notices}
              weekLabel={weekLabel}
              maxHeight={maxPanelHeight}
              caretRight={caretRight}
              onClose={hide}
            />
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * The count, on the bell.
 *
 * Gold on the header's `deep`, where every other badge in this app would be
 * `accent`. That is not a free choice: the bar *is* dark red, so a red badge on
 * it is a red detail on red and the one thing a badge must do is be seen. Gold
 * is the chrome's documented second colour and clears 4.5:1 against `deep` —
 * the theme's own note on `deep` says the pairing is what sets its ceiling.
 *
 * `unread` only changes the colour, never whether the number is there. The
 * count is a fact about the week — three notices do not stop being three once
 * they have been read — so dropping the badge on open would be answering a
 * different question than the one the bell asks.
 */
function Badge({ count, unread }: { count: number; unread: boolean }) {
  const theme = useTheme();

  /*
   * Sized from the type rather than hardcoded, because the church can change
   * the type scale and a fixed circle around a numeral that grew is a clipped
   * numeral. The floor is a plain number for the same reason `minHeight: 44` is
   * one in `Surface`: below it the badge stops being legible at arm's length,
   * whatever the theme says.
   */
  const size = Math.max(16, Math.ceil(lineHeightFor(theme, 'micro', 'tight')) + 4);

  return (
    <View
      // Not focusable and not read out — the bell's own label already says how
      // many there are, and a lone "3" after it is noise in VoiceOver.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        position: 'absolute',
        /*
         * Hard into the corner of the capsule's own box, which puts it over the
         * circle's shoulder rather than inside it — where the capsule's rounded
         * edge cut across it. Not negative: a badge hanging outside the
         * button's bounds is a badge a bar button item may clip.
         */
        top: 0,
        right: 0,
        minWidth: size,
        height: size,
        paddingHorizontal: 4,
        borderRadius: Math.min(theme.radius.full, size / 2),
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: unread ? theme.color.gold : theme.color.inkSoft,
        // Separates the badge from the bell's own stroke where they touch.
        borderWidth: 1,
        borderColor: theme.color.deep,
      }}
    >
      <Micro color={unread ? theme.color.deep : theme.color.inkInverse}>
        {count > 9 ? '9+' : String(count)}
      </Micro>
    </View>
  );
}

/**
 * The notification itself.
 *
 * Its own component rather than more JSX above, so that the caret, the shadow
 * and the ceiling on its height are one thing to reason about.
 */
function Panel({
  notices,
  weekLabel,
  maxHeight,
  caretRight,
  onClose,
}: {
  notices: BulletinNotice[];
  weekLabel: string;
  maxHeight: number;
  /** Already clamped to the panel's own edges by the caller. */
  caretRight: number;
  onClose: () => void;
}) {
  const theme = useTheme();

  return (
    <View>
      <View
        style={{
          maxHeight,
          backgroundColor: theme.color.paperRaised,
          borderColor: theme.color.rule,
          borderWidth: 1,
          borderRadius: theme.radius.md,
          overflow: 'hidden',
          /*
           * The one place in this app that lifts something off the page with a
           * shadow rather than a rule. A notification has to look like it is
           * *over* the screen rather than part of it, and the border alone
           * reads as another card. The colour is the theme's ink, never a
           * literal — see the rule at the top of theme/tokens.ts.
           */
          shadowColor: theme.color.ink,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.18,
          shadowRadius: 16,
          // Android draws no shadow from the four properties above.
          elevation: 8,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.space.xs,
            paddingLeft: theme.space.md,
            paddingRight: theme.space.xs,
            paddingVertical: theme.space.xs,
            borderBottomColor: theme.color.rule,
            borderBottomWidth: 1,
            backgroundColor: theme.color.paperSunken,
          }}
        >
          {/*
           * The megaphone here and the bell outside, deliberately. The bell is
           * the control — "something is waiting"; the megaphone is the
           * website's own mark for this exact list, and keeping it on the
           * heading is what makes the panel recognisably the same section
           * somebody saw on the homepage.
           */}
          <Icon name="megaphone" size={16} color={theme.color.accent} />
          <View style={{ flex: 1 }}>
            <Label>Announcements</Label>
            {weekLabel !== '' ? <Small color={theme.color.inkFaint}>{weekLabel}</Small> : null}
          </View>

          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
            hitSlop={theme.space.sm}
            style={({ pressed }) => ({
              width: 32,
              height: 32,
              borderRadius: theme.radius.sm,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: pressed ? theme.color.accentSoft : 'transparent',
            })}
          >
            <Icon name="close" size={16} color={theme.color.inkFaint} />
          </Pressable>
        </View>

        {notices.length === 0 ? (
          <View style={{ padding: theme.space.md }}>
            <Body color={theme.color.inkSoft}>
              Nothing this week. The bulletin has no notices beside the schedule.
            </Body>
          </View>
        ) : (
          <ScrollView
            /*
             * `flexShrink: 1` is what makes the ceiling work, and without it
             * this panel has the bug `EventSheet` had: the card carries the
             * `maxHeight`, but Yoga's default `flexShrink` is 0, so on a week
             * with more notices than fit the scroller keeps its full content
             * height, refuses to shrink into the clamped card, and the card —
             * which sets `overflow: 'hidden'` for its rounded corners — simply
             * cuts the overflow off. The result is not a short scroller; it is
             * a scroller that cannot be scrolled to its own end, so the last
             * notice of the week is unreachable.
             *
             * `flexGrow: 0` is the other half: it keeps a *short* week
             * shrink-wrapped, so three notices stay a small card instead of
             * stretching to fill the whole ceiling with blank paper.
             */
            style={{ flexShrink: 1, flexGrow: 0 }}
            contentContainerStyle={{ paddingVertical: theme.space.xs }}
          >
            {notices.map((notice, index) => (
              <Notice key={notice.id} text={notice.text} first={index === 0} />
            ))}
          </ScrollView>
        )}
      </View>

      {/*
       * The caret, drawn last so it covers the card's own top border where the
       * two meet. A square turned 45° with only its top and left edges stroked,
       * which puts both of them on the upward-pointing half.
       */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: -CARET / 2,
          right: caretRight,
          width: CARET,
          height: CARET,
          backgroundColor: theme.color.paperSunken,
          borderTopColor: theme.color.rule,
          borderLeftColor: theme.color.rule,
          borderTopWidth: 1,
          borderLeftWidth: 1,
          transform: [{ rotate: '45deg' }],
        }}
      />
    </View>
  );
}

/**
 * One notice.
 *
 * A red spine rather than a bullet, copying `.bulletin-notice` on the website
 * for the reason its own comment gives: it says "standing notice" to somebody
 * scanning rather than reading. `Entry` in `CalendarScreen` marks a service the
 * same way, so the two stay the same object seen twice.
 */
function Notice({ text, first }: { text: string; first: boolean }) {
  const theme = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        gap: theme.space.sm,
        paddingHorizontal: theme.space.md,
        paddingVertical: theme.space.sm,
        borderTopColor: theme.color.rule,
        // No rule above the first row; the heading already has one below it.
        borderTopWidth: first ? 0 : 1,
      }}
    >
      <View style={{ width: 3, borderRadius: 2, backgroundColor: theme.color.accent }} />
      {/* `Type` has no `style` escape hatch, deliberately — see its header — so
          the row's flex lives on a wrapper rather than on the text. */}
      <View style={{ flex: 1 }}>
        <Body>{text}</Body>
      </View>
    </View>
  );
}