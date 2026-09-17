/**
 * The two writes staff may make to the calendar, from a phone.
 *
 * A port of the website's `features/calendar/adminData.ts`, function for
 * function, and the reasoning there holds here unchanged:
 *
 * **Direct Firestore writes, not a Cloud Function.** The Function endpoints in
 * this programme exist where there is something rules cannot guard — a call out
 * to Square, a Breeze credential that must not reach a client. Neither applies:
 * these are two documents in two collections, and `firestore.rules` is the
 * actual policy. A Function in front of them would be a second, weaker copy of
 * a check that already exists in the one place that cannot be bypassed.
 *
 * The gate is `hasScreen('events')` — the Church calendar row at /access. The
 * edit controls in the UI are a convenience: this app renders them from
 * `mayAdminScreen(grants, 'events')`, and somebody who patched that check out of
 * their own build still cannot write, because the rules read the grant and not
 * the button.
 *
 * **There is deliberately no way to delete anything but our own.** The whole
 * surface is two collections the church owns outright; a liturgy read from
 * Breeze is not in Firestore at all, so no function here could remove one even
 * if somebody wrote it. See packages/shared/src/schema/scheduleAdmin.ts.
 */
import { getAuth } from '@react-native-firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getFirestore,
  serverTimestamp,
  setDoc,
} from '@react-native-firebase/firestore';
import { COLLECTIONS, type CalendarDetail, type ScheduleEntry } from '@spsm/shared';

/** What every write records about who made it. */
function audit() {
  return {
    updatedAt: serverTimestamp(),
    updatedBy: getAuth().currentUser?.uid ?? '',
  };
}

/** Add something the church is doing that no source knows about. */
export async function addScheduleEntry(entry: ScheduleEntry): Promise<string> {
  const created = await addDoc(collection(getFirestore(), COLLECTIONS.scheduleEntries), {
    ...entry,
    ...audit(),
    createdAt: serverTimestamp(),
  });
  return created.id;
}

/**
 * Remove one.
 *
 * Takes the *occurrence* id, which is `manual:<documentId>` — the caller has an
 * occurrence in hand, not a document. Refuses anything that is not one of ours,
 * so a mistyped call cannot reach for another collection's id.
 */
export async function removeScheduleEntry(occurrenceId: string): Promise<void> {
  const [prefix, documentId] = splitOnce(occurrenceId, ':');
  if (prefix !== 'manual' || !documentId) {
    throw new Error(`Refusing to delete ${occurrenceId}: it was not added here.`);
  }
  await deleteDoc(doc(getFirestore(), COLLECTIONS.scheduleEntries, documentId));
}

/**
 * Save an annotation against an occurrence.
 *
 * `setDoc` with the occurrence id as the document id, so there is exactly one
 * detail per occurrence and saving twice edits rather than accumulates. An
 * `addDoc` here would leave a trail of superseded notes with nothing to say
 * which was current.
 */
export async function saveCalendarDetail(
  occurrenceId: string,
  detail: Omit<CalendarDetail, 'occurrenceId'>,
): Promise<void> {
  await setDoc(doc(getFirestore(), COLLECTIONS.calendarDetails, encodeDetailId(occurrenceId)), {
    ...detail,
    occurrenceId,
    ...audit(),
  });
}

/** Remove an annotation. The occurrence it was about is untouched. */
export async function removeCalendarDetail(occurrenceId: string): Promise<void> {
  await deleteDoc(doc(getFirestore(), COLLECTIONS.calendarDetails, encodeDetailId(occurrenceId)));
}

/**
 * An occurrence id, made safe to use as a document id.
 *
 * Firestore forbids `/` in a document id and rejects `.` and `..` outright.
 * Occurrence ids are mostly Breeze's numeric instance ids, which are fine, but
 * `event:<slug>` and `bulletin:<uuid>` come from elsewhere and a slug with a
 * slash in it would produce a write to a subcollection rather than an error.
 *
 * **This must stay character for character what the website does.** The two
 * surfaces annotate the same occurrences, and a phone that encoded a slash
 * differently would write a second detail document the website never reads.
 * `getStaffLayers` keys its map on the stored `occurrenceId` rather than on the
 * document id precisely because of this substitution.
 */
function encodeDetailId(occurrenceId: string): string {
  return occurrenceId.replace(/[/.]/g, '_');
}

function splitOnce(value: string, separator: string): [string, string] {
  const at = value.indexOf(separator);
  return at === -1 ? [value, ''] : [value.slice(0, at), value.slice(at + separator.length)];
}
