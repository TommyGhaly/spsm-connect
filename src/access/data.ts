/**
 * Reading and writing the church's allocations, from a phone.
 *
 * A port of `apps/website/src/features/access/data.ts`, function for function,
 * onto `@react-native-firebase/firestore`. Everything the original says about
 * what this deliberately cannot do holds here unchanged and is worth repeating,
 * because it is the shape the whole permission model rests on:
 *
 * **It cannot make anybody a superadmin.** Not an oversight and not a to-do.
 * `superadmin` lives in a Firebase Auth custom claim, claims are settable only
 * by the Admin SDK, and `scripts/grant-admin.mjs` in the Website repo is the
 * one path. This module writes three maps on the member document —
 * `screenAdmin`, `financeScopes` and `programAdmin` — and those are enough to
 * say who administers what precisely *because* they are not claims: they take
 * effect on the grantee's next read rather than on their next token refresh,
 * which is up to an hour away.
 *
 * So this screen hands out areas and never promotes. The one privilege that
 * bypasses every flag on it is the one privilege it cannot grant, and it is set
 * from a terminal by somebody who meant to.
 *
 * **The writes are field-scoped.** `updateDoc` with three keys, never
 * `setDoc`. A member document holds a displayName, an email, a photo,
 * notification tokens and the claim mirrors, and this screen has read none of
 * them — a whole-document write from here would blank whatever it had not
 * bothered to load.
 *
 * **It is not the security boundary.** `firestore.rules` is: `/members/{uid}`
 * is `allow read: if isSelf(uid) || isSuper()` and `allow update: if
 * isSuper()`. Somebody who patched the guard out of their own build gets a
 * directory read that comes back empty and a save that is refused.
 */
import { getAuth } from '@react-native-firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  orderBy,
  query,
  updateDoc,
} from '@react-native-firebase/firestore';
import {
  COLLECTIONS,
  CONFIG_DOC_CAMP,
  allFinanceScopes,
  defaultCampConfig,
  defaultProgramAdmin,
  defaultScreenAdmin,
  parseCampConfig,
  parseFinanceScopes,
  parseProgramAdmin,
  parseScreenAdmin,
  type AdminScreen,
  type FinanceScopes,
  type FinanceSource,
  type ProgramAdmin,
  type ScreenAdmin,
} from '@spsm/shared';

/** One person, as this screen needs them. */
export interface AllocatableMember {
  uid: string;
  displayName: string;
  email: string;
  /**
   * The claim *mirror*, not the claim.
   *
   * Shown so an administrator can see that ticking boxes for a superadmin
   * changes nothing they can observe — a superadmin already passes every check
   * before a flag is consulted. It is a display value and is labelled as one on
   * screen; `firestore.rules` reads the token and never this field, and claims
   * are not readable across accounts from a client at all, which is why a
   * mirror has to exist for this one question.
   *
   * Written `false` at sign-in by `enforceTenantOnCreate` and set by
   * `grant-admin.mjs` when it promotes somebody. If the two disagree the claim
   * wins and this screen is wrong, which is cosmetic by construction.
   */
  superadmin: boolean;
  screenAdmin: ScreenAdmin;
  /**
   * Which parts of the money the `finance` flag reaches for this person.
   *
   * A complete map always, even for the many documents that carry no
   * `financeScopes` field — `parseFinanceScopes` reads an absent one as all
   * three, because that is what `finance` meant before it could be narrowed and
   * reading it as nothing would revoke every treasurer in the church. Saving
   * always writes all three keys, which is what makes "unticked everything"
   * distinguishable from "never narrowed".
   */
  financeScopes: FinanceScopes;
  programAdmin: ProgramAdmin;
}

/** One ministry, for the per-program ticklist. */
export interface AllocatableProgram {
  id: string;
  name: string;
}

/** The three ministries, the camp's id, and everybody — one load. */
export interface Directory {
  members: AllocatableMember[];
  programs: AllocatableProgram[];
  campProgramId: string;
}

/**
 * Everybody with a member document.
 *
 * No pagination and no search-as-you-type against Firestore. The church's
 * directory is the people with a church Microsoft account — clergy, staff and
 * servants, a few dozen — so the whole collection is one read and filtering
 * happens in memory, where it is instant and costs nothing. If that ever stops
 * being true the fix is a `limit` and a cursor, not an index.
 *
 * Ordered by `displayName` in the query rather than in JS so the list is stable
 * across reloads. Note what that costs, because the website's copy of this
 * function words it more forgivingly than Firestore behaves: an `orderBy`
 * **excludes** documents that lack the field, so a member record with no
 * `displayName` is not in this list at all. That is nobody in practice —
 * `enforceTenantOnCreate` writes the name from the Microsoft account at
 * sign-in, and Entra supplies one for every account in the church's tenant. If
 * a nameless document ever does turn up, the fix is to sort in memory here, not
 * to drop the ordering: an unordered directory is a list that reshuffles
 * between reads.
 */
export async function listMembers(): Promise<AllocatableMember[]> {
  const snapshot = await getDocs(
    query(collection(getFirestore(), COLLECTIONS.members), orderBy('displayName')),
  );

  return snapshot.docs.map((row) => member(row.id, row.data()));
}

/**
 * One person, read fresh.
 *
 * The person's screen is a pushed route and reads its own subject rather than
 * being handed one off the list, for the reason the app's other admin screens
 * refresh on focus: two people can be allocating at once, and a panel drawn
 * from a directory read five minutes old would save a map built on top of
 * somebody else's change. One document read is the cheapest possible way to not
 * do that.
 */
export async function readMember(uid: string): Promise<AllocatableMember | null> {
  const snapshot = await getDoc(doc(getFirestore(), COLLECTIONS.members, uid));
  if (!snapshot.exists()) return null;
  return member(uid, snapshot.data());
}

/**
 * The church's ministries, for the per-program ticklist.
 *
 * Unpublished programs are included on purpose. A ministry is set up before it
 * is announced, and the servant who will run it needs the grant during exactly
 * that window — a list that showed only published programs would hide the one
 * the administrator came here to delegate.
 */
export async function listPrograms(): Promise<AllocatableProgram[]> {
  const snapshot = await getDocs(
    query(collection(getFirestore(), COLLECTIONS.programs), orderBy('name')),
  );
  return snapshot.docs.map((row) => ({
    id: row.id,
    name: str(row.data()?.['name']) || row.id,
  }));
}

/**
 * Which program id is the camp's, according to the camp itself.
 *
 * Read rather than hardcoded because the camp's own screens check their grant
 * against this same document, and a second copy of the id in this file is how
 * an allocation screen comes to grant `summercamp` while the camp is looking
 * for `summer-camp-2027`. Falls back to the committed default, which is what
 * `parseCampConfig` would have produced anyway.
 */
export async function readCampProgramId(): Promise<string> {
  try {
    const snapshot = await getDoc(doc(getFirestore(), COLLECTIONS.config, CONFIG_DOC_CAMP));
    if (!snapshot.exists()) return defaultCampConfig().programId;
    return parseCampConfig(snapshot.data()).programId;
  } catch (error) {
    console.warn('[access] could not read the camp settings; using the default program id', error);
    return defaultCampConfig().programId;
  }
}

/** The ministries and the camp's id, for a person's screen. */
export async function readPrograms(): Promise<{
  programs: AllocatableProgram[];
  campProgramId: string;
}> {
  const [programs, campProgramId] = await Promise.all([listPrograms(), readCampProgramId()]);
  return { programs, campProgramId };
}

/** Everything the directory screen draws. */
export async function readDirectory(): Promise<Directory> {
  const [members, programs, campProgramId] = await Promise.all([
    listMembers(),
    listPrograms(),
    readCampProgramId(),
  ]);
  return { members, programs, campProgramId };
}

/** The three maps this screen edits, and the only thing it writes. */
export interface Allocation {
  screenAdmin: ScreenAdmin;
  financeScopes: FinanceScopes;
  programAdmin: ProgramAdmin;
}

/**
 * Write one person's allocation.
 *
 * All three maps go in one `updateDoc` rather than three, so a save is one
 * write and cannot half-apply — an administrator who grants the bookstore and a
 * ministry in the same sitting should not be able to end up with one of them.
 *
 * Nothing here drops a cached copy of the grantee's grants, because there is no
 * cache to drop: the app reads them once per launch in `SessionProvider`. What
 * that means for the one case it matters — a superadmin editing *their own*
 * allocation — is handled on the screen, which calls `refresh()` on the
 * session. Without it they would see the stale answer until the next cold
 * start, which is indistinguishable from the write having failed.
 */
export async function saveAllocation(uid: string, next: Allocation): Promise<void> {
  await updateDoc(doc(getFirestore(), COLLECTIONS.members, uid), {
    // Rebuilt through the parsers on the way out as well as on the way in. The
    // editor holds a complete map and should never produce anything else, but
    // this is the last point before a permission reaches Firestore, and a stray
    // key written here is a key `firestore.rules` would then read.
    screenAdmin: parseScreenAdmin(next.screenAdmin),
    /*
     * All three keys, every time, and that is load-bearing rather than tidy.
     *
     * An absent `financeScopes` means "all three" — see `FINANCE_SOURCES` in
     * packages/shared/src/screens.ts — so an administrator who unticks every
     * source has to leave behind a map that *names* them, or the next read
     * would treat their choice as no choice and hand back everything.
     * `parseFinanceScopes` of a complete map is that map, so this is the
     * guarantee rather than a re-parse for its own sake.
     */
    financeScopes: parseFinanceScopes(next.financeScopes),
    programAdmin: parseProgramAdmin(next.programAdmin),
  });
}

/** Who is signed in, so the screen knows when somebody is editing themselves. */
export function currentUid(): string | null {
  return getAuth().currentUser?.uid ?? null;
}

/* ---- small helpers ------------------------------------------------------ */

/** A member document with no allocation yet reads as one with nothing granted. */
export function emptyAllocation(): Allocation {
  // All three sources, which is not a grant: `finance` is false beside it, and
  // the sources narrow that flag rather than standing in for it.
  return {
    screenAdmin: defaultScreenAdmin(),
    financeScopes: allFinanceScopes(),
    programAdmin: defaultProgramAdmin(),
  };
}

/** The allocation a person currently holds, as a draft to edit. */
export function allocationOf(person: AllocatableMember): Allocation {
  return {
    screenAdmin: { ...person.screenAdmin },
    financeScopes: { ...person.financeScopes },
    programAdmin: {
      ...person.programAdmin,
      programs: [...person.programAdmin.programs],
      events: [...person.programAdmin.events],
    },
  };
}

/** Flip one finance source, returning a new map rather than mutating the old. */
export function withFinanceSource(
  scopes: FinanceScopes,
  source: FinanceSource,
  granted: boolean,
): FinanceScopes {
  return { ...scopes, [source]: granted };
}

/** Flip one screen flag, returning a new map rather than mutating the old. */
export function withScreen(
  screens: ScreenAdmin,
  screen: AdminScreen,
  granted: boolean,
): ScreenAdmin {
  return { ...screens, [screen]: granted };
}

/**
 * Add or remove one program id, returning a new grant rather than mutating.
 *
 * Deduplicated on the way in, because the camp is one of the programs and a
 * list holding an id twice would show the tick as on, take two presses to turn
 * off, and look like a bug in the checkbox.
 */
export function withProgram(
  grants: ProgramAdmin,
  programId: string,
  granted: boolean,
): ProgramAdmin {
  const without = grants.programs.filter((id) => id !== programId);
  return {
    ...grants,
    programs: granted ? [...without, programId] : without,
  };
}

/** Whether a draft differs from what is saved, field by field. */
export function isDirty(saved: Allocation, draft: Allocation): boolean {
  return (
    JSON.stringify(draft.screenAdmin) !== JSON.stringify(saved.screenAdmin) ||
    JSON.stringify(draft.financeScopes) !== JSON.stringify(saved.financeScopes) ||
    JSON.stringify([...draft.programAdmin.programs].sort()) !==
      JSON.stringify([...saved.programAdmin.programs].sort()) ||
    JSON.stringify([...draft.programAdmin.events].sort()) !==
      JSON.stringify([...saved.programAdmin.events].sort())
  );
}

function member(uid: string, data: Record<string, unknown> | undefined): AllocatableMember {
  const raw = data ?? {};
  return {
    uid,
    displayName: str(raw['displayName']) || str(raw['email']) || 'Unnamed',
    email: str(raw['email']),
    superadmin: raw['superadminMirror'] === true,
    // Every parser drops unknown keys and defaults absent ones to closed, so a
    // document written before a screen existed reads as "not granted" rather
    // than as a hole the UI has to special-case. `financeScopes` is the one
    // exception and is deliberate — see `AllocatableMember.financeScopes`.
    screenAdmin: parseScreenAdmin(raw['screenAdmin']),
    financeScopes: parseFinanceScopes(raw['financeScopes']),
    programAdmin: parseProgramAdmin(raw['programAdmin']),
  };
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
