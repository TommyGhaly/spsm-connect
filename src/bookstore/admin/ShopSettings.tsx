/**
 * How delivery is priced, and the sales-tax rate — the shop's two money
 * settings, in one sheet off the Manage pill.
 *
 * ---------------------------------------------------------------------------
 * The mobile port of `ShippingSettings` and `TaxSettings` from the website's
 * `EditControls.tsx`, which live in its shop-wide inspector panel. A phone has
 * no inspector, so they get a sheet of their own, reached the way the category
 * editor is.
 *
 * ## Saved with their own buttons, not the bar
 *
 * The bar holds per-book edits made in a run across the shelf. Each of these is
 * one decision about money, made once, and an explicit Save is the honest
 * control for it — the same reasoning as a book's title and price. Save stays
 * off until something has actually changed, so a box nobody touched never
 * reads as an edit.
 *
 * ## Laid out as a question first
 *
 * Flat rate or USPS rates, and only the USPS details once USPS is chosen —
 * each field on its own row, with its unit in the label and a line saying what
 * it does. That is the website's second layout, after the first one was a wall
 * of boxes. Weights are per book, in each book's own sheet.
 *
 * ## What the rules allow
 *
 * Both are direct Firestore writes to `config/bookstore`, which the rules admit
 * from the bookstore grant for `sections`, `shipping` and `taxRateBps` only.
 * `isShippingSettings` checks the block's shape and bounds, so `writeShipping`
 * always sends the whole block; the flat delivery charge itself is not
 * writable from here (or from the website) and is shown only for reference.
 * ---------------------------------------------------------------------------
 */
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import {
  MAX_BOX_INCHES,
  MAX_HANDLING_CENTS,
  MAX_TAX_RATE_BPS,
  SERVICE_DAYS,
  SERVICE_LABELS,
  SHIPPING_SERVICES,
  ouncesToPounds,
  taxPercentage,
  type BookstoreConfig,
  type BookstoreShipping,
  type ShippingService,
} from '@spsm/shared';

import { Check, Choice, Close, Field, Problem, Sheet } from '@/components/Fields';
import { Button } from '@/components/Surface';
import { Body, Heading, Label, Micro } from '@/components/Type';
import { money } from '@/payments/money';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Busy while a save is in flight, "Saved" for a moment after one lands, and the
 * refusal in words when it does not. `ProductSettings` has the same shape; this
 * one reports to the sheet's single error slot.
 */
function useWriter(onError: (message: string | null) => void) {
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const write = async (run: () => Promise<void>) => {
    setBusy(true);
    onError(null);
    try {
      await run();
      setSaved(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setSaved(false), 1800);
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : 'That change was refused.');
    } finally {
      setBusy(false);
    }
  };

  return { busy, saved, write };
}

/**
 * Mounted only while open, like the category editor, so a half-typed handling
 * fee goes with the sheet rather than coming back next time.
 */
export function ShopSettings({
  settings,
  taxedCount,
  onClose,
}: {
  settings: BookstoreConfig;
  /** How many books are marked taxable, so the rate is not set in a vacuum. */
  taxedCount: number;
  onClose: () => void;
}) {
  const theme = useTheme();
  const [failed, setFailed] = useState<string | null>(null);

  return (
    <Sheet
      open
      onClose={onClose}
      label="Shipping and sales tax"
      header={
        <View style={{ flexDirection: 'row', gap: theme.space.sm }}>
          <View style={{ flex: 1, gap: theme.space.xs }}>
            <Label>Bookstore</Label>
            <Heading>Shipping & tax</Heading>
          </View>
          <Close onPress={onClose} what="the shipping and tax settings" />
        </View>
      }
    >
      {failed ? (
        <Problem>
          <Body color={theme.color.ink}>{failed}</Body>
        </Problem>
      ) : null}

      {/*
        Keyed on what is saved, which is what re-seeds the boxes when a save
        comes back through the live subscription — so the button goes quiet
        once it has landed, rather than staying lit against stale text. The
        same arrangement as the book's own details form.
      */}
      <ShippingSettings
        key={JSON.stringify(settings.shipping)}
        shipping={settings.shipping}
        flatCents={settings.deliveryCents}
        onError={setFailed}
      />

      <View style={{ height: 1, backgroundColor: theme.color.rule }} />

      <TaxSettings
        key={settings.taxRateBps}
        taxRateBps={settings.taxRateBps}
        taxed={taxedCount}
        onError={setFailed}
      />
    </Sheet>
  );
}

/* -------------------------------------------------------------------------- */
/* Delivery                                                                    */
/* -------------------------------------------------------------------------- */

function ShippingSettings({
  shipping,
  flatCents,
  onError,
}: {
  shipping: BookstoreShipping;
  /** The flat delivery charge, shown for reference; set by the office. */
  flatCents: number;
  onError: (message: string | null) => void;
}) {
  const theme = useTheme();
  const { busy, saved, write } = useWriter(onError);

  const [draft, setDraft] = useState(shipping);
  // What is typed, kept as text so a half-typed "1." is not rewritten.
  const [text, setText] = useState(() => ({
    handling: (shipping.handlingCents / 100).toFixed(2),
    lengthIn: String(shipping.box.lengthIn),
    widthIn: String(shipping.box.widthIn),
    heightIn: String(shipping.box.heightIn),
    tare: ouncesToPounds(shipping.box.tareOz),
  }));

  const dollars = (value: string): number | null => {
    const trimmed = value.trim().replace(/^\$/, '');
    if (!/^\d*(\.\d{0,2})?$/.test(trimmed) || trimmed === '' || trimmed === '.') return null;
    // `Math.round`, never `trunc`: 1.15 * 100 is 114.99999999999999.
    const cents = Math.round(Number(trimmed) * 100);
    return cents <= MAX_HANDLING_CENTS ? cents : null;
  };
  const number = (value: string, min: number, max: number): number | null => {
    const n = Number(value.trim());
    return value.trim() !== '' && Number.isFinite(n) && n >= min && n <= max ? n : null;
  };

  const handlingCents = dollars(text.handling);
  const lengthIn = number(text.lengthIn, 1, MAX_BOX_INCHES);
  const widthIn = number(text.widthIn, 1, MAX_BOX_INCHES);
  const heightIn = number(text.heightIn, 1, MAX_BOX_INCHES);
  // Five pounds of empty box is well past any carton the parish posts in, and
  // inside the rules' 80 oz bound.
  const tareLb = number(text.tare, 0, 5);
  const zipOk = /^\d{5}$/.test(draft.originZip);
  const live = draft.mode === 'usps';

  /* Only the USPS details need to be right for flat to be saved — a flat shop
     never reads them. */
  const valid =
    !live ||
    (zipOk &&
      handlingCents !== null &&
      lengthIn !== null &&
      widthIn !== null &&
      heightIn !== null &&
      tareLb !== null &&
      draft.services.length > 0);

  const next: BookstoreShipping = {
    ...draft,
    handlingCents: handlingCents ?? draft.handlingCents,
    box: {
      lengthIn: lengthIn ?? draft.box.lengthIn,
      widthIn: widthIn ?? draft.box.widthIn,
      heightIn: heightIn ?? draft.box.heightIn,
      /* Untouched text keeps the stored ounces: 6 oz shows as 0.38 lb, and
         converting that back would read as an edit nobody made. */
      tareOz:
        tareLb === null || text.tare === ouncesToPounds(draft.box.tareOz)
          ? draft.box.tareOz
          : Math.round(tareLb * 1600) / 100,
    },
  };
  const changed = JSON.stringify(next) !== JSON.stringify(shipping);

  const type = (key: keyof typeof text) => (value: string) =>
    setText((was) => ({ ...was, [key]: value }));

  const toggleService = (service: ShippingService, on: boolean) =>
    setDraft((was) => ({
      ...was,
      // Kept in the canonical order, which is the order the shopper sees.
      services: SHIPPING_SERVICES.filter((one) => (one === service ? on : was.services.includes(one))),
    }));

  return (
    <View style={{ gap: theme.space.sm }}>
      <Choice
        label="How is delivery priced?"
        options={[
          { value: 'flat', label: 'Flat rate', note: `${money(flatCents)} every delivery` },
          { value: 'usps', label: 'USPS rates', note: 'by weight and ZIP' },
        ]}
        chosen={[draft.mode]}
        onChange={(picked) =>
          setDraft((was) => ({ ...was, mode: picked[0] === 'usps' ? 'usps' : 'flat' }))
        }
      />

      {live ? (
        <View style={{ gap: theme.space.sm }}>
          <Field
            label="Ship from ZIP code"
            value={draft.originZip}
            onChange={(value) => setDraft((was) => ({ ...was, originZip: value.trim() }))}
            keyboard="numeric"
            invalid={!zipOk}
            readOnly={busy}
            error={zipOk ? null : 'Five digits.'}
            hint="Where parcels are posted from."
          />

          <Field
            label="Handling fee, $"
            value={text.handling}
            onChange={type('handling')}
            keyboard="numbers-and-punctuation"
            invalid={handlingCents === null}
            readOnly={busy}
            error={
              handlingCents === null
                ? `Dollars and cents, up to ${money(MAX_HANDLING_CENTS)}.`
                : null
            }
            hint="Added once per order, on top of postage. 0 for none."
          />

          <View style={{ gap: theme.space.xs }}>
            <View style={{ flexDirection: 'row', gap: theme.space.sm }}>
              {(
                [
                  ['lengthIn', 'Length, in', lengthIn],
                  ['widthIn', 'Width, in', widthIn],
                  ['heightIn', 'Height, in', heightIn],
                ] as const
              ).map(([key, label, parsed]) => (
                <View key={key} style={{ flex: 1 }}>
                  <Field
                    label={label}
                    value={text[key]}
                    onChange={type(key)}
                    keyboard="numbers-and-punctuation"
                    invalid={parsed === null}
                    readOnly={busy}
                  />
                </View>
              ))}
            </View>
            <Micro color={theme.color.inkFaint}>
              The box you usually use, length × width × height, 1 to {MAX_BOX_INCHES} inches each.
            </Micro>
          </View>

          <Field
            label="Empty box weight, lb"
            value={text.tare}
            onChange={type('tare')}
            keyboard="numbers-and-punctuation"
            invalid={tareLb === null}
            readOnly={busy}
            error={tareLb === null ? 'Pounds, from 0 to 5.' : null}
            hint="Added to the books’ weight, with the packing."
          />

          <View style={{ gap: 0 }}>
            <Label>Services buyers can choose</Label>
            {SHIPPING_SERVICES.map((service) => (
              <Check
                key={service}
                label={SERVICE_LABELS[service]}
                checked={draft.services.includes(service)}
                disabled={busy}
                onChange={(on) => toggleService(service, on)}
                hint={`${SERVICE_DAYS[service]}${
                  service === 'MEDIA_MAIL' ? ' · only when every item is a book or media' : ''
                }`}
              />
            ))}
            {draft.services.length === 0 ? (
              <Micro color={theme.color.accentStrong}>Choose at least one.</Micro>
            ) : null}
          </View>

          <Micro color={theme.color.inkFaint}>
            Each book’s weight is set in the book’s own sheet. An order with a book that has no
            weight pays the flat rate.
          </Micro>
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
        <View style={{ flex: 1 }}>
          <Button
            label={busy ? 'Saving…' : 'Save shipping'}
            onPress={() =>
              void write(async () => {
                const { writeShipping } = await import('./adminData');
                await writeShipping(next);
              })
            }
            disabled={busy || !changed || !valid}
            busy={busy}
          />
        </View>
        <SaveState saved={saved} dirty={changed} />
      </View>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Sales tax                                                                   */
/* -------------------------------------------------------------------------- */

function TaxSettings({
  taxRateBps,
  taxed,
  onError,
}: {
  taxRateBps: number;
  taxed: number;
  onError: (message: string | null) => void;
}) {
  const theme = useTheme();
  const { busy, saved, write } = useWriter(onError);
  const [text, setText] = useState(taxPercentage(taxRateBps));

  const trimmed = text.trim().replace(/%$/, '').trim();
  const value = /^\d{1,2}(\.\d{1,2})?$/.test(trimmed) ? Math.round(Number(trimmed) * 100) : null;
  const valid = value !== null && value <= MAX_TAX_RATE_BPS;
  const changed = valid && value !== taxRateBps;

  return (
    <View style={{ gap: theme.space.sm }}>
      <Field
        label="Sales tax rate, %"
        value={text}
        onChange={setText}
        keyboard="numbers-and-punctuation"
        invalid={!valid}
        readOnly={busy}
        error={valid ? null : `A percentage like 6.25, up to ${MAX_TAX_RATE_BPS / 100}%.`}
        hint={`Massachusetts is 6.25%. Applied only to items marked taxable${
          taxed > 0 ? ` — ${taxed} ${taxed === 1 ? 'item is' : 'items are'} now.` : ' — none are yet.'
        } Delivery is never taxed.`}
      />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
        <View style={{ flex: 1 }}>
          <Button
            label={busy ? 'Saving…' : 'Save tax rate'}
            onPress={() =>
              void write(async () => {
                const { writeTaxRate } = await import('./adminData');
                await writeTaxRate(value as number);
              })
            }
            disabled={busy || !changed}
            busy={busy}
          />
        </View>
        <SaveState saved={saved} dirty={changed} />
      </View>
    </View>
  );
}

function SaveState({ saved, dirty }: { saved: boolean; dirty: boolean }) {
  const theme = useTheme();
  if (saved) return <Micro color={theme.color.accentStrong}>Saved</Micro>;
  if (dirty) return <Micro color={theme.color.accent}>Edited</Micro>;
  return null;
}
