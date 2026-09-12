/**
 * "The thing happening now" — `config/events.mainSection`, resolved.
 *
 * One field on one document names one ministry, and it exists for the tags:
 * a plaque by the door cannot be reprogrammed every week, so it points at a
 * route, the route reads this, and the parish changes the answer here. That is
 * why this module exists in the app at all — it is the piece the App Clip and
 * the home screen both stand on.
 *
 * ## Four things can be missing, and none of them is an error
 *
 * Nothing set; a ministry that has since been deleted; a ministry with no
 * levels yet; submissions closed. The website's rule for all four is the same
 * and is worth restating because it is easy to get wrong here: **a stale
 * pointer reads as "not set", never as a failure.** A screen that refuses
 * because a ministry was removed in June is worse than one that quietly offers
 * nothing, and a stranger holding a phone to a plaque has no way to act on an
 * error message about a document id.
 *
 * So every return below is a well-formed answer. `null` means "there is nothing
 * to send to", and the caller shows the parish's own words rather than a fault.
 */
import { collection, doc, getDoc, getDocs, getFirestore, orderBy, query, where } from '@react-native-firebase/firestore';
import {
  COLLECTIONS,
  CONFIG_DOC_EVENTS,
  buildGalleryTree,
  defaultSubmissionNode,
  parseEventsPageConfig,
  type GalleryTreeNode,
} from '@spsm/shared';

/** Where a photograph taken from the home screen or a tag will be filed. */
export interface MainSection {
  programId: string;
  /** The level to file against, or the program's own id when it has no levels. */
  programEventId: string;
  /** The ministry's title, for the button that offers it. */
  title: string;
}

/**
 * Resolve the pointer, or null.
 *
 * Three reads on a cold start, and they are ordered so the cheapest refusal
 * comes first: most of the year the answer is a program that is set, published
 * and open, and the tree read is the only expensive one.
 */
export async function resolveMainSection(): Promise<MainSection | null> {
  const db = getFirestore();

  const configSnapshot = await getDoc(doc(db, COLLECTIONS.config, CONFIG_DOC_EVENTS));
  const { mainSection } = parseEventsPageConfig(configSnapshot.data());
  if (!mainSection) return null;

  const programSnapshot = await getDoc(doc(db, COLLECTIONS.programs, mainSection));
  const program = programSnapshot.data();
  /*
   * `exists` and `published` together. The pointer survives a ministry being
   * deleted *and* one being unpublished, and an unpublished ministry is not a
   * place a stranger may send a photograph — `firestore.rules` would refuse the
   * write, and finding that out after the shutter has clicked is the worst
   * moment to find it out.
   */
  if (!programSnapshot.exists() || !program || program['published'] !== true) return null;

  // Governs the whole tree. `ProgramEvent.submissionsOpen` is deprecated in
  // favour of this one; do not read the per-level flag.
  if (program['submissionsOpen'] === false) return null;

  /*
   * `name`, not `title`. `Program.name` is the field; `ProgramEvent.title` is
   * the one called `title`, and the two sit one letter apart in the same
   * feature. Reading `title` here was silent — every branch is a well-formed
   * answer by design — so the home screen offered to send a photograph to
   * "summercamp", the document id, rather than to "Summercamp".
   *
   * The fallback stays, and stays the id: a ministry with no name is a ministry
   * somebody has not finished creating, and a destination with no words is still
   * better than no destination.
   */
  const title = typeof program['name'] === 'string' ? program['name'] : mainSection;

  /*
   * The filter is not optional and not an optimisation. Firestore judges a
   * `list` on its *potential* result set, so a query without
   * `published == true` is refused outright for an anonymous reader rather than
   * returning fewer rows — the whole query fails, and the failure looks exactly
   * like a broken screen. `orderBy('startAt', 'desc')` matches the composite
   * index the website's identical query relies on.
   */
  const events = await getDocs(
    query(
      collection(db, COLLECTIONS.programEvents),
      where('programId', '==', mainSection),
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
  const priority = typeof program['prioritySubmissionNodeId'] === 'string'
    ? program['prioritySubmissionNodeId']
    : null;

  /*
   * `?? mainSection` is the documented fourth fallback, and it is deliberately
   * not inside `defaultSubmissionNode` — that function answers "which level",
   * and a program id is not a level. A ministry created five minutes ago with
   * no levels at all is still a destination.
   *
   * `pageNodeId` is null because there is no page here: a tag and a home screen
   * are not standing on a level the way the website's form is.
   */
  const nodeId = defaultSubmissionNode(tree, priority, null) ?? mainSection;

  return { programId: mainSection, programEventId: nodeId, title };
}
