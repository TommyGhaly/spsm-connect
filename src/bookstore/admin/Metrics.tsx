/**
 * What the bookstore did, over a period.
 *
 * ---------------------------------------------------------------------------
 * Every number here is one document read.
 *
 * Nothing on this screen aggregates anything. The shop writes one document per
 * view, cart change and search — never a counter, because a counter tops out
 * near one write per second and fails first on the most popular book — and a
 * scheduled Function adds them up hourly into `bookstoreStats/{period}`. This
 * reads that document and renders it.
 *
 * So the screen is as fast on the busiest week of the year as on the quietest,
 * and nothing an admin does can slow the shop down. The cost is staleness,
 * which is why `computedAt` is on screen rather than assumed away, and why
 * Refresh exists.
 *
 * ## Refresh is not offered to everybody who can read this
 *
 * `refreshBookstoreStats` guards on `mayManageOrders` — the bookstore grant,
 * not finance. A treasurer holding the bookstore slice of `finance` may read
 * every figure here and would get a 403 from that button, so they are not shown
 * it. The website shows it to both and has the same 403 waiting behind it.
 * ---------------------------------------------------------------------------
 */
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import {
  PARISH_TIME_ZONE,
  conversionRate,
  toDate,
  topProducts,
  type BookstoreStats,
  type ProductStats,
} from '@spsm/shared';

import { Problem } from '@/components/Fields';
import { Button, Card } from '@/components/Surface';
import { Body, Heading, Label, Micro, Small } from '@/components/Type';
import { money } from '@/payments/money';
import { useTheme } from '@/theme/ThemeProvider';

import { useBookstoreAdmin } from './session';

interface Period {
  id: string;
  label: string;
  kind: 'day' | 'month';
  key: string;
}

/**
 * Today in the parish's zone — the same key the events are stamped with.
 *
 * The phone's own zone is the one thing that must not decide this: somebody
 * reading the figures from another state is still reading this church's day.
 * `src/bookstore/track.ts` says the same about writing them.
 */
function parishDay(offsetDays = 0): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: PARISH_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(Date.now() - offsetDays * 86_400_000));
}

function parishMonth(offsetMonths = 0): string {
  const now = new Date();
  /* The 15th, so that shifting the month cannot land on a day the target month
     does not have — 31 January minus one month is not a date. */
  const shifted = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offsetMonths, 15));
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: PARISH_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
  }).format(shifted);
}

function periods(): Period[] {
  return [
    { id: 'today', label: 'Today', kind: 'day', key: parishDay(0) },
    { id: 'yesterday', label: 'Yesterday', kind: 'day', key: parishDay(1) },
    { id: 'month', label: 'This month', kind: 'month', key: parishMonth(0) },
    { id: 'last', label: 'Last month', kind: 'month', key: parishMonth(1) },
  ];
}

/**
 * A read, held beside the question it answers.
 *
 * `periodId` is what makes "still loading" derivable: switching period has to
 * show "Reading…" again, and the obvious way to arrange that — clearing the
 * answer as the effect starts — is a synchronous `setState` inside an effect.
 * `src/forms/admin/Submissions.tsx` hit this first and this is its shape.
 *
 * `stats: null` inside a settled read is not a failure: it is a quiet day, or a
 * period the hourly rollup has not written yet.
 */
interface Answer {
  periodId: string;
  stats: BookstoreStats | null;
  names: Map<string, string>;
}

export function Metrics() {
  const theme = useTheme();
  const { canEdit } = useBookstoreAdmin();

  /* Computed once: the four keys are "today" and "this month" as they were
     when the screen opened, and a screen left open overnight recomputing its
     own idea of today under the reader is worse than one that is a day stale
     and says so. */
  const options = useMemo(() => periods(), []);
  const [period, setPeriod] = useState<Period>(options[0]!);
  const [answer, setAnswer] = useState<Answer | null>(null);
  /** A failed read, held beside its period for the same reason the answer is. */
  const [readFailed, setReadFailed] = useState<{ periodId: string; message: string } | null>(
    null,
  );
  /** Bumped by Refresh, so the effect re-runs on the same period. */
  const [nonce, setNonce] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const { readStats, productNames } = await import('./adminData');
        const [stats, names] = await Promise.all([
          readStats(period.kind, period.key),
          productNames(),
        ]);
        if (cancelled) return;
        setAnswer({ periodId: period.id, stats, names });
        setReadFailed(null);
      } catch (cause) {
        if (cancelled) return;
        setReadFailed({
          periodId: period.id,
          message: cause instanceof Error ? cause.message : 'Could not read the statistics.',
        });
      }
    })();

    /* Two periods pressed quickly is two reads in flight, and the slower one
       must not land on top of the faster. */
    return () => {
      cancelled = true;
    };
  }, [period, nonce]);

  /* Only an answer *about the period on screen* counts as one. */
  const ready = answer?.periodId === period.id ? answer : null;
  const wrong = readFailed?.periodId === period.id ? readFailed.message : null;
  const loading = ready === null && wrong === null;

  const refresh = async () => {
    setRefreshing(true);
    setFailed(null);
    try {
      const { refreshStats } = await import('./adminData');
      await refreshStats();
      /* Re-reads the same period. Emptying the answer first is what draws
         "Reading…" again — and this is a press, not an effect. */
      setAnswer(null);
      setReadFailed(null);
      setNonce((count) => count + 1);
    } catch (cause) {
      setFailed(cause instanceof Error ? cause.message : 'Could not refresh.');
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.color.paper }}
      contentContainerStyle={{ padding: theme.space.gutter, gap: theme.space.md }}
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.xs }}>
        {options.map((option) => (
          <PeriodPill
            key={option.id}
            label={option.label}
            on={period.id === option.id}
            onPress={() => setPeriod(option)}
          />
        ))}
      </View>

      {failed ? (
        <Problem>
          <Body color={theme.color.ink}>{failed}</Body>
        </Problem>
      ) : null}

      {loading ? <Body color={theme.color.inkSoft}>Reading…</Body> : null}

      {wrong !== null ? (
        <Card gap={theme.space.sm}>
          <Heading>Could not read the statistics</Heading>
          <Body color={theme.color.inkSoft}>{wrong}</Body>
          <Button
            label="Try again"
            tone="quiet"
            onPress={() => {
              setReadFailed(null);
              setNonce((count) => count + 1);
            }}
          />
        </Card>
      ) : null}

      {/*
        No document is the ordinary state for a quiet day, and for every period
        until the hourly rollup has run at least once. It is not an error and is
        not drawn as one.
      */}
      {ready && !ready.stats ? (
        <Card gap={theme.space.sm}>
          <Heading>Nothing recorded for {period.label.toLowerCase()}</Heading>
          <Body color={theme.color.inkSoft}>
            The figures are added up once an hour.
            {canEdit
              ? ' If the shop has taken an order since the last run, press Refresh.'
              : ''}
          </Body>
        </Card>
      ) : null}

      {ready && ready.stats ? (
        <Report stats={ready.stats} names={ready.names} period={period} />
      ) : null}

      {canEdit ? (
        <Button
          label={refreshing ? 'Recomputing…' : 'Refresh the figures'}
          tone="quiet"
          onPress={() => void refresh()}
          disabled={refreshing}
          busy={refreshing}
        />
      ) : null}
    </ScrollView>
  );
}

function Report({
  stats,
  names,
  period,
}: {
  stats: BookstoreStats;
  names: Map<string, string>;
  period: Period;
}) {
  const theme = useTheme();

  const t = stats.totals;
  const computed = toDate(stats.computedAt);
  const nameOf = (slug: string) => names.get(slug) ?? slug;

  const bought = topProducts(stats, 'unitsSold', 8);

  /*
   * Ranked by covers seen, not by books opened.
   *
   * `topProducts` drops rows whose value is zero, so ranking by the sparser
   * number does not merely reorder the table — it deletes most of it. `views`
   * has the resolution to sort by; `details` is carried in the note beside it,
   * where "34 seen, 0 opened" is the sentence a volunteer can act on: that
   * cover is not working.
   */
  const viewed = topProducts(stats, 'views', 8);

  const abandoned = useMemo(
    () =>
      Object.entries(stats.products)
        // Books put in a basket more often than they were bought. The gap is
        // the interesting number, not either side of it on its own.
        .map(([slug, p]) => ({ slug, gap: p.cartAdds - p.unitsSold, stats: p }))
        .filter((row) => row.gap > 0)
        .sort((a, b) => b.gap - a.gap || a.slug.localeCompare(b.slug))
        .slice(0, 6),
    [stats],
  );

  const zeroSearches = useMemo(
    () =>
      Object.entries(stats.zeroResultSearches)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 10),
    [stats],
  );

  const allSearches = useMemo(
    () =>
      Object.entries(stats.searches)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 10),
    [stats],
  );

  return (
    <View style={{ gap: theme.space.md }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.sm }}>
        <Tile
          label="Sold"
          value={money(t.revenue)}
          note={`${t.orders} ${t.orders === 1 ? 'order' : 'orders'}, ${t.unitsSold} books`}
        />

        {/* Net is shown only when there is something to net off. A permanent
            "refunded $0.00" tile is furniture. */}
        {t.refunded > 0 ? (
          <Tile
            label="Refunded"
            value={money(t.refunded)}
            note={`${t.refundedOrders} of them · net ${money(t.revenue - t.refunded)}`}
          />
        ) : null}

        {/* Only once there is an order to collect. Before that it is "0 / 0"
            under a label about fulfilment. */}
        {t.orders > 0 ? (
          <Tile
            label="Collect / deliver"
            value={`${t.pickupOrders} / ${t.shippedOrders}`}
            note="picked up / delivered"
          />
        ) : null}

        <Tile
          label="Visitors"
          value={String(t.visitors)}
          note={
            period.kind === 'month'
              ? 'busiest single day (daily figures cannot be added up)'
              : 'people in the shop'
          }
        />

        {/*
          `views` is a cover on the shelf, counted once per visitor per period;
          `details` is that book's own sheet opened. They are an order of
          magnitude apart on purpose, so the opened count leads and the covers
          sit under it as the denominator it is.
        */}
        <Tile
          label="Books opened"
          value={String(t.details)}
          note={`${t.views} ${t.views === 1 ? 'cover' : 'covers'} seen`}
        />

        <Tile
          label="Added to basket"
          value={String(t.cartAdds)}
          note={t.cartRemoves > 0 ? `${t.cartRemoves} taken back out` : 'none taken back out'}
        />

        <Tile
          label="Started checkout"
          value={String(t.checkoutStarts)}
          note={`${t.orders} paid${
            t.checkoutStarts > 0 ? ` · ${Math.round((t.orders / t.checkoutStarts) * 100)}% of them` : ''
          }`}
        />

        {t.repeatBuyers > 0 ? (
          <Tile label="Repeat buyers" value={String(t.repeatBuyers)} note="have bought before" />
        ) : null}
      </View>

      <Table
        title="Most bought"
        empty="Nothing sold yet."
        rows={bought.map((row) => ({
          key: row.slug,
          name: nameOf(row.slug),
          value: String(row.value),
          note: row.stats.revenue > 0 ? money(row.stats.revenue) : '',
        }))}
      />

      <Table
        title="Most looked at"
        hint="Covers seen on the shelf, and how many went on to open the book."
        empty="No one has been in the shop yet."
        rows={viewed.map((row) => ({
          key: row.slug,
          name: nameOf(row.slug),
          value: String(row.value),
          /*
           * The rate is dropped entirely when nobody opened the book.
           * `conversionRate` falls back to `views` when `details` is zero, so a
           * cover seen thirty times and never opened clears the sample
           * threshold and prints "0% bought" — a confident verdict on no
           * evidence, about the book rather than about the cover.
           */
          note: [
            `${row.stats.details} opened`,
            row.stats.details > 0 ? describeConversion(row.stats) : '',
          ]
            .filter(Boolean)
            .join(' · '),
        }))}
      />

      <Table
        title="Added but not bought"
        hint="Books people put in a basket but did not buy."
        empty="Nothing was left behind in a basket."
        rows={abandoned.map((row) => ({
          key: row.slug,
          name: nameOf(row.slug),
          value: String(row.gap),
          note: `${row.stats.cartAdds} added, ${row.stats.unitsSold} sold`,
        }))}
      />

      <Table
        title="Searched for, not found"
        hint="Worth thinking about stocking these."
        empty="Every search found something."
        rows={zeroSearches.map(([term, count]) => ({
          key: term,
          name: term,
          value: String(count),
          note: '',
        }))}
      />

      <Table
        title="Searched for"
        empty="No one has used the search yet."
        rows={allSearches.map(([term, count]) => ({
          key: term,
          name: term,
          value: String(count),
          note: '',
        }))}
      />

      <Micro color={theme.color.inkFaint}>
        {computed
          ? `Added up ${computed.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}.`
          : 'Not yet added up.'}{' '}
        Sales come from the orders themselves; everything else is counted in the shop and
        misses anyone browsing with tracking turned off.
      </Micro>
    </View>
  );
}

/**
 * Views per purchase, phrased rather than tabulated.
 *
 * Empty when nobody looked — "0%" and "nobody looked at it" are different
 * facts, and the first is a much harsher thing to print next to a book on no
 * evidence.
 */
function describeConversion(stats: ProductStats): string {
  const rate = conversionRate(stats);
  if (rate === null) return '';
  return `${Math.round(rate)}% bought`;
}

/**
 * One figure.
 *
 * `minWidth` rather than a fixed column count, so the tiles reflow from two
 * across on a phone to three or four on a tablet without this file knowing
 * which it is on.
 */
function Tile({ label, value, note }: { label: string; value: string; note: string }) {
  const theme = useTheme();

  return (
    <View
      style={{
        flexGrow: 1,
        flexBasis: 150,
        gap: 2,
        padding: theme.space.sm,
        borderRadius: theme.radius.sm,
        borderWidth: 1,
        borderColor: theme.color.rule,
        backgroundColor: theme.color.paperRaised,
      }}
    >
      <Micro color={theme.color.inkFaint}>{label.toUpperCase()}</Micro>
      <Heading>{value}</Heading>
      <Micro color={theme.color.inkSoft}>{note}</Micro>
    </View>
  );
}

function Table({
  title,
  hint,
  empty,
  rows,
}: {
  title: string;
  hint?: string;
  empty: string;
  rows: { key: string; name: string; value: string; note: string }[];
}) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.space.xs }}>
      <Label>{title}</Label>
      {hint ? <Micro color={theme.color.inkFaint}>{hint}</Micro> : null}

      {rows.length === 0 ? (
        <Micro color={theme.color.inkSoft}>{empty}</Micro>
      ) : (
        rows.map((row) => (
          <View
            key={row.key}
            style={{
              flexDirection: 'row',
              alignItems: 'baseline',
              gap: theme.space.sm,
              paddingVertical: theme.space.xs,
              borderBottomWidth: 1,
              borderBottomColor: theme.color.rule,
            }}
          >
            <View style={{ flex: 1, gap: 1 }}>
              <Small color={theme.color.ink}>{row.name}</Small>
              {row.note ? <Micro color={theme.color.inkFaint}>{row.note}</Micro> : null}
            </View>
            <Small color={theme.color.inkSoft}>{row.value}</Small>
          </View>
        ))
      )}
    </View>
  );
}

function PeriodPill({
  label,
  on,
  onPress,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={label}
      style={({ pressed }) => ({
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
        justifyContent: 'center',
      })}
    >
      <Small color={on ? theme.color.accentStrong : theme.color.inkSoft}>{label}</Small>
    </Pressable>
  );
}
