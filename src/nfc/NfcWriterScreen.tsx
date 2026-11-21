/**
 * NFC tags — program the church's stickers from a phone.
 *
 * Pick one of the nine `/c/*` URLs, press Program, and tap stickers one after
 * another. Each blank sticker gets the URL and the password; a sticker that is
 * already locked says so and shows the URL it holds, and is left alone.
 *
 * ## Why a loop, and why the same sticker is skipped
 *
 * iOS shows its own scanning sheet for an NFC session and closes it after about
 * a minute however busy it is, so the loop keeps one session open and restarts
 * polling after every sticker rather than opening a sheet per sticker. Polling
 * finds the sticker that was just written if it is still on the phone, so a
 * sticker with the same id as the last one is waited out instead of being
 * reported, a second later, as "already programmed".
 */
import { useEffect, useRef, useState } from 'react';
import { Alert, Platform, Pressable, Switch, View } from 'react-native';
import NfcManager, { NfcTech } from 'react-native-nfc-manager';

import { CLIP_PREFIX, EXPERIENCES, PUBLIC_ORIGIN } from '@/clip/experiences';
import { Icon, type IconName } from '@/components/Icon';
import { Button, Card, Screen } from '@/components/Surface';
import { Body, Label, Small } from '@/components/Type';
import { useTheme } from '@/theme/ThemeProvider';

import { TAG_PASSWORD, programTag, tagKey, type Outcome, type Transceive } from './ntag';

interface Target {
  label: string;
  url: string;
}

/** Taksis's parking-lot sticker. Its clip is Taksis's, but it is on the same sheet. */
const REGISTER_CAR: Target = {
  label: 'Register car (Taksis)',
  url: `${PUBLIC_ORIGIN}${CLIP_PREFIX}/register-vehicle`,
};

/** The eight experiences, then Taksis's sticker — the nine on the sticker sheet. */
const TARGETS: Target[] = [
  ...EXPERIENCES.map((e) => ({ label: e.title, url: `${PUBLIC_ORIGIN}${CLIP_PREFIX}/${e.slug}` })),
  REGISTER_CAR,
];

const TECH = Platform.OS === 'ios' ? NfcTech.MifareIOS : NfcTech.NfcA;

const transceive: Transceive =
  Platform.OS === 'ios'
    ? (bytes) => NfcManager.sendMifareCommandIOS(bytes)
    : (bytes) => NfcManager.nfcAHandler.transceive(bytes);

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface Row {
  id: number;
  outcome: Outcome;
  at: Date;
}

export function NfcWriterScreen() {
  const theme = useTheme();
  const [supported, setSupported] = useState<boolean | null>(null);
  const [target, setTarget] = useState<Target>(TARGETS[0] ?? REGISTER_CAR);
  const [picking, setPicking] = useState(false);
  const [rewrite, setRewrite] = useState(false);
  const [running, setRunning] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const stopping = useRef(false);
  const nextId = useRef(0);

  useEffect(() => {
    NfcManager.isSupported()
      .then(async (yes) => {
        if (yes) await NfcManager.start();
        setSupported(yes);
      })
      .catch(() => setSupported(false));
    return () => {
      stopping.current = true;
      void NfcManager.cancelTechnologyRequest().catch(() => {});
    };
  }, []);

  const record = (outcome: Outcome) =>
    setRows((was) => [{ id: nextId.current++, outcome, at: new Date() }, ...was]);

  async function run() {
    stopping.current = false;
    setRunning(true);
    const key = await tagKey(TAG_PASSWORD);
    let count = 0;
    let lastId: string | undefined;
    // A locked sticker stops the run, so the popup about it is not hidden
    // behind the iPhone's scanning sheet.
    let locked: Extract<Outcome, { kind: 'already' }> | null = null;
    try {
      await NfcManager.requestTechnology(TECH, {
        alertMessage: `Hold a sticker to the top of the phone to program ${target.label}.`,
      });
      while (!stopping.current) {
        const tag = await NfcManager.getTag({ readNdef: false }).catch(() => null);
        const id = tag?.id;
        if (id && id === lastId) {
          await wait(600); // the last sticker is still on the phone
        } else {
          const outcome = await programTag(transceive, target.url, key, { rewrite });
          if (outcome.kind !== 'failed') lastId = id;
          record(outcome);
          if (outcome.kind === 'already') {
            locked = outcome;
            if (Platform.OS === 'ios') {
              await NfcManager.invalidateSessionWithErrorIOS('This sticker is locked.').catch(() => {});
            }
            break;
          }
          if (outcome.kind === 'written' || outcome.kind === 'rewritten') count += 1;
          if (Platform.OS === 'ios') {
            await NfcManager.setAlertMessageIOS(`${sheetLine(outcome)}\n${count} programmed. Next sticker.`);
          }
        }
        if (Platform.OS === 'ios') {
          await NfcManager.restartTechnologyRequestIOS();
        } else {
          await NfcManager.cancelTechnologyRequest();
          if (stopping.current) break;
          await NfcManager.requestTechnology(TECH);
        }
      }
    } catch {
      // The sheet was cancelled, timed out, or Stop was pressed: the run is over.
    } finally {
      await NfcManager.cancelTechnologyRequest().catch(() => {});
      setRunning(false);
    }

    if (locked) {
      // Let the scanning sheet finish sliding away; an alert raised under it
      // is dismissed with it.
      if (Platform.OS === 'ios') await wait(800);
      showLocked(locked.url);
    }
  }

  function showLocked(url: string | null) {
    const known = TARGETS.find((t) => t.url === url);
    const written = url ? `${known ? `${known.label}\n` : ''}${url}` : 'Nothing is written on it.';
    Alert.alert(
      'Locked sticker',
      `${written}\n\nThis sticker is locked with a password, so it was left alone. To change it, turn on Rewrite locked stickers.`,
      [
        { text: 'Done', style: 'cancel' },
        { text: 'Keep programming', onPress: () => void run() },
      ],
    );
  }

  function stop() {
    stopping.current = true;
    void NfcManager.cancelTechnologyRequest().catch(() => {});
  }

  const tally = {
    written: rows.filter((r) => r.outcome.kind === 'written' || r.outcome.kind === 'rewritten').length,
    already: rows.filter((r) => r.outcome.kind === 'already').length,
    failed: rows.filter((r) => r.outcome.kind === 'failed').length,
  };

  return (
    <Screen gap={theme.space.md}>
      {/* The rest of the page still draws, so the list can be read from any phone. */}
      {supported === false ? (
        <Card>
          <Body color={theme.color.accent}>This phone cannot write NFC stickers.</Body>
        </Card>
      ) : null}
      <Card gap={theme.space.sm}>
        <Label color={theme.color.inkFaint}>Sticker</Label>
        <Pressable
          onPress={() => setPicking((was) => !was)}
          disabled={running}
          accessibilityRole="button"
          accessibilityState={{ expanded: picking }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.space.sm,
            borderWidth: 1,
            borderColor: theme.color.rule,
            borderRadius: theme.radius.sm,
            padding: theme.space.sm,
            minHeight: 44,
            opacity: running ? 0.5 : 1,
          }}
        >
          <View style={{ flex: 1 }}>
            <Body>{target.label}</Body>
            <Small color={theme.color.inkFaint}>{target.url}</Small>
          </View>
          <Icon name="expand" size={18} color={theme.color.inkSoft} />
        </Pressable>
        {picking
          ? TARGETS.map((t) => (
              <Pressable
                key={t.url}
                onPress={() => {
                  setTarget(t);
                  setPicking(false);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: t.url === target.url }}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.space.sm,
                  paddingVertical: theme.space.xs,
                  paddingHorizontal: theme.space.sm,
                  borderRadius: theme.radius.sm,
                  minHeight: 44,
                  backgroundColor: pressed || t.url === target.url ? theme.color.accentSoft : 'transparent',
                })}
              >
                <View style={{ flex: 1 }}>
                  <Body>{t.label}</Body>
                  <Small color={theme.color.inkFaint}>{t.url.replace('https://', '')}</Small>
                </View>
                {t.url === target.url ? <Icon name="check" size={18} color={theme.color.accent} /> : null}
              </Pressable>
            ))
          : null}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
          <View style={{ flex: 1 }}>
            <Body>Rewrite locked stickers</Body>
            <Small color={theme.color.inkFaint}>
              {rewrite
                ? 'On: a locked sticker has its password removed, gets the new URL, and is locked again.'
                : 'Off: a sticker that is already programmed is reported and left alone.'}
            </Small>
          </View>
          <Switch value={rewrite} onValueChange={setRewrite} disabled={running} />
        </View>

        {running ? (
          <Button label="Stop" tone="quiet" onPress={stop} />
        ) : (
          <Button label="Program stickers" onPress={() => void run()} disabled={supported !== true} />
        )}
        {Platform.OS === 'ios' ? (
          <Small color={theme.color.inkFaint}>
            iPhone closes the scanning sheet after about a minute. Press Program again to carry on.
          </Small>
        ) : null}
      </Card>

      {rows.length > 0 ? (
        <Card gap={theme.space.sm}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Label color={theme.color.inkFaint}>
              {tally.written} programmed · {tally.already} already · {tally.failed} failed
            </Label>
            {!running ? (
              <Pressable onPress={() => setRows([])} accessibilityRole="button" hitSlop={8}>
                <Small color={theme.color.accent}>Clear</Small>
              </Pressable>
            ) : null}
          </View>
          {rows.map((row) => (
            <ResultRow key={row.id} row={row} />
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}

function sheetLine(outcome: Outcome): string {
  switch (outcome.kind) {
    case 'written':
      return 'Programmed and locked.';
    case 'rewritten':
      return 'Rewritten.';
    case 'already':
      return `Already programmed: ${outcome.url ?? 'no URL'}`;
    case 'failed':
      return outcome.message;
  }
}

function ResultRow({ row }: { row: Row }) {
  const theme = useTheme();
  const { outcome } = row;
  const look: Record<Outcome['kind'], { icon: IconName; color: string; title: string }> = {
    written: { icon: 'check', color: theme.color.ink, title: 'Programmed and locked' },
    rewritten: { icon: 'check', color: theme.color.ink, title: 'Rewritten' },
    already: { icon: 'lock', color: theme.color.gold, title: 'Already programmed' },
    failed: { icon: 'close', color: theme.color.accent, title: 'Failed' },
  };
  const { icon, color, title } = look[outcome.kind];
  const detail =
    outcome.kind === 'failed'
      ? outcome.message
      : outcome.kind === 'rewritten' && outcome.previous
        ? `${outcome.previous} → ${outcome.url}`
        : (outcome.url ?? 'No URL on this sticker');

  return (
    <View style={{ flexDirection: 'row', gap: theme.space.sm, alignItems: 'flex-start' }}>
      <Icon name={icon} size={18} color={color} />
      <View style={{ flex: 1 }}>
        <Body color={color}>{title}</Body>
        <Small color={theme.color.inkFaint}>{detail}</Small>
      </View>
      <Small color={theme.color.inkFaint}>
        {row.at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })}
      </Small>
    </View>
  );
}
