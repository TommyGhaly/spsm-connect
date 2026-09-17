/**
 * Whether the person holding the phone runs the camp, and what the camp is set
 * to.
 *
 * The mobile counterpart of the website's `useCampAdmin`, and it answers the
 * same question through the same predicate — `canAdminScreen(claims, screens,
 * 'camp')`, which is what `runsCamp()` reads in `firestore.rules`. The two
 * cannot drift because neither of them is a second opinion: the flag lives on
 * `members/{uid}.screenAdmin` and `src/firebase/grants.ts` has already read it
 * once for the whole session.
 *
 * ## Three differences from the website's hook, all of them because of where
 * this runs
 *
 *  1. **No `canSeeMoney`.** The website's camp screens show balances, discounts
 *     and payment history, so they need the second grant — `finance` narrowed
 *     to `camp`. None of the three screens here shows a figure: the register is
 *     a tick and a time, the groups board is a read-only arrangement, and the
 *     only thing the hub writes is a switch. A permission nothing consults is
 *     a permission that will one day be consulted by accident.
 *  2. **The grants are already in hand.** `SessionProvider` reads them once per
 *     launch, so this costs no document. The website pays for a
 *     `members/{uid}` read per camp screen because it has no session store to
 *     hang the answer on.
 *  3. **The settings come from `useCampConfig`**, which the public sign-up form
 *     already subscribes to. One listener on one world-readable document, shared
 *     between the form that closes and the switch that closes it.
 *
 * ## Not a security boundary
 *
 * `firestore.rules` is. This decides what to draw — which matters more than
 * usual on these screens, because the register lists children's names and the
 * afternoon puts a guardian's phone number beside each one. Somebody who
 * patched `canEdit` out of their own build gets an empty register and a
 * permission error.
 */
import { canAdminScreen, type CampConfig } from '@spsm/shared';

import { useCampConfig } from '@/camp/useCampConfig';
import { useSession } from '@/session/SessionProvider';

export interface CampAdminSession {
  /**
   * True once the grants read and the first settings snapshot have both
   * landed. Controls stay absent until then — deciding during that moment
   * would flash "not for you" at the people it is for, every launch.
   */
  ready: boolean;
  /** True when this person may read and write the camp's own documents. */
  canEdit: boolean;
  config: CampConfig;
  uid: string | null;
}

export function useCampAdmin(): CampAdminSession {
  const { grants, loading, user } = useSession();
  const { ready, config } = useCampConfig();

  return {
    ready: !loading && ready,
    canEdit: canAdminScreen(grants.claims, grants.screenAdmin, 'camp'),
    config,
    /*
     * The uid, and an anonymous one deliberately included rather than nulled.
     *
     * Every write on these screens has to carry `updatedBy == request.auth.uid`
     * or the rules refuse it, and an anonymous session cannot hold the camp
     * grant anyway — so this is never the uid of a stranger. Nulling it would
     * turn a refusal into a tick that silently does nothing.
     */
    uid: user?.uid ?? null,
  };
}
