/**
 * One level of a ministry's gallery: its sub-levels, and its photographs.
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
 * card, count and cover on the page is derived from those in memory. A read per
 * level would be a fan-out that grows with the parish's history, on a screen a
 * parishioner opens first.
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
  type NodeSummary,
} from '@spsm/shared';

import { Card, Screen } from '@/components/Surface';
import { Body, Heading, Label, Lede, Small, Title } from '@/components/Type';
import { Picture } from '@/gallery/Picture';
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
  }, [key]);

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
              This gallery has been moved or is no longer published. The parish&rsquo;s photographs
              are under Photos, and on the website.
            </Body>
          </Card>
        </Screen>
      </>
    );
  }

  return <LevelView level={state.level} />;
}

function LevelView({ level }: { level: Level }) {
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

  // The parish's own word for what is inside this level — "Weeks", "Days" —
  // falling back to the ministry's, and then to something true of any of them.
  const childLabel = node?.childLabel ?? program.childLabel ?? 'Inside';

  return (
    <>
      <Stack.Screen options={{ title }} />
      <Screen>
        <Breadcrumb level={level} />
        <Title>{title}</Title>
        {description ? <Body color={theme.color.inkSoft}>{description}</Body> : null}

        {children.length > 0 ? (
          <View style={{ gap: theme.space.sm }}>
            <Label>{childLabel}</Label>
            {children.map((child) => (
              <ChildCard
                key={child.id}
                child={child}
                summary={summaries.get(child.id) ?? null}
                level={level}
              />
            ))}
          </View>
        ) : null}

        {pictures.length > 0 ? (
          <View style={{ gap: theme.space.sm }}>
            {children.length > 0 ? <Label>Photographs</Label> : null}
            <Canvas pictures={pictures} />
          </View>
        ) : children.length === 0 ? (
          <Card>
            <Label>Nothing yet</Label>
            <Body color={theme.color.inkSoft}>
              There are no photographs here yet. When the parish approves some, they appear here.
            </Body>
          </Card>
        ) : null}
      </Screen>
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
 * A level's card: its cover, its name, and what is inside it.
 *
 * Every number counts the child's whole subtree rather than the documents filed
 * directly on it. "Week 1 2026 — 214 photographs" is the fact somebody wants
 * before they tap; the per-document count gives "0 photographs" for a week whose
 * four days hold fifty each, and that reads as an empty camp.
 */
function ChildCard({
  child,
  summary,
  level,
}: {
  child: NodeRow;
  summary: NodeSummary<MediaRow> | null;
  level: Level;
}) {
  const theme = useTheme();
  const router = useRouter();

  const slugs = trailOf(level.tree, child.id).map((one) => one.slug);
  const href: Href = `/events/${level.program.slug}/${slugs.join('/')}`;

  return (
    <Pressable
      onPress={() => router.push(href)}
      accessibilityRole="button"
      accessibilityLabel={child.title}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, gap: theme.space.xs })}
    >
      {summary?.cover ? (
        <Picture media={summary.cover} height={160} />
      ) : (
        <View
          style={{
            height: 160,
            borderRadius: theme.radius.sm,
            backgroundColor: theme.color.paperRaised,
            borderColor: theme.color.rule,
            borderWidth: 1,
          }}
        />
      )}
      <Heading>{child.title}</Heading>
      <Small color={theme.color.inkSoft}>{insideLine(summary)}</Small>
    </Pressable>
  );
}

function insideLine(summary: NodeSummary<MediaRow> | null): string {
  if (!summary) return '';

  const parts: string[] = [];
  if (summary.children > 0) {
    parts.push(summary.children === 1 ? '1 inside' : `${summary.children} inside`);
  }
  if (summary.photos > 0) {
    parts.push(summary.photos === 1 ? '1 photograph' : `${summary.photos} photographs`);
  }
  if (summary.videos > 0) {
    parts.push(summary.videos === 1 ? '1 clip' : `${summary.videos} clips`);
  }
  return parts.length > 0 ? parts.join(' · ') : 'Nothing yet';
}

/**
 * The photographs, in the administrator's arrangement, collapsed to one column.
 *
 * `packGallery` lays the gallery out on the same twelve-column canvas the
 * website uses — honouring every manual placement exactly — and
 * `collapseToColumn` then reads that arrangement top-to-bottom, left-to-right
 * and stacks it. Both are `@spsm/shared`, and running them here rather than
 * sorting by `order` is what makes the phone agree with the website about which
 * photograph comes first.
 *
 * **Reading order, not document order, and that is the point.** An
 * administrator who drags a photograph to the top of the canvas means it to come
 * first; a phone that ignored the position would show it wherever it happened to
 * sit in the list. A layout built on a 1400px canvas cannot be shown at 390pt —
 * a third-width box is a hundred points — so this does not try.
 */
function Canvas({ pictures }: { pictures: readonly MediaRow[] }) {
  const theme = useTheme();
  const { width } = useWindowDimensions();

  const order = useMemo(() => {
    const placed = collapseToColumn(
      packGallery(pictures.map((item) => ({ id: item.id, layout: item.layout, aspect: item.aspect }))),
    );
    const byId = new Map(pictures.map((item) => [item.id, item]));
    return placed
      .map((one) => byId.get(one.id))
      .filter((item): item is MediaRow => item !== undefined);
  }, [pictures]);

  // The cell is the column width, which is the window less both gutters. Its
  // height comes from the photograph's own proportions where they are known, so
  // a portrait is not cropped to a landscape box on the one layout that has the
  // room to show it whole.
  const column = width - theme.space.gutter * 2;

  return (
    <View style={{ gap: theme.space.sm }}>
      {order.map((item) => (
        <View key={item.id} style={{ gap: theme.space.xs }}>
          <Picture media={item} height={cellHeight(column, item.aspect)} />
          {item.caption ? <Small color={theme.color.inkSoft}>{item.caption}</Small> : null}
        </View>
      ))}
    </View>
  );
}

/**
 * How tall one cell is.
 *
 * Bounded at both ends rather than taken from the ratio alone: a panorama would
 * otherwise be a 60-point stripe and a tall portrait would fill more than a
 * screen, so neither reads as a photograph. An unknown ratio gets 4:3, which is
 * the commonest shape a parish camera produces.
 */
function cellHeight(width: number, aspect: number | null): number {
  const ratio = aspect ?? 4 / 3;
  return Math.round(Math.min(Math.max(width / ratio, width * 0.5), width * 1.25));
}
