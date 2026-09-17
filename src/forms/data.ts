/**
 * Reading form definitions, and sending one back.
 *
 * A port of the website's `features/forms/data.ts`, and the division of labour
 * is identical because it is not a choice either surface gets to make:
 *
 *   - **Definitions are read straight from Firestore.** A published form is
 *     public and `firestore.rules` says so (`allow read: if
 *     isPublished(resource.data)`).
 *   - **Submissions are never written from a client.** `formSubmissions` is
 *     `allow create: if false`, and every submission goes to the `formSubmit`
 *     Cloud Function instead. Three things it does cannot be done from here:
 *     price the answers from the stored definition, hold the Square token, and
 *     reach the Taksis project. See functions/src/forms/submit.ts.
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  query,
  where,
} from '@react-native-firebase/firestore';
import {
  COLLECTIONS,
  CONFIG_DOC_FORMS,
  DEFAULT_FORMS_PAGE_CONFIG,
  parseFormDefinition,
  parseFormsPageConfig,
  type FormAnswers,
  type FormDefinition,
  type FormsPageConfig,
} from '@spsm/shared';

import { apiUrl, postHeaders } from '@/api/client';
import { siteUrl } from '@/about/media';

export type WithId<T> = T & { id: string };

function withId(id: string, raw: unknown): WithId<FormDefinition> {
  return { id, ...parseFormDefinition(id, raw) };
}

/** Lower `order` first, then alphabetical, exactly as the hub on the web sorts. */
function sortForms<T extends FormDefinition>(forms: T[]): T[] {
  return [...forms].sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}

/**
 * A form's picture, as something `expo-image` can fetch.
 *
 * `form.image` is whatever the builder stored, and there are two shapes of it:
 * a path under the website's `public/` (`/img/stock-camp-1000.webp`) for one of
 * the stock choices, and an absolute Storage download URL for a photograph
 * staff uploaded. The first is meaningless to a phone until it is given a host,
 * and the host is the one this app already fetches the About pages' plates
 * from — `siteUrl` is that function, and it leaves an absolute URL alone.
 */
export function formImageUrl(image: string | null): string | null {
  if (!image) return null;
  return image.startsWith('http') ? image : siteUrl(image);
}

/**
 * Every form the public may see, live.
 *
 * A subscription rather than a read, for the same reason the website uses one:
 * staff publish a form from the admin screens in this same app, and the card
 * should appear behind them rather than on the next launch.
 *
 * The caller keeps whatever it last rendered when `onError` fires. An empty hub
 * is the failure this guards against — see `FormsHub`.
 */
export function watchPublishedForms(
  onForms: (forms: WithId<FormDefinition>[]) => void,
  onError: (error: Error) => void,
): () => void {
  const forms = query(collection(getFirestore(), COLLECTIONS.forms), where('published', '==', true));

  return onSnapshot(
    forms,
    (snapshot) => {
      onForms(sortForms(snapshot.docs.map((entry) => withId(entry.id, entry.data()))));
    },
    (error) => onError(error as Error),
  );
}

/**
 * Every form including drafts. Refused by the rules without the `forms` grant,
 * so it is only ever called from behind `mayAdminScreen(grants, 'forms')`.
 */
export async function readAllForms(): Promise<WithId<FormDefinition>[]> {
  const snapshot = await getDocs(collection(getFirestore(), COLLECTIONS.forms));
  return sortForms(snapshot.docs.map((entry) => withId(entry.id, entry.data())));
}

/**
 * One form by its slug.
 *
 * Two reads, and the `catch` around the first is not tidying — it is the fix
 * the website's copy of this function records at length. The public read rule
 * dereferences `resource.data`, which on a document that does not exist is an
 * evaluation error, and an error *denies*. So a missing id does not come back
 * empty for a visitor, it throws `permission-denied` and would take the query
 * below with it — on a form that is published and perfectly readable.
 */
export async function readFormBySlug(slug: string): Promise<WithId<FormDefinition> | null> {
  try {
    const direct = await getDoc(doc(getFirestore(), COLLECTIONS.forms, slug));
    if (direct.exists()) {
      const form = withId(direct.id, direct.data());
      if (form.slug === slug) return form;
    }
  } catch {
    // Almost always "there is no document with that id", arriving as a denial.
  }

  /*
   * `published` is in the query and is not a convenience filter: Firestore
   * judges a list by what it *could* return, so a query on `slug` alone could
   * yield a draft and is refused outright for anybody without the grant.
   */
  const matches = await getDocs(
    query(
      collection(getFirestore(), COLLECTIONS.forms),
      where('slug', '==', slug),
      where('published', '==', true),
    ),
  );
  const first = matches.docs[0];
  return first ? withId(first.id, first.data()) : null;
}

/* -------------------------------------------------------------------------- */
/* The office's two settings                                                   */
/* -------------------------------------------------------------------------- */

/**
 * `config/forms` — which form a tap should land on, and where the camp sits.
 *
 * The app's copy of the website's `readFormsPageConfig`, reading the same
 * world-readable document. `nfcFormSlug` is what the App Clip's `/c/photos`
 * counterpart is for forms: a tag by a door cannot be reprogrammed every time
 * the parish is collecting something different, so it points at one URL and the
 * office changes the answer in one field. `/c/forms` opens on whatever it says.
 *
 * **A failed read is not an error.** `parseFormsPageConfig` resolves an absent,
 * blank or unresolvable setting to the vehicle registration — what the tag in
 * the car park has always done — and so does the catch below. Nothing that
 * reads this should ever show somebody a fault about a settings document.
 */
export async function readFormsPageConfig(): Promise<FormsPageConfig> {
  try {
    const snapshot = await getDoc(doc(getFirestore(), COLLECTIONS.config, CONFIG_DOC_FORMS));
    return snapshot.exists()
      ? parseFormsPageConfig(snapshot.data())
      : { ...DEFAULT_FORMS_PAGE_CONFIG };
  } catch (error) {
    console.warn('[forms] could not read the forms settings; using the built-in defaults', error);
    return { ...DEFAULT_FORMS_PAGE_CONFIG };
  }
}

/* -------------------------------------------------------------------------- */
/* Submitting                                                                  */
/* -------------------------------------------------------------------------- */

export type SubmitResult =
  | { ok: true; submissionId: string; totalCents: number; paymentId: string | null }
  | { ok: false; errors: string[] };

/**
 * Send a completed form to the Function.
 *
 * **There is no amount in this request.** The body carries the slug, the
 * answers, and — when the form charges — a single-use Square nonce. The
 * Function loads the definition from Firestore and prices it with the same
 * `computeTotalCents` this app used to draw the running total, so the figure on
 * screen is a preview and the server's answer is the one charged.
 *
 * Its own request rather than `apiPost`, for one reason: this endpoint answers
 * `{ errors: [...] }` and the client's helper reads the singular `{ error }`
 * every other Function sends. A form's objections are a list — "Your name is
 * required", "That is not an email address" — and all of them have to reach the
 * person filling it in. The headers are shared; the refusal is not.
 */
export async function submitForm(input: {
  slug: string;
  answers: FormAnswers;
  /** Square's single-use token. Null on a free form. */
  cardToken: string | null;
  /** Square requires this for 3-D Secure. Null when not challenged. */
  verificationToken: string | null;
}): Promise<SubmitResult> {
  let response: Response;
  try {
    response = await fetch(apiUrl('/api/forms/submit'), {
      method: 'POST',
      headers: await postHeaders(),
      body: JSON.stringify(input),
    });
  } catch {
    // A network failure, not a rejection — worth saying differently, because
    // "check your connection" is actionable and "submission failed" is not.
    return {
      ok: false,
      errors: ['Could not reach the church server. Check your connection and try again.'],
    };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    /*
     * Not JSON: in production that is Hosting serving its 404 page because the
     * rewrite for this path is missing. Configuration, not something the person
     * filling in the form can fix, so the console gets the detail.
     */
    console.error(
      `[forms] ${response.status} from /api/forms/submit, and the body was not JSON — ` +
        'the Hosting rewrite for that path is probably missing.',
    );
    return { ok: false, errors: ['Could not submit the form. Please try again shortly.'] };
  }

  const payload = (body ?? {}) as Record<string, unknown>;

  if (!response.ok) {
    const errors = Array.isArray(payload['errors'])
      ? (payload['errors'] as unknown[]).map(String).filter(Boolean)
      : [];
    return {
      ok: false,
      errors: errors.length > 0 ? errors : ['Could not submit the form. Please try again.'],
    };
  }

  return {
    ok: true,
    submissionId: String(payload['submissionId'] ?? ''),
    totalCents: typeof payload['totalCents'] === 'number' ? payload['totalCents'] : 0,
    paymentId: typeof payload['paymentId'] === 'string' ? payload['paymentId'] : null,
  };
}
