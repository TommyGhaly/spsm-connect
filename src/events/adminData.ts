/**
 * The writes the `events` grant may make from a phone.
 *
 * A port of the writing half of the website's `features/events/admin.ts`, and
 * the reasoning there holds here unchanged:
 *
 * **Direct Firestore and Storage writes, not a Cloud Function.** The Function
 * endpoints in this programme exist where there is something rules cannot guard
 * — a call out to Square, a Breeze credential that must not reach a client.
 * Neither applies: this is one document in one collection and one object in a
 * world-readable prefix, and `firestore.rules` and `storage.rules` are the
 * actual policy. A Function in front of them would be a second, weaker copy of
 * a check that already exists in the one place that cannot be bypassed.
 *
 * The gate is `hasScreen('events')` — the Parish calendar row at /access, the
 * same grant the calendar's own `adminData.ts` writes under. The editing
 * controls are drawn from `mayAdminScreen(grants, 'events')`, and somebody who
 * patched that check out of their own build still cannot write, because the
 * rules read the grant and not the button.
 *
 * ## Typing is the only save, and it writes live
 *
 * There is no publish step and no draft. `updateEvent` writes the parish's copy
 * directly, a second after somebody stops typing. Two things that costs, stated
 * where somebody will find them because nothing in the interface says them:
 * **there is no undo** — a mistyped title is the parish's title about a second
 * later, on the website as well as here — and there is no way to take an event
 * off the website except deleting it. Both are the price of the editor never
 * being able to show different words than the page. See `useAutosave`.
 *
 * ## Three things are deliberately absent
 *
 * **Creating an event.** Nothing on the website can make one either — its
 * `createEvent` has had no caller since `/staff/events` was removed, because a
 * new event has no page for an in-place editor to be in place *on*. Events are
 * made in the Firestore console until something replaces that, and a create
 * button here would be the app quietly growing a capability the website does
 * not have, with no list screen to hang it off.
 *
 * A create sheet and a list of event pages were built on `/events` on
 * 2026-09-21 and taken off again the same afternoon, at Tommy's direction: that
 * page is the ministries, and the parish calendar has no business on it. If
 * this comes back it belongs beside the calendar, not here.
 *
 * ## Two more things are deliberately absent
 *
 * **Deleting one.** At Tommy's direction: an event page is public, its deletion
 * cannot be undone from here once the window passes, and a bin on a phone is a
 * bin pressed by accident. The website's editor keeps `deleteEvent` and its
 * twelve-second undo, and that is where a deletion belongs.
 *
 * **Changing the slug.** It is the public URL, it is what anything already
 * shared points at, and it is the folder the photograph is filed under. The
 * editor shows it and does not offer to change it.
 *
 * ## The sweep is not ported, and that is a real gap
 *
 * The website's `sweepEventFiles` lists everything under `events/{slug}/` when
 * the editor opens and deletes what the document does not name. This deletes
 * the one path it is replacing — which covers the ordinary case — but a file
 * stranded by an app that lost its connection mid-save stays until somebody
 * opens the same event in a browser. Better than not tidying at all, and worth
 * knowing it is the browser that does the thorough pass.
 */
import { getAuth } from '@react-native-firebase/auth';
import {
  doc,
  getFirestore,
  serverTimestamp,
  updateDoc,
} from '@react-native-firebase/firestore';
import { deleteObject, getStorage, putFile, ref } from '@react-native-firebase/storage';
import { COLLECTIONS, draftToDocument, type EventDraft } from '@spsm/shared';

import { condense } from '@/upload/condense';

/** What a picked photograph is, whichever picker produced it. */
export interface PickedImage {
  uri: string;
  /** May be absent on Android; `condense` is given a specific type either way. */
  mimeType?: string | null;
  fileName?: string | null;
}

/**
 * Autosave. Writes what has been typed, straight onto the event.
 *
 * Called a second or two after somebody stops typing, which is the whole
 * interface. `updatedAt` is stamped because this *is* a change to the parish's
 * copy — there is no pending-edit copy for it to mean anything else about.
 */
export async function updateEvent(id: string, draft: EventDraft): Promise<void> {
  await updateDoc(doc(getFirestore(), COLLECTIONS.events, id), {
    ...draftToDocument(draft),
    updatedAt: serverTimestamp(),
    updatedBy: getAuth().currentUser?.uid ?? null,
  });
}

/**
 * Put a photograph in the bucket and hand back its path.
 *
 * A **path**, never a URL — the same rule the rest of the schema follows, and
 * for the same reason: a URL baked into a document is a URL that cannot be
 * changed when the bucket moves. `storageUrl` in `gallery/media.ts` turns it
 * into one at render time.
 *
 * Straight through the Storage SDK rather than a signed URL, as
 * `forms/pictures.ts` does and for its reason: `storage.rules` guards
 * `events/` and grants it to the `events` screen through the token's mirror,
 * which is the one thing that mirror exists for.
 *
 * Condensed first, down the same ladder a gallery photograph goes. Two things
 * that buys, and the second matters most here: a phone photograph is several
 * megabytes over church wifi, and the re-encode is what drops the EXIF block —
 * so the church does not publish the GPS coordinates its festival was
 * photographed at.
 */
export async function uploadEventHero(
  slug: string,
  picked: PickedImage,
): Promise<{ ok: true; path: string } | { ok: false; reason: string }> {
  try {
    const condensed = await condense(picked.uri, picked.mimeType ?? 'image/jpeg');
    const path = heroPath(slug, picked.fileName, condensed.contentType);
    await putFile(ref(getStorage(), path), condensed.uri, {
      contentType: condensed.contentType,
    });
    return { ok: true, path };
  } catch (error) {
    console.error('[events] hero upload failed', error);
    // `condense` throws with words that name the number to act on. Pass them
    // through rather than replacing them with something vaguer.
    return {
      ok: false,
      reason:
        error instanceof Error && error.message
          ? error.message
          : 'That photograph could not be uploaded.',
    };
  }
}

/**
 * Take one object out of the bucket.
 *
 * Only ever called with a path this event's document used to hold, and only
 * *after* the document has been written pointing somewhere else. The other
 * order leaves the page showing a photograph that has already been deleted.
 *
 * Failure is reported to the caller rather than thrown: a replacement that
 * saved but could not tidy up is a success with a footnote, not an error.
 */
export async function removeEventFile(path: string): Promise<void> {
  await deleteObject(ref(getStorage(), path));
}

/**
 * Where an event's photograph lives.
 *
 * Under the event's slug, and stamped — character for character the website's
 * `heroPath`, because both surfaces file into the same bucket and a second
 * convention would be a second place to look. A fixed `events/{slug}/hero`
 * would mean a replacement sits behind the *same* URL that every CDN, browser
 * cache and link preview already holds, so the parish would swap the picture
 * and keep seeing the old one.
 */
function heroPath(slug: string, fileName: string | null | undefined, contentType: string): string {
  const folder = slug.replace(/[^a-z0-9-]+/gi, '-').toLowerCase() || 'event';
  return `events/${folder}/hero-${Date.now()}.${extensionOf(fileName, contentType)}`;
}

/**
 * The suffix a human sees in the console when they go looking for the file.
 *
 * Taken from the *condensed* content type rather than the picked file's name
 * where the two disagree, because the bytes in the bucket are the re-encode's,
 * not the original's — a HEIC off an iPhone arrives as a JPEG and calling it
 * `.heic` would be the one lie in the path.
 */
function extensionOf(fileName: string | null | undefined, contentType: string): string {
  const fromType = contentType.split('/')[1]?.replace(/[^a-z0-9]/gi, '').toLowerCase();
  if (fromType) return fromType === 'jpeg' ? 'jpg' : fromType;

  const dot = (fileName ?? '').lastIndexOf('.');
  const fromName =
    dot > 0 ? (fileName ?? '').slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : '';
  return fromName || 'jpg';
}
