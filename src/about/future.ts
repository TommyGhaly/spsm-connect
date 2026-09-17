/**
 * Future Plans — the three buildings designed for 169 Rice Road.
 *
 * A port of the website's `features/future`: `FutureScreen.tsx`'s prose,
 * `plan.ts` and `images.ts`. See the header of `who.ts` for why the words are
 * copied rather than fetched.
 *
 * **This is the page whose facts go stale**, and the two things that make that
 * survivable are ported with it: the dated spine ends on an undated "Next"
 * rather than on a prediction, and the closing paragraph sends anybody who
 * needs the current answer to the office instead of implying this page is it.
 * Do not replace either with a guess at a date.
 *
 * **Every figure here comes off a schedule or a printed sentence in the filed
 * drawings**, not off a tape measure laid over a PDF. Anything that could not
 * be verified that way is named without a number — there is a bookstore in
 * Building B and this file does not say how big it is, and that is the correct
 * outcome.
 */
import { firmLogo, futurePicture, futureThumb, siteUrl } from './media';
import type { PictureMeta } from './parts';

/* ── Renderings ──────────────────────────────────────────────────────────── */

export const FUTURE_PICTURES = {
  approach: {
    alt: 'A rendering of the proposed church seen from the car park: a wide arched west front between two tall bell towers, each capped with a cross, with lower buildings to the left and pines behind.',
    caption:
      'The proposed church from the drive, roughly where the car park meets Rice Road today. The arch over the doors and the two towers are the Coptic front; what is behind them is a dome.',
    width: 1600,
    height: 900,
  },
  'west-front': {
    alt: 'A closer rendering of the west front: a deep recessed arch over tall glazing and timber doors, flanked by two towers of narrow arched windows.',
    caption:
      'The west front, closer. The great arch is glazed above the doors, so the light in the nave in the morning comes through it and not through the side aisles.',
    width: 1600,
    height: 900,
  },
  steps: {
    alt: 'A rendering of people walking up a broad flight of stone steps toward the arched doors of the church, with planting either side and a handrailed ramp at the edge.',
    caption:
      'The steps up to the doors. The church floor sits sixteen feet above the car park, so the approach is a climb — and the ramp beside it, drawn at one in twelve with seven landings, is the same approach for anyone who cannot take the steps.',
    width: 1600,
    height: 900,
  },
  piazza: {
    alt: 'A rendering looking across a paved courtyard: a glazed two-storey building on the left, the flank of the church with its arched windows and tower ahead, and people walking between them.',
    caption:
      'The piazza — the paved court between the three buildings, sitting one level above the car park. It is where the congregation would come out to after the Liturgy.',
    width: 1600,
    height: 900,
  },
  'diocese-center': {
    alt: 'A rendering of a two-storey building with clapboard walls, a glazed corner and dark window frames, seen across a car park with the church behind it.',
    caption:
      'Building C, the diocese centre, from the car park. Offices, meeting rooms and three apartments, in a plainer language than the church deliberately.',
    width: 1600,
    height: 900,
  },
  'youth-center': {
    alt: 'A rendering of a long two-storey clapboard building with a covered walkway running its length, trees and a car park in front.',
    caption:
      'Building B, the long one: Sunday school below, senior housing above, and the covered walk that runs the length of it.',
    width: 1600,
    height: 900,
  },
  'roofs-aerial': {
    alt: 'An aerial rendering of the whole site: the domed church at the centre with barrel-vaulted roofs, the long youth centre behind it, the diocese centre in front, and car parking around the edges.',
    caption:
      'The three buildings together, from above the east. The vaults over the nave and the aisles are what the arches on the front are the ends of.',
    width: 1600,
    height: 900,
  },
  'campus-aerial': {
    alt: 'An aerial rendering from the south-west: the church with its two towers and broad steps, the diocese centre and youth centre beside it, and marked car parking wrapping around the site.',
    caption:
      'The whole site from above Rice Road. The present church stands about where the near corner of the diocese centre is drawn.',
    width: 1600,
    height: 900,
  },
  massing: {
    alt: 'An architectural line drawing, in axonometric view, of three buildings on a wooded site, labelled A Church, B Youth Center Sunday School and Senior Housing, and C Dioceses Center, between Rice Road and Turkey Hill Road.',
    caption:
      'Sheet G1 of the set filed with the town — the same three buildings as a drawing rather than a rendering, with the roads and the property line on it. A is the church, B the youth centre and housing, C the diocese centre.',
    width: 1600,
    height: 977,
  },
  'site-plan': {
    alt: 'An architectural site plan showing three labelled building footprints, a piazza between them, drives and car parking, a fire access road, the property line and setbacks, and the surrounding streets.',
    caption:
      'Sheet G7, the site plan. The dashed outline just left of the diocese centre, marked “outline of existing church to be demolished”, is the building the congregation worships in now.',
    width: 1600,
    height: 977,
  },
} as const satisfies Record<string, PictureMeta>;

export type FuturePictureName = keyof typeof FUTURE_PICTURES;

export const future = (name: FuturePictureName) => futurePicture(name);

/**
 * Ten more frames from the same flythrough.
 *
 * Ten and not thirty: a grid of ten distinct views of three buildings is a
 * gallery, and a grid of thirty near-identical ones is a screensaver. The
 * order is the order the camera visits them, which is also the order the page
 * has already described them in.
 *
 * These have no `width`/`height` because the optimiser emits them cropped to a
 * fixed 480px tile and nothing on this screen draws them any other way.
 */
export const FUTURE_GALLERY = {
  'gallery-through-the-pines': {
    alt: 'A rendering of the church seen at a distance between tall pines, its two towers and dome above the treeline.',
    caption: 'From the road, through the pines.',
  },
  'gallery-from-the-steps': {
    alt: 'A rendering looking down the church steps from the top, across the car park to the trees beyond.',
    caption: 'From the top of the steps, looking back.',
  },
  'gallery-colonnade': {
    alt: 'A rendering of a covered walkway on square columns running along a lawn, with a two-storey clapboard building above it.',
    caption: 'The covered walk along the youth centre.',
  },
  'gallery-north-flank': {
    alt: 'A rendering of the north side of the church: a row of tall arched windows under a barrel-vaulted roof, with a tower beyond and lawn in front.',
    caption: 'The north flank of the church, from the court.',
  },
  'gallery-tower': {
    alt: 'A rendering looking up at one of the church towers and the edge of the great arch, framed by a tree.',
    caption: 'A tower and the edge of the arch.',
  },
  'gallery-b-entrance': {
    alt: 'A rendering of the entrance canopy on the long youth centre building, with cars parked in front of it.',
    caption: 'The way into the youth centre.',
  },
  'gallery-b-far-end': {
    alt: 'A rendering of the far end of the youth centre building across the car park, with the church dome visible beyond it.',
    caption: 'The far end of Building B, the church behind.',
  },
  'gallery-aerial-domes': {
    alt: 'An aerial rendering close over the church roofs: the dome over the crossing and the barrel vaults either side of it.',
    caption: 'Close over the dome and the vaults.',
  },
  'gallery-aerial-low': {
    alt: 'A low aerial rendering across the car park toward the three buildings, trees along the boundary.',
    caption: 'Low across the car park.',
  },
  'gallery-aerial-southwest': {
    alt: 'An aerial rendering of the whole site from the south-west, showing all three buildings, the piazza and the parking.',
    caption: 'The whole site from the south-west.',
  },
} as const;

export type FutureGalleryName = keyof typeof FUTURE_GALLERY;

export const galleryThumb = (name: FutureGalleryName) => futureThumb(name);

export { firmLogo };

/**
 * The flythrough: the film itself, its poster, and its cue track.
 *
 * ---------------------------------------------------------------------------
 * **It plays in the app.** The same 720p file the website serves, from the
 * same place, in a `WebView` wrapped around a plain `<video>` — `react-native-
 * webview` is already a dependency here, so this costs no new native module.
 *
 * **It does not autoplay, and that is the one deliberate difference from the
 * website.** Over there the file is `+faststart` behind range requests and a
 * reader who scrolls past after ten seconds has fetched about 1.6 MB, which
 * makes autoplay kind. That arithmetic does not survive being metered: this
 * app is opened on cellular in a car park. So the poster is shown with the
 * player's own control on it and the 33 MB starts when somebody asks for it.
 *
 * `captions` is the cue track. The website parses it in the browser to build
 * the chapter list under the player; this app fetches and parses the same file
 * for the same list, so a re-cut film renames the chapters in both places
 * without a release here.
 * ---------------------------------------------------------------------------
 */
export const FLYTHROUGH = {
  src: siteUrl('/video/future-flythrough-720.mp4'),
  poster: futurePicture('approach'),
  captions: siteUrl('/video/future-flythrough.vtt'),
  width: 1280,
  height: 720,
  /** 3 minutes 30 seconds, for the line under the player. */
  length: '3 minutes 30 seconds',
  /** The website's `<video>` fallback, shown while the film has not started. */
  fallback:
    'A 3 minutes 30 seconds animation walking through the proposed church and grounds. The pictures below this are frames taken from it.',
  /*
   * The website's caption, less four words. It reads "…silent, and it starts
   * on its own — up the steps…"; it does not start on its own here, and a
   * church page that says a thing the reader can see is untrue spends more
   * than the sentence is worth. See `FLYTHROUGH` above for why it does not
   * autoplay. Everything else is verbatim, including the line about the cue
   * track — which is why the player carries one.
   */
  caption:
    '**A walk through it.** 3 minutes 30 seconds, silent — up the steps, through the piazza, around the two buildings behind, then over the whole site. The line along the bottom names what is on screen; the list above jumps to any part of it.',
  /** The hidden heading the website gives the film's band. */
  heading: 'A walk through the proposed buildings',
};

/** The heading over the row of consultants' marks, under the film. */
export const TEAM_MARKS_HEADING =
  'Drawn by **Dewing Schmid Kearns**, with eight consulting firms under them';

/**
 * Which firms have a published mark.
 *
 * Seven of the nine. `code-red` and `dillis-roy` have none, and the row is
 * built from this rather than from `TEAM` for the reason the website reads its
 * logo directory rather than printing a path per firm: the obvious version
 * puts two broken images on the page the moment one is missing.
 */
export const FIRMS_WITH_MARKS: readonly string[] = [
  'dsk',
  'oak-consulting-group',
  'foley-buhl-roberts',
  'buro-happold',
  'crowley-cottrell',
  'mdm',
  'goddard-consulting',
];

/* ── The numbers ─────────────────────────────────────────────────────────── */

export type Figure = { value: string; label: string; note: string };

/** The four numbers a reader should leave with. */
export const HEADLINE: readonly Figure[] = [
  {
    value: '119,458',
    label: 'square feet',
    note: 'Across all three buildings and every floor. TOTAL BUILDING AREA schedule, sheet R0.',
  },
  {
    value: '570',
    label: 'seats',
    note: 'The figure the parking requirement is calculated from on the site layout plan.',
  },
  {
    value: '190',
    label: 'parking spaces',
    note: 'One per three seats, which is what the Wayland bylaw asks of a church. Six accessible.',
  },
  {
    value: '5.5',
    label: 'acres',
    note: 'The existing lot. Map 40, Lot 008 — no land is being bought.',
  },
];

/**
 * The whole 119,458 sq ft, split by what it is for.
 *
 * Straight off the AREA BY USE TYPE schedule that repeats on sheets R0 through
 * R4, summed across floors. The seven rows add to the total exactly; if you
 * change one, the total is a lie.
 */
export const BY_USE: readonly { use: string; area: number; of: string }[] = [
  {
    use: 'Function hall and congregational needs',
    area: 27736,
    of: 'The dining hall, the function room, the kitchens, the lobbies and the servery. Basement and ground floor.',
  },
  {
    use: 'Sunday school',
    area: 24055,
    of: 'Thirteen classrooms, a nurse station, lobbies and storage, on the basement and ground levels of Building B.',
  },
  {
    use: 'Church and congregation',
    area: 22521,
    of: 'The nave, the altars, the baptistery, the chorus, the deacons’ room, the foyer and the two crying rooms.',
  },
  {
    use: 'Retreat, athletics and children',
    area: 18514,
    of: 'A full-size sports court with locker rooms, a game room and a flexible hall.',
  },
  {
    use: 'Residential',
    area: 17889,
    of: 'One-bedroom apartments over the two upper floors of Building B, with a common room on each.',
  },
  { use: 'Diocese', area: 7240, of: 'Offices, a conference room and a lounge in Building C.' },
  {
    use: 'Plant',
    area: 1503,
    of: 'Mechanical, electrical and the rest of what a building this size needs and nobody sees.',
  },
];

export type Moment = { when: string; what: string };

/**
 * Where the work stands.
 *
 * Dates are the ones printed on the drawings themselves — the issue date in
 * the title block and the two revision lines — not dates anybody remembers.
 * The last entry has no date because it has not happened.
 */
export const PROGRESS: readonly Moment[] = [
  {
    when: '2016',
    what: 'St. Mark of Boston buys the Church of the Holy Spirit at 169 Rice Road, and this church begins — in a building designed for somebody else’s liturgy.',
  },
  {
    when: 'June 2025',
    what: 'The architects issue the first renderings of the church itself — Building A, on its own, without the site around it.',
  },
  {
    when: 'August 2025',
    what: 'The full set goes to the Town of Wayland: three buildings, forty-odd sheets, and seven consulting firms named on the cover — civil, structural, code, mechanical, transport, landscape.',
  },
  {
    when: 'November 2025',
    what: 'First revision, marked “per town review”, together with the survey of abutters the process requires.',
  },
  {
    when: 'December 2025',
    what: 'Second revision, again per town review, and the compiled set that this page was written from.',
  },
  {
    when: 'March 2026',
    what: 'The flythrough above is delivered — the first time the three buildings are shown in colour, with materials on them.',
  },
  {
    when: 'Next',
    what: 'Site plan approval from the Wayland Planning Board. The endorsement line on the cover sheet is still blank, and every drawing in the set is stamped “not for construction”. Nothing has been dug.',
  },
];

/**
 * The nine firms working on this, and what each one does.
 *
 * **This list is the page's strongest evidence.** A church saying "we are
 * planning a new building" is a wish. A church that can name a structural
 * engineer, a traffic consultant, a code consultant, a wetland scientist and a
 * licensed land surveyor — each on a specific sheet of a set already twice
 * revised in front of a planning board — is describing a project.
 *
 * Goddard Consulting has no town because no address is printed for them
 * anywhere in the set. It stays empty rather than guessed.
 */
export type TeamMember = {
  /** The website's slug for this firm, and the stem of its slot ids —
   *  `who-is-drawing-it.firm-buro-happold-role`. */
  slug: string;
  firm: string;
  role: string;
  town: string;
};

export const TEAM: readonly TeamMember[] = [
  { slug: 'dsk', firm: 'Dewing Schmid Kearns', role: 'Architects and planners', town: 'Concord, Massachusetts' },
  {
    slug: 'oak-consulting-group',
    firm: 'Oak Consulting Group',
    role: 'Civil engineering',
    town: 'Newburyport, Massachusetts',
  },
  {
    slug: 'foley-buhl-roberts',
    firm: 'Foley Buhl Roberts & Associates',
    role: 'Structural engineering',
    town: 'Portland, Maine',
  },
  {
    slug: 'buro-happold',
    firm: 'Buro Happold',
    role: 'Mechanical, electrical, plumbing and fire protection',
    town: 'Boston, Massachusetts',
  },
  { slug: 'crowley-cottrell', firm: 'Crowley Cottrell', role: 'Landscape architecture', town: 'Boston, Massachusetts' },
  {
    slug: 'mdm',
    firm: 'MDM Transportation Consultants',
    role: 'Traffic and transport',
    town: 'Marlborough, Massachusetts',
  },
  {
    slug: 'code-red',
    firm: 'Code Red Consultants',
    role: 'Building and fire code',
    town: 'Southborough, Massachusetts',
  },
  { slug: 'goddard-consulting', firm: 'Goddard Consulting', role: 'Wetland delineation and ecology', town: '' },
  {
    slug: 'dillis-roy',
    firm: 'Dillis & Roy Civil Design Group',
    role: 'Land survey and existing conditions',
    town: 'Concord, Massachusetts',
  },
];

/* ── The prose ───────────────────────────────────────────────────────────── */

export const HERO = {
  eyebrow: 'About',
  title: 'Future Plans',
  lede: 'A church, a youth centre with housing above it, and a diocese centre — three buildings on the land at 169 Rice Road, drawn and filed with the town. None of it is built. This is what has been designed, and how far it has got.',
};

export const WHAT = {
  title: 'Three buildings, one courtyard',
  body: [
    'The church now worships in a building it did not build. It was put up for an Episcopal congregation, it was bought in 2016, and the altar, the screen and the icons in it were fitted into a room that was designed around a different service. [How that happened](/about/who-we-are) is its own story. What was always going to follow from it is this one.',
    'The design puts three buildings around a paved court. The church stands at the east end, on the highest part of the site, with its doors facing the car park across a broad flight of steps. Behind it and to the north runs the long building that holds the Sunday school on its lower floors and one-bedroom apartments above. Between them and Rice Road sits the diocese centre, the smallest of the three.',
    'They are one project and they are not one building. The church is drawn in the Coptic language of arches, vaults and a dome; the other two are plainly and deliberately not, so that a reader driving past can tell at a glance which of the three is the church.',
    'It has been drawn by an architecture practice with eight consulting firms working under it — structural, civil, traffic, code, mechanical, landscape, wetland and survey — and the drawings have been in front of the Wayland Planning Board since August 2025.',
  ],
};

export const BUILDING_A = {
  tag: 'Building A',
  title: 'The church',
  body: [
    'A nave of 5,429 square feet under barrel vaults, with a dome over the crossing and a gallery above the west end. Seating for 570 — about three times what the present building holds. The main altar stands at the east with a side altar to either side of it, which is the Coptic arrangement: three sanctuaries behind one screen, so that more than one Liturgy can be served on a morning when more than one is needed.',
    'Around them the rooms a Liturgy actually needs and the present building improvises: a baptistery off the nave, a chamber for the relics, a room for the deacons to vest in, a chorus, and two crying rooms — one on each level — so that a parent with a small child can still see and hear the altar.',
    'The floor of the church sits sixteen feet above the car park. That is the reason the approach is a flight of steps and the reason there is a ramp beside it, drawn at one in twelve with seven landings, so that the same doors are the way in for everybody.',
    'It also means there is a whole floor underneath the nave, and that floor is where most of a Sunday actually happens: a dining hall of 4,050 square feet, a kitchen with a pantry and a receiving door behind it, a bakery for the bread, the bookstore, the three church offices, and a small chapel of 887 square feet for the weekday services that do not need 570 seats.',
  ],
};

export const BUILDING_B = {
  tag: 'Building B',
  title: 'Sunday school, sport, and housing',
  body: [
    'The largest of the three at 60,458 square feet, and the one that carries most of what the church does between Sundays. Thirteen classrooms on the ground floor, from 487 to 665 square feet, with a nurse station and a staff kitchen among them and more Sunday school space on the floor below. A flexible room of 2,810 square feet, and a game room beside it.',
    'Behind those, a full-size sports court of 7,400 square feet with locker rooms off it — a real court, marked for basketball, not a hall with a hoop at one end. It is the single largest room in the project after the nave.',
    'Above all of it are twenty-one one-bedroom apartments across two floors, with a common room on each, reached by their own stairs and lift. They are drawn for older members of the congregation: housing on the same ground as the church, so that growing old does not mean leaving it.',
  ],
};

export const BUILDING_C = {
  tag: 'Building C',
  title: 'The diocese centre',
  body: [
    'The smallest of the three, at 23,983 square feet over three levels, and the one that serves beyond this congregation. Its ground floor is the function room — 5,639 square feet drawn with twenty-four round tables in it, its own kitchen and its own lobby off the car park, so a wedding or a funeral reception does not have to be held in the room the Liturgy was just served in.',
    'Above that, offices, a conference room, a lounge and three apartments. Below it, a hall with dressing rooms either side.',
    'It stands closest to Rice Road, on roughly the ground the present church occupies — which is the plain reason the present church has to come down before this one can go up.',
  ],
};

export const MORE_VIEWS = {
  eyebrow: 'Ten more views',
  title: 'Walk round it',
  lede: 'More frames from the same flythrough — the approach, the court, the two buildings behind, and the whole site from above.',
};

export const ALL_OF_IT = {
  eyebrow: '119,458 square feet, accounted for',
  title: 'What the space is for',
  lede: 'Straight off the schedule that repeats on every floor plan in the filed set, summed across the three buildings. The seven lines add to the total exactly.',
};

export const THE_LAND = {
  eyebrow: 'Five and a half acres',
  title: 'How it sits on the land',
  lede: 'The lot is the one the church already owns — Map 40, Lot 008, between Rice Road and Turkey Hill Road. No land is being bought, and the buildings are fitted to what is there.',
  body: [
    'The three buildings are set back from both streets and turned inward, so that what they enclose is a courtyard rather than a frontage. The car park wraps around the outside: 190 spaces, six of them accessible, which is exactly what the Wayland bylaw asks for a church of 570 seats, and a fire access road runs the length of the north boundary.',
    'Built footprint comes to 18 per cent of the lot against a limit of 20, and just under two acres is left as open space. A brook crosses the north-west corner of the property, and the drawings show the work inside its buffer measured, drawn and kept small — a little over two thousand square feet of it. Two species of native cedar are specified for the planting.',
    'The present church is drawn on the site plan as a dashed outline marked *outline of existing church to be demolished*. That is the hardest line on the sheet, and it is the honest one: the congregation would be worshipping in the building on the day the drawings for its replacement are approved.',
  ],
};

export const WHERE_IT_STANDS = {
  eyebrow: 'Nothing has been dug',
  title: 'Where the work stands',
  lede: 'Dates below are the ones printed on the drawings themselves, not dates anybody remembers.',
  foot: [
    'Every sheet in the set is stamped *not for construction*, and the line on the cover reading *date site plan endorsed* is still blank. The design has been revised twice already in answer to the town’s review, and it can be revised again. What is on this page is a proposal in front of a planning board, which is a real and specific stage and is not the same thing as a building.',
    'Building it is the work of years and of the congregation’s [offering](/giving). If you want to know where it has got to since this page was written, [ask the office](/contact) — that answer will be current and this one will not.',
  ],
};

export const WHO_IS_DRAWING = {
  eyebrow: 'Nine firms',
  title: 'Who is drawing it',
  lede: 'A structural engineer, a traffic consultant, a code consultant, a wetland scientist and a licensed land surveyor, each named on the sheets they are responsible for. This is not a sketch somebody made for the church.',
  credit:
    'All views on this page are renderings by Dewing Schmid Kearns Architects + Planners, drawn for the church — eight of them frames from the flythrough of 19 March 2026, and two of them sheets from the set filed with the Town of Wayland in December 2025. Nothing here is a photograph, and nothing here is final.',
};

export const PAYING = {
  title: 'Paying for it',
  lede: 'The drawings are paid for. The buildings are not, and they will be built the way everything in this church is built — out of what the congregation gives.',
  fund: 'When the form opens, change the fund to **SPSM Construction Project**. It opens on the general fund, and an offering left there supports the church’s day-to-day work rather than this.',
  note: 'One offering or a recurring one, through the church’s Tithe.ly form. [More ways to give](/giving).',
};
