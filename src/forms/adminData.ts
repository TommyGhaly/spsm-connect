/**
 * The writes only the `forms` grant can make.
 *
 * A port of the website's `features/forms/admin/adminData.ts`, function for
 * function. Direct Firestore writes rather than a Cloud Function, for the
 * reason `src/calendar/adminData.ts` states: the Function endpoints in this
 * programme exist where there is something rules cannot guard, and a form
 * definition is a document in a collection `firestore.rules` already guards
 * with `hasScreen('forms')`.
 *
 * Submissions are the exception in one direction only — they are *written* by
 * `formSubmit` because the total has to be priced somewhere the submitter
 * cannot edit — but reviewing one is `allow read, update, delete: if
 * hasScreen('forms')`, so the review screen reads and writes them from here.
 *
 * The controls that lead here are drawn from `mayAdminScreen(grants, 'forms')`.
 * That decides what is on screen and nothing else: somebody who patched the
 * check out of their own build still cannot write, because the rules read the
 * grant rather than the button.
 */
import { getAuth } from '@react-native-firebase/auth';
import {
  collection,
  deleteDoc,
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
  where,
} from '@react-native-firebase/firestore';
import {
  COLLECTIONS,
  CONFIG_DOC_FORMS,
  isBuiltInForm,
  parseFormDefinition,
  toFormSlug,
  type FormAnswers,
  type FormDefinition,
  type FormDraft,
  type FormsPageConfig,
  type SubmissionStatus,
} from '@spsm/shared';

import type { WithId } from './data';

/* -------------------------------------------------------------------------- */
/* Form definitions                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Create or overwrite a form.
 *
 * The document id is the slug at creation and never changes afterwards, which
 * is what `readFormBySlug` is built around.
 *
 * The extra read is not defensive padding. `setDoc` replaces rather than
 * merges — which is exactly what makes removing a question work, and exactly
 * what would destroy `createdAt` on every edit. Firestore has no "set this
 * field only if absent" for a replacing write, so it is read back here where no
 * caller can forget to.
 */
export async function writeForm(id: string, draft: FormDraft): Promise<void> {
  const target = doc(getFirestore(), COLLECTIONS.forms, id);

  const existing = await getDoc(target);
  const createdAt = existing.exists() ? existing.data()?.['createdAt'] : undefined;

  await setDoc(target, {
    ...draft,
    slug: toFormSlug(draft.slug) || id,
    createdAt: createdAt ?? serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: getAuth().currentUser?.uid ?? null,
  });
}

/**
 * One form by its document id, drafts included.
 *
 * The public reader is `readFormBySlug`, which the rules answer only for a
 * published form. The builder edits by id — the thing that never changes when a
 * slug is edited — and needs the draft it has not published yet, so it reads
 * under `hasScreen('forms')` instead. Answers null for an id that is not there,
 * which the editor renders as "that form is gone" rather than as a failure.
 */
export async function readFormForEdit(id: string): Promise<WithId<FormDefinition> | null> {
  const snapshot = await getDoc(doc(getFirestore(), COLLECTIONS.forms, id));
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...parseFormDefinition(snapshot.id, snapshot.data()) };
}

/**
 * Delete a form definition. Its submissions are left alone, deliberately: a
 * registration somebody sent in is a record of something that happened, and
 * taking down the form it arrived through is not a reason to destroy it.
 */
export async function deleteForm(id: string): Promise<void> {
  /*
   * The two forms the church always has cannot be deleted, and
   * `firestore.rules` refuses this delete as well. Two checks for one rule is
   * not belt and braces for its own sake: this one exists so the failure is a
   * sentence on screen rather than a `permission-denied` in the log.
   */
  if (isBuiltInForm(id)) {
    throw new Error(
      'The contact form and the vehicle registration are permanent — the church’s own ' +
        'links and the car park tags point at them. Close it to submissions instead.',
    );
  }
  await deleteDoc(doc(getFirestore(), COLLECTIONS.forms, id));
}

/**
 * Put the forms in this order, top to bottom.
 *
 * Renumbers rather than swapping two, because `blankForm` creates every form
 * with `order: 100` — most of the collection shares one value, the hub falls
 * back to sorting those by title, and exchanging two identical numbers changes
 * nothing on screen. So a reorder assigns 10, 20, 30 … down the list, with gaps
 * of ten for a future insert, and only the documents whose number actually
 * changed are written.
 */
export async function setFormOrder(ids: string[], current: Map<string, number>): Promise<void> {
  const writes = ids
    .map((id, index) => ({ id, order: (index + 1) * 10 }))
    .filter((entry) => current.get(entry.id) !== entry.order)
    .map((entry) => setFormFlags(entry.id, { order: entry.order }));

  await Promise.all(writes);
}

/** Publish/unpublish and open/close, without a full rewrite of the document. */
export async function setFormFlags(
  id: string,
  flags: Partial<Pick<FormDefinition, 'published' | 'open' | 'order'>>,
): Promise<void> {
  await updateDoc(doc(getFirestore(), COLLECTIONS.forms, id), {
    ...flags,
    updatedAt: serverTimestamp(),
    updatedBy: getAuth().currentUser?.uid ?? null,
  });
}

/* -------------------------------------------------------------------------- */
/* The office's two settings                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Change the hub's own settings — the tap destination, the camp's position.
 *
 * The write half of `readFormsPageConfig` in `data.ts`, and a port of the
 * website's `setFormsPageConfig` down to the `merge`.
 *
 * `setDoc` with `merge` rather than `updateDoc`, because nothing seeds
 * `config/forms`: on a parish that has never set either of these the document
 * does not exist, and an update would be refused with nothing on screen to
 * explain it. Merging also means writing one of the two settings leaves the
 * other alone, which matters here — a drag that renumbers the list must not
 * quietly move the tag's destination.
 *
 * `updatedBy` is not bookkeeping: `firestore.rules` requires it to be the
 * signer's own uid on both branches.
 */
export async function setFormsPageConfig(
  patch: Partial<Pick<FormsPageConfig, 'nfcFormSlug' | 'campOrder'>>,
): Promise<void> {
  await setDoc(
    doc(getFirestore(), COLLECTIONS.config, CONFIG_DOC_FORMS),
    {
      ...patch,
      updatedAt: serverTimestamp(),
      updatedBy: getAuth().currentUser?.uid ?? null,
    },
    { merge: true },
  );
}

/* -------------------------------------------------------------------------- */
/* Submissions                                                                 */
/* -------------------------------------------------------------------------- */

export interface SubmissionRow {
  id: string;
  formId: string;
  formTitle: string;
  answers: FormAnswers;
  submitterName: string | null;
  submitterEmail: string | null;
  submitterPhone: string | null;
  status: SubmissionStatus;
  staffNote: string | null;
  totalCents: number;
  paymentId: string | null;
  submittedAt: Date | null;
}

/**
 * Recent submissions, newest first.
 *
 * Capped rather than paged, as on the web: the church's whole forms volume is a
 * few hundred a year, and a cap with a visible "showing the most recent N" is a
 * smaller and more honest thing than a pager nobody reaches page two of.
 *
 * The filtered query needs the composite index `formId` + `submittedAt desc`,
 * which is in the Website repo's firestore.indexes.json. Without it this fails
 * at runtime while the unfiltered one keeps working — a confusing pair of
 * symptoms, which is why the screen says so when it catches the error.
 */
export async function readSubmissions(formId: string | null, cap = 200): Promise<SubmissionRow[]> {
  const base = collection(getFirestore(), COLLECTIONS.formSubmissions);
  const rows = formId
    ? query(base, where('formId', '==', formId), orderBy('submittedAt', 'desc'), limit(cap))
    : query(base, orderBy('submittedAt', 'desc'), limit(cap));

  const snapshot = await getDocs(rows);
  return snapshot.docs.map((entry) => {
    const data = entry.data() as Record<string, unknown>;
    const at = data['submittedAt'] as { toDate?: () => Date } | undefined;

    return {
      id: entry.id,
      formId: String(data['formId'] ?? ''),
      formTitle: String(data['formTitle'] ?? 'Form'),
      answers: (data['answers'] ?? {}) as FormAnswers,
      submitterName: (data['submitterName'] as string | null) ?? null,
      submitterEmail: (data['submitterEmail'] as string | null) ?? null,
      submitterPhone: (data['submitterPhone'] as string | null) ?? null,
      status: (data['status'] as SubmissionStatus) ?? 'new',
      staffNote: (data['staffNote'] as string | null) ?? null,
      totalCents: typeof data['totalCents'] === 'number' ? data['totalCents'] : 0,
      paymentId: (data['paymentId'] as string | null) ?? null,
      submittedAt: typeof at?.toDate === 'function' ? at.toDate() : null,
    };
  });
}

export async function setSubmissionStatus(
  id: string,
  status: SubmissionStatus,
  staffNote?: string,
): Promise<void> {
  await updateDoc(doc(getFirestore(), COLLECTIONS.formSubmissions, id), {
    status,
    ...(staffNote === undefined ? {} : { staffNote }),
  });
}

export async function deleteSubmission(id: string): Promise<void> {
  await deleteDoc(doc(getFirestore(), COLLECTIONS.formSubmissions, id));
}
