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
import { clearanceOf } from '@spsm/shared';

import { Icon } from '@/components/Icon';
import { Body, Label, Small, Micro } from '@/components/Type';
import { useTheme } from '@/theme/ThemeProvider';

import { Cover } from './Cover';
import { PriceTag, priceWords } from './PriceTag';
import { soldOutOf, type ShopProduct } from './data';

/**
 * How tall a cover is on the shelf.
 *
 * A fixed height rather than an aspect ratio, and that is the point of it: the
 * covers are portrait, square and landscape depending on who photographed which
 * book, and a grid where every tile is a different height is the ragged shelf
 * the framing above is meant to fix. `contentFit="cover"` inside a fixed box is
 * what makes eleven different shapes sit on one line.
 *
 * Kept near enough to square that the crop costs almost nothing on the covers
 * that were photographed square, which is most of them — so it is read off the
 * card's width and has moved twice for the same reason. 168 while the picture
 * sat inside the card's padding; 176 when it went full width of a card that was
 * still inside the shelf's gutter; 190 now that the shelf has no gutter and a
 * card is half of the screen, a little under 200 points on a 390pt phone.
 */
const COVER_HEIGHT = 190;

export function Book({
  product,
  inCart,
  atRightEdge,
  onOpen,
  onAdd,
}: {
  product: ShopProduct;
  /** Every size of it in the basket, added up. */
  inCart: number;
  /**
   * This card is in the right-hand column, so its right edge is the screen's.
   *
   * The one thing a card cannot work out for itself and the one thing it needs
   * to, now that the grid has no gaps: every card draws the rules on the two
   * sides that face a neighbour, and the last column has no neighbour to its
   * right — only the bezel. Passed as a boolean rather than the index it is
   * derived from, because two columns is the list's business and the card
   * should not have to know the number to know which side it is on.
   */
  atRightEdge: boolean;
  onOpen: () => void;
  /** Straight into the basket — or, for clothing, the caller opens the size picker. */
  onAdd: () => void;
}) {
  const theme = useTheme();
  const soldOut = soldOutOf(product);
  const sale = clearanceOf({ wasPriceCents: product.wasPriceCents, amountCents: product.amount });

  return (
    /*
     * Touching sideways, four points apart down the page.
     *
     * This started as `padding` on all four sides — the column gutter written
     * inside a half-width cell, because `FlashList`'s grid has no column gap of
     * its own and a margin would have left the outer edges narrower than the
     * middle — and it has come off in stages. The horizontal half went with the
     * list's side padding, so a row is now two covers meeting in the middle and
     * running out to both edges of the screen. The vertical half went with it
     * and then came back at `space.xs`, which is the smallest step the scale
     * has and about a millimetre on the glass.
     *
     * That asymmetry is the point rather than an oversight. Sideways there are
     * exactly two cards and the eye has the screen's own edges to measure them
     * against, so a drawn line is enough to say where one ends. Down the page
     * the covers keep coming, and a column of photographs separated only by a
     * hairline reads as one tall picture cut into strips — the gap is what says
     * these are separate objects. Four points does it without becoming a
     * margin: it reads as the shelf's own join, not as space around a card.
     */
    <View style={{ flex: 1, paddingBottom: theme.space.xs }}>
      {/*
        Ruled off the page, not lifted off it — which is where this started, and
        it is back because the gaps are gone.
        ------------------------------------------------------------------------
        The card carried a soft drop shadow for the reason it is worth writing
        down: a book is an object on a shelf rather than a paragraph of the
        church's own words, and twenty-two cards outlined in the same hairline
        read as a table with the lines half rubbed out. That argument held while
        every card sat in its own clear space. It does not survive the cards
        touching. A shadow needs paper to fall on, and with no gap there is
        none — each card's shadow lands on the card to its right and the card
        below it, in list order, so the shelf comes out with dark bands under
        and beside some books and not others depending on which was drawn last.
        An uneven grid is worse than an unlifted one.

        So: a flat card and a hairline, which is the finish `Card` in
        `Surface.tsx` uses, and which draws on Android too — `shadowOpacity`
        never did.

        The right edge only, and nothing on the other three. A rule is for a
        join with no gap in it, and the only join left without one is the seam
        down the middle of a row — under the card there is now four points of
        paper doing the same job, and a line drawn just above that gap is the
        join stated twice. One card draws the seam rather than both, because
        two adjacent cards each drawing their own edge makes it twice the
        weight of every other line on the shelf, and the right-hand column
        draws nothing at all: its right edge is the screen's, and a rule along
        the bezel is a rule around nothing.

        One view and not two: the pair existed because `overflow: hidden` sets
        `masksToBounds`, and a layer that masks to its bounds clips its own
        shadow — so the shadow needed a view outside the clipping one. With no
        shadow and no radius there is nothing to clip and nothing to protect.
      */}
      <View
        style={{
          flex: 1,
          backgroundColor: theme.color.paperRaised,
          borderColor: theme.color.rule,
          borderRightWidth: atRightEdge ? 0 : 1,
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
          accessibilityLabel={`${product.name}, ${priceWords(product)}${
            sale && !soldOut ? `, ${sale.percentOff}% off` : ''
          }${soldOut ? ', sold out' : inCart > 0 ? `, ${inCart} in basket` : ''}`}
          accessibilityHint="Opens the item"
          /*
            No padding, and that is the change. The cover used to sit inside
            `space.sm` on all four sides, so a card showed a frame of paper
            around a picture that was itself letterboxed on more paper. Two
            surrounds around one photograph is the catalogue look — a product
            floating in a tray — and the tray is what gets read first. The
            picture is the top edge of the card now, and the title, the price
            and Add are the footer under it.
          */
          style={({ pressed }) => ({
            backgroundColor: pressed ? theme.color.paperSunken : 'transparent',
          })}
        >
          <View>
            <Cover
              slug={product.slug}
              name={product.name}
              fallback={product.images[0] ?? null}
              height={COVER_HEIGHT}
              /*
                Square, like the card it is the top of. It was square before
                the card was, so as not to draw a second curve inside the
                card's own; there is no curve anywhere on the shelf now, so
                this is simply the shelf's finish.
              */
              radius={0}
            />

            {/*
            Only ever drawn when there is something to say. A badge that is
            usually blank is furniture — which is why this is a ternary and
            not two independent conditions.
          */}
            {soldOut ? (
              <Flag label="Sold out" tone="out" />
            ) : inCart > 0 ? (
              <Flag label={`${inCart} in basket`} tone="in" />
            ) : null}
            {/* The other corner from the basket flag, so both can be said at once. */}
            {sale && !soldOut ? <SaleFlag percentOff={sale.percentOff} /> : null}
          </View>

          {/*
          Clamped at three lines. Square's longest title runs to five, and a
          card that grows to fit it drags the whole row down with it; the
          whole of the title is in the sheet this opens.

          It carries the padding the press target no longer has: the title is
          the first line of the footer, so it lines up with the price and the
          button under it rather than with the picture above it.
        */}
          <View style={{ paddingHorizontal: theme.space.sm, paddingTop: theme.space.sm }}>
            <Small numberOfLines={3}>{product.name}</Small>
          </View>
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
            // The press target above ends at the last line of the title now
            // that it has no padding of its own, so the gap under it is this.
            paddingTop: theme.space.xs,
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
          <Body color={theme.color.ink}>
            <PriceTag product={product} />
          </Body>

          {soldOut ? (
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
                product.sizes
                  ? `Choose a size of ${product.name}`
                  : inCart > 0
                    ? `Add another ${product.name}`
                    : `Add ${product.name} to the basket`
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
              {product.sizes ? null : <Icon name="plus" color={theme.color.inkInverse} size={14} />}
              <Micro color={theme.color.inkInverse}>
                {product.sizes ? 'Choose size' : inCart > 0 ? 'Another' : 'Add'}
              </Micro>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

/**
 * The badge over the corner of a cover.
 *
 * "Sold out" is the shop refusing, "in basket" is the shop confirming, and they
 * never appear together because a sold-out book cannot be added. "% off" is
 * `SaleFlag`, in the opposite corner, so it can sit beside "in basket". Hidden from assistive technology because both sentences are
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
 * "25% off", top right, flush to the cover's edge and rounded only on the side
 * that faces into it — the website's `.book__sale`. Hidden from assistive
 * technology like `Flag`: the card's label already says it.
 */
function SaleFlag({ percentOff }: { percentOff: number }) {
  const theme = useTheme();

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        position: 'absolute',
        top: theme.space.sm,
        right: 0,
        paddingVertical: 2,
        paddingLeft: theme.space.xs,
        paddingRight: theme.space.sm,
        borderTopLeftRadius: theme.radius.full,
        borderBottomLeftRadius: theme.radius.full,
        backgroundColor: theme.color.accent,
      }}
    >
      <Label color={theme.color.inkInverse}>{`${percentOff}% off`}</Label>
    </View>
  );
}
