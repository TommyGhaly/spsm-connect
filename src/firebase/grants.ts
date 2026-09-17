/**
 * Who administers what — read from the member document, not from the token.
 *
 * This is the mobile port of apps/website/src/lib/screenGrants.ts, and it is
 * the module most worth getting exactly right, because the reason it is shaped
 * this way is not obvious.
 *
 * There are two copies of a person's screen grants:
 *
 *   1. `members/{uid}.screenAdmin` — the truth. `firestore.rules` reads it with
 *      a `get()`, so a grant made in the console is live on the next read.
 *   2. The `screens` custom claim — a MIRROR, written by `mirrorGrantsToClaims`
 *      in functions/src/auth.ts, and it exists for exactly one reason: Firebase
 *      **Storage** rules cannot read Firestore. Nothing else should consult it.
 *
 * A custom claim only reaches a client when the ID token is refreshed, which
 * can be up to an hour. So the mirror lags. The dance below is: read the
 * document, compare it to the claim, and if they disagree force a token
 * refresh — which is what makes a freshly granted screen appear without the
 * person being told to sign out and back in.
 *
 * NEVER authorize off the claim. It is the stale copy by construction.
 */
import { getAuth } from '@react-native-firebase/auth';
import { doc, getDoc, getFirestore } from '@react-native-firebase/firestore';
import {
  COLLECTIONS,
  DEFAULT_CLAIMS,
  canAdminProgram,
  canAdminProgramEvent,
  canAdminScreen,
  claimsMirrorGrants,
  defaultProgramAdmin,
  defaultScreenAdmin,
  parseFinanceScopes,
  parseProgramAdmin,
  parseScreenAdmin,
  type AdminScreen,
  type FinanceScopes,
  type ProgramAdmin,
  type ScreenAdmin,
  type SpsmClaims,
} from '@spsm/shared';

import { claimsOf } from './auth';

export interface Grants {
  claims: SpsmClaims;
  screenAdmin: ScreenAdmin;
  programAdmin: ProgramAdmin;
  finance: FinanceScopes;
}

/** Nobody: signed out, anonymous, or a member document that does not exist. */
export function noGrants(): Grants {
  return {
    claims: DEFAULT_CLAIMS,
    screenAdmin: defaultScreenAdmin(),
    programAdmin: defaultProgramAdmin(),
    finance: parseFinanceScopes(undefined),
  };
}

/**
 * Read the current user's grants, refreshing the token if the mirror has
 * fallen behind.
 *
 * An anonymous session is given nothing without a read: it holds no member
 * document, and asking for one would be a billed lookup that can only ever
 * return nothing.
 */
export async function readGrants(): Promise<Grants> {
  const user = getAuth().currentUser;
  if (!user || user.isAnonymous) return noGrants();

  const snapshot = await getDoc(doc(getFirestore(), COLLECTIONS.members, user.uid));
  const data = snapshot.data() ?? {};

  const screenAdmin = parseScreenAdmin(data['screenAdmin']);
  const programAdmin = parseProgramAdmin(data['programAdmin']);
  /*
   * `financeScopes`, and the field name is the whole of the bug that was here.
   *
   * This read `data['finance']`, which no document has ever carried — the
   * website writes `financeScopes`, `firestore.rules` reads `financeScopes` in
   * `hasFinance()`, and the Areas screen writes all three keys of it. An absent
   * map reads as all three sources by design (see `FINANCE_SOURCES`), so the
   * old key failed silently and in the permissive direction: every narrowing a
   * superadmin had made on the website was ignored in the app, and a bookkeeper
   * given the shop's books alone still passed `canSeeFinanceSource(...,
   * 'bookstore')` because they passed it for everything.
   */
  const finance = parseFinanceScopes(data['financeScopes']);

  let claims = await claimsOf(user);

  /*
   * The disagreement check. `claimsMirrorGrants` compares the set of screens
   * the document grants against the set the token carries; a mismatch means
   * `mirrorGrantsToClaims` has run (or is about to) and this token predates it.
   *
   * One forced refresh, not a loop: if the Function has not written the claim
   * yet, refreshing again would not help, and the document is the authority for
   * everything except Storage anyway.
   */
  if (!claimsMirrorGrants(claims, screenAdmin)) {
    claims = await claimsOf(user, /* forceRefresh */ true);
  }

  return { claims, screenAdmin, programAdmin, finance };
}

/* -------------------------------------------------------------------------- */
/* Predicates — the same ones firestore.rules mirrors                          */
/* -------------------------------------------------------------------------- */

export function mayAdminScreen(grants: Grants, screen: AdminScreen): boolean {
  return canAdminScreen(grants.claims, grants.screenAdmin, screen);
}

export function mayAdminProgram(grants: Grants, programId: string): boolean {
  return canAdminProgram(grants.claims, grants.programAdmin, programId);
}

export function mayAdminProgramEvent(
  grants: Grants,
  programId: string,
  programEventId: string,
): boolean {
  return canAdminProgramEvent(grants.claims, grants.programAdmin, programId, programEventId);
}
