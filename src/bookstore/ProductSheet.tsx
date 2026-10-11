/**
 * One book, opened.
 *
 * The website's `Detail` dialog. The reason it is a dialog rather than a route
 * is the same on both surfaces and is worth repeating: these books have no page
 * of their own. There is one paragraph of description and a price behind each,
 * which is not a page's worth of content — a route per product would be eleven
 * more screens that each say four lines, and on a phone it would also cost the
 * shopper their place on the shelf every time they looked at something.
 *
 * What is dropped from the website's version is the magnifier. It zooms the
 * cover 2.6× under the pointer, which is a gesture a phone does not have; the
 * plate here is simply larger than the one on the card, which is most of what
 * the zoom was for.
 */
import { useState } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { MAX_QUANTITY, clearanceOf } from '@spsm/shared';

import { Button } from '@/components/Surface';
import { Close, Sheet } from '@/components/Fields';
import { Body, Heading, Label, Micro, Small } from '@/components/Type';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/theme/ThemeProvider';

import { Cover } from './Cover';
import { PriceTag } from './PriceTag';
import { cartKey, type Cart } from './cart';
import { soldOutOf, type ShopProduct } from './data';

export function ProductSheet({
  product,
  cart,
  canEdit,
  onEdit,
  onBump,
  onClose,
}: {
  /** Null when nothing is open. */
  product: ShopProduct | null;
  /** The whole basket, so a size already in it counts against what is left. */
  cart: Cart;
  /**
   * Whoever may edit the shop gets a way from the item to its settings — the
   * phone's version of the website's "an item opens from the list or the
   * shelf", since the editor is a sheet over the shelf rather than a column
   * beside it.
   */
  canEdit: boolean;
  onEdit: (product: ShopProduct) => void;
  /** Add to, or take from, a basket line, by its key. */
  onBump: (key: string, by: number) => void;
  onClose: () => void;
}) {
  /*
   * Unmounted rather than held open-but-empty, as `EventSheet` does it: a
   * `Modal` carries its own visibility, and a sheet with nothing in it is a
   * sheet that can be opened by a bug. It also resets the gallery's page and the
   * chosen size, which is what stops a second item opening on the first one's
   * third photograph, or in the first one's size.
   */
  if (product === null) return null;

  return (
    <Opened
      key={product.slug}
      product={product}
      cart={cart}
      canEdit={canEdit}
      onEdit={onEdit}
      onBump={onBump}
      onClose={onClose}
    />
  );
}

function Opened({
  product,
  cart,
  canEdit,
  onEdit,
  onBump,
  onClose,
}: {
  product: ShopProduct;
  cart: Cart;
  canEdit: boolean;
  onEdit: (product: ShopProduct) => void;
  onBump: (key: string, by: number) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const [size, setSize] = useState<string | null>(null);

  const soldOut = soldOutOf(product);
  const sale = clearanceOf({ wasPriceCents: product.wasPriceCents, amountCents: product.amount });
  const clothing = product.sizes !== null;
  const chosen = size ? product.sizes?.find((one) => one.label === size) : undefined;
  const key = cartKey(product.slug, chosen?.label ?? null);
  const inCart = clothing && !chosen ? 0 : (cart[key] ?? 0);
  /* No more of a size than there are on hand; twenty is the basket's own
     ceiling for anything. */
  const ceiling = Math.min(MAX_QUANTITY, chosen ? chosen.count : MAX_QUANTITY);
  const atCeiling = inCart >= ceiling;

  return (
    <Sheet
      open
      onClose={onClose}
      label={product.name}
      header={
        <View style={{ flexDirection: 'row', gap: theme.space.sm }}>
          <View style={{ flex: 1, gap: theme.space.xs }}>
            <Label>Bookstore</Label>
            <Heading>{product.name}</Heading>
          </View>
          <Close onPress={onClose} what={product.name} />
        </View>
      }
    >

      <Gallery product={product} />

      <View style={{ gap: theme.space.xs }}>
        <Body color={theme.color.ink}>
          <PriceTag product={product} size={size} />
        </Body>
        {sale ? <Label color={theme.color.accent}>{`Clearance — ${sale.percentOff}% off`}</Label> : null}
        {clothing ? (
          <SizeStock
            soldOut={soldOut}
            chosen={chosen ?? null}
            room={chosen ? Math.max(0, chosen.count - inCart) : null}
          />
        ) : (
          <Stock count={product.stockCount} />
        )}
        {/* Under the stock line, small: the number somebody reads out when
            they ring the office about a book, and the one on the till. Absent
            until the catalog sync has numbered it. */}
        {product.sku ? <Micro color={theme.color.inkFaint}>SKU {product.sku}</Micro> : null}
      </View>

      {/*
        Where Square carries one. Nine of the church's eleven titles have no
        description at all, and an empty paragraph reads better than an invented
        one — so there is no "No description available" line here.
      */}
      {product.description !== '' ? (
        <Body color={theme.color.inkSoft}>{product.description}</Body>
      ) : null}

      {/*
        Sizes, as a row of buttons. One with none left stays on the row, struck
        through, so somebody looking for their size learns it is gone rather
        than wondering whether it was ever made.
      */}
      {clothing && !soldOut ? (
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel="Size"
          style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.xs }}
        >
          {product.sizes?.map((one) => (
            <SizePick
              key={one.label}
              label={one.label}
              on={size === one.label}
              gone={one.count <= 0}
              onPress={() => setSize(one.label)}
            />
          ))}
        </View>
      ) : null}

      {soldOut ? (
        <View style={{ gap: theme.space.xs }}>
          <Small color={theme.color.inkSoft}>
            This one has sold out. The bookstore table after Liturgy sometimes has copies the
            shop does not.
          </Small>
        </View>
      ) : clothing && !chosen ? (
        <Button label="Choose a size" onPress={() => {}} disabled />
      ) : inCart === 0 ? (
        <Button
          label="Add to basket"
          onPress={() => onBump(key, 1)}
          disabled={ceiling === 0}
        />
      ) : (
        <View style={{ gap: theme.space.xs }}>
          <Stepper
            quantity={inCart}
            onBump={(by) => onBump(key, by)}
            atCeiling={atCeiling}
            what={chosen ? `${product.name}, size ${chosen.label}` : product.name}
          />
          {atCeiling && ceiling === MAX_QUANTITY ? (
            <Micro color={theme.color.inkFaint}>
              {MAX_QUANTITY} is the most the shop takes in one order. For more than that, ask
              the bookstore.
            </Micro>
          ) : null}
        </View>
      )}

      {canEdit ? (
        <Button label="Edit this item" tone="quiet" onPress={() => onEdit(product)} />
      ) : null}
    </Sheet>
  );
}

/**
 * The stock line for clothing, which is about the chosen size — the website's
 * five sentences, in its order.
 */
function SizeStock({
  soldOut,
  chosen,
  room,
}: {
  soldOut: boolean;
  chosen: { label: string; count: number } | null;
  /** How many more of the chosen size can go in the basket. */
  room: number | null;
}) {
  const theme = useTheme();

  if (soldOut) return <Small color={theme.color.accent}>Out of stock</Small>;
  if (!chosen) return <Small color={theme.color.inkSoft}>Choose a size</Small>;
  if (room === 0) {
    return <Small color={theme.color.accent}>{`Every ${chosen.label} left is in your basket`}</Small>;
  }
  if (chosen.count <= 5) {
    return (
      <Small color={theme.color.accentStrong}>{`Only ${chosen.count} left in ${chosen.label}`}</Small>
    );
  }
  return <Small color={theme.color.inkSoft}>{`${chosen.label} in stock`}</Small>;
}

/** One size: outlined, filled when chosen, struck through when none are left. */
function SizePick({
  label,
  on,
  gone,
  onPress,
}: {
  label: string;
  on: boolean;
  gone: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={gone}
      accessibilityRole="radio"
      accessibilityState={{ checked: on, disabled: gone }}
      accessibilityLabel={gone ? `${label}, sold out` : label}
      style={({ pressed }) => ({
        minWidth: 48,
        minHeight: 44,
        paddingHorizontal: theme.space.sm,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.radius.sm,
        borderWidth: 1,
        borderColor: on ? theme.color.accent : pressed ? theme.color.accent : theme.color.rule,
        backgroundColor: on ? theme.color.accent : theme.color.paper,
        opacity: gone ? 0.6 : 1,
      })}
    >
      <Small color={on ? theme.color.inkInverse : gone ? theme.color.inkFaint : theme.color.ink}>
        <Text style={gone ? { textDecorationLine: 'line-through' } : undefined}>{label}</Text>
      </Small>
    </Pressable>
  );
}

/**
 * What the shop knows about how many are left.
 *
 * Three states and not two. `null` is *not tracked* — the church has not told
 * Square to count this title — and it is deliberately silent rather than
 * claiming availability, because "In stock" is a promise nobody made. `0` is
 * sold out. A small number is worth saying; a large one is not, because "37 in
 * stock" in a church bookstore reads as a warehouse.
 */
function Stock({ count }: { count: number | null }) {
  const theme = useTheme();

  if (count === null) return null;
  if (count === 0) return <Small color={theme.color.accent}>Sold out</Small>;
  if (count <= 3) {
    return (
      <Small color={theme.color.accentStrong}>
        {count === 1 ? 'Last copy' : `Only ${count} left`}
      </Small>
    );
  }
  return <Small color={theme.color.inkSoft}>In stock</Small>;
}

/** Minus, a count, plus. The one control that changes a quantity in place. */
function Stepper({
  quantity,
  onBump,
  atCeiling,
  what,
}: {
  quantity: number;
  onBump: (by: number) => void;
  atCeiling: boolean;
  what: string;
}) {
  const theme = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderColor: theme.color.rule,
        borderRadius: theme.radius.sm,
        overflow: 'hidden',
      }}
    >
      <Step
        icon="close"
        label={quantity === 1 ? `Remove ${what} from the basket` : `One fewer ${what}`}
        onPress={() => onBump(-1)}
        disabled={false}
      />
      <View style={{ minWidth: 48, alignItems: 'center' }}>
        <Small>{quantity}</Small>
      </View>
      <Step
        icon="plus"
        label={`One more ${what}`}
        onPress={() => onBump(1)}
        disabled={atCeiling}
      />
    </View>
  );
}

function Step({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: 'plus' | 'close';
  label: string;
  onPress: () => void;
  disabled: boolean;
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
        width: 48,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.4 : 1,
        backgroundColor: pressed && !disabled ? theme.color.accentSoft : 'transparent',
      })}
    >
      <Icon name={icon} color={theme.color.ink} size={16} />
    </Pressable>
  );
}

/**
 * Every photograph of this book, one at a time.
 *
 * No item in the church's catalog carries a second photograph today, so this
 * renders as a plain plate and hides its dots and arrows — the same behaviour
 * the website's gallery has, and for the same reason: a pager with one page is
 * a control that says the shop is broken. Adding a photo in Square lights the
 * rest up with no change here.
 */
function Gallery({ product }: { product: ShopProduct }) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);

  const images = product.images;
  /*
   * Clamped rather than trusted. `page` is reset by this component unmounting
   * with the sheet, but the catalog is a live subscription — a volunteer
   * removing a photograph in Square while somebody has the third one open
   * would otherwise index past the end of the array.
   */
  const at = Math.min(page, Math.max(0, images.length - 1));

  /*
   * Tall enough to be worth opening the sheet for, and bounded by the window so
   * a plate never pushes the price and the Add button off the bottom of a small
   * phone. The sheet scrolls, but a shopper should not have to scroll to find
   * out what something costs.
   *
   * A cap on the height only. The width is the sheet's, all of it — see below.
   */
  const height = Math.min(320, Math.round(width * 0.8));

  const plate = (
    <Cover
      slug={product.slug}
      name={product.name}
      index={at}
      fallback={images[at] ?? null}
      height={height}
      /* Square, because it runs into the corners of the sheet now, and the
         sheet has its own radius and clips to it. */
      radius={0}
    />
  );

  /*
   * Out through the scroller's padding, so the picture is the full width of the
   * sheet and sits flush under the title rather than inset on three sides.
   *
   * The negative margins are the whole of the trick, and they belong here
   * rather than on `Sheet`: every other sheet in the app is text and controls,
   * which want that padding. `space.md` is the scroller's horizontal padding
   * and `space.sm` the top one it uses when a header is pinned, which this
   * sheet always passes — so both numbers are read off `Fields.tsx` rather than
   * chosen, and anything that stops being the first child here loses the top.
   */
  const bleed = {
    marginHorizontal: -theme.space.md,
    marginTop: -theme.space.sm,
  } as const;

  if (images.length <= 1) return <View style={bleed}>{plate}</View>;

  return (
    <View style={{ ...bleed, gap: theme.space.sm }}>
      {plate}

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.space.sm,
        }}
      >
        <Pressable
          onPress={() => setPage((current) => Math.max(0, current - 1))}
          disabled={page === 0}
          accessibilityRole="button"
          accessibilityLabel="Previous photograph"
          accessibilityState={{ disabled: page === 0 }}
          hitSlop={theme.space.sm}
          style={{ opacity: page === 0 ? 0.3 : 1, padding: theme.space.xs }}
        >
          <Icon name="prev" color={theme.color.ink} size={18} />
        </Pressable>

        <Micro color={theme.color.inkFaint}>
          {at + 1} of {images.length}
        </Micro>

        <Pressable
          onPress={() => setPage((current) => Math.min(images.length - 1, current + 1))}
          disabled={page === images.length - 1}
          accessibilityRole="button"
          accessibilityLabel="Next photograph"
          accessibilityState={{ disabled: page === images.length - 1 }}
          hitSlop={theme.space.sm}
          style={{ opacity: page === images.length - 1 ? 0.3 : 1, padding: theme.space.xs }}
        >
          <Icon name="next" color={theme.color.ink} size={18} />
        </Pressable>
      </View>
    </View>
  );
}
