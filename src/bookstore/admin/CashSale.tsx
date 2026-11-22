/**
 * Recording a sale paid in cash at the bookstore table.
 *
 * ---------------------------------------------------------------------------
 * The point is the counts, not the money.
 *
 * Square-tracked books come off Square's count only when Square sees a paid
 * order, and clothing sizes come off the website's counts only when an order is
 * recorded through a Function. A twenty handed over for a prayer book touched
 * neither, so the shop went on offering copies that had left the building. This
 * sheet sends the sale to `squareCashOrder`, which makes it a real Square order
 * paid with Square's CASH source — the same stock, the same reports — and is
 * refused, with the sentence to show, when the counts cannot cover it.
 *
 * The total here is a preview, worked out the way the basket works it out. The
 * Function has Square price the sale from its own catalog, and the figure it
 * answers with is the one shown once it is recorded.
 *
 * Buyer details are all optional. Most of these sales are anonymous; an email,
 * when one is given, gets the parish's usual confirmation.
 * ---------------------------------------------------------------------------
 */
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { salesTaxCents, taxLabel } from '@spsm/shared';

import { Close, Field, Pair, Problem, Sheet } from '@/components/Fields';
import { Button, Card } from '@/components/Surface';
import { Body, Heading, Label, Micro, Small } from '@/components/Type';
import { money } from '@/payments/money';
import { useTheme } from '@/theme/ThemeProvider';

import { lineName, matches, unitOf, watchCatalog, type Catalog, type ShopProduct } from '../data';

interface Line {
  product: ShopProduct;
  size: string | null;
  quantity: number;
}

/** How many of this — in this size, for clothing — the counts say are on hand. Null: not counted. */
function onHand(product: ShopProduct, size: string | null): number | null {
  if (product.sizes) return product.sizes.find((one) => one.label === size)?.count ?? 0;
  return product.stockCount;
}

/** `"12"`, `"12.5"`, `"12.50"` → cents. Null for anything else. */
function centsOf(text: string): number | null {
  const trimmed = text.trim().replace(/^\$/, '');
  if (!/^\d+(\.\d{0,2})?$/.test(trimmed)) return null;
  return Math.round(Number(trimmed) * 100);
}

export function CashSaleSheet({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const theme = useTheme();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [catalogFailed, setCatalogFailed] = useState<string | null>(null);
  const [term, setTerm] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [tendered, setTendered] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [recorded, setRecorded] = useState<{ total: number; change: number } | null>(null);
  /* One key per sheet, so a retry after a dropped answer records the sale once.
     Lazy initialiser, as BasketSheet explains. */
  const [idempotencyKey] = useState(randomUUID);

  useEffect(
    () =>
      watchCatalog(
        (next) => {
          setCatalog(next);
          setCatalogFailed(null);
        },
        (error) => setCatalogFailed(error.message),
      ),
    [],
  );

  /* The live counts, so a line can never ask for more than is on hand and a
     count that drops while the sheet is open is seen before Record is pressed. */
  const live = useMemo(() => new Map((catalog?.products ?? []).map((one) => [one.slug, one])), [catalog]);
  const current = useMemo(
    () => lines.map((line) => ({ ...line, product: live.get(line.product.slug) ?? line.product })),
    [lines, live],
  );

  const found = useMemo(() => {
    if (term.trim() === '') return [];
    return (catalog?.products ?? []).filter((one) => matches(one, term)).slice(0, 8);
  }, [catalog, term]);

  const subtotal = current.reduce((sum, line) => sum + unitOf(line.product, line.size) * line.quantity, 0);
  const rateBps = catalog?.settings.taxRateBps ?? 0;
  const tax = salesTaxCents(
    current.map((line) => ({
      amountCents: unitOf(line.product, line.size) * line.quantity,
      taxable: line.product.taxable,
    })),
    rateBps,
  );
  const total = subtotal + tax;
  const tenderedCents = tendered.trim() === '' ? null : centsOf(tendered);
  const tenderedProblem =
    tendered.trim() === ''
      ? null
      : tenderedCents === null
        ? 'An amount like 20 or 20.00.'
        : tenderedCents < total
          ? `Less than the total, ${money(total)}.`
          : null;
  const over = current.find((line) => {
    const left = onHand(line.product, line.size);
    return left !== null && line.quantity > left;
  });

  const add = (product: ShopProduct, size: string | null) => {
    setFailed(null);
    setLines((was) => {
      const at = was.findIndex((line) => line.product.slug === product.slug && line.size === size);
      if (at === -1) return [...was, { product, size, quantity: 1 }];
      return was.map((line, index) => (index === at ? { ...line, quantity: line.quantity + 1 } : line));
    });
    setTerm('');
  };

  const change = (index: number, by: number) => {
    setFailed(null);
    setLines((was) =>
      was
        .map((line, at) => (at === index ? { ...line, quantity: line.quantity + by } : line))
        .filter((line) => line.quantity > 0),
    );
  };

  const submit = async () => {
    if (sending || current.length === 0 || over || tenderedProblem) return;
    setSending(true);
    setFailed(null);
    try {
      const { recordCashSale } = await import('./adminData');
      const answer = await recordCashSale({
        lines: current.map((line) => ({ slug: line.product.slug, quantity: line.quantity, size: line.size })),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        ...(tenderedCents !== null ? { tenderedCents } : {}),
        idempotencyKey,
      });
      setRecorded({ total: answer.total, change: answer.change });
    } catch (cause) {
      setFailed(cause instanceof Error ? cause.message : 'The sale could not be recorded.');
    } finally {
      setSending(false);
    }
  };

  const header = (
    <View style={{ flexDirection: 'row', gap: theme.space.sm }}>
      <View style={{ flex: 1, gap: theme.space.xs }}>
        <Label>Bookstore</Label>
        <Heading>Cash sale</Heading>
      </View>
      <Close onPress={recorded ? onDone : onClose} what="the cash sale" />
    </View>
  );

  if (recorded) {
    return (
      <Sheet open onClose={onDone} label="Cash sale recorded" header={header}>
        <Card gap={theme.space.sm}>
          <Heading>Recorded — {money(recorded.total)}</Heading>
          <Body color={theme.color.inkSoft}>
            {recorded.change > 0
              ? `Give ${money(recorded.change)} change.`
              : 'No change due.'}{' '}
            The stock has been taken off, and the sale is in Square as cash.
          </Body>
        </Card>
        <Button label="Done" onPress={onDone} />
      </Sheet>
    );
  }

  return (
    <Sheet open onClose={onClose} label="Record a cash sale" header={header}>
      <Body color={theme.color.inkSoft}>
        For a sale paid in cash at the table. It is recorded in Square as cash and taken off
        the stock, so the shop does not sell the same copy online.
      </Body>

      {catalogFailed ? (
        <Problem>
          <Body color={theme.color.ink}>Could not read the shop: {catalogFailed}</Body>
        </Problem>
      ) : null}

      <Field
        label="Find an item"
        value={term}
        onChange={setTerm}
        placeholder="Title or SKU"
        autoCapitalize="none"
        autoComplete="off"
        readOnly={sending}
      />

      {found.length > 0 ? (
        <View style={{ gap: theme.space.xs }}>
          {found.map((product) => (
            <Found key={product.slug} product={product} onAdd={(size) => add(product, size)} />
          ))}
        </View>
      ) : term.trim() !== '' && catalog ? (
        <Micro color={theme.color.inkFaint}>Nothing in the shop matches that.</Micro>
      ) : null}

      {current.length > 0 ? (
        <Card gap={theme.space.sm}>
          {current.map((line, index) => {
            const left = onHand(line.product, line.size);
            const short = left !== null && line.quantity > left;
            return (
              <View key={`${line.product.slug}-${line.size ?? ''}`} style={{ gap: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
                  <View style={{ flex: 1 }}>
                    <Small color={theme.color.ink}>{lineName(line.product.name, line.size)}</Small>
                    <Micro color={short ? theme.color.accent : theme.color.inkFaint}>
                      {money(unitOf(line.product, line.size))} each
                      {left === null ? '' : short ? ` · only ${left} on hand` : ` · ${left} on hand`}
                    </Micro>
                  </View>
                  <Step label="−" what={`One fewer ${line.product.name}`} onPress={() => change(index, -1)} />
                  <Small color={theme.color.ink}>{line.quantity}</Small>
                  <Step
                    label="+"
                    what={`One more ${line.product.name}`}
                    onPress={() => change(index, 1)}
                    disabled={left !== null && line.quantity >= left}
                  />
                </View>
              </View>
            );
          })}
          <View style={{ gap: 2, paddingTop: theme.space.xs }}>
            {tax > 0 ? (
              <>
                <Micro color={theme.color.inkSoft}>Items {money(subtotal)}</Micro>
                <Micro color={theme.color.inkSoft}>
                  {taxLabel(rateBps)} {money(tax)}
                </Micro>
              </>
            ) : null}
            <Small color={theme.color.ink}>Total {money(total)}</Small>
          </View>
        </Card>
      ) : null}

      <Field
        label="Cash handed over"
        value={tendered}
        onChange={setTendered}
        placeholder={total > 0 ? (total / 100).toFixed(2) : '20.00'}
        keyboard="numbers-and-punctuation"
        hint={
          tenderedCents !== null && !tenderedProblem && tenderedCents > total
            ? `Change: ${money(tenderedCents - total)}`
            : 'Optional. Leave empty for the exact amount.'
        }
        error={tenderedProblem}
        readOnly={sending}
      />

      <Label>Buyer (optional)</Label>
      <Pair>
        <Field label="First name" value={firstName} onChange={setFirstName} autoComplete="off" readOnly={sending} />
        <Field label="Last name" value={lastName} onChange={setLastName} autoComplete="off" readOnly={sending} />
      </Pair>
      <Field
        label="Email"
        value={email}
        onChange={setEmail}
        keyboard="email-address"
        autoCapitalize="none"
        autoComplete="off"
        hint="Given, it gets the usual confirmation email."
        readOnly={sending}
      />
      <Field label="Phone" value={phone} onChange={setPhone} keyboard="phone-pad" autoComplete="off" readOnly={sending} />

      {failed ? (
        <Problem>
          <Body color={theme.color.ink}>{failed}</Body>
        </Problem>
      ) : null}

      <View style={{ flexDirection: 'row', gap: theme.space.sm }}>
        <View style={{ flex: 1 }}>
          <Button label="Cancel" tone="quiet" onPress={onClose} disabled={sending} />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            label={sending ? 'Recording…' : total > 0 ? `Record ${money(total)}` : 'Record sale'}
            onPress={() => void submit()}
            disabled={sending || current.length === 0 || Boolean(over) || Boolean(tenderedProblem)}
            busy={sending}
          />
        </View>
      </View>
    </Sheet>
  );
}

/** A search result: tap to add one, or tap a size for clothing. */
function Found({ product, onAdd }: { product: ShopProduct; onAdd: (size: string | null) => void }) {
  const theme = useTheme();
  const left = product.sizes ? null : product.stockCount;
  const gone = left === 0;

  return (
    <View
      style={{
        gap: theme.space.xs,
        padding: theme.space.sm,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.color.rule,
        backgroundColor: theme.color.paperRaised,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
        <View style={{ flex: 1 }}>
          <Small color={theme.color.ink}>{product.name}</Small>
          <Micro color={theme.color.inkFaint}>
            {money(product.amount)}
            {product.sizes ? '' : left === null ? ' · not counted' : gone ? ' · sold out' : ` · ${left} on hand`}
          </Micro>
        </View>
        {product.sizes ? null : <Step label="Add" what={`Add ${product.name}`} onPress={() => onAdd(null)} disabled={gone} />}
      </View>
      {product.sizes ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.xs }}>
          {product.sizes.map((size) => (
            <Step
              key={size.label}
              label={`${size.label} (${size.count})`}
              what={`Add ${product.name} in size ${size.label}`}
              onPress={() => onAdd(size.label)}
              disabled={size.count <= 0}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** A small outlined press target: a stepper, a size, an Add. */
function Step({
  label,
  what,
  onPress,
  disabled = false,
}: {
  label: string;
  what: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={what}
      accessibilityState={{ disabled }}
      hitSlop={6}
      style={({ pressed }) => ({
        minWidth: 36,
        minHeight: 34,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: theme.space.sm,
        borderRadius: theme.radius.full,
        borderWidth: 1,
        borderColor: theme.color.rule,
        backgroundColor: pressed ? theme.color.paperSunken : theme.color.paperRaised,
        opacity: disabled ? 0.4 : 1,
      })}
    >
      <Small color={theme.color.ink}>{label}</Small>
    </Pressable>
  );
}
