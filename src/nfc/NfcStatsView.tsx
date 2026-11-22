/**
 * The NFC tag statistics, in the app — the same report as the website's
 * /admin/nfc, drawn with the bookstore Metrics screen's furniture.
 *
 * Who sees what is decided by the caller (`NfcScreen`) and by the rules: the
 * `nfc` grant opens the counts, and the money section is drawn only when
 * `withRevenue` says the reader also holds Finance. As on the website, a
 * reader without Finance is not told there is a money section at all.
 *
 * Taps, not people; steps are visits that reached them; money is what Square
 * charged, before any refund. See `packages/shared/src/analytics/nfc.ts`.
 */
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import {
  NFC_ACTION_LABELS,
  NFC_FUNNELS,
  NFC_PATHS,
  NFC_PATH_LABELS,
  NFC_PLATFORMS,
  NFC_PLATFORM_LABELS,
  NFC_SLUGS,
  NFC_SLUG_LABELS,
  nfcPercent,
  summarizeNfcStats,
  type NfcSlug,
  type NfcSlugRevenue,
} from '@spsm/shared';

import { Button, Card } from '@/components/Surface';
import { Body, Heading, Label, Micro, Small } from '@/components/Type';
import { money } from '@/payments/money';
import { useTheme } from '@/theme/ThemeProvider';

import { NFC_RANGES, readNfcPeriod, type NfcReading } from './stats';

/** An answer is held beside the request it answers, so a stale one is never drawn. */
type Answer = { key: string } & ({ kind: 'ready'; reading: NfcReading } | { kind: 'failed' });

export function NfcStatsView({ withRevenue }: { withRevenue: boolean }) {
  const theme = useTheme();
  const [days, setDays] = useState<number>(30);
  const [nonce, setNonce] = useState(0);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const key = `${days}:${withRevenue ? 1 : 0}:${nonce}`;

  useEffect(() => {
    let cancelled = false;
    readNfcPeriod(days, withRevenue)
      .then((reading) => {
        if (!cancelled) setAnswer({ key, kind: 'ready', reading });
      })
      .catch((error: unknown) => {
        console.warn('[nfc] could not read the statistics', error);
        if (!cancelled) setAnswer({ key, kind: 'failed' });
      });
    // Two periods pressed quickly: the slower read must not land on the faster.
    return () => {
      cancelled = true;
    };
  }, [days, withRevenue, key]);

  // Only an answer about the request on screen counts; anything else is "reading".
  const load = answer?.key === key ? answer : ({ kind: 'loading' } as const);

  return (
    <View style={{ gap: theme.space.md }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.xs }}>
        {NFC_RANGES.map((range) => (
          <Pill key={range.days} label={range.label} on={days === range.days} onPress={() => setDays(range.days)} />
        ))}
      </View>

      {load.kind === 'loading' ? <Body color={theme.color.inkSoft}>Reading…</Body> : null}

      {load.kind === 'failed' ? (
        <Card gap={theme.space.sm}>
          <Heading>Could not read the statistics</Heading>
          <Body color={theme.color.inkSoft}>Check your connection and try again.</Body>
          <Button label="Try again" tone="quiet" onPress={() => setNonce((n) => n + 1)} />
        </Card>
      ) : null}

      {load.kind === 'ready' ? <Report reading={load.reading} /> : null}
    </View>
  );
}

function Report({ reading }: { reading: NfcReading }) {
  const theme = useTheme();
  const summary = summarizeNfcStats(reading.bySlug);

  if (summary.scans === 0) {
    return (
      <Card gap={theme.space.sm}>
        <Heading>No taps in this period</Heading>
        <Body color={theme.color.inkSoft}>
          Taps are counted from the App Clip, the SPSM Connect app and the website alike, from the
          day this counting began.
        </Body>
      </Card>
    );
  }

  return (
    <View style={{ gap: theme.space.lg }}>
      <View style={{ gap: theme.space.sm }}>
        <Label>How the tags were opened</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.sm }}>
          <Tile label="All taps" value={summary.scans} note={`${summary.ranked.length} of ${NFC_SLUGS.length} tags`} />
          {NFC_PATHS.map((path) => (
            <Tile key={path} label={NFC_PATH_LABELS[path]} value={summary.path[path]} note={share(summary.path[path], summary.scans)} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.sm }}>
          {NFC_PLATFORMS.map((platform) => (
            <Tile
              key={platform}
              label={NFC_PLATFORM_LABELS[platform]}
              value={summary.platform[platform]}
              note={share(summary.platform[platform], summary.scans)}
            />
          ))}
        </View>
      </View>

      <View style={{ gap: theme.space.xs }}>
        <Label>Most tapped</Label>
        <Micro color={theme.color.inkFaint}>Busiest first. The bar is each tag’s share of every tap.</Micro>
        {summary.ranked.map(({ slug, counts }) => (
          <Row key={slug}>
            <View style={{ flex: 1, gap: 3 }}>
              <Small color={theme.color.ink}>{NFC_SLUG_LABELS[slug]}</Small>
              <ShareBar fraction={counts.scans / summary.scans} />
              <Micro color={theme.color.inkFaint}>
                {NFC_PATHS.map((path) => `${NFC_PATH_LABELS[path]} ${counts.path[path]}`).join(' · ')}
              </Micro>
            </View>
            <Small color={theme.color.inkSoft}>{counts.scans}</Small>
          </Row>
        ))}
      </View>

      <View style={{ gap: theme.space.xs }}>
        <Label>What people did next</Label>
        <Micro color={theme.color.inkFaint}>
          Of the people who tapped each tag, how many went on to each step — once per tap.
        </Micro>
        {summary.ranked.map(({ slug, counts }) => (
          <Row key={slug}>
            <View style={{ flex: 1, gap: 2 }}>
              <Small color={theme.color.ink}>{NFC_SLUG_LABELS[slug]}</Small>
              {NFC_FUNNELS[slug].map((action) => (
                <Micro key={action} color={theme.color.inkSoft}>
                  {NFC_ACTION_LABELS[action]}: {counts.actions[action]}
                  {share(counts.actions[action], counts.scans) ? ` (${share(counts.actions[action], counts.scans)})` : ''}
                </Micro>
              ))}
            </View>
            <Small color={theme.color.inkSoft}>{counts.scans} taps</Small>
          </Row>
        ))}
        <Micro color={theme.color.inkFaint}>
          Gifts are made on Tithe.ly, so the giving tag can only show that Tithe.ly was opened.
        </Micro>
      </View>

      {reading.revenue ? <Revenue revenue={reading.revenue} /> : null}
    </View>
  );
}

function Revenue({ revenue }: { revenue: Record<NfcSlug, NfcSlugRevenue> }) {
  const theme = useTheme();
  const rows = NFC_SLUGS.map((slug) => ({ slug, row: revenue[slug] }))
    .filter(({ row }) => row.cents > 0)
    .sort((a, b) => b.row.cents - a.row.cents);
  const total = rows.reduce((sum, { row }) => sum + row.cents, 0);
  const count = rows.reduce((sum, { row }) => sum + row.count, 0);

  return (
    <View style={{ gap: theme.space.xs }}>
      <Label>Money from taps</Label>
      <Micro color={theme.color.inkFaint}>
        Bookstore orders and paid forms that began with a tap, credited to the tag tapped. What
        Square charged, before any refund.
      </Micro>
      {total === 0 ? (
        <Micro color={theme.color.inkSoft}>Nothing bought after a tap in this period.</Micro>
      ) : (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.sm }}>
            <Tile label="From taps" value={money(total)} note={`${count} ${count === 1 ? 'purchase' : 'purchases'}`} />
          </View>
          {rows.map(({ slug, row }) => (
            <Row key={slug}>
              <View style={{ flex: 1, gap: 1 }}>
                <Small color={theme.color.ink}>{NFC_SLUG_LABELS[slug]}</Small>
                <Micro color={theme.color.inkFaint}>
                  Bookstore {money(row.source.bookstore.cents)} · Forms {money(row.source.forms.cents)}
                </Micro>
              </View>
              <Small color={theme.color.inkSoft}>{money(row.cents)}</Small>
            </Row>
          ))}
        </>
      )}
    </View>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.sm,
        paddingVertical: theme.space.xs,
        borderBottomWidth: 1,
        borderBottomColor: theme.color.rule,
      }}
    >
      {children}
    </View>
  );
}

function ShareBar({ fraction }: { fraction: number }) {
  const theme = useTheme();
  return (
    <View style={{ height: 3, borderRadius: 2, backgroundColor: theme.color.rule, overflow: 'hidden' }}>
      <View style={{ height: 3, width: `${Math.round(fraction * 100)}%`, backgroundColor: theme.color.accent }} />
    </View>
  );
}

function Tile({ label, value, note }: { label: string; value: number | string; note: string | null }) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexGrow: 1,
        flexBasis: 100,
        gap: 2,
        padding: theme.space.sm,
        borderRadius: theme.radius.sm,
        borderWidth: 1,
        borderColor: theme.color.rule,
        backgroundColor: theme.color.paperRaised,
      }}
    >
      <Micro color={theme.color.inkFaint}>{label}</Micro>
      <Heading>{typeof value === 'number' ? value.toLocaleString('en-US') : value}</Heading>
      {note ? <Micro color={theme.color.inkSoft}>{note}</Micro> : null}
    </View>
  );
}

function Pill({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={({ pressed }) => ({
        paddingVertical: theme.space.xs,
        paddingHorizontal: theme.space.sm,
        borderRadius: theme.radius.full,
        borderWidth: 1,
        borderColor: on ? theme.color.accent : theme.color.rule,
        backgroundColor: on ? theme.color.accentSoft : pressed ? theme.color.paperSunken : theme.color.paperRaised,
        minHeight: 34,
        justifyContent: 'center',
      })}
    >
      <Small color={on ? theme.color.accentStrong : theme.color.inkSoft}>{label}</Small>
    </Pressable>
  );
}

function share(part: number, whole: number): string | null {
  const percent = nfcPercent(part, whole);
  return percent === null ? null : `${percent}%`;
}
