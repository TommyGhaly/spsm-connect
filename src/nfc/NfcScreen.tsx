/**
 * /nfc — the church's NFC tags: how they are used, and (for the superadmin)
 * programming new ones.
 *
 * ---------------------------------------------------------------------------
 * Two jobs with two different keys, on one page because they are about the
 * same stickers:
 *
 *   Statistics   the `nfc` grant, handed out at /access. Taps per tag, App
 *                Clip / app / website, iPhone / Android, and the steps after.
 *                The money section appears only when the reader also holds
 *                Finance — `firestore.rules` serves `nfcRevenue` on both
 *                grants and nothing less.
 *   Program      the superadmin's alone, as it always was. A locked sticker on
 *                a wall is not something to delegate by accident.
 *
 * The switch between them is drawn only for somebody who can use both;
 * everybody else sees the one half that is theirs and no hint of the other.
 *
 * As with every guard in this app, this is not the security boundary — the
 * rules are. It is so that nobody meets a screen of permission errors.
 * ---------------------------------------------------------------------------
 */
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { isSuperadmin } from '@spsm/shared';

import { Card, Screen } from '@/components/Surface';
import { Body, Heading, Small } from '@/components/Type';
import { mayAdminScreen } from '@/firebase/grants';
import { useSession } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';

import { NfcStatsView } from './NfcStatsView';
import { NfcWriterScreen } from './NfcWriterScreen';

type Tab = 'stats' | 'program';

export function NfcScreen() {
  const theme = useTheme();
  const { loading, grants } = useSession();
  const [tab, setTab] = useState<Tab>('stats');

  if (loading) {
    return (
      <Screen>
        <Body color={theme.color.inkSoft}>Checking…</Body>
      </Screen>
    );
  }

  const programs = isSuperadmin(grants.claims);
  const reads = mayAdminScreen(grants, 'nfc');
  const withRevenue = mayAdminScreen(grants, 'finance');

  if (!programs && !reads) {
    return (
      <Screen>
        <Card gap={theme.space.sm}>
          <Heading>Not for this account</Heading>
          <Body color={theme.color.inkSoft}>
            The NFC tag statistics are given out one person at a time, on the church website at
            /access. Ask whoever administers the site if you need them.
          </Body>
        </Card>
      </Screen>
    );
  }

  const switcher =
    programs && reads ? <Switcher tab={tab} onChange={setTab} /> : null;

  if (programs && (!reads || tab === 'program')) {
    return <NfcWriterScreen header={switcher} />;
  }

  return (
    <Screen gap={theme.space.md}>
      {switcher}
      <NfcStatsView withRevenue={withRevenue} />
    </Screen>
  );
}

function Switcher({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) {
  const theme = useTheme();
  const tabs: { key: Tab; label: string }[] = [
    { key: 'stats', label: 'Statistics' },
    { key: 'program', label: 'Program stickers' },
  ];
  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        borderWidth: 1,
        borderColor: theme.color.rule,
        borderRadius: theme.radius.sm,
        overflow: 'hidden',
      }}
    >
      {tabs.map(({ key, label }) => {
        const on = key === tab;
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: 40,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: on ? theme.color.accentSoft : pressed ? theme.color.paperSunken : theme.color.paperRaised,
            })}
          >
            <Small color={on ? theme.color.accentStrong : theme.color.inkSoft}>{label}</Small>
          </Pressable>
        );
      })}
    </View>
  );
}
