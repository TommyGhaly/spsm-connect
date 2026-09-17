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
 * Held: the stock count, whether stock is counted at all, the category, and
 * pictures added or taken off.
 *
 * Not held — these still act immediately, and it is not an oversight:
 *
 *   - **Removing a book.** It has its own confirmation, and a destructive
 *     action queued behind a Save is a trap: the card would sit there looking
 *     removed while still being for sale.
 *   - **Adding a book, and the categories themselves.** Both create the thing
 *     that other edits then refer to. A held edit pointing at a category that
 *     does not exist yet is a category of bug not worth inventing.
 *   - **The title, price and description.** One book at a time, straight to
 *     Square, behind their own button. See `ProductSettings`.
 *
 * The bar says which of these are immediate, so nobody has to infer it.
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
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Surface';
import { Micro, Small } from '@/components/Type';
import { useTheme } from '@/theme/ThemeProvider';

import type { PickedPicture } from './picture';

export type PendingImage = PickedPicture;

export interface PendingEdit {
  /** A number, or `null` for "not counted". Absent means untouched. */
  stockCount?: number | null;
  /** A category id, or `null` for none. Absent means untouched. */
  section?: string | null;
  /** Photographs chosen here and not yet uploaded, in the order chosen. */
  addImages?: PendingImage[];
  /** Already-saved Square URLs marked to come off. */
  removeImages?: string[];
}

/** What one book currently *is*, so a held edit can be compared against it. */
export interface ActualValues {
  stockCount: number | null;
  section: string | null;
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
  const stock = 'stockCount' in edit ? (edit.stockCount ?? null) : actual.stockCount;
  const section = 'section' in edit ? (edit.section ?? null) : actual.section;

  if (stock === actual.stockCount && section === actual.section && !hasImageEdits(edit)) {
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
  const heldSection = held && 'section' in held ? (held.section ?? null) : actual.section;

  /*
   * Back where it started, and nothing else held: stop calling it an edit.
   *
   * `hasImageEdits` is part of that test for the same reason `heldSection` is —
   * releasing the whole book the moment its count matched again would silently
   * drop a picture added a second earlier, and the card would look clean and be
   * sent as nothing.
   */
  if (nextStock === actual.stockCount && heldSection === actual.section && !hasImageEdits(held)) {
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

  const save = useCallback(async () => {
    const pending = Object.entries(edits);
    if (pending.length === 0) return;

    setSaving(true);
    /* Hoisted out of the `try` so the failure path can release the books that
       did land — otherwise a refusal on the fourth book leaves the first three
       marked "Edited" and counted on the bar, and pressing Save again re-sends
       writes that already succeeded. */
    const saved: string[] = [];
    try {
      const { setProductStock, setProductSection, uploadProductImage, removeProductImage } =
        await import('./adminData');

      /*
       * Sequential, not `Promise.all`. Each stock change is a write to Square's
       * inventory API, and firing ten at once is how a shop of any size meets
       * Square's rate limit — at which point some of the ten have landed and
       * some have not, which is the state this whole arrangement exists to
       * avoid. On a phone there is a second reason: these go over a connection
       * that may be a church basement's, and a book's worth of uploads fired at
       * once is how that turns into several half-finished ones.
       *
       * The failed book keeps its held edit so it is still on the bar and can be
       * retried; the ones that landed are released. Stopping at the first
       * failure rather than pressing on means the bar's count stays truthful.
       */
      for (const [slug, edit] of pending) {
        if ('stockCount' in edit) await setProductStock(slug, edit.stockCount ?? null);
        if ('section' in edit) await setProductSection(slug, edit.section ?? null);

        /*
         * Removals before additions, so the result matches the tiles that were
         * on screen when Save was pressed. The preview renders saved-minus-
         * removed followed by the held adds, and Square's first picture is the
         * cover — so doing it the other way round would briefly make a new
         * photograph the cover and then not, and on a book where every old
         * picture was removed it would settle on a different one than the
         * preview showed.
         */
        for (const url of edit.removeImages ?? []) await removeProductImage(slug, url);
        for (const image of edit.addImages ?? []) await uploadProductImage(slug, image.dataUrl);

        saved.push(slug);
      }

      releaseSaved(saved);
    } catch (cause) {
      /* The books before the one that broke did land, so they are released
         here too — the bar must not offer to re-send them. */
      releaseSaved(saved);
      onError(
        cause instanceof Error
          ? `${cause.message} Nothing after that book was sent.`
          : 'That change was refused. Nothing after that book was sent.',
      );
    } finally {
      setSaving(false);
    }
  }, [edits, releaseSaved, onError]);

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

  const stockCount = edit && 'stockCount' in edit ? (edit.stockCount ?? null) : actual.stockCount;
  const section = edit && 'section' in edit ? (edit.section ?? null) : actual.section;
  const addedImages = edit?.addImages ?? EMPTY_ADDS;
  const removedImages = edit?.removeImages ?? EMPTY_REMOVES;
  const dirty =
    stockCount !== actual.stockCount ||
    section !== actual.section ||
    addedImages.length > 0 ||
    removedImages.length > 0;

  /*
   * One writer for both fields, because the "back to where it started" case has
   * to consider the *other* field too. Releasing the whole book the moment its
   * count matched again would silently drop a category change made a second
   * earlier — the book would look clean and be sent as nothing.
   */
  const setField = useCallback(
    (patch: PendingEdit) => {
      const nextStock = 'stockCount' in patch ? (patch.stockCount ?? null) : stockCount;
      const nextSection = 'section' in patch ? (patch.section ?? null) : section;

      if (nextStock === actual.stockCount && nextSection === actual.section) release(slug);
      else hold(slug, patch);
    },
    [slug, stockCount, section, actual.stockCount, actual.section, hold, release],
  );

  const setStock = useCallback((next: number | null) => setField({ stockCount: next }), [setField]);

  const setSection = useCallback(
    (next: string | null) => setField({ section: next }),
    [setField],
  );

  /* Relative, so a fast run of presses accumulates rather than collapsing. */
  const nudge = useCallback(
    (by: number) => nudgeStock(slug, by, actual),
    [nudgeStock, slug, actual.stockCount, actual.section], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const holdImage = useCallback(
    (picture: PendingImage) => addImage(slug, picture),
    [addImage, slug],
  );

  const unholdImage = useCallback(
    (id: string) => dropAddedImage(slug, id, actual),
    [dropAddedImage, slug, actual.stockCount, actual.section], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const markImageRemoved = useCallback(
    (url: string) => removeImage(slug, url),
    [removeImage, slug],
  );

  const unmarkImageRemoved = useCallback(
    (url: string) => keepImage(slug, url, actual),
    [keepImage, slug, actual.stockCount, actual.section], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return {
    stockCount,
    section,
    dirty,
    setStock,
    setSection,
    nudge,
    addedImages,
    removedImages,
    holdImage,
    unholdImage,
    markImageRemoved,
    unmarkImageRemoved,
  };
}

/**
 * The bar that sends them.
 *
 * Absolutely positioned over the shelf rather than laid out under it, which is
 * the same decision — and the same reasoning — as `BasketBar` two files over: a
 * bar in the flow moves every book by its own height the moment it appears, so
 * the card you were about to press is somewhere else by the time you press it.
 *
 * It takes the basket bar's place while editing, and the two can never both be
 * on screen: the basket only exists once a book is in it, and a volunteer
 * editing the shop is not shopping. `ShopScreen` is where that is enforced.
 *
 * It renders nothing at all until something is held. A permanently visible
 * "Save" with nothing to save is furniture, and worse, it trains people to
 * press it out of habit and wonder whether it worked.
 *
 * The count is books, not fields: "2 books" is what somebody can check against
 * the two cards marked "Edited". A field count could read "3 changes" across two
 * cards and match nothing on screen.
 */
export function SaveBar() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { count, save, discardAll, saving } = usePendingEdits();

  if (count === 0) return null;

  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={`${count} ${count === 1 ? 'book' : 'books'} edited but not saved`}
      style={{
        position: 'absolute',
        left: theme.space.gutter,
        right: theme.space.gutter,
        bottom: insets.bottom + theme.space.sm,
        gap: theme.space.sm,
        padding: theme.space.sm,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.color.accent,
        backgroundColor: theme.color.paperRaised,
      }}
    >
      <View style={{ gap: 2 }}>
        <Small color={theme.color.ink}>
          {count} {count === 1 ? 'book' : 'books'} edited but not saved
        </Small>
        {/* Said here because this is where somebody is deciding whether they
            are finished — not in a note further up the shelf they scrolled past
            several minutes ago. */}
        <Micro color={theme.color.inkFaint}>
          Renaming and removing a book save on their own.
        </Micro>
      </View>

      <View style={{ flexDirection: 'row', gap: theme.space.sm }}>
        <View style={{ flex: 1 }}>
          <Button label="Discard" tone="quiet" onPress={discardAll} disabled={saving} />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            label={saving ? 'Saving…' : count === 1 ? 'Save change' : 'Save changes'}
            onPress={() => void save()}
            busy={saving}
          />
        </View>
      </View>
    </View>
  );
}
