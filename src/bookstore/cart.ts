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

import type { ShopProduct } from './data';
import { trackProduct } from './track';

/** slug → quantity. Kept flat so it survives `JSON.stringify` unchanged. */
export type Cart = Record<string, number>;

const CART_KEY = 'spsm.bookstore.cart';

/** One basket row, resolved against the catalog. */
export interface CartLine {
  product: ShopProduct;
  quantity: number;
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
   */
  lines: CartLine[];
  /** Books, not rows: three copies of one title is three. */
  count: number;
  /** The books only. Delivery is added at checkout, where it is chosen. */
  subtotal: number;
  /** Add to, or take from, what is in the basket now. */
  bump: (slug: string, by: number) => void;
  /** Set an exact quantity. Zero removes the row. */
  setQuantity: (slug: string, quantity: number) => void;
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

  const apply = useCallback((slug: string, next: (before: number) => number) => {
    const before = cartRef.current[slug] ?? 0;
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
    if (bounded === 0) delete updated[slug];
    else updated[slug] = bounded;
    cartRef.current = updated;

    const delta = bounded - before;
    if (delta > 0) trackProduct('cartAdd', slug, delta);
    else trackProduct('cartRemove', slug, -delta);

    setCart(updated);
  }, []);

  const bump = useCallback(
    (slug: string, by: number) => apply(slug, (before) => before + by),
    [apply],
  );

  const setQuantity = useCallback(
    (slug: string, quantity: number) => apply(slug, () => quantity),
    [apply],
  );

  const clear = useCallback(() => {
    cartRef.current = {};
    setCart({});
  }, []);

  const lines = useMemo(
    () =>
      products
        .filter((product) => (cart[product.slug] ?? 0) > 0)
        .map((product) => ({ product, quantity: cart[product.slug] ?? 0 })),
    [cart, products],
  );

  const count = useMemo(() => lines.reduce((sum, line) => sum + line.quantity, 0), [lines]);

  const subtotal = useMemo(
    () => lines.reduce((sum, line) => sum + line.product.amount * line.quantity, 0),
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
  for (const [slug, value] of Object.entries(raw)) {
    if (typeof slug !== 'string' || slug === '') continue;
    const quantity = Math.trunc(Number(value));
    if (!Number.isFinite(quantity) || quantity < 1) continue;
    cart[slug] = Math.min(MAX_QUANTITY, quantity);
  }
  return cart;
}
