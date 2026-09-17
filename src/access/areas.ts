/**
 * Everything a superadmin can hand out, in the order they are handed out.
 *
 * A port of `apps/website/src/features/access/areas.ts`, and **the copy is the
 * thing being ported.** The permission model already travels — `ADMIN_SCREENS`
 * comes from `@spsm/shared` and is the same eleven flags on both platforms —
 * but a flag named `content` says nothing to the person ticking it. The
 * sentences below are what say that "content" is the About pages, that
 * "finance" is totals and not a list of who owes them, and that "Summer camp"
 * is the registrations and deliberately not the camp's event pages.
 *
 * So this file is duplicated prose, knowingly, and the reason it is duplicated
 * rather than moved into `@spsm/shared` is the reason the website gives for
 * keeping it out of the model: a `label` field on `ADMIN_SCREENS` is a field
 * every consumer then carries, and the model would acquire copy it has no
 * business holding. What that costs is exactly this — two files to change when
 * a row's wording changes.
 *
 * **Keep them identical.** An administrator who reads one sentence about the
 * camp on the website and a different one in the app has been told two things
 * about the same grant, and the wording *is* the description of what they are
 * about to give somebody. If a caveat changes there, change it here in the same
 * sitting; `apps/website/src/features/access/areas.ts` is the original.
 *
 * ## Two flags are deliberately not offered here, and never will be
 *
 * `members` and `config` exist in the model and are absent from this list —
 * not "no screen uses it" but "no screen should be able to give it away".
 * `members` is the power to grant every other flag on this screen, and
 * delegating the delegation is how a superadmin-only screen quietly stops being
 * one. `config` is where the app and the site are pointed at their backends.
 * Both stay with the claim; the long version is in
 * `packages/shared/src/screens.ts`.
 *
 * ## Nothing is revoked by a row not existing
 *
 * `saveAllocation` writes a *complete* `ScreenAdmin` map read off the member
 * document and writes it back whole, so a flag with no row here is carried
 * through a save untouched. It is also counted and named on the person's screen
 * — see `UNOFFERED_SCREENS` — because a permission this screen silently
 * preserves and never mentions is worse than one it does not offer.
 */
import { ADMIN_SCREENS, type AdminScreen, type FinanceSource } from '@spsm/shared';

export interface AccessArea {
  /** Stable key. The screen flag, or `'programs'` for the per-program axis. */
  key: AdminScreen | 'programs';
  /** What an administrator calls it. */
  label: string;
  /** One line under the label: what the person will be able to do. */
  blurb: string;
  /**
   * Anything the label would otherwise overpromise.
   *
   * Drawn in a quieter voice beneath the blurb, and only where there is a real
   * limit to state. A caveat on every row is a caveat nobody reads.
   */
  caveat?: string;
}

/**
 * The one area that is not a screen flag.
 *
 * Program grants are a list of ids, not a boolean, so this row draws a ticklist
 * of the church's ministries rather than a single switch. It is first because
 * it is the one people come here for — a servant runs one ministry and should
 * be given that ministry and nothing else, which is the whole argument for this
 * screen existing.
 */
export const AREA_PROGRAMS: AccessArea = {
  key: 'programs',
  label: 'Ministries and their events',
  blurb:
    'Which ministries this person runs — their gatherings, and the photographs sent in to them.',
  caveat:
    'Not the parish calendar. Liturgies and one-off event pages are the Parish calendar row below. Ticking the summer camp here gives its gatherings and photographs — its registrations are the Summer camp row, and the two are separate on purpose.',
};

/**
 * Summer camp — the back office.
 *
 * Worded more heavily than its neighbours because what it opens is children's
 * names, grades, allergies and medical notes.
 *
 * The fees are deliberately not named: the ledger is read under Finance,
 * narrowed to the camp. What this grant gets of the money is one box for
 * writing down a check as it is handed over.
 */
export const AREA_CAMP: AccessArea = {
  key: 'camp',
  label: 'Summer camp',
  blurb:
    'Registrations, the allocation into bands and groups, the daily register, and the camp’s own settings.',
  caveat:
    'This is personal data about children — names, grades, allergies and medical notes. Not the camp’s money: balances and payment history are Finance, narrowed to the camp, and this grant can only write down a payment as it is taken. Not the camp’s event pages or its gallery either — those are the ministry, in the list above.',
};

/**
 * Money.
 *
 * The caveat that remains is the one that cannot be engineered away. The
 * treasurer sees what the camp took; they do not see who has not paid, because
 * that is a list of families and it lives with the camp. See the long note on
 * `'finance'` in `packages/shared/src/screens.ts` for how the rest of the gap
 * was closed — a scheduled Function writes `financeRollups`, which are totals
 * with no names in them, and this flag reads those.
 */
export const AREA_FINANCE: AccessArea = {
  key: 'finance',
  label: 'Finance',
  blurb:
    'What the bookstore, the summer camp and the paid forms have taken — and what is still owed. Any of the three on its own, in the list beneath.',
  caveat:
    'Totals only. Which family owes what stays with the Summer camp grant, and who answered a form stays with Forms — those records hold children’s medical notes and people’s answers, and this row is deliberately not a way into them. Sunday giving goes through Tithe.ly and is not recorded on this site at all.',
};

/**
 * The three parts of the money, each grantable on its own.
 *
 * Sub-rows rather than three more areas, and the shape is the argument. None of
 * these is a screen: every one of them is read through the Finance screen and
 * through the row above. A church can have a bookkeeper who does the shop's
 * books and has no business with a list of which families owe camp fees, and
 * that sentence is "Finance, but only the bookstore" — not "the bookstore's
 * money" as an area standing beside the Bookstore row that already exists and
 * means something else.
 *
 * So they are drawn indented under Finance, and `hasFinance()` in
 * firestore.rules asks for the flag before it asks for the source. See
 * `FINANCE_SOURCES` in packages/shared/src/screens.ts for why an unset map
 * means all three.
 *
 * Worded to name the *record*, not the takings, wherever the grant reaches one:
 * the bookstore row opens the orders, which have buyers' names on them, and an
 * administrator ticking it should be told that on the row rather than from a
 * support call.
 */
export interface FinanceSourceRow {
  key: FinanceSource;
  label: string;
  blurb: string;
}

export const FINANCE_SOURCE_ROWS: readonly FinanceSourceRow[] = [
  {
    key: 'bookstore',
    label: 'The bookstore',
    blurb:
      'What the shop took each month, and the orders behind it — which carry the buyer’s name and what they bought, because a refund cannot be checked against a sale nobody can see.',
  },
  {
    key: 'camp',
    label: 'The summer camp',
    blurb:
      'What each season billed, took and is still owed, by payment method. Figures only — no child, no family, and no list of who has not paid.',
  },
  {
    key: 'forms',
    label: 'The paid forms',
    blurb:
      'What each form that charges has collected, and what was priced and never paid. No answers and no names.',
  },
] as const;

export const AREA_FORMS: AccessArea = {
  key: 'forms',
  label: 'Forms',
  blurb: 'Building forms, opening and closing them, and reading the replies.',
  caveat:
    'The replies are whatever the form asked for — names, phone numbers, sometimes a child’s allergies.',
};

export const AREA_BOOKSTORE: AccessArea = {
  key: 'bookstore',
  label: 'Bookstore',
  blurb: 'The orders queue, the sales figures, and how the shop’s shelves are arranged.',
  caveat:
    'Prices, stock and whether a book is listed at all live in Square, not here. This does not open Square.',
};

/**
 * The five About pages, and the privacy notice.
 *
 * Three limits in the caveat, and every one of them is a thing somebody would
 * otherwise discover by trying: it is live as typed with no draft step; the
 * layouts and much of what is on them are beyond reach, band by band; and the
 * editable pages are a closed list, so no new one can be made.
 *
 * The privacy notice is on that list and is the page worth naming out loud when
 * granting this flag: the person given `content` can reword the church's
 * published statement about what it does with a parishioner's information.
 * They cannot change what the app and the site actually do with it — but a
 * notice that has drifted from the code is a false statement the church has
 * published.
 */
export const AREA_CONTENT: AccessArea = {
  key: 'content',
  label: 'About pages',
  blurb:
    'Rewriting the headings, words and photographs on the five About pages and the privacy notice, and adding sections to the foot of them.',
  caveat:
    'Live the moment it is typed — there is no draft, on pages strangers arrive at from a search result. Not the page layouts, and not everything on them: what can be changed is chosen band by band, and the Creed, the dated histories and the feast days are deliberately not. This includes the wording of /privacy, which is the church’s published statement about what it does with what people tell it. Not new pages either — the list of editable ones is fixed.',
};

export const AREA_EVENTS: AccessArea = {
  key: 'events',
  label: 'Parish calendar',
  blurb: 'Adding and editing the services and one-off event pages on /calendar and /events.',
  caveat:
    'Every event in this collection is public the moment it is saved — there is no draft state. Give this to somebody you would trust to publish.',
};

/**
 * The order the screen draws them in: the program-shaped row first, then the
 * screen flags, roughly by how sensitive each is.
 */
export const ACCESS_AREAS: readonly AccessArea[] = [
  AREA_PROGRAMS,
  AREA_CAMP,
  AREA_EVENTS,
  AREA_CONTENT,
  AREA_FORMS,
  AREA_FINANCE,
  AREA_BOOKSTORE,
] as const;

/**
 * The rows that are a plain screen flag, in screen order.
 *
 * These six, and only these six, are the screens something in this programme
 * actually gates on. Ticking any of them changes what somebody sees the next
 * time they open the app.
 *
 * About pages sits beside Parish calendar rather than at the end, because the
 * two are the same kind of trust: both publish to a public page with no draft
 * step between the typing and the world.
 *
 * Summer camp leads because it is the most sensitive and the most often given.
 * Not alphabetical and not the order of `ADMIN_SCREENS`: an administrator
 * scanning this screen is looking for the area somebody actually works in.
 */
export const SCREEN_AREAS: readonly (AccessArea & { key: AdminScreen })[] = [
  AREA_CAMP,
  AREA_EVENTS,
  AREA_CONTENT,
  AREA_FORMS,
  AREA_FINANCE,
  AREA_BOOKSTORE,
] as readonly (AccessArea & { key: AdminScreen })[];

/**
 * Flags in the model that this screen does not draw a control for.
 *
 * Derived rather than listed, so a screen added to `ADMIN_SCREENS` without a
 * row here cannot go unnoticed: it lands in this set on the next build, and the
 * person's screen names it on anybody holding it.
 *
 * `members` and `config` are excluded because they are not *unoffered*, they
 * are *undelegable* — no screen should ever set them, so a person holding one
 * is either the superadmin (whose claim is elsewhere) or a mistake to be fixed
 * in the console rather than a footnote here.
 */
export const UNOFFERED_SCREENS: readonly AdminScreen[] = ADMIN_SCREENS.filter(
  (screen) =>
    screen !== 'members' &&
    screen !== 'config' &&
    !SCREEN_AREAS.some((area) => area.key === screen),
);

/**
 * What to call a flag this screen does not offer, when somebody turns out to
 * hold one.
 *
 * A name and nothing else — no blurb, no caveat. These four have no editor, so
 * there is nothing to describe: the only sentence needed is "this person holds
 * a thing you cannot change here", and the label is the half of it that varies.
 */
export const UNOFFERED_LABELS: Readonly<Partial<Record<AdminScreen, string>>> = {
  bulletin: 'Bulletin and announcements',
  servants: 'Servants’ rota',
  parking: 'Car park register',
  theme: 'Colors and type',
};
