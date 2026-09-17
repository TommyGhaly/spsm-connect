/**
 * Who may see the bookstore's admin screens.
 *
 * `src/forms/admin/Guard.tsx` with two doors instead of one, and everything its
 * header says applies here: **this is not the security boundary.** The rules
 * are. Somebody who patched this out of their own build gets an orders list
 * that comes back empty and a stock control that cannot save. What it buys is
 * that somebody who follows a link to /bookstore/orders is told plainly rather
 * than meeting a screen of permission errors.
 *
 * It waits for the session before refusing, for the same reason the forms guard
 * does: the grants read is a `members/{uid}` fetch and possibly a token
 * refresh, and deciding during that moment would flash "not for you" at the
 * people it is for, every launch.
 */
import type { ReactNode } from 'react';

import { Card, Screen } from '@/components/Surface';
import { Body, Heading } from '@/components/Type';
import { useTheme } from '@/theme/ThemeProvider';

import { useBookstoreAdmin } from './session';

export function BookstoreAdminOnly({
  children,
  /**
   * Which door. `review` is the orders queue and the figures — the bookstore
   * grant or the bookstore slice of finance. `edit` is everything that writes.
   */
  need = 'review',
}: {
  children: ReactNode;
  need?: 'review' | 'edit';
}) {
  const theme = useTheme();
  const { ready, canReview, canEdit } = useBookstoreAdmin();

  if (!ready) {
    return (
      <Screen>
        <Body color={theme.color.inkSoft}>Checking…</Body>
      </Screen>
    );
  }

  if (need === 'edit' ? !canEdit : !canReview) {
    return (
      <Screen>
        <Card>
          <Heading>Not for this account</Heading>
          <Body color={theme.color.inkSoft}>
            Running the bookstore — its orders, its takings and its catalog — is given out
            one person at a time, on the church website at /access. Ask whoever administers
            the site if you need it.
          </Body>
        </Card>
      </Screen>
    );
  }

  return <>{children}</>;
}
