/**
 * One item's settings, in the shop editor.
 *
 * ---------------------------------------------------------------------------
 * Three tabs and one Save, at Tommy's direction on the website — the panel
 * there had grown to a 1,200px scroll with two ways of saving: the title,
 * price, description and clearance each sent straight to Square from their own
 * buttons, and everything else waited for a bar at the foot of the shop.
 * Clothing sizes ticked and never saved were the result. This app had the same
 * two ways — "Save to Square" in the sheet, the Save bar under the shelf.
 *
 * Now it is Details / Price & stock / Shipping, and every change to the item is
 * held: a dot marks the tab with unsaved changes, and the footer's Save sends
 * the lot (`saveOne` → `sendOne` in pendingEdits.tsx). Discard puts every field
 * back. Leaving the item with changes held is refused by the editor, so
 * nothing is lost by pressing Back or Done.
 *
 * A box whose text is not a value yet — a price of `12.` — blocks Save rather
 * than being ignored: keeping the old price after somebody typed a new one is
 * worse than asking them to finish typing.
 *
 * Removing an item is the one thing that still acts at once. It has its own
 * confirmation, and a destructive action queued behind a Save is a trap: the
 * item would sit there looking removed while still being for sale.
 * ---------------------------------------------------------------------------
 */
import { useEffect, useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import {
  MAX_SIZE_COUNT,
  MAX_SIZE_EXTRA_CENTS,
  SIZE_PRESETS,
  type BookstoreSection,
  type ProductSize,
} from '@spsm/shared';

import { Check, Field, Problem } from '@/components/Fields';
import { Icon } from '@/components/Icon';
import { Button } from '@/components/Surface';
import { Body, Micro, Small } from '@/components/Type';
import { money } from '@/payments/money';
import { useTheme } from '@/theme/ThemeProvider';

import type { ShopProduct } from '../data';
import { EditTabs, PanelBlock, PanelBody, SaveFooter } from './EditPanel';
import { PictureRow, PictureSource, PictureTile } from './Pictures';
import { CategoryChecklist, ShippingFields, TaxableField } from './ProductFields';
import { actualValues, usePendingEdit, usePendingEdits, type HeldField } from './pendingEdits';

/**
 * Run a write that acts at once — removing the item, which is the only one —
 * and report on it. The boolean says whether it landed, so the caller knows
 * whether to leave.
 */
function useWriter(onError: (message: string) => void) {
  const [busy, setBusy] = useState(false);

  const write = async (run: () => Promise<void>): Promise<boolean> => {
    setBusy(true);
    try {
      await run();
      return true;
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : 'That change was refused.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  return { busy, write };
}

type Tab = 'details' | 'price' | 'shipping';

const TABS: { id: Tab; label: string; fields: readonly HeldField[] }[] = [
  { id: 'details', label: 'Details', fields: ['name', 'description', 'categoryIds'] },
  { id: 'price', label: 'Price & stock', fields: ['priceCents', 'wasPriceCents', 'stockCount', 'sizes'] },
  { id: 'shipping', label: 'Shipping', fields: ['weightOz', 'mediaMail', 'taxable'] },
];

export function ProductSettings({
  product,
  sections,
  onRemoved,
}: {
  product: ShopProduct;
  sections: BookstoreSection[];
  /** Back to the items: the item is no longer on the shop. */
  onRemoved: () => void;
}) {
  const theme = useTheme();
  const [tab, setTab] = useState<Tab>('details');
  /* Boxes holding text that is not a value yet, by field. Any one blocks Save. */
  const [broken, setBroken] = useState<Record<string, boolean>>({});
  /* Bumped by Discard, so every box re-seeds from what is saved. */
  const [round, setRound] = useState(0);
  const [failed, setFailed] = useState<string | null>(null);
  const { busy, write } = useWriter(setFailed);
  const { saveOne, saving, release } = usePendingEdits();
  const pending = usePendingEdit(product.slug, actualValues(product));

  const markBroken = (field: string, is: boolean) =>
    setBroken((was) => (Boolean(was[field]) === is ? was : { ...was, [field]: is }));

  const onSale = pending.wasPriceCents !== null;
  const saleWrong =
    onSale && !(pending.priceCents > 0 && pending.priceCents < (pending.wasPriceCents ?? 0));
  const anyBroken = Object.values(broken).some(Boolean);
  const working = busy || saving;
  const key = `${product.slug}-${round}`;

  const tabDirty = (one: (typeof TABS)[number]) =>
    one.fields.some((field) => pending.changed.includes(field)) ||
    (one.id === 'details' && pending.hasImageEdits);

  const foot = (
    <View style={{ gap: theme.space.sm }}>
      {product.sku ? <Micro color={theme.color.inkFaint}>SKU {product.sku}</Micro> : null}
      <RemoveProduct
        key={product.slug}
        product={product}
        busy={working}
        onWrite={write}
        onDone={onRemoved}
      />
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <EditTabs
        tabs={TABS.map((one) => ({ id: one.id, label: one.label, dirty: tabDirty(one) }))}
        value={tab}
        onChange={setTab}
      />

      <PanelBody>
        {failed ? (
          <Pressable onPress={() => setFailed(null)} accessibilityRole="button" accessibilityLabel="Dismiss">
            <Problem>
              <Body color={theme.color.ink}>{failed}</Body>
            </Problem>
          </Pressable>
        ) : null}

        {tab === 'details' ? (
          <>
            <PanelBlock>
              <TitleField
                key={key}
                value={pending.name}
                busy={working}
                onChange={(name) => pending.setDetails({ name })}
                onBroken={(is) => markBroken('name', is)}
              />
              <Field
                label="Description"
                value={pending.description}
                onChange={(description) => pending.setDetails({ description })}
                lines={3}
                placeholder="A line about it — shown under the title on the shelf."
                readOnly={working}
              />
            </PanelBlock>

            <PanelBlock label="Pictures">
              <Pictures product={product} busy={working} onError={setFailed} />
              {product.images.length > 1 ? (
                <Micro color={theme.color.inkFaint}>The first picture is the one on the shelf.</Micro>
              ) : null}
            </PanelBlock>

            {sections.length > 0 ? (
              <PanelBlock label="Categories">
                <CategoryChecklist
                  sections={sections}
                  chosen={pending.categoryIds}
                  busy={working}
                  onChange={pending.setCategories}
                />
              </PanelBlock>
            ) : null}
          </>
        ) : null}

        {tab === 'price' ? (
          <>
            <PanelBlock>
              <MoneyField
                key={`${key}-regular`}
                label="Price"
                value={onSale ? (pending.wasPriceCents as number) : pending.priceCents}
                busy={working}
                onChange={(cents) =>
                  pending.setDetails(onSale ? { wasPriceCents: cents } : { priceCents: cents })
                }
                onBroken={(is) => markBroken('price', is)}
              />

              <Check
                label="On clearance"
                checked={onSale}
                disabled={working}
                onChange={(on) =>
                  pending.setDetails(
                    on
                      ? // The sale price starts equal to the price, which Save refuses until it is lower.
                        { wasPriceCents: pending.priceCents, priceCents: pending.priceCents }
                      : { priceCents: pending.wasPriceCents ?? pending.priceCents, wasPriceCents: null },
                  )
                }
              />

              {onSale ? (
                <>
                  <MoneyField
                    key={`${key}-sale`}
                    label="Sale price"
                    value={pending.priceCents}
                    blankWhen={pending.wasPriceCents ?? undefined}
                    busy={working}
                    onChange={(cents) => pending.setDetails({ priceCents: cents })}
                    onBroken={(is) => markBroken('sale', is)}
                  />
                  <Micro color={saleWrong ? theme.color.accentStrong : theme.color.inkFaint}>
                    {saleWrong
                      ? `Type a sale price below ${money(pending.wasPriceCents ?? 0)}.`
                      : `${money(pending.wasPriceCents ?? 0)} → ${money(pending.priceCents)}, ` +
                        `${Math.round((((pending.wasPriceCents ?? 0) - pending.priceCents) / (pending.wasPriceCents ?? 1)) * 100)}% off. ` +
                        'Shown under Clearance on the shop and the homepage.'}
                  </Micro>
                </>
              ) : null}
            </PanelBlock>

            <PanelBlock label="Sold as">
              <Segmented
                options={[
                  { label: 'One item', on: pending.sizes === null },
                  { label: 'By size (clothing)', on: pending.sizes !== null },
                ]}
                busy={working}
                onPick={(index) => pending.setSizes(index === 1 ? (pending.sizes ?? []) : null)}
              />
            </PanelBlock>

            <PanelBlock label={pending.sizes !== null ? 'Sizes in stock' : 'In stock'}>
              {pending.sizes !== null ? (
                <ClothingField
                  key={key}
                  name={product.name}
                  priceCents={pending.priceCents}
                  sizes={pending.sizes}
                  busy={working}
                  onChange={pending.setSizes}
                />
              ) : (
                <StockStepper product={product} busy={working} />
              )}
            </PanelBlock>
          </>
        ) : null}

        {tab === 'shipping' ? (
          <>
            <PanelBlock label="Shipping">
              <ShippingFields
                key={key}
                weightOz={pending.weightOz}
                mediaMail={pending.mediaMail}
                busy={working}
                onChange={pending.setShipping}
              />
            </PanelBlock>
            <PanelBlock label="Sales tax">
              <TaxableField taxable={pending.taxable} busy={working} onChange={pending.setTaxable} />
            </PanelBlock>
          </>
        ) : null}

        {foot}
      </PanelBody>

      {/* Always there, so where to save is never a question. */}
      <SaveFooter
        dirty={pending.dirty}
        saving={saving}
        problem={
          anyBroken
            ? 'Fix the box marked in red to save'
            : saleWrong
              ? `Type a sale price below ${money(pending.wasPriceCents ?? 0)} to save`
              : null
        }
        onDiscard={() => {
          release(product.slug);
          setBroken({});
          setRound((n) => n + 1);
        }}
        onSave={() => void saveOne(product.slug)}
      />
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Boxes that keep what is being typed                                        */
/* -------------------------------------------------------------------------- */

/**
 * "8", "8.50", "$8" → cents; anything else → null. Shared with the add form.
 * `Math.round`, never `trunc`: `4.35 * 100` is `434.99999999999994`.
 */
export function parsePrice(raw: string): number | null {
  const trimmed = raw.trim().replace(/^\$/, '');
  if (!/^\d+(\.\d{0,2})?$/.test(trimmed)) return null;
  const value = Math.round(Number(trimmed) * 100);
  return value > 0 && value <= 100_000 ? value : null;
}

/** Dollars as typed to cents, with no bounds — for a size's add-on, which may be 0. */
function parseDollars(text: string): number | null {
  const trimmed = text.trim().replace(/^\$/, '');
  if (!/^\d+(\.\d{0,2})?$/.test(trimmed)) return null;
  return Math.round(Number(trimmed) * 100);
}

/**
 * A box's text, kept apart from the value it stands for.
 *
 * What somebody is halfway through typing — `1.` on the way to `1.50` — is not a
 * value, so only text that reads as one is passed up. The text takes the value
 * back whenever the value changes from outside — a save coming back, another
 * item — which is told apart from the box's own changes by remembering the
 * last value it pushed. The website's `useDraft`.
 */
function useDraft<T>(value: T, format: (value: T) => string) {
  const [text, setText] = useState(() => format(value));
  const pushed = useRef(value);
  useEffect(() => {
    if (!Object.is(value, pushed.current)) {
      pushed.current = value;
      setText(format(value));
    }
    // `format` is a pure function of the value.
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  return {
    text,
    setText,
    push: (next: T) => {
      pushed.current = next;
    },
  };
}

function TitleField({
  value,
  busy,
  onChange,
  onBroken,
}: {
  value: string;
  busy: boolean;
  onChange: (next: string) => void;
  onBroken: (broken: boolean) => void;
}) {
  const draft = useDraft(value, (v) => v);
  const wrong = draft.text.trim().replace(/\s+/g, ' ').length === 0;
  useEffect(() => onBroken(wrong), [wrong]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Field
      label="Title"
      value={draft.text}
      onChange={(text) => {
        draft.setText(text);
        const next = text.trim().replace(/\s+/g, ' ');
        if (next) {
          draft.push(next);
          onChange(next);
        }
      }}
      invalid={wrong}
      error={wrong ? 'A title is needed.' : null}
      readOnly={busy}
    />
  );
}

/**
 * A price in dollars. `blankWhen` shows an empty box for that value — the sale
 * price starts out equal to the price, which is not a sale anybody chose.
 */
function MoneyField({
  label,
  value,
  blankWhen,
  busy,
  onChange,
  onBroken,
}: {
  label: string;
  value: number;
  blankWhen?: number;
  busy: boolean;
  onChange: (cents: number) => void;
  onBroken: (broken: boolean) => void;
}) {
  const draft = useDraft(value, (cents) => (cents === blankWhen ? '' : (cents / 100).toFixed(2)));
  const wrong = draft.text.trim() !== '' && parsePrice(draft.text) === null;
  useEffect(() => onBroken(wrong), [wrong]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Field
      label={`${label}, $`}
      value={draft.text}
      onChange={(text) => {
        draft.setText(text);
        const next = parsePrice(text);
        if (next !== null) {
          draft.push(next);
          onChange(next);
        }
      }}
      keyboard="numbers-and-punctuation"
      placeholder="15.00"
      invalid={wrong}
      error={wrong ? 'A price like 8 or 8.50, up to $1,000.' : null}
      readOnly={busy}
    />
  );
}

/** Two or three choices as one bar, the chosen one filled — the website's `.bkseg`. */
function Segmented({
  options,
  busy,
  onPick,
}: {
  options: { label: string; on: boolean }[];
  busy: boolean;
  onPick: (index: number) => void;
}) {
  const theme = useTheme();

  return (
    <View
      accessibilityRole="radiogroup"
      style={{
        flexDirection: 'row',
        borderWidth: 1,
        borderColor: theme.color.rule,
        borderRadius: theme.radius.sm,
        overflow: 'hidden',
      }}
    >
      {options.map((one, index) => (
        <Pressable
          key={one.label}
          onPress={() => onPick(index)}
          disabled={busy}
          accessibilityRole="radio"
          accessibilityState={{ checked: one.on, disabled: busy }}
          style={({ pressed }) => ({
            flex: 1,
            minHeight: 44,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: theme.space.xs,
            borderLeftWidth: index === 0 ? 0 : 1,
            borderLeftColor: theme.color.rule,
            backgroundColor: one.on
              ? theme.color.accent
              : pressed
                ? theme.color.accentSoft
                : theme.color.paper,
            opacity: busy ? 0.5 : 1,
          })}
        >
          <Small color={one.on ? theme.color.inkInverse : theme.color.ink}>{one.label}</Small>
        </Pressable>
      ))}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Clothing sizes                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Which sizes it comes in, how many of each are on hand, and what a size adds
 * to the price. Shown when "Sold as" is By size. The website's table, as rows.
 *
 * The boxes keep their own text, as the weight box does; only text that reads
 * as a number is passed up.
 */
function ClothingField({
  name,
  priceCents,
  sizes,
  busy,
  onChange,
}: {
  name: string;
  priceCents: number;
  sizes: readonly ProductSize[];
  busy: boolean;
  onChange: (next: readonly ProductSize[]) => void;
}) {
  const theme = useTheme();
  const [texts, setTexts] = useState<Record<string, { count: string; extra: string }>>(() =>
    Object.fromEntries(
      sizes.map((size) => [
        size.label,
        { count: String(size.count), extra: size.extraCents ? (size.extraCents / 100).toFixed(2) : '' },
      ]),
    ),
  );

  const byLabel = new Map(sizes.map((size) => [size.label, size]));
  /** The list with one size replaced, added or removed, kept in preset order. */
  const put = (label: string, next: ProductSize | null) => {
    const merged = new Map(byLabel);
    if (next) merged.set(label, next);
    else merged.delete(label);
    onChange(SIZE_PRESETS.flatMap((one) => merged.get(one) ?? []));
  };

  const textOf = (label: string) => texts[label] ?? { count: '0', extra: '' };
  const setText = (label: string, patch: Partial<{ count: string; extra: string }>) =>
    setTexts((was) => ({ ...was, [label]: { ...(was[label] ?? { count: '0', extra: '' }), ...patch } }));

  /*
   * A box whose text reads as a number other than the held value has been
   * overtaken — a save coming back, or an online sale lowering a count — so it
   * takes the value. Text that does not read as a number yet is somebody
   * mid-typing and is left alone.
   *
   * During render, against the last list seen, rather than in an effect: the
   * "adjusting state when a prop changes" shape, which the compiler rules here
   * accept and which never draws a frame with the stale text.
   */
  const [seen, setSeen] = useState(sizes);
  if (seen !== sizes) {
    setSeen(sizes);
    let next = texts;
    for (const size of sizes) {
      const text = texts[size.label];
      if (!text) continue;
      const count = /^\d+$/.test(text.count.trim()) ? Number(text.count) : null;
      const extra = text.extra.trim() === '' ? 0 : parseDollars(text.extra);
      if ((count !== null && count !== size.count) || (extra !== null && extra !== size.extraCents)) {
        next = {
          ...next,
          [size.label]: {
            count: String(size.count),
            extra: size.extraCents ? (size.extraCents / 100).toFixed(2) : '',
          },
        };
      }
    }
    if (next !== texts) setTexts(next);
  }

  const onHand = sizes.reduce((sum, size) => sum + size.count, 0);

  return (
    <View style={{ gap: theme.space.xs }}>
      <View style={{ flexDirection: 'row', gap: theme.space.xs }}>
        <View style={{ flex: 1 }}>
          <Micro color={theme.color.inkFaint}>Size</Micro>
        </View>
        <View style={{ width: 64 }}>
          <Micro color={theme.color.inkFaint}>On hand</Micro>
        </View>
        <View style={{ width: 72 }}>
          <Micro color={theme.color.inkFaint}>Adds, $</Micro>
        </View>
        <View style={{ width: 60, alignItems: 'flex-end' }}>
          <Micro color={theme.color.inkFaint}>Price</Micro>
        </View>
      </View>

      {SIZE_PRESETS.map((label) => {
        const size = byLabel.get(label);
        const text = textOf(label);
        const countWrong = size !== undefined && !/^\d+$/.test(text.count.trim());
        const extra = text.extra.trim() === '' ? 0 : parseDollars(text.extra);
        const extraWrong = size !== undefined && (extra === null || extra > MAX_SIZE_EXTRA_CENTS);
        return (
          <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.xs }}>
            <View style={{ flex: 1 }}>
              <Check
                label={label}
                checked={size !== undefined}
                disabled={busy}
                onChange={(on) =>
                  put(
                    label,
                    on
                      ? {
                          label,
                          count: /^\d+$/.test(text.count.trim())
                            ? Math.min(MAX_SIZE_COUNT, Number(text.count))
                            : 0,
                          extraCents: extra !== null && extra <= MAX_SIZE_EXTRA_CENTS ? extra : 0,
                        }
                      : null,
                  )
                }
              />
            </View>
            <MiniInput
              width={64}
              label={`How many ${label} of ${name} on hand`}
              value={size ? text.count : ''}
              placeholder="—"
              wrong={countWrong}
              disabled={busy || !size}
              keyboard="numeric"
              onChange={(value) => {
                setText(label, { count: value });
                if (size && /^\d+$/.test(value.trim())) {
                  put(label, { ...size, count: Math.min(MAX_SIZE_COUNT, Number(value.trim())) });
                }
              }}
            />
            <MiniInput
              width={72}
              label={`What ${label} adds to the price, in dollars`}
              value={size ? text.extra : ''}
              placeholder="0"
              wrong={extraWrong}
              disabled={busy || !size}
              keyboard="numbers-and-punctuation"
              onChange={(value) => {
                setText(label, { extra: value });
                const cents = value.trim() === '' ? 0 : parseDollars(value);
                if (size && cents !== null && cents <= MAX_SIZE_EXTRA_CENTS) {
                  put(label, { ...size, extraCents: cents });
                }
              }}
            />
            <View style={{ width: 60, alignItems: 'flex-end' }}>
              <Micro color={theme.color.inkSoft}>{size ? money(priceCents + size.extraCents) : ''}</Micro>
            </View>
          </View>
        );
      })}

      <Micro color={theme.color.inkFaint}>
        {sizes.length === 0
          ? 'Tick the sizes it comes in. Until one is ticked it cannot be bought.'
          : `${onHand} on hand across ${sizes.length} ${sizes.length === 1 ? 'size' : 'sizes'}. ` +
            'Counted on the website only — an online sale lowers the count, a sale on the register does not. ' +
            'A size at 0 shows as sold out.'}
      </Micro>
    </View>
  );
}

/** A small box for one cell of the size table — `Field`'s finish without its label. */
function MiniInput({
  width,
  label,
  value,
  placeholder,
  wrong,
  disabled,
  keyboard,
  onChange,
}: {
  width: number;
  label: string;
  value: string;
  placeholder: string;
  wrong: boolean;
  disabled: boolean;
  keyboard: 'numeric' | 'numbers-and-punctuation';
  onChange: (next: string) => void;
}) {
  const theme = useTheme();

  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      editable={!disabled}
      placeholder={placeholder}
      placeholderTextColor={theme.color.inkFaint}
      keyboardType={keyboard}
      accessibilityLabel={label}
      style={{
        width,
        minHeight: 40,
        paddingHorizontal: theme.space.xs,
        color: theme.color.ink,
        fontFamily: theme.fontFamily.body,
        fontSize: theme.fontSize.small,
        backgroundColor: disabled ? theme.color.paperSunken : theme.color.paper,
        borderColor: wrong ? theme.color.accent : theme.color.rule,
        borderWidth: 1,
        borderRadius: theme.radius.sm,
      }}
    />
  );
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
  const pending = usePendingEdit(product.slug, actualValues(product));

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
  const { stockCount, setStock, nudge } = usePendingEdit(product.slug, actualValues(product));

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
