/**
 * Where a photograph goes — the church's live answer, and the sender's.
 *
 * ## Two answers to one question, and the order between them
 *
 * The church's answer is `config/events.mainSection` plus
 * `Program.prioritySubmissionNodeId`: one ministry, one level inside it, set by
 * an administrator and changed as the season changes. That is what
 * `gallery/mainSection.ts` already resolves, and it is the right default for
 * the overwhelming majority of people who open the camera — somebody standing
 * at a service does not want to navigate a tree before they can send the
 * photograph they just took.
 *
 * The sender's answer overrides it, always, the moment they give one. A
 * parishioner at the camp holding photographs of last night's Vespers knows
 * something the config document does not.
 *
 * ## Why this is a *watch* and `resolveMainSection` is a read
 *
 * `resolveMainSection` is a one-shot `getDoc`, and it is still the right shape
 * for the App Clip: a clip has one invocation and is gone. The camera is a
 * screen somebody leaves open through a whole liturgy, and the administrator
 * moving the priority from "Morning" to "Liturgy" halfway through is precisely
 * the moment the screen must not be stale. So `config/events` gets an
 * `onSnapshot` here, and every change re-resolves the rest.
 *
 * The re-resolve is two more reads and is *not* itself live — a level renamed
 * while the camera is open keeps its old name until the pointer changes. That
 * is deliberate: three nested listeners to keep a string fresh, on the one
 * screen in the app that is holding a camera open, is not a trade worth making.
 *
 * ## Every absence is an answer, never a fault
 *
 * Inherited wholesale from `mainSection.ts`, whose header makes the argument at
 * length: nothing set, a deleted ministry, a closed one and an offline phone
 * all read as `null`, and `null` means "the church is not collecting
 * photographs at the moment". A stranger holding a phone up to a plaque cannot
 * act on an error about a document id.
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  where,
} from '@react-native-firebase/firestore';
import {
  COLLECTIONS,
  CONFIG_DOC_EVENTS,
  buildGalleryTree,
  defaultSubmissionNode,
  parseEventsPageConfig,
  submissionTargets,
  type GalleryTreeNode,
  type SubmissionTarget,
} from '@spsm/shared';

import { listPrograms, getProgramNodes } from '@/gallery/data';

/**
 * One place a photograph may be filed.
 *
 * `programEventId` is what goes on the document, and it may legitimately hold
 * the *program's* own id — that is the documented state for a ministry with no
 * levels, and for a picture dropped on the top row. `nodeTitle` is null in
 * exactly that case, which is how the pill knows to say "Summercamp" rather
 * than "Summercamp · Summercamp".
 */
export interface Destination {
  programId: string;
  programEventId: string;
  /** `Program.name` — "Summercamp". Not `title`; see gallery/data.ts. */
  programName: string;
  /** `ProgramEvent.title` — "Day 3" — or null when filing on the ministry. */
  nodeTitle: string | null;
}

/** "Summercamp · Day 3", or just "Summercamp". For the pill and the sheet. */
export function destinationLabel(destination: Destination): string {
  return destination.nodeTitle
    ? `${destination.programName} · ${destination.nodeTitle}`
    : destination.programName;
}

/** Whether two destinations are the same row, for drawing the tick. */
export function sameDestination(a: Destination | null, b: Destination | null): boolean {
  if (!a || !b) return a === b;
  return a.programId === b.programId && a.programEventId === b.programEventId;
}

/* -------------------------------------------------------------------------- */
/* The church's answer, live                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Watch `config/events.mainSection` and resolve it to a destination.
 *
 * Returns the unsubscribe. `onChange` is called with `null` for every one of
 * the absences described in the header, including the very first time when the
 * document has not arrived yet — callers distinguish "nothing set" from "not
 * known yet" by their own loading flag, not by the value.
 *
 * ## The sequence guard is load-bearing
 *
 * Each snapshot kicks off an async resolve, and two snapshots in quick
 * succession — an administrator correcting a mistaken pointer — race. Without
 * the token the slower, older resolve can land last and pin the screen to the
 * ministry that was just corrected away from, with nothing on screen to say so.
 */
export function watchDefaultDestination(
  onChange: (destination: Destination | null) => void,
): () => void {
  const db = getFirestore();
  let live = true;
  let sequence = 0;
  let stop: (() => void) | null = null;
  let retry: ReturnType<typeof setTimeout> | null = null;
  let attempt = 0;

  const attach = (): void => {
    if (!live) return;

    stop = onSnapshot(
      doc(db, COLLECTIONS.config, CONFIG_DOC_EVENTS),
      (snapshot) => {
        // A snapshot means the listener is healthy; the next failure starts
        // its backoff from the beginning rather than from wherever the last
        // one left off.
        attempt = 0;

        const token = ++sequence;
        const { mainSection } = parseEventsPageConfig(snapshot.data());

        if (!mainSection) {
          onChange(null);
          return;
        }

        void resolveProgramDestination(mainSection)
          .then((resolved) => {
            if (live && token === sequence) onChange(resolved);
          })
          .catch(() => {
            // Offline, or the ministry has gone. Both are "nothing to send to".
            if (live && token === sequence) onChange(null);
          });
      },
      () => {
        /*
         * Firestore tears a listener down when it errors, and nothing puts it
         * back — so without this, one transient rules refusal or App Check
         * hiccup disables the shutter for the rest of the process. The pill
         * would go on saying "the church is not collecting photographs",
         * which is indistinguishable from the truth and is not it.
         *
         * `++sequence` matters as much as the re-attach: it invalidates any
         * resolve still in flight from the snapshot before the failure, which
         * would otherwise land afterwards and re-enable the shutter against a
         * destination this listener has just failed on.
         */
        sequence += 1;
        onChange(null);

        if (!live) return;
        const delay = Math.min(RETRY_CEILING_MS, RETRY_BASE_MS * 2 ** attempt);
        attempt += 1;
        retry = setTimeout(attach, delay);
      },
    );
  };

  attach();

  return () => {
    live = false;
    if (retry !== null) clearTimeout(retry);
    stop?.();
  };
}

/** Backoff for a listener that failed: a second, doubling, capped at a minute. */
const RETRY_BASE_MS = 1000;
const RETRY_CEILING_MS = 60_000;

/**
 * One ministry, resolved to the level its photographs should land on.
 *
 * The four fallbacks of `defaultSubmissionNode`, with the documented fourth one
 * — `?? programId`, file it on the ministry itself — applied here rather than
 * inside it, for the reason that function gives: a program id is not a level.
 */
async function resolveProgramDestination(programId: string): Promise<Destination | null> {
  const db = getFirestore();

  const programSnapshot = await getDoc(doc(db, COLLECTIONS.programs, programId));
  const program = programSnapshot.data();

  // Deleted, unpublished, or closed. `firestore.rules` refuses a write to any
  // of the three, and finding that out after the shutter has clicked is the
  // worst possible moment.
  if (!programSnapshot.exists() || !program) return null;
  if (program['published'] !== true) return null;
  if (program['submissionsOpen'] === false) return null;

  const programName = typeof program['name'] === 'string' ? program['name'] : programId;

  /*
   * `published == true` is not an optimisation and cannot be dropped. Firestore
   * judges a `list` on its potential result set, so without it the whole query
   * is refused for an anonymous reader rather than returning fewer rows — and a
   * refusal here looks exactly like a broken screen.
   */
  const events = await getDocs(
    query(
      collection(db, COLLECTIONS.programEvents),
      where('programId', '==', programId),
      where('published', '==', true),
      orderBy('startAt', 'desc'),
    ),
  );

  const nodes: GalleryTreeNode[] = events.docs.map((snapshot) => {
    const data = snapshot.data();
    return {
      id: snapshot.id,
      parentId: typeof data['parentId'] === 'string' ? data['parentId'] : null,
      slug: typeof data['slug'] === 'string' ? data['slug'] : snapshot.id,
      title: typeof data['title'] === 'string' ? data['title'] : '',
      order: typeof data['order'] === 'number' ? data['order'] : undefined,
    };
  });

  const tree = buildGalleryTree(nodes);
  const priority =
    typeof program['prioritySubmissionNodeId'] === 'string'
      ? program['prioritySubmissionNodeId']
      : null;

  // `pageNodeId` is null: a camera is not standing on a level the way the
  // website's form is.
  const nodeId = defaultSubmissionNode(tree, priority, null) ?? programId;

  return {
    programId,
    programEventId: nodeId,
    programName,
    nodeTitle: nodeId === programId ? null : (tree.byId.get(nodeId)?.title ?? null),
  };
}

/* -------------------------------------------------------------------------- */
/* The sender's answer: what the sheet offers                                  */
/* -------------------------------------------------------------------------- */

/** A ministry, as a row in the sheet before anybody has opened it. */
export interface DestinationProgram {
  id: string;
  name: string;
}

/**
 * The ministries a photograph may be sent to.
 *
 * `listPrograms` already filters to published and orders by the church's own
 * `order`. The extra filter here is `submissionsOpen`, which that function does
 * not apply because it also feeds the galleries — a ministry that has stopped
 * *collecting* is still one you may *look at*.
 */
export async function listDestinationPrograms(): Promise<DestinationProgram[]> {
  const programs = await listPrograms();
  return programs
    .filter((program) => program.submissionsOpen)
    .map((program) => ({ id: program.id, name: program.name }));
}

/**
 * Every level inside one ministry, flattened with its depth, ministry first.
 *
 * `submissionTargets` is `@spsm/shared`'s, and using it rather than walking the
 * tree here is the whole point of it being shared — its own header says it
 * exists so "the mobile app builds the same picker over the same tree", and
 * warns what the alternative costs: two answers to "what may a photograph be
 * filed under", one of them in the direction of a picker whose every
 * submission `firestore.rules` refuses.
 *
 * Loaded when a ministry is opened rather than for all of them at once. A
 * church with a dozen ministries is a dozen queries nobody asked for, on a
 * sheet where somebody is going to touch exactly one row.
 */
export async function listDestinationsIn(
  program: DestinationProgram,
): Promise<{ target: SubmissionTarget; destination: Destination }[]> {
  const nodes = await getProgramNodes(program.id);
  const tree = buildGalleryTree(nodes);

  return submissionTargets(program, tree).map((target) => ({
    target,
    destination: {
      programId: program.id,
      programEventId: target.id,
      programName: program.name,
      nodeTitle: target.isProgram ? null : target.title,
    },
  }));
}
