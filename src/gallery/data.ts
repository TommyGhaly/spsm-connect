/**
 * Reads for the program galleries.
 *
 * The app's half of the website's `features/programs/data.ts`, query for query.
 * The two must ask Firestore the same questions, because they render the same
 * documents through the same `@spsm/shared` walks and a difference here is a
 * gallery that disagrees with itself across two screens.
 *
 * ## The filter that is not optional
 *
 * `where('status', '==', 'approved')` appears in every media query below, and
 * `where('published', '==', true)` in every other one. Neither may be dropped as
 * a tidy-up. Firestore judges a `list` on what it *could* return, so without
 * them the rules cannot prove no pending item comes back and the whole query is
 * **denied** — not filtered. The gallery goes empty and the console says
 * `permission-denied`, which reads like a broken screen rather than a missing
 * clause. This is the same rule `mainSection.ts` states and the third place in
 * this app that depends on it.
 *
 * ## Every read here answers rather than throws
 *
 * `readOrEmpty` is the website's, and for its reason: these run in front of a
 * parishioner, where a throw unmounts the screen and leaves somebody looking at
 * nothing. The caller renders "this could not be loaded" instead. That is the
 * opposite of the website's *build-time* reads, which re-throw so a deploy fails
 * loudly — same error, different right answer, because the audience differs.
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  where,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
} from '@react-native-firebase/firestore';
import {
  COLLECTIONS,
  type FocalPoint,
  type GalleryTreeNode,
  type GridPlacement,
  type SummaryMedia,
} from '@spsm/shared';

/* -------------------------------------------------------------------------- */
/* What the screens hold                                                       */
/* -------------------------------------------------------------------------- */

/**
 * A ministry.
 *
 * `name`, not `title` — `Program.name` is the field, and the distinction has
 * already cost this app one bug. `ProgramEvent.title` *is* `title`, so the two
 * sit one letter apart in the same feature and neither is wrong.
 */
export interface ProgramRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  /** The parish's own word for what is inside — "Weeks", "Years". May be unset. */
  childLabel: string | null;
  /** The ministry's curated summary, in the order somebody chose. */
  featuredMediaIds: readonly string[];
}

/** One level of a ministry. Structural, and a `GalleryTreeNode` by construction. */
export interface NodeRow extends GalleryTreeNode {
  description: string;
  childLabel: string | null;
}

/**
 * One photograph or clip. A `SummaryMedia`, plus what it takes to draw one.
 *
 * `aspect` is derived here rather than stored: the documents carry `width` and
 * `height`, and `packGallery` wants the ratio. The website does the same
 * division at its own call site (`GalleryCanvas`), so this is where the app's
 * copy of that one line lives.
 */
export interface MediaRow extends SummaryMedia {
  caption: string;
  /** Width ÷ height of the source. Drives the shape auto-layout gives it. */
  aspect: number | null;
  /** An administrator's manual placement on the canvas, honoured exactly. */
  layout: GridPlacement | null;
  focal: FocalPoint | null;
}

/* -------------------------------------------------------------------------- */
/* The reads                                                                   */
/* -------------------------------------------------------------------------- */

/** Everything a public reader is allowed to see, and nothing else. */
const approved = () => where('status', '==', 'approved');

async function readOrEmpty<T>(what: string, run: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await run();
  } catch (error) {
    console.error(`[gallery] ${what} failed:`, error);
    return fallback;
  }
}

/** The ministries, published, in the order the parish set. */
export async function listPrograms(): Promise<ProgramRow[]> {
  return readOrEmpty(
    'programs',
    async () => {
      const snapshot = await getDocs(
        query(
          collection(getFirestore(), COLLECTIONS.programs),
          where('published', '==', true),
          orderBy('order', 'asc'),
        ),
      );
      return snapshot.docs.map(toProgram);
    },
    [],
  );
}

/**
 * A ministry by its slug.
 *
 * The slug is also the document id — a superadmin creates a program from a name
 * they typed, so there is no reason for the two to differ — which is why this is
 * a `getDoc` and not a query, and why `listPrograms` is not the way to find one.
 */
export async function getProgram(slug: string): Promise<ProgramRow | null> {
  return readOrEmpty(
    `program ${slug}`,
    async () => {
      const snapshot = await getDoc(doc(getFirestore(), COLLECTIONS.programs, slug));
      if (!snapshot.exists()) return null;
      const program = toProgram(snapshot);
      // Unpublished is indistinguishable from absent, on purpose: both mean
      // "there is no such gallery", and a screen that told them apart would be
      // telling a stranger about a draft.
      return snapshot.data()?.['published'] === true ? program : null;
    },
    null,
  );
}

/**
 * Every level under one ministry, in one query.
 *
 * The whole tree, not one generation, and not a convenience: a page here shows a
 * summary of everything beneath it and cannot know what that is from its
 * children alone. It is also the only shape that does not fan out with the
 * parish's history — a generation-at-a-time read is a query per level per page,
 * and it gets slower every year the parish runs camp.
 *
 * The `orderBy` is what the index and the rules require, not the order anything
 * renders in: `buildGalleryTree` sorts by `compareNodes`, which reads the
 * administrator's manual `order` before the date.
 */
export async function getProgramNodes(programId: string): Promise<NodeRow[]> {
  return readOrEmpty(
    `levels of ${programId}`,
    async () => {
      const snapshot = await getDocs(
        query(
          collection(getFirestore(), COLLECTIONS.programEvents),
          where('programId', '==', programId),
          where('published', '==', true),
          orderBy('startAt', 'desc'),
        ),
      );
      return snapshot.docs.map(toNode);
    },
    [],
  );
}

/**
 * Firestore's ceiling on the values in an `in` filter.
 *
 * Not a number this file chose, and the whole reason `getSubtreeMedia` has two
 * branches rather than one.
 */
const IN_FILTER_MAX = 30;

/**
 * How much of a ministry's archive one read pulls when its subtree is too wide
 * for an exact query.
 *
 * A ministry page needs three things — the pictures it shows, a cover for each
 * level under it, and the counts beside them — and all three are *summaries* of
 * the whole program, so one capped query answers them. The cost is honest and
 * small: a level with nothing inside this window shows no cover and no count,
 * which is what it shows when it genuinely has no photographs. 300 is several
 * years of camps.
 */
const PROGRAM_WINDOW = 300;

/**
 * Every approved photograph under one level — it and everything beneath it.
 *
 * **The read the whole section is built on.** A gallery page shows a summary of
 * its subtree, so "the photographs of this page" is never one node's worth.
 *
 * Two shapes, chosen by how wide the subtree is, and the reason for two is
 * accuracy rather than speed. Up to thirty nodes — nearly every real subtree, a
 * week and its days — is one `in` query, exact and uncapped. Wider than that
 * falls back to one capped `programId` query filtered here, which is a genuine
 * approximation. The alternative to both was a query per node: a fan-out that
 * grows with the parish's history, on the screen somebody opens first.
 */
export async function getSubtreeMedia(
  programId: string,
  nodeIds: readonly string[],
): Promise<MediaRow[]> {
  // A level with nothing under it — an empty ministry, or one whose children are
  // all unpublished. No query, rather than a query that cannot match.
  if (nodeIds.length === 0) return [];

  if (nodeIds.length <= IN_FILTER_MAX) {
    return readOrEmpty(
      `media for ${nodeIds.length} level(s) of ${programId}`,
      async () => {
        const snapshot = await getDocs(
          query(
            collection(getFirestore(), COLLECTIONS.galleryMedia),
            where('programEventId', 'in', [...nodeIds]),
            approved(),
            orderBy('order', 'asc'),
          ),
        );
        return snapshot.docs.map(toMedia);
      },
      [],
    );
  }

  const wanted = new Set(nodeIds);
  const everything = await getProgramMedia(programId, PROGRAM_WINDOW);
  return everything.filter((item) => wanted.has(item.programEventId));
}

/**
 * Everything approved across a whole ministry — what the ministry page reads.
 *
 * Capped, because a program with ten years of camps behind it is thousands of
 * photographs and no screen needs them all in memory to draw the first twenty.
 */
export async function getProgramMedia(programId: string, max = 500): Promise<MediaRow[]> {
  return readOrEmpty(
    `media for program ${programId}`,
    async () => {
      const snapshot = await getDocs(
        query(
          collection(getFirestore(), COLLECTIONS.galleryMedia),
          where('programId', '==', programId),
          approved(),
          orderBy('order', 'asc'),
          limit(max),
        ),
      );
      return snapshot.docs.map(toMedia);
    },
    [],
  );
}

/* -------------------------------------------------------------------------- */
/* Documents to rows                                                           */
/* -------------------------------------------------------------------------- */

type Snapshot = QueryDocumentSnapshot | DocumentSnapshot;

/*
 * Field-by-field rather than the website's `{ id, ...data as T }` cast, and the
 * difference is not fussiness.
 *
 * The website reads these documents into a build it controls; this binary is on
 * a phone and cannot be redeployed when a document is shaped unexpectedly. Two
 * fields below genuinely are absent on real documents — `featuredMediaIds`
 * postdates the collection, which is why `nodeSummary` guards it with
 * `Array.isArray` rather than `?? []`, and `placement` likewise — and every walk
 * in `gallery/tree.ts` dereferences `placement.onPage` without checking. One old
 * document would take the screen down.
 *
 * The defaults are the conservative ones: a photograph nobody has placed is not
 * on a page, so it does not silently appear.
 */

function str(data: Record<string, unknown> | undefined, key: string, fallback = ''): string {
  const value = data?.[key];
  return typeof value === 'string' ? value : fallback;
}

function bool(data: Record<string, unknown> | undefined, key: string): boolean {
  return data?.[key] === true;
}

function toProgram(snapshot: Snapshot): ProgramRow {
  const data = snapshot.data();
  const featured = data?.['featuredMediaIds'];

  return {
    id: snapshot.id,
    slug: str(data, 'slug', snapshot.id),
    name: str(data, 'name', snapshot.id),
    description: str(data, 'description'),
    childLabel: typeof data?.['childLabel'] === 'string' ? data['childLabel'] : null,
    featuredMediaIds: Array.isArray(featured) ? featured.filter((id) => typeof id === 'string') : [],
  };
}

function toNode(snapshot: QueryDocumentSnapshot): NodeRow {
  const data = snapshot.data();
  const featured = data['featuredMediaIds'];

  return {
    id: snapshot.id,
    parentId: typeof data['parentId'] === 'string' ? data['parentId'] : null,
    slug: str(data, 'slug', snapshot.id),
    title: str(data, 'title'),
    description: str(data, 'description'),
    childLabel: typeof data['childLabel'] === 'string' ? data['childLabel'] : null,
    order: typeof data['order'] === 'number' ? data['order'] : undefined,
    /*
     * Handed to `compareNodes`, which calls `toDate` on it. A Firestore
     * Timestamp satisfies `Timestamped` as-is; anything else is dropped, and an
     * undated level sorts last among equals — which is the convention this
     * collection has always used, because a level with no date is one somebody
     * has not finished filling in.
     */
    startAt: (data['startAt'] ?? null) as NodeRow['startAt'],
    featuredMediaIds: Array.isArray(featured)
      ? featured.filter((id) => typeof id === 'string')
      : undefined,
  };
}

function toMedia(snapshot: QueryDocumentSnapshot): MediaRow {
  const data = snapshot.data();
  const placement = (data['placement'] ?? {}) as Record<string, unknown>;
  const focal = data['focal'] as Record<string, unknown> | undefined;
  const width = data['width'];
  const height = data['height'];

  return {
    id: snapshot.id,
    programEventId: str(data, 'programEventId'),
    // Anything that is not a video is drawn as a still, which is the safe way
    // round: an unknown kind renders as a picture rather than as a player.
    kind: data['kind'] === 'video' ? 'video' : 'photo',
    renditionPath: typeof data['renditionPath'] === 'string' ? data['renditionPath'] : null,
    posterPath: typeof data['posterPath'] === 'string' ? data['posterPath'] : null,
    placement: {
      onPage: bool(placement, 'onPage'),
      slideshow: bool(placement, 'slideshow'),
      homepage: bool(placement, 'homepage'),
    },
    caption: str(data, 'caption'),
    // Both, and both positive, or no opinion. A zero height would be a division
    // by zero and an `Infinity` aspect, which `shapeFor` would read as a
    // panorama and give the full width of the page to.
    aspect:
      typeof width === 'number' && typeof height === 'number' && width > 0 && height > 0
        ? width / height
        : null,
    layout: toPlacement(data['layout']),
    focal:
      typeof focal?.['x'] === 'number' && typeof focal['y'] === 'number'
        ? { x: focal['x'], y: focal['y'] }
        : null,
  };
}

/**
 * A stored manual placement, or null to let the packer choose.
 *
 * All four numbers or none of them: `packGallery` passes whatever comes out of
 * here to `clampPlacement` and then *reserves* it before any automatic item is
 * placed, so a half-read placement would reserve a region of the canvas that
 * nothing asked for and push real photographs around it.
 */
function toPlacement(value: unknown): GridPlacement | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  const { col, row, colSpan, rowSpan } = record;

  return typeof col === 'number' &&
    typeof row === 'number' &&
    typeof colSpan === 'number' &&
    typeof rowSpan === 'number'
    ? { col, row, colSpan, rowSpan }
    : null;
}
