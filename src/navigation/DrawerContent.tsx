/**
 * What is in the drawer, and in what order.
 *
 * Grouped by the question somebody is asking rather than by the shape of the
 * website's navigation, because a drawer is read top to bottom by a thumb and
 * not scanned like a menu bar. "The church" is what a newcomer wants; "You" is
 * what a returning parishioner wants; "Entrusted to you" only exists for the
 * handful of people it applies to.
 *
 * The rows are declared as data rather than written out as JSX, so adding a
 * page is one line and so the grant-gated ones can be filtered rather than
 * wrapped in conditionals that make the list hard to read.
 */
import { useRouter, type Href } from 'expo-router';
import { DrawerContentScrollView } from 'expo-router/drawer';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { ADMIN_SCREENS, hasAnyProgramGrant } from '@spsm/shared';

import { Icon, type IconName } from '@/components/Icon';
import { Label, Small } from '@/components/Type';
import { mayAdminScreen, type Grants } from '@/firebase/grants';
import { signOut } from '@/firebase/auth';
import { useCampWeek } from '@/camp/useCampWeek';
import { useSession } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';

interface Row {
  label: string;
  icon: IconName;
  href: Href;
}

const ABOUT: Row[] = [
  { label: 'About the parish', icon: 'door', href: '/about' },
  { label: 'Who we are', icon: 'door', href: '/about/who-we-are' },
  { label: 'What we believe', icon: 'door', href: '/about/our-belief' },
  { label: 'Our patron saints', icon: 'door', href: '/about/patron-saints' },
  { label: 'Welcome, newcomers', icon: 'door', href: '/about/welcome-newcomers' },
  { label: 'Our expansion plans', icon: 'door', href: '/about/future-plans' },
];

const PARISH: Row[] = [
  { label: 'Our faith', icon: 'file', href: '/beliefs' },
  { label: 'Welcome', icon: 'file', href: '/welcome' },
  { label: 'Watch live', icon: 'play', href: '/livestream' },
  { label: 'Contact', icon: 'phone', href: '/contact' },
  { label: 'Our apps', icon: 'grip', href: '/apps' },
];

export function DrawerContent() {
  const theme = useTheme();
  const router = useRouter();
  const { user, isPerson, grants, loading } = useSession();
  const duringCamp = useCampWeek();

  /*
   * The register appears here only when it is NOT in the tab bar — the same two
   * conditions the bar uses, inverted on the season. One door at a time: a row
   * here while the tab is also showing would be two ways to the same screen and
   * an unspoken question about whether they differ.
   */
  const showRegister = mayAdminScreen(grants, 'camp') && !duringCamp;

  return (
    <DrawerContentScrollView contentContainerStyle={{ gap: theme.space.md }}>
      <View style={{ paddingHorizontal: theme.space.md, gap: theme.space.xs }}>
        <Label>St. Philopater &amp; St. Mina</Label>
      </View>

      {/*
        * First, and its own section rather than a row inside another one,
        * because this is where the Photos tab went when the camera took the
        * middle of the bar. A thing that was one press away has to be the first
        * thing in the drawer, or the move is a demotion rather than a
        * relocation.
        *
        * `/events` and not `/gallery`: the same URL the website uses, and the
        * same one the App Clip and every share link resolve to.
        */}
      <Section title="Photographs">
        <DrawerRow row={{ label: "The parish's galleries", icon: 'photos', href: '/events' }} />
      </Section>

      <Section title="The church">
        {ABOUT.map((row) => (
          <DrawerRow key={String(row.href)} row={row} />
        ))}
      </Section>

      <Section title="Around the parish">
        {PARISH.map((row) => (
          <DrawerRow key={String(row.href)} row={row} />
        ))}
      </Section>

      {showRegister ? (
        <Section title="Entrusted to you">
          <DrawerRow
            row={{ label: 'Camp register', icon: 'check', href: '/admin/camp/attendance' }}
          />
        </Section>
      ) : null}

      <Section title="You">
        <DrawerRow row={{ label: 'Photographs you have sent', icon: 'photos', href: '/uploads' }} />
        <DrawerRow row={{ label: 'Privacy', icon: 'file', href: '/privacy' }} />
      </Section>

      {/*
        * A section of its own rather than three rows at the foot of "You",
        * because signing in here is not a setting — it is the whole difference
        * between reading the app and serving with it. It is also the one part
        * of this drawer most people should read once and never touch again.
        */}
      <Section title="Church account">
        {loading ? (
          <Padded>
            <Small color={theme.color.inkSoft}>Checking…</Small>
          </Padded>
        ) : isPerson ? (
          <>
            <Padded>
              <Small>{user?.email ?? user?.displayName ?? 'Signed in'}</Small>
              <Entrusted grants={grants} />
            </Padded>
            <Action label="Sign out" icon="back" onPress={() => void signOut()} />
          </>
        ) : (
          <>
            <Padded>
              <Small color={theme.color.inkSoft}>
                Sign in with your church email if you serve here. It is the same account you use
                for everything else in the parish, and it is the only way in — there is no password
                to set up.
              </Small>
              <Small color={theme.color.inkFaint}>
                You do not need one to send photographs.
              </Small>
            </Padded>
            <Action
              label="Sign in with your church email"
              icon="mail"
              onPress={() => router.push('/sign-in')}
            />
          </>
        )}
      </Section>
    </DrawerContentScrollView>
  );
}

/* -------------------------------------------------------------------------- */

function Section({ title, children }: { title: string; children: ReactNode }) {
  const theme = useTheme();

  return (
    <View style={{ gap: 2 }}>
      <View style={{ paddingHorizontal: theme.space.md, paddingBottom: theme.space.xs }}>
        <Small color={theme.color.inkFaint}>{title.toUpperCase()}</Small>
      </View>
      {children}
    </View>
  );
}

function Padded({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ paddingHorizontal: theme.space.md, paddingVertical: theme.space.xs, gap: 2 }}>
      {children}
    </View>
  );
}

function DrawerRow({ row }: { row: Row }) {
  const router = useRouter();
  return <Action label={row.label} icon={row.icon} onPress={() => router.push(row.href)} />;
}

function Action({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: IconName;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.sm,
        paddingHorizontal: theme.space.md,
        paddingVertical: theme.space.sm,
        backgroundColor: pressed ? theme.color.accentSoft : 'transparent',
        minHeight: 44,
      })}
    >
      <Icon name={icon} color={theme.color.inkSoft} size={18} />
      <Small>{label}</Small>
    </Pressable>
  );
}

/**
 * What this person has been entrusted with, in the parish's own vocabulary.
 *
 * Moved here from `more.tsx` unchanged. It reads the grants the session already
 * holds — it does not re-derive a permission, and must not start to. It is also
 * only ever a description: the screens are gated by `firestore.rules`, and this
 * list saying "camp" would not open a single document if the member record
 * disagreed.
 */
function Entrusted({ grants }: { grants: Grants }) {
  const theme = useTheme();

  const screens = ADMIN_SCREENS.filter((screen) => mayAdminScreen(grants, screen));
  const programs = hasAnyProgramGrant(grants.claims, grants.programAdmin);

  if (screens.length === 0 && !programs) {
    return <Small color={theme.color.inkFaint}>You look after nothing in the app yet.</Small>;
  }

  return (
    <Small color={theme.color.inkSoft}>
      You look after: {[...screens, ...(programs ? ['ministry photographs'] : [])].join(', ')}.
    </Small>
  );
}
