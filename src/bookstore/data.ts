/**
 * The catalog, as a phone reads it.
 *
 * ---------------------------------------------------------------------------
 * The website's arrangement, and why this is a third of the size of it.
 *
 * `/bookstore` is a static export. It reads the catalog at *build* time in
 * `features/bookstore/data.ts`, flattens it for the client in `shopData.ts`,
 * re-downloads every cover into `public/` as an optimised WebP pair, and then
 * runs `useLiveCatalog` at runtime to notice that any of it has gone stale —
 * plus `bakedFrom`, which exists solely to tell "nothing changed" from "the
 * photograph was replaced" without miscounting a book that had no picture.
 *
 * None of that is a design; all of it is the cost of prerendering. This app has
 * the Firestore SDK already open, so it subscribes to the collection and
 * renders what it says. There is no baked copy to go stale, so there is nothing
 * to reconcile it against, and `expo-image` has a real disk cache — which is
 * what `public/*.webp` was standing in for.
 *
 * What is deliberately kept is the *shape*: `ShopProduct` here holds the same
 * fields the website's does, minus the two about bundled files, so the grouping
 * (`groupProducts`) and the checkout body are the same on both surfaces.
 * ---------------------------------------------------------------------------
 *
 * Reads only. Nothing in this file writes, and nothing in it is gated: the
 * products rule is `allow read: if isPublished(resource.data)` and
 * `config/bookstore` is world-readable because the shop prints it. A signed-out
 * visitor can browse and buy, which is the whole point — sign-in here is
 * Microsoft-only and restricted to the church tenant, so most buyers have no
 * account and never will.
 */
import {
  collection,
  doc,
  getFirestore,
  onSnapshot,
  query,
  where,
} from '@react-native-firebase/firestore';
import {
  COLLECTIONS,
  sizesSoldOut,
  CONFIG_DOC_BOOKSTORE,
  DEFAULT_BOOKSTORE_CONFIG,
  cleanSizes,
  parseBookstoreConfig,
  type BookstoreConfig,
  type Product,
  type ProductSize,
} from '@spsm/shared';

/**
 * A product flattened for the shop.
 *
 * The website's `ShopProduct` without `cover`, `coverSrcSet`, `coverLarge` and
 * `bakedFrom` — four fields that describe files in its `public/` folder. Here
 * `images` is Square's own URLs, which is what the document holds.
 */
export interface ShopProduct {
  /** The Firestore document id, which is also the slug. */
  id: string;
  slug: string;
  name: string;
  description: string;
  /** Integer minor units, as everywhere else that touches money. */
  amount: number;
  currency: 'USD';
  /**
   * Every photograph Square holds for this book, in Square's order.
   *
   * One entry per book today — no item in the church's catalog carries a
   * second — so the detail sheet renders a single plate and hides its pager.
   * Adding a photo in Square lights the rest up with no change here.
   */
  images: string[];
  /** Null means "not tracked"; 0 means sold out and is not the same thing. */
  stockCount: number | null;
  /**
   * Which divisions of the shop this belongs in — Square's subcategories of
   * "Bookstore", by Square category id, mirrored by the catalog sync. Several
   * allowed, at any depth; empty is unfiled, not hidden.
   *
   * This replaced `section`, the parish's own single field, which neither
   * surface reads any more. Reading `section` after the shared rebuild would
   * have put every book under "Everything else", because `groupProducts` now
   * files by `categoryIds` alone.
   */
  categoryIds: string[];
  /** `SPSM-0007`, or null until the sync has numbered it. Square's, like the price. */
  sku: string | null;
  /** Ounces per copy, or null when nobody has weighed it. The parish's field. */
  weightOz: number | null;
  /** May go by USPS Media Mail — books and recorded media only. */
  mediaMail: boolean;
  /**
   * Sales tax applies. The parish's field, read by the checkout Function too —
   * which is why the basket can show the tax line Square is about to charge.
   * Absent on the document means false: nothing is taxed until somebody says so.
   */
  taxable: boolean;
  /**
   * The price before clearance, shown crossed out beside `amount`, or null.
   * The parish's field — Square holds only the price charged now. Read through
   * `clearanceOf`, which ignores it unless it is the higher of the two.
   */
  wasPriceCents: number | null;
  /**
   * Clothing sizes, cleaned by the same `cleanSizes` the checkout Function
   * charges from; null for anything that is not clothing. Counted on the
   * website's side, not in Square, so `stockCount` means nothing for these.
   */
  sizes: ProductSize[] | null;
}

function toShopProduct(id: string, raw: Product): ShopProduct {
  return {
    id,
    // `slug` is the document id by construction — `sync-catalog.mjs` writes it
    // as both — but a document hand-edited in the console could disagree, and
    // the checkout is keyed by slug. Prefer the field, fall back to the id.
    slug: typeof raw.slug === 'string' && raw.slug !== '' ? raw.slug : id,
    name: raw.name ?? '',
    description: raw.description ?? '',
    amount: raw.price?.amount ?? 0,
    currency: raw.price?.currency ?? 'USD',
    images: Array.isArray(raw.imagePaths) ? raw.imagePaths.filter((url) => typeof url === 'string') : [],
    stockCount: typeof raw.stockCount === 'number' ? raw.stockCount : null,
    categoryIds: Array.isArray(raw.categoryIds)
      ? raw.categoryIds.filter((id): id is string => typeof id === 'string')
      : [],
    sku: typeof raw.sku === 'string' && raw.sku !== '' ? raw.sku : null,
    weightOz: typeof raw.weightOz === 'number' ? raw.weightOz : null,
    // `=== true`, the website's rule: anything but an explicit yes is a no.
    mediaMail: raw.mediaMail === true,
    taxable: raw.taxable === true,
    wasPriceCents: typeof raw.wasPriceCents === 'number' ? raw.wasPriceCents : null,
    sizes: cleanSizes(raw.sizes),
  };
}

/** The shop as one object, so the two halves can never be rendered out of step. */
export interface Catalog {
  products: ShopProduct[];
  settings: BookstoreConfig;
}

/**
 * The catalog and the shop's settings, live.
 *
 * ## Two subscriptions, one callback
 *
 * `products` and `config/bookstore` are separate documents and arrive
 * separately, but they must never be *rendered* separately: the settings hold
 * the section list, so a render that had fresh sections and stale products
 * would file books under headings that no longer match them, and one that had
 * fresh products and stale sections would drop a whole shelf into "Everything
 * else". `groupProducts` is honest about a dangling section id — the book falls
 * into the unsorted group rather than vanishing — but a shop that reshuffles
 * itself twice on open still looks broken.
 *
 * So both are held here and the caller is called with the pair. It fires as
 * soon as *either* has arrived, using the committed defaults for the other,
 * which is the same trade the website makes: `DEFAULT_BOOKSTORE_CONFIG` is the
 * exact wording that used to be hard-coded, so a shop rendered a few hundred
 * milliseconds before its settings land reads correctly rather than blankly.
 *
 * ## Failure is the caller's to keep
 *
 * `onError` reports and does not clear. A dropped connection mid-service should
 * leave the last catalog on screen, not empty the shop — the same rule
 * `watchPublishedForms` states in `src/forms/data.ts`.
 */
export function watchCatalog(
  onCatalog: (catalog: Catalog) => void,
  onError: (error: Error) => void,
): () => void {
  const db = getFirestore();

  let products: ShopProduct[] | null = null;
  let settings: BookstoreConfig | null = null;

  const emit = () => {
    // Nothing to say until one of the two has landed. Firing with two defaults
    // would draw an empty shop over a connection that is merely slow.
    if (products === null && settings === null) return;
    onCatalog({
      products: products ?? [],
      settings: settings ?? DEFAULT_BOOKSTORE_CONFIG,
    });
  };

  const stopProducts = onSnapshot(
    query(collection(db, COLLECTIONS.products), where('published', '==', true)),
    (snapshot) => {
      products = snapshot.docs
        .map((entry) => toShopProduct(entry.id, entry.data() as Product))
        // Alphabetical, matching `getProducts` on the website. Within a section
        // this is the order the shelf shows, and Square has no opinion to
        // inherit — its catalog order is the order things were created in.
        .sort((a, b) => a.name.localeCompare(b.name));
      emit();
    },
    (error) => onError(error as Error),
  );

  const stopSettings = onSnapshot(
    doc(db, COLLECTIONS.config, CONFIG_DOC_BOOKSTORE),
    (snapshot) => {
      /*
       * `parseBookstoreConfig` falls back field by field rather than document
       * by document, so a half-written document contributes the fields it has.
       * A document that does not exist at all is the ordinary first state of a
       * church that has never opened the editor — it parses `null` to the
       * committed defaults, which is why this is not an error branch.
       */
      settings = parseBookstoreConfig(snapshot.exists() ? snapshot.data() : null);
      emit();
    },
    (error) => onError(error as Error),
  );

  return () => {
    stopProducts();
    stopSettings();
  };
}

/**
 * The shop's own search, over the fields a shopper would expect it to cover.
 *
 * Title, description and SKU, and nothing else. The SKU because it is the
 * number the office reads out on the phone and the till prints — "spsm-0007",
 * or just "0007", should find the book they mean. Not the section label — searching
 * "icons" should find the books *about* icons, not every product filed under an
 * Icons heading, and a shopper who wants the heading has a pill for it two
 * inches above the box.
 *
 * Matching is a plain case-folded substring. A church catalog is eleven titles;
 * anything cleverer would be tuned against a corpus that does not exist.
 */
export function matches(product: ShopProduct, term: string): boolean {
  const needle = term.trim().toLowerCase();
  if (needle === '') return true;
  return (
    product.name.toLowerCase().includes(needle) ||
    product.description.toLowerCase().includes(needle) ||
    (product.sku?.toLowerCase().includes(needle) ?? false)
  );
}

/** Nothing left to sell: no stock, or for clothing, no size with any. */
export function soldOutOf(product: ShopProduct): boolean {
  return product.sizes ? sizesSoldOut(product.sizes) : product.stockCount === 0;
}

/** One of it, in this size — the price plus whatever the size adds. */
export function unitOf(product: ShopProduct, size: string | null): number {
  return product.amount + (product.sizes?.find((one) => one.label === size)?.extraCents ?? 0);
}

/** A basket line's name, with its size when it has one. The website's wording. */
export function lineName(name: string, size: string | null): string {
  return size ? `${name} — size ${size}` : name;
}
