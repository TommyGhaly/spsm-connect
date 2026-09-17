/**
 * Calling the church's Cloud Functions.
 *
 * Every endpoint goes through the Firebase Hosting origin rather than a raw
 * cloudfunctions.net URL, so `firebase.json`'s rewrite table stays the one
 * place that maps a path to a Function. There are 22 of those rewrites and the
 * website reaches all of them this way; an app that hardcoded function URLs
 * would silently stop matching the day one moved region.
 *
 * Every Function in that repo is `onRequest` with `cors: false`. That is not a
 * problem here — a native fetch is not CORS-bound and sends no preflight — but
 * it does mean these endpoints are deliberately unreachable from a web origin,
 * so do not expect to debug them from a browser.
 */
import { appCheckToken } from '@/firebase/appCheck';
import { uploadIdToken } from '@/firebase/auth';

const ORIGIN = process.env.EXPO_PUBLIC_API_ORIGIN ?? 'https://spsm-database.web.app';

/** Thrown for a non-2xx, carrying the Function's own words where it gave them. */
export class ApiError extends Error {
  readonly status: number;
  /** The machine-readable code, when the Function sent one (e.g. `unattested`). */
  readonly code: string | null;

  constructor(status: number, message: string, code: string | null = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export function apiUrl(path: string): string {
  return `${ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * A GET returning JSON, unauthenticated.
 *
 * For the three things static HTML could not answer and a phone cannot either:
 * /api/bulletin (it lives in another Firebase project), /api/live (YouTube
 * sends no CORS header and the key is server-side), /api/calendar (the Breeze
 * embed URL is itself a bearer credential).
 */
export async function apiGet<T>(path: string): Promise<T> {
  return getJson<T>(path, null);
}

/**
 * The same GET, carrying an ID token.
 *
 * One endpoint needs this: `/api/calendar?scope=servants`, which answers the
 * servants' rota and refuses without a session. Kept separate from `apiGet`
 * rather than made an option on it, because the distinction is the point — 
 * somebody's calendar must never quietly become an authenticated request
 * that fails when the token expires.
 *
 * No App Check header. `apiPost` sends one everywhere so that enforcement can
 * be switched on later without a change here, but these are reads the website
 * makes anonymously from a browser, and attaching an attestation to them would
 * claim a guarantee the endpoint does not ask for.
 *
 * A missing token is not an error here. The caller asked for a scope it may not
 * hold, the Function answers 401 or 403, and `denied` is an ordinary outcome
 * with its own sentence — see ScheduleResult in the website's calendar reader.
 */
export async function apiGetAuthed<T>(path: string): Promise<T> {
  const idToken = await uploadIdToken();
  return getJson<T>(path, idToken);
}

async function getJson<T>(path: string, idToken: string | null): Promise<T> {
  const headers: Record<string, string> = {};
  if (idToken) headers.Authorization = `Bearer ${idToken}`;

  const response = await fetch(apiUrl(path), { headers });

  if (!response.ok) {
    /*
     * The Function's own words, for the same reason apiPost prefers them: these
     * endpoints answer `{ error: "..." }` with copy written to be read. A
     * calendar that says "you are not a servant" is more use than one that says
     * 403.
     */
    let message = `${path} failed: ${response.status}`;
    let code: string | null = null;
    try {
      const problem = (await response.json()) as { error?: unknown };
      if (typeof problem.error === 'string' && problem.error !== '') {
        message = problem.error;
        code = problem.error;
      }
    } catch {
      // Not JSON. A proxy's own 502 page is an ordinary shape for a failure.
    }
    throw new ApiError(response.status, message, code);
  }

  return (await response.json()) as T;
}

/**
 * The headers every POST to a church Function carries.
 *
 * Exported because one caller cannot use `apiPost`: `formSubmit` answers
 * `{ errors: [...] }` — plural, a form has a list of objections rather than one
 * sentence — and the whole list has to survive the trip to the person filling
 * the form in. That endpoint builds its own request and reads its own refusal,
 * and this is the part it must not reinvent.
 *
 * The App Check token is fetched even for endpoints that do not check it, so
 * that adding enforcement to one later needs no change at the call site. When
 * attestation fails the header is simply absent.
 */
export async function postHeaders(): Promise<Record<string, string>> {
  const [idToken, attestation] = await Promise.all([uploadIdToken(), appCheckToken()]);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${idToken}`,
  };
  if (attestation) headers['X-Firebase-AppCheck'] = attestation;
  return headers;
}

/**
 * A POST returning JSON, carrying an ID token and an App Check token.
 *
 * The App Check token is fetched even for endpoints that do not check it, so
 * that adding enforcement to one later needs no change here. When attestation
 * fails the header is simply absent, and the endpoints that care answer 401
 * `unattested` — which is the honest outcome, and one the UI has words for.
 */
export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(apiUrl(path), {
    method: 'POST',
    headers: await postHeaders(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    // Every refusal in this codebase answers `{ error: "..." }` with copy
    // written to be shown verbatim. Prefer it over anything invented here.
    let message = `${path} failed: ${response.status}`;
    let code: string | null = null;
    try {
      const problem = (await response.json()) as { error?: unknown };
      if (typeof problem.error === 'string') {
        message = problem.error;
        code = problem.error;
      }
    } catch {
      // Not JSON. Keep the status-based message.
    }
    throw new ApiError(response.status, message, code);
  }

  return (await response.json()) as T;
}
