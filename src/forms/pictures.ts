/**
 * The two form-picture jobs that go through the Firebase Storage SDK, and are
 * staff-only for that reason.
 *
 * Split out of `uploads.ts` rather than sitting beside the thing they resemble,
 * because that file is reachable from the App Clip — a parish form may have a
 * photograph field — and `@react-native-firebase/storage` is in the clip
 * target's `excludedPackages`, where an import is a crash rather than a missing
 * feature. Neither function below is reachable from a clip: one is the form
 * builder's picture picker, the other is the submissions panel, and both sit
 * behind the `forms` grant.
 *
 * Straight through the SDK rather than a signed URL, in both cases:
 * `storage.rules` guards these prefixes and grants them to the `forms` screen
 * in the token's mirror, which is the one thing that mirror exists for.
 */
import { getDownloadURL, getStorage, putFile, ref } from '@react-native-firebase/storage';
import { toFormSlug } from '@spsm/shared';

import { condense } from '@/upload/condense';

import type { PickedImage } from './uploads';

/**
 * A picture for a form's card, chosen by staff.
 *
 * Returns the download URL, because that is what `form.image` stores and what
 * an `<Image source>` needs — this folder is world-readable, so a URL is the
 * right currency. Contrast `uploadFormPhoto` above, which returns a path.
 *
 * Straight through the Storage SDK rather than a signed URL: `storage.rules`
 * still guards this prefix and grants it to the `forms` screen in the token's
 * mirror, which is the one thing the mirror exists for.
 */
export async function uploadFormPicture(
  formId: string,
  picked: PickedImage,
): Promise<{ ok: true; url: string } | { ok: false; reason: string }> {
  const path = `forms/${toFormSlug(formId) || 'form'}/${safeName(picked.fileName)}`;

  try {
    const condensed = await condense(picked.uri, contentTypeOf(picked));
    const target = ref(getStorage(), path);
    await putFile(target, condensed.uri, { contentType: condensed.contentType });
    return { ok: true, url: await getDownloadURL(target) };
  } catch (error) {
    console.error('[forms] picture upload failed', error);
    return { ok: false, reason: messageOf(error, 'That picture could not be uploaded.') };
  }
}

/**
 * A staff-readable URL for a quarantined photograph.
 *
 * Only ever called from the submissions screen, which is behind the `forms`
 * grant. For anybody else the rules refuse the read and this answers null —
 * which is the intended behaviour, not a bug to work around.
 */
export async function readFormPhotoUrl(path: string): Promise<string | null> {
  try {
    return await getDownloadURL(ref(getStorage(), path));
  } catch {
    return null;
  }
}

/**
 * A content type for an asset the picker may not have typed.
 *
 * Specific rather than `image/*`, for the reason `src/upload/pick.ts` gives:
 * the signed URL's content type must match the header the PUT sends, and a
 * wildcard matches nothing.
 */
function contentTypeOf(picked: PickedImage): string {
  return picked.mimeType ?? 'image/jpeg';
}

/** A filename fit to sit in a bucket. The rules sanitise again; this is the
    half that keeps a staff folder readable. */
function safeName(original: string | null | undefined): string {
  const cleaned = (original ?? 'photo.jpg')
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(-40);
  return cleaned || 'photo.jpg';
}

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
