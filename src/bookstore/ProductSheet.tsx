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
import { Pressable, View, useWindowDimensions } from 'react-native';
import { MAX_QUANTITY, type BookstoreSection } from '@spsm/shared';

import { Button } from '@/components/Surface';
import { Close, Sheet } from '@/components/Fields';
import { Body, Heading, Label, Micro, Small } from '@/components/Type';
import { Icon } from '@/components/Icon';
import { money } from '@/payments/money';
import { useTheme } from '@/theme/ThemeProvider';

import { Cover } from './Cover';
import { ProductSettings } from './admin/ProductSettings';
import type { ShopProduct } from './data';

export function ProductSheet({
  product,
  inCart,
  editing,
  sections,
  onBump,
  onClose,
}: {
  /** Null when nothing is open. */
  product: ShopProduct | null;
  inCart: number;
  /**
   * The shop is being stocked, so this sheet is also the book's settings.
   *
   * The same dialog either way, deliberately. It already shows this book at
   * full size and nothing else, it is opened on purpose, and closing it puts
   * you back on the shelf exactly where you were — which is the whole of what
   * the website's rejected properties column could not do. What edit mode adds
   * is a block below the shopper's half, not a different screen.
   */
  editing: boolean;
  sections: BookstoreSection[];
  onBump: (by: number) => void;
  onClose: () => void;
}) {
  const theme = useTheme();

  /*
   * Unmounted rather than held open-but-empty, as `EventSheet` does it: a
   * `Modal` carries its own visibility, and a sheet with nothing in it is a
   * sheet that can be opened by a bug. It also resets the gallery's page, which
   * is what stops a second book opening on the first one's third photograph.
   */
  if (product === null) return null;

  const soldOut = product.stockCount === 0;
  const atCeiling = inCart >= MAX_QUANTITY;

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

      <Gallery product={product} live={editing} />

      <View style={{ gap: theme.space.xs }}>
        <Body color={theme.color.ink}>{money(product.amount, product.currency)}</Body>
        <Stock count={product.stockCount} />
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
        The basket controls are hidden while editing, and that is not tidiness.
        Adding a book to a basket you are not going to buy, on the screen where
        you are deciding whether that book should exist, is a press with no
        meaning — and `Add to basket` sitting directly above `Remove from the
        shop` is two buttons that must never be adjacent.
      */}
      {editing ? null : soldOut ? (
        <View style={{ gap: theme.space.xs }}>
          <Small color={theme.color.inkSoft}>
            This one has sold out. The bookstore table after Liturgy sometimes has copies the
            shop does not.
          </Small>
        </View>
      ) : inCart === 0 ? (
        <Button label="Add to basket" onPress={() => onBump(1)} />
      ) : (
        <View style={{ gap: theme.space.xs }}>
          <Stepper
            quantity={inCart}
            onBump={onBump}
            atCeiling={atCeiling}
            what={product.name}
          />
          {atCeiling ? (
            <Micro color={theme.color.inkFaint}>
              {MAX_QUANTITY} is the most the shop takes in one order. For more than that, ask
              the bookstore.
            </Micro>
          ) : null}
        </View>
      )}

      {editing ? (
        <ProductSettings product={product} sections={sections} onRemoved={onClose} />
      ) : null}
    </Sheet>
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
function Gallery({ product, live }: { product: ShopProduct; live: boolean }) {
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
   */
  const height = Math.min(320, Math.round(width * 0.8));

  const plate = (
    <Cover
      slug={product.slug}
      index={at}
      fallback={images[at] ?? null}
      height={height}
      radius={theme.radius.md}
      /* The photograph on this plate is the one being judged while editing, so
         it has to be Square's own rather than the website's baked copy. */
      live={live}
    />
  );

  if (images.length <= 1) return plate;

  return (
    <View style={{ gap: theme.space.sm }}>
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
