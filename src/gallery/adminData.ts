/**
 * Administering the ministries themselves — the writes behind `/events`.
 *
 * Named as every other writing half in this app is — `calendar/adminData.ts`,
 * `events/adminData.ts`, `bookstore/admin/adminData.ts` — and it has to be
 * something other than `ProgramAdmin`, which is the screen beside it: a
 * case-insensitive filesystem cannot hold both.
 *
 * The app's half of the program section of the website's
 * `features/programs/adminData.ts`, and a deliberate mirror of it: the same five
 * operations, the same guards, the same refusals in the same words. The app
 * already had the *pictures* half of that file's job spread across
 * `AddPictures`, `PictureTools` and `ReviewQueue`; what it had none of was the
 * ministry itself. A ministry could be photographed from a phone and not named,
 * described, published or removed from one.
 *
 * ## Two different permissions, and drawing them apart is the point
 *
 * `firestore.rules` on `/programs` is two lines, not one:
 *
 *     allow create, delete: if isSuper();
 *     allow update:         if adminsProgram(programId);
 *
 * So **making and retiring a ministry is the superadmin's alone** — a program
 * lead runs what they were given, they do not mint new ones — while editing the
 * one they were given is theirs. The website draws that distinction with
 * `canManagePrograms` (superadmin) for the rail's own controls and
 * `canEditProgram(id)` for a tile's, and this file is written so the screen can
 * do the same. Drawing a control the rules will refuse is worse than not
 * drawing it: the button works, the save fails, and nothing on screen says why.
 *
 * ## Nothing here swallows its errors
 *
 * The opposite of `gallery/data.ts`, and for the opposite reason. A read that
 * fails should leave the reader with a gallery and a quiet console; a *write*
 * that fails and says nothing is an administrator who believes the parish's page
 * now says something it does not. Every function below throws, and the sheet
 * that calls it puts the sentence on screen.
 */
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
} from '@react-native-firebase/firestore';
import { getAuth } from '@react-native-firebase/auth';
import {
  COLLECTIONS,
  PARISH_TIME_ZONE,
  UNFILED_PROGRAM_ID,
  buildGalleryTree,
  descendantsOf,
  toDate,
} from '@spsm/shared';

import type { NodeRow, ProgramRow } from './data';

/**
 * A ministry as an administrator needs it: everything the directory draws, plus
 * the two fields only somebody editing cares about.
 *
 * An extension rather than a change to `ProgramRow`, because the public reader
 * has no business carrying either. Nothing a visitor sees depends on `order` —
 * the query is already sorted by it — and `published` is not a fact about a
 * ministry a visitor can reach at all, since the rules would not have returned
 * an unpublished one.
 */
export interface AdminProgramRow extends ProgramRow {
  published: boolean;
  order: number;
  /**
   * Where a photograph lands when the sender does not choose — a level's id,
   * or null for "wherever it was sent from".
   *
   * Read by `send/destination.ts` and `mainSection.ts` off the raw document,
   * which is why `ProgramRow` has never carried it: a reader only needs the
   * answer, not the setting. The sheet that *sets* it needs to show what it
   * currently is, and a picker that could not read its own value would come
   * up blank over a ministry that has a perfectly good answer stored.
   */
  prioritySubmissionNodeId: string | null;
}

/** Firestore's ceiling on the writes in one batch. */
const BATCH_MAX = 500;

/** Who is writing, for the audit fields. Null for a session without one. */
function uid(): string | null {
  return getAuth().currentUser?.uid ?? null;
}

/**
 * A ministry's name into its address.
 *
 * `NFKD` and not `NFD`, matching the website's `slugifyName` exactly rather than
 * the `slugify` used for events — the two normalise differently on compatibility
 * characters, and a ministry created on a phone must land on the same id the
 * website would have given it or the two surfaces disagree about where it lives.
 */
export function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * Every ministry, drafts included, in the order the church set.
 *
 * The fallback is the website's and it is not belt-and-braces. The unfiltered
 * query is only allowed for somebody the rules will let read a draft; for
 * anybody else Firestore refuses the whole list rather than trimming it, so the
 * `catch` re-asks the public question. That means this one function serves the
 * superadmin, a program lead and — should the screen ever call it for one — a
 * visitor, each getting the most they are allowed.
 */
export async function listProgramsForAdmin(): Promise<AdminProgramRow[]> {
  const programs = collection(getFirestore(), COLLECTIONS.programs);

  const snapshot = await getDocs(query(programs, orderBy('order', 'asc'))).catch(() =>
    getDocs(query(programs, where('published', '==', true), orderBy('order', 'asc'))),
  );

  return snapshot.docs.map(toAdminProgram);
}

/**
 * One ministry, with the two fields only somebody editing it needs.
 *
 * `getProgram` in ./data.ts answers the same question for a reader and drops
 * `published` and `order` on the way out, which is right for it and useless
 * here: the sheet on a ministry's own page draws a "Visible to everyone"
 * switch, and a switch that cannot read its own state would come up off for a
 * published ministry and publish nothing when pressed.
 *
 * A `getDoc` and not a query, for `getProgram`'s reason: **the slug is the
 * document id**. Null covers both "no such ministry" and "not allowed to read
 * this one" — an unpublished ministry is invisible to anybody without a grant
 * on it, and the caller has nothing different to do about either.
 *
 * Unlike the rest of this file it does not throw. It is a read on a page that
 * is already rendering, and the caller's fallback is the reader's own row.
 */
export async function getProgramForAdmin(slug: string): Promise<AdminProgramRow | null> {
  try {
    const snapshot = await getDoc(doc(getFirestore(), COLLECTIONS.programs, slug));
    return snapshot.exists() ? toAdminProgram(snapshot) : null;
  } catch (error) {
    console.warn(`[programs] could not read "${slug}" as an administrator:`, error);
    return null;
  }
}

export interface ProgramDraft {
  name: string;
  description: string;
  order: number;
  published: boolean;
}

/**
 * Make a ministry. Superadmin only, by rule.
 *
 * `setDoc` at a known id rather than `addDoc`, because **the slug is the id** —
 * a ministry whose URL was assigned at random would be unlinkable, and
 * `getProgram` is a `getDoc` on the slug precisely because of it. The existence
 * check is what stops a second "Summercamp" silently replacing the first,
 * taking its description and its published state with it.
 *
 * Created **unpublished**, which is the one place this is stricter than it has
 * to be and the one place that is right: a ministry with no photographs and no
 * description is not something to put in front of a visitor, and the tile in
 * the directory is a large one. The `events` collection has no draft state and
 * this does; the difference is the whole reason a new ministry is safe to make
 * from a phone and a new event page has to say out loud that it is public.
 */
export async function createProgram(draft: ProgramDraft): Promise<string> {
  const slug = slugifyName(draft.name);
  if (!slug) throw new Error('Give the ministry a name.');

  const existing = await listProgramsForAdmin();
  if (existing.some((program) => program.id === slug)) {
    throw new Error(`There is already a ministry at /events/${slug}.`);
  }

  await setDoc(doc(getFirestore(), COLLECTIONS.programs, slug), {
    slug,
    name: draft.name.trim(),
    description: draft.description,
    // Written explicitly rather than left absent. Every reader tolerates the
    // key being missing — it has to, for the ministries that predate the field
    // — but a document created today with it absent is a second shape of
    // "empty" for no reason.
    featuredMediaIds: [],
    order: draft.order,
    published: draft.published,
    publishAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: uid(),
  });

  return slug;
}

/**
 * Edit one. The per-ministry grant, not the superadmin's.
 *
 * `slug` is absent from the accepted fields on purpose — it is the document id,
 * so changing it is not an edit but a move, and a move silently breaks every
 * link the parish has already shared and orphans every photograph filed under
 * `galleries/{slug}/`.
 */
export async function updateProgram(
  programId: string,
  patch: {
    name?: string;
    description?: string;
    published?: boolean;
    order?: number;
    /** What the ministry's parts are called. Null ⇒ the default, "Inside". */
    childLabel?: string | null;
    /** Whether the parish is still collecting photographs under this one. */
    submissionsOpen?: boolean;
    /**
     * Where an upload lands unless the sender says otherwise. Null is a real
     * answer — "wherever they are sent from" — and has to be stored as null
     * rather than as an empty string, which reads as a corrupted id to
     * anybody looking at the document.
     */
    prioritySubmissionNodeId?: string | null;
  },
): Promise<void> {
  await updateDoc(doc(getFirestore(), COLLECTIONS.programs, programId), {
    ...patch,
    updatedAt: serverTimestamp(),
    updatedBy: uid(),
  });
}

/**
 * Retire one. Superadmin only, by rule.
 *
 * ## It refuses while the ministry still has gatherings
 *
 * The website's rule, kept for the website's reason: a client-side cascade is a
 * loop of deletes that can stop halfway, and the half that survives is a set of
 * galleries pointing at a ministry that no longer exists. Removing the levels
 * first is the administrator's job, and on this surface that means a browser —
 * the app has no level editor yet. The refusal says so by saying what is in the
 * way.
 *
 * ## The photographs survive it
 *
 * At Tommy's direction, on the website, and it must be true here too or the same
 * button means two different things on two devices. Everything filed against the
 * ministry is re-filed to `UNFILED_PROGRAM_ID` **before** the document goes, so
 * a failure leaves a ministry that still exists with its pictures intact rather
 * than a deleted ministry and pictures nothing can list. A picture carrying that
 * id is findable in one query and appears under "Not in any ministry" in every
 * ministry's picture manager on the website.
 */
export async function deleteProgram(programId: string): Promise<void> {
  const db = getFirestore();

  const levels = await getDocs(
    query(collection(db, COLLECTIONS.programEvents), where('programId', '==', programId)),
  );
  if (levels.size > 0) {
    throw new Error(
      `This ministry still has ${levels.size} gathering${levels.size === 1 ? '' : 's'}. ` +
        'Remove those first, on the website.',
    );
  }

  /*
   * Read by `programId` rather than by `programEventId`, so a picture orphaned
   * by an older delete — one that happened before levels swept their own — is
   * swept too rather than left pointing at a level and a ministry that are both
   * gone.
   */
  const media = await getDocs(
    query(collection(db, COLLECTIONS.galleryMedia), where('programId', '==', programId)),
  );

  const items = media.docs;
  for (let at = 0; at < items.length; at += BATCH_MAX) {
    const batch = writeBatch(db);
    for (const item of items.slice(at, at + BATCH_MAX)) {
      batch.update(doc(db, COLLECTIONS.galleryMedia, item.id), {
        programId: UNFILED_PROGRAM_ID,
        programEventId: UNFILED_PROGRAM_ID,
        updatedAt: serverTimestamp(),
        updatedBy: uid(),
      });
    }
    await batch.commit();
  }

  await deleteDoc(doc(db, COLLECTIONS.programs, programId));
}

/**
 * Write the running order, as 1..N.
 *
 * A batch, because a loop of writes can fail on the third and leave two
 * ministries renumbered and three not — an order nobody chose, which the next
 * move makes worse. Atomic: the parish sees the new order or the old one.
 *
 * Positions are rewritten from scratch rather than nudged, because the seeded
 * values have gaps and duplicates in them and "insert between" arithmetic on a
 * list of five buys nothing but fractions. Only the documents whose number
 * actually changed are written, so moving the last tile up one is two writes.
 */
export async function reorderPrograms(ordered: readonly AdminProgramRow[]): Promise<void> {
  const db = getFirestore();
  const batch = writeBatch(db);
  let touched = 0;

  ordered.forEach((program, index) => {
    const position = index + 1;
    if (program.order === position) return;
    touched += 1;
    batch.update(doc(db, COLLECTIONS.programs, program.id), {
      order: position,
      updatedAt: serverTimestamp(),
      updatedBy: uid(),
    });
  });

  if (touched === 0) return;
  await batch.commit();
}

/* -------------------------------------------------------------------------- */

/**
 * A program document as the directory holds one, plus the two fields only an
 * administrator needs.
 *
 * Deliberately not `gallery/data.ts`'s `toProgram`: that one is the public
 * reader and has no business carrying `published` or `order`, because nothing a
 * visitor sees depends on either. This is the same parse with those two added,
 * field by field for the reason that file gives — a binary on a phone cannot be
 * redeployed the afternoon a document turns out to hold a number where a string
 * was expected.
 */
function toAdminProgram(snapshot: DocumentSnapshot | QueryDocumentSnapshot): AdminProgramRow {
  const data = snapshot.data() as Record<string, unknown> | undefined;
  const featured = data?.['featuredMediaIds'];

  return {
    id: snapshot.id,
    slug: typeof data?.['slug'] === 'string' ? data['slug'] : snapshot.id,
    name: typeof data?.['name'] === 'string' ? data['name'] : snapshot.id,
    description: typeof data?.['description'] === 'string' ? data['description'] : '',
    childLabel: typeof data?.['childLabel'] === 'string' ? data['childLabel'] : null,
    featuredMediaIds: Array.isArray(featured)
      ? featured.filter((id): id is string => typeof id === 'string')
      : [],
    // `!== false`, not `=== true`. Absent is open; only an explicit close closes.
    submissionsOpen: data?.['submissionsOpen'] !== false,
    published: data?.['published'] === true,
    order: typeof data?.['order'] === 'number' ? data['order'] : 0,
    prioritySubmissionNodeId:
      typeof data?.['prioritySubmissionNodeId'] === 'string'
        ? data['prioritySubmissionNodeId']
        : null,
  };
}

/* -------------------------------------------------------------------------- */
/* Levels — every node of the tree, at any depth                               */
/* -------------------------------------------------------------------------- */

/**
 * A level as an administrator needs it: everything the gallery draws, plus the
 * two fields only somebody editing cares about.
 *
 * `published`, because an administrator's tree contains drafts and the panel has
 * to say which; `endAt`, because the public reader never needed the second half
 * of a span — `compareNodes` sorts on the start — and the editor does.
 */
export interface AdminNodeRow extends NodeRow {
  published: boolean;
  endAt: Date | null;
}

export interface LevelDraft {
  title: string;
  description: string;
  /** Null for a level with no fixed date — a standing class, or "Day 1". */
  startAt: Date | null;
  endAt: Date | null;
  published: boolean;
  submissionsOpen: boolean;
  /** What the parts inside this level are called. Null ⇒ the default. */
  childLabel?: string | null;
}

/**
 * Every level under one ministry, drafts included, at every depth.
 *
 * The administrator's counterpart to `getProgramNodes`, and it has to be the
 * *whole* tree rather than the published part of it: the unpublished week
 * somebody created a moment ago has nowhere to hang its days otherwise.
 *
 * The fallback is `listProgramsForAdmin`'s, for its reason — an unfiltered list
 * is refused outright rather than trimmed for anybody the rules will not show a
 * draft to.
 */
export async function listLevelsForAdmin(programId: string): Promise<AdminNodeRow[]> {
  const levels = collection(getFirestore(), COLLECTIONS.programEvents);
  const mine = where('programId', '==', programId);

  const snapshot = await getDocs(query(levels, mine, orderBy('startAt', 'desc'))).catch(() =>
    getDocs(query(levels, mine, where('published', '==', true), orderBy('startAt', 'desc'))),
  );

  return snapshot.docs.map(toNodeRow);
}

/**
 * Create a level — the thing that gets a page, a gallery and a queue.
 *
 * `parentId` is what makes this one function for "add a camp to Summercamp" and
 * "add Day 1 to Week 1". There is no separate call for a subgroup, because there
 * is no such thing as a subgroup: the third level and the second are the same
 * kind of document and only their parent differs.
 *
 * The slug is scoped to its **siblings**, not to the ministry, and that is a
 * deliberate loosening — two camps may each have a `day-1`, because the trail
 * that resolves it walks the tree rather than matching the last segment.
 *
 * The id carries the whole path, so one camp's Day 1 and another's cannot
 * collide in a flat collection shared by every ministry, and an id read in the
 * Firestore console still says where the photographs came from. Truncated at 200
 * characters because Firestore caps an id at 1500 bytes and a deep tree of long
 * names would reach it; the suffix loop is what makes the truncation safe, since
 * two paths agreeing for 200 characters would otherwise silently overwrite one
 * another — and for `setDoc` that means the second takes the first's description
 * and its published state with it.
 */
export async function createLevel(
  programId: string,
  parentId: string | null,
  draft: LevelDraft,
): Promise<string> {
  const slug = slugifyName(draft.title);
  if (!slug) throw new Error('Give this level a name.');

  const existing = await listLevelsForAdmin(programId);
  const siblings = existing.filter((level) => level.parentId === parentId);
  if (siblings.some((level) => level.slug === slug)) {
    throw new Error(`There is already a “${draft.title}” here.`);
  }

  const taken = new Set(existing.map((level) => level.id));
  const base = `${parentId ?? programId}-${slug}`.slice(0, 200);
  let id = base;
  for (let n = 2; taken.has(id) && n < 500; n += 1) id = `${base}-${n}`;

  /*
   * Ordered after its siblings rather than at 0, in tens, so a later insert
   * between two neighbours does not have to renumber anything. This is what
   * makes "Day 1, Day 2, Day 3" come out in the order they were typed — dated
   * levels tie at 0 and fall back to the date, see `compareNodes`.
   */
  const lastOrder = siblings.reduce((max, level) => Math.max(max, level.order ?? 0), 0);

  await setDoc(doc(getFirestore(), COLLECTIONS.programEvents, id), {
    programId,
    parentId,
    slug,
    title: draft.title.trim(),
    description: draft.description,
    startAt: draft.startAt,
    endAt: draft.endAt,
    timeZone: PARISH_TIME_ZONE,
    order: lastOrder + 10,
    featuredMediaIds: [],
    calendarEventId: null,
    submissionsOpen: draft.submissionsOpen,
    published: draft.published,
    publishAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: uid(),
  });

  return id;
}

/** Edit one. The same grant that may edit the ministry, or this level alone. */
export async function updateLevel(levelId: string, patch: Partial<LevelDraft>): Promise<void> {
  await updateDoc(doc(getFirestore(), COLLECTIONS.programEvents, levelId), {
    ...patch,
    updatedAt: serverTimestamp(),
    updatedBy: uid(),
  });
}

/**
 * Remove a level.
 *
 * **Refuses while anything hangs beneath it**, exactly as `deleteProgram`
 * refuses a ministry that still has levels, and for the same reason: a
 * client-side cascade is a loop of deletes that can stop halfway, and the days
 * that survive point at a week that no longer exists. `buildGalleryTree` would
 * lift them to the top of the ministry — visible, which is the right failure,
 * but not what anybody asked for. Refusing makes the person deleting look at
 * what they are about to lose.
 *
 * The photographs filed here are never destroyed. They move **to the ministry**,
 * which is the one destination that always exists and the one page that shows
 * everything — see `nodeSummary`'s `rootId`. Not to the parent level, which
 * scatters them: deleting a week and its days one by one would leave four
 * different places to look.
 *
 * The move is committed before the level document goes, so a failure leaves the
 * level and its pictures exactly as they were.
 */
export async function deleteLevel(levelId: string, programId: string): Promise<void> {
  const db = getFirestore();

  const all = await listLevelsForAdmin(programId);
  const beneath = descendantsOf(buildGalleryTree(all), levelId);
  if (beneath.length > 0) {
    throw new Error(
      `This still has ${beneath.length} level${beneath.length === 1 ? '' : 's'} inside it. ` +
        'Remove those first.',
    );
  }

  const media = await getDocs(
    query(
      collection(db, COLLECTIONS.galleryMedia),
      where('programId', '==', programId),
      where('programEventId', '==', levelId),
    ),
  );

  const items = media.docs;
  for (let at = 0; at < items.length; at += BATCH_MAX) {
    const batch = writeBatch(db);
    for (const item of items.slice(at, at + BATCH_MAX)) {
      batch.update(doc(db, COLLECTIONS.galleryMedia, item.id), {
        // The ministry itself, which is what `rootId` means: filed here, and on
        // no level.
        programEventId: programId,
        updatedAt: serverTimestamp(),
        updatedBy: uid(),
      });
    }
    await batch.commit();
  }

  await deleteDoc(doc(db, COLLECTIONS.programEvents, levelId));
}

/**
 * A level document as the gallery holds one, plus the two fields only somebody
 * editing needs.
 *
 * `gallery/data.ts`'s `toNode` with `published` and `order` surfaced. Not shared
 * with it for the reason `toAdminProgram` gives: the public reader has no
 * business carrying either, because the query it runs has already answered both.
 */
function toNodeRow(snapshot: QueryDocumentSnapshot): AdminNodeRow {
  const data = snapshot.data() as Record<string, unknown>;
  const featured = data['featuredMediaIds'];

  return {
    id: snapshot.id,
    parentId: typeof data['parentId'] === 'string' ? data['parentId'] : null,
    slug: typeof data['slug'] === 'string' ? data['slug'] : snapshot.id,
    title: typeof data['title'] === 'string' ? data['title'] : '',
    description: typeof data['description'] === 'string' ? data['description'] : '',
    childLabel: typeof data['childLabel'] === 'string' ? data['childLabel'] : null,
    order: typeof data['order'] === 'number' ? data['order'] : undefined,
    startAt: (data['startAt'] ?? null) as NodeRow['startAt'],
    featuredMediaIds: Array.isArray(featured)
      ? featured.filter((id): id is string => typeof id === 'string')
      : undefined,
    // Absent is *not* published here, unlike `submissionsOpen` on a ministry:
    // every document this collection has ever held carries the field, and the
    // conservative reading of a malformed one is to mark it a draft rather than
    // to tell an administrator the parish can see it.
    published: data['published'] === true,
    endAt: toDate(data['endAt'] as never),
  };
}
