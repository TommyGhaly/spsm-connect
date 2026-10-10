/**
 * What is in the drawer, and in what order.
 *
 * The list is short and Tommy set it: your account, the events, About, and the
 * four single pages. Nothing else. Things that used to be here and are not any
 * more, so they are not re-added by accident:
 *
 *   - **The galleries as a filled hero card.** Photographs were the loudest
 *     thing in the drawer and they are not the loudest thing in the church.
 *     The events are now an ordinary group like every other.
 *   - **An "About the church" index row** above the five About pages. The
 *     heading is the index.
 *   - **The `/beliefs` and `/welcome` pages**, which were a second route to
 *     "our beliefs" and to "welcome newcomers" respectively. One door each.
 *   - **Photographs you have sent.** Still reachable, and from the better
 *     place: the Send tab offers it while something is actually sending.
 *   - **The version number**, which was a footer nobody asked for.
 *
 * ## The word is church, not parish
 *
 * This is a Coptic Orthodox church, so "parish" is not the word. It was all
 * over this file, and it is now gone from the whole app — prose included. The
 * only survivors are the `Parish*` names `@spsm/shared` still exports and the
 * `config/parish` document id, which are the Website repo's to rename.
 *
 * ## Colour means one thing: you are here
 *
 * Rows are plain outline glyphs in `inkSoft` with `ink` labels. `accent`
 * appears on exactly one row at a time. What keeps that from being a wall of
 * grey is structure rather than hue — each group is an inset card on
 * `paperRaised` with hairlines between its rows, which is the grouped list
 * every phone already draws, and gives the eye an edge to follow.
 *
 * ## One glyph per subject
 *
 * Three of the glyphs here were wrong and are now native-only drawings of their
 * own: `door` for newcomers reads as *sign out*, `grip` for apps is a drag
 * handle, `file` for privacy names a format rather than a subject. See the
 * notes on `newcomer`, `apps` and `lock` in `components/Icon.tsx`.
 */
import { Image } from 'expo-image';
import { usePathname, useRouter, type Href } from 'expo-router';
import {
  DrawerContentScrollView,
  useDrawerStatus,
  type DrawerContentComponentProps,
} from 'expo-router/drawer';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ADMIN_SCREENS, hasAnyProgramGrant, isSuperadmin } from '@spsm/shared';

import { Icon, type IconName } from '@/components/Icon';
import { Button } from '@/components/Surface';
import { Heading, Label, Small, Subheading } from '@/components/Type';
import { CyclingThumb, coversOf } from '@/gallery/Cycling';
import { getProgramMedia, listPrograms, type MediaRow, type ProgramRow } from '@/gallery/data';
import { mayAdminScreen, type Grants } from '@/firebase/grants';
import { signOut, type User } from '@/firebase/auth';
import { deleteOwnAccount } from '@/session/account';
import { useSession } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * The string half of `Href`.
 *
 * Every destination in this file is a literal path, and it has to be one: the
 * active row is found by comparing `usePathname()` against these. An object
 * href would compare false against every pathname forever and the drawer would
 * silently stop highlighting anything, which is exactly the kind of bug that
 * survives review. Narrowing the type is what stops one being added.
 */
type Path = Extract<Href, string>;

interface Row {
  label: string;
  icon: IconName;
  href: Path;
}

const ABOUT: Row[] = [
  { label: 'Who we are', icon: 'people', href: '/about/who-we-are' },
  { label: 'Our beliefs', icon: 'cross', href: '/about/our-belief' },
  { label: 'Our patron saints', icon: 'saint', href: '/about/patron-saints' },
  { label: 'Welcome newcomers', icon: 'newcomer', href: '/about/welcome-newcomers' },
  { label: 'Future plans', icon: 'plans', href: '/about/future-plans' },
];

/**
 * The camp's three screens, for whoever has been given the camp.
 *
 * Here because the tab bar cannot hold them. The register earns a tab, and only
 * during the camp — `useCampWeek` decides that, and the note on it says the
 * rest of the year the register "lives in the drawer with everything else".
 * This is the drawer it meant: without these rows there is no way to reach any
 * camp screen in September, which is when somebody closes the servants' form
 * for next summer.
 *
 * Shown on the `camp` grant and hidden otherwise, for the reason the tab bar
 * gives: not a security boundary — `firestore.rules` is — but drawing a door
 * somebody cannot open is its own kind of lie.
 */
const CAMP: Row[] = [
  /*
   * Attendance leads, for the reason the camp's own nav leads with it: it is
   * the screen somebody opens every morning of the camp, and the others are
   * read once a season. Top row of the group is the shortest reach.
   */
  { label: 'Attendance', icon: 'check', href: '/admin/camp/attendance' },
  { label: 'Groups', icon: 'people', href: '/admin/camp/groups' },
  { label: 'Camp', icon: 'church', href: '/admin/camp' },
];

/** The four that belong to no group. Rendered as one card with no heading. */
const PAGES: Row[] = [
  { label: 'Watch live', icon: 'play', href: '/livestream' },
  { label: 'Contact', icon: 'phone', href: '/contact' },
  { label: 'Our apps', icon: 'apps', href: '/apps' },
  { label: 'Notifications', icon: 'bell', href: '/notifications' },
  { label: 'Privacy', icon: 'lock', href: '/privacy' },
];

export function DrawerContent({ navigation, state }: DrawerContentComponentProps) {
  const theme = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const events = useEvents();
  const status = useDrawerStatus();
  const scroller = useRef<ScrollView>(null);
  const { grants } = useSession();

  /*
   * Whether to draw the camp's group at all.
   *
   * The same question the tab bar asks — `mayAdminScreen(grants, 'camp')`, which
   * is `runsCamp()` in `firestore.rules` through the same predicate — and asked
   * without the season attached. The register's *tab* is seasonal; the drawer is
   * where it goes the rest of the year, so gating these rows on the season too
   * would leave the camp unreachable in exactly the ten months the tab is gone.
   */
  const runsCamp = mayAdminScreen(grants, 'camp');

  /*
   * Back to the top, every time the drawer opens.
   *
   * The drawer's content is mounted once and slid in and out, so its scroll
   * position is whatever it was left at — somebody who scrolled down to Privacy
   * and then reopened the menu an hour later was still looking at Privacy, with
   * the church's name and their own account off the top of the screen.
   *
   * `animated: false` and keyed on the status change rather than on a press:
   * the status flips at the *start* of the slide, so the jump happens while the
   * panel is still off-screen and is never seen. Firing on 'closed' as well is
   * free and covers the case where the open transition is interrupted.
   */
  useEffect(() => {
    scroller.current?.scrollTo({ y: 0, animated: false });
  }, [status]);

  /*
   * Closing is ours to do, not the navigator's.
   *
   * Navigating to a sibling drawer screen would close it by itself, but one of
   * these destinations — `/sign-in` — is a route on the *root* stack, above
   * this navigator. Pushing it leaves the drawer standing open behind the modal
   * that just appeared, and it is still open when you come back. Closing
   * unconditionally is one line and covers both kinds.
   */
  const go = (href: Href) => {
    router.push(href);
    navigation.closeDrawer();
  };

  /*
   * A ministry row, which is not an ordinary `go`.
   *
   * The ministries are siblings under `/events`, and `push` makes them look like
   * a chain: open Summercamp, come back here, open Mother of Mercy, and the back
   * button takes you to Summercamp — which says Summercamp is what Mother of
   * Mercy is inside. It is not; the directory is, here and on the website, whose
   * ministry pages' back link is `/events`.
   *
   * Said in two steps, because no single one of them is right.
   *
   * `dismissTo` first, to the directory. `index` is always there to pop to —
   * `unstable_settings` in `events/_layout.tsx` names it this stack's anchor,
   * and `withAnchor` on the push below is what loads it the first time — so
   * this lands on `/events` whatever depth you were at, and the ministry that
   * follows is the only gallery in the stack.
   *
   * Then `push`, which is now a push onto the directory rather than onto a
   * sibling.
   *
   * Three one-liners were tried here first and each is wrong in a way that only
   * shows up at a particular depth, so they are worth naming:
   *
   *   - `push` alone stacks the ministries. Open Summercamp, come back here,
   *     open Mother of Mercy, and the back button says Summercamp — which says
   *     Summercamp is what Mother of Mercy is inside.
   *   - `navigate` looks like it should collapse them, since every gallery is
   *     the same route. It does not: measured, it pushes, and back from the
   *     second ministry still lands on the first.
   *   - `replace` is right from a ministry and wrong from anywhere below one.
   *     Four levels into a camp it swaps the day you were on for the new
   *     ministry and leaves the camp beneath it.
   *
   * Only the *top* level wants any of this. Drilling down inside one ministry is
   * a real chain, and the shelf's tiles still push.
   */
  const goMinistry = (href: Href) => {
    router.dismissTo('/events');
    router.push(href, { withAnchor: true });
    navigation.closeDrawer();
  };

  /*
   * Whether the tab bar is behind this drawer right now.
   *
   * Read off the navigator's own state rather than the pathname, because
   * `(tabs)` is a group and contributes no URL segment — there is no string to
   * compare against. `state.routes[state.index]` is the drawer screen the
   * drawer would return you to, which is exactly the question being asked.
   */
  const onTabs = state.routes[state.index]?.name === '(tabs)';

  const active = activeAmong(pathname, [
    '/events',
    ...(events ?? []).map(({ program }) => `/events/${program.slug}`),
    ...ABOUT.map((row) => row.href),
    ...CAMP.map((row) => row.href),
    ...PAGES.map((row) => row.href),
  ]);

  return (
    <DrawerContentScrollView
      ref={scroller}
      contentContainerStyle={{
        /*
         * All four zeroed, and `Start`/`End` explicitly rather than by way of
         * `paddingHorizontal` — the scroll view sets the logical properties,
         * and in React Native those win over the axis shorthand however they
         * are ordered. The masthead has to bleed to all three edges, so it
         * takes the top inset itself; everything under it carries its own
         * gutter.
         */
        paddingTop: 0,
        paddingStart: 0,
        paddingEnd: 0,
        paddingBottom: insets.bottom + theme.space.lg,
        gap: theme.space.lg,
      }}
    >
      <Masthead
        away={!onTabs}
        onGoBack={() => {
          /*
           * `navigate` on the drawer's own navigator rather than a path,
           * because the tabs keep their own state: somebody who was reading the
           * calendar, opened Contact and pressed this should land back on the
           * calendar. `router.push('/')` would instead take them to the camera,
           * which is a different screen than the one they left.
           */
          navigation.navigate('(tabs)');
          navigation.closeDrawer();
        }}
      />

      {/* At the top, where Tommy asked for it. */}
      <Account go={go} />

      <Group title="Events">
        {events === null || events.length === 0 ? (
          /*
           * The one row that stands in for the list.
           *
           * Shown while the read is in flight and kept if it comes back empty
           * or failed — `listPrograms` swallows its own errors and answers `[]`,
           * so those two cases are indistinguishable here and want the same
           * answer anyway: a door to the directory, which has real words for
           * both.
           */
          <Action
            label={events === null ? 'Events' : 'All events'}
            icon="photos"
            active={active === '/events'}
            last
            onPress={() => go('/events')}
          />
        ) : (
          events.map(({ program, covers }, index) => (
            <Action
              key={program.id}
              label={program.name}
              leading={<Thumb covers={covers} open={status === 'open'} />}
              active={active === `/events/${program.slug}`}
              last={index === events.length - 1}
              onPress={() => goMinistry(`/events/${program.slug}` as Path)}
            />
          ))
        )}
      </Group>

      <Group title="About">
        {ABOUT.map((row, index) => (
          <Action
            key={row.href}
            label={row.label}
            icon={row.icon}
            active={row.href === active}
            last={index === ABOUT.length - 1}
            onPress={() => go(row.href)}
          />
        ))}
      </Group>

      {/*
        The camp, for whoever runs it.

        Between About and the loose pages rather than at the bottom: it is the
        one group in this drawer that is somebody's *job* rather than something
        to read, and during the fortnight of camp it is the reason they opened
        the menu. It is absent entirely for everybody else, which is all but
        three or four people in the church.
      */}
      {runsCamp ? (
        <Group title="Summer camp">
          {CAMP.map((row, index) => (
            <Action
              key={row.href}
              label={row.label}
              icon={row.icon}
              active={row.href === active}
              last={index === CAMP.length - 1}
              onPress={() => go(row.href)}
            />
          ))}
        </Group>
      ) : null}

      <Group>
        {PAGES.map((row, index) => (
          <Action
            key={row.href}
            label={row.label}
            icon={row.icon}
            active={row.href === active}
            last={index === PAGES.length - 1}
            onPress={() => go(row.href)}
          />
        ))}
      </Group>
    </DrawerContentScrollView>
  );
}

interface EventRow {
  program: ProgramRow;
  /**
   * What its thumbnail cycles through, once found — empty until then, and for
   * a ministry with none. See `coversOf`.
   */
  covers: MediaRow[];
}

/**
 * How deep into a ministry's archive to look for its thumbnail's photographs.
 *
 * 48, the website's own window for its Events menu (`COVER_WINDOW` in its
 * `data.ts`, which `nav.ts` reads). It was 24 when this needed one cover —
 * the first placed, transcoded photograph, which for any curated ministry is in
 * the first handful. Now the eight it cycles are spread across whatever is
 * read, so the window is how wide an overview the thumbnail gives, and 24 would
 * be a cross-section of the ministry's first couple of outings. The reads are
 * small documents and happen once per launch, the first time the drawer opens;
 * only the eight picked are ever downloaded.
 *
 * Narrower than the directory screen's 60, which also counts the ministry's
 * photographs for its tile and so wants more of the archive in view.
 */
const COVER_WINDOW = 48;

/**
 * The events, read once, the first time the drawer is opened.
 *
 * Lazy on purpose. `drawerContent` mounts with the navigator, which is at app
 * start, so a read at mount would put six Firestore round trips in front of the
 * first frame of a drawer most launches never open. `useDrawerStatus` gives the
 * moment somebody actually asks for it.
 *
 * Once, not per open: the ref is what stops the second open re-reading a list
 * that changes about twice a year.
 *
 * ## Names first, then the photographs
 *
 * Two `setState`s rather than one, deliberately. The names come from a single
 * query and the covers are a fan-out of one read per ministry behind it —
 * waiting for all of them would hold five rows of legible text hostage to five
 * media queries over a church's wifi. The rows appear with their glyph and the
 * photographs arrive into them.
 *
 * `null` means "not read yet" and is drawn differently from `[]`, which means
 * the church has published nothing. See the caller.
 */
function useEvents(): EventRow[] | null {
  const status = useDrawerStatus();
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const asked = useRef(false);

  useEffect(() => {
    if (status !== 'open' || asked.current) return;
    asked.current = true;

    let cancelled = false;
    void (async () => {
      const programs = await listPrograms();
      if (cancelled) return;
      setEvents(programs.map((program) => ({ program, covers: [] })));

      const withCovers = await Promise.all(
        programs.map(async (program) => ({
          program,
          covers: coversOf(await getProgramMedia(program.id, COVER_WINDOW)),
        })),
      );
      if (!cancelled) setEvents(withCovers);
    })();

    return () => {
      cancelled = true;
    };
  }, [status]);

  return events;
}

/* -- the masthead ---------------------------------------------------------- */

/**
 * The church's own seal on the same ground as every header in the app, and the
 * way back out of wherever you are.
 *
 * Solid `deep`, not a gradient: the drawer slides out from under a `deep`
 * navigation bar, and a top that is the same colour as the bar it emerges from
 * reads as one surface instead of two. The only ornament is the gold rule along
 * the bottom edge, which is the church's ornament colour doing the one job it
 * is for.
 *
 * The seal is `splash-icon.png` — the transparent, trimmed render that
 * `scripts/make-icons.mjs` already writes for the splash screen. Reusing it
 * costs nothing: it is in the bundle either way, and it is the same artwork at
 * the same crop, so the drawer opens onto the image the app launched with.
 */
function Masthead({ away, onGoBack }: { away: boolean; onGoBack: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        backgroundColor: theme.color.deep,
        paddingTop: insets.top + theme.space.md,
        /*
         * One gold rule, and that is the whole of the ornament here.
         *
         * A band of small Coptic crosses was tried along this edge and is not
         * coming back: at 14pt tall the crosses read as maths plus signs, and a
         * repeating figure under a seal that is already full-colour artwork was
         * competing with it rather than framing it. The seal is the ornament.
         */
        borderBottomWidth: 2,
        borderBottomColor: theme.color.gold,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space.sm,
          paddingHorizontal: theme.space.md,
          paddingBottom: theme.space.md,
        }}
      >
        <Image
          source={require('../../assets/splash-icon.png')}
          style={{ width: 60, height: 60 }}
          contentFit="contain"
          // The seal is the church's mark and the name is right beside it; a
          // screen reader announcing both would say it twice.
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
        <View style={{ flex: 1, gap: 3 }}>
          {/* The display face rather than the UI one. It is the church's name,
              not a piece of interface, and it is the only place in the drawer
              that gets to be set in the serif. */}
          <Heading color={theme.color.inkInverse}>St. Philopater &amp; St. Mina</Heading>
          {/*
            * Said out loud, in the church's ornament colour, because it is the
            * one fact about this congregation that the rest of the app cannot
            * convey and that somebody arriving might guess wrong. It is also
            * what the seal beside it says in its outer ring.
            */}
          <Label color={theme.color.gold}>Coptic Orthodox Church</Label>
        </View>
      </View>

      {/*
        * The way back to the tab bar, inside the masthead so that the account
        * is still the first thing in the drawer's *content*.
        *
        * The drawer's screens are **siblings** of `(tabs)`, not children of it
        * — see the note in `(drawer)/_layout.tsx`. That is the ordinary drawer
        * contract and it keeps the URLs equal to the website's, but it has one
        * consequence nobody expects: opening Contact from here replaces the tab
        * view entirely, and there is then no tab bar, no back arrow and nothing
        * on screen that says how to return to the five things the app is mostly
        * for.
        *
        * **This row is now the only way back**, which it was not for a while:
        * those screens' headers carried a matching × until the header was made
        * one shared thing and the right corner went to the announcements bell,
        * as it is on every other screen in the app. So the question gets asked
        * while looking at the screen and answered one press later, in here.
        *
        * One word. This read "Back to the app", which is the kind of phrase
        * that makes sense to whoever wrote the navigator and to nobody else:
        * the drawer *is* the app, so "back to" it names nothing a reader can
        * picture. "Home" is the word every phone has already taught.
        *
        * Hidden when the tabs are already behind the drawer. A row offering to
        * take you where you are is noise.
        */}
      {away ? (
        <Pressable
          onPress={onGoBack}
          accessibilityRole="button"
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.space.xs,
            paddingHorizontal: theme.space.md,
            paddingVertical: theme.space.sm,
            borderTopWidth: 1,
            borderTopColor: theme.color.accentStrong,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Icon name="back" color={theme.color.gold} size={18} />
          <Small color={theme.color.gold}>Home</Small>
        </Pressable>
      ) : null}

    </View>
  );
}

/* -- groups and rows ------------------------------------------------------- */

/**
 * One inset card of rows, with an optional heading above it.
 *
 * The card is what stops eighteen identical rows reading as a wall. A grouped
 * list is the shape every phone already draws for exactly this — a short menu
 * of destinations — and it gives the eye an edge to follow without spending a
 * colour, which is the constraint the last version of this file failed.
 */
function Group({ title, children }: { title?: string; children: ReactNode }) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.space.xs }}>
      {title ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.space.sm,
            paddingHorizontal: theme.space.md,
          }}
        >
          <Label color={theme.color.inkFaint}>{title}</Label>
          {/* The rule running out to the edge is what makes this a heading
              rather than a stray word floating above a box. */}
          <View style={{ flex: 1, height: 1, backgroundColor: theme.color.rule }} />
        </View>
      ) : null}

      <View
        style={{
          marginHorizontal: theme.space.sm,
          backgroundColor: theme.color.paperRaised,
          borderColor: theme.color.rule,
          borderWidth: 1,
          borderRadius: theme.radius.md,
          // So a row's press fill and an active row's tint are clipped to the
          // corner rather than squaring it off.
          overflow: 'hidden',
        }}
      >
        {children}
      </View>
    </View>
  );
}

/**
 * One row: a glyph, a label, a chevron, and a tinted fill behind all three when
 * it is the screen you are already on.
 *
 * The active row is found by pathname rather than by the navigator's own state
 * because not all of these routes are this navigator's — see `go`. Matching on
 * the URL is the one comparison that is true for all of them.
 *
 * `last` suppresses the hairline. A rule under the final row of a card draws a
 * line immediately above the card's own border, which reads as a doubled edge.
 */
function Action({
  label,
  icon,
  leading,
  active = false,
  danger = false,
  last = false,
  chevron = true,
  onPress,
}: {
  label: string;
  /** The usual case. Ignored when `leading` is given. */
  icon?: IconName;
  /** Anything that is not a glyph — a ministry's own photograph, say. */
  leading?: ReactNode;
  active?: boolean;
  /** Sign out, delete account. Never a destination, so never `active`. */
  danger?: boolean;
  last?: boolean;
  chevron?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const ink = active || danger ? theme.color.accent : theme.color.ink;
  const glyph = active || danger ? theme.color.accent : theme.color.inkSoft;

  return (
    <View
      style={{
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: theme.color.rule,
      }}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space.sm,
          paddingHorizontal: theme.space.md,
          paddingVertical: theme.space.xs,
          backgroundColor: active
            ? theme.color.accentSoft
            : pressed
              ? theme.color.paperSunken
              : 'transparent',
          // 44pt is Apple's minimum target and the reason this is not just
          // padding.
          minHeight: 46,
        })}
      >
        {/*
          * The bar down the left edge of the row you are on.
          *
          * Absolutely positioned so it spans the row's full height whatever the
          * leading element is, and so it does not shift the label by three
          * points when a row becomes active — which is the thing that makes a
          * list twitch as you navigate it.
          */}
        {active ? (
          <View
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: 3,
              backgroundColor: theme.color.accent,
            }}
          />
        ) : null}
        {leading ?? (icon ? <Icon name={icon} color={glyph} size={20} /> : null)}
        <View style={{ flex: 1 }}>
          <Small color={ink}>{label}</Small>
        </View>
        {chevron ? <Icon name="next" color={theme.color.inkFaint} size={16} /> : null}
      </Pressable>
    </View>
  );
}

/**
 * A ministry's own photographs, at the size of the glyph they replace.
 *
 * This is the single biggest thing keeping the drawer from reading as a list of
 * words: five identical `photos` glyphs said only "these are galleries", which
 * the heading above them already said. The covers are the church's own
 * photographs of its own people, and they are the content.
 *
 * ## Why it cycles at 38pt
 *
 * The website's Events menu cycles its tiles, and Tommy decided the app's
 * equivalents should do what the site does. Whether that survives the drop to a
 * thumbnail was a fair question, and the answer is yes: 38pt is small, but it is
 * a photograph rather than a glyph — a face, a group, a place are all legible
 * at this size — and a crop that brutal is the strongest argument *for* cycling,
 * since one square of one picture says little about a ministry and eight
 * squares spread across its archive say a good deal more. The site's own reason
 * for its menu's 3.2s applies unchanged: a menu is looked at for a few seconds
 * at a time, so this is a tile that changes once while you read the row, not a
 * flicker.
 *
 * It only runs while the drawer is open, as the site's menu only runs while its
 * dropdown is. The drawer is mounted with the navigator for the life of the app,
 * so without that this would be five timers re-rendering a closed menu forever.
 *
 * An absent ministry or one whose window has no placed, transcoded photograph
 * falls back to the glyph, which is what the row would have had anyway.
 */
function Thumb({ covers, open }: { covers: readonly MediaRow[]; open: boolean }) {
  const theme = useTheme();
  const size = 38;

  return (
    <CyclingThumb
      covers={covers}
      size={size}
      running={open}
      fallback={
        <View
          style={{
            width: size,
            height: size,
            borderRadius: theme.radius.sm,
            backgroundColor: theme.color.paperSunken,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="photos" color={theme.color.inkFaint} size={18} />
        </View>
      }
    />
  );
}

/**
 * The longest declared path that the current one is at or inside.
 *
 * Longest rather than first, and that is the whole reason this is a function:
 * `/events` and `/events/summercamp` are both rows, and on the second of them a
 * first-match rule would light up the first. A prefix match is still wanted —
 * `/events/summercamp/2026/day-1` is three levels below its row and that
 * ministry should stay marked all the way down.
 */
function activeAmong(pathname: string, paths: string[]): string | null {
  let best: string | null = null;

  for (const path of paths) {
    if (pathname !== path && !pathname.startsWith(`${path}/`)) continue;
    if (best === null || path.length > best.length) best = path;
  }

  return best;
}

/* -- the account card ------------------------------------------------------ */

/**
 * Who you are signed in as, folded away until you ask.
 *
 * **It was a panel and the panel was too much.** Signed in, it opened to an
 * address wrapped over two lines, a thirteen-chip list of everything the
 * account looks after, and two actions — half the drawer, above the things
 * people actually came to press. Collapsed it is one row: a circle, a name, an
 * address on one line.
 *
 * The account is a **Microsoft** one and the card says so. Sign-in is the
 * church's single Entra tenant and nothing else — no password, no email link,
 * no Google. See `firebase/auth.ts`.
 */
function Account({ go }: { go: (href: Href) => void }) {
  const theme = useTheme();
  const status = useDrawerStatus();
  const { user, isPerson, grants, loading } = useSession();
  const [open, setOpen] = useState(false);

  if (loading) {
    return (
      <Group>
        <Padded>
          <Small color={theme.color.inkSoft}>Checking your account…</Small>
        </Padded>
      </Group>
    );
  }

  if (!isPerson) {
    return (
      <Group>
        <Padded>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
            <Avatar of={null} />
            <View style={{ flex: 1, gap: 2 }}>
              <Small>Not signed in</Small>
              <Label color={theme.color.inkFaint}>Servants and staff</Label>
            </View>
          </View>
          <Small color={theme.color.inkSoft}>
            Sign in with the account the church issued you to see the servants&rsquo; rota and
            anything you have been given to look after. You do not need one to send photographs.
          </Small>
          <View style={{ paddingTop: theme.space.xs }}>
            <Button label="Sign in with church account" onPress={() => go('/sign-in')} />
          </View>
        </Padded>
      </Group>
    );
  }

  return (
    <Group>
      <Identity user={user} expanded={open} onToggle={() => setOpen((was) => !was)} />
      {open ? (
        <>
          <Hairline />
          <Entrusted grants={grants} />
          {/*
            * The one door to Areas, and it is here rather than in a group of
            * its own for the reason the website's is in the account menu:
            * **there is no screen whose contents are "what Marina may
            * administer"**. The subject is a person, so it belongs with the
            * card about who you are, and it is drawn for the superadmin and for
            * nobody else.
            *
            * That is a convenience and not a protection — `SuperadminOnly`
            * refuses to draw the screen, and `firestore.rules` refuses the
            * directory read and the save whatever any client thinks. Hiding the
            * row is so that the twenty servants who cannot use it are not
            * looking at it.
            */}
          {isSuperadmin(grants.claims) ? (
            <>
              <Hairline />
              <Action label="Areas" icon="people" onPress={() => go('/access' as Path)} />
            </>
          ) : null}
          <Hairline />
          <Action
            label="Sign out"
            icon="back"
            danger
            chevron={false}
            onPress={() => void signOut()}
          />
          {/*
            * Keyed on the drawer's open/closed state, which remounts it on
            * every slide and so resets it.
            *
            * A half-finished delete must not be waiting where it was left: the
            * drawer's content stays mounted when it slides away, so otherwise
            * the confirmation — and a ticked superadmin box — is still open the
            * next time anybody opens the menu, with the destructive button one
            * press from a thumb that came here to find Contact. A `key` rather
            * than an effect because resetting state on a change of input is
            * what remounting is for.
            */}
          <DeleteAccount key={status} superadmin={isSuperadmin(grants.claims)} />
        </>
      ) : null}
    </Group>
  );
}

/**
 * The one row the card is when it is closed.
 *
 * `displayName` first and the address under it, because Microsoft supplies a
 * name for every account in the tenant and "Tommy Ghaly" is what somebody
 * recognises as themselves. `numberOfLines` on the address is what keeps this
 * to two lines whatever the local part is — a wrapped address was most of what
 * made the old panel look broken.
 */
function Identity({
  user,
  expanded,
  onToggle,
}: {
  user: User | null;
  expanded: boolean;
  onToggle: () => void;
}) {
  const theme = useTheme();
  const name = user?.displayName?.trim() || user?.email || 'Signed in';
  const second = user?.displayName?.trim() ? user.email : 'Church account';

  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      accessibilityLabel={`${name}. Account options.`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.sm,
        padding: theme.space.md,
        backgroundColor: pressed ? theme.color.paperSunken : 'transparent',
        minHeight: 46,
      })}
    >
      <Avatar of={name} />
      <View style={{ flex: 1, gap: 2 }}>
        <Small numberOfLines={1}>{name}</Small>
        {second ? (
          <Small color={theme.color.inkFaint} numberOfLines={1}>
            {second}
          </Small>
        ) : null}
      </View>
      {/*
        * The chevron turns rather than swapping glyph — `chevron` points down,
        * and a half turn is up. One drawing, and the rotation is what says the
        * card is a disclosure rather than a link.
        */}
      <View style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}>
        <Icon name="chevron" color={theme.color.inkFaint} size={18} />
      </View>
    </Pressable>
  );
}

function Avatar({ of }: { of: string | null }) {
  const theme = useTheme();
  const letter = (of ?? '').trim().charAt(0).toUpperCase();
  const diameter = 38;

  return (
    <View
      style={{
        width: diameter,
        height: diameter,
        borderRadius: Math.min(theme.radius.full, diameter / 2),
        backgroundColor: letter ? theme.color.accent : theme.color.paperSunken,
        // The one gold thing below the masthead. An icon's ground is gilded and
        // so is this, which is a small enough nod to stay on the right side of
        // ornament — and it is what keeps the avatar from reading as a generic
        // coloured circle.
        borderWidth: letter ? 1.5 : 1,
        borderColor: letter ? theme.color.gold : theme.color.rule,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {letter ? (
        <Subheading color={theme.color.inkInverse}>{letter}</Subheading>
      ) : (
        <Icon name="people" color={theme.color.inkSoft} size={18} />
      )}
    </View>
  );
}

function Padded({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return <View style={{ padding: theme.space.md, gap: theme.space.sm }}>{children}</View>;
}

function Hairline() {
  const theme = useTheme();
  return <View style={{ height: 1, backgroundColor: theme.color.rule }} />;
}

/**
 * What this person has been entrusted with, in the church's own vocabulary.
 *
 * As chips rather than as the sentence this used to be. Somebody who looks
 * after everything produced *"You look after: events, bulletin, bookstore,
 * forms, camp, finance, parking, servants, content, theme, members, config,
 * ministry photographs."* — five lines of comma-separated prose that nobody
 * reads and that cannot be scanned for the one area you were looking for.
 *
 * It reads the grants the session already holds — it does not re-derive a
 * permission, and must not start to. It is also only ever a description: the
 * screens are gated by `firestore.rules`, and this list saying "camp" would not
 * open a single document if the member record disagreed.
 */
function Entrusted({ grants }: { grants: Grants }) {
  const theme = useTheme();

  const screens = ADMIN_SCREENS.filter((screen) => mayAdminScreen(grants, screen));
  const programs = hasAnyProgramGrant(grants.claims, grants.programAdmin);
  const areas = [...screens, ...(programs ? ['ministry photographs'] : [])];

  if (areas.length === 0) {
    return (
      <Padded>
        <Small color={theme.color.inkFaint}>You look after nothing in the app yet.</Small>
      </Padded>
    );
  }

  return (
    <Padded>
      <Label color={theme.color.inkFaint}>You look after</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.xs }}>
        {areas.map((area) => (
          <View
            key={area}
            style={{
              backgroundColor: theme.color.paperSunken,
              borderRadius: Math.min(theme.radius.full, 12),
              paddingHorizontal: theme.space.sm,
              paddingVertical: 3,
            }}
          >
            <Label color={theme.color.inkSoft}>{area}</Label>
          </View>
        ))}
      </View>
    </Padded>
  );
}

/**
 * Deleting your own account, behind a confirmation that says what it does.
 *
 * The App Store requires this of anything that supports making an account, and
 * the church already had it on the website — so this is one POST to an endpoint
 * that exists, not a new capability. `session/account.ts` carries what is
 * removed and what deliberately is not.
 *
 * The confirmation is inline rather than an `Alert`, for two reasons. The copy
 * is three sentences and a system dialog truncates; and a superadmin has a
 * checkbox to tick, which a native alert cannot hold.
 *
 * Cancel is first in the row and is the outlined-quiet one. The destructive
 * button is never the default and never the nearest.
 */
function DeleteAccount({ superadmin }: { superadmin: boolean }) {
  const theme = useTheme();

  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);

  // A superadmin's delete is inert until the box is ticked. Nobody else has one.
  const blocked = superadmin && !acknowledged;

  if (!confirming) {
    return (
      <Action
        label="Delete account"
        icon="trash"
        danger
        last
        chevron={false}
        onPress={() => {
          setProblem(null);
          setAcknowledged(false);
          setConfirming(true);
        }}
      />
    );
  }

  async function remove() {
    setBusy(true);
    setProblem(null);
    try {
      await deleteOwnAccount(superadmin);
      /*
       * Nothing to tidy on success. The delete signs out, `onAuthChange` fires,
       * and this whole subtree is replaced by the signed-out card — so there is
       * no `setConfirming(false)` and no `setBusy(false)` outside the catch.
       */
    } catch (error) {
      setProblem(
        error instanceof Error ? error.message : 'The account could not be deleted. Try again.',
      );
      setBusy(false);
    }
  }

  return (
    <View
      style={{
        backgroundColor: theme.color.paperSunken,
        padding: theme.space.md,
        gap: theme.space.xs,
      }}
    >
      <Small color={theme.color.accent}>Delete this account?</Small>
      <Small color={theme.color.inkSoft}>
        Your sign-in and everything you have been given to look after are removed. The account the
        church issued you is not touched, and signing in again will make a new account with no
        areas.
      </Small>

      {superadmin ? (
        <Acknowledge
          checked={acknowledged}
          disabled={busy}
          onChange={(next) => {
            setAcknowledged(next);
            // A stale "confirm the lockout" refusal must not sit under a box
            // that is now ticked.
            setProblem(next ? null : problem);
          }}
        />
      ) : null}

      {problem ? <Small color={theme.color.accent}>{problem}</Small> : null}

      <View style={{ flexDirection: 'row', gap: theme.space.xs, paddingTop: theme.space.xs }}>
        <View style={{ flex: 1 }}>
          <Button
            label="Cancel"
            tone="quiet"
            disabled={busy}
            onPress={() => {
              setConfirming(false);
              setProblem(null);
              setAcknowledged(false);
            }}
          />
        </View>
        <View style={{ flex: 1 }}>
          {/*
            * Disabled rather than hidden while the box is unticked, so the
            * reason stays visible: the button and the sentence that unlocks it
            * are both on screen, and the box is immediately above it.
            */}
          <Button
            label="Delete"
            tone="danger"
            busy={busy}
            disabled={blocked}
            onPress={() => void remove()}
          />
        </View>
      </View>
    </View>
  );
}

/**
 * The superadmin's extra step.
 *
 * The whole row is the target, not the 20pt square — this is a checkbox in a
 * drawer on a phone, and the box alone is not something anybody should have to
 * aim at. The sentence names what is lost that the paragraph above does not
 * cover: not the sign-in, which comes back on the next Microsoft sign-in, but
 * the `superadmin` claim, which comes back only from a terminal.
 */
function Acknowledge({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  onChange: (next: boolean) => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={() => onChange(!checked)}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: theme.space.sm,
        paddingVertical: theme.space.xs,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: theme.radius.sm,
          borderWidth: 1,
          borderColor: checked ? theme.color.accent : theme.color.inkFaint,
          backgroundColor: checked ? theme.color.accent : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {checked ? <Icon name="check" color={theme.color.inkInverse} size={14} /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <Small color={theme.color.inkSoft}>
          This is the superadmin account. The church may be left with nobody able to allocate
          areas, and restoring it needs a developer at a terminal.
        </Small>
      </View>
    </Pressable>
  );
}
