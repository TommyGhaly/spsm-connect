/**
 * What is inside this level, as a menu at the right edge — the app's copy of
 * the website's `SubgroupShelf` in its `readOnly` mode.
 *
 * ## Why a second menu, when the app already has a drawer
 *
 * They answer different questions. The drawer is where the church's *sections*
 * are — Photos, About, Giving — and it is the same on every screen. This is
 * where *this level's parts* are, and it changes as you move through a gallery:
 * the years of Summercamp, then the weeks of a year, then the days of a week.
 * The website reached the same arrangement by a different route, and its note is
 * worth quoting because it is the whole argument for the tiles: a list of text
 * labels for "Day 1, Day 2, Talent Show" tells you their names; a list of their
 * covers tells you which is which.
 *
 * ## The one thing it can do that the cards cannot
 *
 * Reach a part with **no photographs in it**. Such a part draws a card with a
 * seal on it and no information, and it is exactly the part an administrator has
 * just made and wants to fill.
 *
 * ## What was adjusted for a phone, and why
 *
 * The website's shelf opens on `:hover` and has nothing to press — Tommy:
 * *"I want it to be an untoggled menu, more subtle."* A phone has no hover, so
 * the tab is a real control here and the panel is a real overlay: press the tab
 * to open, press the scrim or the close button to shut it. That is the *only*
 * part of the design that changed. The tab is still the loud oxblood strip with
 * the parish's gold hairline and an arrow pointing at the page it opens onto,
 * still carries the count, and the tiles inside are still a cover with the name
 * over it.
 *
 * The panel is an overlay rather than something in the page's flow, and that is
 * what makes the list scroll. A `ScrollView` nested inside `Screen`'s own
 * `ScrollView` is the arrangement where neither one moves reliably — the outer
 * claims the gesture. Lifted out of the flow the panel owns its height and its
 * gestures outright, so a camp with fourteen days scrolls the way a list should.
 */
import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { Body, Micro, Small } from '@/components/Type';
import { NoPictures, Picture } from '@/gallery/Picture';
import type { MediaRow } from '@/gallery/data';
import { useTheme } from '@/theme/ThemeProvider';

/** One part of this level, as the shelf needs it. */
export interface ShelfItem {
  id: string;
  /** Its name — "Week 1 2026", "Day 3". */
  label: string;
  /** Where pressing it goes. */
  href: Href;
  /** The first photograph of its subtree, or null for a part with none. */
  cover: MediaRow | null;
  /** A count, or a state — "6", "3 inside", "empty". Never an action. */
  note: string;
}

/**
 * The terse line under a tile's name, ported from the website's `shelfNote`.
 *
 * Terse on purpose, and a different sentence from the one on the card for the
 * same level. A card is 160 points wide with room for "3 inside · 12
 * photographs"; a tile in a menu is a glance, and the useful fact at a glance is
 * whether there is anything in there yet.
 */
export function shelfNote({
  children,
  photos,
  videos,
}: {
  children: number;
  photos: number;
  videos: number;
}): string {
  if (children > 0) return children === 1 ? '1 inside' : `${children} inside`;
  const items = photos + videos;
  return items > 0 ? String(items) : 'empty';
}

/** How tall one tile's picture is. Small enough that four fit on a phone. */
const TILE = 96;

/**
 * How wide the pull tab is, and how much room a page must leave for it.
 *
 * Exported because the tab is an *overlay* — a sibling of the page, not
 * something in its flow — so nothing in the page knows it is there. Left to
 * itself, the level's description runs underneath it and loses a word off the
 * end of every line the tab is level with, which is the church's own prose
 * being clipped by furniture.
 *
 * That was true when the tab was centred too; it landed on the photographs,
 * where a covered corner reads as a covered corner rather than as a typo. Up
 * beside the title it is on the text, so the text has to move.
 *
 * `SHELF_CLEARANCE` is the tab plus a thumb's worth of air, for the page to
 * spend as `paddingRight` on whatever the tab is level with.
 */
export const SHELF_TAB_WIDTH = 34;
export const SHELF_CLEARANCE = SHELF_TAB_WIDTH + 12;

/**
 * How far below the header the pull tab starts.
 *
 * `space.lg`'s 24 points, written as a number because this is measured against
 * the *page's* top padding rather than chosen from the scale: `Screen` pads by
 * the gutter, which is 18 at 380pt and 40 at 1280, and the breadcrumb sits on
 * that line. 24 puts the tab's shoulder just below the breadcrumb on a phone
 * and alongside the title — near enough to read as one band of "where am I"
 * without the tab and the text ever touching.
 */
const TAB_TOP = 24;

export function SubgroupShelf({
  /** "Years", "Weeks" — the church's own word for what is inside. */
  legend,
  items,
}: {
  legend: string;
  items: readonly ShelfItem[];
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [open, setOpen] = useState(false);

  // Nothing inside is not an empty menu, it is no menu. The page says "there
  // are no photographs here yet" in its own words, and a tab offering a list of
  // nothing beside it would be furniture arguing with the sentence.
  if (items.length === 0) return null;

  /*
   * A little over two thirds of the window, so the gallery behind stays visible
   * at the left edge. That strip is not decoration: it is what says this is a
   * menu over the page rather than a new screen, which is the difference
   * between pressing the scrim to go back and looking for a back button.
   */
  const panel = Math.round(Math.min(width * 0.72, 320));

  if (!open) {
    return <Tab legend={legend} count={items.length} onPress={() => setOpen(true)} />;
  }

  return (
    <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}>
      {/*
        The scrim, and it is the primary way out. A menu opened by a thumb at
        the right edge is closed by a thumb anywhere else, which is the gesture
        every sheet on this platform has taught; the close button in the header
        is for the keyboard and for anybody who does not know that.
      */}
      <Pressable
        onPress={() => setOpen(false)}
        accessibilityRole="button"
        accessibilityLabel={`Close ${legend.toLowerCase()}`}
        style={{ flex: 1, backgroundColor: theme.color.deep, opacity: 0.4 }}
      />

      <View
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: panel,
          backgroundColor: theme.color.paperRaised,
          borderLeftColor: theme.color.gold,
          borderLeftWidth: 1,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.space.xs,
            paddingHorizontal: theme.space.md,
            paddingVertical: theme.space.sm,
            borderBottomColor: theme.color.rule,
            borderBottomWidth: 1,
          }}
        >
          {/* The `Type` components take no `style` by design — see `Type.tsx` —
              so the growing is done by a view around it. */}
          <View style={{ flex: 1 }}>
            <Body>{legend}</Body>
          </View>
          <Count n={items.length} />
          <Pressable
            onPress={() => setOpen(false)}
            accessibilityRole="button"
            accessibilityLabel={`Close ${legend.toLowerCase()}`}
            hitSlop={theme.space.sm}
          >
            <Icon name="close" color={theme.color.inkSoft} size={16} />
          </Pressable>
        </View>

        {/*
          The scrolling list, and the reason the panel is an overlay.

          `flex: 1` on the view rather than on the content: the `ScrollView`
          must be told how tall it is by its parent, or it grows to its content
          and the last tiles are simply off the bottom of the screen with no way
          to reach them. The bottom inset is the home indicator, which sits over
          the last row otherwise.
        */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            padding: theme.space.md,
            paddingBottom: insets.bottom + theme.space.lg,
            gap: theme.space.sm,
          }}
          scrollIndicatorInsets={{ bottom: insets.bottom }}
        >
          {items.map((item) => (
            <Tile key={item.id} item={item} onGo={() => setOpen(false)} />
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

/**
 * The pull tab: what is on screen when the menu is shut.
 *
 * Loud, and that is the website's decision rather than this file's — Tommy:
 * *"maybe make the button for showing the side bar more noticeable."* An
 * oxblood ground with the parish's gold hairline, not a faint grey line.
 *
 * The arrow is why it is loud rather than merely coloured. A coloured strip at
 * the edge of the window is a decoration; a coloured strip with a glyph pointing
 * at the page it opens onto says which way the thing comes out.
 *
 * The legend is turned on its side because the strip is 34 points wide and the
 * word is "Gatherings". Rotating the text rather than shortening it keeps the
 * church's own word for what is inside, which is the thing `childLabel` exists
 * to carry — see `childLabelOf` on the website.
 */
function Tab({
  legend,
  count,
  onPress,
}: {
  legend: string;
  count: number;
  onPress: () => void;
}) {
  const theme = useTheme();

  /*
   * Near the top of the right edge, beside the level's own name.
   *
   * ## It was vertically centred, and the reason it was is still true
   *
   * The old note here: *"this is the one control on the screen that a thumb
   * reaches for without looking, and the middle of the right edge is where a
   * thumb already is."* That is a good argument about thumbs and it lost to a
   * better one about **what the tab is for**.
   *
   * Centred, the tab lands over the photographs — the gallery's own content,
   * three or four covers down, on whatever the page happens to have put there.
   * So the one thing on the screen that says "there are eleven days inside this
   * week" sits on top of pictures *from* those days, arriving in the reader's
   * eye after them. Somebody who scrolls straight down past the title has
   * already begun reading the leaf when they meet the control that says this
   * is not a leaf.
   *
   * Up here it is level with the breadcrumb and the title, which is the part of
   * the page that answers *where am I* — and "what is inside this" is the same
   * question. It also stops covering the content, which centring could not
   * avoid doing on any screen.
   *
   * The thumb loses something real and not much: the tab is 34 points wide and
   * 180 tall, at the edge of the glass, and it has `TAB_TOP` of clearance from
   * the top rather than being jammed into the corner.
   */
  return (
    <View
      style={{
        position: 'absolute',
        top: TAB_TOP,
        right: 0,
        // No `bottom`, deliberately. The view used to span the screen and
        // centre its child; it is now the size of the tab, which is also what
        // stops it swallowing presses meant for the gallery down the right-hand
        // side of the page.
        alignItems: 'flex-end',
      }}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${legend}, ${count}. Opens the list.`}
        style={({ pressed }) => ({
          width: SHELF_TAB_WIDTH,
          paddingVertical: theme.space.sm,
          alignItems: 'center',
          gap: theme.space.xs,
          backgroundColor: theme.color.deep,
          borderColor: theme.color.gold,
          borderWidth: 1,
          borderRightWidth: 0,
          borderTopLeftRadius: theme.radius.md,
          borderBottomLeftRadius: theme.radius.md,
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <Icon name="prev" color={theme.color.inkInverse} size={13} />
        {/*
          Laid out at 120 points and then turned, because a rotation in React
          Native happens after layout: a `Text` in a 34-point column would wrap
          to one letter a line first and then be turned on its side, which is
          not the same thing at all. `numberOfLines` keeps a long word from
          wrapping inside the 120 rather than being cut.
        */}
        <View style={{ height: 120, width: 20, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 120, alignItems: 'center', transform: [{ rotate: '-90deg' }] }}>
            <Micro color={theme.color.inkInverse} numberOfLines={1}>
              {legend.toUpperCase()}
            </Micro>
          </View>
        </View>
        <Count n={count} onDeep />
      </Pressable>
    </View>
  );
}

/** The count, on the tab and in the panel's header. */
function Count({ n, onDeep = false }: { n: number; onDeep?: boolean }) {
  const theme = useTheme();

  return (
    <View
      style={{
        minWidth: 20,
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: theme.radius.sm,
        alignItems: 'center',
        backgroundColor: onDeep ? theme.color.gold : theme.color.accentSoft,
      }}
    >
      <Micro color={onDeep ? theme.color.deep : theme.color.accent}>{n}</Micro>
    </View>
  );
}

/**
 * One part: its cover, with its name over it.
 *
 * Borrowed from the ministry tiles on `/events`, which is the borrowing the
 * website made for the same reason — those tiles already solve this exact
 * problem elsewhere, which is naming a handful of picture-shaped things in a
 * small space.
 *
 * The name sits *over* the picture on a band rather than under it, because a
 * caption under every tile doubles the height of the list for a word.
 */
function Tile({ item, onGo }: { item: ShelfItem; onGo: () => void }) {
  const theme = useTheme();
  const router = useRouter();

  return (
    <Pressable
      onPress={() => {
        // Shut first, then go. The panel is not part of the screen being left,
        // so a push with it still open leaves the new level's menu open on
        // arrival — showing the *previous* level's parts until it re-renders.
        onGo();
        router.push(item.href);
      }}
      accessibilityRole="link"
      accessibilityLabel={`${item.label}, ${item.note}`}
      style={({ pressed }) => ({
        opacity: pressed ? 0.7 : 1,
        borderRadius: theme.radius.sm,
        overflow: 'hidden',
      })}
    >
      {item.cover ? (
        <Picture media={item.cover} height={TILE} rounded={false} />
      ) : (
        <NoPictures height={TILE} rounded={false} />
      )}

      {/*
        The band the name sits on. `deep` at four fifths rather than a gradient:
        React Native has no CSS gradient without a library, and a flat band under
        two lines of type is the thing a gradient was approximating anyway.
      */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: theme.space.sm,
          paddingVertical: theme.space.xs,
          backgroundColor: theme.color.deep,
          opacity: 0.82,
        }}
      >
        <Small color={theme.color.inkInverse} numberOfLines={1}>
          {item.label}
        </Small>
        <Micro color={theme.color.inkInverse}>{item.note}</Micro>
      </View>
    </Pressable>
  );
}
