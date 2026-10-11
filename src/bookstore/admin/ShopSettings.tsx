/**
 * How delivery is priced, and the sales-tax rate — the shop's two money
 * settings, on the editor's Settings tab.
 *
 * ---------------------------------------------------------------------------
 * The mobile port of `ShopSettings`, `ShippingSettings` and `TaxSettings` from
 * the website's `EditControls.tsx`.
 *
 * ## One Save for the two
 *
 * They had a Save button each, as the website's did, and the website gave them
 * the editor's one footer instead — the same words and place as an item's, so
 * where to save is never a question. Save stays off until something has
 * actually changed, so a box nobody touched never reads as an edit.
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
import { useEffect, useState } from 'react';
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

import { Check, Choice, Field } from '@/components/Fields';
import { Label, Micro } from '@/components/Type';
import { money } from '@/payments/money';
import { useTheme } from '@/theme/ThemeProvider';

import { PanelBlock, PanelBody, SaveFooter } from './EditPanel';

type Report<T> = { changed: boolean; valid: boolean; next: T };

/**
 * The editor's Settings tab: delivery and sales tax, saved together with the
 * one footer — the website's `ShopSettings`. Each form says what it would save,
 * whether that differs from what is saved, and whether it can be saved; the
 * footer does the rest.
 */
export function ShopSettings({
  settings,
  taxedCount,
  onDirty,
}: {
  settings: BookstoreConfig;
  /** How many items are marked taxable, so the rate is not set in a vacuum. */
  taxedCount: number;
  /** Holding unsaved changes — the tab's dot, and what refuses leaving it. */
  onDirty: (dirty: boolean) => void;
}) {
  const theme = useTheme();
  /* Bumped by Discard: the two forms remount and re-seed from what is saved. */
  const [round, setRound] = useState(0);
  const [ship, setShip] = useState<Report<BookstoreShipping> | null>(null);
  const [tax, setTax] = useState<Report<number> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = Boolean(ship?.changed || tax?.changed);
  useEffect(() => onDirty(dirty), [dirty, onDirty]);
  useEffect(() => () => onDirty(false), [onDirty]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const { writeShipping, writeTaxRate } = await import('./adminData');
      if (ship?.changed) await writeShipping(ship.next);
      if (tax?.changed) await writeTaxRate(tax.next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <PanelBody>
        <PanelBlock label="Delivery">
          {/*
            Keyed on what is saved as well as on Discard, which is what re-seeds
            the boxes when a save comes back through the live subscription — so
            the footer goes quiet once it has landed, rather than staying lit
            against stale text.
          */}
          <ShippingSettings
            key={`ship-${round}-${JSON.stringify(settings.shipping)}`}
            shipping={settings.shipping}
            flatCents={settings.deliveryCents}
            busy={saving}
            onReport={setShip}
          />
        </PanelBlock>

        <View style={{ height: 1, backgroundColor: theme.color.rule }} />

        <PanelBlock label="Sales tax">
          <TaxSettings
            key={`tax-${round}-${settings.taxRateBps}`}
            taxRateBps={settings.taxRateBps}
            taxed={taxedCount}
            busy={saving}
            onReport={setTax}
          />
        </PanelBlock>
      </PanelBody>

      <SaveFooter
        dirty={dirty}
        saving={saving}
        error={error}
        problem={
          (ship?.changed && !ship.valid) || (tax?.changed && !tax.valid)
            ? 'Fix the box marked in red to save'
            : null
        }
        onDiscard={() => {
          setRound((n) => n + 1);
          setError(null);
        }}
        onSave={() => void save()}
      />
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Delivery                                                                    */
/* -------------------------------------------------------------------------- */

function ShippingSettings({
  shipping,
  flatCents,
  busy,
  onReport,
}: {
  shipping: BookstoreShipping;
  /** The flat delivery charge, shown for reference; set by the office. */
  flatCents: number;
  busy: boolean;
  /** What would be saved, whether it differs, and whether it can be. */
  onReport: (report: Report<BookstoreShipping>) => void;
}) {
  const theme = useTheme();

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
  const nextKey = JSON.stringify(next);
  useEffect(() => {
    onReport({ changed, valid, next: JSON.parse(nextKey) as BookstoreShipping });
    // `onReport` is the parent's setter; the report is a function of these.
  }, [changed, valid, nextKey]); // eslint-disable-line react-hooks/exhaustive-deps

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
            Each item’s weight is set on the item itself. An order with an item that has no
            weight pays the flat rate.
          </Micro>
        </View>
      ) : null}

    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Sales tax                                                                   */
/* -------------------------------------------------------------------------- */

function TaxSettings({
  taxRateBps,
  taxed,
  busy,
  onReport,
}: {
  taxRateBps: number;
  taxed: number;
  busy: boolean;
  onReport: (report: Report<number>) => void;
}) {
  const theme = useTheme();
  const [text, setText] = useState(taxPercentage(taxRateBps));

  const trimmed = text.trim().replace(/%$/, '').trim();
  const value = /^\d{1,2}(\.\d{1,2})?$/.test(trimmed) ? Math.round(Number(trimmed) * 100) : null;
  const valid = value !== null && value <= MAX_TAX_RATE_BPS;
  const changed = valid ? value !== taxRateBps : text !== taxPercentage(taxRateBps);
  useEffect(() => {
    onReport({ changed, valid, next: value ?? taxRateBps });
  }, [changed, valid, value]); // eslint-disable-line react-hooks/exhaustive-deps

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

    </View>
  );
}
