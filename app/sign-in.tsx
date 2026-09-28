/**
 * Signing in, which for this church means Microsoft and nothing else.
 *
 * The labels say "church account", not "Microsoft": App Review read "Sign in
 * with Microsoft" as a third-party login service and rejected 1.0 (8) under
 * Guideline 4.8. It is the church's own single-tenant directory, which is the
 * 4.8 exception — see Part D of `docs/app-review-notes.md`. The Microsoft
 * sheet that opens still shows Microsoft's branding, which is accurate.
 *
 * The Firebase project has exactly one identity provider configured, and the
 * Entra app registration behind it is **single-tenant — that is the security
 * control**, not a convenience. `servantEvents` is readable on `signedIn()`
 * alone, so being able to sign in at all is what grants the servants' rota.
 *
 * Worth being clear about what this screen is *not* for. Somebody sending
 * a photograph never comes here: the upload path signs in anonymously on its
 * own, because an anonymous session is what attributes an upload for quota
 * purposes. This is for the people who administer something.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';

import { Button, Card, Screen } from '@/components/Surface';
import { Body, Label, Small } from '@/components/Type';
import { signInWithMicrosoft } from '@/firebase/auth';
import { useSession } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';

export default function SignIn() {
  const theme = useTheme();
  const router = useRouter();
  const { refresh } = useSession();

  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setProblem(null);
    try {
      await signInWithMicrosoft();
      /*
       * The member document, before leaving. `onAuthChange` in SessionProvider
       * fires and reads it too, but this screen dismisses itself the moment the
       * promise resolves — and returning to an admin tab that has not learned
       * about the grants yet shows a person their own permissions arriving a
       * second late, which reads as a bug.
       */
      await refresh();
      router.back();
    } catch (error) {
      /*
       * Includes the ordinary case of somebody closing the Microsoft sheet,
       * which is not worth an alarming word. The provider's own message is
       * shown because it distinguishes "you cancelled" from "that account is
       * not in this church's tenant", and the second one needs saying.
       */
      setProblem(error instanceof Error ? error.message : 'Signing in did not work.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Card gap={theme.space.sm}>
        <Label>For servants and staff</Label>
        <Body color={theme.color.inkSoft}>
          Sign in with the account the church issued you to see the servants&rsquo; rota and
          anything you have been given to look after. There is no sign-up: accounts are created
          by the parish office for those who serve.
        </Body>
        <Button label="Sign in with church account" onPress={() => void go()} busy={busy} />
      </Card>

      {problem ? (
        <Card>
          <Small color={theme.color.accent}>{problem}</Small>
        </Card>
      ) : null}

      <Small color={theme.color.inkFaint}>
        You do not need an account to send photographs.
      </Small>
    </Screen>
  );
}
