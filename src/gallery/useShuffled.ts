/**
 * `list` in a random order, chosen once per visit — so a cycling tile does not
 * open on the same picture every time.
 *
 * The website's `useShuffled` (apps/website/src/lib/useShuffled.ts), ported,
 * with one difference that is the whole of why it is shorter. The site's first
 * render returns the list *unshuffled* and shuffles after mount, because the
 * header's Events menu is prerendered into static HTML and a `Math.random()`
 * during render would give the server one order and the browser another — a
 * hydration mismatch. Nothing here is prerendered, so there is nothing to
 * mismatch with, and the shuffle happens in the first render: no frame in
 * gallery order, and no second render to correct it.
 *
 * ## Stable while the set is the same set
 *
 * `identity` names each item, and only a change to *which* items are in the
 * list draws a new order. A parent passing a fresh array of the same pictures
 * on every render — which is every parent here, since the covers are derived in
 * a `map` — does not reshuffle the tile mid-cycle. A parent whose set really
 * does change (the drawer's covers arriving after its names, a refresh that
 * finds a new photograph) gets a fresh order for the new set, which is what a
 * new visit would have drawn.
 *
 * The order is state rather than a memo for that reason: `useMemo` is allowed
 * to forget, and a forgotten memo here is a tile that jumps to a different
 * picture for no reason anybody could see.
 */
import { useState } from 'react';
import { shuffle } from '@spsm/shared';

export function useShuffled<T>(list: readonly T[], identity: (item: T) => string): readonly T[] {
  const ids = list.map(identity);
  const key = ids.join('\n');

  const [order, setOrder] = useState(() => ({ key, ids: shuffle(ids) }));

  /*
   * The set changed: draw a new order for it, in this render.
   *
   * React's own pattern for state derived from a prop ("adjusting some state
   * when a prop changes"): the `setOrder` re-renders this component once before
   * anything is committed, and `current` is what this render uses in the
   * meantime, so no frame is drawn with the old order against the new set.
   */
  let current = order;
  if (order.key !== key) {
    current = { key, ids: shuffle(ids) };
    setOrder(current);
  }

  /*
   * The items themselves come from this render's `list`, not from the one the
   * order was drawn against, so a refreshed document — a new caption, a moved
   * focal point — is drawn as it now is. Not memoised: it is eight items, and
   * a memo keyed on `list` would miss on every render anyway. Callers that
   * need a stable dependency should depend on the length or the ids, not on
   * this array.
   */
  const byId = new Map(list.map((item) => [identity(item), item]));
  return current.ids.flatMap((id) => {
    const item = byId.get(id);
    return item === undefined ? [] : [item];
  });
}
