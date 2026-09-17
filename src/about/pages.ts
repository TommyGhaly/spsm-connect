/**
 * The five parts of About, as one list.
 *
 * ---------------------------------------------------------------------------
 * A port of `features/content/about.ts` on the website, and the same five
 * slugs in the same order. Three things read it here — the drawer's About
 * group, the `/about` index and the `[page]` route that picks a screen — and
 * they must not drift apart from each other or from the website, because the
 * slugs are shared URLs: `/about/who-we-are` opens the same page in a browser
 * and in this app.
 *
 * **Literals, not Firestore.** The website's note applies unchanged: the
 * church is not going to invent a sixth thing it wants to say about itself
 * between releases, and a bad read must never be able to empty a menu.
 *
 * **Adding a sixth part is two things, not one.** An entry here *and* a screen
 * in `SCREENS` below. The entry alone puts a row in the drawer that lands on
 * the not-found page.
 * ---------------------------------------------------------------------------
 */
import type { IconName } from '@/components/Icon';

export type AboutSlug =
  | 'who-we-are'
  | 'our-belief'
  | 'patron-saints'
  | 'welcome-newcomers'
  | 'future-plans';

export type AboutPage = {
  slug: AboutSlug;
  /** The short name, for the drawer and the index. */
  label: string;
  /** The page's own title, and the header title of its screen. */
  title: string;
  /** One line saying what the page is. It has to read as a sentence alone. */
  lede: string;
  /** The drawer's glyph for it, reused on the index so the two agree. */
  icon: IconName;
};

export const ABOUT_PAGES: readonly AboutPage[] = [
  {
    slug: 'who-we-are',
    label: 'Who we are',
    title: 'Who We Are',
    lede: 'A Coptic Orthodox church in Wayland, Massachusetts, and the Church it belongs to.',
    icon: 'people',
  },
  {
    slug: 'our-belief',
    label: 'Our belief',
    title: 'Our Belief',
    lede: 'What the Coptic Orthodox Church confesses, and where that confession comes from.',
    icon: 'cross',
  },
  {
    slug: 'patron-saints',
    label: 'Our patron saints',
    title: 'Our Patron Saints',
    lede: 'St. Philopater Mercurius and St. Mina, whose names this church carries.',
    icon: 'saint',
  },
  {
    slug: 'welcome-newcomers',
    label: 'Welcome newcomers',
    title: 'Welcome, Newcomers',
    lede: 'What happens in the liturgy, and what to expect if you have not been before.',
    icon: 'newcomer',
  },
  {
    slug: 'future-plans',
    label: 'Future plans',
    title: 'Future Plans',
    lede: 'What the church is building, and where the work stands.',
    icon: 'plans',
  },
];

export function aboutPage(slug: string): AboutPage | undefined {
  return ABOUT_PAGES.find((page) => page.slug === slug);
}
