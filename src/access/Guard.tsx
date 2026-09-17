/**
 * Who may see the Areas screens: the superadmin, and nobody else.
 *
 * The other guards in this app — `src/forms/admin/Guard.tsx`,
 * `src/bookstore/admin/Guard.tsx` — turn people away on a screen flag. This one
 * cannot, and that is the point: the flag that would grant it is `members`,
 * which is the power to hand out every other flag, and a screen that can
 * delegate its own key stops being superadmin-only the first time anybody uses
 * it. So the test is the claim itself. See the note on `'members'` in
 * `packages/shared/src/screens.ts`.
 *
 * **This is not the security boundary.** `firestore.rules` is: reading somebody
 * else's member document is `isSelf(uid) || isSuper()` and writing one is
 * `isSuper()`. Somebody who patched this component out of their own build gets
 * a directory that comes back empty and a save that is refused. What it buys is
 * that everybody else is told plainly rather than meeting a screen of
 * permission errors.
 *
 * It waits for the session before refusing, for the same reason the other two
 * guards do: the grants read is a `members/{uid}` fetch and possibly a token
 * refresh, and deciding during that moment would flash "not for you" at the one
 * person it is for, every launch.
 */
import { useState, type ReactNode } from 'react';
import { isSuperadmin } from '@spsm/shared';

import { Button, Card, Screen } from '@/components/Surface';
import { Body, Heading, Small } from '@/components/Type';
import { claimsOf, currentUser } from '@/firebase/auth';
import { useSession } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';

export function SuperadminOnly({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const { loading, isPerson, grants, refresh } = useSession();
  const [rechecking, setRechecking] = useState(false);

  if (loading) {
    return (
      <Screen>
        <Body color={theme.color.inkSoft}>Checking…</Body>
      </Screen>
    );
  }

  if (isSuperadmin(grants.claims)) return <>{children}</>;

  return (
    <Screen>
      <Card gap={theme.space.sm}>
        <Heading>Not your area</Heading>
        {!isPerson ? (
          <Body color={theme.color.inkSoft}>
            Allocating areas is a superadmin&rsquo;s alone, and you are not signed in with a
            church Microsoft account.
          </Body>
        ) : (
          <>
            <Body color={theme.color.inkSoft}>
              Allocating areas is a superadmin&rsquo;s alone, and your sign-in is not marked as
              one.
            </Body>
            {/*
              * Named plainly, because it is the likeliest cause by a wide margin
              * and the fix is thirty seconds.
              *
              * `superadmin` is a custom claim, and a claim is frozen into the ID
              * token when it is minted. `readGrants` forces a refresh only when
              * the *screens* mirror disagrees with the member document, and this
              * claim is not in that mirror — so somebody promoted five minutes
              * ago by `grant-admin.mjs` is still carrying a token that says
              * nothing, and this screen, reading it correctly, tells them the
              * screen is not theirs. Which reads as the promotion having failed,
              * and is the single most confusing way this can behave.
              */}
            <Small color={theme.color.inkFaint}>
              If you were made a superadmin recently, this is what a stale sign-in looks like —
              it travels in a token the app refreshes about once an hour. Check again, or sign
              out and back in, which always mints a new one.
            </Small>
            <Button
              label={rechecking ? 'Checking…' : 'Check again'}
              tone="quiet"
              busy={rechecking}
              onPress={() => {
                const user = currentUser();
                if (!user) return;
                setRechecking(true);
                /*
                 * One forced token round trip, and then the session's own read.
                 * Forcing it here rather than leaving it to `refresh()` is the
                 * whole reason this button exists: `readGrants` would not force
                 * one for this claim, so refreshing alone would hand back the
                 * same stale answer and the button would look broken.
                 */
                void claimsOf(user, true)
                  .then(() => refresh())
                  .catch((error: unknown) => {
                    console.warn('[access] could not refresh your sign-in', error);
                  })
                  .finally(() => setRechecking(false));
              }}
            />
          </>
        )}
      </Card>
    </Screen>
  );
}
