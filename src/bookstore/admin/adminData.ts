/**
 * The bookstore admin's reads and writes, from a phone.
 *
 * The mobile port of the website's `features/bookstore/adminData.ts`, and the
 * split it describes is the same one here: `../data.ts` is the shopper's view —
 * published products only, no orders, nothing that writes — and this is the
 * signed-in volunteer's.
 *
 * ## Two transports, and which is which is not a style choice
 *
 * **Firestore, directly:** the orders list, the fulfilment field, the stats
 * documents, the section list, the product's `section`. Every one of those is a
 * document this app may already read or write under `firestore.rules`, and
 * putting a Function in front of one would add a hop that checks the same claim
 * twice.
 *
 * **A Cloud Function, through `apiPost`:** anything that touches Square, plus
 * the refund. The Square access token authorizes charges against the parish's
 * account and lives only in the Functions runtime — it must never be on a
 * phone. And beyond secrecy there is a correctness reason that bites even for
 * the harmless-looking fields: `name`, `description`, `price` and `stockCount`
 * are all on `sync-catalog.mjs`'s field mask, so a value written straight into
 * the Firestore document survives exactly until the next sync and then reverts.
 * The Function edits Square and mirrors the result back, which is what the
 * shop's live subscription picks up seconds later.
 *
 * `apiPost` already carries the ID token and an App Check token and already
 * prefers the Function's own words for a refusal — see `src/api/client.ts`. So
 * there is no equivalent here of the website's `callCatalog`: the whole of that
 * helper's job, including its hard-won "the server answered 502 and not in the
 * usual way" diagnosis, is `ApiError` in that file.
 *
 * ## Not the security boundary
 *
 * `firestore.rules` and the Functions' own `mayManageOrders` are. Everything
 * below is convenience for somebody who already holds the grant.
 */
import { getAuth } from '@react-native-firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from '@react-native-firebase/firestore';
import {
  COLLECTIONS,
  CONFIG_DOC_BOOKSTORE,
  parseSections,
  type BookstoreSection,
  type BookstoreStats,
  type FulfillmentStatus,
  type Order,
  type Product,
} from '@spsm/shared';

import { apiPost } from '@/api/client';

/** An order with its document id, which is Square's own order id. */
export type OrderRow = Order & { id: string };

/**
 * How many orders the screen holds at once.
 *
 * The website's number, and its reasoning transfers unchanged: the parish sells
 * a few books a week, two hundred is more than a year of them, and a "load
 * more" button on a list that will never reach the bottom is machinery
 * maintained for nobody. When it does start filling up the fix is a date
 * filter, not a page button — volunteers look for *this week's* orders.
 */
export const ORDER_PAGE = 200;

/** The signed-in uid, or a refusal in words somebody can act on. */
function uidOrThrow(): string {
  const uid = getAuth().currentUser?.uid;
  if (!uid) throw new Error('Your session has expired. Sign in again.');
  return uid;
}

/* -------------------------------------------------------------------------- */
/* Orders                                                                      */
/* -------------------------------------------------------------------------- */

/** Every order, newest first. Whoever runs the shop, or reads its takings. */
export async function listOrders(): Promise<OrderRow[]> {
  const snapshot = await getDocs(
    query(
      collection(getFirestore(), COLLECTIONS.orders),
      orderBy('createdAt', 'desc'),
      limit(ORDER_PAGE),
    ),
  );
  return snapshot.docs.map((entry) => ({ ...(entry.data() as Order), id: entry.id }));
}

/**
 * Move an order along: unfulfilled → ready → collected.
 *
 * The only field a client may change on an order. `firestore.rules` enforces
 * that with a `hasOnly` on the affected keys, so a write that tried to carry
 * `status` or `total` alongside would be refused entirely rather than partially
 * applied.
 */
export async function setFulfillment(
  orderId: string,
  fulfillment: FulfillmentStatus,
): Promise<void> {
  const uid = uidOrThrow();

  await updateDoc(doc(getFirestore(), COLLECTIONS.orders, orderId), {
    fulfillment,
    updatedAt: serverTimestamp(),
    // The rule requires this to equal the caller's uid, so a write cannot be
    // attributed to somebody else.
    updatedBy: uid,
  });
}

/**
 * Refund an order in full.
 *
 * A Function rather than a Firestore write, because it moves money. The ID
 * token goes with it and is re-verified there against `mayManageOrders` —
 * which is the bookstore grant and *not* finance, so this is offered only to
 * somebody who `canEdit`. See `session.ts`.
 */
export async function refundOrder(orderId: string, reason: string): Promise<void> {
  await apiPost('/api/square/refund', { orderId, reason });
}

/* -------------------------------------------------------------------------- */
/* Figures                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * One rolled-up period, or null when the rollup has not written it yet.
 *
 * Null is an ordinary answer and not an error: `bookstoreStats` is empty until
 * the scheduled Function first runs, and a day with no activity never gets a
 * document at all. The screen says "nothing recorded" rather than failing.
 */
export async function readStats(
  period: 'day' | 'month',
  key: string,
): Promise<BookstoreStats | null> {
  const snapshot = await getDoc(
    doc(getFirestore(), COLLECTIONS.bookstoreStats, `${period}-${key}`),
  );
  return snapshot.exists() ? (snapshot.data() as BookstoreStats) : null;
}

/**
 * Recompute the recent periods now.
 *
 * The rollup runs hourly, which is fresh enough to read and too stale to trust
 * when somebody has just taken an order at the table and wants to see it land.
 */
export async function refreshStats(): Promise<string[]> {
  const answer = await apiPost<{ days?: string[] }>('/api/square/stats-refresh', {});
  return answer.days ?? [];
}

/**
 * Slug → product name, for the metrics tables.
 *
 * The stats documents are keyed by slug because that is what an event carries,
 * and `be-prepared-fr-daoud-lamei` is not a thing to put in front of a person.
 * Read separately rather than denormalized into the rollup: a book renamed in
 * Square should show its new name against its old sales.
 *
 * Unpublished products are included — a title withdrawn from the shop still
 * sold copies last month, and leaving it as a bare slug helps nobody.
 */
export async function productNames(): Promise<Map<string, string>> {
  const snapshot = await getDocs(collection(getFirestore(), COLLECTIONS.products));
  const names = new Map<string, string>();
  for (const entry of snapshot.docs) {
    const product = entry.data() as Product;
    if (product.slug) names.set(product.slug, product.name);
  }
  return names;
}

/* -------------------------------------------------------------------------- */
/* The shop's divisions                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Save the shop's divisions.
 *
 * `setDoc(..., { merge: true })` because the document may not exist — nothing
 * seeds `config/bookstore`, and the first section anybody makes is what creates
 * it. The rules have a separate `create` branch for exactly that case.
 */
export async function writeSections(sections: BookstoreSection[]): Promise<void> {
  const uid = uidOrThrow();

  await setDoc(
    doc(getFirestore(), COLLECTIONS.config, CONFIG_DOC_BOOKSTORE),
    { sections, updatedAt: serverTimestamp(), updatedBy: uid },
    { merge: true },
  );
}

/** The sections as Firestore currently holds them. */
export async function readSections(): Promise<BookstoreSection[]> {
  const snapshot = await getDoc(doc(getFirestore(), COLLECTIONS.config, CONFIG_DOC_BOOKSTORE));
  return parseSections(snapshot.exists() ? snapshot.data()?.['sections'] : null);
}

/**
 * File a product into a section, or clear it.
 *
 * A direct Firestore write, not a Function: nothing about it touches Square, and
 * `section` is the one field on a product document that the catalog sync does
 * *not* own. `firestore.rules` admits exactly `section`, `updatedAt` and
 * `updatedBy` from the bookstore grant, so a change here cannot carry a price
 * with it.
 */
export async function setProductSection(slug: string, section: string | null): Promise<void> {
  const uid = uidOrThrow();

  await updateDoc(doc(getFirestore(), COLLECTIONS.products, slug), {
    section,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });
}

/* -------------------------------------------------------------------------- */
/* The catalog, which is Square's                                              */
/* -------------------------------------------------------------------------- */

export interface NewProduct {
  name: string;
  description: string;
  priceCents: number;
  section: string | null;
}

/**
 * Add a product — to Square first, then here.
 *
 * Square has to be first: the checkout prices orders from Square's own catalog,
 * so a row that exists only in Firestore has no variation id and is a book on
 * the shop that nobody can buy. The Function enforces that order; this just
 * carries the form to it.
 */
export async function createProduct(product: NewProduct): Promise<string> {
  const answer = await apiPost<{ slug?: string }>('/api/square/product', product);
  return String(answer.slug ?? '');
}

/**
 * Send a photograph to Square, attached to this product.
 *
 * As a `data:` URL rather than a multipart body, because the request needs an ID
 * token and the phone must never hold the Square access token. The Function
 * reassembles the multipart body Square's image endpoint requires.
 *
 * The bytes are base64 in a JSON string, so a picture costs about a third more
 * on the wire than it does on disk. `pickPicture` shrinks to a 1600px JPEG
 * before it gets here, which puts a phone photograph a long way under the
 * Function's 15MB ceiling — that ceiling is the enforcement, and this is the
 * courtesy. Do not move one into the other.
 */
export async function uploadProductImage(slug: string, image: string): Promise<string> {
  const answer = await apiPost<{ url?: string }>('/api/square/product-image', { slug, image });
  return String(answer.url ?? '');
}

export async function removeProductImage(slug: string, url: string): Promise<void> {
  await apiPost('/api/square/product-image-remove', { slug, url });
}

/**
 * Set how many copies are on the shelf, or stop counting them.
 *
 * `null` is "not tracked" and is a different thing from `0`, which is sold out:
 * the shop hides a book at zero and shows one at null. The Function switches
 * Square's `track_inventory` accordingly, which is why this cannot be a
 * Firestore write — and why it would not survive one anyway, `stockCount` being
 * on the sync's field mask.
 */
export async function setProductStock(slug: string, count: number | null): Promise<void> {
  await apiPost('/api/square/product-stock', { slug, count });
}

/**
 * Take a product off the shop for good.
 *
 * Archives it in Square and unpublishes the mirror, in that order. Both are
 * needed: the unpublish is what the shop's live subscription notices within
 * seconds, and the archive is what stops the next `npm run catalog` publishing
 * it again.
 */
export async function archiveProduct(slug: string): Promise<void> {
  await apiPost('/api/square/product-archive', { slug });
}

/**
 * Change what Square owns about a book: its title, its price, its description.
 *
 * One call for all three, so editing a book is one round trip and one Square
 * catalog version rather than three. Only the keys present are touched; an
 * absent one is left alone rather than cleared.
 *
 * The slug, and so the product's web address, deliberately does not change with
 * the title: a new slug is a new document, and would cost the book its category
 * and its link from every past order.
 */
export interface ProductDetails {
  name?: string;
  description?: string;
  priceCents?: number;
}

export async function setProductDetails(slug: string, details: ProductDetails): Promise<void> {
  await apiPost('/api/square/product-details', { slug, ...details });
}
