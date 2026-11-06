/**
 * A level's photographs as a justified mosaic — rows of two or three at their
 * own proportions, with a full-width feature every few rows — and a tap on any
 * of them opens the viewer.
 *
 * ## Why this replaced one photograph per row
 *
 * The column was a decision made for a build with no lightbox: a thumbnail
 * nobody can enlarge is a photograph nobody can see, so every cell was the full
 * width of the phone. With sixty pictures from one week of camp that was a
 * twenty-screen scroll with every one of them cropped to a fixed band, and it
 * read as a feed rather than a gallery. Tommy: *"I don't like how the photo
 * layout for the events page looks on mobile."* The viewer is what makes small
 * cells honest again, so the two arrived together.
 *
 * ## Justified, not masonry, because of the order
 *
 * A masonry grid places each photograph in whichever column is shortest, so the
 * eye reads them in an order nobody chose. A justified row is read left to
 * right, top to bottom — exactly the reading order `collapseToColumn` produced
 * from the administrator's canvas — so the arrangement the church made on the
 * website still decides what comes first here.
 *
 * Every row is scaled so its photographs, at their real aspect ratios, exactly
 * fill the page width. The crop that remains is only the clamp on extreme
 * shapes (a panorama, a phone screenshot), and `focal` covers it.
 *
 * ## Why the photographs further down wait their turn
 *
 * The website marks every gallery picture `loading="lazy"`, so a browser fetches
 * the screenful somebody is looking at and the next one, and nothing else. This
 * drew them all at once: a level can hold thousands of photographs (Summer
 * Camp 2025 has 6,193), each a ~900 KB rendition about 2600 pixels wide, and all of them began downloading and
 * decoding the moment the page opened. The ones on screen came in last among
 * equals and the scroll stuttered behind the decoding. Now a row gets its
 * photographs once it is within `AHEAD` screens of the bottom of the view, and
 * the rows below it are one sunken box of exactly their combined height, so
 * nothing moves when they fill and the page is not thousands of empty views.
 *
 * Mounted rows stay mounted. The point is the first screen and the scroll, not
 * a recycler; `expo-image` already decodes at the tile's size rather than the
 * file's.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import type { GalleryTree } from '@spsm/shared';

import { useScroller } from '@/components/Surface';
import { Small } from '@/components/Type';
import { useTheme } from '@/theme/ThemeProvider';

import type { MediaRow, NodeRow, ProgramRow } from './data';
import { Picture } from './Picture';
import { PictureTools } from './PictureTools';
import { Viewer } from './Viewer';

/** One laid-out row: its items and the height they share. */
interface Row {
  items: { media: MediaRow; index: number; width: number }[];
  height: number;
}

/** The space between tiles. Tight on purpose — a mosaic reads as one surface. */
const GAP = 4;

/**
 * How many screens past the bottom of the view a row starts loading.
 *
 * Measured from the top of the page rather than the top of the mosaic, which
 * only ever loads a little early: the mosaic cannot start above the page.
 */
const AHEAD = 1.5;

/**
 * How far down the page, in points, rows should have their photographs by now.
 *
 * Only ever grows, and only re-renders when it has grown by a third of a screen,
 * so a scroll is a handful of renders rather than one a frame.
 */
function useReach(): number {
  const scroller = useScroller();
  const { height: window } = useWindowDimensions();
  const [reach, setReach] = useState(() =>
    scroller ? window * (1 + AHEAD) : Number.POSITIVE_INFINITY,
  );
  const held = useRef(reach);

  useEffect(() => {
    if (!scroller) return;

    const check = () => {
      const view = scroller.viewport.current || window;
      const want = scroller.offset.current + view * (1 + AHEAD);
      if (want > held.current + view / 3) {
        held.current = want;
        setReach(want);
      }
    };

    check();
    return scroller.listen(check);
  }, [scroller, window]);

  return reach;
}

export function Mosaic({
  order,
  program,
  tree,
  onChanged,
}: {
  /** The photographs in reading order. See `Canvas` in the route. */
  order: readonly MediaRow[];
  program: ProgramRow;
  tree: GalleryTree<NodeRow>;
  onChanged: () => void;
}) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [open, setOpen] = useState<number | null>(null);

  const page = width - theme.space.gutter * 2;
  const rows = useMemo(() => justify(order, page), [order, page]);
  const reach = useReach();

  /** Where each row starts, from the top of the mosaic. */
  const tops = useMemo(() => {
    const out: number[] = [];
    for (let at = 0; at < rows.length; at += 1) {
      out.push(at === 0 ? 0 : out[at - 1]! + rows[at - 1]!.height + GAP);
    }
    return out;
  }, [rows]);

  /** How many rows, from the top, have their photographs. Always a prefix. */
  const live = useMemo(() => {
    const first = tops.findIndex((top) => top > reach);
    return first === -1 ? rows.length : first;
  }, [tops, reach, rows.length]);

  const last = rows.at(-1);
  const total = last ? (tops.at(-1) ?? 0) + last.height : 0;

  const photos = order.filter((one) => one.kind !== 'video').length;
  const clips = order.length - photos;

  return (
    <View style={{ gap: theme.space.sm }}>
      <Small color={theme.color.inkFaint}>{countLine(photos, clips)}</Small>

      <View style={{ gap: GAP }}>
        {rows.slice(0, live).map((row) => (
          <View key={row.items[0]?.media.id} style={{ flexDirection: 'row', gap: GAP }}>
            {row.items.map(({ media, index, width: tile }) => (
              <View key={media.id} style={{ width: tile }}>
                <Pressable
                  onPress={() => setOpen(index)}
                  accessibilityRole="imagebutton"
                  accessibilityLabel={`${media.caption || 'Photograph'}, ${index + 1} of ${order.length}. Open larger.`}
                  style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
                >
                  <Picture media={media} height={row.height} />
                </Pressable>
                {/* Over the tile rather than inside the Pressable, so editing a
                    photograph is not also opening it. */}
                <PictureTools
                  media={media}
                  program={program}
                  tree={tree}
                  onChanged={onChanged}
                  compact
                />
              </View>
            ))}
          </View>
        ))}
        {/* Every row not loaded yet, as one box of their combined height, so the
            page is its full length without thousands of empty views in it. */}
        {live < rows.length ? (
          <View
            style={{
              height: total - (tops[live] ?? 0),
              borderRadius: theme.radius.sm,
              backgroundColor: theme.color.paperSunken,
            }}
          />
        ) : null}
      </View>

      <Viewer items={order} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />
    </View>
  );
}

/** "60 photographs", "12 photographs · 3 clips". */
function countLine(photos: number, clips: number): string {
  const parts: string[] = [];
  if (photos > 0) parts.push(`${photos} ${photos === 1 ? 'photograph' : 'photographs'}`);
  if (clips > 0) parts.push(`${clips} ${clips === 1 ? 'clip' : 'clips'}`);
  return parts.join(' · ');
}

/**
 * The reading order cut into justified rows.
 *
 * Greedy and in order: photographs are added to a row at a target height until
 * the row would be wider than the page, and the row is then scaled to fit it
 * exactly. The target grows with the page, so a tablet gets more across rather
 * than enormous tiles.
 *
 * The first photograph, and one every few rows after it, runs the full width on
 * its own when it is landscape — the feature that gives a long page somewhere
 * for the eye to rest. A portrait is never made a feature: at the full width of
 * a phone it is taller than the screen.
 *
 * Between features the target alternates tall and short. A camp's photographs
 * mostly come off one camera at one shape, and a justified layout of identical
 * shapes is just a grid; the alternation is what makes it two-up then three-up.
 */
function justify(order: readonly MediaRow[], page: number): Row[] {
  const base = clamp(page * 0.42, 130, 240);
  const most = page >= 600 ? 5 : 3;
  const rows: Row[] = [];
  let pending: { media: MediaRow; index: number; aspect: number }[] = [];
  let sinceFeature = 0;
  const targetNow = () => (sinceFeature % 2 === 0 ? base : base * 0.68);

  const close = (stretch: boolean) => {
    if (pending.length === 0) return;
    const sum = pending.reduce((total, one) => total + one.aspect, 0);
    const inner = page - GAP * (pending.length - 1);
    const height = stretch ? inner / sum : Math.min(targetNow(), inner / sum);
    rows.push({
      height: Math.round(height),
      items: pending.map((one) => ({ media: one.media, index: one.index, width: one.aspect * height })),
    });
    pending = [];
    sinceFeature += 1;
  };

  order.forEach((media, index) => {
    const aspect = clamp(media.aspect ?? 4 / 3, 0.66, 2.1);

    if (pending.length === 0 && aspect >= 1.2 && (index === 0 || sinceFeature >= 4)) {
      rows.push({
        height: Math.round(page / aspect),
        items: [{ media, index, width: page }],
      });
      sinceFeature = 0;
      return;
    }

    pending.push({ media, index, aspect });
    const sum = pending.reduce((total, one) => total + one.aspect, 0);
    const wide = sum * targetNow() + GAP * (pending.length - 1);
    if (wide >= page || pending.length >= most) close(true);
  });

  /*
   * The last row is stretched only when it is nearly full. Two photographs left
   * over would otherwise be blown up to twice the height of every row above
   * them, which reads as a mistake at the bottom of the page.
   */
  const leftover = pending.reduce((total, one) => total + one.aspect, 0) * targetNow();
  close(leftover >= page * 0.7);

  return rows;
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}
