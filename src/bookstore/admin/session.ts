/**
 * Who may review the shop, and who may change it.
 *
 * The mobile port of the website's `useBookstoreAdmin`, and it keeps that
 * file's central point: **two answers, not one.**
 *
 *   canReview  `orders` and `bookstoreStats` read — bookstore **or** the
 *              bookstore slice of finance
 *   canEdit    `products` and `config/bookstore` write, and every Function
 *              under /api/square — bookstore only
 *
 * A single flag would hand the treasurer the controls that rewrite the parish's
 * catalog. `firestore.rules` would refuse every one of those writes, so the
 * visible failure is a screenful of controls that silently do nothing.
 *
 * ## One deliberate difference from the website
 *
 * The website asks `canAdmin('finance')` for the review half. The rule it is
 * mirroring is `hasScreen('bookstore') || hasFinance('bookstore')` — the
 * *source*, not the door — so a treasurer narrowed at /access to camp and forms
 * would be offered an orders queue that Firestore then refuses. This asks
 * `canSeeFinanceSource(..., 'bookstore')`, which is the rule exactly. A check
 * looser than the policy shows a screen of permission errors; one stricter hides
 * a screen from the people it was built for. Neither is caution.
 *
 * ## Refund and Refresh are `canEdit`, and that is not a tightening either
 *
 * `squareRefund` and `refreshBookstoreStats` both guard on `mayManageOrders`,
 * which is `mayAdminScreen(caller, 'bookstore')` — finance does not reach them.
 * So the two controls that write live behind `canEdit` even though they sit on
 * screens `canReview` opens. See `Orders` and `Metrics`.
 *
 * ## Not a security boundary
 *
 * `firestore.rules` and the Functions are. This decides what to draw — which
 * matters more than usual here, because the orders queue lists real people's
 * names and what they bought.
 */
import { canAdminScreen, canSeeFinanceSource } from '@spsm/shared';

import { useSession } from '@/session/SessionProvider';

export interface BookstoreAdminSession {
  /** True once the answer is known. Controls stay absent until then. */
  ready: boolean;
  /** May they see the orders queue and the sales figures? */
  canReview: boolean;
  /**
   * May they change what the shop *is* — its shelves, sections and covers?
   *
   * Deliberately narrower than `canReview`. A treasurer reading the books is
   * not thereby somebody who rearranges them.
   */
  canEdit: boolean;
}

export function useBookstoreAdmin(): BookstoreAdminSession {
  const { grants, loading } = useSession();

  const runsTheShop = canAdminScreen(grants.claims, grants.screenAdmin, 'bookstore');

  return {
    ready: !loading,
    canReview:
      runsTheShop ||
      canSeeFinanceSource(grants.claims, grants.screenAdmin, grants.finance, 'bookstore'),
    canEdit: runsTheShop,
  };
}
