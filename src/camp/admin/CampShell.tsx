/**
 * The frame the camp's three screens sit in: the guard, the season, the nav.
 *
 * ---------------------------------------------------------------------------
 * A port of the website's `features/camp/CampShell.tsx`, minus one tab.
 *
 * The website has four — Camp, Registrations, Groups, Attendance. This has
 * three, because Registrations is a desk job: a family registration carries
 * children's medical notes, a discount list and a payment ledger, and typing
 * one on a phone is how a camp ends up with a registration missing the half
 * somebody scrolled past. It is on the website, the nav says so, and nothing
 * here pretends otherwise.
 *
 * The URLs are the website's, not a convenience. `/admin/camp/attendance` is
 * App Clip experience #9 and a tag pointing at it has to land on the register;
 * keeping its two neighbours under the same prefix means a link copied out of
 * a laptop's address bar opens the right screen on a phone.
 *
 * ## Not a security boundary
 *
 * `firestore.rules` is. This decides what to draw, and it says the three things
 * worth telling apart in words — still checking, not signed in, and signed in
 * without the camp — rather than showing one screen of permission errors for
 * all three.
 * ---------------------------------------------------------------------------
 */
import { useRouter, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { Card, Screen } from '@/components/Surface';
import { Body, Heading, Label, Micro, Small } from '@/components/Type';
import { useSession } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';

import type { CampAdminSession } from './session';

export type CampTab = 'attendance' | 'groups' | 'home';

/*
 * Attendance first, and the two it used to sit behind after it.
 *
 * The order is not the website's, and that is deliberate: on a laptop the camp
 * page is where somebody starts because they came to set the camp up, and on a
 * phone it is where nobody starts because they came to tick a child in. The
 * leading cell is the one a thumb lands on without aiming, so it belongs to
 * the screen that is opened every morning of the camp rather than the one
 * opened once a season.
 */
const TABS: { id: CampTab; href: Href; label: string }[] = [
  { id: 'attendance', href: '/admin/camp/attendance', label: 'Attendance' },
  { id: 'groups', href: '/admin/camp/groups', label: 'Groups' },
  { id: 'home', href: '/admin/camp', label: 'Camp' },
];

export function CampShell({
  session,
  tab,
  children,
}: {
  session: CampAdminSession;
  tab: CampTab;
  children: ReactNode;
}) {
  const theme = useTheme();
  const { isPerson } = useSession();

  if (!session.ready) {
    return (
      <Screen>
        <Body color={theme.color.inkSoft}>Checking…</Body>
      </Screen>
    );
  }

  if (!isPerson) {
    return (
      <Screen>
        <SignInFirst />
      </Screen>
    );
  }

  if (!session.canEdit) {
    return (
      <Screen>
        <Card>
          <Heading>Not for this account</Heading>
          <Body color={theme.color.inkSoft}>
            The camp&rsquo;s screens open for whoever has been given the camp to run. It is
            handed out one person at a time, on the church website at /access. Ask whoever
            administers the site if you need it.
          </Body>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <CampNav tab={tab} season={session.config.season} />
      {children}
    </Screen>
  );
}

/**
 * The season, and the three places there are.
 *
 * The season is a chip beside the name rather than a second heading — it was
 * the other way round on the website for a while, which gave the loudest thing
 * on the screen to the one word nobody comes here to read.
 */
function CampNav({ tab, season }: { tab: CampTab; season: string }) {
  const theme = useTheme();
  const router = useRouter();

  return (
    <View style={{ gap: theme.space.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
        <Heading>Summer camp</Heading>
        <View
          style={{
            backgroundColor: theme.color.paperSunken,
            borderRadius: Math.min(theme.radius.full, 12),
            paddingHorizontal: theme.space.sm,
            paddingVertical: 3,
          }}
        >
          <Label color={theme.color.inkSoft}>{season || 'no season set'}</Label>
        </View>
      </View>

      {/*
        * A pill riding on a sunken track, which is the same control the
        * calendar's week/month switch is. Three cells rather than two, and the
        * reason it is a track and not three outlined buttons is the calendar's:
        * a groove with one thing in it reads as one control, where three boxes
        * read as three unrelated ones.
        */}
      <View
        accessibilityRole="tablist"
        accessibilityLabel="Summer camp"
        style={{
          flexDirection: 'row',
          backgroundColor: theme.color.paperSunken,
          borderRadius: theme.radius.full,
          padding: 2,
        }}
      >
        {TABS.map((entry) => {
          const on = entry.id === tab;
          return (
            <Pressable
              key={entry.id}
              /*
               * `replace`, not `push`. These three are one place with three
               * views of it, and pushing would make the back gesture walk a
               * chain of tabs — Camp, Groups, Attendance, Groups — which says
               * each is inside the one before it. It is not.
               */
              onPress={() => (on ? undefined : router.replace(entry.href))}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              style={({ pressed }) => ({
                flex: 1,
                minHeight: 40,
                borderRadius: theme.radius.full,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: on
                  ? theme.color.accent
                  : pressed
                    ? theme.color.paperRaised
                    : 'transparent',
              })}
            >
              <Small color={on ? theme.color.inkInverse : theme.color.ink}>{entry.label}</Small>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function SignInFirst() {
  const theme = useTheme();
  const router = useRouter();

  return (
    <Card gap={theme.space.sm}>
      <Heading>Sign in first</Heading>
      <Body color={theme.color.inkSoft}>
        These screens are for the people who run the camp.
      </Body>
      <Pressable
        onPress={() => router.push('/sign-in')}
        accessibilityRole="button"
        style={({ pressed }) => ({
          minHeight: 44,
          borderRadius: theme.radius.sm,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: pressed ? theme.color.accentStrong : theme.color.accent,
        })}
      >
        <Small color={theme.color.inkInverse}>Sign in with Microsoft</Small>
      </Pressable>
    </Card>
  );
}

/**
 * The line a screen shows while it is still reading the season.
 *
 * Here rather than in each screen because all three say the same thing, and a
 * different kind of waiting on each tab reads as three different bugs.
 */
export function CampLoading({ what }: { what: string }) {
  const theme = useTheme();
  return <Body color={theme.color.inkSoft}>Loading {what}…</Body>;
}

/** A failure worth showing rather than logging. */
export function CampProblem({ error }: { error: string }) {
  const theme = useTheme();

  return (
    <View
      style={{
        borderColor: theme.color.accent,
        borderWidth: 1,
        borderRadius: theme.radius.sm,
        padding: theme.space.sm,
        backgroundColor: theme.color.accentSoft,
        gap: 2,
      }}
    >
      <Label color={theme.color.accentStrong}>THAT DID NOT WORK</Label>
      <Micro color={theme.color.accentStrong}>{error}</Micro>
    </View>
  );
}
