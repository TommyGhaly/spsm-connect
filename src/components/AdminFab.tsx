/**
 * The administrator's controls, in the corner of the page they are about.
 *
 * Four screens now have the same problem and had four answers to it: a tab that
 * is two audiences at once — a parishioner reading it, and the office running
 * it — with the office's controls in a strip across the top. The strip works and
 * it costs the wrong person the top of the page: a visitor to the shop scrolled
 * past "Orders · Figures · Edit shop" to reach the books, and the forms hub
 * opened on a row of buttons most people may not press.
 *
 * So the controls come off the top and hang in the bottom-right corner, where
 * the gallery's "Edit this page" already was. Tommy's instruction, and it lands
 * the same way in all four places: the page opens as the parish sees it, and
 * the administrator's way in is one constant, reachable thing that does not
 * move between screens.
 *
 * ## One action presses; several ask
 *
 * A pill that does one thing is a button. A pill that does four is a menu, and
 * the menu is **the platform's own** — `ActionSheetIOS` on iOS, which is the
 * sheet every other app on the phone uses for exactly this, and this app's own
 * `Sheet` on Android, where React Native has no native equivalent to call.
 *
 * Native matters here beyond taste. An action sheet is dismissed the way the
 * person already knows, it reads in their own text size, VoiceOver announces it
 * as a sheet, and — the practical one — it can hold six options without any of
 * them becoming a 44pt target squeezed into a row of four.
 *
 * ## It is not a security boundary
 *
 * Every caller draws this behind a grant check, and those decide what to
 * *show*. `firestore.rules` decides what may be written.
 */
import { useState } from 'react';
import { ActionSheetIOS, Platform, Pressable, View } from 'react-native';

import { Close, Sheet } from '@/components/Fields';
import { Heading, Micro, Small } from '@/components/Type';
import { useTheme } from '@/theme/ThemeProvider';

export interface AdminAction {
  label: string;
  onPress: () => void;
  /**
   * Drawn in red, and sorted to the end on iOS where the platform expects it.
   *
   * For a destruction, not for "Done" — a mode being left is not a loss.
   */
  destructive?: boolean;
}

export function AdminFab({
  /** What the pill says. Short: it sits over the page's own content. */
  label,
  actions,
  /**
   * The sentence the sheet opens with, when there is something the options do
   * not say for themselves.
   */
  note,
  /**
   * Lift it clear of a bar along the bottom — the shop's basket and save bars.
   * Points, added to the pill's own inset.
   */
  raisedBy = 0,
}: {
  label: string;
  actions: readonly AdminAction[];
  note?: string;
  raisedBy?: number;
}) {
  const theme = useTheme();
  const [asking, setAsking] = useState(false);

  if (actions.length === 0) return null;

  function choose() {
    // One thing to do, so do it. A sheet with a single option and Cancel is a
    // confirmation nobody asked for.
    const only = actions[0];
    if (actions.length === 1 && only) {
      only.onPress();
      return;
    }

    if (Platform.OS !== 'ios') {
      setAsking(true);
      return;
    }

    /*
     * iOS wants its destructive option last and named by index, and Cancel
     * after everything. Both are positions in the same array, so the array is
     * built once here and the indices read off it rather than guessed.
     */
    const ordered = [...actions].sort(
      (a, b) => Number(a.destructive ?? false) - Number(b.destructive ?? false),
    );
    const options = [...ordered.map((action) => action.label), 'Cancel'];
    const destructiveButtonIndex = ordered.findIndex((action) => action.destructive);

    ActionSheetIOS.showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex: options.length - 1,
        ...(destructiveButtonIndex >= 0 ? { destructiveButtonIndex } : {}),
        ...(note ? { message: note } : {}),
        /*
         * Pinned, not left to the phone. This app has one theme and it is a
         * light one — `ThemeProvider` reads no colour scheme at all — so a
         * sheet that came up dark on a phone in dark mode would be the one
         * thing on screen that did not belong to the church.
         */
        userInterfaceStyle: 'light',
      },
      (index) => {
        const chosen = ordered[index];
        if (chosen) chosen.onPress();
      },
    );
  }

  return (
    <>
      <View
        // `box-none`, so the box around the pill does not swallow taps meant
        // for the page underneath it.
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          right: theme.space.gutter,
          bottom: theme.space.lg + raisedBy,
        }}
      >
        <Pressable
          onPress={choose}
          accessibilityRole="button"
          accessibilityLabel={label}
          // Said, because a pill that opens a menu and one that acts are the
          // same shape and a screen reader cannot see which this is.
          accessibilityHint={actions.length > 1 ? 'Opens a list of options' : undefined}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.space.xs,
            paddingHorizontal: theme.space.md,
            minHeight: 44,
            justifyContent: 'center',
            borderRadius: theme.radius.full,
            /*
             * The page's own card, made round — `paperRaised` on a `rule` edge,
             * which is what every surface in this app that sits above the
             * ground is. It was solid accent on a gold edge, and that was a
             * second red object competing with the header over a page whose
             * subject is photographs: Tommy, *"make the button a little more
             * subtle or at least color match."*
             *
             * The word stays `accent`, so it still reads as something to press
             * rather than as a label. `accentSoft` on press is the same
             * feedback a quiet `Button` gives.
             */
            backgroundColor: pressed ? theme.color.accentSoft : theme.color.paperRaised,
            borderWidth: 1,
            borderColor: theme.color.rule,
            /*
             * A shadow, which almost nothing else in this app has, and a light
             * one. It is what says the pill is *over* the page rather than in
             * it — without any, it vanishes the moment a card of the same
             * colour scrolls under it; with the old one it read as a dialog.
             */
            shadowColor: theme.color.deep,
            shadowOpacity: 0.12,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 1 },
            elevation: 2,
          })}
        >
          <Small color={theme.color.accent}>{label}</Small>
        </Pressable>
      </View>

      {/*
        Android's half. Not an attempt to redraw an iOS sheet — it is this app's
        own `Sheet` with the options in it, which is the panel Android users of
        this app already meet everywhere else in it.
      */}
      {Platform.OS !== 'ios' ? (
        <Sheet
          open={asking}
          onClose={() => setAsking(false)}
          label={label}
          header={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
              <View style={{ flex: 1 }}>
                <Heading>{label}</Heading>
              </View>
              <Close onPress={() => setAsking(false)} what={label} />
            </View>
          }
        >
          <View style={{ gap: theme.space.xs }}>
            {note ? <Micro color={theme.color.inkSoft}>{note}</Micro> : null}

            {actions.map((action) => (
              <Pressable
                key={action.label}
                onPress={() => {
                  setAsking(false);
                  action.onPress();
                }}
                accessibilityRole="button"
                accessibilityLabel={action.label}
                style={({ pressed }) => ({
                  minHeight: 48,
                  justifyContent: 'center',
                  paddingHorizontal: theme.space.sm,
                  borderRadius: theme.radius.sm,
                  backgroundColor: pressed ? theme.color.paperSunken : 'transparent',
                })}
              >
                {/* `accent` for a destruction, as `Button`'s `danger` tone is:
                    the church's accent *is* liturgical red, so there is no
                    separate alarm colour to reach for. */}
                <Small color={action.destructive ? theme.color.accent : theme.color.ink}>
                  {action.label}
                </Small>
              </Pressable>
            ))}
          </View>
        </Sheet>
      ) : null}
    </>
  );
}
