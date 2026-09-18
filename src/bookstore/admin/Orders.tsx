/**
 * The orders queue.
 *
 * ---------------------------------------------------------------------------
 * This screen is a packing list first and a ledger second.
 *
 * The question a volunteer opens it with is "what do I need to put aside before
 * Sunday", not "what did we sell". So it opens on the orders that still need
 * doing, oldest first — the person who has been waiting longest is the one to
 * serve next — and everything else is behind a filter.
 *
 * Money is deliberately not the emphasis. Totals are here because an order has
 * one, but the two controls that matter are "put aside" and "handed over", and
 * both write a single field. Refunding is the exception and is styled as one:
 * it needs a reason, it asks twice, and it is the only thing here that cannot
 * be undone.
 *
 * ## Read once, not subscribed
 *
 * Unlike the shelf, which is two live `onSnapshot` listeners, this is a
 * `getDocs` with a Reload control. Two hundred order documents re-delivered on
 * every fulfilment write is a lot of data over a church's wifi to change one
 * boolean, and the one thing a live listener would buy — two volunteers seeing
 * each other's presses — is a case of two people packing the same table, where
 * they can see each other anyway.
 * ---------------------------------------------------------------------------
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlashList } from '@shopify/flash-list';
import { Pressable, View } from 'react-native';
import { toDate, type FulfillmentStatus } from '@spsm/shared';

import { Close, Field, Problem, Sheet } from '@/components/Fields';
import { Button, Card } from '@/components/Surface';
import { Body, Heading, Label, Micro, Small } from '@/components/Type';
import { money } from '@/payments/money';
import { useTheme } from '@/theme/ThemeProvider';

import { useBookstoreAdmin } from './session';
import type { OrderRow } from './adminData';

type Filter = 'todo' | 'ready' | 'done' | 'all';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'todo', label: 'To put aside' },
  { id: 'ready', label: 'Waiting' },
  { id: 'done', label: 'Handed over' },
  { id: 'all', label: 'Everything' },
];

export function Orders() {
  const theme = useTheme();
  /* Refunding is a Function guarded by `mayManageOrders`, which is the
     bookstore grant and not finance — so a treasurer reading this queue is
     offered everything on it except the one control that would 403. */
  const { canEdit } = useBookstoreAdmin();

  /*
   * What was read, held beside nothing else — so "still loading" is something
   * to *derive* rather than something to set.
   *
   * The obvious arrangement is a `loading | ready | failed` union set at the
   * top of the read, and the read is fired from an effect, so setting it there
   * is a synchronous `setState` inside an effect: a cascading render, and what
   * `react-hooks/set-state-in-effect` is about. `src/forms/admin/Submissions.tsx`
   * hit this first and this is its shape.
   */
  const [loaded, setLoaded] = useState<OrderRow[] | null>(null);
  const [readFailed, setReadFailed] = useState<string | null>(null);
  /** Bumped by Reload. The effect hangs off it rather than off a button. */
  const [nonce, setNonce] = useState(0);
  const [filter, setFilter] = useState<Filter>('todo');
  /** Order ids with a write in flight, so a row cannot be double-pressed. */
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [failed, setFailed] = useState<string | null>(null);
  const [refunding, setRefunding] = useState<OrderRow | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const { listOrders } = await import('./adminData');
        const rows = await listOrders();
        if (cancelled) return;
        setLoaded(rows);
        setReadFailed(null);
      } catch (cause) {
        if (cancelled) return;
        setReadFailed(cause instanceof Error ? cause.message : 'Could not read the orders.');
      }
    })();

    /* A read that lands after Reload was pressed again must not overwrite the
       fresher one behind it. */
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  /* Memoised rather than written as a bare `?? []`, because a fresh empty array
     every render is a changed dependency every render, and three `useMemo`s
     below hang off this one. `ShopScreen` does the same for the catalog. */
  const orders = useMemo(() => loaded ?? [], [loaded]);
  const loading = loaded === null && readFailed === null;

  const shown = useMemo(() => {
    /*
     * Filtered here rather than in the query, and that is a deliberate limit.
     *
     * A `where('fulfillment', …)` alongside `orderBy('createdAt')` needs a
     * composite index per combination, and the whole list is two hundred rows
     * at most. Filtering in memory costs nothing measurable and keeps
     * `firestore.indexes.json` honest about what is actually queried.
     */
    const paid = orders.filter((order) => order.status === 'paid' || order.status === 'refunded');

    if (filter === 'all') return orders;
    if (filter === 'todo') {
      return paid.filter((o) => o.fulfillment === 'unfulfilled' && o.status === 'paid');
    }
    if (filter === 'ready') {
      return paid.filter((o) => o.fulfillment === 'ready' && o.status === 'paid');
    }
    return paid.filter((o) => o.fulfillment === 'collected' || o.status === 'refunded');
  }, [orders, filter]);

  const ordered = useMemo(() => {
    /*
     * Oldest first while there is something to do, newest first once there is
     * not. A queue is served from the front; a record is read from the top.
     */
    const oldestFirst = filter === 'todo' || filter === 'ready';
    return [...shown].sort((a, b) => {
      const at = toDate(a.createdAt)?.getTime() ?? 0;
      const bt = toDate(b.createdAt)?.getTime() ?? 0;
      return oldestFirst ? at - bt : bt - at;
    });
  }, [shown, filter]);

  const counts = useMemo(
    () => ({
      todo: orders.filter((o) => o.status === 'paid' && o.fulfillment === 'unfulfilled').length,
      ready: orders.filter((o) => o.status === 'paid' && o.fulfillment === 'ready').length,
      done: orders.filter((o) => o.fulfillment === 'collected' || o.status === 'refunded').length,
      all: orders.length,
    }),
    [orders],
  );

  const advance = useCallback(async (order: OrderRow, to: FulfillmentStatus) => {
    setFailed(null);
    setBusy((current) => new Set(current).add(order.id));
    try {
      const { setFulfillment } = await import('./adminData');
      await setFulfillment(order.id, to);
      /*
       * Patched locally rather than re-reading the collection.
       *
       * A full reload after every press costs two hundred document reads to
       * change one field, and it makes the row somebody just pressed jump
       * position while their thumb is still on it. The write either succeeded —
       * in which case this is exactly what the server now holds — or it threw,
       * and nothing below runs.
       */
      setLoaded((rows) =>
        rows === null
          ? rows
          : rows.map((row) => (row.id === order.id ? { ...row, fulfillment: to } : row)),
      );
    } catch (cause) {
      setFailed(cause instanceof Error ? cause.message : 'That change was refused.');
    } finally {
      setBusy((current) => {
        const next = new Set(current);
        next.delete(order.id);
        return next;
      });
    }
  }, []);

  /** Reload, from a press. Emptying the answer is what draws "Reading…" again. */
  const reload = () => {
    setLoaded(null);
    setReadFailed(null);
    setNonce((count) => count + 1);
  };

  const header = (
    <View style={{ gap: theme.space.md, paddingBottom: theme.space.md }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.xs }}>
        {FILTERS.map((option) => (
          <Pill
            key={option.id}
            label={option.label}
            count={counts[option.id]}
            on={filter === option.id}
            onPress={() => setFilter(option.id)}
          />
        ))}
      </View>

      {failed ? (
        <Problem>
          <Body color={theme.color.ink}>{failed}</Body>
        </Problem>
      ) : null}

      {loading ? <Body color={theme.color.inkSoft}>Reading the orders…</Body> : null}

      {readFailed !== null ? (
        <Card gap={theme.space.sm}>
          <Heading>Could not read the orders</Heading>
          <Body color={theme.color.inkSoft}>{readFailed}</Body>
          <Button label="Try again" tone="quiet" onPress={reload} />
        </Card>
      ) : null}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.paper }}>
      <FlashList
        data={ordered}
        keyExtractor={(order) => order.id}
        ListHeaderComponent={header}
        contentContainerStyle={{ padding: theme.space.gutter }}
        ListEmptyComponent={
          loaded !== null ? (
            <Card gap={theme.space.sm}>
              <Label>{filter === 'todo' ? 'Nothing to put aside' : 'Nothing here'}</Label>
              <Body color={theme.color.inkSoft}>
                {filter === 'todo'
                  ? 'Every paid order has been dealt with.'
                  : 'No orders match this filter yet.'}
              </Body>
            </Card>
          ) : null
        }
        ListFooterComponent={
          loaded !== null ? (
            <View style={{ paddingTop: theme.space.md }}>
              <Button label="Reload" tone="quiet" onPress={reload} />
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <OrderCard
            order={item}
            busy={busy.has(item.id)}
            canRefund={canEdit}
            onAdvance={(to) => void advance(item, to)}
            onRefund={() => setRefunding(item)}
          />
        )}
      />

      {/* Mounted only while there is an order to refund, which is what makes
          the reason box empty every time it opens — a sentence typed against
          the order you backed out of must never be sent with the next one. */}
      {refunding ? (
        <RefundSheet
          order={refunding}
          onClose={() => setRefunding(null)}
          onDone={() => {
            setRefunding(null);
            /* Re-read here, unlike the fulfilment writes: a refund's `status`
               is set by Square's webhook rather than by us, so the local copy
               genuinely does not know what the server now holds. */
            reload();
          }}
        />
      ) : null}
    </View>
  );
}

function OrderCard({
  order,
  busy,
  canRefund,
  onAdvance,
  onRefund,
}: {
  order: OrderRow;
  busy: boolean;
  canRefund: boolean;
  onAdvance: (to: FulfillmentStatus) => void;
  onRefund: () => void;
}) {
  const theme = useTheme();

  const placed = toDate(order.createdAt);
  const name = [order.buyerFirstName, order.buyerLastName].filter(Boolean).join(' ');
  const refunded = order.status === 'refunded';
  const units = (order.lineItems ?? []).reduce((sum, line) => sum + (line.quantity || 0), 0);

  /*
   * Whether there is anything to do to this order at all. Every control below
   * is gated on `status === 'paid'`, so a pending, failed or refunded order has
   * none — and without this the actions row is a stray rule under an order
   * nobody can act on.
   */
  const actionable = order.status === 'paid';

  return (
    <View style={{ paddingBottom: theme.space.sm }}>
      <View
        style={{
          gap: theme.space.sm,
          padding: theme.space.md,
          borderRadius: theme.radius.md,
          borderWidth: 1,
          borderColor: theme.color.rule,
          backgroundColor: theme.color.paperRaised,
          opacity: refunded ? 0.7 : 1,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.space.sm }}>
          <View style={{ flex: 1, gap: 2 }}>
            {/* The name first, because that is what the order is filed under
                and what a volunteer is holding in their head. Orders taken
                before names were asked for fall back to the address. */}
            <Small color={theme.color.ink}>{name || order.contactEmail}</Small>
            <Micro color={theme.color.inkFaint}>
              {placed
                ? placed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                : 'no date'}
              {' · '}
              {order.shipping ? 'Deliver' : 'Collect'}
              {' · '}
              {units} {units === 1 ? 'book' : 'books'}
              {' · '}
              {money(order.total?.amount ?? 0, order.total?.currency ?? 'USD')}
            </Micro>
          </View>

          <StateTag order={order} />
        </View>

        <View style={{ gap: 2 }}>
          {(order.lineItems ?? []).map((line, index) => (
            <Micro key={`${order.id}-${index}`} color={theme.color.inkSoft}>
              {line.quantity}× {line.name}
            </Micro>
          ))}
        </View>

        {/* Only on a delivery, and only when there is one. It is the one piece
            of personal data on this screen, so it is not drawn where it is not
            used. */}
        {order.shipping && order.shippingAddress ? (
          <Micro color={theme.color.inkSoft}>
            {[
              order.shippingAddress['line1'],
              order.shippingAddress['line2'],
              order.shippingAddress['city'],
              order.shippingAddress['state'],
              order.shippingAddress['postalCode'],
            ]
              .filter(Boolean)
              .join(', ')}
          </Micro>
        ) : null}

        <Micro color={theme.color.inkFaint}>
          {order.contactEmail} · {order.id}
        </Micro>

        {order.refund?.reason ? (
          <Micro color={theme.color.inkSoft}>Refunded: {order.refund.reason}</Micro>
        ) : null}

        {actionable ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.sm }}>
            {order.fulfillment === 'unfulfilled' ? (
              <View style={{ flex: 1, minWidth: 140 }}>
                <Button
                  label={order.shipping ? 'Packed' : 'Put aside'}
                  onPress={() => onAdvance('ready')}
                  disabled={busy}
                />
              </View>
            ) : null}

            {order.fulfillment === 'ready' ? (
              <>
                <View style={{ flex: 1, minWidth: 140 }}>
                  <Button
                    label={order.shipping ? 'Posted' : 'Handed over'}
                    onPress={() => onAdvance('collected')}
                    disabled={busy}
                  />
                </View>
                {/* Reversible, because "put aside" gets pressed on the wrong
                    row. */}
                <View style={{ flex: 1, minWidth: 100 }}>
                  <Button
                    label="Undo"
                    tone="quiet"
                    onPress={() => onAdvance('unfulfilled')}
                    disabled={busy}
                  />
                </View>
              </>
            ) : null}

            {canRefund ? (
              <View style={{ flex: 1, minWidth: 100 }}>
                <Button label="Refund" tone="danger" onPress={onRefund} disabled={busy} />
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** The one-word state, said plainly. */
function StateTag({ order }: { order: OrderRow }) {
  const theme = useTheme();

  const say = (label: string, tone: 'off' | 'wait' | 'done' | 'ready' | 'todo') => {
    const background =
      tone === 'done'
        ? theme.color.accent
        : tone === 'ready'
          ? theme.color.accentSoft
          : tone === 'off'
            ? theme.color.paperSunken
            : theme.color.paperSunken;
    const ink =
      tone === 'done'
        ? theme.color.inkInverse
        : tone === 'ready'
          ? theme.color.accentStrong
          : theme.color.inkSoft;

    return (
      <View
        style={{
          paddingHorizontal: theme.space.xs,
          paddingVertical: 2,
          borderRadius: theme.radius.full,
          backgroundColor: background,
        }}
      >
        <Micro color={ink}>{label}</Micro>
      </View>
    );
  };

  if (order.status === 'refunded') return say('Refunded', 'off');
  if (order.status === 'failed') return say('Payment failed', 'off');
  if (order.status === 'canceled') return say('Cancelled', 'off');
  if (order.status === 'pending') return say('Payment pending', 'wait');

  if (order.fulfillment === 'collected') {
    return say(order.shipping ? 'Posted' : 'Collected', 'done');
  }
  if (order.fulfillment === 'ready') {
    return say(order.shipping ? 'Packed' : 'Waiting', 'ready');
  }
  return say('To do', 'todo');
}

/**
 * Refunding, behind a reason and a second press.
 *
 * The reason is required by the Function too — an untraceable refund on a
 * parish's books is the first thing an audit asks about. Asking here as well
 * means the person is told before they commit rather than after.
 */
function RefundSheet({
  order,
  onClose,
  onDone,
}: {
  order: OrderRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const theme = useTheme();
  const [reason, setReason] = useState('');
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const submit = async () => {
    if (reason.trim().length < 3 || sending) return;
    setSending(true);
    setFailed(null);
    try {
      const { refundOrder } = await import('./adminData');
      await refundOrder(order.id, reason.trim());
      onDone();
    } catch (cause) {
      setFailed(cause instanceof Error ? cause.message : 'The refund could not be sent.');
      setSending(false);
    }
  };

  return (
    <Sheet
      open
      onClose={onClose}
      label="Refund this order"
      header={
        <View style={{ flexDirection: 'row', gap: theme.space.sm }}>
          <View style={{ flex: 1, gap: theme.space.xs }}>
            <Label>Bookstore</Label>
            <Heading>Refund {money(order.total?.amount ?? 0)}?</Heading>
          </View>
          <Close onPress={onClose} what="the refund" />
        </View>
      }
    >

      <Body color={theme.color.inkSoft}>
        The whole order goes back to the card it was paid with, including delivery. The
        church does not take returns, so this is an exception — say why, and your name is
        recorded against it.
      </Body>

      <Field
        label="Reason"
        value={reason}
        onChange={setReason}
        placeholder="Arrived damaged"
        required
        readOnly={sending}
      />

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
            label={sending ? 'Sending…' : 'Refund in full'}
            tone="danger"
            onPress={() => void submit()}
            disabled={sending || reason.trim().length < 3}
            busy={sending}
          />
        </View>
      </View>

      {/* Square reports most refunds as pending for a day or two, and the
          order's status only moves when the webhook says it completed. Saying
          so here stops somebody pressing it again. */}
      <Micro color={theme.color.inkFaint}>
        Square usually takes a few days. The order will show as refunded once it has gone
        through.
      </Micro>
    </Sheet>
  );
}

/** A filter, with how many orders are behind it. */
function Pill({
  label,
  count,
  on,
  onPress,
}: {
  label: string;
  count: number;
  on: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={`${label}, ${count}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.xs,
        paddingVertical: theme.space.xs,
        paddingHorizontal: theme.space.sm,
        borderRadius: theme.radius.full,
        borderWidth: 1,
        borderColor: on ? theme.color.accent : theme.color.rule,
        backgroundColor: on
          ? theme.color.accentSoft
          : pressed
            ? theme.color.paperSunken
            : theme.color.paperRaised,
        minHeight: 34,
      })}
    >
      <Small color={on ? theme.color.accentStrong : theme.color.inkSoft}>{label}</Small>
      <Micro color={theme.color.inkFaint}>{count}</Micro>
    </Pressable>
  );
}
