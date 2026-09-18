/**
 * The approval queue's data layer, and the writes that decide a photograph.
 *
 * The app's half of the website's `features/programs/review.ts`, operation for
 * operation. Everything its header says is true here and is not repeated; what
 * follows is only what differs on a phone, plus the two constraints that are
 * load-bearing in both copies and would be silently broken by a tidy-up.
 *
 * ## The query's shape is not a preference
 *
 * `where('programId','==',…)` and `where('status','==','pending')` are both
 * required, and neither may be widened. Firestore judges a *list* by what it
 * could return: the rule allows a read when the document is approved **or** the
 * reader administers its program, so an unfiltered pending query is provable
 * only by `isSuper()` and a program lead gets a flat `permission-denied` for the
 * whole query — which on a screen looks like a bug rather than a refusal.
 *
 * The ordering is part of the same fact. `[programId, status, submittedAt]` is a
 * composite index that lives in the website's `firestore.indexes.json`, and this
 * is the second client to depend on it. A missing index here is not a failed
 * build; it is a queue that spins forever on somebody's phone.
 *
 * ## The preview is the one image in this app fetched with credentials
 *
 * Every other photograph the app draws is an unauthenticated `?alt=media` URL
 * built by hand — see `gallery/media.ts`. That cannot work for a pending item:
 * `submissions/` is the one prefix on the bucket whose reads are gated, so the
 * hand-built form 403s there by design. `reviewUrl` uses `getDownloadURL`, which
 * carries the token.
 *
 * `storage.rules` gates that prefix on `isPerson()` — a real church account, not
 * the anonymous session an uploader holds. So a reviewer must be signed in as
 * themselves, which they are: nothing reaches this file without a program grant,
 * and a grant lives on a member document.
 *
 * ## Approving is one write, and the order inside it matters
 *
 * `programEventId` goes out *beside* `status`, never in a write before it. The
 * rules check an update against the document as it stands **before** the write,
 * so one write is one permission check against a known level; two writes would
 * check the second against the destination, which for an event-scoped volunteer
 * is a different answer — they could move a photograph out of their week and not
 * back in. It also means `onGalleryMediaReviewed` fires once, on a document that
 * already says where it lives, so the bytes are copied to the right prefix
 * rather than to the level the sender guessed.
 *
 * Nothing here writes `renditionPath`. A client that could would be able to
 * point an approved document at any object in the bucket, which is the approval
 * gate removed by another door.
 */
import { getAuth } from '@react-native-firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type QueryDocumentSnapshot,
} from '@react-native-firebase/firestore';
import { getDownloadURL, getStorage, ref } from '@react-native-firebase/storage';
import { COLLECTIONS } from '@spsm/shared';

/**
 * How many pending items to hold at once.
 *
 * The website's cap, and for its reason: the realistic worst case is a camp
 * uploading a few hundred photographs in an evening, the work is "clear the
 * queue", and the queue is cleared from the top. A hundred previews is also
 * about as much as a phone should be asked to hold download URLs for.
 */
const QUEUE_LIMIT = 100;

/** One photograph awaiting a decision. */
export interface PendingItem {
  id: string;
  programId: string;
  /** The level its sender chose. May be the program's own id — see `MediaRow`. */
  programEventId: string;
  kind: 'photo' | 'video';
  /**
   * The web-ready copy, still in quarantine. Null while the transcode Function
   * is still working, and always null for a video — `reviewUrl` says what that
   * means on screen rather than pretending there is something to look at.
   */
  previewPath: string | null;
  /**
   * The original, as it was uploaded. Only ever read as `reviewUrl`'s fallback.
   * Also under `submissions/`, so it is no more public than the preview is.
   */
  sourcePath: string | null;
  caption: string;
  /** Width ÷ height, for drawing the preview at its own shape. */
  aspect: number | null;
}

/**
 * Watch one ministry's queue.
 *
 * A listener rather than a read, and that is worth the socket: two people work
 * this during a camp — one emptying a phone, one clearing the queue — and a list
 * that only tells the truth when the screen is reopened makes the second person
 * work from something wrong in both directions.
 *
 * Opened only for somebody who may read it; the caller checks the grant. A
 * listen that is refused still costs a round trip and logs a permission denial,
 * and this page is public.
 */
export function watchPendingForProgram(
  programId: string,
  onItems: (items: PendingItem[]) => void,
  onError: (error: Error) => void,
): () => void {
  return onSnapshot(
    query(
      collection(getFirestore(), COLLECTIONS.galleryMedia),
      where('programId', '==', programId),
      where('status', '==', 'pending'),
      // Oldest first. A queue worked newest-first strands the earliest
      // submissions forever, and whoever sent photographs the night camp ended
      // is the one most likely to come asking after them.
      orderBy('submittedAt'),
      limit(QUEUE_LIMIT),
    ),
    (snapshot) => onItems(snapshot.docs.map(toPending)),
    (error) => onError(error as Error),
  );
}

/**
 * A URL for the one being looked at.
 *
 * Falls back to `sourcePath` when the transcode has not landed, which is what
 * the website does — an iPhone upload is HEIC and may not decode, but a phone
 * stands a better chance of it than a browser, and a preview that might work
 * beats a grey box on a decision somebody is about to make.
 *
 * Null rather than a throw: "there is nothing to show yet" is a state the queue
 * draws, and a rejected promise here would take a screen down over one file.
 */
export async function reviewUrl(item: PendingItem): Promise<string | null> {
  const path = item.previewPath ?? item.sourcePath;
  if (!path) return null;

  try {
    return await getDownloadURL(ref(getStorage(), path));
  } catch (error) {
    console.warn(`[gallery] no preview at ${path}:`, error);
    return null;
  }
}

/** The signed-in reviewer, for the audit fields the rules and the site read. */
function uid(): string | null {
  return getAuth().currentUser?.uid ?? null;
}

/**
 * Publish one, filed wherever the reviewer says it belongs.
 *
 * `placement` is written here rather than offered as three switches nobody
 * reads: an approved photograph belongs in its own gallery and on the hall
 * screen, and the homepage band is a smaller editorial choice made deliberately
 * elsewhere. The website writes exactly this default, and a phone that wrote a
 * different one would make where a photograph appears depend on which screen
 * approved it.
 *
 * The caption rides along when there is one, for the reason the filing does —
 * one write, one permission check, one trigger. An untouched caption is left
 * absent rather than written as `''`, so approving cannot quietly erase one that
 * was already there.
 */
export async function approveInto(
  mediaId: string,
  programEventId: string,
  caption: string | null,
): Promise<void> {
  await updateDoc(doc(getFirestore(), COLLECTIONS.galleryMedia, mediaId), {
    programEventId,
    status: 'approved',
    placement: { onPage: true, slideshow: true, homepage: false },
    ...(caption === null ? {} : { caption: trimCaption(caption) }),
    reviewedAt: serverTimestamp(),
    reviewedBy: uid(),
    updatedAt: serverTimestamp(),
    updatedBy: uid(),
  });
}

/**
 * Delete a photograph and everything it is made of.
 *
 * One document delete, and the files follow. `galleries/` is `allow write: if
 * false` for every client — a client that could write it could publish anything
 * into the parish's public bucket with nobody approving it — so the browser and
 * the app both do the one thing they are allowed to do, and
 * `onGalleryMediaDeleted` removes the objects with the Admin SDK afterwards.
 *
 * That split is also why this is safe to call from a phone on church wifi: the
 * document is what every screen reads, so the photograph is gone the moment this
 * returns, and if the bucket is briefly unreachable the platform retries the
 * trigger — which an app that has since been backgrounded could not.
 *
 * It cannot be undone. Every caller arms a confirmation first.
 */
export async function deleteMediaForever(mediaId: string): Promise<void> {
  await deleteDoc(doc(getFirestore(), COLLECTIONS.galleryMedia, mediaId));
}

/**
 * Edit an approved photograph in place — its caption, the level it is filed on,
 * or both.
 *
 * Separate from `approveInto` because the two mean different things by the same
 * fields: that one is a decision about a submission, this one is housekeeping on
 * something that has been on the website for a year. Merging them would mean a
 * function that sometimes sets `status` and sometimes does not, called from a
 * sheet that must never set it.
 */
export async function editMedia(
  mediaId: string,
  changes: { programEventId?: string; caption?: string },
): Promise<void> {
  await updateDoc(doc(getFirestore(), COLLECTIONS.galleryMedia, mediaId), {
    ...(changes.programEventId === undefined ? {} : { programEventId: changes.programEventId }),
    ...(changes.caption === undefined ? {} : { caption: trimCaption(changes.caption) }),
    updatedAt: serverTimestamp(),
    updatedBy: uid(),
  });
}

/** The website's limit, applied here so the two cannot disagree about it. */
function trimCaption(caption: string): string {
  return caption.trim().slice(0, 300);
}

/*
 * Field by field, like `toMedia` in data.ts and for its reason: this binary is
 * on a phone and cannot be redeployed when a document turns out to be shaped
 * unexpectedly. The queue is also the one place that meets the *oldest*
 * documents in the collection, since anything nobody ever decided is still here.
 */
function toPending(snapshot: QueryDocumentSnapshot): PendingItem {
  const data = snapshot.data();
  const width = data['width'];
  const height = data['height'];

  return {
    id: snapshot.id,
    programId: typeof data['programId'] === 'string' ? data['programId'] : '',
    programEventId: typeof data['programEventId'] === 'string' ? data['programEventId'] : '',
    kind: data['kind'] === 'video' ? 'video' : 'photo',
    previewPath: typeof data['previewPath'] === 'string' ? data['previewPath'] : null,
    sourcePath: typeof data['sourcePath'] === 'string' ? data['sourcePath'] : null,
    caption: typeof data['caption'] === 'string' ? data['caption'] : '',
    aspect:
      typeof width === 'number' && typeof height === 'number' && width > 0 && height > 0
        ? width / height
        : null,
  };
}
