/**
 * A book's cover.
 *
 * Its own component for the reason the website's `Cover.tsx` is one: every
 * surface that shows a product — the shelf, the detail sheet, a basket row —
 * has to make the same decisions about a missing photograph, a slow one, and
 * how it is cropped, and three copies of that drift.
 *
 * ---------------------------------------------------------------------------
 * ## Where the picture comes from, which is not where the document says
 *
 * `Product.imagePaths` holds Square's own S3 URLs. They always work and are
 * always current, and they are also the church's original photographs: the
 * first cover in this catalog is a **7.2 MB** 3105×3105 JPEG, and there is no
 * resize parameter to ask S3 for something smaller. Ten of those is about 40 MB
 * to open a shop, which measured out as eight seconds of blank panels on a
 * simulator with a fast connection — the shelf looked broken, and on church
 * wifi it would be worse.
 *
 * `scripts/sync-catalog.mjs` in the Website repo already solves this: it writes
 * optimised WebP copies to the site's `public/img/products/`, and `covers.ts`
 * there is explicit that those are *"the preferred source, not a fallback"*.
 * The same two files are 15 KB and 83 KB. This app fetches them from the same
 * host it already fetches the About pages' plates and the forms' pictures from,
 * so no new origin and no new configuration — see `siteUrl`.
 *
 * ## And why Square's URL is still needed
 *
 * Because the baked copies are only as new as the last `npm run catalog`. Two
 * of the ten products in the church's catalog have no file on the site today,
 * and a book added in Square this morning has none either. `covers.ts` puts it
 * best: *"a slow image beats no image, and both beat a build that has to be
 * re-run before a new book can appear."*
 *
 * So the baked copy is tried first and a failure swaps to Square's original.
 * `expo-image` does not fall back on its own, so `onError` does it here — one
 * state transition, per image, never repeated, because the fallback is the last
 * source there is.
 *
 * ## `live`, and the one case the arrangement above gets wrong
 *
 * A baked copy that is *stale* rather than missing answers 200 with the old
 * photograph, so nothing errors and nothing falls back. That was harmless while
 * covers could only be changed in Square — the next `npm run catalog` fixed it,
 * and nobody was standing there waiting. It stopped being harmless when this
 * app grew the ability to change them: a volunteer who replaces a cover from
 * their phone would watch the shelf keep showing the one they just deleted, and
 * conclude the app had not saved it.
 *
 * The website has `bakedFrom` for this — the list of Square URLs the baked
 * files were made from, compared against the live ones. It is computed during
 * `next build` from the contents of `public/`, not stored in Firestore, so a
 * phone has no way to ask the question. What a phone can do is decline to ask
 * it: while somebody is editing the shop, `live` skips the baked copy entirely
 * and renders what Square actually holds. Slower, and correct, and only for the
 * handful of people who are looking at a cover in order to judge it.
 *
 * Shoppers keep the fast path unchanged. A cover replaced from this app is
 * still stale on *their* shelf until the site's next cover sync, which is the
 * same staleness the website's own shop has had all along.
 * ---------------------------------------------------------------------------
 */
import { Image } from 'expo-image';
import { useState } from 'react';
import { View } from 'react-native';

import { Body, Micro } from '@/components/Type';
import { siteUrl } from '@/about/media';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * The website's file name for one of a product's pictures.
 *
 * `<slug>.webp` is the first; any others are `<slug>-2.webp`, `<slug>-3.webp`,
 * which is what the sync writes. Every book in the catalog has exactly one
 * today, so the second branch is unexercised — it is here because matching the
 * convention costs a line and guessing it wrong later costs a debugging session.
 *
 * `@2x` — the 800px copy — rather than the 400px base, because that is the one
 * a browser's `srcSet` would pick for this slot on a phone: a card is about 176
 * points wide and a phone is a 3× screen, so 400px would be visibly soft.
 */
function bakedUrl(slug: string, index: number): string {
  const stem = index === 0 ? slug : `${slug}-${index + 1}`;
  return siteUrl(`/img/products/${stem}@2x.webp`);
}

export function Cover({
  slug,
  name,
  index = 0,
  fallback,
  height,
  radius,
  live = false,
}: {
  slug: string;
  /** The book's title, which is what stands in when it has no photograph. */
  name: string;
  /** Which of the product's pictures this is. */
  index?: number;
  /** Square's own URL, or null for a product with no photograph yet. */
  fallback: string | null;
  height: number;
  /** Defaults to the theme's small corner; the detail plate wants a larger one. */
  radius?: number;
  /**
   * Show what Square holds, not what the website baked. See the header.
   *
   * True while the shop is being edited. Costs the original photograph — 7 MB
   * for the first cover in this catalog — which is why it is never true for a
   * shopper.
   */
  live?: boolean;
}) {
  const theme = useTheme();
  const corner = radius ?? theme.radius.sm;

  /*
   * Which source is being tried. Keyed by slug and index so that a recycled
   * `FlashList` cell showing a different book starts again at the baked copy
   * rather than inheriting the previous book's failure — without the key, one
   * unsynced product would push every card that reused its cell onto Square's
   * 7 MB originals.
   */
  const [failedFor, setFailedFor] = useState<string | null>(null);
  const id = `${slug}:${index}`;
  const source = live || failedFor === id ? fallback : bakedUrl(slug, index);

  /*
   * A book with no photograph, which is the website's `.cover--none` binding.
   *
   * Reached two ways: a product with no picture at all, and one whose baked
   * copy is missing *and* which has no Square URL either. Both are ordinary — a
   * title added in Square minutes ago and not yet photographed.
   *
   * This used to be a sunken panel with the shop's bag glyph on it, and the
   * website's own note on why that is wrong applies here word for word: a pale
   * rectangle among photographs reads as a hole rather than as a book, and the
   * glyph said nothing about *which* book was missing its picture. So it is a
   * plain cloth binding instead — the parish's deep red, a gold spine down the
   * outer edge, a gold rule stamped inside the boards, and the title set on it.
   * Interleaved with the photographs it gives a shelf a rhythm instead of a gap,
   * and it fixes itself the day somebody uploads the photograph.
   */
  if (!source) return <Binding name={name} height={height} radius={corner} />;

  return (
    <Image
      source={{ uri: source }}
      onError={() => setFailedFor(id)}
      /*
       * Hidden from assistive technology on purpose, everywhere this is used.
       *
       * The cover always sits directly above or beside the title, which is real
       * text. A screen reader that announced both would read the name of the
       * book twice, and the only alt text available to invent here — the name
       * of the book — is exactly what makes that happen.
       */
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      /*
       * `cover`, and it was `contain`.
       *
       * The argument for `contain` was that a book cover has its title printed
       * across the top and cropping it to fill a square can cut that off —
       * true, and the price of avoiding it was a band of sunken paper around
       * every picture that is not exactly the shape of its box. Ten of those in
       * a grid is a catalogue with its photographs floating in trays, and the
       * tray is what a shopper's eye lands on first.
       *
       * The church's covers are phone snaps taken square, so what the crop
       * actually costs is a few points off the sides of the ones that are not.
       * The picture is the tile now — full width, nothing around it, the title
       * and the price underneath — and the whole of a cover is still one tap
       * away on the plate in the book's own sheet.
       */
      contentFit="cover"
      /*
       * Covers change rarely, and disk caching is what keeps the shelf instant
       * on every visit after the first.
       *
       * **Except while editing.** Square re-uses nothing — a replaced
       * photograph is a new URL on its CDN — so the cache cannot serve a stale
       * picture for a cover that changed. What it can do is hold the *removed*
       * one against a URL that is now 404, which is why this drops to memory
       * only when `live`: a volunteer taking a picture off and looking again
       * should see it gone.
       */
      cachePolicy={live ? 'memory' : 'memory-disk'}
      transition={180}
      // Set for the same reason the key above exists: a recycled cell must drop
      // the previous book's picture rather than showing it under the new title
      // until the new one decodes.
      recyclingKey={id}
      // No backing colour. It was `paperSunken`, which is the band `contain`
      // left around a picture; with `cover` there is nothing for it to fill but
      // the 180ms before the picture decodes, and a grey tile that appears and
      // disappears is the same tray arriving late.
      style={{ height, borderRadius: corner }}
    />
  );
}

/**
 * The plain cloth binding a book with no photograph gets.
 *
 * The website's `.cover--none` rule, carried over piece for piece: the deep
 * ground, the gold spine on the outer edge, the gold rule stamped inside the
 * boards, and the title centred on it. One component for every size it appears
 * at — a shelf tile, the plate in a book's sheet, a 40-point thumbnail beside a
 * basket line — because the website's is one rule for five contexts and only
 * the sizes differ.
 *
 * ## What differs by size, and why it is measured rather than passed
 *
 * A 5-point spine on a 52-point basket thumbnail is a tenth of the book, which
 * reads as a stripe rather than as a binding; the website drops it to 3 there.
 * The title is the same argument — a serif at body size does not fit two words
 * into a thumbnail, and `Micro` does. Both follow from the one number this
 * already has, so neither is a prop: a caller that has to be told how big it is
 * is a caller that can get it wrong.
 *
 * `goldSoft` for the title rather than the website's 80% mix of `gold` into
 * cream, which is the same intent reached with a token this app already has.
 * It is also the pairing the rest of the app uses for text on `deep` — the
 * privacy screen and the giving verse both set it — and at micro size on a dark
 * ground the brighter of the two golds is what keeps it readable.
 */
function Binding({ name, height, radius }: { name: string; height: number; radius: number }) {
  const theme = useTheme();
  const small = height < 100;
  const Title = small ? Micro : Body;

  return (
    <View
      /*
       * Hidden from assistive technology like the photograph it stands in for,
       * and here for a sharper reason: the text inside it *is* the title, and
       * every caller draws that title again directly underneath or beside it.
       * Announced, a book with no picture would read its own name twice.
       */
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        height,
        borderRadius: radius,
        overflow: 'hidden',
        backgroundColor: theme.color.deep,
        borderLeftWidth: small ? 3 : 5,
        borderLeftColor: theme.color.gold,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: small ? theme.space.xs : theme.space.sm,
        paddingVertical: small ? theme.space.xs : theme.space.md,
      }}
    >
      {/*
        The rule stamped inside the boards. Its own view rather than a border on
        the box above, because that box spends its left border on the spine —
        and the rule has to sit inside the spine, not replace it.
      */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: theme.space.xs,
          bottom: theme.space.xs,
          left: 0,
          right: theme.space.xs,
          borderWidth: 1,
          borderColor: theme.color.gold,
          /*
           * 40%, as a whole-view opacity rather than a mixed colour. The view
           * is nothing but its border, so the two come out the same — and this
           * one does not need the colour-mixing helper the app does not have.
           */
          opacity: 0.4,
        }}
      />

      {/* Clamped for the reason the card's own title is: Square's longest title
          runs to five lines, and a binding is a fixed box. */}
      <Title color={theme.color.goldSoft} align="center" numberOfLines={small ? 3 : 5}>
        {name}
      </Title>
    </View>
  );
}
