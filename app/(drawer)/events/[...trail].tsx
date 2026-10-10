/**
 * One level of a ministry's gallery: its photographs, with its parts in the
 * shelf at the right edge.
 *
 * A catch-all rather than a fixed depth, because the galleries are a tree of
 * arbitrary depth — `/events/summercamp/2026-week-1/day-1/the-hike` is a real
 * page — and nothing here counts. The first segment is the ministry; everything
 * after it is a trail of slugs resolved against the tree by `resolveTrail`. That
 * is the same shape the website's `parseGalleryPath` produces, so the same URL
 * opens the same page in a browser and in this app, which is what makes the
 * universal links work.
 *
 * ## The one idea worth reading before the code
 *
 * **A level summarises everything beneath it.** No page renders "its own"
 * photographs — Summercamp shows pictures drawn from every year of camp, Week 1
 * shows pictures drawn from each of its days, and the deepest level is only
 * special in that its subtree is one node. `nodeSummary` is that rule, it lives
 * in `@spsm/shared`, and this screen does not second-guess it. See the header of
 * `gallery/tree.ts` for why "newest first" is the wrong answer.
 *
 * ## It also answers for the church's authored event pages
 *
 * `/events/christmas-festival` is not a ministry, it is a document in the
 * `events` collection with a photograph and a description — the pages the Wix
 * site kept one route each for. They share this stretch of the address space
 * with the galleries on both surfaces, and until this route fell through to
 * them, a link from the calendar to one landed on "No such gallery". See the
 * lookup below, and `src/events/EventScreen.tsx`.
 *
 * ## One read, not one per level
 *
 * The whole tree and one window of media come back in two queries, and every
 * tile, count and cover on the page is derived from those in memory. A read per
 * level would be a fan-out that grows with the church's history, on a screen
 * somebody opens first.
 */
import { Stack, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import {
  buildGalleryTree,
  childrenOf,
  collapseToColumn,
  isSuperadmin,
  nodeSummary,
  packGallery,
  resolveTrail,
  subtreeIds,
  summariseChildren,
  trailOf,
  type GalleryTree,
} from '@spsm/shared';

import { Rich } from '@/about/Rich';
import { AdminFab } from '@/components/AdminFab';
import { Card, Screen } from '@/components/Surface';
import { Body, Label, Lede, Small, Title } from '@/components/Type';
import { AddPictures } from '@/gallery/AddPictures';
import { Mosaic } from '@/gallery/Mosaic';
import { ReviewQueue } from '@/gallery/ReviewQueue';
import {
  SHELF_CLEARANCE,
  SubgroupShelf,
  shelfNote,
  type ShelfItem,
} from '@/gallery/SubgroupShelf';
import { EventScreen } from '@/events/EventScreen';
import { getEventBySlug, type EventDoc } from '@/events/data';
import {
  getMinistryMedia,
  getProgram,
  getProgramNodes,
  getSubtreeMedia,
  type MediaRow,
  type NodeRow,
  type ProgramRow,
} from '@/gallery/data';
import {
  getProgramForAdmin,
  listLevelsForAdmin,
  type AdminNodeRow,
  type AdminProgramRow,
} from '@/gallery/adminData';
import { LevelDetailsSheet } from '@/gallery/LevelAdmin';
import { PictureManagerSheet } from '@/gallery/PictureManager';
import { ProgramDetailsSheet } from '@/gallery/ProgramAdmin';
import { mayAdminProgram, mayAdminProgramEvent } from '@/firebase/grants';
import { useGrants } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';

/** What one successful pair of reads gives the screen. */
interface Level {
  program: ProgramRow;
  /**
   * The same ministry, read the administrator's way, or null for everybody
   * else.
   *
   * `ProgramRow` deliberately drops `published`, `order` and the submission
   * priority — a reader has no use for any of them and the query it came from
   * has already answered the first. The sheet on the ministry's own page draws
   * all three, so it needs the wider row; see `getProgramForAdmin`.
   */
  adminProgram: AdminProgramRow | null;
  tree: GalleryTree<NodeRow>;
  /** The level being shown, or null for the ministry's own page. */
  node: NodeRow | null;
  /** Every approved item under this level, at any depth. */
  media: MediaRow[];
}

/**
 * What the screen is showing, and which trail it is showing it *for*.
 *
 * The trail is carried alongside rather than reset in the effect, and that is
 * the whole reason this is one object. Tapping into a level re-runs the reads,
 * and the obvious `setState({ kind: 'loading' })` at the top of the effect is a
 * synchronous setState inside an effect body — a cascading render, and the thing
 * `react-hooks/set-state-in-effect` exists to catch. Comparing `for` against the
 * current key answers the same question by derivation: a result belonging to the
 * previous trail *is* the loading state for this one, so the last gallery does
 * not flash on screen under the new title while the reads are in flight.
 */
type State =
  | { for: string; kind: 'missing' }
  | { for: string; kind: 'event'; event: EventDoc }
  | { for: string; kind: 'ready'; level: Level };

export default function GalleryLevel() {
  const theme = useTheme();
  const grants = useGrants();
  const { trail } = useLocalSearchParams<{ trail: string | string[] }>();
  const [state, setState] = useState<State | null>(null);
  /*
   * Bumped by anything that changes a document this page drew: approving a
   * photograph, moving one, deleting one. A counter rather than a refetch
   * function, so the reads stay in the one effect that knows how to cancel
   * them — and so a decision made while the previous read is still in flight
   * cannot install a level built from the older answer.
   *
   * It is deliberately not a listener. This page is public and reads the whole
   * tree plus a window of media; watching all of that for the handful of people
   * who can change it would put a permanent subscription on every visitor's
   * phone to serve an administrator's convenience.
   */
  const [reload, setReload] = useState(0);

  /*
   * A catch-all hands back a string for one segment and an array for more, so
   * both shapes have to be accepted. Joined into a key rather than depended on
   * directly, because the array is a fresh object on every render and would
   * re-run the effect forever.
   */
  const segments = useMemo(
    () => (typeof trail === 'string' ? [trail] : (trail ?? [])).filter(Boolean),
    [trail],
  );
  const key = segments.join('/');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [programSlug, ...rest] = segments;
      if (!programSlug) {
        if (!cancelled) setState({ for: key, kind: 'missing' });
        return;
      }

      /*
       * The slug *is* the document id of a ministry — `createProgram` writes
       * it there on purpose — so the grant can be checked before the read
       * rather than after it, and the read can be the right one first time.
       */
      const mayEditProgram = mayAdminProgram(grants, programSlug);
      const adminProgram = mayEditProgram ? await getProgramForAdmin(programSlug) : null;
      if (cancelled) return;

      const program = adminProgram ?? (await getProgram(programSlug));
      if (cancelled) return;
      if (!program) {
        /*
         * Not a ministry. It may still be one of the church's authored event
         * pages — `/events/christmas-festival` — which live in the `events`
         * collection and share this stretch of the address space with the
         * galleries.
         *
         * The website resolves the same two the other way round: its
         * `/events/[slug]` route is the event, and Hosting falls through to the
         * gallery rewrite when nothing was exported at that path. The order is
         * the cheap one on each surface and the answers agree, because a slug
         * cannot be both — the website's editor checks that before it will
         * create an event, and `generateStaticParams` de-duplicates what slips
         * through.
         *
         * Only for a bare slug. `/events/summercamp/2026-week-1` with no such
         * ministry is a gallery trail that did not resolve, and looking for an
         * event called `summercamp` underneath it would answer a question
         * nobody asked.
         */
        const event = rest.length === 0 ? await getEventBySlug(programSlug) : null;
        if (cancelled) return;
        setState(event ? { for: key, kind: 'event', event } : { for: key, kind: 'missing' });
        return;
      }

      /*
       * An administrator reads a different tree from a visitor, and it is the
       * same difference the website's shell makes: `getProgramNodes` filters on
       * `published`, which it must — the rules judge a list by what it *could*
       * return, so an unfiltered public query is denied outright — and that
       * filter would hide the week somebody created a moment ago from the only
       * person who can finish it. `listLevelsForAdmin` asks the wider question
       * and falls back to the narrow one for anybody it is refused to, so the
       * branch cannot lock a visitor out of the gallery.
       *
       * It also carries `published` and `endAt`, which the panel needs and the
       * public reader has no use for.
       */
      const tree = buildGalleryTree(
        mayEditProgram
          ? await listLevelsForAdmin(program.id)
          : await getProgramNodes(program.id),
      );
      if (cancelled) return;

      /*
       * A trail that does not resolve is "no such gallery" rather than the
       * nearest thing that does. Rendering Week 1 for `/2026-week-1/day-7` when
       * there is no Day 7 would tell somebody the link worked.
       *
       * Slugs are unique among *siblings* only, which is why this walks: two
       * different weeks may each have a `day-1`.
       */
      const resolved = rest.length > 0 ? resolveTrail(tree, rest) : [];
      if (resolved === null) {
        setState({ for: key, kind: 'missing' });
        return;
      }

      const node = resolved.at(-1) ?? null;
      /*
       * A level reads its subtree; the ministry reads the whole program.
       *
       * Not an optimisation, and not symmetrical by accident: `subtreeIds`
       * returns nodes and a ministry is not one, so a photograph filed on the
       * ministry itself was in no page's read at all. See `getMinistryMedia`,
       * which also carries the strays.
       */
      const media =
        node === null
          ? await getMinistryMedia(program.id, tree)
          : await getSubtreeMedia(program.id, subtreeIds(tree, node.id));
      if (cancelled) return;

      setState({ for: key, kind: 'ready', level: { program, adminProgram, tree, node, media } });
    })().catch(() => {
      if (!cancelled) setState({ for: key, kind: 'missing' });
    });

    return () => {
      cancelled = true;
    };
    // `segments` is memoised on `key`; listing the key keeps the dependency
    // honest without re-running on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, reload, grants]);

  // A result for a different trail is this trail's loading state. See `State`.
  if (state === null || state.for !== key) {
    return (
      <>
        <Stack.Screen options={{ title: '' }} />
        <Screen>
          <Lede color={theme.color.inkSoft}>Opening the gallery…</Lede>
        </Screen>
      </>
    );
  }

  if (state.kind === 'event') {
    // The title comes from the event itself, inside `EventScreen`, because it
    // changes as somebody edits it.
    return <EventScreen event={state.event} />;
  }

  if (state.kind === 'missing') {
    return (
      <>
        <Stack.Screen options={{ title: 'Not found' }} />
        <Screen>
          <Card>
            {/* Two kinds of address land here now — a gallery trail that does
                not resolve, and a bare slug that is neither a ministry nor one
                of the church's event pages — so the words name both rather than
                telling somebody who followed a link to a deleted festival that
                their *gallery* has moved. */}
            <Label>Nothing here</Label>
            <Body color={theme.color.inkSoft}>
              There is no gallery or event at this address. It may have been moved or taken
              down. The church&rsquo;s photographs are under Photos, and what it has coming up is
              on the Calendar.
            </Body>
          </Card>
        </Screen>
      </>
    );
  }

  return <LevelView level={state.level} onChanged={() => setReload((count) => count + 1)} />;
}

function LevelView({ level, onChanged }: { level: Level; onChanged: () => void }) {
  const theme = useTheme();
  const router = useRouter();
  const grants = useGrants();
  const { program, adminProgram, tree, node, media } = level;

  /*
   * Whether to draw the pill, and the two different questions behind it.
   *
   * On a level it is `mayAdminProgramEvent`, which admits somebody granted that
   * one gathering as well as somebody granted the whole ministry — the split
   * `firestore.rules` makes on `/programEvents`. On the ministry's own page
   * there is no level to be scoped to, so it is the ministry grant.
   *
   * And on the ministry's own page the sheet edits the ministry *document*, so
   * it also needs the administrator's read of it. In practice the two go
   * together — the grant is what the read is allowed by, and both are asked in
   * the same effect — but a pill that opens nothing is worse than no pill, and
   * this is one condition rather than a fallback sheet that exists for a state
   * nobody has seen.
   */
  const mayEdit = node
    ? mayAdminProgramEvent(grants, program.id, node.id)
    : mayAdminProgram(grants, program.id) && adminProgram !== null;

  const [editing, setEditing] = useState(false);
  const [managing, setManaging] = useState(false);

  const title = node?.title ?? program.name;
  const description = node?.description ?? program.description;

  const children = childrenOf(tree, node?.id ?? null);
  const summaries = useMemo(
    () => summariseChildren(tree, node?.id ?? null, media),
    [tree, node, media],
  );

  /*
   * The photographs this level shows, by the shared rule rather than by any
   * choice made here: a curated set if somebody curated one, otherwise a spread
   * across the children so the top of the tree shows the whole tree.
   *
   * `rootId` is the program's id and is not optional on the ministry page — it
   * is what "filed directly on the ministry rather than on any level" means, and
   * without it a photograph filed there vanishes from the only page that could
   * show it, which reads as a delete.
   */
  const pictures = useMemo(
    () =>
      nodeSummary(tree, node?.id ?? null, media, {
        curated: node ? node.featuredMediaIds : program.featuredMediaIds,
        rootId: program.id,
      }),
    [tree, node, media, program],
  );

  // The church's own word for what is inside this level — "Weeks", "Days" —
  // falling back to the ministry's, and then to something true of any of them.
  const childLabel = node?.childLabel ?? program.childLabel ?? 'Inside';

  /*
   * This level's parts, shaped for the side menu — the only list of them now.
   *
   * Derived here rather than inside the shelf because everything it needs is
   * already on this screen: the tree, the summaries, and the trail each child
   * resolves to. The shelf takes rows and knows nothing about galleries, which
   * is what keeps it a menu rather than a second copy of this screen.
   */
  const shelf = useMemo(
    (): ShelfItem[] =>
      children.map((child) => {
        const summary = summaries.get(child.id) ?? null;
        const slugs = trailOf(tree, child.id).map((one) => one.slug);

        return {
          id: child.id,
          label: child.title,
          href: `/events/${program.slug}/${slugs.join('/')}` as Href,
          // The spread `summariseChildren` takes across the child's subtree,
          // not its single `cover`: the tile cycles, and opens on a random one.
          covers: summary?.covers ?? [],
          note: shelfNote({
            children: summary?.children ?? 0,
            photos: summary?.photos ?? 0,
            videos: summary?.videos ?? 0,
          }),
        };
      }),
    [children, summaries, tree, program.slug],
  );

  return (
    <>
      <Stack.Screen options={{ title }} />
      <Screen>
        {/*
          The band the pull tab is level with, held clear of it.

          The tab is an overlay at the right edge and sits at the top of the
          page now rather than the middle of it, which puts it across the title
          and the first lines of the description — so the church's own prose
          lost a word off the end of every line it was beside. Nothing in the
          page can see an overlay, so the page is told: see `SHELF_CLEARANCE`.

          Only this block, and only when there is a tab. The photographs below
          start further down than the tab reaches, and paying 34 points of every
          row for furniture that is not there would narrow the gallery on every
          leaf page in the app.
        */}
        <View style={{ gap: theme.space.md, paddingRight: shelf.length > 0 ? SHELF_CLEARANCE : 0 }}>
          <Breadcrumb level={level} />
          <Title>{title}</Title>
          {/*
            `Rich`, not `Body`: the website renders this same field through
            `Prose`, so the church types `**Monthly**` into a ministry's
            description and reads it bold on the site. Plain text here showed
            the asterisks instead — the same words saying something slightly
            sillier in the app than on the page they were written for.
          */}
          {description ? <Rich color={theme.color.inkSoft}>{description}</Rich> : null}

          {/*
            The way in for photographs, at the top of the page, where the
            website puts it too — and pointed at *this* level rather than at
            whatever the camera tab happens to be collecting for. It draws
            nothing when the ministry has stopped taking them, so this block
            stays unconditional without ever ending in a gap. See
            `AddPictures`.
          */}
          <AddPictures program={program} node={node} />

          {/*
            The approval queue, and only on the ministry's own page.

            `node === null` is the whole of that rule and it matches the
            website: the query behind it is `where('programId','==',…)`, which
            is the one shape `firestore.rules` can prove for a program lead
            rather than only for a superadmin, so there is exactly one queue per
            ministry and this is where it lives. It draws nothing for anybody
            who does not run this ministry, and nothing when nothing is waiting
            — see `ReviewQueue`, which decides both for itself so this page does
            not carry a second copy of the permission.

            Inside the clearance block with the head, because it is at the top
            of the page where the shelf's pull tab is, and a card that ran under
            the tab would put its button beneath it.
          */}
          {node === null ? (
            <ReviewQueue program={program} tree={tree} onDecided={onChanged} />
          ) : null}
        </View>

        {/*
          The photographs, and on this screen that is the whole page.

          This level's parts used to be listed here as well, above the gallery,
          and the shelf at the right edge listed them again — Tommy: *"the side
          drawer in the events node is there, get rid of the subgroups in the
          main page."* The shelf is the better of the two copies: it holds a
          fourteen-day camp in one scroll, it reaches a part with no
          photographs in it, and it does not push the gallery off the bottom of
          the first screen. So there is one list now, and the page is what it
          says it is.

          With the cards gone, the section heading over the gallery goes too:
          there is nothing left for "Photographs" to distinguish it from.
        */}
        {pictures.length > 0 ? (
          <Canvas pictures={pictures} program={program} tree={tree} onChanged={onChanged} />
        ) : (
          <Card>
            <Label>Nothing yet</Label>
            {/* A level with parts is not empty, it just has no photographs of
                its own yet — so this points at the shelf rather than telling
                somebody to wait for the church. It does not name the parts:
                `childLabel` falls back to "Inside", and the tab beside this
                card is already carrying the church's word for them. */}
            <Body color={theme.color.inkSoft}>
              {children.length > 0
                ? 'There are no photographs here yet. What is inside this level is in the menu at the right edge.'
                : 'There are no photographs here yet. When the church approves some, they appear here.'}
            </Body>
          </Card>
        )}
      </Screen>

      {/*
        The side menu, and a sibling of the page rather than something in it.

        Outside `Screen` on purpose: it is an overlay at the right edge, so it
        must not scroll with the gallery, and its own list must not be a
        `ScrollView` inside another one. See the header of `SubgroupShelf`.

        It draws nothing when this level has no parts, so the leaf pages — a day
        of camp, which is where most of the photographs are — are untouched.
      */}
      <SubgroupShelf legend={childLabel} items={shelf} />

      {/*
        "Edit this page", in the bottom-right corner, over everything.

        Outside `Screen` for the same reason the shelf is: it must not scroll
        with the gallery. See `EditPageButton` on why that corner and not
        another.
      */}
      {/*
        One action on a level and two on the ministry, which is why the pill
        says different things in the two places.

        A level's page has one thing to open. The ministry's has the settings
        *and* the filing cabinet — every photograph in the ministry, which is
        reachable from nowhere else and is the reason `PictureManager` exists.
        A pill with two options is a menu, and the menu is the platform's; see
        `AdminFab`. "Manage" rather than either option's own words, because a
        pill labelled with one of two things it opens is a pill that lies half
        the time.
      */}
      {mayEdit ? (
        <AdminFab
          label={node ? 'Edit this page' : 'Manage'}
          actions={
            node
              ? [{ label: 'Edit this page', onPress: () => setEditing(true) }]
              : [
                  { label: 'Edit this ministry', onPress: () => setEditing(true) },
                  { label: 'All the photographs', onPress: () => setManaging(true) },
                ]
          }
        />
      ) : null}

      {/*
        The filing cabinet, a sibling of the settings sheet rather than a
        button inside it.

        The website puts it in the same inspector panel as the ministry's
        details, which it can because a panel is not a dialog. Here both are
        sheets, and a sheet that opens a sheet that opens the photograph's own
        editor is three modals deep — a depth nothing else in this app goes to,
        and one iOS is not reliable about. Two entries in the same menu is the
        same two presses and none of that.
      */}
      {mayEdit && managing && !node ? (
        <PictureManagerSheet
          program={program}
          tree={tree}
          media={media}
          open
          onClose={() => setManaging(false)}
          onChanged={onChanged}
        />
      ) : null}

      {/*
        What it opens depends on what this page *is*, and both sheets now ask
        the same shape of question about their own subject.

        A level has details of its own — name, dates, visibility, what its parts
        are called, removal — and carries "add something inside" with them.

        The ministry's own page used to open the add-a-level plate and nothing
        else, on the argument that a ministry's name and description are
        administered in the directory's edit mode. That argument was half
        right and cost too much: the directory is superadmin-only, so a program
        lead running Summercamp could photograph it from a phone and not
        rename it, describe it, publish it, or stop it collecting. Tommy: *"the
        top level node in the events should have more settings than just adding
        subnodes."* So it opens `ProgramDetailsSheet` — the same sheet the
        directory opens, with the two submission settings the website keeps on
        this page and the add-a-level plate inside it.
      */}
      {mayEdit && editing && node ? (
        <LevelDetailsSheet
          // See the note on `listLevelsForAdmin` in the effect above: when
          // `mayAdminProgram` is true the tree was read with the administrator's
          // query, so every node genuinely carries `published` and `endAt`.
          node={node as AdminNodeRow}
          program={program}
          open
          onClose={() => setEditing(false)}
          onChanged={onChanged}
          onRemoved={() => {
            setEditing(false);
            // The page being read no longer exists, so staying on it would show
            // a level that is gone. Up one, which is where its photographs went.
            router.back();
          }}
        />
      ) : null}

      {mayEdit && editing && !node && adminProgram ? (
        <ProgramDetailsSheet
          program={adminProgram}
          // The tree this page already read, which is what turns on the two
          // submission settings and "add something inside" — see the `tree`
          // prop. The directory has no tree and gets neither.
          tree={tree}
          /*
           * `allow create, delete: if isSuper()` on `/programs`. A program
           * lead may edit the ministry they were given and may not retire it,
           * so the red button is not drawn for them at all rather than drawn
           * and refused.
           */
          mayRemove={isSuperadmin(grants.claims)}
          open
          onClose={() => setEditing(false)}
          onChanged={onChanged}
          onRemoved={() => {
            setEditing(false);
            // The ministry this page *is* has gone, so there is nothing here to
            // go back to — not even one level up. The directory is where its
            // tile was.
            router.replace('/events');
          }}
        />
      ) : null}
    </>
  );
}

/**
 * Where this level sits — "Summercamp · Week 1 2026".
 *
 * The stack's back button already goes up one, so this is orientation rather
 * than navigation for the common case; it is tappable because four levels down,
 * "back to the ministry" is four presses otherwise.
 *
 * `trailOf` yields the part of the trail that *exists*, which is exactly the
 * path that will resolve — a node whose parent is unpublished was lifted to the
 * top by `buildGalleryTree`, and its URL is one level shallower to match.
 */
function Breadcrumb({ level }: { level: Level }) {
  const theme = useTheme();
  const router = useRouter();
  const { program, tree, node } = level;

  if (!node) return null;

  const ancestors = trailOf(tree, node.id).slice(0, -1);

  /*
   * `Href` rather than `string`, and named so the `.map` below can be annotated
   * too. `typedRoutes` checks a template literal against the route union only
   * when it has a contextual type to check against — a `.map` callback infers
   * its own return first, so the annotation has to be on the callback as well
   * as on the array, or the widened `string` comes back.
   */
  type Hop = { label: string; href: Href };

  const hops: Hop[] = [
    { label: program.name, href: `/events/${program.slug}` },
    ...ancestors.map((one, index): Hop => ({
      label: one.title,
      href: `/events/${program.slug}/${ancestors
        .slice(0, index + 1)
        .map((step) => step.slug)
        .join('/')}`,
    })),
  ];

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: theme.space.xs }}>
      {hops.map((hop, index) => (
        /*
         * `String`, because `Href` admits an object form and a key must be a
         * string. Every href here is a template literal, so this is the path
         * itself — the cast is to satisfy the union, not to paper over a shape.
         */
        <View key={String(hop.href)} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.xs }}>
          {index > 0 ? <Small color={theme.color.inkFaint}>·</Small> : null}
          <Pressable
            onPress={() => router.push(hop.href)}
            accessibilityRole="link"
            accessibilityLabel={`Back to ${hop.label}`}
            hitSlop={theme.space.xs}
          >
            <Small color={theme.color.accent}>{hop.label}</Small>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

/**
 * The photographs, in the administrator's arrangement, laid out for the screen
 * they are actually on.
 *
 * `packGallery` lays the gallery out on the same twelve-column canvas the
 * website uses — honouring every manual placement exactly — and
 * `collapseToColumn` then reads that arrangement top-to-bottom, left-to-right
 * and flattens it to a list. Both are `@spsm/shared`, and running them here
 * rather than sorting by `order` is what makes the phone agree with the website
 * about which photograph comes first.
 *
 * **Reading order, not document order, and that is the point.** An
 * administrator who drags a photograph to the top of the canvas means it to come
 * first; a phone that ignored the position would show it wherever it happened to
 * sit in the list. A layout built on a 1400px canvas cannot be shown at 390pt,
 * so this does not try to reproduce it: the order is handed to `Mosaic`, which
 * lays it out in justified rows and opens the viewer from any tile.
 */
function Canvas({
  pictures,
  program,
  tree,
  onChanged,
}: {
  pictures: readonly MediaRow[];
  program: ProgramRow;
  tree: GalleryTree<NodeRow>;
  onChanged: () => void;
}) {
  const order = useMemo(() => {
    const placed = collapseToColumn(
      packGallery(pictures.map((item) => ({ id: item.id, layout: item.layout, aspect: item.aspect }))),
    );
    const byId = new Map(pictures.map((item) => [item.id, item]));
    return placed
      .map((one) => byId.get(one.id))
      .filter((item): item is MediaRow => item !== undefined);
  }, [pictures]);

  return <Mosaic order={order} program={program} tree={tree} onChanged={onChanged} />;
}
