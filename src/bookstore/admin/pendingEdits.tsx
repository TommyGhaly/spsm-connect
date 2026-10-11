/**
 * Held edits, and the one Save that sends them.
 *
 * The mobile port of the website's `features/bookstore/pendingEdits.tsx`. Its
 * header records why it exists, in Tommy's words — *"add a overall save button
 * rather than sending a request after each edit or increment"* — and every one
 * of its arguments is stronger on a phone, where the control is a thumb on a
 * 28pt target rather than a mouse on a 40px one.
 *
 * ## What is held, and what deliberately is not
 *
 * Everything about an item: its title, description and price, whether it is on
 * clearance and at what price, the stock count or its clothing sizes, the
 * categories, the shipping weight and Media Mail flag, whether sales tax
 * applies, and pictures added or taken off. The item panel's one Save sends the
 * lot (`saveOne` → `sendOne`) — the website's arrangement since clothing sizes
 * were ticked and never saved because the panel had two ways of saving.
 *
 * Not held — these still act immediately, and it is not an oversight:
 *
 *   - **Removing a book.** It has its own confirmation, and a destructive
 *     action queued behind a Save is a trap: the card would sit there looking
 *     removed while still being for sale.
 *   - **Adding a book, and the categories themselves.** Both create the thing
 *     that other edits then refer to. A held edit pointing at a category that
 *     does not exist yet is a category of bug not worth inventing.
 *
 * ## The functional updates are load-bearing
 *
 * Every mutator below computes from the previous state inside the updater
 * rather than from a value read in a component's render. The website found this
 * the hard way: six quick presses on `+` produce six updates inside one React
 * batch, and every one of them reading `shown` from the render that was on
 * screen when the run started makes all six compute the same number — nine
 * clicks across two books moved them by one each. A phone makes that run of
 * presses more likely, not less.
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { ProductSize } from '@spsm/shared';

import type { ShopProduct } from '../data';
import type { PickedPicture } from './picture';

export type PendingImage = PickedPicture;

export interface PendingEdit {
  /** Square's: the title. Saved with description and price in one catalog write. */
  name?: string;
  /** Square's: the description. */
  description?: string;
  /** Square's: what it costs now — the sale price while on clearance. */
  priceCents?: number;
  /** The price before clearance, or `null` for not on clearance. The parish's. */
  wasPriceCents?: number | null;
  /** A number, or `null` for "not counted". Absent means untouched. */
  stockCount?: number | null;
  /**
   * The Square subcategories the book is filed in — several allowed, empty for
   * none. Absent means untouched. Saved through Square: `setProductCategories`.
   */
  categoryIds?: readonly string[];
  /** Ounces per copy, or `null` for not weighed. The parish's own field. */
  weightOz?: number | null;
  /** Media Mail eligible. Held together with `weightOz` — see `setShipping`. */
  mediaMail?: boolean;
  /** Sales tax applies. The parish's own field. */
  taxable?: boolean;
  /** Clothing sizes, or `null` for not clothing. The parish's own field. */
  sizes?: readonly ProductSize[] | null;
  /** Photographs chosen here and not yet uploaded, in the order chosen. */
  addImages?: PendingImage[];
  /** Already-saved Square URLs marked to come off. */
  removeImages?: string[];
}

/** What one book currently *is*, so a held edit can be compared against it. */
export interface ActualValues {
  name?: string;
  description?: string;
  priceCents?: number;
  wasPriceCents?: number | null;
  stockCount: number | null;
  /** Optional so callers that never show the categories need not pass them. */
  categoryIds?: readonly string[];
  /** Optional, for the same reason, on the shipping and tax fields. */
  weightOz?: number | null;
  mediaMail?: boolean;
  taxable?: boolean;
  sizes?: readonly ProductSize[] | null;
}

/**
 * A book's saved values, whole — for every caller of `usePendingEdit`.
 *
 * The website lets a caller that never shows the shipping fields pass a
 * partial `actual`, and that is a trap worth not porting: the card's stepper
 * releases a book when every field "matches", and a missing weight reads as
 * "not weighed" — so a held *cleared* weight would match a partial `actual` and
 * be dropped by the next tap on +. One function, used by the card, the sheet,
 * the stepper and the pictures alike, means they all compare against the same
 * thing.
 */
export function actualValues(product: ShopProduct): ActualValues {
  return {
    name: product.name,
    description: product.description,
    priceCents: product.amount,
    wasPriceCents: product.wasPriceCents,
    stockCount: product.stockCount ?? null,
    categoryIds: product.categoryIds,
    weightOz: product.weightOz,
    mediaMail: product.mediaMail,
    taxable: product.taxable,
    sizes: product.sizes,
  };
}

/** The held fields that are plain values — everything but the pictures. */
const FIELDS = [
  'name',
  'description',
  'priceCents',
  'wasPriceCents',
  'stockCount',
  'categoryIds',
  'weightOz',
  'mediaMail',
  'taxable',
  'sizes',
] as const;
export type HeldField = (typeof FIELDS)[number];

/**
 * A category list as one comparable value. Order does not matter — ticking A
 * then B is the same filing as B then A — so it is sorted before it is joined.
 */
function categoryKey(ids: readonly string[] | undefined): string {
  return [...(ids ?? [])].sort().join('\n');
}

/** A size list as one comparable value. Order is fixed by `cleanSizes`, so it matters. */
function sizesKey(sizes: readonly ProductSize[] | null | undefined): string {
  return JSON.stringify(
    sizes ? sizes.map(({ label, count, extraCents }) => [label, count, extraCents]) : null,
  );
}

function actualOf(actual: ActualValues, key: HeldField): unknown {
  if (key === 'categoryIds') return categoryKey(actual.categoryIds);
  if (key === 'sizes') return sizesKey(actual.sizes);
  if (key === 'weightOz' || key === 'wasPriceCents') return actual[key] ?? null;
  if (key === 'mediaMail' || key === 'taxable') return actual[key] ?? false;
  return actual[key];
}

/** What a field reads as with this edit held over the real value. */
function heldOf(edit: PendingEdit | undefined, actual: ActualValues, key: HeldField): unknown {
  if (edit && key in edit) {
    if (key === 'categoryIds') return categoryKey(edit.categoryIds);
    if (key === 'sizes') return sizesKey(edit.sizes);
    return key === 'mediaMail' || key === 'taxable' ? (edit[key] ?? false) : (edit[key] ?? null);
  }
  return actualOf(actual, key);
}

/**
 * True when every plain field of this edit is back to what is saved.
 *
 * One test for all of them, and that is the website's lesson rather than
 * tidiness: the failure this file keeps guarding against is a check that
 * compared the field it was about and forgot the *other* one, and so released
 * a book with a change still held. With five fields there are five ways to
 * forget; with one function there are none.
 */
function fieldsMatch(edit: PendingEdit | undefined, actual: ActualValues): boolean {
  return FIELDS.every((key) => heldOf(edit, actual, key) === actualOf(actual, key));
}

interface PendingEditsValue {
  edits: Record<string, PendingEdit>;
  hold: (slug: string, patch: PendingEdit) => void;
  /** Relative change to the count. See `nudgeStock`. */
  nudgeStock: (slug: string, by: number, actual: ActualValues) => void;
  /** Hold a chosen photograph. Nothing reaches Square until Save. */
  addImage: (slug: string, image: PendingImage) => void;
  /** Take a *held* photograph back off, before it has ever been sent. */
  dropAddedImage: (slug: string, id: string, actual: ActualValues) => void;
  /** Mark an already-saved Square URL to come off at Save. */
  removeImage: (slug: string, url: string) => void;
  /** Undo such a mark. */
  keepImage: (slug: string, url: string, actual: ActualValues) => void;
  release: (slug: string) => void;
  discardAll: () => void;
  save: () => Promise<void>;
  /** Send one item's held edit — the item panel's Save. */
  saveOne: (slug: string) => Promise<void>;
  /** How many *books* are waiting, not how many fields. */
  count: number;
  saving: boolean;
}

/**
 * Store a book's edit, or drop the book entirely when the edit says nothing.
 *
 * "Says nothing" means every field is back at what the shop already holds — the
 * count, the category and both picture lists together. Checked as a whole, so
 * undoing one field never discards another that is still outstanding.
 */
export function settle(
  was: Record<string, PendingEdit>,
  slug: string,
  edit: PendingEdit,
  actual: ActualValues,
): Record<string, PendingEdit> {
  if (fieldsMatch(edit, actual) && !hasImageEdits(edit)) {
    if (!(slug in was)) return was;
    const next = { ...was };
    delete next[slug];
    return next;
  }
  return { ...was, [slug]: edit };
}

/** Whether a held edit carries any picture work. Absent and empty both count as none. */
export function hasImageEdits(edit: PendingEdit | undefined): boolean {
  return Boolean(edit?.addImages?.length || edit?.removeImages?.length);
}

/**
 * The stepper's arithmetic, as a pure function of the previous held edits.
 *
 * Exported so it can be tested without reproducing a fast run of taps. It is
 * the whole of what went wrong the first time this was built on the website.
 */
export function nextEditsAfterNudge(
  was: Record<string, PendingEdit>,
  slug: string,
  by: number,
  actual: ActualValues,
): Record<string, PendingEdit> {
  const held = was[slug];
  const heldStock = held && 'stockCount' in held ? (held.stockCount ?? null) : actual.stockCount;

  // "Not counted" has no neighbouring value; the switch is how that state is
  // left, not the arrows.
  if (heldStock === null) return was;

  const nextStock = Math.max(0, Math.min(99_999, heldStock + by));

  /*
   * Back where it started, and nothing else held: stop calling it an edit.
   *
   * `hasImageEdits` is part of that test for the same reason the other fields
   * are — releasing the whole book the moment its count matched again would
   * silently drop a picture added, or a weight typed, a second earlier, and the
   * card would look clean and be sent as nothing.
   */
  if (fieldsMatch({ ...held, stockCount: nextStock }, actual) && !hasImageEdits(held)) {
    if (!(slug in was)) return was;
    const next = { ...was };
    delete next[slug];
    return next;
  }

  return { ...was, [slug]: { ...held, stockCount: nextStock } };
}

/*
 * Shared empties, so a book with no picture edits returns the *same* array on
 * every render. A fresh `[]` each time is a new identity, and these are read
 * inside dependency lists below.
 */
const EMPTY_ADDS: readonly PendingImage[] = [];
const EMPTY_REMOVES: readonly string[] = [];
const EMPTY_IDS: readonly string[] = [];

/**
 * Every write one item's held edit needs, in an order that never leaves the
 * shop showing something untrue if a later write is refused. The website's
 * `sendOne`, in its order.
 */
async function sendOne(
  adminData: typeof import('./adminData'),
  slug: string,
  edit: PendingEdit,
): Promise<void> {
  /*
   * The title, description and price in one catalog write — three would be
   * three full catalog syncs.
   *
   * The pre-clearance price goes either side of it. Starting or changing a sale
   * writes the old price first, so a refused Square write leaves the old price
   * beside itself, which `clearanceOf` reads as no sale; ending one writes
   * Square's price back first, so a refusal leaves the sale standing rather
   * than a cut price with nothing to say it was cut.
   */
  const was = 'wasPriceCents' in edit ? (edit.wasPriceCents ?? null) : undefined;
  if (was !== undefined && was !== null) await adminData.setWasPrice(slug, was);
  if ('name' in edit || 'description' in edit || 'priceCents' in edit) {
    await adminData.setProductDetails(slug, {
      ...(edit.name !== undefined ? { name: edit.name } : {}),
      ...(edit.description !== undefined ? { description: edit.description } : {}),
      ...(edit.priceCents !== undefined ? { priceCents: edit.priceCents } : {}),
    });
  }
  if (was === null) await adminData.setWasPrice(slug, null);

  if ('stockCount' in edit) await adminData.setProductStock(slug, edit.stockCount ?? null);
  // Through Square, so the register files the item the same way.
  if ('categoryIds' in edit) await adminData.setProductCategories(slug, [...(edit.categoryIds ?? [])]);
  if ('taxable' in edit) await adminData.setProductTaxable(slug, edit.taxable ?? false);
  if ('sizes' in edit) await adminData.setProductSizes(slug, edit.sizes ?? null);
  // Both shipping fields in one write; `setShipping` always holds them together.
  if ('weightOz' in edit || 'mediaMail' in edit) {
    await adminData.setProductShipping(slug, {
      weightOz: edit.weightOz ?? null,
      mediaMail: edit.mediaMail ?? false,
    });
  }

  /*
   * Removals before additions, so the result matches the tiles that were on
   * screen when Save was pressed: the preview renders saved-minus-removed
   * followed by the held adds, and Square's first picture is the cover.
   * Sequential, because these are uploads.
   */
  for (const url of edit.removeImages ?? []) await adminData.removeProductImage(slug, url);
  for (const image of edit.addImages ?? []) await adminData.uploadProductImage(slug, image.dataUrl);
}

const PendingEditsContext = createContext<PendingEditsValue | null>(null);

/**
 * No `onSaved` here, unlike the website's provider, and the difference is the
 * subscription rather than a simplification.
 *
 * The website reads its catalog once and bumps a nonce after every write to
 * re-read it. This app's shelf is `watchCatalog` — two live `onSnapshot`
 * listeners — so the moment a Function mirrors a Square edit back into
 * Firestore, the card redraws on its own. A refresh callback here would be a
 * second, slower copy of something already happening, and the window in which
 * it could disagree with the snapshot is exactly the window in which it would
 * be wrong.
 */
export function PendingEditsProvider({
  children,
  onError,
}: {
  children: ReactNode;
  onError: (message: string) => void;
}) {
  const [edits, setEdits] = useState<Record<string, PendingEdit>>({});
  const [saving, setSaving] = useState(false);

  const hold = useCallback((slug: string, patch: PendingEdit) => {
    setEdits((was) => ({ ...was, [slug]: { ...was[slug], ...patch } }));
  }, []);

  const release = useCallback((slug: string) => {
    setEdits((was) => {
      if (!(slug in was)) return was;
      const next = { ...was };
      delete next[slug];
      return next;
    });
  }, []);

  /*
   * Stepping the count, computed *inside* the updater.
   *
   * This cannot be `hold(slug, { stockCount: shown + 1 })` from the component,
   * and the website's first version was exactly that. A relative change has to
   * be applied to whatever the previous updater left, which means the
   * arithmetic belongs where that value is the argument. `actual` is passed in
   * because the release-when-unchanged decision needs it and the provider does
   * not know one book from another.
   */
  const nudgeStock = useCallback((slug: string, by: number, actual: ActualValues) => {
    setEdits((was) => nextEditsAfterNudge(was, slug, by, actual));
  }, []);

  const addImage = useCallback((slug: string, image: PendingImage) => {
    setEdits((was) => ({
      ...was,
      [slug]: { ...was[slug], addImages: [...(was[slug]?.addImages ?? []), image] },
    }));
  }, []);

  const removeImage = useCallback((slug: string, url: string) => {
    setEdits((was) => {
      const held = was[slug];
      if (held?.removeImages?.includes(url)) return was;
      return { ...was, [slug]: { ...held, removeImages: [...(held?.removeImages ?? []), url] } };
    });
  }, []);

  /*
   * The two undo paths take `actual` so the book can be released outright when
   * undoing leaves nothing held. Without it, adding a picture and taking it
   * straight back off would leave the card marked "Edited" with an empty edit,
   * and the bar would offer to save nothing.
   */
  const dropAddedImage = useCallback((slug: string, id: string, actual: ActualValues) => {
    setEdits((was) => {
      const held = was[slug];
      if (!held?.addImages) return was;
      const addImages = held.addImages.filter((one) => one.id !== id);
      return settle(was, slug, { ...held, addImages }, actual);
    });
  }, []);

  const keepImage = useCallback((slug: string, url: string, actual: ActualValues) => {
    setEdits((was) => {
      const held = was[slug];
      if (!held?.removeImages) return was;
      const removeImages = held.removeImages.filter((one) => one !== url);
      return settle(was, slug, { ...held, removeImages }, actual);
    });
  }, []);

  const discardAll = useCallback(() => setEdits({}), []);

  const releaseSaved = useCallback((slugs: string[]) => {
    if (slugs.length === 0) return;
    setEdits((was) => {
      const next = { ...was };
      for (const slug of slugs) delete next[slug];
      return next;
    });
  }, []);

  /**
   * Send what is held for some items, one item at a time. The item panel's Save
   * sends one; `save` sends every item still holding something.
   */
  const send = useCallback(
    async (slugs: string[]) => {
      const pending = slugs.flatMap((slug) => (edits[slug] ? [[slug, edits[slug]] as const] : []));
      if (pending.length === 0) return;

      setSaving(true);
      /* Hoisted out of the `try` so the failure path can release the items that
         did land — otherwise a refusal on the fourth leaves the first three
         marked as unsaved, and pressing Save again re-sends writes that already
         succeeded. */
      const saved: string[] = [];
      try {
        const adminData = await import('./adminData');

        /*
         * Sequential, not `Promise.all`. Each stock change is a write to
         * Square's inventory API, and firing ten at once is how a shop of any
         * size meets Square's rate limit — at which point some of the ten have
         * landed and some have not. On a phone there is a second reason: these
         * go over a connection that may be a church basement's.
         *
         * The failed item keeps its held edit so it can be retried; the ones
         * that landed are released.
         */
        for (const [slug, edit] of pending) {
          await sendOne(adminData, slug, edit);
          saved.push(slug);
        }

        releaseSaved(saved);
      } catch (cause) {
        releaseSaved(saved);
        onError(cause instanceof Error ? cause.message : 'That change was refused.');
      } finally {
        setSaving(false);
      }
    },
    [edits, releaseSaved, onError],
  );

  const save = useCallback(() => send(Object.keys(edits)), [send, edits]);
  const saveOne = useCallback((slug: string) => send([slug]), [send]);

  const value = useMemo<PendingEditsValue>(
    () => ({
      edits,
      hold,
      nudgeStock,
      addImage,
      dropAddedImage,
      removeImage,
      keepImage,
      release,
      discardAll,
      save,
      saveOne,
      count: Object.keys(edits).length,
      saving,
    }),
    [
      edits,
      hold,
      nudgeStock,
      addImage,
      dropAddedImage,
      removeImage,
      keepImage,
      release,
      discardAll,
      save,
      saveOne,
      saving,
    ],
  );

  return <PendingEditsContext.Provider value={value}>{children}</PendingEditsContext.Provider>;
}

/**
 * The bar's view of the held edits.
 *
 * Returns inert stubs outside a provider rather than throwing, so that the
 * book's own sheet — which renders the same controls and can be opened when the
 * shop is not in edit mode — does not have to know which context it is in.
 */
export function usePendingEdits(): PendingEditsValue {
  return (
    useContext(PendingEditsContext) ?? {
      edits: {},
      hold: () => {},
      nudgeStock: () => {},
      addImage: () => {},
      dropAddedImage: () => {},
      removeImage: () => {},
      keepImage: () => {},
      release: () => {},
      discardAll: () => {},
      save: async () => {},
      saveOne: async () => {},
      count: 0,
      saving: false,
    }
  );
}

/**
 * One book's view: what to *show*, which is the held value when there is one and
 * the saved value otherwise.
 *
 * `dirty` drives the marker on the card. It compares against the actual value
 * rather than merely asking whether a key is present, so that nudging a count
 * up and back down again leaves the card clean — which is what somebody who
 * just undid their own change expects to see.
 */
export function usePendingEdit(slug: string, actual: ActualValues) {
  const { edits, hold, nudgeStock, addImage, dropAddedImage, removeImage, keepImage, release } =
    usePendingEdits();
  const edit = edits[slug];

  const stockCount = heldOf(edit, actual, 'stockCount') as number | null;
  // The list itself, not the comparison key `heldOf` returns for it.
  const categoryIds: readonly string[] =
    edit && 'categoryIds' in edit ? (edit.categoryIds ?? EMPTY_IDS) : (actual.categoryIds ?? EMPTY_IDS);
  const weightOz = heldOf(edit, actual, 'weightOz') as number | null;
  const mediaMail = heldOf(edit, actual, 'mediaMail') as boolean;
  const taxable = heldOf(edit, actual, 'taxable') as boolean;
  const name = (edit && 'name' in edit ? edit.name : actual.name) ?? '';
  const description = (edit && 'description' in edit ? edit.description : actual.description) ?? '';
  const priceCents = (edit && 'priceCents' in edit ? edit.priceCents : actual.priceCents) ?? 0;
  const wasPriceCents = heldOf(edit, actual, 'wasPriceCents') as number | null;
  // The list itself, like `categoryIds`.
  const sizes: readonly ProductSize[] | null =
    edit && 'sizes' in edit ? (edit.sizes ?? null) : (actual.sizes ?? null);
  const addedImages = edit?.addImages ?? EMPTY_ADDS;
  const removedImages = edit?.removeImages ?? EMPTY_REMOVES;
  const dirty = !fieldsMatch(edit, actual) || addedImages.length > 0 || removedImages.length > 0;

  /*
   * The parts of `actual` the callbacks below depend on, as primitives. The
   * object itself is a fresh literal on every render of every caller, so
   * listing it would rebuild every callback every time; its fields are what
   * matter, and the category list is compared as its sorted key.
   */
  const actualKey = JSON.stringify(FIELDS.map((key) => actualOf(actual, key)));

  /*
   * One writer for every field, because the "back to where it started" case
   * has to consider the *other* fields too. Releasing the whole book the moment
   * its count matched again would silently drop a category change made a
   * second earlier — the book would look clean and be sent as nothing. Pictures
   * count as well, for the same reason.
   */
  const setField = useCallback(
    (patch: PendingEdit) => {
      if (fieldsMatch({ ...edit, ...patch }, actual) && !hasImageEdits(edit)) release(slug);
      else hold(slug, patch);
    },
    [slug, edit, actualKey, hold, release], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const setStock = useCallback((next: number | null) => setField({ stockCount: next }), [setField]);

  const setCategories = useCallback(
    (next: readonly string[]) => setField({ categoryIds: next }),
    [setField],
  );

  /* Always both together, so Save sends one complete shipping write. */
  const setShipping = useCallback(
    (next: { weightOz: number | null; mediaMail: boolean }) => setField(next),
    [setField],
  );

  const setTaxable = useCallback((next: boolean) => setField({ taxable: next }), [setField]);

  /** Any of the details at once — the price and the clearance price move together. */
  const setDetails = useCallback(
    (patch: Pick<PendingEdit, 'name' | 'description' | 'priceCents' | 'wasPriceCents'>) =>
      setField(patch),
    [setField],
  );

  const setSizes = useCallback(
    (next: readonly ProductSize[] | null) => setField({ sizes: next }),
    [setField],
  );

  /* Relative, so a fast run of presses accumulates rather than collapsing. */
  const nudge = useCallback(
    (by: number) => nudgeStock(slug, by, actual),
    [nudgeStock, slug, actualKey], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const holdImage = useCallback(
    (picture: PendingImage) => addImage(slug, picture),
    [addImage, slug],
  );

  const unholdImage = useCallback(
    (id: string) => dropAddedImage(slug, id, actual),
    [dropAddedImage, slug, actualKey], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const markImageRemoved = useCallback(
    (url: string) => removeImage(slug, url),
    [removeImage, slug],
  );

  const unmarkImageRemoved = useCallback(
    (url: string) => keepImage(slug, url, actual),
    [keepImage, slug, actualKey], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return {
    name,
    description,
    priceCents,
    wasPriceCents,
    sizes,
    stockCount,
    categoryIds,
    weightOz,
    mediaMail,
    taxable,
    /** Which held fields differ, so a tab can say it has unsaved changes. */
    changed: FIELDS.filter((key) => heldOf(edit, actual, key) !== actualOf(actual, key)),
    hasImageEdits: addedImages.length > 0 || removedImages.length > 0,
    dirty,
    setDetails,
    setSizes,
    setStock,
    setCategories,
    setShipping,
    setTaxable,
    nudge,
    addedImages,
    removedImages,
    holdImage,
    unholdImage,
    markImageRemoved,
    unmarkImageRemoved,
  };
}
