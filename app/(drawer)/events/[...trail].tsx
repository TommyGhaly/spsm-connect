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
 * ## One read, not one per level
 *
 * The whole tree and one window of media come back in two queries, and every
 * tile, count and cover on the page is derived from those in memory. A read per
 * level would be a fan-out that grows with the church's history, on a screen
 * somebody opens first.
 */
import { Stack, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import {
  buildGalleryTree,
  childrenOf,
  collapseToColumn,
  nodeSummary,
  packGallery,
  resolveTrail,
  subtreeIds,
  summariseChildren,
  trailOf,
  type GalleryTree,
} from '@spsm/shared';

import { Rich } from '@/about/Rich';
import { Card, Screen } from '@/components/Surface';
import { Body, Label, Lede, Small, Title } from '@/components/Type';
import { AddPictures } from '@/gallery/AddPictures';
import { Picture } from '@/gallery/Picture';
import { PictureTools } from '@/gallery/PictureTools';
import { ReviewQueue } from '@/gallery/ReviewQueue';
import {
  SHELF_CLEARANCE,
  SubgroupShelf,
  shelfNote,
  type ShelfItem,
} from '@/gallery/SubgroupShelf';
import {
  getProgram,
  getProgramNodes,
  getSubtreeMedia,
  type MediaRow,
  type NodeRow,
  type ProgramRow,
} from '@/gallery/data';
import { useTheme } from '@/theme/ThemeProvider';

/** What one successful pair of reads gives the screen. */
interface Level {
  program: ProgramRow;
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
  | { for: string; kind: 'ready'; level: Level };

export default function GalleryLevel() {
  const theme = useTheme();
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

      const program = await getProgram(programSlug);
      if (cancelled) return;
      if (!program) {
        setState({ for: key, kind: 'missing' });
        return;
      }

      const tree = buildGalleryTree(await getProgramNodes(program.id));
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
      const media = await getSubtreeMedia(program.id, subtreeIds(tree, node?.id ?? null));
      if (cancelled) return;

      setState({ for: key, kind: 'ready', level: { program, tree, node, media } });
    })().catch(() => {
      if (!cancelled) setState({ for: key, kind: 'missing' });
    });

    return () => {
      cancelled = true;
    };
    // `segments` is memoised on `key`; listing the key keeps the dependency
    // honest without re-running on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, reload]);

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

  if (state.kind === 'missing') {
    return (
      <>
        <Stack.Screen options={{ title: 'Not found' }} />
        <Screen>
          <Card>
            <Label>No such gallery</Label>
            <Body color={theme.color.inkSoft}>
              This gallery has been moved or is no longer published. The church&rsquo;s photographs
              are under Photos, and on the website.
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
  const { program, tree, node, media } = level;

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
          cover: summary?.cover ?? null,
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
 * sit in the list. A layout built on a 1400px canvas cannot be shown at 390pt —
 * a third-width box is a hundred points — so this does not try to reproduce it.
 *
 * ## One column on a phone, more on anything wider
 *
 * The collapse is to a *list*, and how many of that list fit across is this
 * screen's question rather than the shared walk's. On a phone held upright the
 * answer is one, and that is not a limitation — **this build has no lightbox.**
 * There is no way to enlarge a photograph, so the gallery is the viewing
 * experience, and two-up thumbnails would be a gallery you cannot actually look
 * at. See the note on `VideoMark` in `Picture.tsx`: when the lightbox lands,
 * this trade is worth re-opening.
 *
 * Turn the phone, or open it on a tablet, and one column becomes wrong in the
 * other direction. A 900pt-wide column gives a portrait a 1125pt cell — a
 * photograph taller than the screen it is on, which has to be scrolled past in
 * two goes to be seen at all. So the column count follows the width, and the
 * cell is capped against the *height* as well. Both are app-only: the website
 * has its own answer to the same question on its own canvas, and nothing here
 * reaches into `@spsm/shared` to change it.
 *
 * Rows are filled in reading order, left to right, so the order is preserved
 * exactly however many columns there are — and every cell in a row shares one
 * height, because a ragged row of near-equal boxes reads as a mistake rather
 * than as a design. Cropping to that height is what `focal` is for.
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
  const theme = useTheme();
  const { width, height } = useWindowDimensions();

  const order = useMemo(() => {
    const placed = collapseToColumn(
      packGallery(pictures.map((item) => ({ id: item.id, layout: item.layout, aspect: item.aspect }))),
    );
    const byId = new Map(pictures.map((item) => [item.id, item]));
    return placed
      .map((one) => byId.get(one.id))
      .filter((item): item is MediaRow => item !== undefined);
  }, [pictures]);

  // The page's usable width is the window less both gutters; the cell is that
  // divided by however many go across, less the gaps between them.
  const page = width - theme.space.gutter * 2;
  const across = columnsFor(width);
  const gap = theme.space.sm;
  const cell = (page - gap * (across - 1)) / across;

  const rows = useMemo(() => chunk(order, across), [order, across]);

  return (
    <View style={{ gap: theme.space.sm }}>
      {rows.map((row) => (
        <View key={row[0]?.id} style={{ flexDirection: 'row', gap }}>
          {row.map((item) => (
            /*
              `flex: 1` rather than the measured width, so the last row of a
              three-column gallery with one photograph in it does not leave a
              lonely third-width box: a short row shares the page between what
              is in it. The measured `cell` is still what decides the height,
              because a height cannot be worked out from a flex basis.
            */
            <View key={item.id} style={{ flex: 1, gap: theme.space.xs }}>
              {/*
                The photograph and its controls share a box, so the controls can
                sit *on* it. Not on the outer element: that one holds the caption
                too, and a button positioned against it would drift down the page
                by the height of however many lines the caption ran to.
              */}
              <View>
                <Picture media={item} height={rowHeight(row, cell, height)} />
                <PictureTools media={item} program={program} tree={tree} onChanged={onChanged} />
              </View>
              {item.caption ? <Small color={theme.color.inkSoft}>{item.caption}</Small> : null}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

/**
 * How many photographs go across, from the width of the window.
 *
 * Phone upright — anything under 620pt, which is every phone in portrait and
 * most in landscape — is one, for the reason in the header: there is no
 * lightbox, so a small cell is a photograph nobody can see. The thresholds above
 * that are a tablet and a tablet turned sideways.
 *
 * Read from `useWindowDimensions` rather than from a device class, so a split
 * screen and a floating window get the layout their actual width deserves.
 */
function columnsFor(width: number): number {
  if (width >= 1000) return 3;
  if (width >= 620) return 2;
  return 1;
}

/** The reading order, cut into rows of `across`. Order is preserved exactly. */
function chunk(order: readonly MediaRow[], across: number): MediaRow[][] {
  const rows: MediaRow[][] = [];
  for (let from = 0; from < order.length; from += across) {
    rows.push(order.slice(from, from + across));
  }
  return rows;
}

/**
 * One height for a whole row.
 *
 * The mean of what each photograph in it would have asked for alone, so a
 * portrait beside a landscape gives a little and takes a little rather than one
 * of them dictating and the other being gutted. Every cell is `contentFit:
 * cover` around the administrator's focal point, so the difference is a crop
 * rather than a distortion.
 *
 * A single-item row is therefore exactly `cellHeight`, which is what a phone
 * held upright gets — the layout this page had before columns existed.
 */
function rowHeight(row: readonly MediaRow[], cell: number, screen: number): number {
  const mean = row.reduce((total, item) => total + cellHeight(cell, item.aspect), 0) / row.length;

  /*
   * Never taller than most of the screen it is on, which is the cap the old
   * ratio-only version was missing. It does nothing on a phone in portrait —
   * 1.25 × 358pt is 448, well inside 80% of 844 — and everything on a phone
   * turned sideways, where a portrait cell would otherwise be taller than the
   * window and could not be seen without two scrolls.
   */
  return Math.round(Math.min(mean, screen * 0.8));
}

/**
 * How tall one cell is.
 *
 * Bounded at both ends rather than taken from the ratio alone: a panorama would
 * otherwise be a 60-point stripe and a tall portrait would fill more than a
 * screen, so neither reads as a photograph. An unknown ratio gets 4:3, which is
 * the commonest shape a church camera produces.
 */
function cellHeight(width: number, aspect: number | null): number {
  const ratio = aspect ?? 4 / 3;
  return Math.round(Math.min(Math.max(width / ratio, width * 0.5), width * 1.25));
}
