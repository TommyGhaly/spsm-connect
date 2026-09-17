/**
 * The words on these five screens, as the church has them *now*.
 *
 * ---------------------------------------------------------------------------
 * ## The problem this solves
 *
 * The five About pages exist twice — as React on the website and as React
 * here — and the prose was copied from one to the other. A copy drifts. Left
 * alone, a correction made on the website would be invisible in this app until
 * somebody made the same correction here and shipped a release, and the church
 * would have two slightly different accounts of its own history in public.
 *
 * ## The answer is the website's own editing layer, read from here
 *
 * The website does not keep those pages editable by redeploying them. Each
 * coded band declares a few named slots — a heading, a paragraph, a photograph
 * — and `aboutOverrides/{slug}` in Firestore may override any of them; staff
 * edit the page in the browser and the change is live without a deploy. The
 * manifest of what is reachable is `features/about/slots.ts` over there, the
 * document shape and every merge rule are in `@spsm/shared`, and the rules
 * refuse any id outside the five slugs.
 *
 * **This app reads the same document and applies it to the same slot ids.** So
 * an edit made on the website is an edit here, on the next open of the screen,
 * with no release. That is the whole point of this file.
 *
 * ## Read-only, and not by omission
 *
 * There is no write path here and there must not be one. `features/about`'s
 * own `index.ts` keeps `admin.ts` out of its public surface for the same
 * reason — a write helper should never be one careless import away from a
 * screen the church reads. This app has no About editor, no grant check and no
 * way to produce an override; it renders what the website's editor wrote.
 *
 * ## Absence means the coded default, and so does emptiness
 *
 * The load-bearing rule of the whole feature, and it is enforced in
 * `@spsm/shared` rather than here: `undefined`, `null`, `''` and `'   '` are
 * all *no override*. Clearing a box on the website restores the coded words
 * rather than emptying the screen. Every helper below goes through `copyOf`
 * and `pictureOf` so that this app cannot disagree with the website about it.
 *
 * ## Failure is silence
 *
 * A failed read, an absent document (the ordinary state for a page nobody has
 * edited), a garbled one — all of them leave the coded copy on screen. The
 * words ship inside the binary, so these screens render whole with no network
 * at all; the override is an improvement on them, never a precondition.
 * ---------------------------------------------------------------------------
 */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  COLLECTIONS,
  copyOf,
  decodeFirestoreFields,
  hasCopy,
  hasPicture,
  parseAboutOverride,
  publicDocumentUrl,
  type AboutImage,
  type AboutSection,
  type AboutSlot,
} from '@spsm/shared';

import { siteUrl } from './media';
import type { AboutSlug } from './pages';
import type { PictureMeta } from './parts';

export type AboutCopy = {
  slots: Record<string, AboutSlot>;
  sections: readonly AboutSection[];
};

const EMPTY: AboutCopy = { slots: {}, sections: [] };

/**
 * The last copy fetched for each page, for the length of the process.
 *
 * Not a cache with a policy — a memo. Opening Who We Are, going back and
 * opening it again should not refetch before it can draw, and the second open
 * should not flash the coded wording where an override was showing a moment
 * ago. It is still refetched on every mount; this only decides what is on
 * screen while that is in flight.
 */
const LAST = new Map<AboutSlug, AboutCopy>();

const Context = createContext<AboutCopy>(EMPTY);

/**
 * Fetch `aboutOverrides/{slug}` and put it in context.
 *
 * A bare `fetch` against the Firestore REST API rather than the Firestore SDK,
 * exactly as `theme/tokens.ts` does and for the same reason: this is one
 * world-readable document read before anything is on screen, and going through
 * the SDK would mean waiting for Firebase to initialise to draw a paragraph.
 * The rule on this collection is `allow read: if true`, so no credential is
 * involved beyond the public API key.
 */
export function AboutCopyProvider({
  slug,
  children,
}: {
  slug: AboutSlug;
  children: ReactNode;
}) {
  const [copy, setCopy] = useState<AboutCopy>(() => LAST.get(slug) ?? EMPTY);

  useEffect(() => {
    const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
    const apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
    if (!projectId || !apiKey) return;

    const controller = new AbortController();

    void (async () => {
      try {
        const url = publicDocumentUrl(
          projectId,
          `${COLLECTIONS.aboutOverrides}/${slug}`,
          apiKey,
        );
        const response = await fetch(url, {
          signal: controller.signal,
          headers: { 'Cache-Control': 'no-cache' },
        });
        // A 404 means nobody has ever edited this page. Ordinary, not an error.
        if (!response.ok) return;

        const body = (await response.json()) as { fields?: Record<string, unknown> };
        const parsed = parseAboutOverride(slug, decodeFirestoreFields(body.fields ?? {}));
        const next: AboutCopy = { slots: parsed.slots, sections: parsed.sections };
        LAST.set(slug, next);
        setCopy(next);
      } catch {
        /* The coded copy stays. See the header. */
      }
    })();

    return () => controller.abort();
  }, [slug]);

  return <Context.Provider value={copy}>{children}</Context.Provider>;
}

/**
 * The slot map, once per component.
 *
 * A hook, and then the helpers below are ordinary functions taking what it
 * returned. That is not ceremony: a component that renders eleven chronology
 * rows would otherwise call a hook inside a loop, and the count of hooks per
 * render would be a fact about the data.
 */
export function useAboutCopy(): AboutCopy {
  return useContext(Context);
}

export function useAboutSlots(): Record<string, AboutSlot> {
  return useContext(Context).slots;
}

export function useAboutSections(): readonly AboutSection[] {
  return useContext(Context).sections;
}

type Slots = Record<string, AboutSlot>;

/** One line — a heading, an eyebrow, a date, a caption. */
export function textOf(slots: Slots, slot: string | undefined, coded: string): string {
  return slot === undefined ? coded : copyOf(slots[slot], coded);
}

/**
 * A run of paragraphs.
 *
 * The website renders an override through `react-markdown`, so what staff type
 * into one of these boxes is markdown with blank lines between paragraphs.
 * Splitting on the blank line is what turns that back into the array the
 * screens draw, and `Rich` handles the emphasis and links inside each one.
 *
 * The honest limit: markdown this app does not implement — a list, a heading,
 * a table — arrives as literal text rather than as structure. `Rich`'s header
 * says which three forms are understood. Nothing on the five pages as written
 * uses more than those, and a staff member who types a bulleted list will see
 * their hyphens.
 */
export function paragraphsOf(
  slots: Slots,
  slot: string | undefined,
  coded: readonly string[],
): readonly string[] {
  if (slot === undefined || !hasCopy(slots[slot])) return coded;
  return copyOf(slots[slot], '')
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph !== '');
}

/**
 * A plate: the photograph, and the line under it.
 *
 * Two slots, independently. `slot` replaces the picture — the website's
 * picker offers everything the site already ships, or an upload — and
 * `captionSlot` replaces only the words under it, which is the far commoner
 * edit and must not require re-choosing the photograph.
 *
 * `width`/`height` are carried from the override when it has them and fall
 * back to the coded picture's when it does not, because the plate computes its
 * aspect ratio from them. An uploaded file whose dimensions the writer never
 * knew costs a small jump when it lands, which is the trade the schema names.
 */
export function plateOf(
  slots: Slots,
  coded: { source: string; meta: PictureMeta },
  slot?: string,
  captionSlot?: string,
): { source: string; meta: PictureMeta } {
  const caption = textOf(slots, captionSlot, coded.meta.caption);

  if (slot === undefined || !hasPicture(slots[slot])) {
    return { source: coded.source, meta: { ...coded.meta, caption } };
  }

  const image = slots[slot]?.image as AboutImage;
  return {
    // A bundled path is the website's own `/img/...`; an upload is already
    // absolute. `siteUrl` leaves an absolute URL alone.
    source: image.src.startsWith('http') ? image.src : siteUrl(image.src),
    meta: {
      alt: image.alt ?? coded.meta.alt,
      caption: image.caption ?? caption,
      width: image.width ?? coded.meta.width,
      height: image.height ?? coded.meta.height,
    },
  };
}
