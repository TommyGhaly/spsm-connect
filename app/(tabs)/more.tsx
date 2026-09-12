/**
 * Everything that is not Home, the calendar, or the photographs.
 *
 * The account lives here, and so does the one outbound link this app will
 * always have: giving. Tithe.ly's hosted form is Tithe.ly's, and it opens in a
 * browser rather than inside this app — a donation form embedded in a native
 * screen is a payment page whose address bar nobody can see, which is the one
 * thing a person about to type a card number should be able to check.
 *
 * The shop, the forms, the livestream and About arrive in later phases. They
 * are not listed as empty rows here, because a list of six things that do
 * nothing is worse than a short list that works.
 */
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import { ADMIN_SCREENS, hasAnyProgramGrant } from '@spsm/shared';

import { Button, Card, Screen } from '@/components/Surface';
import { Body, Label, Small } from '@/components/Type';
import { mayAdminScreen, type Grants } from '@/firebase/grants';
import { signOut } from '@/firebase/auth';
import { useSession } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';

/*
 * The parish's Tithe.ly form, copied from the website's features/giving/config.ts
 * where the reasoning for it being committed rather than configured is written
 * out. It is not a credential — it is the identifier Tithe.ly prints in its own
 * embed snippet, and it ships in the website's HTML already.
 *
 * If the parish's giving page ever moves, it moves in both places. That is a
 * genuine duplication and the alternative — putting it in `@spsm/shared` — is
 * the better answer the day a third thing needs it.
 */
const GIVING_URL = 'https://give.tithe.ly/?formId=44f1af1b-7edf-4005-af05-0c7a7f7249ac';

export default function More() {
  const theme = useTheme();
  const router = useRouter();
  const { user, isPerson, grants, loading } = useSession();

  return (
    <Screen>
      <Card gap={theme.space.sm}>
        <Label>Giving</Label>
        <Body color={theme.color.inkSoft}>
          The parish&rsquo;s giving form opens in your browser.
        </Body>
        <Button
          label="Give"
          onPress={() => void WebBrowser.openBrowserAsync(GIVING_URL)}
          tone="quiet"
        />
      </Card>

      <Card gap={theme.space.sm}>
        <Label>Sending</Label>
        <Button label="Photographs you have sent" onPress={() => router.push('/uploads')} tone="quiet" />
      </Card>

      <Card gap={theme.space.sm}>
        <Label>Account</Label>
        {loading ? (
          <Body color={theme.color.inkSoft}>Checking…</Body>
        ) : isPerson ? (
          <>
            <Body>{user?.email ?? user?.displayName ?? 'Signed in'}</Body>
            <Entrusted grants={grants} />
            <Button label="Sign out" onPress={() => void signOut()} tone="quiet" />
          </>
        ) : (
          <>
            <Body color={theme.color.inkSoft}>
              You do not need an account to send photographs. Sign in if you serve here.
            </Body>
            <Button label="Sign in" onPress={() => router.push('/sign-in')} tone="quiet" />
          </>
        )}
      </Card>
    </Screen>
  );
}

/**
 * What this person has been entrusted with, in the parish's own vocabulary.
 *
 * Reads the grants the session already holds — it does not re-derive a
 * permission, and must not start to. It is also only ever a description: the
 * screens themselves are gated by `firestore.rules`, and this list saying
 * "camp" would not open a single document if the member record disagreed.
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
