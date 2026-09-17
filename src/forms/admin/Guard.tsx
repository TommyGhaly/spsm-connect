/**
 * Who may see the admin screens.
 *
 * `mayAdminScreen(grants, 'forms')` is the same question `hasScreen('forms')`
 * asks in `firestore.rules`, through the same predicate, short-circuiting on
 * `superadmin` exactly as the rule does — so the two cannot drift.
 *
 * **This is not the security boundary.** The rules are. Somebody who patched
 * this out of their own build gets a builder that cannot save and a submissions
 * list that comes back empty. What it buys is that somebody who follows a
 * link to `/forms/admin` is told plainly rather than meeting a screen of
 * permission errors.
 *
 * It waits for the session before refusing. The grants read is a `members/{uid}`
 * fetch and possibly a token refresh; deciding during that moment would flash
 * "not for you" at the people it is for, every launch.
 */
import type { ReactNode } from 'react';

import { Card, Screen } from '@/components/Surface';
import { Body, Heading } from '@/components/Type';
import { mayAdminScreen } from '@/firebase/grants';
import { useSession } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';

export function FormsAdminOnly({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const { grants, loading } = useSession();

  if (loading) {
    return (
      <Screen>
        <Body color={theme.color.inkSoft}>Checking…</Body>
      </Screen>
    );
  }

  if (!mayAdminScreen(grants, 'forms')) {
    return (
      <Screen>
        <Card>
          <Heading>Not for this account</Heading>
          <Body color={theme.color.inkSoft}>
            Building forms and reading what comes back is given out one person at a time,
            on the church website at /access. Ask whoever administers the site if you need
            it.
          </Body>
        </Card>
      </Screen>
    );
  }

  return <>{children}</>;
}
