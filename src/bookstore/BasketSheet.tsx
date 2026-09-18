/**
 * The basket, the payment, and the receipt — three screens in one sheet.
 *
 * ---------------------------------------------------------------------------
 * Why three screens and not one long form.
 *
 * The website reached the same arrangement by a different road. Its basket was
 * one screen with the lines on the left and the whole payment form squeezed
 * into a 19rem column beside them, and its own note says what that cost: "no
 * form should be that narrow". Splitting it gave the payment the full width.
 *
 * Here there is no width to give — everything is one column already — so the
 * argument is about attention instead, and it lands the same way. A basket is
 * somewhere you change your mind; a payment form is somewhere you concentrate.
 * Putting a card sheet under a list with plus and minus buttons on it invites
 * exactly the misfire it should not.
 *
 * ## What actually charges the card
 *
 * Nothing in this file. `src/payments/square.ts` puts Square's own native sheet
 * on screen and hands the resulting nonce to `/api/square/checkout`, which
 * prices the basket from Square's catalog and charges what Square says. There
 * is deliberately nowhere in that request to put a price — see the header of
 * `squareCheckout.ts`, which explains why a request saying "one Holy Bible,
 * $0.01" has to be impossible rather than merely unlikely.
 *
 * So every total printed here is a *quote*, shown so nobody authorises one
 * number and is charged another. It is never sent.
 * ---------------------------------------------------------------------------
 */
import { randomUUID } from 'expo-crypto';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import {
  MAX_QUANTITY,
  cleanName,
  isUsableAddress,
  looksLikeEmail,
  type BookstoreConfig,
} from '@spsm/shared';

import { Button, Card } from '@/components/Surface';
import { Choice, Close, Field, Pair, Problem, Sheet } from '@/components/Fields';
import { Body, Heading, Label, Micro, Small } from '@/components/Type';
import { Icon } from '@/components/Icon';
import { money } from '@/payments/money';
import {
  payWithCard,
  payWithWallet,
  paymentsAvailable,
  walletAvailable,
} from '@/payments/square';
import { useTheme } from '@/theme/ThemeProvider';

import { Cover } from './Cover';
import { track } from './track';
import type { Basket } from './cart';
import type { ShopProduct } from './data';

/** What was bought, captured at the moment it was paid for. */
interface Receipt {
  orderId: string;
  email: string;
  shipping: boolean;
  lines: { name: string; quantity: number; amount: number }[];
  total: number;
}

type Screen = 'basket' | 'checkout' | 'done';

export function BasketSheet({
  open,
  basket,
  settings,
  products,
  onClose,
  onOpenProduct,
}: {
  open: boolean;
  basket: Basket;
  settings: BookstoreConfig;
  /** The whole shelf, for the suggestions at the foot of the basket. */
  products: ShopProduct[];
  onClose: () => void;
  onOpenProduct: (product: ShopProduct) => void;
}) {
  /*
   * Closed means *gone*, not hidden, and the whole of the reset is that.
   *
   * Which screen is showing and what was bought were state on this component,
   * put back to 'basket' and null by an effect watching `open`. That is a
   * correction rather than a fact, and it needs an extra render to apply — so
   * reopening the sheet after a purchase showed the old receipt for a frame.
   * Unmounting deletes the state instead, and the next open starts on the
   * basket because that is the initial value rather than because something
   * reset it.
   *
   * It also discards the idempotency key held inside `Checkout`, which is the
   * behaviour that matters most: somebody who abandons a half-typed payment
   * form must not come back to it with a stale key attached.
   */
  if (!open) return null;

  return <Open {...{ basket, settings, products, onClose, onOpenProduct }} />;
}

function Open({
  basket,
  settings,
  products,
  onClose,
  onOpenProduct,
}: {
  basket: Basket;
  settings: BookstoreConfig;
  products: ShopProduct[];
  onClose: () => void;
  onOpenProduct: (product: ShopProduct) => void;
}) {
  const [screen, setScreen] = useState<Screen>('basket');
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  return (
    <Sheet
      open
      onClose={onClose}
      label={screen === 'done' ? 'Order confirmed' : 'Your basket'}
      /*
       * One header for all three screens, pinned by `Sheet` above the
       * scroller. Each screen used to draw its own as its first child, which
       * put the way out at the top of a list long enough to need scrolling —
       * and the checkout, the longest of the three, had no ✕ at all, only a
       * back arrow that had scrolled away with everything else.
       *
       * Assembled here rather than passed up from the screens because the
       * three differ by a title and a back arrow, which is less than it costs
       * to thread a header out of each of them.
       */
      header={
        <Head
          title={screen === 'done' ? 'Thank you' : screen === 'checkout' ? 'Checkout' : 'Your basket'}
          what={screen === 'done' ? 'this receipt' : 'your basket'}
          onBack={screen === 'checkout' ? () => setScreen('basket') : null}
          onClose={onClose}
        />
      }
    >
      {screen === 'done' && receipt ? (
        <Done receipt={receipt} settings={settings} onClose={onClose} />
      ) : screen === 'checkout' ? (
        <Checkout
          basket={basket}
          settings={settings}
          onPaid={(paid) => {
            setReceipt(paid);
            setScreen('done');
            // Cleared only once the money has moved. See the note where the
            // receipt is assembled — the lines are read off the basket first.
            basket.clear();
          }}
        />
      ) : (
        <BasketLines
          basket={basket}
          products={products}
          onCheckout={() => setScreen('checkout')}
          onOpenProduct={onOpenProduct}
        />
      )}
    </Sheet>
  );
}

/**
 * The row at the top of all three screens: where you are, and the two ways out
 * of it.
 *
 * The ✕ closes the sheet from anywhere, including mid-payment-form. The back
 * arrow appears only on the checkout, because that is the only screen with
 * somewhere behind it — the basket is the first, and going "back" from a
 * receipt would be going back to a basket that has just been emptied.
 */
function Head({
  title,
  what,
  onBack,
  onClose,
}: {
  title: string;
  /** What the ✕ is dismissing, for the screen reader. Not the same on a receipt. */
  what: string;
  onBack: (() => void) | null;
  onClose: () => void;
}) {
  const theme = useTheme();

  return (
    <View style={{ flexDirection: 'row', gap: theme.space.sm, alignItems: 'center' }}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back to your basket"
          hitSlop={theme.space.sm}
          style={{ minHeight: 44, justifyContent: 'center', paddingRight: theme.space.xs }}
        >
          <Icon name="back" color={theme.color.ink} size={20} />
        </Pressable>
      ) : null}

      <View style={{ flex: 1, gap: theme.space.xs }}>
        <Label>Bookstore</Label>
        <Heading>{title}</Heading>
      </View>

      <Close onPress={onClose} what={what} />
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* 1. What is in it                                                           */
/* -------------------------------------------------------------------------- */

function BasketLines({
  basket,
  products,
  onCheckout,
  onOpenProduct,
}: {
  basket: Basket;
  products: ShopProduct[];
  onCheckout: () => void;
  onOpenProduct: (product: ShopProduct) => void;
}) {
  const theme = useTheme();

  /*
   * What to offer next.
   *
   * The basket was a dead end that only counted — it told you what you had
   * chosen and pointed at Checkout. But the moment somebody has decided to buy
   * one book from a church shop is the moment they are most likely to take a
   * second, and nothing was putting one in front of them.
   *
   * No recommendation data exists and none is invented. This is the rest of the
   * shelf, minus what is already in the basket and minus anything sold out,
   * which on a catalog of eleven is the honest version of "you might also
   * like". Three, because a phone has room for three and because a longer list
   * stops reading as a suggestion and starts reading as the shop again.
   */
  const alsoHere = useMemo(
    () =>
      products
        .filter((product) => !basket.cart[product.slug] && product.stockCount !== 0)
        .slice(0, 3),
    [products, basket.cart],
  );

  return (
    <>
      {basket.lines.length === 0 ? (
        <Body color={theme.color.inkSoft}>
          Nothing in it yet. Everything in the shop can be collected at the church or delivered to
          you.
        </Body>
      ) : (
        <>
          <View style={{ gap: theme.space.sm }}>
            {basket.lines.map(({ product, quantity }) => (
              <Line
                key={product.slug}
                product={product}
                quantity={quantity}
                onBump={(by) => basket.bump(product.slug, by)}
                onRemove={() => basket.setQuantity(product.slug, 0)}
              />
            ))}
          </View>

          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              borderTopWidth: 1,
              borderTopColor: theme.color.rule,
              paddingTop: theme.space.sm,
            }}
          >
            <Small color={theme.color.inkSoft}>
              {basket.count} {basket.count === 1 ? 'book' : 'books'}
            </Small>
            <Body>{money(basket.subtotal)}</Body>
          </View>

          {/* Said here and not only on the payment screen: somebody deciding
              whether to go on should know delivery is extra before they meet a
              form, not after. */}
          <Micro color={theme.color.inkFaint}>
            Delivery, if you choose it, is added at the next step.
          </Micro>

          <Button label="Checkout" onPress={onCheckout} />
        </>
      )}

      {alsoHere.length > 0 ? (
        <View style={{ gap: theme.space.sm, paddingTop: theme.space.sm }}>
          <Label>Also in the shop</Label>
          {alsoHere.map((product) => (
            <Pressable
              key={product.slug}
              onPress={() => onOpenProduct(product)}
              accessibilityRole="button"
              accessibilityLabel={`${product.name}, ${money(product.amount, product.currency)}`}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.space.sm,
                padding: theme.space.xs,
                borderRadius: theme.radius.sm,
                backgroundColor: pressed ? theme.color.paperSunken : 'transparent',
                minHeight: 44,
              })}
            >
              <View style={{ width: 40 }}>
                <Cover slug={product.slug} fallback={product.images[0] ?? null} height={52} />
              </View>
              <View style={{ flex: 1 }}>
                <Small numberOfLines={2}>{product.name}</Small>
              </View>
              <Micro color={theme.color.inkSoft}>
                {money(product.amount, product.currency)}
              </Micro>
            </Pressable>
          ))}
        </View>
      ) : null}
    </>
  );
}

function Line({
  product,
  quantity,
  onBump,
  onRemove,
}: {
  product: ShopProduct;
  quantity: number;
  onBump: (by: number) => void;
  onRemove: () => void;
}) {
  const theme = useTheme();

  return (
    <View style={{ flexDirection: 'row', gap: theme.space.sm, alignItems: 'flex-start' }}>
      <View style={{ width: 48 }}>
        <Cover slug={product.slug} fallback={product.images[0] ?? null} height={64} />
      </View>

      <View style={{ flex: 1, gap: theme.space.xs }}>
        <Small numberOfLines={2}>{product.name}</Small>
        {/* The line's own total, not the unit price. A shopper checking a
            basket is checking the arithmetic, and "$8.00" beside a quantity of
            three is the number that makes them recount. */}
        <Micro color={theme.color.inkSoft}>
          {quantity} × {money(product.amount, product.currency)} ={' '}
          {money(product.amount * quantity, product.currency)}
        </Micro>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.xs }}>
          <Tap
            icon="close"
            label={quantity === 1 ? `Remove ${product.name}` : `One fewer ${product.name}`}
            onPress={() => onBump(-1)}
            disabled={false}
          />
          <View style={{ minWidth: 28, alignItems: 'center' }}>
            <Small>{quantity}</Small>
          </View>
          <Tap
            icon="plus"
            label={`One more ${product.name}`}
            onPress={() => onBump(1)}
            disabled={quantity >= MAX_QUANTITY}
          />

          <Pressable
            onPress={onRemove}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${product.name} from the basket`}
            hitSlop={theme.space.xs}
            style={{
              marginLeft: theme.space.xs,
              minHeight: 44,
              justifyContent: 'center',
              paddingHorizontal: theme.space.xs,
            }}
          >
            <Micro color={theme.color.inkFaint}>Remove</Micro>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function Tap({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: 'plus' | 'close';
  label: string;
  onPress: () => void;
  disabled: boolean;
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
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.radius.sm,
        borderWidth: 1,
        borderColor: theme.color.rule,
        opacity: disabled ? 0.4 : 1,
        backgroundColor: pressed && !disabled ? theme.color.accentSoft : 'transparent',
      })}
    >
      <Icon name={icon} color={theme.color.ink} size={14} />
    </Pressable>
  );
}

/* -------------------------------------------------------------------------- */
/* 2. Paying for it                                                           */
/* -------------------------------------------------------------------------- */

function Checkout({
  basket,
  settings,
  onPaid,
}: {
  basket: Basket;
  settings: BookstoreConfig;
  onPaid: (receipt: Receipt) => void;
}) {
  const theme = useTheme();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [shipping, setShipping] = useState(false);
  const [address, setAddress] = useState({
    line1: '',
    line2: '',
    city: '',
    state: '',
    postalCode: '',
  });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wallet, setWallet] = useState(false);

  const available = paymentsAvailable();

  /*
   * The idempotency key, made once and held across every attempt.
   *
   * Square treats a repeated key as the same payment, which is exactly what a
   * buyer whose first card is declined needs: they try another card, and the
   * retry must not become a second charge. A fresh key per attempt is how that
   * fails, and the way it fails is by charging twice.
   *
   * So it is minted when this screen mounts — which is when the basket moved to
   * checkout — and lives until the screen is left. `onPaid` unmounts it, so a
   * success discards it; going Back and returning mints a new one, which is
   * correct, because that is a different attempt at a basket that may have
   * changed.
   *
   * 45 characters is Square's ceiling and a v4 UUID is 36, so it passes the
   * Function's `.slice(0, 45)` untouched.
   *
   * `useState` with a lazy initialiser rather than `useRef(randomUUID()).current`.
   * Both hold one value for the life of the component, but the `useRef` form
   * calls `randomUUID()` on *every* render and throws the result away, and
   * reads a ref during render — which is the thing the compiler rules in this
   * repo object to elsewhere. This calls it once and never reads a ref.
   */
  const [idempotencyKey] = useState(randomUUID);

  /* Whether this device has a wallet to offer, asked once. */
  useEffect(() => {
    let live = true;
    void walletAvailable().then((can) => {
      if (live) setWallet(can);
    });
    return () => {
      live = false;
    };
  }, []);

  /*
   * Recorded once, on arrival, and paired with `orders` in the rollup to give
   * the drop-off figure. In an effect rather than in the press handler that got
   * us here, so that it is a fact about the screen being reached rather than
   * about which of two buttons reached it.
   */
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    for (const line of basket.lines) track('checkoutStart', { slug: line.product.slug });
  }, [basket.lines]);

  const delivery = shipping ? settings.deliveryCents : 0;
  const charge = basket.subtotal + delivery;

  const addressIncomplete = shipping && !isUsableAddress(address);
  /*
   * The same three checks the Function makes, in the same words where it has
   * them. A form that let somebody reach Square's card sheet and *then* told
   * them their email was malformed would have taken them through a card entry
   * for nothing — the Function refuses after the nonce is minted, which is late
   * enough to be infuriating and early enough that no money moved.
   */
  const ready =
    !busy &&
    available &&
    basket.lines.length > 0 &&
    cleanName(firstName) !== null &&
    cleanName(lastName) !== null &&
    looksLikeEmail(email) &&
    !addressIncomplete;

  const details = useCallback(
    () => ({
      cart: basket.lines.map((line) => ({
        slug: line.product.slug,
        quantity: line.quantity,
      })),
      email: email.trim(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      fulfillment: (shipping ? 'ship' : 'collect') as 'ship' | 'collect',
      address: shipping ? address : undefined,
      idempotencyKey,
    }),
    [basket.lines, email, firstName, lastName, shipping, address, idempotencyKey],
  );

  /**
   * Both buttons end here.
   *
   * `pay` returns null when the sheet was dismissed without paying, which is an
   * ordinary outcome and not an error — so it leaves the form exactly as it
   * was, with the key intact, ready for another go.
   */
  const settle = useCallback(
    async (pay: () => Promise<{ orderId: string; total: number } | null>) => {
      setBusy(true);
      setError(null);
      try {
        /*
         * Read off the basket *before* paying, not after.
         *
         * `onPaid` clears the cart, and the receipt is derived from it — so
         * assembling the lines afterwards produces an empty confirmation.
         * Holding only the order id is what made the website's first
         * confirmation screen a Square reference and two sentences of hedging.
         */
        const lines = basket.lines.map((line) => ({
          name: line.product.name,
          quantity: line.quantity,
          amount: line.product.amount * line.quantity,
        }));

        const result = await pay();
        if (!result) return;

        onPaid({
          orderId: result.orderId,
          email: email.trim(),
          shipping,
          lines,
          // Square's own total, not the quote above it. They agree unless the
          // catalog moved under the basket, and when they disagree the bank
          // statement will say Square's number.
          total: result.total,
        });
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : 'The payment could not be completed.',
        );
      } finally {
        setBusy(false);
      }
    },
    [basket.lines, email, shipping, onPaid],
  );

  return (
    <>
      {!available ? (
        <Problem>
          <Body>
            This copy of the app cannot take a card payment. You can still order at the
            bookstore table after Liturgy, or from the church website.
          </Body>
        </Problem>
      ) : null}

      {error ? (
        <Problem>
          <Body>{error}</Body>
        </Problem>
      ) : null}

      <Pair>
        <Field
          label="First name"
          value={firstName}
          onChange={setFirstName}
          required
          autoCapitalize="words"
          autoComplete="name"
        />
        <Field
          label="Last name"
          value={lastName}
          onChange={setLastName}
          required
          autoCapitalize="words"
          autoComplete="name"
        />
      </Pair>
      {/* The reason both are required, said once rather than under each box. */}
      <Micro color={theme.color.inkFaint}>
        The name the order is put aside under — not necessarily the name on the card.
      </Micro>

      <Field
        label="Email"
        value={email}
        onChange={setEmail}
        placeholder="you@example.com"
        keyboard="email-address"
        autoComplete="email"
        required
        hint="Square sends the receipt here."
        error={email !== '' && !looksLikeEmail(email) ? 'That does not look like an email address.' : null}
      />

      <Choice
        label="Collection or delivery"
        options={[
          { value: 'collect', label: 'Collect at the church' },
          {
            value: 'ship',
            label: 'Deliver it to me',
            note: settings.deliveryCents > 0 ? money(settings.deliveryCents) : 'Free',
          },
        ]}
        chosen={[shipping ? 'ship' : 'collect']}
        onChange={(next) => setShipping(next[0] === 'ship')}
      />

      {shipping ? (
        <View style={{ gap: theme.space.sm }}>
          <Field label="Address" value={address.line1} onChange={(v) => setAddress((a) => ({ ...a, line1: v }))} required />
          <Field
            label="Address line 2"
            value={address.line2}
            onChange={(v) => setAddress((a) => ({ ...a, line2: v }))}
          />
          <Field label="Town or city" value={address.city} onChange={(v) => setAddress((a) => ({ ...a, city: v }))} required />
          <Pair>
            <Field label="State" value={address.state} onChange={(v) => setAddress((a) => ({ ...a, state: v }))} required />
            <Field
              label="ZIP"
              value={address.postalCode}
              onChange={(v) => setAddress((a) => ({ ...a, postalCode: v }))}
              keyboard="numbers-and-punctuation"
              required
            />
          </Pair>
        </View>
      ) : null}

      <Card gap={theme.space.xs}>
        <Row label={`${basket.count} ${basket.count === 1 ? 'book' : 'books'}`} value={money(basket.subtotal)} />
        {shipping ? <Row label="Delivery" value={money(delivery)} /> : null}
        <View style={{ height: 1, backgroundColor: theme.color.rule, marginVertical: theme.space.xs }} />
        <Row label="Total" value={money(charge)} strong />
      </Card>

      {/*
        The returns policy, before the card and not after it. The church
        publishes a no-returns policy, and a policy somebody meets on the
        receipt is one they did not agree to.
      */}
      {settings.returnsNotice !== '' ? (
        <Micro color={theme.color.inkFaint}>{settings.returnsNotice}</Micro>
      ) : null}

      <View style={{ gap: theme.space.sm }}>
        {/*
          The wallet first where there is one, because it is both the faster
          path and the one that needs no typing. Card entry stays visible under
          it rather than behind an "other ways to pay" — a buyer without the
          wallet configured must not have to discover the ordinary option.
        */}
        {wallet ? (
          <Button
            label="Pay with wallet"
            busy={busy}
            disabled={!ready}
            /*
             * The wallet sheet wants a bare decimal string — "12.34", not
             * "$12.34" — so this is `toFixed` off the integer cents rather than
             * the formatted price with its symbol stripped back off. Same
             * number either way today; the difference is that a currency whose
             * format puts the symbol somewhere else, or a locale that groups
             * with a full stop, breaks the stripping and not this.
             *
             * It is a *display* total regardless. What is charged is decided by
             * Square from its own catalog — see the header of this file.
             */
            onPress={() => void settle(() => payWithWallet(details(), (charge / 100).toFixed(2)))}
          />
        ) : null}

        <Button
          label={`Pay ${money(charge)} by card`}
          tone={wallet ? 'quiet' : 'primary'}
          busy={busy}
          disabled={!ready}
          onPress={() => void settle(() => payWithCard(details()))}
        />
      </View>

      {/*
        Why the button is off, when it is off and the form looks filled in. A
        disabled control with no explanation is the commonest way a checkout
        loses somebody.
      */}
      {!ready && available && !busy ? (
        <Micro color={theme.color.inkFaint}>
          {basket.lines.length === 0
            ? 'There is nothing in the basket.'
            : addressIncomplete
              ? 'A full delivery address is needed — street, town, state and ZIP.'
              : 'A first name, a last name and an email address are needed.'}
        </Micro>
      ) : null}
    </>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  const theme = useTheme();

  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <Small color={strong ? theme.color.ink : theme.color.inkSoft}>{label}</Small>
      {strong ? <Body>{value}</Body> : <Small color={theme.color.inkSoft}>{value}</Small>}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* 3. The receipt                                                             */
/* -------------------------------------------------------------------------- */

/**
 * What was bought, said back.
 *
 * Every figure here was captured before the basket was cleared, which is why
 * this can print the books rather than an order reference and an apology.
 */
function Done({
  receipt,
  settings,
  onClose,
}: {
  receipt: Receipt;
  settings: BookstoreConfig;
  onClose: () => void;
}) {
  const theme = useTheme();

  return (
    <>
      <Body color={theme.color.inkSoft}>
        {receipt.shipping
          ? 'Your order will be delivered to the address you gave. Square has emailed the receipt to '
          : 'Your order will be put aside at the church. Square has emailed the receipt to '}
        {receipt.email}.
      </Body>

      <Card gap={theme.space.xs}>
        {receipt.lines.map((line) => (
          <Row
            key={line.name}
            label={line.quantity > 1 ? `${line.quantity} × ${line.name}` : line.name}
            value={money(line.amount)}
          />
        ))}
        <View style={{ height: 1, backgroundColor: theme.color.rule, marginVertical: theme.space.xs }} />
        <Row label="Paid" value={money(receipt.total)} strong />
      </Card>

      {/*
        The order reference, small and last. It matters only if something has
        gone wrong, and leading with it makes a confirmation read like an
        incident number.
      */}
      <Micro color={theme.color.inkFaint}>Order {receipt.orderId}</Micro>

      {settings.orderEmail !== '' ? (
        <Micro color={theme.color.inkFaint}>
          If anything is wrong with it, write to {settings.orderEmail}.
        </Micro>
      ) : (
        <Micro color={theme.color.inkFaint}>
          If anything is wrong with it, contact the church office.
        </Micro>
      )}

      <Button label="Done" onPress={onClose} />
    </>
  );
}
