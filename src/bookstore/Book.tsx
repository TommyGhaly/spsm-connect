/**
 * One book, as a card on the shelf.
 *
 * The website's `Book`, and the argument it settled is worth carrying over
 * whole because it is about shops rather than about CSS. The shelf used to be
 * eleven rows — a 40px thumbnail, a title, and a price at the far end of an
 * empty gutter. That is a stock report. Nothing on it made anyone want a book,
 * and wanting a book is the whole job of a shop.
 *
 * The church's covers are phone snaps of books on a table, which was the
 * original argument for showing them small. The fix for a crooked snapshot is
 * not to shrink it, it is to frame it: every cover sits in a tile of the same
 * shape on the same sunken paper, and framed identically eleven times the
 * differences in how they were taken stop reading as eleven mistakes and start
 * reading as eleven books.
 *
 * ## Two targets, not one
 *
 * The cover and title open the book; Add is its own control underneath. On the
 * web that is forced — a `<button>` cannot contain another one — and here it is
 * chosen, for the reason that rule exists: a shopper reaching for Add must not
 * be able to miss it by four points and get a dialog instead.
 */
import { Pressable, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Body, Small, Micro } from '@/components/Type';
import { money } from '@/payments/money';
import { useTheme } from '@/theme/ThemeProvider';

import { Cover } from './Cover';
import { usePendingEdit } from './admin/pendingEdits';
import type { ShopProduct } from './data';

/**
 * How tall a cover is on the shelf.
 *
 * A fixed height rather than an aspect ratio, and that is the point of it: the
 * covers are portrait, square and landscape depending on who photographed which
 * book, and a grid where every tile is a different height is the ragged shelf
 * the framing above is meant to fix. `contentFit="contain"` inside a fixed box
 * is what makes eleven different shapes sit on one line.
 */
const COVER_HEIGHT = 168;

export function Book({
  product,
  inCart,
  editing,
  onOpen,
  onAdd,
}: {
  product: ShopProduct;
  inCart: number;
  /**
   * The shop is being stocked rather than shopped.
   *
   * The card keeps its shape — same cover, same title, same price — and swaps
   * the one control at its foot. Add becomes a stepper, because counting a
   * shelf is the job somebody does eleven times in a row and it should not cost
   * eleven dialogs. Everything else about a book is a tap away in its sheet.
   */
  editing: boolean;
  onOpen: () => void;
  onAdd: () => void;
}) {
  const theme = useTheme();
  const soldOut = product.stockCount === 0;

  /*
   * Read on every card, in both modes, rather than only while editing.
   *
   * A hook cannot be called conditionally, and the alternative — a separate
   * component mounted only in edit mode — would leave the "Edited" mark with
   * nowhere to live, since it belongs on the cover beside "sold out". The cost
   * is that every card re-renders when any held edit changes; the shop is
   * eleven titles, so that is a measurement nobody will ever take.
   */
  const pending = usePendingEdit(product.slug, {
    stockCount: product.stockCount ?? null,
    section: product.section ?? null,
  });

  return (
    /*
     * The gutter between columns, as padding inside a half-width cell rather
     * than a gap on the list. `FlashList`'s grid has no column gap of its own,
     * and margin on the card would leave the outer edges narrower than the
     * middle — which reads as the shelf being off-centre.
     */
    <View style={{ flex: 1, padding: theme.space.xs }}>
      {/*
        Lifted off the page rather than ruled off it.
        ------------------------------------------------------------------------
        This was a hairline border and no shadow, which is the finish the rest of
        the app uses — `Card` in `Surface.tsx` — and is right there: a card that
        holds a paragraph of the church's own words should sit *on* the paper,
        because it is paper. A book is an object on a shelf. Twenty-two of them
        outlined in the same hairline read as a table with the lines half rubbed
        out, and the thing a shopper is actually scanning — where one cover ends
        and the next begins — is the one thing the hairline states weakly.

        The border is kept underneath the shadow rather than dropped, because
        Android draws nothing from `shadowOpacity` and would otherwise get a
        shelf of cards with no edges at all. On iOS it disappears under the
        shadow's own darkening at the card's foot, which is where it would have
        been doing the least work anyway.

        Two views and not one, which is not a spare wrapper: `overflow: hidden`
        sets `masksToBounds` on the layer it is written on, and a layer that
        masks to its bounds clips its own shadow — the card would come out with
        the border it started with and nothing else. So the shadow is on the
        outer view and the clipping, which the cover's square corners need, is
        on the inner one.
      */}
      <View
        style={{
          flex: 1,
          borderRadius: theme.radius.md,
          backgroundColor: theme.color.paperRaised,
          /*
           * Native shadow properties rather than a theme token, because the
           * church's three shadows live under `web` in the theme document and
           * `resolveTheme` does not carry them into the resolved theme this app
           * reads. The values are `shadowSm`'s intent — a close, soft lift —
           * and the colour is the theme's.
           */
          shadowColor: theme.color.ink,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
          elevation: 2,
        }}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: theme.color.paperRaised,
            borderColor: theme.color.rule,
            borderWidth: 1,
            borderRadius: theme.radius.md,
            overflow: 'hidden',
          }}
        >
          <Pressable
            onPress={onOpen}
            accessibilityRole="button"
            /*
             * The whole card announced as one thing, because that is what it is.
             * Read piecemeal it is "image, Be Prepared, eight dollars" with no
             * sentence tying them together, and the price is the part most likely
             * to be missed.
             */
            accessibilityLabel={`${product.name}, ${money(product.amount, product.currency)}${
              soldOut ? ', sold out' : !editing && inCart > 0 ? `, ${inCart} in basket` : ''
            }${editing && pending.dirty ? ', edited' : ''}`}
            accessibilityHint={editing ? 'Opens this book’s settings' : 'Opens the book'}
            style={({ pressed }) => ({
              padding: theme.space.sm,
              gap: theme.space.xs,
              backgroundColor: pressed ? theme.color.paperSunken : 'transparent',
            })}
          >
            <View>
              <Cover
                slug={product.slug}
                fallback={product.images[0] ?? null}
                height={COVER_HEIGHT}
                live={editing}
              />

              {/*
              Only ever drawn when there is something to say. A badge that is
              usually blank is furniture — which is why this is a ternary and
              not two independent conditions.
            */}
              {editing && pending.dirty ? (
                <Flag label="Edited" tone="in" />
              ) : soldOut ? (
                <Flag label="Sold out" tone="out" />
              ) : !editing && inCart > 0 ? (
                <Flag label={`${inCart} in basket`} tone="in" />
              ) : null}
            </View>

            {/*
            Clamped at three lines. Square's longest title runs to five, and a
            card that grows to fit it drags the whole row down with it; the
            whole of the title is in the sheet this opens.
          */}
            <Small numberOfLines={3}>{product.name}</Small>
          </Pressable>

          {/*
          The foot, pushed to the bottom so the prices line up across a row
          whose titles are one, two and three lines long. `marginTop: 'auto'`
          against the card's `flex: 1` is what does it.
        */}
          <View
            style={{
              marginTop: 'auto',
              paddingHorizontal: theme.space.sm,
              paddingBottom: theme.space.sm,
              gap: theme.space.xs,
            }}
          >
            {/*
            The price stays even when the book does not: a sold-out title still
            costs what it costs, and the flag on the cover is what says it is
            gone.

            `ink` and not `inkSoft`, and above the title's own weight rather
            than below it. The price was the quietest line on the card, under a
            three-line title and over a button — and the price is the second
            thing anybody wants off a shelf, after which book it is. Softening
            it was treating it as metadata.
          */}
            <Body color={theme.color.ink}>{money(product.amount, product.currency)}</Body>

            {editing ? (
              <ShelfStock product={product} pending={pending} />
            ) : soldOut ? (
              <Micro color={theme.color.inkFaint}>Unavailable</Micro>
            ) : (
              /*
               * Filled, and it used to be outlined.
               *
               * An outlined button in the church's red on a cream card is the
               * *quiet* tone from `Surface.tsx` — the one the app uses for "go
               * back", "cancel", "all forms". Add to basket is the opposite kind
               * of thing: it is the one action the whole screen exists to offer,
               * and it was wearing the finish reserved for the ones that undo.
               *
               * The plus glyph is what makes it legible at this width. "Add
               * another" is fifteen characters in a 160pt card and wrapped to two
               * lines; the glyph plus a count says the same thing in a third of
               * the room, and says it the way a basket does.
               */
              <Pressable
                onPress={onAdd}
                accessibilityRole="button"
                accessibilityLabel={
                  inCart > 0 ? `Add another ${product.name}` : `Add ${product.name} to the basket`
                }
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: theme.space.xs,
                  borderRadius: theme.radius.full,
                  backgroundColor: pressed ? theme.color.accentStrong : theme.color.accent,
                  // Below the 44pt minimum on purpose, and the only control in
                  // the app that is: two of these sit in a row on a 390pt screen,
                  // and at 44 the card is taller than the cover it is selling.
                  // The card itself is the large target — this is the smaller,
                  // more specific one inside it, which is the arrangement the
                  // guideline is about rather than one it forbids.
                  minHeight: 36,
                })}
              >
                <Icon name="plus" color={theme.color.inkInverse} size={14} />
                <Micro color={theme.color.inkInverse}>{inCart > 0 ? 'Another' : 'Add'}</Micro>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

/**
 * The badge over the corner of a cover.
 *
 * Two tones and no third: "sold out" is the shop refusing, "in basket" is the
 * shop confirming, and they never appear together because a sold-out book
 * cannot be added. Hidden from assistive technology because both sentences are
 * already in the card's own label — announced here too they would be read
 * twice, once out of order.
 */
function Flag({ label, tone }: { label: string; tone: 'out' | 'in' }) {
  const theme = useTheme();

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        position: 'absolute',
        left: theme.space.xs,
        bottom: theme.space.xs,
        paddingVertical: 2,
        paddingHorizontal: theme.space.xs,
        borderRadius: theme.radius.full,
        backgroundColor: tone === 'out' ? theme.color.deep : theme.color.accent,
      }}
    >
      <Micro color={theme.color.inkInverse}>{label}</Micro>
    </View>
  );
}

/**
 * The count, on the card, while the shop is being stocked.
 *
 * ---------------------------------------------------------------------------
 * The fast path, and the only editing control that lives on the shelf.
 *
 * Everything else about a book — its title, its price, its pictures, its
 * category, whether it is on the shop at all — is a tap away in the book's own
 * sheet, where there is room to see what you are changing. Counting is
 * different: it is done to a whole shelf at once, standing at the bookstore
 * table with the books in front of you, and eleven dialogs to type eleven
 * numbers is the arrangement a stepper exists to replace.
 *
 * It holds rather than writes. Six presses on one card is one number on the
 * save bar, not six calls to Square's inventory API.
 *
 * ## Why the arrows cannot reach "not counted"
 *
 * `null` is not a number below zero. It means Square is not tracking this title
 * — which is most of the church's catalog — and it is a different state from
 * `0`, which is sold out and takes the book off the shop. A stepper that fell
 * off the bottom into `null` would turn "we sold the last one" into "stop
 * counting these", silently, at exactly the moment somebody is counting. So the
 * switch below is the only way in or out of it.
 * ---------------------------------------------------------------------------
 */
function ShelfStock({
  product,
  pending,
}: {
  product: ShopProduct;
  pending: ReturnType<typeof usePendingEdit>;
}) {
  const theme = useTheme();
  const count = pending.stockCount;

  if (count === null) {
    return (
      <Pressable
        onPress={() => pending.setStock(0)}
        accessibilityRole="button"
        accessibilityLabel={`Start counting copies of ${product.name}`}
        style={({ pressed }) => ({
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: theme.radius.sm,
          borderWidth: 1,
          borderColor: theme.color.rule,
          backgroundColor: pressed ? theme.color.accentSoft : 'transparent',
          minHeight: 36,
        })}
      >
        <Micro color={theme.color.inkSoft}>Not counted</Micro>
      </Pressable>
    );
  }

  return (
    <View style={{ gap: 2 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderRadius: theme.radius.sm,
          borderWidth: 1,
          borderColor: theme.color.rule,
          overflow: 'hidden',
        }}
      >
        <Nudge
          icon="close"
          label={`One fewer ${product.name}`}
          disabled={count === 0}
          onPress={() => pending.nudge(-1)}
        />
        <View style={{ flex: 1, alignItems: 'center' }}>
          {/* `aria-live`'s equivalent: the number is what changed, and a
              volunteer pressing + without looking should hear it. */}
          <Small
            accessibilityLiveRegion="polite"
            color={count === 0 ? theme.color.accent : theme.color.ink}
          >
            {count}
          </Small>
        </View>
        <Nudge
          icon="plus"
          label={`One more ${product.name}`}
          disabled={false}
          onPress={() => pending.nudge(1)}
        />
      </View>

      <Pressable
        onPress={() => pending.setStock(null)}
        accessibilityRole="button"
        accessibilityLabel={`Stop counting copies of ${product.name}`}
        hitSlop={theme.space.xs}
        style={{ alignItems: 'center', paddingVertical: 2 }}
      >
        <Micro color={theme.color.inkFaint}>
          {count === 0 ? 'sold out · stop counting' : 'stop counting'}
        </Micro>
      </Pressable>
    </View>
  );
}

/**
 * One arrow of the shelf stepper.
 *
 * 36pt tall for the same reason the Add button it replaces is: two cards sit in
 * a row on a 390pt screen, and at 44 the card is taller than the cover it is
 * selling. The card itself remains the large target.
 */
function Nudge({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: 'plus' | 'close';
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => ({
        width: 40,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.35 : 1,
        backgroundColor: pressed && !disabled ? theme.color.accentSoft : 'transparent',
      })}
    >
      <Icon name={icon} color={theme.color.ink} size={14} />
    </Pressable>
  );
}
