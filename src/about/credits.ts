/**
 * Every picture on the five About pages, and where it came from.
 *
 * ---------------------------------------------------------------------------
 * **Gathered on the About index, and nowhere else.** That is where the website
 * keeps them — one drawer on `/about` holding all four sets — and it is where
 * Tommy asked for them here. The alternative, a list at the foot of each page,
 * puts forty-eight museum catalogue entries under a history of the Church for
 * the benefit of nobody who is reading it.
 *
 * **It cannot be dropped.** A dozen of these are CC BY or CC BY-SA, which
 * oblige the church to name the author and the licence *wherever the picture
 * is published*, and an app screen is a publication. The public-domain and CC0
 * entries oblige nothing and are listed anyway, for the reason the website
 * gives: a credits list that silently drops the works it is not *required* to
 * credit teaches the next person that the list is optional.
 *
 * None of them is a photograph of this church. The one picture on these pages
 * that is — the sanctuary at Wayland, on Who We Are — is the church's own and
 * is deliberately not in this list.
 * ---------------------------------------------------------------------------
 */
import type { Credit } from './parts';
import { BELIEF_CREDITS } from './belief';
import { SAINT_CREDITS } from './saints';
import { TOUR_CREDITS } from './tour';
import { WHO_CREDITS } from './who';
import type { AboutSlug } from './pages';

export type CreditGroup = {
  /** The page these belong to, and where its row links. */
  slug: AboutSlug;
  label: string;
  /** One line saying what the set is. */
  note: string;
  items: readonly Credit[];
};

export const PICTURE_CREDITS: readonly CreditGroup[] = [
  {
    slug: 'who-we-are',
    label: 'Who We Are',
    note: 'Photographs and prints of the Church in Egypt and of its first churches in America.',
    items: WHO_CREDITS,
  },
  {
    slug: 'our-belief',
    label: 'Our Belief',
    note: 'Icons, manuscripts and church interiors illustrating the Creed and the sacraments.',
    items: BELIEF_CREDITS,
  },
  {
    slug: 'patron-saints',
    label: 'Our Patron Saints',
    note: 'Icons, museum objects and the sites of the two saints this church is named for.',
    items: SAINT_CREDITS,
  },
  {
    slug: 'welcome-newcomers',
    label: 'Welcome, Newcomers',
    note: 'The vestments, instruments and furnishings the six stations of the tour explain.',
    items: TOUR_CREDITS,
  },
];

export const PICTURE_CREDIT_COUNT = PICTURE_CREDITS.reduce(
  (total, group) => total + group.items.length,
  0,
);
