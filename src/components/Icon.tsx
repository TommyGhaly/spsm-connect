/**
 * The church's icons, ported from the website's `components/Icon.tsx`.
 *
 * Same viewBox, same paths, same 1.6 stroke — because an icon that is a
 * slightly different shape in the app than on the website is exactly the kind
 * of drift `@spsm/shared` exists to prevent, and these are the one part of the
 * look that could not go in there: the website's version returns SVG DOM
 * elements and this one returns `react-native-svg` components. The *geometry*
 * is the shared thing, and it is copied verbatim. If a path changes there,
 * change it here.
 *
 * This is why `react-native-svg` is a dependency. An icon font would be a
 * second set of glyphs to keep in step, and `@expo/vector-icons` would be a
 * third party's drawing of a calendar next to the church's own drawing of one.
 *
 * One difference that is not cosmetic: RN SVG has no `currentColor`, so colour
 * is a prop rather than inherited. Every caller must pass one from the theme —
 * there is no default, deliberately, because a default would be a literal
 * colour and this app does not write those.
 */
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import type { ColorValue } from 'react-native';
import type { ReactElement } from 'react';

/*
 * Stroke and fill are set on the <Svg> once rather than per path, so a glyph
 * that needs to be filled (`grip`) says so on its own element and everything
 * else inherits. `none` for fill is what makes these outlines rather than
 * silhouettes.
 */
const ICONS = {
  /** Service and liturgy times. */
  clock: (
    <>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M12 7.5V12l3 2" />
    </>
  ),
  /** Address, directions. */
  pin: (
    <>
      <Path d="M12 21s7-5.686 7-11a7 7 0 1 0-14 0c0 5.314 7 11 7 11z" />
      <Circle cx="12" cy="10" r="2.5" />
    </>
  ),
  /** Livestream. */
  play: (
    <>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M10 8.5l6 3.5-6 3.5z" />
    </>
  ),
  /** The church calendar. */
  calendar: (
    <>
      <Rect x="3.5" y="5" width="17" height="15" rx="2" />
      <Path d="M3.5 10h17M8.5 3.5v3M15.5 3.5v3" />
    </>
  ),
  /** Giving. */
  gift: (
    <>
      <Rect x="3.5" y="9" width="17" height="11.5" rx="1.5" />
      <Path d="M3.5 13.5h17M12 9v11.5" />
      <Path d="M12 9S10.5 4.5 8 4.5A2 2 0 0 0 8 9zM12 9s1.5-4.5 4-4.5A2 2 0 0 1 16 9z" />
    </>
  ),
  /**
   * Welcome / new here. An open door with an arrow going in.
   *
   * The arrow points *into* the doorway. The same glyph reversed is the
   * near-universal "sign out" icon — the website's note on this is worth
   * keeping, because the mistake is easy to make and says the opposite thing.
   */
  door: (
    <>
      <Path d="M13.5 3.5h5v17h-5" />
      <Path d="M4 12h7M8 8.5L11.5 12L8 15.5" />
    </>
  ),
  /** "See all", "read more". */
  arrow: <Path d="M4.5 12h15M13 5.5l6.5 6.5L13 18.5" />,
  /** Searching the bookstore. */
  search: (
    <>
      <Circle cx="11" cy="11" r="6.5" />
      <Path d="M15.8 15.8L20.5 20.5" />
    </>
  ),
  /** The disclosure marker on a collapsible row. */
  chevron: <Path d="M6 9.5l6 6 6-6" />,
  /** Going back up a level — a gallery to its ministry, a ministry to Events. */
  back: <Path d="M19.5 12h-15M11 5.5L4.5 12l6.5 6.5" />,
  /** Leave the lightbox. */
  close: <Path d="M6 6l12 12M18 6L6 18" />,
  /** Open one photograph full screen. */
  expand: <Path d="M9 4.5H4.5V9M15 4.5h4.5V9M15 19.5h4.5V15M9 19.5H4.5V15" />,
  /** Rename this. */
  pencil: (
    <>
      <Path d="M4.5 19.5h3.2l9.4-9.4-3.2-3.2-9.4 9.4z" />
      <Path d="M14.6 5.6l1.6-1.6a1.6 1.6 0 0 1 2.3 0l1.5 1.5a1.6 1.6 0 0 1 0 2.3l-1.6 1.6z" />
    </>
  ),
  /** A count of photographs, on a gathering card. */
  photos: (
    <>
      <Rect x="3.5" y="6.5" width="14" height="11" rx="1.5" />
      <Path d="M7 6.5V5a1.5 1.5 0 0 1 1.5-1.5h10A1.5 1.5 0 0 1 20 5v10.5" />
      <Path d="M3.5 14l3.5-3 4 3.5 3-2.5 3 3" />
    </>
  ),
  /** A count of clips, beside `photos`. */
  film: (
    <>
      <Rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <Path d="M8 5.5v13M16 5.5v13M3.5 12h17" />
    </>
  ),
  /** Step back through a gallery. */
  prev: <Path d="M14.5 5.5L8 12l6.5 6.5" />,
  /** Step forward through a gallery. */
  next: <Path d="M9.5 5.5L16 12l-6.5 6.5" />,
  /** Add pictures. Deliberately the same weight as `close`. */
  plus: <Path d="M12 5.5v13M5.5 12h13" />,
  /**
   * Delete for good. A bin, deliberately not the ×.
   *
   * The × means "take it off this page, the photograph stays". The one control
   * that really destroys a file may not wear the same mark.
   */
  trash: (
    <>
      <Path d="M4 6.5h16M9.5 6.5V4.5h5v2" />
      <Path d="M6.5 6.5l.9 12.6a1.6 1.6 0 0 0 1.6 1.4h6a1.6 1.6 0 0 0 1.6-1.4l.9-12.6" />
      <Path d="M10 10.5v6.5M14 10.5v6.5" />
    </>
  ),
  /** Chosen — in the picture picker and the approval queue. */
  check: <Path d="M5 12.5l4.5 4.5L19 7.5" />,
  /** A phone number, beside the tel: link on Contact. */
  phone: (
    <Path d="M6.5 3h3l1.5 4-2 1.5a12 12 0 0 0 6.5 6.5l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A17 17 0 0 1 4.5 5.2 2 2 0 0 1 6.5 3z" />
  ),
  /** Writing to the church. An open flap, not a sealed one. */
  mail: (
    <>
      <Rect x="3" y="5" width="18" height="14" rx="2" />
      <Path d="M3.5 6.5l8.5 6 8.5-6" />
    </>
  ),
  /** The week's announcements — the notices, not the schedule. */
  megaphone: (
    <>
      <Path d="M4 10v4a1 1 0 0 0 1 1h3.5L17 19V5L8.5 9H5a1 1 0 0 0-1 1z" />
      <Path d="M8.5 15v3a1.5 1.5 0 0 0 3 0v-2.3" />
      <Path d="M20 9.5v5" />
    </>
  ),
  /** A form or a document. */
  file: (
    <>
      <Path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <Path d="M14 3v5h5" />
      <Path d="M9 13h6M9 17h4" />
    </>
  ),
  /**
   * This can be picked up and carried. Two columns of dots.
   *
   * Filled circles rather than stroked paths: at this size, six zero-length
   * round-capped strokes come out about a pixel across — present in the tree
   * and invisible on the screen.
   */
  grip: (
    <G fill="currentColor" stroke="none">
      <Circle cx="9" cy="6" r="1.5" />
      <Circle cx="15" cy="6" r="1.5" />
      <Circle cx="9" cy="12" r="1.5" />
      <Circle cx="15" cy="12" r="1.5" />
      <Circle cx="9" cy="18" r="1.5" />
      <Circle cx="15" cy="18" r="1.5" />
    </G>
  ),

  /* ---- native only --------------------------------------------------------
   *
   * The glyphs below have no counterpart in the website's set, and that is not
   * an omission to be corrected there. The first three name an affordance a web
   * page does not have: a tab bar's centre action, a tab for the shop, and the
   * button that opens a drawer. The rest name *subjects* — the church, the
   * congregation, the faith, a saint — that the website prints as plain text
   * links in a nav bar and this app has to fit in a 32pt tile. There is nothing
   * for any of them to drift from, so the rule at the top of this file — copy
   * the geometry, change both together — does not bite. Anything that *does*
   * appear on both must still be copied verbatim, and if the website ever draws
   * one of these, the copy goes the other way: paths from here to there.
   * ---------------------------------------------------------------------- */

  /** The centre button. Sending a photograph is what this app is for. */
  camera: (
    <>
      <Path d="M3.5 8.5A1.5 1.5 0 0 1 5 7h2.2l1.3-2h7l1.3 2H19a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5z" />
      <Circle cx="12" cy="12.5" r="3.5" />
    </>
  ),
  /**
   * The flash, lit. A bolt, because every camera on earth draws one.
   *
   * Not on the website and not expected to be — see the note above about the
   * glyphs this app draws alone.
   */
  flash: <Path d="M13 2.5L5.5 13.5H11l-1 8 7.5-11H12z" />,
  /** The flash, off. The same bolt, struck through. */
  flashOff: (
    <>
      <Path d="M13 2.5L5.5 13.5H11l-1 8 7.5-11H12z" />
      <Path d="M4 4l16 16" />
    </>
  ),
  /**
   * Swap which camera is looking.
   *
   * Two arcs chasing each other with a head on each, rather than a phone with
   * arrows around it: the second reads as "rotate the screen" at 20pt.
   */
  flip: (
    <>
      <Path d="M20 12a8 8 0 0 1-8 8 8 8 0 0 1-6.93-4" />
      <Path d="M4 12a8 8 0 0 1 8-8 8 8 0 0 1 6.93 4" />
      <Path d="M19 4v4h-4" />
      <Path d="M5 20v-4h4" />
    </>
  ),
  /** The bookstore. A shop bag rather than a trolley — the church sells books. */
  bag: (
    <>
      <Path d="M5 7.5h14l-1 12H6z" />
      <Path d="M9 10V6.5a3 3 0 0 1 6 0V10" />
    </>
  ),
  /**
   * The church itself. An arch under a cross, with a door in it.
   *
   * The arch is the seal's own shape — see scripts/make-icons.mjs, which spends
   * a paragraph on the fact that the seal is an arch and that its corners are
   * empty because of it. A generic steepled church would be a different
   * building; this is the one on the masthead, reduced to four strokes.
   */
  church: (
    <>
      <Path d="M4 20.5h16" />
      <Path d="M6.5 20.5V11a5.5 5.5 0 0 1 11 0v9.5" />
      <Path d="M12 5.5V2M10.3 3.4h3.4" />
      <Path d="M10 20.5v-4.5a2 2 0 0 1 4 0v4.5" />
    </>
  ),
  /** The congregation — "who we are". Two figures, the second behind. */
  people: (
    <>
      <Circle cx="9.5" cy="8" r="3.2" />
      <Path d="M3.5 19.5a6 6 0 0 1 12 0" />
      <Path d="M16.5 5.3a3.2 3.2 0 0 1 0 5.4" />
      <Path d="M17.5 13.9a6 6 0 0 1 3 5.6" />
    </>
  ),
  /**
   * What the church believes. A processional cross, bar set high.
   *
   * High rather than centred: an equal-armed cross at this weight reads as a
   * plus sign, which is `plus`, which in this app means "add pictures".
   */
  cross: <Path d="M12 3v18M5.5 9h13" />,
  /**
   * A saint. A halo above a head and shoulders.
   *
   * **This was two concentric circles** — a halo ring with the head inside it —
   * and at 20pt it read as a dot in a circle, which is a user avatar and not a
   * saint. The gap between r=4.5 and r=2.3 is 2.2 units, and 1.6 of stroke
   * either side closes it.
   *
   * A disc seen edge-on was the next attempt and was worse: `ry` of 1.6 units
   * is 1.3pt at this size, which is less than the stroke drawn around it, so
   * the halo rendered as a solid dot sitting on the head.
   *
   * What works is an arc, and it has to be a deep one. Struck on a radius of
   * 8 against a chord of 10 it rises only 1.8 units, which at 20pt is a line
   * over the head — an eyebrow, or the brim of a hat. A radius of 6 against a
   * chord of 11 rises 3.6 and reads as a ring seen from below, which is what
   * it is. The three pieces must not touch: the arc crests at 2.9 and ends at
   * 6.5, the head spans 7.6 to 13.4, and the shoulders crest at 14.
   */
  saint: (
    <>
      <Path d="M6.5 6.5a6 6 0 0 1 11 0" />
      <Circle cx="12" cy="10.5" r="2.9" />
      <Path d="M5.5 20.5a6.5 6.5 0 0 1 13 0" />
    </>
  ),
  /**
   * Somebody new. A person with a plus beside them.
   *
   * Not `door`, which was here and is the website's welcome glyph: an arrow
   * going into a doorway is the near-universal *sign out* mark, and at this
   * size in a list that is what it reads as. The plus is the one addition
   * everybody already parses as "a new one of these".
   */
  newcomer: (
    <>
      <Circle cx="9.5" cy="8" r="3.3" />
      <Path d="M3 19.5a6.5 6.5 0 0 1 13 0" />
      <Path d="M18.5 8v5M16 10.5h5" />
    </>
  ),
  /**
   * What is being built next. An arch drawn on a sheet.
   *
   * Two earlier attempts are worth recording because both are the obvious ones.
   * A church *and* a plus put the plus in the corner at a third of the height,
   * where it reads as a superscript and the arch beside it reads as a bell. A
   * full blueprint — sheet, baseline, elevation, spire — is four shapes inside
   * 20pt and they merge into a smudge.
   *
   * A sheet with one arch rising off its bottom edge is two shapes, and the
   * frame is what turns the arch from a building into a *drawing* of one.
   */
  plans: (
    <>
      <Rect x="3" y="4" width="18" height="16" rx="2" />
      <Path d="M8.5 20v-6a3.5 3.5 0 0 1 7 0v6" />
    </>
  ),
  /**
   * The church's other apps. Four tiles.
   *
   * Not `grip`, which was here: two columns of dots is a drag handle, and this
   * app already uses it as one. A 2×2 of rounded squares is the launcher grid
   * every phone draws, and it means "apps" and nothing else.
   */
  apps: (
    <>
      <Rect x="4" y="4" width="6.5" height="6.5" rx="1.6" />
      <Rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6" />
      <Rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6" />
      <Rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6" />
    </>
  ),
  /**
   * Privacy. A padlock, shackle closed.
   *
   * Not `file`, which was here and says only "a document" — which is true of
   * the privacy notice and true of eleven other screens. The padlock is the one
   * mark that names the subject rather than the format.
   */
  lock: (
    <>
      <Rect x="4.5" y="10" width="15" height="10.5" rx="2" />
      <Path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  /** Opens the drawer. Three rules, the one shape nobody has to be taught. */
  menu: <Path d="M4 7h16M4 12h16M4 17h16" />,

  /**
   * The week's notices, waiting to be read.
   *
   * A bell rather than the `megaphone` the website puts over the same list, and
   * the difference is the surface rather than a drift. On the homepage the
   * announcements are *already on screen* and the glyph is a heading ornament;
   * here they are folded away behind a control in the corner, and the one mark
   * a phone has taught everybody to read as "there is something to open" is the
   * bell. A megaphone in a tab bar's corner reads as "broadcast", which is what
   * the church is doing, not what the reader is being offered.
   *
   * The clapper is a separate path so it keeps the 1.6 stroke rather than
   * becoming a filled dot at small sizes.
   */
  bell: (
    <>
      <Path d="M6.5 9.5a5.5 5.5 0 0 1 11 0c0 4 1.5 5.5 1.5 5.5H5s1.5-1.5 1.5-5.5z" />
      <Path d="M10 18a2 2 0 0 0 4 0" />
    </>
  ),
} satisfies Record<string, ReactElement>;

export type IconName = keyof typeof ICONS;

/**
 * Whether a string names an icon that exists.
 *
 * Icon names are not all written by hand — a form card carries whichever name
 * is on its Firestore document, chosen by staff. An unknown name renders an
 * empty square with nothing anywhere to explain it, so callers reading a name
 * from data must narrow through this and fall back.
 */
export function isIconName(name: string): name is IconName {
  return Object.prototype.hasOwnProperty.call(ICONS, name);
}

export function Icon({
  name,
  size = 20,
  color,
}: {
  name: IconName;
  size?: number;
  /**
   * From the theme. There is no default; see the note at the top of this file.
   *
   * `ColorValue` rather than `string` because React Navigation hands its tab
   * icons one — a platform colour is an opaque object on iOS, not a hex string,
   * and narrowing this to `string` would mean every tab icon needs a cast.
   */
  color: ColorValue;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      // 1.6 rather than a round number, for the reason the website gives: at
      // 20pt, 1.5 reads light beside a 400-weight label and 2 reads heavy.
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      // The filled glyphs say `fill="currentColor"`, which RN SVG resolves
      // against this rather than against a CSS cascade that does not exist.
      color={color}
    >
      {ICONS[name]}
    </Svg>
  );
}
