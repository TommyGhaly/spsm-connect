/**
 * Who is signed in, and what they administer — read once, shared by everything.
 *
 * The website's equivalent is `useScreenGrants` in lib/screenGrants.ts, which
 * every admin hook calls for itself. That is fine in a browser where the hook
 * memoises across a render tree that lives for one page. Here it is not: a tab
 * navigator keeps five screens mounted at once, and five copies of that hook
 * would be five `members/{uid}` reads and — worse — five racing token
 * refreshes, because `readGrants` forces one when the claim mirror disagrees.
 *
 * So the read happens once, here, and `src/firebase/grants.ts` stays the only
 * module that knows how to do it. **No screen may re-derive a permission.**
 * Ask `useGrants()` and put the answer through the predicates that file
 * exports, which are the same ones `firestore.rules` mirrors.
 *
 * Remember what these are for: hiding UI. `firestore.rules` is the enforcement,
 * and a screen that renders because this said so is still refused by the
 * database if it was wrong. That is the correct order of trust.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { startAppCheck } from '@/firebase/appCheck';
import { onAuthChange, type User } from '@/firebase/auth';
import { noGrants, readGrants, type Grants } from '@/firebase/grants';

export interface Session {
  /** Null when signed out. An anonymous user is NOT null — see `isPerson`. */
  user: User | null;
  /**
   * Signed in as a real person from the parish tenant.
   *
   * The distinction matters more than it looks. Every uploader holds a token,
   * because an anonymous session is what attributes an upload for quota
   * purposes — so `user !== null` is true for a stranger who has only ever
   * sent a photograph. `storage.rules` draws exactly this line on the
   * `submissions/` prefix (`allow read: if isPerson()`), and so must the app:
   * an anonymous session may write into the quarantine and may not read it.
   */
  isPerson: boolean;
  grants: Grants;
  /** True until the first auth callback and its grants read have both settled. */
  loading: boolean;
  /** Re-read the member document. Call after signing in, not on every render. */
  refresh: () => Promise<void>;
}

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [grants, setGrants] = useState<Grants>(noGrants);
  const [loading, setLoading] = useState(true);

  /*
   * Guards a grants read against the user changing under it. Signing out while
   * a `members/{uid}` read is in flight would otherwise resolve and install the
   * grants of the person who just left.
   */
  const generation = useRef(0);

  const load = useCallback(async (): Promise<void> => {
    const mine = ++generation.current;
    try {
      const next = await readGrants();
      if (generation.current === mine) setGrants(next);
    } catch {
      /*
       * A failed read is "nothing", never "what we had last time". Offline with
       * a stale admin bar is a screen that offers controls the database will
       * refuse, which reads as a broken app rather than an offline one.
       */
      if (generation.current === mine) setGrants(noGrants());
    }
  }, []);

  useEffect(() => {
    // App Check first and unconditionally: the token takes a moment to mint on
    // a cold start, and the first thing anybody does here is send a photograph.
    startAppCheck();

    const unsubscribe = onAuthChange((next) => {
      setUser(next);
      void load().finally(() => setLoading(false));
    });

    return unsubscribe;
  }, [load]);

  const value = useMemo<Session>(
    () => ({
      user,
      isPerson: user !== null && !user.isAnonymous,
      grants,
      loading,
      refresh: load,
    }),
    [user, grants, loading, load],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession was called outside SessionProvider.');
  return session;
}

/** Shorthand for the common case. Same object, same rules about not re-deriving. */
export function useGrants(): Grants {
  return useSession().grants;
}
