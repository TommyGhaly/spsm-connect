/**
 * The parish's icons, ported from the website's `components/Icon.tsx`.
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
 * third party's drawing of a calendar next to the parish's own drawing of one.
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
  /** The parish calendar. */
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
  /** Writing to the parish. An open flap, not a sealed one. */
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
