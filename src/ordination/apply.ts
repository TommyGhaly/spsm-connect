/**
 * Sending a nomination to `ordinationApply`.
 *
 * The camp's `sendServantSignUp` with the ordination's body, and the same split
 * between "could not reach the server" and "the server said no". Nothing comes
 * back to read: applications are behind the `ordination` screen.
 */
import type { OrdinationApplicationDraft } from '@spsm/shared';

import { apiUrl, postHeaders } from '@/api/client';

export type ApplyResult = { ok: true } | { ok: false; errors: string[] };

export async function sendNomination(draft: OrdinationApplicationDraft): Promise<ApplyResult> {
  let response: Response;
  try {
    response = await fetch(apiUrl('/api/ordination/apply'), {
      method: 'POST',
      headers: await postHeaders(),
      body: JSON.stringify(draft),
    });
  } catch {
    return {
      ok: false,
      errors: ['Could not reach the church server. Check your connection and try again.'],
    };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    console.error(
      `[ordination] ${response.status} from /api/ordination/apply, and the body was not JSON — ` +
        'the Hosting rewrite for that path is probably missing.',
    );
    return { ok: false, errors: ['Could not send the nomination. Please try again shortly.'] };
  }

  const payload = (body ?? {}) as Record<string, unknown>;
  const errors = Array.isArray(payload['errors'])
    ? (payload['errors'] as unknown[]).map(String).filter(Boolean)
    : [];

  if (!response.ok || errors.length > 0) {
    return {
      ok: false,
      errors: errors.length > 0 ? errors : ['Could not send the nomination. Please try again.'],
    };
  }
  return { ok: true };
}
