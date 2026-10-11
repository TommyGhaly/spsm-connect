/**
 * The bookstore: a shelf, a detail sheet, and a basket.
 *
 * The website's `Shop` rearranged for a phone, and the three things that moved
 * are all consequences of the screen being 390 points wide rather than 1200.
 *
 * ## One grid, and pills that narrow it
 *
 * Kept exactly as the website settled it, because the instruction behind it was
 * about shoppers rather than about layout — *"after separating into categories
 * the store should still show all of the options but there should be category
 * pills under the search bar that the user can use to filter"*. Stacking a
 * heading per section makes the shop longer with every category the church
 * adds, and a shopper who does not know which heading a title sits under has to
 * scan all of them. That cost is worse on a phone, not better.
 *
 * `groupProducts` does the work, unchanged and shared with the website, because
 * its three rules are the ones a pill row needs: an empty category is dropped,
 * a book whose category was deleted falls into the catch-all rather than off
 * the shop, and no categories at all means no divisions.
 *
 * The categories are Square's subcategories of "Bookstore" now, and Square
 * nests them — so the row shows the top level, and choosing a category that
 * has subcategories opens a second row of them beneath it ("Books" → "Arabic
 * books", "English books"), as the website does. A category's pill holds
 * everything filed in it *or anywhere beneath it*, and a book can sit in
 * several.
 *
 * ## The basket is a bar at the bottom, not a button at the top
 *
 * The website puts it in the head beside the search. Here it is a pinned bar
 * above the tab bar, and it only exists when there is something in it. Two
 * reasons: the top-right corner of this screen already belongs to the
 * announcements bell on every other screen in the app, and the bottom of a
 * phone is where a thumb is. An empty shop showing a zero reads like a broken
 * counter, so there is nothing there until a book is put in it.
 *
 * ## A `FlashList`, for the one thing a `ScrollView` cannot do
 *
 * Eleven products do not need recycling and a `ScrollView` would render them
 * fine. What it cannot do is tell which covers have actually been *seen* —
 * `onViewableItemsChanged` is the native equivalent of the `IntersectionObserver`
 * the website counts views with, and a shelf that recorded a view for every
 * product the moment the tab opened would make the "most viewed" table a list
 * of everything in the shop, in stock order.
 */
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  DEFAULT_BOOKSTORE_CONFIG,
  UNSORTED_LABEL,
  childSections,
  clearanceOf,
  groupProducts,
  type BookstoreConfig,
} from '@spsm/shared';

import { Icon } from '@/components/Icon';
import { Body, Heading, Label, Micro, Small } from '@/components/Type';
import { Card } from '@/components/Surface';
import { Problem } from '@/components/Fields';
import { money } from '@/payments/money';
import { useTheme } from '@/theme/ThemeProvider';

import { BasketSheet } from './BasketSheet';
import { Book } from './Book';
import { ProductSheet } from './ProductSheet';
import { AdminFab } from '@/components/AdminFab';
import { ShopEditor } from './admin/ShopEditor';
import { PendingEditsProvider } from './admin/pendingEdits';
import { useBookstoreAdmin } from './admin/session';
import { inCartOf, useCart } from './cart';
import { matches, soldOutOf, watchCatalog, type Catalog, type ShopProduct } from './data';
import { trackProduct, trackSearch } from './track';

/** The pill row's own shape: a section, or the catch-all, or "All". */
interface Pill {
  id: string | null;
  label: string;
  count: number;
}

/**
 * Half of a card has to be on screen to count as seen.
 *
 * A module constant, not an inline object, and that is not tidiness: the
 * underlying list treats `viewabilityConfig` as fixed for its lifetime and
 * throws on a changed one — a fresh literal every render is a changed one.
 *
 * 50% because the default fires on a single pixel, which counts the row below
 * the fold that every shopper stops just above.
 */
const VIEWABILITY = { itemVisiblePercentThreshold: 50 } as const;

/**
 * How much room the shelf keeps clear at its foot for the basket bar.
 *
 * The bar's own height plus the gap it sits in. Written here rather than
 * measured, because the whole point is that it does not change with the bar
 * appearing — see `shelfPadding`.
 */
const BASKET_BAR_SPACE = 72;

/**
 * How tall one plate of the loading shelf is.
 *
 * A real card, measured: `COVER_HEIGHT` is 190, and the title's three possible
 * lines, the price, the Add button and the footer's padding come to the hundred
 * points under it. It only has to be close — the point is that the grid does
 * not resize when the covers land, and a plate a few points out is invisible
 * against one that is not there yet.
 */
const SKELETON_CARD = 290;

/**
 * The shop, and the held edits the editor may be carrying.
 *
 * The provider sits above the editor rather than inside it so that the item's
 * held edits and the refusal a Save comes back with outlive whichever view of
 * the editor is open. Leaving the editor with something held is refused, so it
 * never carries anything while the editor is shut.
 *
 * It costs one context with an empty object in it for a parishioner who will
 * never touch it.
 */
export function ShopScreen() {
  const [refused, setRefused] = useState<string | null>(null);

  return (
    <PendingEditsProvider onError={setRefused}>
      <Shelf refused={refused} onDismissRefusal={() => setRefused(null)} />
    </PendingEditsProvider>
  );
}

function Shelf({
  refused,
  onDismissRefusal,
}: {
  /** What the last Save came back with, if it came back badly. */
  refused: string | null;
  onDismissRefusal: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { canReview, canEdit } = useBookstoreAdmin();
  /**
   * The editor, and which item it opens on. Null is shut.
   *
   * Shown only while `canEdit`, evaluated here rather than trusted from state:
   * a grant read that lands late, or one revoked while somebody has the tab
   * open, must take the editor away rather than leave a sheet of writes that
   * Firestore will refuse.
   */
  const [editor, setEditor] = useState<{ start: string | null } | null>(null);
  const editing = editor !== null && canEdit;

  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(
    () =>
      watchCatalog(
        (next) => {
          setCatalog(next);
          // Cleared on any successful snapshot: a shop that reconnected should
          // not keep a stale sentence about being offline above it.
          setFailed(null);
        },
        (error) => setFailed(error.message),
      ),
    [],
  );

  /*
   * The defaults until the first snapshot lands, and the last good catalog
   * afterwards — never emptied by a failure. See `watchCatalog`.
   *
   * Memoised rather than written as a bare `?? []`, because a fresh empty array
   * every render is a changed dependency every render, and three `useMemo`s
   * below hang off this one.
   */
  const products = useMemo<ShopProduct[]>(() => catalog?.products ?? [], [catalog]);
  const settings: BookstoreConfig = catalog?.settings ?? DEFAULT_BOOKSTORE_CONFIG;

  const basket = useCart(products);

  const [term, setTerm] = useState('');
  /** Which pill is chosen. `undefined` is "All", which is not a section id. */
  const [pill, setPill] = useState<string | null | undefined>(undefined);
  const [open, setOpen] = useState<ShopProduct | null>(null);
  const [basketOpen, setBasketOpen] = useState(false);
  /*
   * The Clearance toggle: on top of whichever category is chosen, not instead
   * of one, so "Clearance" with "Books" lit is the books on sale — the
   * website's rule.
   */
  const [clearanceOnly, setClearanceOnly] = useState(false);

  /*
   * Matched on the title, the description and the SKU on every keystroke. Eleven books
   * need no index, no debounce and no request — the whole catalog is in memory,
   * and a search that waits to filter a list this size feels broken.
   */
  const needle = term.trim().toLowerCase();
  const shown = useMemo(
    () => (needle ? products.filter((product) => matches(product, needle)) : products),
    [products, needle],
  );

  /*
   * The search is recorded when somebody stops typing, not per keystroke.
   *
   * Filtering happens per keystroke because the catalog is tiny, but recording
   * per keystroke would file "b", "bi", "bib", "bibl", "bible" as five separate
   * searches — and the four prefixes would swamp the one thing the person
   * actually looked for. Nine hundred milliseconds of stillness is the closest
   * this gets to "they finished typing" without a submit button.
   *
   * Whether it found anything is a dependency rather than something read out of
   * a ref when the timer fires, which means a catalog snapshot landing mid-wait
   * re-arms the timer. That is the right way round: `searchZero` is the closest
   * thing the church has to a request list, and recording "nobody sells this"
   * against a search that had in fact just matched a newly published book would
   * put a title on that list that is already on the shelf.
   */
  const foundNothing = shown.length === 0;

  useEffect(() => {
    if (!needle) return;
    const settle = setTimeout(() => trackSearch(needle, foundNothing), 900);
    return () => clearTimeout(settle);
  }, [needle, foundNothing]);

  /*
   * Applied to the whole catalog rather than to the search results, so the
   * pills and their counts stay put while somebody types instead of
   * rearranging under their finger.
   */
  const groups = useMemo(
    () => groupProducts(products, settings.sections),
    [products, settings.sections],
  );

  /*
   * The row a shopper sees: every category the church has made, in order,
   * whether or not anything is filed under it.
   *
   * Drawn from `sections` rather than from `groups`, which drops empty ones —
   * a category that exists, can be chosen in the editor, and is invisible here
   * with nothing to say why is the bug the website hit and fixed. A category
   * with nothing in it shows a `0` and leads to the "Nothing in this category"
   * line, which is a truthful answer rather than a missing control.
   *
   * The catch-all keeps the opposite rule — it exists only when something is
   * actually unfiled, because "Everything else (0)" describes nothing.
   */
  const countOf = useMemo(
    () => new Map(groups.map((group) => [group.id, group.items.length])),
    [groups],
  );

  const rowPills = useMemo<Pill[]>(() => {
    // The top level only; a chosen category's subcategories get their own row.
    const row: Pill[] = childSections(settings.sections, null).map((section) => ({
      id: section.id,
      label: section.label,
      count: countOf.get(section.id) ?? 0,
    }));

    const unfiled = groups.find((group) => group.id === null);
    if (unfiled)
      row.push({
        id: null,
        label: UNSORTED_LABEL,
        count: unfiled.items.length,
      });

    return row;
  }, [groups, countOf, settings.sections]);

  /*
   * A pill that stops existing — its category deleted, or its last unfiled book
   * put away — must not leave the shop filtered to nothing with no way back.
   *
   * Derived here rather than corrected in an effect, which is what this was
   * first. The effect version renders once with the dead filter still applied
   * before the correction lands, and on a live subscription that frame is real:
   * a volunteer deleting a category in the admin panel would see the shelf go
   * empty and then refill. Falling back during render means there is no such
   * frame, and `pill` is left alone so that a category deleted and immediately
   * restored puts the shopper back where they were.
   */
  const shelfPill =
    pill === undefined ||
    (pill === null
      ? groups.some((group) => group.id === null)
      : settings.sections.some((section) => section.id === pill))
      ? pill
      : undefined;

  /*
   * The second row.
   *
   * Choosing a category that has subcategories opens a row of them; choosing a
   * subcategory keeps its siblings showing, so moving between "Arabic books"
   * and "English books" is one press rather than a trip back up. `topOf` is
   * which top-level pill stays lit while a subcategory is chosen — the
   * website's rule, and the thing that says where in the tree you are.
   *
   * Only subcategories with something in them, unlike the top row: a second
   * row of zeros under a category is a row that says nothing.
   */
  const sections = settings.sections;
  const parentOf = useCallback(
    (id: string) => sections.find((one) => one.id === id)?.parentId ?? null,
    [sections],
  );
  const topOf = useCallback(
    (id: string): string => {
      let at = id;
      for (let hops = 0; parentOf(at) && hops < 16; hops += 1) at = parentOf(at)!;
      return at;
    },
    [parentOf],
  );
  const subParent =
    typeof shelfPill === 'string'
      ? childSections(sections, shelfPill).length > 0
        ? shelfPill
        : parentOf(shelfPill)
      : null;
  const subPills = useMemo<Pill[]>(
    () =>
      subParent
        ? childSections(sections, subParent)
            .map((section) => ({
              id: section.id,
              label: section.label,
              count: countOf.get(section.id) ?? 0,
            }))
            .filter((one) => one.count > 0)
        : [],
    [subParent, sections, countOf],
  );

  /*
   * Everything marked down that can still be bought, deepest discount first —
   * what the Clearance toggle shows. The toggle exists only while there is
   * something in it, and says how deep the discounts go.
   */
  const onSale = useMemo(
    () =>
      products
        .map((product) => ({
          product,
          sale: clearanceOf({ wasPriceCents: product.wasPriceCents, amountCents: product.amount }),
        }))
        .filter((one) => one.sale && !soldOutOf(one.product))
        .sort((a, b) => (b.sale?.percentOff ?? 0) - (a.sale?.percentOff ?? 0))
        .map((one) => one.product),
    [products],
  );
  const deepest = onSale.reduce(
    (most, product) =>
      Math.max(
        most,
        clearanceOf({ wasPriceCents: product.wasPriceCents, amountCents: product.amount })
          ?.percentOff ?? 0,
      ),
    0,
  );
  // Nothing left on sale: the toggle goes, and must not leave the shelf empty.
  // Derived rather than reset in an effect, for the reason `shelfPill` gives.
  const clearanceOn = clearanceOnly && onSale.length > 0;

  const shelf = useMemo(() => {
    // In the toggle's own order, deepest discount first.
    const base = clearanceOn ? onSale.filter((product) => shown.includes(product)) : shown;
    if (shelfPill === undefined) return base;
    const inPill = new Set(
      (groups.find((group) => group.id === shelfPill)?.items ?? []).map((item) => item.slug),
    );
    return base.filter((product) => inPill.has(product.slug));
  }, [shown, groups, shelfPill, clearanceOn, onSale]);

  /*
   * Covers counted once per session, not once per scroll past.
   *
   * `onViewableItemsChanged` fires every time a card crosses the threshold, so
   * scrolling up and down the shelf would record the same book a dozen times
   * and make "most viewed" a measure of fidgeting. The website has the same
   * problem with its observer and solves it the same way — `trackViewOnce`
   * there, this set here.
   */
  const seen = useRef(new Set<string>());
  const onViewable = useCallback(({ viewableItems }: { viewableItems: { item?: unknown }[] }) => {
    for (const entry of viewableItems) {
      const product = entry.item as ShopProduct | undefined;
      if (!product?.slug || seen.current.has(product.slug)) continue;
      seen.current.add(product.slug);
      trackProduct('view', product.slug);
    }
  }, []);

  /*
   * The shelf's padding, and it reserves room for the basket bar whether or not
   * there is one.
   *
   * No horizontal padding, and that is deliberate: the covers run to both edges
   * of the screen. A grid of pictures inside a gutter is a grid with a frame
   * drawn round it, and on a 390pt phone that frame costs two books most of a
   * centimetre of cover each — the one thing on this screen anybody is actually
   * looking at. The gutter has not been deleted so much as moved down a level:
   * the header, the foot and the empty states carry it themselves, because a
   * search field or a paragraph of small print flush to the bezel reads as a
   * layout that has come apart rather than as a full-bleed shelf.
   *
   * This was conditional — `+ 72` only once something was in the basket — which
   * is the tighter layout and was wrong. Changing a list's content padding makes
   * it re-measure, and the shelf visibly jumped down about a row the instant the
   * first book was added: the card you had just pressed Add on was no longer
   * under your finger. That is the same failure the website's admin drawer notes
   * describe about panels laid out in the flow, arriving by a different route.
   *
   * Reserving it always costs 72 points of empty paper below the last row of an
   * empty basket, at the bottom of something that scrolls. Nobody will ever see
   * it without looking for it, and it buys a shelf that never moves on its own.
   */
  const shelfPadding = useMemo(
    () => ({
      paddingTop: theme.space.gutter,
      paddingBottom: insets.bottom + theme.space.xl + BASKET_BAR_SPACE,
    }),
    [theme.space.gutter, theme.space.xl, insets.bottom],
  );

  /*
   * The opened book, re-read from the live catalog rather than from the object
   * that was captured when it was tapped.
   *
   * The sheet is where a title, a price and a description are edited, and the
   * value that comes back from Square arrives through the subscription — so a
   * captured copy would leave the sheet showing what the book *was* while the
   * shelf behind it showed what it is. It also closes the sheet by itself when
   * a book is archived: an unpublished product leaves `products`, this goes
   * null, and `ProductSheet` unmounts rather than sitting there with controls
   * that all now fail.
   */
  const opened = useMemo(
    () => (open ? (products.find((one) => one.slug === open.slug) ?? null) : null),
    [open, products],
  );

  /**
   * How an order reaches somebody, and what happens if it arrives wrong —
   * together, at the foot of the shelf.
   *
   * ---------------------------------------------------------------------------
   * Both used to be above the fold: the collection note in this screen's header,
   * on the argument that somebody deciding whether to order at all needs to know
   * they can collect it after Liturgy; the returns policy in the basket, on the
   * argument that a policy met on the receipt is one nobody agreed to.
   *
   * The website had them the same way round and Tommy moved them, and the reason
   * the old placement was wrong is the same for both and reads worse on a phone
   * than it did on a page: they are three lines of small print between the
   * shop's name and a single book. A shop that opens with terms is a shop
   * bracing for a complaint — and on a 390pt screen those three lines were
   * pushing the first row of covers most of the way off the top.
   *
   * Anybody who wants either can scroll to the end, which on this shelf is a
   * flick. Plain text and not links, for the reason the website gives: the whole
   * of it is a few sentences, and a policy behind a press is a policy nobody has
   * read.
   *
   * The website's version carries a "Check an order" link beside the collection
   * note. There is nothing to link to here — order lookup is a website screen,
   * reached from a receipt — so it is left out rather than pointed at a browser.
   * ---------------------------------------------------------------------------
   */
  const foot =
    settings.fulfilmentNote !== '' || settings.returnsNotice !== '' ? (
      <View
        style={{
          gap: theme.space.xs,
          paddingHorizontal: theme.space.gutter,
          paddingTop: theme.space.lg,
        }}
      >
        {settings.fulfilmentNote !== '' ? (
          <Small color={theme.color.inkSoft}>{settings.fulfilmentNote}</Small>
        ) : null}
        {settings.returnsNotice !== '' ? (
          <Micro color={theme.color.inkFaint}>{settings.returnsNotice}</Micro>
        ) : null}
      </View>
    ) : null;

  const openDetail = useCallback((product: ShopProduct) => {
    setOpen(product);
    // A much stronger signal than a view, and the one the metrics screen leads
    // with. Recorded here rather than inside the sheet so that the sheet stays
    // a renderer and cannot double-count on a re-render.
    trackProduct('detail', product.slug);
  }, []);

  /** Whether the basket is along the bottom. */
  const showBasketBar = basket.count > 0;

  /** A card's Add: straight into the basket, or for clothing, to the size picker. */
  const addFromCard = useCallback(
    (product: ShopProduct) => {
      if (product.sizes) openDetail(product);
      else basket.bump(product.slug, 1);
    },
    [openDetail, basket],
  );

  /**
   * What the Manage pill says and offers, decided once and drawn in one of two
   * places.
   *
   * The props rather than the element, because the two placements are two
   * different parents — a child of `BottomBar`, or an overlay of its own — and
   * an element cannot be moved between them without React unmounting it and
   * with it the sheet it may have open. Spreading the same object into both
   * keeps the menu one list in one place, which is the thing that would
   * otherwise be copied and then edited in only one of the copies.
   */
  const manage: Pick<ComponentProps<typeof AdminFab>, 'label' | 'actions'> | null = canReview
    ? {
        label: 'Manage',
        actions: [
          /*
           * Orders first, because it is what somebody opens this tab for on a
           * Monday morning and it has nothing to do with editing the shop.
           */
          { label: 'Orders', onPress: () => router.push('/bookstore/orders' as never) },
          { label: 'Figures', onPress: () => router.push('/bookstore/metrics' as never) },
          // Only the people the rules will let write see the way in. Items,
          // categories and settings are all inside it, as on the website.
          ...(canEdit ? [{ label: 'Edit the shop', onPress: () => setEditor({ start: null }) }] : []),
        ],
      }
    : null;

  const header = (
    /* The gutter, now that the list has none. `PillRow` cancels it again with
       its own negative margin so that the pills still run off both edges — it
       was written against a padded list and this is the same measurement, just
       taken one view further in. */
    <View
      style={{
        gap: theme.space.md,
        paddingHorizontal: theme.space.gutter,
        paddingBottom: theme.space.md,
      }}
    >
      {/* What the last Save came back with, once the editor that sent it is
          shut — while it is open, the editor says it. */}
      {refused && !editing ? (
        <Pressable
          onPress={onDismissRefusal}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        >
          <Problem>
            <Body color={theme.color.ink}>{refused}</Body>
          </Problem>
        </Pressable>
      ) : null}

      <SearchBar
        value={term}
        onChange={setTerm}
        placeholder={
          products.length > 0 ? `Search ${products.length} titles` : 'Search the bookstore'
        }
      />

      {rowPills.length > 0 || onSale.length > 0 ? (
        <PillRow
          pills={rowPills}
          chosen={shelfPill}
          lit={typeof shelfPill === 'string' ? topOf(shelfPill) : shelfPill}
          onChoose={setPill}
          lead={
            /* First, and in the accent: it is the row's one advertisement. */
            onSale.length > 0 ? (
              <ClearancePill
                on={clearanceOn}
                deepest={deepest}
                count={onSale.length}
                onPress={() => setClearanceOnly(!clearanceOn)}
              />
            ) : null
          }
        />
      ) : null}

      {/* "All" on this row is everything in the parent category. */}
      {subParent && subPills.length > 0 ? (
        <PillRow
          pills={subPills}
          chosen={shelfPill}
          lit={shelfPill}
          all={{ id: subParent, count: countOf.get(subParent) ?? 0 }}
          onChoose={setPill}
        />
      ) : null}

      {failed ? (
        <Problem>
          <Body color={theme.color.ink}>
            The shop could not be reached, so this may be out of date. {failed}
          </Body>
        </Problem>
      ) : null}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.paper }}>
      <FlashList
        data={shelf}
        keyExtractor={(product) => product.slug}
        numColumns={2}
        ListHeaderComponent={header}
        /* Drawn under an empty shelf too. The notes are about the shop, not
           about the books in it, and a search that matched nothing is exactly
           when somebody wonders whether to ask at the table instead. */
        ListFooterComponent={foot}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={VIEWABILITY}
        contentContainerStyle={shelfPadding}
        ListEmptyComponent={
          <Empty
            loading={catalog === null && failed === null}
            searching={needle !== ''}
            filtered={shelfPill !== undefined}
            clearance={clearanceOn}
            onClear={() => {
              setTerm('');
              setPill(undefined);
              setClearanceOnly(false);
            }}
          />
        }
        renderItem={({ item, index }) => (
          <Book
            product={item}
            inCart={inCartOf(basket.cart, item.slug)}
            /* Which side of the seam this card is on. The column count lives
               here, so the answer is worked out here too. */
            atRightEdge={index % 2 === 1}
            onOpen={() => openDetail(item)}
            onAdd={() => addFromCard(item)}
          />
        )}
      />

      {/*
        The office's controls, in the corner rather than across the top of the
        shelf — the same move the forms hub, the ministry directory and every
        gallery page made. A visitor used to scroll past "Orders · Figures ·
        Edit shop" to reach the books.

        With the basket, on its line, at the right end of it — which is what
        Tommy asked for and what `BottomBar` exists to lay out. Otherwise, its
        own corner.
      */}
      {showBasketBar ? (
        <BottomBar>
          <View style={{ flex: 1 }}>
            <BasketBar
              count={basket.count}
              subtotal={basket.subtotal}
              onPress={() => setBasketOpen(true)}
            />
          </View>
          {manage ? <AdminFab {...manage} placement="inline" /> : null}
        </BottomBar>
      ) : manage ? (
        <AdminFab {...manage} />
      ) : null}

      <ProductSheet
        product={opened}
        cart={basket.cart}
        canEdit={canEdit}
        onEdit={(product) => {
          setOpen(null);
          setEditor({ start: product.slug });
        }}
        onBump={basket.bump}
        onClose={() => setOpen(null)}
      />

      <BasketSheet
        open={basketOpen}
        basket={basket}
        settings={settings}
        products={products}
        onClose={() => setBasketOpen(false)}
        onOpenProduct={(product) => {
          setBasketOpen(false);
          openDetail(product);
        }}
      />

      {editing ? (
        <ShopEditor
          products={products}
          settings={settings}
          start={editor.start}
          refused={refused}
          onDismissRefusal={onDismissRefusal}
          onClose={() => setEditor(null)}
        />
      ) : null}
    </View>
  );
}

/**
 * The category filters, in a row that scrolls sideways.
 *
 * ## It used to wrap, and the comment here already said it should not
 *
 * This note has claimed "a row that scrolls sideways" since the shop was built,
 * and the code under it was `flexWrap: 'wrap'` — thirteen pills on a 390pt
 * screen is three rows, so the filters were about a hundred points tall and the
 * first row of covers started below the fold. A shop whose first screen is
 * chrome is a shop nobody scrolls.
 *
 * Sideways costs the thing wrapping bought: you can no longer see every
 * category at once. That is the right trade here because the pills are already
 * ordered by the church — `settings.sections`, in the order the category editor
 * put them — so what is off the right edge is what the church thought mattered
 * least, and a row that visibly runs off the edge says there is more of it.
 *
 * A `FlashList` rather than a `ScrollView` would be machinery for a row of a
 * dozen or so pills — the top level of the tree, or one category's children.
 * This is the one place in the shop where a plain horizontal scroller is right.
 *
 * The same component draws both rows; `all` and `lit` are the only
 * difference between them.
 */
function PillRow({
  pills,
  chosen,
  lit,
  all,
  onChoose,
  lead,
}: {
  pills: Pill[];
  chosen: string | null | undefined;
  /**
   * Which pill is drawn as on. The chosen one, except on the top row while a
   * subcategory is chosen — there it is the subcategory's top-level ancestor,
   * so the row still says which category you are inside.
   */
  lit: string | null | undefined;
  /**
   * What "All" means on this row. Absent on the top row, where it is the whole
   * shop; on a subcategory row it is the parent category, with its count.
   */
  all?: { id: string; count: number };
  onChoose: (id: string | null | undefined) => void;
  /** Drawn before "All" — the Clearance toggle, on the top row. */
  lead?: ReactNode;
}) {
  const theme = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      /*
       * Out to the screen's edges and back again.
       *
       * The row sits inside the shelf's gutter, so left alone it would stop a
       * gutter short of each edge — and a scroller that ends in a margin reads
       * as a row that has finished rather than one with more in it. The
       * negative margin cancels the gutter and the padding puts it back inside
       * the content, which is how a pill runs off the edge of the glass and
       * still lines up with the covers below it when the row is short.
       */
      style={{ marginHorizontal: -theme.space.gutter }}
      contentContainerStyle={{
        paddingHorizontal: theme.space.gutter,
        gap: theme.space.xs,
        // The lifted pills cast a shadow, and a scroller clips to its bounds.
        paddingVertical: 2,
      }}
    >
      {lead}
      <PillButton
        label="All"
        count={all ? all.count : null}
        on={chosen === (all ? all.id : undefined)}
        onPress={() => onChoose(all ? all.id : undefined)}
      />
      {pills.map((entry) => (
        <PillButton
          key={entry.id ?? '·unfiled'}
          label={entry.label}
          count={entry.count}
          on={lit === entry.id}
          onPress={() => onChoose(entry.id)}
        />
      ))}
    </ScrollView>
  );
}

/**
 * One filter.
 *
 * The chosen one is *filled* with the church's red and wears white, rather than
 * being the pale-pink-on-outline it was. A tinted outline among outlines is a
 * difference somebody has to look for; at a glance a row of thirteen
 * near-identical pills with one slightly pinker one reads as no filter applied
 * at all — which matters because the shelf below it is lying about how much the
 * shop has in it.
 */
function PillButton({
  label,
  count,
  on,
  onPress,
}: {
  label: string;
  count: number | null;
  on: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      // `selected` rather than a label saying "selected": the state belongs in
      // the state, where a screen reader announces it in its own words.
      accessibilityState={{ selected: on }}
      accessibilityLabel={count === null ? label : `${label}, ${count}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.xs,
        paddingVertical: theme.space.xs,
        paddingHorizontal: theme.space.md,
        borderRadius: theme.radius.full,
        borderWidth: 1,
        borderColor: on ? theme.color.accent : theme.color.rule,
        backgroundColor: on
          ? pressed
            ? theme.color.accentStrong
            : theme.color.accent
          : pressed
            ? theme.color.paperSunken
            : theme.color.paperRaised,
        minHeight: 36,
      })}
    >
      <Small color={on ? theme.color.inkInverse : theme.color.inkSoft}>{label}</Small>
      {count !== null ? (
        <Micro color={on ? theme.color.inkInverse : theme.color.inkFaint}>{count}</Micro>
      ) : null}
    </Pressable>
  );
}

/**
 * The Clearance toggle — "up to N% off" and a count — leading the category row.
 *
 * Outlined in the accent while off so it reads as an offer, filled when on like
 * any chosen pill: the website's `.shop-filter--sale`. It narrows the shelf to
 * what is marked down, deepest discount first, on top of whichever category is
 * chosen, and it exists only while something is on sale.
 */
function ClearancePill({
  on,
  deepest,
  count,
  onPress,
}: {
  on: boolean;
  deepest: number;
  count: number;
  onPress: () => void;
}) {
  const theme = useTheme();
  const ink = on ? theme.color.inkInverse : theme.color.accent;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={`Clearance${deepest > 0 ? `, up to ${deepest}% off` : ''}, ${count}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.xs,
        paddingVertical: theme.space.xs,
        paddingHorizontal: theme.space.md,
        borderRadius: theme.radius.full,
        borderWidth: 1,
        borderColor: theme.color.accent,
        backgroundColor: on
          ? pressed
            ? theme.color.accentStrong
            : theme.color.accent
          : pressed
            ? theme.color.accentSoft
            : theme.color.paperRaised,
        minHeight: 36,
      })}
    >
      <Small color={ink}>Clearance</Small>
      {deepest > 0 ? <Micro color={ink}>{`up to ${deepest}% off`}</Micro> : null}
      <Micro color={on ? theme.color.inkInverse : theme.color.inkFaint}>{count}</Micro>
    </Pressable>
  );
}

/**
 * The search box, as a shop's rather than as a form's.
 *
 * `Field` is what this was, and `Field` is right for the eleven other things it
 * is used for: a floating label, a hint line, an error slot, a 44pt box with a
 * rule under it. None of that belongs on the one control at the top of a shop.
 * A search box needs to say "search" without spending a line of type on it,
 * which is what the magnifier does, and it needs a way out of a term that
 * matched nothing, which is what the cross does — clearing a search was a
 * matter of eleven backspaces before.
 *
 * Not lifted into `Fields.tsx`, because it has exactly one caller and the
 * things that make it right here — the pill shape, the sunken ground, no label
 * — are all the shop's own.
 */
function SearchBar({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
}) {
  const theme = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.xs,
        paddingHorizontal: theme.space.md,
        borderRadius: theme.radius.full,
        backgroundColor: theme.color.paperSunken,
        borderWidth: 1,
        borderColor: theme.color.rule,
        minHeight: 44,
      }}
    >
      <Icon name="search" color={theme.color.inkFaint} size={18} />

      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={theme.color.inkFaint}
        accessibilityLabel="Search the bookstore"
        autoCapitalize="none"
        autoCorrect={false}
        // `search` rather than `done`: the keyboard's own return key should say
        // what pressing it does, and the filtering is already live.
        returnKeyType="search"
        clearButtonMode="never"
        style={{
          flex: 1,
          paddingVertical: theme.space.sm,
          fontFamily: theme.fontFamily.ui,
          fontSize: theme.fontSize.body,
          color: theme.color.ink,
        }}
      />

      {value !== '' ? (
        <Pressable
          onPress={() => onChange('')}
          accessibilityRole="button"
          accessibilityLabel="Clear the search"
          hitSlop={theme.space.sm}
        >
          <Icon name="close" color={theme.color.inkSoft} size={16} />
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * The bar that appears once there is something to pay for.
 *
 * Laid out by `BottomBar` rather than by itself, and it used to position
 * itself: `position: absolute` across the full width, with the Manage pill
 * floating 72 points above it. Tommy: *"I want the manage button to be at the
 * same level as the cart, the cart should move a little to the left."* Two
 * overlays stacked in the one corner a thumb reaches was the thing to fix —
 * they are one row now, the basket taking the width that is left and the pill
 * sitting beside it. So this is the bar itself and nothing about where it goes;
 * see `BottomBar`, which is where the overlay decision lives for both of them.
 *
 * It stays an overlay rather than becoming the list's last row, for the reason
 * the website's admin drawer gives: a bar in the flow would move every book on
 * the shelf by its own height the moment the first one was added, so the thing
 * you were looking at is somewhere else immediately after you press Add.
 */
function BasketBar({
  count,
  subtotal,
  onPress,
}: {
  count: number;
  subtotal: number;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Basket, ${count} ${count === 1 ? 'item' : 'items'}, ${money(subtotal)}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.sm,
        paddingVertical: theme.space.sm,
        paddingHorizontal: theme.space.md,
        borderRadius: theme.radius.md,
        backgroundColor: pressed ? theme.color.accentStrong : theme.color.accent,
        minHeight: 52,
      })}
    >
      <Icon name="bag" color={theme.color.inkInverse} size={20} />
      <View style={{ flex: 1 }}>
        <Small color={theme.color.inkInverse}>
          {count} {count === 1 ? 'item' : 'items'}
        </Small>
      </View>
      <Small color={theme.color.inkInverse}>{money(subtotal)}</Small>
      <Icon name="arrow" color={theme.color.inkInverse} size={18} />
    </Pressable>
  );
}

/**
 * The one strip along the foot of the shop, and everything that lives in it.
 *
 * There were two overlays here and they each chose their own corner: the
 * basket bar across the full width at `insets.bottom + sm`, and the Manage
 * pill in the bottom-right at `space.lg`, lifted by a hand-written 72 points
 * so it cleared the bar. That is two answers to one question, and they only
 * agreed by arithmetic.
 *
 * ## The pill does not move, and the numbers here are why
 *
 * The first version of this row put itself where the *basket* used to be —
 * `insets.bottom + sm` — which quietly made the Manage pill rise and fall by
 * eighteen points depending on whether anything was in the basket. Tommy:
 * *"make the manage button stationary in the bookstore screen, just lower the
 * checkout button to match it rather than moving the manage button."* Right,
 * and it was the wrong half that moved: the pill is on every screen in the app
 * and in the same corner on all of them, so it is the fixed thing and the
 * basket is the visitor.
 *
 * So the row takes **the pill's own two insets** — `space.gutter` from the
 * right and `space.lg` from the bottom, which is exactly what `AdminFab` uses
 * when it places itself in the corner. With `alignItems: 'flex-end'` the
 * pill's bottom edge is the row's bottom edge, so an inline pill lands on the
 * same pixel as a corner one and there is nothing to keep in step by hand: the
 * two states are the same two numbers.
 *
 * The basket is what changes, in both directions — down eighteen points to
 * this line, and in from the right by the pill's width. Which is the trade
 * asked for, and the right one: a bar that is one of several things on a shelf
 * should sit on the shelf.
 *
 * `box-none` so the strip's own box — as wide as the screen, and taller than
 * the pill — does not swallow a tap meant for the book underneath it.
 */
function BottomBar({ children }: { children: ReactNode }) {
  const theme = useTheme();

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: theme.space.gutter,
        right: theme.space.gutter,
        bottom: theme.space.lg,
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: theme.space.sm,
      }}
    >
      {children}
    </View>
  );
}

/**
 * What an empty shelf says, which depends on why it is empty.
 *
 * Four different situations and four different sentences, because "No products"
 * under a search box that has just been typed into is a shop that looks broken
 * rather than one that has nothing matching "bibel".
 */
function Empty({
  loading,
  searching,
  filtered: inCategory,
  clearance,
  onClear,
}: {
  loading: boolean;
  searching: boolean;
  filtered: boolean;
  /** The Clearance toggle is on. */
  clearance: boolean;
  onClear: () => void;
}) {
  const filtered = inCategory || clearance;
  const theme = useTheme();

  /*
   * The shape of the shelf, before the shelf.
   * --------------------------------------------------------------------------
   * This was the sentence "Opening the shop…", centred, on an otherwise blank
   * screen. The sentence is not wrong, it is just the wrong *kind* of thing:
   * the catalog is one Firestore snapshot away and arrives in a few hundred
   * milliseconds, so what a shopper sees is a flash of text and then a jump to
   * a full screen of covers. Two layouts in half a second reads as the app
   * having changed its mind.
   *
   * Six grey plates in the grid the covers will land in reads as the same
   * screen twice: nothing moves when the catalog arrives, it just fills in.
   * Six because that is a phone's worth and a bit — three rows of two, with the
   * third row cut off by the fold, which is what says the shelf continues.
   *
   * No shimmer. An animation here would be the only moving thing in the app
   * outside the camera, for a wait most people will never see, and a pulsing
   * grid is worse than a still one at the thing this is for — being ignored.
   */
  if (loading) {
    return (
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel="Opening the shop"
        style={{ flexDirection: 'row', flexWrap: 'wrap' }}
      >
        {[0, 1, 2, 3, 4, 5].map((plate) => (
          /* The grid the covers will land in, down to the joins: no radius,
             the seam down the middle drawn by the left-hand plate of each pair,
             and `space.xs` under every plate. A plate laid out differently from
             the card replacing it is the jump this whole component exists to
             prevent, and four points is enough to see. */
          <View
            key={plate}
            style={{
              width: '50%',
              height: SKELETON_CARD,
              marginBottom: theme.space.xs,
              backgroundColor: theme.color.paperSunken,
              borderColor: theme.color.rule,
              borderRightWidth: plate % 2 === 0 ? 1 : 0,
            }}
          />
        ))}
      </View>
    );
  }

  return (
    // Sentences rather than covers, so this takes the gutter back: a paragraph
    // that starts at the bezel is a paragraph that looks cut off.
    <View style={{ paddingHorizontal: theme.space.gutter }}>
      <Card gap={theme.space.sm}>
        <Label>{searching || filtered ? 'Nothing matching' : 'Nothing in the shop yet'}</Label>
        <Heading>
          {searching
            ? 'No book here by that name'
            : clearance
              ? 'Nothing here is on clearance'
              : filtered
                ? 'Nothing in this category'
                : 'The shelves are empty'}
        </Heading>
        <Body color={theme.color.inkSoft}>
          {searching || filtered
            ? 'Try the whole shop, or ask at the bookstore table after Liturgy — not everything the church has is listed here.'
            : 'Nothing has been put in the bookstore yet. It is worth looking again after Sunday.'}
        </Body>
        {searching || filtered ? (
          <Pressable
            onPress={onClear}
            accessibilityRole="button"
            style={{
              paddingVertical: theme.space.xs,
              minHeight: 44,
              justifyContent: 'center',
            }}
          >
            <Small color={theme.color.accent}>Show the whole shop</Small>
          </Pressable>
        ) : null}
      </Card>
    </View>
  );
}
