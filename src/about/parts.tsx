/**
 * The pieces the five About screens are built from.
 *
 * ---------------------------------------------------------------------------
 * The website builds these pages out of full-bleed *bands* — a section with a
 * ground colour, alternating down the page so that something nine sections
 * long reads as nine things rather than one column of beige. That device is
 * worth keeping on a phone, where a page of this length is otherwise an
 * undifferentiated scroll, and it is the reason none of these screens uses
 * `components/Surface`'s `Screen`: that applies the gutter to the whole page,
 * and a band has to reach both edges and pad its own contents.
 *
 * ## Everything here takes a slot id, and that is the important part
 *
 * `band`, `slot` and `captionSlot` are the website's own slot ids, from
 * `features/about/slots.ts` in that repo. Passing one is what makes a piece of
 * text live: `Head band="what-copt-means"` reads `what-copt-means.h2` out of
 * the override document and falls back to the words passed to it. See
 * `overrides.tsx`. An id that does not exist in the manifest is not an error —
 * nothing can ever write to it — but it is dead weight, so keep them honest.
 *
 * Read-only throughout. There is no `Editable`, no long-press to edit and no
 * write path anywhere in this app.
 * ---------------------------------------------------------------------------
 */
import { useState, type ReactNode } from 'react';
import { Linking, Modal, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AboutGround, AboutSection } from '@spsm/shared';

import { Icon } from '@/components/Icon';
import { Body, Heading, Label, Small, Subheading, Title } from '@/components/Type';
import { Rich } from './Rich';
import { ABOUT_PAGES, type AboutSlug } from './pages';
import { plateOf, paragraphsOf, textOf, useAboutSections, useAboutSlots } from './overrides';
import { siteUrl } from './media';
import { useTheme } from '@/theme/ThemeProvider';

/* ── The page, and its bands ─────────────────────────────────────────────── */

/**
 * The scrolling page a whole About screen is.
 *
 * No gutter and no gap: a band supplies both for its own contents, because the
 * ground has to run edge to edge behind them.
 *
 * `header` is drawn *outside* the scroller, pinned — the tour's passport strip
 * is the only thing that uses it, and it is the web page's `position: sticky`
 * strip. `onScroll`/`onLayout` are there for the same screen's stamp tripwire
 * and are inert for the other four.
 */
export function Bands({
  children,
  header,
  onScroll,
  onViewport,
}: {
  children: ReactNode;
  header?: ReactNode;
  onScroll?: (y: number) => void;
  onViewport?: (height: number) => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.paper }}>
      {header}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        scrollEventThrottle={64}
        onScroll={onScroll ? (event) => onScroll(event.nativeEvent.contentOffset.y) : undefined}
        onLayout={onViewport ? (event) => onViewport(event.nativeEvent.layout.height) : undefined}
      >
        {children}
      </ScrollView>
    </View>
  );
}

/**
 * The four grounds, named as the website's stylesheet names them — and as
 * `ABOUT_GROUNDS` in `@spsm/shared` names them, which is what lets a section
 * staff appended arrive carrying its own.
 *
 * `tinted` is the third ground and is used at most twice on a page, always for
 * the one thing a reader scrolling fast should stop at — the Creed, the area
 * schedule. Spending it on an ordinary section is how it stops working.
 *
 * The website mixes its tint live — `color-mix(accent 7%, transparent)` over
 * paper — which React Native has no equivalent of. `accentSoft` is the token
 * nearest that mix (they agree to within a couple of points per channel), and
 * taking the token is right regardless: a literal colour here would be a value
 * the church cannot change from `config/theme`.
 */
export type Ground = 'paper' | 'sunken' | 'tinted' | 'deep';

/** `plain` is the shared schema's name for what this file calls `paper`. */
export function groundOf(ground: AboutGround): Ground {
  return ground === 'plain' ? 'paper' : ground;
}

export function Band({
  ground = 'paper',
  children,
  gap,
  onLayout,
}: {
  ground?: Ground;
  children: ReactNode;
  gap?: number;
  onLayout?: (top: number, height: number) => void;
}) {
  const theme = useTheme();

  const background =
    ground === 'deep'
      ? theme.color.deep
      : ground === 'sunken'
        ? theme.color.paperSunken
        : ground === 'tinted'
          ? theme.color.accentSoft
          : theme.color.paper;

  return (
    <View
      // A band is a direct child of the scroller's content container, so the
      // `y` here is already the offset the stamp tripwire needs. Nothing
      // measures against a parent, which is what makes this one line rather
      // than a `measureLayout` dance.
      onLayout={
        onLayout
          ? (event) => onLayout(event.nativeEvent.layout.y, event.nativeEvent.layout.height)
          : undefined
      }
      style={{
        backgroundColor: background,
        paddingHorizontal: theme.space.gutter,
        paddingVertical: theme.space.xl,
        gap: gap ?? theme.space.md,
      }}
    >
      {children}
    </View>
  );
}

/** Ink that reads on whichever ground it is standing on. */
export function inkOn(ground: Ground, theme: ReturnType<typeof useTheme>) {
  return ground === 'deep' ? theme.color.inkInverse : theme.color.ink;
}

/* ── Headings ────────────────────────────────────────────────────────────── */

/**
 * The opening band of a page: eyebrow, title, standfirst, on the deep ground.
 *
 * The title is a `Title` and not a `Display` for the reason the website makes
 * it a `p` rather than a second `h1`: the navigator has already put the page's
 * name in the header bar, and a full-bleed display line under it is the same
 * words twice at two sizes.
 */
export function Hero({
  band,
  eyebrow,
  title,
  lede,
}: {
  /** The website's band id — `who-hero`, `belief-hero`, `tour-hero`. */
  band: string;
  eyebrow: string;
  title: string;
  lede: string;
}) {
  const theme = useTheme();
  const slots = useAboutSlots();

  return (
    <Band ground="deep" gap={theme.space.sm}>
      <Label color={theme.color.gold}>{textOf(slots, `${band}.eyebrow`, eyebrow)}</Label>
      <Title color={theme.color.inkInverse}>{textOf(slots, `${band}.title`, title)}</Title>
      <Rich color={theme.color.goldSoft}>{textOf(slots, `${band}.lede`, lede)}</Rich>
    </Band>
  );
}

/** A section head — the eyebrow, the heading, and the line under it. */
export function Head({
  band,
  eyebrow,
  title,
  lede,
  note,
  ground = 'paper',
}: {
  /**
   * The website's band id, when this heading is one the website declares slots
   * for. Left off where it does not — the Latin heading on Our Belief is a
   * plain `h2` over there, not an `Editable`, and looking up a slot nobody can
   * write is dead weight that reads as if it were live.
   */
  band?: string;
  eyebrow?: string;
  title: string;
  lede?: string;
  note?: string;
  ground?: Ground;
}) {
  const theme = useTheme();
  const slots = useAboutSlots();
  const ink = inkOn(ground, theme);

  return (
    <View style={{ gap: theme.space.xs }}>
      {eyebrow ? (
        <Label color={theme.color.accent}>
          {textOf(slots, band && `${band}.eyebrow`, eyebrow)}
        </Label>
      ) : null}
      <Heading color={ink}>{textOf(slots, band && `${band}.h2`, title)}</Heading>
      {note ? (
        <Small color={theme.color.inkSoft}>{textOf(slots, band && `${band}.note`, note)}</Small>
      ) : null}
      {lede ? (
        <Rich color={theme.color.inkSoft}>{textOf(slots, band && `${band}.lede`, lede)}</Rich>
      ) : null}
    </View>
  );
}

/** A heading inside a section — the website's `h3`. Not an overridable slot. */
export function Subhead({ children }: { children: string }) {
  const theme = useTheme();
  return (
    <View style={{ paddingTop: theme.space.xs }}>
      <Subheading>{children}</Subheading>
    </View>
  );
}

/* ── Prose ───────────────────────────────────────────────────────────────── */

/**
 * A run of paragraphs.
 *
 * One string per paragraph, in the website's markup — see `Rich`. An override
 * arrives as one markdown string and is split back into paragraphs on the
 * blank line; see `paragraphsOf`.
 */
export function Prose({
  children,
  slot,
  color,
}: {
  children: readonly string[];
  slot?: string;
  color?: string;
}) {
  const theme = useTheme();
  const slots = useAboutSlots();

  return (
    <View style={{ gap: theme.space.md }}>
      {paragraphsOf(slots, slot, children).map((paragraph, at) => (
        <Rich key={at} color={color}>
          {paragraph}
        </Rich>
      ))}
    </View>
  );
}

/**
 * A pulled-out line: the website's `.note` and `.tour-quote`.
 *
 * A rule down the left rather than a box, because a box inside a band is a
 * card and these are asides within the prose, not things lifted out of it.
 */
export function Aside({ children, slot }: { children: string; slot?: string }) {
  const theme = useTheme();
  const slots = useAboutSlots();

  return (
    <View
      style={{
        borderLeftWidth: 2,
        borderLeftColor: theme.color.gold,
        paddingLeft: theme.space.md,
      }}
    >
      <Rich color={theme.color.inkSoft}>{textOf(slots, slot, children)}</Rich>
    </View>
  );
}

/* ── Pictures ────────────────────────────────────────────────────────────── */

export type PictureMeta = {
  alt: string;
  caption: string;
  width: number;
  height: number;
};

/**
 * One plate: the picture, and the line under it.
 *
 * `aspectRatio` from the file's real dimensions, so the caption does not jump
 * down the screen when the image lands. The website's `width`/`height` are on
 * every picture for the same reason, and are ported with them.
 *
 * `alt` becomes the accessibility label. It is *not* the caption, and the two
 * are never merged: the alt text says what is in the frame for somebody who
 * cannot see it, the caption says why the picture is on the page and is read
 * by everyone.
 */
export function Plate({
  source,
  meta,
  slot,
  captionSlot,
  openable = false,
  ground = 'paper',
}: {
  source: string;
  meta: PictureMeta;
  /** Replaces the photograph. */
  slot?: string;
  /** Replaces only the line under it, which is the commoner edit. */
  captionSlot?: string;
  /**
   * Tap to open it full screen. The website marks the two filed sheets on
   * Future Plans this way; a drawing at column width is a grey rectangle.
   */
  openable?: boolean;
  ground?: Ground;
}) {
  const theme = useTheme();
  const slots = useAboutSlots();
  const [open, setOpen] = useState(false);
  const shown = plateOf(slots, { source, meta }, slot, captionSlot);

  const picture = (
    <Image
      source={shown.source}
      alt={shown.meta.alt}
      contentFit="cover"
      transition={200}
      style={{
        width: '100%',
        aspectRatio: shown.meta.width / shown.meta.height,
        borderRadius: theme.radius.md,
        backgroundColor: ground === 'deep' ? theme.color.ink : theme.color.paperSunken,
      }}
    />
  );

  return (
    <View style={{ gap: theme.space.xs }}>
      {openable ? (
        <Pressable
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`${shown.meta.alt} — open the full sheet`}
        >
          {picture}
        </Pressable>
      ) : (
        picture
      )}
      <Small color={ground === 'deep' ? theme.color.goldSoft : theme.color.inkSoft}>
        {shown.meta.caption}
      </Small>
      {/*
        The control beside the caption, and its words describe what it does —
        never the caption's. The website opens the 1600px sheet in a new tab;
        here it opens full screen, which is the same errand on a phone.
      */}
      {openable ? (
        <>
          <Pressable
            onPress={() => setOpen(true)}
            accessibilityRole="button"
            style={{ minHeight: 44, justifyContent: 'center' }}
          >
            <Small color={theme.color.accent}>Open the full sheet</Small>
          </Pressable>
          <Lightbox shown={open ? shown : null} onClose={() => setOpen(false)} />
        </>
      ) : null}
    </View>
  );
}

/**
 * One picture, full screen.
 *
 * The website's galleries open a `<dialog>` — "open larger" is on every tile —
 * and the two sheet drawings on Future Plans are marked `openable` for the
 * same reason: a site plan at column width is a grey rectangle. On a phone the
 * need is sharper, because a tile in a strip is 240pt across.
 *
 * `contentFit="contain"` and the picture's own aspect ratio, so a tall icon
 * and a wide site plan both arrive whole rather than cropped to the screen.
 */
function Lightbox({
  shown,
  onClose,
}: {
  shown: { source: string; meta: PictureMeta } | null;
  onClose: () => void;
}) {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={shown !== null}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      // Android's back button closes it; `onRequestClose` is what carries that.
      statusBarTranslucent
    >
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close the picture"
        style={{
          flex: 1,
          backgroundColor: theme.color.ink,
          justifyContent: 'center',
          paddingHorizontal: theme.space.md,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          gap: theme.space.md,
        }}
      >
        {shown ? (
          <>
            <Image
              source={shown.source}
              alt={shown.meta.alt}
              contentFit="contain"
              transition={150}
              style={{
                width: width - theme.space.md * 2,
                height: Math.min(
                  height * 0.7,
                  ((width - theme.space.md * 2) * shown.meta.height) / shown.meta.width,
                ),
              }}
            />
            <Small color={theme.color.inkInverse}>{shown.meta.caption}</Small>
            <Small color={theme.color.goldSoft}>Tap anywhere to close</Small>
          </>
        ) : null}
      </Pressable>
    </Modal>
  );
}

/**
 * A row of small pictures, for the sets that are evidence rather than
 * illustration — the iconography grid, a station's gallery.
 *
 * A horizontal strip rather than a grid: three or four plates stacked at full
 * width would be most of the screen for the least reason, and a phone reader
 * swipes a strip without thinking about it.
 */
export function Strip({
  items,
  /** The larger file to open, when the tile is a crop of a bigger one. */
  full,
}: {
  items: readonly { source: string; meta: PictureMeta; captionSlot?: string }[];
  full?: (source: string) => string;
}) {
  const theme = useTheme();
  const slots = useAboutSlots();
  const [open, setOpen] = useState<number | null>(null);

  const shown =
    open === null || items[open] === undefined
      ? null
      : {
          source: full ? full(items[open].source) : items[open].source,
          meta: {
            ...items[open].meta,
            caption: textOf(slots, items[open].captionSlot, items[open].meta.caption),
          },
        };

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: theme.space.md, paddingRight: theme.space.gutter }}
      >
        {items.map((item, at) => (
          <Pressable
            key={item.source}
            onPress={() => setOpen(at)}
            accessibilityRole="button"
            accessibilityLabel={`${item.meta.alt} — open larger`}
            style={{ width: 240, gap: theme.space.xs }}
          >
            <Image
              source={item.source}
              alt={item.meta.alt}
              contentFit="cover"
              transition={200}
              style={{
                width: 240,
                height: 180,
                borderRadius: theme.radius.sm,
                backgroundColor: theme.color.paperSunken,
              }}
            />
            <Small color={theme.color.inkSoft}>
              {textOf(slots, item.captionSlot, item.meta.caption)}
            </Small>
          </Pressable>
        ))}
      </ScrollView>

      <Lightbox shown={shown} onClose={() => setOpen(null)} />
    </>
  );
}

/* ── Structured runs ─────────────────────────────────────────────────────── */

/**
 * A dated spine — the two chronologies on Who We Are, and the progress list on
 * Future Plans.
 *
 * `when` is printed verbatim and is a label rather than a date: "c. 43", "the
 * 1960s" and "Next" all appear, because the sources are that precise and no
 * more.
 *
 * `slotPrefix` and `parts` reproduce the website's own ids for these rows —
 * `in-egypt.moment-3-term` and `where-it-stands.step-6-what` — so a date
 * corrected on the website is corrected here.
 */
export function Spine({
  moments,
  slotPrefix,
  parts = ['term', 'detail'],
  ground = 'paper',
}: {
  moments: readonly { when: string; what: string }[];
  slotPrefix?: string;
  parts?: readonly [string, string];
  ground?: Ground;
}) {
  const theme = useTheme();
  const slots = useAboutSlots();

  return (
    <View style={{ gap: theme.space.md }}>
      {moments.map((moment, at) => (
        <View
          key={`${at}-${moment.when}`}
          style={{
            borderLeftWidth: 2,
            borderLeftColor: theme.color.gold,
            paddingLeft: theme.space.md,
            gap: 2,
          }}
        >
          <Label color={theme.color.accent}>
            {textOf(slots, slotPrefix && `${slotPrefix}-${at}-${parts[0]}`, moment.when)}
          </Label>
          <Rich color={inkOn(ground, theme)}>
            {textOf(slots, slotPrefix && `${slotPrefix}-${at}-${parts[1]}`, moment.what)}
          </Rich>
        </View>
      ))}
    </View>
  );
}

export type Row = {
  left: string;
  right: string;
  note?: string;
  leftSlot?: string;
  rightSlot?: string;
  noteSlot?: string;
};

/** Two columns of short rows — the area schedule, the feast days. */
export function Rows({ rows, ground = 'paper' }: { rows: readonly Row[]; ground?: Ground }) {
  const theme = useTheme();
  const slots = useAboutSlots();
  const ink = inkOn(ground, theme);

  return (
    <View style={{ gap: theme.space.sm }}>
      {rows.map((row, at) => (
        <View
          key={`${at}-${row.left}`}
          style={{
            gap: 2,
            paddingBottom: theme.space.sm,
            borderBottomWidth: at === rows.length - 1 ? 0 : 1,
            borderBottomColor: theme.color.rule,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: theme.space.sm }}>
            <View style={{ flex: 1 }}>
              <Body color={ink}>{textOf(slots, row.leftSlot, row.left)}</Body>
            </View>
            <Small color={theme.color.accent}>{textOf(slots, row.rightSlot, row.right)}</Small>
          </View>
          {row.note !== undefined ? (
            <Small color={theme.color.inkSoft}>{textOf(slots, row.noteSlot, row.note)}</Small>
          ) : null}
        </View>
      ))}
    </View>
  );
}

/**
 * The four headline numbers on Future Plans.
 *
 * No slots, and that is the website's decision rather than an omission here:
 * every one of these is read off a schedule in the filed drawings, and a
 * figure a volunteer can retype is a figure that will eventually disagree with
 * the drawing it came from.
 */
export function Figures({
  figures,
}: {
  figures: readonly { value: string; label: string; note: string }[];
}) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.space.md }}>
      {figures.map((figure) => (
        <View
          key={figure.label + figure.value}
          style={{
            backgroundColor: theme.color.paperRaised,
            borderColor: theme.color.rule,
            borderWidth: 1,
            borderRadius: theme.radius.md,
            padding: theme.space.md,
            gap: 2,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: theme.space.xs }}>
            <Title color={theme.color.accent}>{figure.value}</Title>
            <Label>{figure.label}</Label>
          </View>
          <Small color={theme.color.inkSoft}>{figure.note}</Small>
        </View>
      ))}
    </View>
  );
}

/* ── Disclosure ──────────────────────────────────────────────────────────── */

/**
 * A fold: a row you press to open.
 *
 * The tour is built from these on the website — six stations of disclosures a
 * visitor opens while standing in front of the thing being described — and the
 * pattern carries over unchanged.
 *
 * Shut by default, always. A page of folds that open themselves is a page with
 * no folds on it.
 */
export function Fold({
  label,
  aside,
  children,
  ground = 'paper',
}: {
  label: string;
  aside?: string;
  children: ReactNode;
  ground?: Ground;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const ink = inkOn(ground, theme);

  return (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: theme.color.rule,
        paddingTop: theme.space.sm,
      }}
    >
      <Pressable
        onPress={() => setOpen((was) => !was)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space.sm,
          // 44pt is Apple's minimum target, and these are pressed standing up.
          minHeight: 44,
        }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Body color={ink}>{label}</Body>
          {aside ? <Label>{aside}</Label> : null}
        </View>
        <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
          <Icon name="chevron" size={18} color={theme.color.accent} />
        </View>
      </Pressable>

      {open ? (
        <View style={{ paddingBottom: theme.space.md, gap: theme.space.md }}>{children}</View>
      ) : null}
    </View>
  );
}

/* ── Sections staff have appended ────────────────────────────────────────── */

/**
 * Bands staff added at the foot of a page, from `aboutOverrides/{slug}`.
 *
 * Three kinds and no more — prose, prose with a photograph, a list of terms —
 * which is the shared schema's vocabulary and its argument: the person using
 * this is a volunteer a few times a year, and a vocabulary they choose from
 * cannot produce something broken where a free canvas can.
 *
 * Each carries its own ground, which is why `ABOUT_GROUNDS` is named rather
 * than coloured in the schema: "this app has no CSS, and `'sunken'` is a key
 * it can map where `#f4efe7` is noise." This is that map.
 */
export function AboutSections() {
  const theme = useTheme();
  const sections = useAboutSections();

  return (
    <>
      {sections.map((section: AboutSection) => {
        const ground = groundOf(section.ground);
        const body = section.kind === 'list' ? [] : section.body.split(/\n\s*\n/);

        return (
          <Band key={section.id} ground={ground}>
            <View style={{ gap: theme.space.xs }}>
              {section.eyebrow ? (
                <Label color={theme.color.accent}>{section.eyebrow}</Label>
              ) : null}
              {section.heading ? (
                <Heading color={inkOn(ground, theme)}>{section.heading}</Heading>
              ) : null}
            </View>

            {section.kind === 'picture' ? (
              <Plate
                source={
                  section.image.src.startsWith('http')
                    ? section.image.src
                    : siteUrl(section.image.src)
                }
                ground={ground}
                meta={{
                  alt: section.image.alt ?? section.heading,
                  caption: section.image.caption ?? '',
                  // A photograph somebody uploaded may have no dimensions on
                  // it. 3:2 is the shape of most of what the picker offers,
                  // and a wrong guess costs a reflow rather than a wrong crop.
                  width: section.image.width ?? 3,
                  height: section.image.height ?? 2,
                }}
              />
            ) : null}

            {section.kind === 'list' ? (
              <Rows
                ground={ground}
                rows={section.items.map((item) => ({ left: item.term, right: '', note: item.detail }))}
              />
            ) : (
              <Prose color={ground === 'deep' ? theme.color.inkInverse : undefined}>{body}</Prose>
            )}
          </Band>
        );
      })}
    </>
  );
}

/* ── The foot of every page ──────────────────────────────────────────────── */

/**
 * The other four parts of About, at the foot of each of them.
 *
 * The website ends every one of the five this way, and the reason given there
 * holds here: a reader who has finished a page wants a way onward, and the
 * other four with the ledes they already have is that without being a pitch.
 */
export function MoreOfAbout({ current }: { current: AboutSlug }) {
  const theme = useTheme();
  const router = useRouter();
  const rest = ABOUT_PAGES.filter((page) => page.slug !== current);

  return (
    <Band ground="sunken">
      <Label>More of About</Label>
      <View style={{ gap: theme.space.sm }}>
        {rest.map((page) => (
          <Pressable
            key={page.slug}
            onPress={() => router.push(`/about/${page.slug}`)}
            accessibilityRole="button"
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.space.md,
              backgroundColor: pressed ? theme.color.accentSoft : theme.color.paperRaised,
              borderColor: theme.color.rule,
              borderWidth: 1,
              borderRadius: theme.radius.md,
              padding: theme.space.md,
              minHeight: 44,
            })}
          >
            <Icon name={page.icon} size={22} color={theme.color.accent} />
            <View style={{ flex: 1, gap: 2 }}>
              <Body>{page.label}</Body>
              <Small color={theme.color.inkSoft}>{page.lede}</Small>
            </View>
            <Icon name="next" size={18} color={theme.color.inkFaint} />
          </Pressable>
        ))}
      </View>
    </Band>
  );
}

/**
 * Where the pictures on the five pages came from, and under what licence.
 *
 * ---------------------------------------------------------------------------
 * **All of them, on the About index, and nowhere else** — which is where the
 * website keeps them too: one drawer on `/about` holding every set, rather
 * than a list at the foot of each page. Tommy asked for it there.
 *
 * It cannot be dropped. Several of these are CC BY or CC BY-SA, which oblige
 * the church to name the author and the licence *wherever the picture is
 * published*, and an app screen is a publication. The website satisfies that
 * obligation with this same list; so does this.
 *
 * A fold, shut. Somebody looking for it finds it; nobody else is shown
 * forty-eight museum catalogue entries under five links.
 * ---------------------------------------------------------------------------
 */
export type Credit = { what: string; author: string; license: string; page: string };

export function CreditGroup({
  label,
  note,
  items,
}: {
  label: string;
  note: string;
  items: readonly Credit[];
}) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.space.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: theme.space.xs }}>
        <Subheading>{label}</Subheading>
        <Label>{`${items.length}`}</Label>
      </View>
      <Small color={theme.color.inkSoft}>{note}</Small>

      <View style={{ gap: theme.space.sm, paddingTop: theme.space.xs }}>
        {items.map((credit) => (
          <Pressable
            key={credit.page}
            onPress={() => void Linking.openURL(credit.page)}
            accessibilityRole="link"
            style={{ gap: 2, minHeight: 44, justifyContent: 'center' }}
          >
            <Small color={theme.color.accent}>{credit.what}</Small>
            <Small color={theme.color.inkFaint}>
              {credit.author} · {credit.license}
            </Small>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
