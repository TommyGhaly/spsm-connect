/**
 * A servant deleting their own account.
 *
 * The whole of the work happens in the `deleteOwnAccount` Function in the
 * Website repo (functions/src/account.ts), and it has to: `members/{uid}` is
 * the document that says which areas somebody administers, and no Firestore
 * rule grants a member `delete` on their own member document — deliberately,
 * because a member document is the church's record of an allocation rather
 * than the member's property. So this is one POST, not a client-side
 * `deleteUser()` plus a write.
 *
 * ## What the person is actually asking for
 *
 * Removed: the Firebase Auth user, and their member document — which is the
 * whole of what this church's software knows as an account.
 *
 * **Not touched: their church Microsoft account.** This app does not own it and
 * cannot delete it; the church's M365 tenant does, and offboarding there is a
 * different job done by a different person. The confirmation copy in the
 * drawer says so in as many words, because "delete account" on a phone has
 * taught everybody to expect something more total than this is.
 *
 * Deleting is also not a ban: `enforceTenantOnCreate` mints a fresh account for
 * any sign-in from the church tenant, so signing in again afterwards gives a
 * new uid with no areas at all.
 */
import { CONFIRM_LOCKOUT_FIELD } from '@spsm/shared';

import { apiPost } from '@/api/client';
import { signOut } from '@/firebase/auth';

/**
 * Delete the signed-in person's account, then sign the phone out.
 *
 * The sign-out is not tidying. The server has just removed the auth user, so
 * the SDK is holding a session for an account that no longer exists — every
 * subsequent read fails in a way that names nothing. Clearing it is what makes
 * `onAuthChange` fire and the drawer redraw itself as signed out.
 *
 * Throws `ApiError` with the Function's own sentence, which is written to be
 * shown. In particular a superadmin who has not acknowledged the lockout gets
 * a 409 carrying `LOCKOUT_NOT_CONFIRMED`, and that message is the instruction.
 */
export async function deleteOwnAccount(confirmLockout: boolean): Promise<void> {
  /*
   * The flag only for a superadmin, matching the website. Sending it
   * unconditionally would work — the Function ignores it for everybody else —
   * but it would mean an ordinary servant's request claimed to have
   * acknowledged a warning they were never shown.
   */
  await apiPost('/api/account/delete', confirmLockout ? { [CONFIRM_LOCKOUT_FIELD]: true } : {});
  await signOut();
}
