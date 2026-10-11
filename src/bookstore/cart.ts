/**
 * The basket: what is in it, how it survives being closed, and what it costs.
 *
 * A hook rather than a context, because there is exactly one consumer —
 * `ShopScreen` — and it passes what the sheets need down two levels. A provider
 * would be machinery for a tree that is three components deep.
 *
 * Persisted to `AsyncStorage` where the website persists to `localStorage`, and
 * under a key from the same family. They are *not* the same basket and cannot
 * be: a phone and a browser share no storage, and there is no account behind
 * most purchases to sync one through. Somebody who fills a basket on the
 * website and opens the app finds it empty, which is the ordinary behaviour of
 * every shop that has not asked you to sign in.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MAX_QUANTITY } from '@spsm/shared';

import { unitOf, type ShopProduct } from './data';
import { trackProduct } from './track';

/**
 * Basket key → quantity. Kept flat so it survives `JSON.stringify` unchanged.
 *
 * The key is the slug, or for clothing the slug and the size — `tee|M` — so two
 * sizes of one shirt are two lines. The website's key, character for character.
 * A basket saved before sizes existed is all plain slugs and reads as it did.
 */
export type Cart = Record<string, number>;

const CART_KEY = 'spsm.bookstore.cart';

export function cartKey(slug: string, size: string | null): string {
  return size ? `${slug}|${size}` : slug;
}

export function splitKey(key: string): { slug: string; size: string | null } {
  const at = key.indexOf('|');
  return at < 0 ? { slug: key, size: null } : { slug: key.slice(0, at), size: key.slice(at + 1) };
}

/** Every size of it in the basket, added up — what "in basket" on a card means. */
export function inCartOf(cart: Cart, slug: string): number {
  return Object.entries(cart).reduce(
    (sum, [key, quantity]) => (splitKey(key).slug === slug ? sum + quantity : sum),
    0,
  );
}

/** One basket row, resolved against the catalog. */
export interface CartLine {
  /** The basket key — what `bump` and `setQuantity` take. */
  key: string;
  product: ShopProduct;
  /** The size, for clothing; null for everything else. */
  size: string | null;
  quantity: number;
  /** One of it in this size: the price plus whatever the size adds. */
  unit: number;
}

export interface Basket {
  cart: Cart;
  /**
   * The rows, in catalog order, with anything the shop no longer sells dropped.
   *
   * Dropped rather than shown as unavailable, and it is worth being clear about
   * what that costs. A book withdrawn while it sat in somebody's basket simply
   * leaves, with nothing said. The alternative — a struck-through row and a
   * sentence — is more honest but needs the buyer to act on it before they can
   * pay, and the thing they would do is remove it. The Function refuses the
   * slug anyway (`buildSquareOrder` rejects `unknown` and `unpublished`), so
   * the money is never at risk either way; this is only about which of two
   * imperfect messages a shopper meets.
   *
   * A size the shirt no longer comes in — or a size on something that is not
   * clothing any more, or clothing with no size — is dropped for the same
   * reason: checkout would refuse it (`no-size`).
   */
  lines: CartLine[];
  /** Items, not rows: three copies of one title is three. */
  count: number;
  /** The items only. Delivery is added at checkout, where it is chosen. */
  subtotal: number;
  /** Add to, or take from, what is in the basket now, by basket key. */
  bump: (key: string, by: number) => void;
  /** Set an exact quantity, by basket key. Zero removes the row. */
  setQuantity: (key: string, quantity: number) => void;
  clear: () => void;
  /** False until storage has been read, so the first write cannot clobber it. */
  ready: boolean;
}

export function useCart(products: ShopProduct[]): Basket {
  const [cart, setCart] = useState<Cart>({});
  const [ready, setReady] = useState(false);

  /*
   * The basket, mirrored outside React state.
   *
   * ---------------------------------------------------------------------------
   * Ported from the website's `Shop`, where this ref is explained at length. The
   * reasoning survives the move to React Native unchanged, because both halves
   * of it are React's rather than the DOM's:
   *
   * **Batching.** React coalesces a fast run of presses into one render, so a
   * handler computing `(cart[slug] ?? 0) + 1` from the render's `cart` sees the
   * same stale count every time — five taps on + produce a basket of one. The
   * usual fix is to do the arithmetic inside the `setCart` updater.
   *
   * **Side effects.** But recording the change cannot happen inside that
   * updater. React invokes updaters more than once — twice under StrictMode,
   * and again whenever it replays a render — and an updater must be pure for
   * exactly that reason. Tracking from inside one doubled every cart figure on
   * the website, found by pressing Add three times and counting six events.
   *
   * So the running quantity lives here. The handler reads and updates it
   * synchronously — once per press, because an event handler is not replayed —
   * records the delta, and hands the result to `setCart`.
   * ---------------------------------------------------------------------------
   */
  const cartRef = useRef<Cart>({});

  /* Read storage once, on mount. */
  useEffect(() => {
    let live = true;

    void (async () => {
      try {
        const stored = await AsyncStorage.getItem(CART_KEY);
        if (live && stored) {
          const parsed: unknown = JSON.parse(stored);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            const clean = sanitise(parsed as Record<string, unknown>);
            // The ref is what the handlers read, so it has to be seeded too —
            // otherwise the first press after a relaunch computes its delta
            // against an empty basket and records an add for books already in
            // it.
            cartRef.current = clean;
            setCart(clean);
          }
        }
      } catch {
        // Unreadable or corrupt. An empty basket is a recoverable state and a
        // shop that will not open is not.
      }
      if (live) setReady(true);
    })();

    return () => {
      live = false;
    };
  }, []);

  /* Write it back, but never before it has been read. */
  useEffect(() => {
    if (!ready) return;
    // Not awaited and failures swallowed: a basket that does not survive being
    // closed is a smaller problem than a shop that stalls on a full disk.
    void AsyncStorage.setItem(CART_KEY, JSON.stringify(cart)).catch(() => {});
  }, [cart, ready]);

  const apply = useCallback((key: string, next: (before: number) => number) => {
    const before = cartRef.current[key] ?? 0;
    /*
     * Capped at `MAX_QUANTITY`, which is the shared constant the checkout
     * Function bounds against — not a number repeated here. An unbounded
     * counter is how somebody orders 9,999 Bibles by leaning on a key, and a
     * ceiling the shop and the server disagreed about is a basket that cannot
     * be paid for.
     */
    const bounded = Math.max(0, Math.min(MAX_QUANTITY, Math.trunc(next(before))));
    if (bounded === before) return;

    const updated = { ...cartRef.current };
    if (bounded === 0) delete updated[key];
    else updated[key] = bounded;
    cartRef.current = updated;

    // Counted against the product, whichever size it was.
    const { slug } = splitKey(key);
    const delta = bounded - before;
    if (delta > 0) trackProduct('cartAdd', slug, delta);
    else trackProduct('cartRemove', slug, -delta);

    setCart(updated);
  }, []);

  const bump = useCallback(
    (key: string, by: number) => apply(key, (before) => before + by),
    [apply],
  );

  const setQuantity = useCallback(
    (key: string, quantity: number) => apply(key, () => quantity),
    [apply],
  );

  const clear = useCallback(() => {
    cartRef.current = {};
    setCart({});
  }, []);

  const lines = useMemo(
    () =>
      products.flatMap((product) =>
        Object.entries(cart).flatMap(([key, quantity]): CartLine[] => {
          const { slug, size } = splitKey(key);
          if (slug !== product.slug || quantity <= 0) return [];
          if (product.sizes ? !product.sizes.some((one) => one.label === size) : size !== null) {
            return [];
          }
          return [{ key, product, size, quantity, unit: unitOf(product, size) }];
        }),
      ),
    [cart, products],
  );

  const count = useMemo(() => lines.reduce((sum, line) => sum + line.quantity, 0), [lines]);

  const subtotal = useMemo(
    () => lines.reduce((sum, line) => sum + line.unit * line.quantity, 0),
    [lines],
  );

  return { cart, lines, count, subtotal, bump, setQuantity, clear, ready };
}

/**
 * Whatever was in storage, reduced to a basket.
 *
 * Storage is not a trusted input even though only this app writes it: the
 * previous version of this app also wrote it, and a build that shipped a
 * different ceiling — or a key that was never a slug — should not produce a
 * basket the checkout refuses with no explanation. Bad entries are dropped
 * individually rather than the whole basket being discarded.
 */
function sanitise(raw: Record<string, unknown>): Cart {
  const cart: Cart = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof key !== 'string' || splitKey(key).slug === '') continue;
    const quantity = Math.trunc(Number(value));
    if (!Number.isFinite(quantity) || quantity < 1) continue;
    cart[key] = Math.min(MAX_QUANTITY, quantity);
  }
  return cart;
}
