/**
 * One book's settings, inside the sheet a shopper already opens.
 *
 * ---------------------------------------------------------------------------
 * The website reached this arrangement by rejecting two others, and both
 * rejections apply here with more force rather than less.
 *
 * **A "Catalog" tab listing every title with three controls per row.** Rejected
 * because arranging a shop from a table of its names means the shop itself is
 * somewhere else — *"i dont want it to be in the catelog I want the orders and
 * metrics section to make the products have editing functionality in place."*
 *
 * **A properties column down the side.** Rejected as *"way too confusing"*,
 * with the fix stated: *"a lot of the settings can be done in the space that the
 * product already takes up rather than on the side view."* A phone has no side
 * to put a column on, so this one decides itself.
 *
 * What is left is the book's own sheet — the same dialog a shopper opens, which
 * already shows this book at full size and nothing else. It is opened
 * deliberately, it holds one book, and closing it puts you back on the shelf
 * exactly where you were. The card keeps a compact stepper for the fast path of
 * counting a shelf; this is where a photograph is large enough to judge.
 *
 * ## Two kinds of control, and the sheet says which is which
 *
 * Stock, category and pictures are **held** for the Save bar. The title, price
 * and description go **straight to Square** behind their own button, because
 * they are one book at a time, they change what the till charges as well as what
 * the shop shows, and an explicit button is the honest control for that.
 * Removing a book is immediate too, and has its own confirmation.
 * ---------------------------------------------------------------------------
 */
import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import type { BookstoreSection } from '@spsm/shared';

import { Field, Picker, Problem } from '@/components/Fields';
import { Icon } from '@/components/Icon';
import { Button } from '@/components/Surface';
import { Body, Label, Micro, Small } from '@/components/Type';
import { useTheme } from '@/theme/ThemeProvider';

import type { ShopProduct } from '../data';
import { PictureRow, PictureSource, PictureTile } from './Pictures';
import { usePendingEdit, usePendingEdits } from './pendingEdits';

/**
 * Run a write, and report on it.
 *
 * The boolean is not decoration: controls here show the new value immediately,
 * so a refusal has to be able to put the old one back. Without it a failed save
 * leaves a sheet reading "8 in stock" when Square still holds four, which is
 * worse than the error message it sits next to.
 *
 * "Saving…" while it is in flight and "Saved" for a moment afterwards is the
 * difference between a control that answers and one that appears to be dead —
 * a photograph going to Square and back is long enough for somebody to press
 * the button again.
 */
function useWriter(onError: (message: string) => void) {
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    },
    [],
  );

  const write = async (run: () => Promise<void>): Promise<boolean> => {
    setBusy(true);
    try {
      await run();
      /* Only a write that landed says so. A refusal has its own notice, and a
         "Saved" beside it would contradict it. */
      setSaved(true);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(false), 1800);
      return true;
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : 'That change was refused.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  return { busy, saved, write };
}

/** "Saving…", then "Saved", then nothing — and "Edited" while a change is held. */
function SaveState({ busy, saved, dirty }: { busy: boolean; saved: boolean; dirty: boolean }) {
  const theme = useTheme();

  if (busy) return <Micro color={theme.color.inkFaint}>Saving…</Micro>;
  if (saved) return <Micro color={theme.color.accentStrong}>Saved</Micro>;
  if (dirty) return <Micro color={theme.color.accent}>Edited</Micro>;
  return null;
}

export function ProductSettings({
  product,
  sections,
  onRemoved,
}: {
  product: ShopProduct;
  sections: BookstoreSection[];
  /** Close the sheet: the book is no longer on the shop. */
  onRemoved: () => void;
}) {
  const theme = useTheme();
  const [failed, setFailed] = useState<string | null>(null);
  const { busy, saved, write } = useWriter(setFailed);
  const held = usePendingEdits();
  const pending = usePendingEdit(product.slug, {
    stockCount: product.stockCount ?? null,
    section: product.section ?? null,
  });

  return (
    <View
      style={{
        gap: theme.space.md,
        paddingTop: theme.space.md,
        borderTopWidth: 1,
        borderTopColor: theme.color.rule,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
        <View style={{ flex: 1 }}>
          <Label>Book settings</Label>
        </View>
        <SaveState busy={busy} saved={saved} dirty={pending.dirty} />
      </View>

      <Micro color={theme.color.inkFaint}>
        Stock, category and pictures are saved with the bar at the foot of the shop. The
        title, price and description go straight to Square.
      </Micro>

      {/* Every refusal on this sheet goes to one place. Six controls with six
          error slots is six things that are usually empty. */}
      {failed ? (
        <Problem>
          <Body color={theme.color.ink}>{failed}</Body>
        </Problem>
      ) : null}

      {/*
        Keyed on the saved values, which is what re-seeds the boxes.

        This was a `useEffect` copying four props into four pieces of state —
        the arrangement React's own docs call "adjusting state when a prop
        changes", and name a key as the better answer to. It has to happen in
        two cases: the sheet moving to a different book, and a save landing, at
        which point `product` comes back through the subscription carrying the
        new title. Without the second, a successful save leaves the boxes
        showing what was typed and the button still lit as though nothing had
        happened.
      */}
      <DetailsForm
        key={`${product.slug}:${product.name}:${product.amount}:${product.description}`}
        product={product}
        busy={busy}
        onWrite={write}
      />

      <View style={{ gap: theme.space.sm }}>
        <Label>Pictures</Label>
        <Pictures product={product} busy={busy} onError={setFailed} />
        {product.images.length > 1 ? (
          <Micro color={theme.color.inkFaint}>
            The first picture is the one shown on the shelf. Reorder them in Square.
          </Micro>
        ) : null}
      </View>

      <View style={{ gap: theme.space.sm }}>
        <Label>In stock</Label>
        <StockStepper product={product} busy={busy} />
      </View>

      {sections.length > 0 ? (
        <Picker
          label="Category"
          value={pending.section ?? ''}
          options={[
            { value: '', label: 'No category' },
            ...sections.map((row) => ({ value: row.id, label: row.label })),
          ]}
          onChange={(next) => pending.setSection(next === '' ? null : next)}
          disabled={busy}
        />
      ) : null}

      {/*
        Save, without closing the sheet to find the bar.

        The bar at the foot of the shop is the canonical control and is not
        going anywhere — it is what says how many books are waiting. But it is
        *behind this sheet*, and the commonest sequence in here is: take a
        photograph of the cover, watch the tile appear, and want it sent. Making
        that a close-then-hunt was the one place editing in place stopped being
        in place.

        It calls the same `save()` and therefore sends **every** held book, not
        just this one — so the label says how many, in the bar's own words. Two
        controls, one action, and neither of them lies about its scope.
      */}
      {held.count > 0 ? (
        <Button
          label={
            held.saving
              ? 'Saving…'
              : held.count === 1
                ? 'Save this book'
                : `Save ${held.count} books`
          }
          onPress={() => void held.save()}
          disabled={busy}
          busy={held.saving}
        />
      ) : null}

      {/* Keyed, so a half-pressed Remove cannot carry across to another book.
          Nothing else in here needs resetting, which is why it is a key on one
          component rather than one on the panel. */}
      <RemoveProduct
        key={product.slug}
        product={product}
        busy={busy}
        onWrite={write}
        onDone={onRemoved}
      />
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* The three things Square owns                                                */
/* -------------------------------------------------------------------------- */

/**
 * Title, price and description, edited together and saved on demand.
 *
 * ---------------------------------------------------------------------------
 * Not held for the Save bar, and not saved on blur either.
 *
 * The bar exists for the stepper, the category and the pictures — edits that
 * are cheap, reversible, and made across several books in a row. These are none
 * of those. Saving on blur was the website's first attempt at the title and is
 * worse than either: moving the keyboard off a field you only meant to read
 * renames a book in Square, and there is nothing to press to undo it.
 *
 * ## One button for the three
 *
 * `setProductDetails` sends only what actually differs, so pressing Save once
 * after editing all three is one write — and one Square catalog version, which
 * matters because `catalog.version.updated` triggers a full mirror.
 *
 * The boxes re-seed when the sheet moves to a different book *or* when a saved
 * value comes back changed. `product` is the live document, so without the
 * second half a successful save would leave the boxes showing what was typed
 * and the button still lit as though nothing had happened.
 * ---------------------------------------------------------------------------
 */
function DetailsForm({
  product,
  busy,
  onWrite,
}: {
  product: ShopProduct;
  busy: boolean;
  onWrite: (run: () => Promise<void>) => Promise<boolean>;
}) {
  const theme = useTheme();

  /*
   * Dollars as typed, cents when sent. `Math.round`, never `trunc`: `4.35 * 100`
   * is `434.99999999999994` in binary floating point, and truncating charges a
   * cent less than the parish set.
   */
  const asDollars = (cents: number) => (cents / 100).toFixed(2);

  const [name, setName] = useState(product.name);
  const [price, setPrice] = useState(asDollars(product.amount));
  const [description, setDescription] = useState(product.description);

  const title = name.trim().replace(/\s+/g, ' ');
  const blurb = description.trim();
  const cents = parsePrice(price);

  const titleChanged = title.length > 0 && title !== product.name;
  const priceChanged = cents !== null && cents !== product.amount;
  const blurbChanged = blurb !== product.description;
  /* A price box that cannot be parsed blocks Save rather than being ignored —
     silently keeping the old price after somebody typed a new one is worse. */
  const priceBroken = price.trim() !== '' && cents === null;
  const changed = (titleChanged || priceChanged || blurbChanged) && !priceBroken && title.length > 0;

  const save = async () => {
    if (!changed || busy) return;
    await onWrite(async () => {
      const { setProductDetails } = await import('./adminData');
      await setProductDetails(product.slug, {
        ...(titleChanged ? { name: title } : {}),
        ...(priceChanged ? { priceCents: cents } : {}),
        ...(blurbChanged ? { description: blurb } : {}),
      });
    });
  };

  return (
    <View style={{ gap: theme.space.sm }}>
      <Field label="Title" value={name} onChange={setName} readOnly={busy} />

      <Field
        label="Price"
        value={price}
        onChange={setPrice}
        keyboard="numbers-and-punctuation"
        placeholder="15.00"
        invalid={priceBroken}
        readOnly={busy}
        error={priceBroken ? 'A price like 8 or 8.50, up to $1,000.00.' : null}
        hint="In dollars. The till charges this too."
      />

      <Field
        label="Description"
        value={description}
        onChange={setDescription}
        lines={3}
        placeholder="A line about it — shown under the title on the shelf."
        readOnly={busy}
      />

      <Button
        label="Save to Square"
        onPress={() => void save()}
        disabled={busy || !changed}
        busy={busy}
      />

      <Micro color={theme.color.inkFaint}>
        Goes to Square, so the till shows it too. The web address stays as it is, so
        nobody’s bookmark or past receipt breaks.
      </Micro>
    </View>
  );
}

/** "8", "8.50", "$8" → cents; anything else → null. Shared with the add form. */
export function parsePrice(raw: string): number | null {
  const trimmed = raw.trim().replace(/^\$/, '');
  if (!/^\d+(\.\d{0,2})?$/.test(trimmed)) return null;
  const value = Math.round(Number(trimmed) * 100);
  return value > 0 && value <= 100_000 ? value : null;
}

/* -------------------------------------------------------------------------- */
/* Pictures                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Add a photograph, or take one off. Square holds both.
 *
 * Nothing here reaches Square until Save. That was a reversal on the website
 * and is worth keeping: a picture added by mistake used to be in the parish's
 * catalog already, and undoing it meant a second round trip that could itself
 * fail. Held, it is a tile you can take straight back off — and one that never
 * reaches Square at all if you discard.
 *
 * The tiles render saved-minus-removed, then the held additions, which is
 * exactly the order `save()` applies them in — so what is on screen when Save
 * is pressed is what Square ends up holding, including which one is the cover.
 * How a tile looks and what its corner button does is `./Pictures`.
 *
 * **This works from `ShopProduct.images` directly, unlike the website.** There,
 * the shelf renders baked 800px WebP copies out of `public/`, so detaching a
 * photograph needed a second read of the raw document to find the URL Square
 * knows — the whole of `useCatalogDocs`. Here `images` *is* `imagePaths`: the
 * Square CDN URLs, straight off the snapshot. There is nothing to reconcile and
 * no extra read to make.
 */
function Pictures({
  product,
  busy,
  onError,
}: {
  product: ShopProduct;
  busy: boolean;
  onError: (message: string) => void;
}) {
  const theme = useTheme();
  const pending = usePendingEdit(product.slug, {
    stockCount: product.stockCount ?? null,
    section: product.section ?? null,
  });

  const saved = product.images;

  return (
    <View style={{ gap: theme.space.sm }}>
      <PictureRow>
        {saved.map((url, index) => {
          const going = pending.removedImages.includes(url);
          return (
            <PictureTile
              key={url}
              uri={url}
              cover={index === 0 && !going}
              dimmed={going}
              busy={busy}
              action={going ? 'keep' : 'remove'}
              what={product.name}
              onPress={() =>
                going ? pending.unmarkImageRemoved(url) : pending.markImageRemoved(url)
              }
            />
          );
        })}

        {pending.addedImages.map((picture) => (
          <PictureTile
            key={picture.id}
            uri={picture.dataUrl}
            cover={false}
            busy={busy}
            action="drop"
            what={product.name}
            onPress={() => pending.unholdImage(picture.id)}
          />
        ))}
      </PictureRow>

      <PictureSource
        busy={busy}
        onPicked={(pictures) => {
          for (const one of pictures) pending.holdImage(one);
        }}
        onError={onError}
      />

      {saved.length === 0 && pending.addedImages.length === 0 ? (
        <Micro color={theme.color.inkFaint}>
          No pictures yet. The first one added becomes the cover on the shelf.
        </Micro>
      ) : null}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Stock                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Minus, a count, plus — and a switch for "do not count this at all".
 *
 * `null` is not a number and is not zero. Zero takes the book off the shop;
 * `null` means Square is not tracking it, which is the state most of the
 * church's titles are in. The arrows cannot reach `null`, because it has no
 * neighbouring value — the switch is how that state is left and entered.
 */
function StockStepper({ product, busy }: { product: ShopProduct; busy: boolean }) {
  const theme = useTheme();
  const { stockCount, setStock, nudge } = usePendingEdit(product.slug, {
    stockCount: product.stockCount ?? null,
    section: product.section ?? null,
  });

  if (stockCount === null) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
        <Small color={theme.color.inkSoft}>Not counted</Small>
        <Pressable
          onPress={() => setStock(0)}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={`Start counting copies of ${product.name}`}
          style={{ minHeight: 44, justifyContent: 'center' }}
        >
          <Small color={theme.color.accent}>Start counting</Small>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: theme.color.rule,
          borderRadius: theme.radius.sm,
          overflow: 'hidden',
        }}
      >
        <Step
          icon="close"
          label={`One fewer ${product.name}`}
          disabled={busy || stockCount === 0}
          onPress={() => nudge(-1)}
        />
        <View style={{ minWidth: 52, alignItems: 'center' }}>
          <Small color={stockCount === 0 ? theme.color.accent : theme.color.ink}>
            {stockCount}
          </Small>
        </View>
        <Step
          icon="plus"
          label={`One more ${product.name}`}
          disabled={busy}
          onPress={() => nudge(1)}
        />
      </View>

      {/* Zero is the one count worth a word — it takes the book off the shop. */}
      {stockCount === 0 ? <Micro color={theme.color.accent}>sold out</Micro> : null}

      <Pressable
        onPress={() => setStock(null)}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={`Stop counting copies of ${product.name}`}
        style={{ minHeight: 44, justifyContent: 'center' }}
      >
        <Micro color={theme.color.inkSoft}>Stop counting</Micro>
      </Pressable>
    </View>
  );
}

function Step({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: 'plus' | 'close';
  label: string;
  disabled: boolean;
  onPress: () => void;
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

/* -------------------------------------------------------------------------- */
/* Taking a book off the shop                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Nothing destructive without a second step, and the second step says what
 * actually happens — "remove" reads as "delete" and this is an archive.
 *
 * Immediate rather than held, deliberately: a destructive action queued behind
 * a Save is a trap, because the card would sit there looking removed while
 * still being for sale.
 */
function RemoveProduct({
  product,
  busy,
  onWrite,
  onDone,
}: {
  product: ShopProduct;
  busy: boolean;
  onWrite: (run: () => Promise<void>) => Promise<boolean>;
  onDone: () => void;
}) {
  const theme = useTheme();
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button
        label="Remove from the shop…"
        tone="danger"
        onPress={() => setConfirming(true)}
        disabled={busy}
      />
    );
  }

  return (
    <View
      style={{
        gap: theme.space.sm,
        padding: theme.space.sm,
        borderRadius: theme.radius.sm,
        borderWidth: 1,
        borderColor: theme.color.accent,
      }}
    >
      <Small color={theme.color.ink}>Remove “{product.name}”?</Small>
      <Micro color={theme.color.inkSoft}>
        It comes off the shop and is archived in Square. Past orders keep it. Nothing is
        deleted, and Square can bring it back.
      </Micro>

      <View style={{ flexDirection: 'row', gap: theme.space.sm }}>
        <View style={{ flex: 1 }}>
          <Button label="Keep it" tone="quiet" onPress={() => setConfirming(false)} disabled={busy} />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            label="Remove"
            tone="danger"
            busy={busy}
            onPress={() => {
              void (async () => {
                const { archiveProduct } = await import('./adminData');
                const went = await onWrite(() => archiveProduct(product.slug));
                /* Leaving the sheet open on an archived book would show a
                   screen for something the shop no longer has, with controls
                   that all fail. */
                if (went) onDone();
              })();
            }}
          />
        </View>
      </View>
    </View>
  );
}
