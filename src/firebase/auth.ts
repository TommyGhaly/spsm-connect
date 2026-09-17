/**
 * Sign-in, in the two flavours this church has.
 *
 * MICROSOFT is the only real provider. The Firebase project has exactly one
 * `defaultSupportedIdpConfig` and it is `microsoft.com` — no Google, no Apple,
 * no email link, no password. The app registration is **single-tenant, and that
 * is the security control**: `servantEvents` is readable on `signedIn()` alone,
 * so being able to sign in at all is what grants the servants' rota. If that
 * registration is ever switched to multi-tenant, every Microsoft account on
 * earth can read it.
 *
 * ANONYMOUS is not authentication. It exists so an upload can be attributed to
 * *something* for quota purposes — a browser, or here a phone. The website says
 * it plainly in lib/uploadSession.ts, and `galleryUploadUrl` agrees: it writes
 * `updatedBy: null` for an anonymous uploader because "an anonymous session is
 * a browser, not a person".
 *
 * The web signs in with a popup (Safari third-party cookies ruled out redirect).
 * A phone has no popup; RNFB's `signInWithPopup` delegates to the native
 * `signInWithProvider` flow on both platforms, which is the right thing here.
 */
import {
  getAuth,
  getIdToken,
  getIdTokenResult,
  onAuthStateChanged,
  signInAnonymously,
  signInWithPopup,
  signOut as fbSignOut,
  OAuthProvider,
  type AuthProvider,
  type User as FirebaseUser,
} from '@react-native-firebase/auth';
import { DEFAULT_CLAIMS, parseClaims, type SpsmClaims } from '@spsm/shared';

export type User = FirebaseUser;

/** Sign in with the church's Microsoft tenant. */
export async function signInWithMicrosoft(): Promise<User> {
  const tenant = process.env.EXPO_PUBLIC_AZURE_TENANT_ID;
  if (!tenant) throw new Error('The Microsoft tenant id is missing from the environment.');

  const provider = new OAuthProvider('microsoft.com');
  /*
   * Pinning the tenant here is belt to the braces of the single-tenant app
   * registration. Without it the flow offers a personal-account sign-in that
   * `enforceTenantOnCreate` would reject a moment later — a worse experience
   * for the same outcome.
   */
  provider.setCustomParameters({ tenant });

  /*
   * The cast is a typing defect in @react-native-firebase/auth, not a shortcut:
   * OAuthProvider declares `providerId` private, which makes it structurally
   * incompatible with the AuthProvider interface it is documented to satisfy.
   * The value is correct; only the declaration disagrees.
   */
  const credential = await signInWithPopup(getAuth(), provider as unknown as AuthProvider);
  return credential.user;
}

export function signOut(): Promise<void> {
  return fbSignOut(getAuth());
}

export function currentUser(): User | null {
  return getAuth().currentUser;
}

export function onAuthChange(next: (user: User | null) => void): () => void {
  return onAuthStateChanged(getAuth(), next);
}

/**
 * The signed-in user's claims.
 *
 * Only `superadmin` and the `screens` mirror live in the token. Everything else
 * — which programs someone administers, which admin screens they hold — is on
 * their `members/{uid}` document, deliberately, because claims lag up to an
 * hour behind a grant. See grants.ts.
 */
export async function claimsOf(user: User, forceRefresh = false): Promise<SpsmClaims> {
  if (user.isAnonymous) return DEFAULT_CLAIMS;
  const result = await getIdTokenResult(user, forceRefresh);
  return parseClaims(result.claims);
}

/**
 * An ID token for a Cloud Function call, signing in anonymously if nobody is
 * signed in.
 *
 * This is the mobile port of lib/uploadSession.ts. The re-sign-in on a failed
 * refresh is not defensive padding: the project has automatic cleanup of
 * anonymous users switched on (~30 days), so a phone that sat in a drawer comes
 * back holding a token for an account that no longer exists. Without this the
 * first upload after that returns 401 and the person is told to reload a page
 * that does not exist here.
 */
export async function uploadIdToken(): Promise<string> {
  const auth = getAuth();

  const existing = auth.currentUser;
  if (existing) {
    try {
      return await getIdToken(existing, /* forceRefresh */ true);
    } catch {
      // The account was swept out from under us. Fall through and make a new one.
    }
  }

  const credential = await signInAnonymously(auth);
  return getIdToken(credential.user);
}
