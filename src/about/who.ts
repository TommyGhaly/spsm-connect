/**
 * Who We Are — the words, the dates, and the seven pictures.
 *
 * ---------------------------------------------------------------------------
 * A port of the website's `features/who`: `WhoScreen.tsx`'s prose,
 * `chronologies.ts`, `clergy.ts` and `images.ts`, in the shapes this app's
 * `parts.tsx` reads. The words are the website's word for word, which is the
 * point — somebody who reads this page on a phone and then on a laptop
 * should not find two churches.
 *
 * **The duplication is deliberate and it has a cost.** A correction on the
 * website is not a correction here until somebody makes it here too. The
 * alternative was reading these pages over the network, which would mean the
 * app's history of the Church is blank on a bad connection and empty on a
 * failed read — and this is the one kind of content that never changes between
 * releases. The pictures, which are the part that *does* get replaced, are
 * fetched rather than bundled; see `media.ts`.
 *
 * If a third frontend ever wants this, that is the moment to lift it into
 * `@spsm/shared` rather than to copy it a second time.
 * ---------------------------------------------------------------------------
 */
import { whoPicture } from './media';
import type { PictureMeta } from './parts';

/* ── Pictures ────────────────────────────────────────────────────────────── */

/**
 * Every one is public domain, CC0 or "no restrictions", and that is a
 * constraint rather than a coincidence — see the header of the website's
 * `features/who/images.ts`. The credits are still listed below.
 *
 * `width` is the real width of the large file, not 1280: the optimiser resizes
 * without enlarging, so the 1,015px portrait of Pope Kyrillos stays 1,015px.
 * The plate's aspect ratio is computed from these, so a wrong number here is a
 * caption that jumps when the picture lands.
 */
export const WHO_PICTURES = {
  'coptic-family': {
    alt: 'A hand-coloured print of five people — an old bearded man seated with a staff, two women, a girl and a small child — posed together in Egyptian dress.',
    caption:
      'A Coptic family, from a European illustrated book of the late nineteenth century. The pyramids behind them are painted in; the framing is the publisher’s, not theirs. For most of the Church’s history this is the only sort of picture of ordinary Copts that outsiders made.',
    width: 1280,
    height: 1739,
  },
  'desert-monastery': {
    alt: 'A walled monastery of pale stone with a bell tower and cross, set among date palms below a long red desert cliff.',
    caption:
      'The Monastery of St. Antony, under the cliffs of the Eastern Desert. Monks have lived on this site since the fourth century, and every monastery in the world descends from what began here.',
    width: 1280,
    height: 960,
  },
  'coptic-houses-cairo': {
    alt: 'An albumen photograph of a Cairo street: tall stone houses with tiers of latticed wooden bay windows overhanging an empty dirt square.',
    caption:
      'Coptic houses in Cairo, photographed in the nineteenth century. The latticed upper storeys are mashrabiya — the same building language as the Muslim city around them, which is the point.',
    width: 1280,
    height: 970,
  },
  'coptic-monks': {
    alt: 'A black-and-white photograph of eight Coptic monks in black robes and turbans, one seated at the centre holding an icon, the rest standing around him against a stone wall.',
    caption:
      'Coptic monks, photographed early in the twentieth century. The habit is unchanged; so is the practice of putting the eldest in the chair and everyone else around him.',
    width: 1280,
    height: 995,
  },
  'pope-kyrillos': {
    alt: 'A portrait of Pope Kyrillos VI in a dark embroidered vestment and domed headdress, holding a pastoral staff.',
    caption:
      'Pope Kyrillos VI, 116th Pope of Alexandria from 1959 to 1971. He is the one who started sending priests after the emigrants — including the first two to America.',
    width: 1015,
    height: 1549,
  },
  'pope-shenouda': {
    alt: 'A close portrait of Pope Shenouda III, white-bearded, in a domed black headdress and gold-embroidered vestment, looking past the camera.',
    caption:
      'Pope Shenouda III, who led the Church for forty years and under whom nearly every Coptic church in North America was founded. He first came to the United States in 1977 and stayed two months.',
    width: 1280,
    height: 1920,
  },
  'queens-church': {
    alt: 'A grey neoclassical church with fluted columns and a bell tower, a Coptic cross standing on top of it, seen from the street corner against a clear sky.',
    caption:
      'SS. Mary and Antonius in Ridgewood, Queens — an American church of another century, with a Coptic cross on the tower. Nearly every Coptic church in the north-east began in a building somebody else built and could no longer fill.',
    width: 1280,
    height: 1707,
  },
} as const satisfies Record<string, PictureMeta>;

export type WhoPictureName = keyof typeof WHO_PICTURES;

export const who = (name: WhoPictureName) => whoPicture(name);

export const WHO_CREDITS = [
  {
    what: 'A Coptic family, nineteenth century',
    author: 'Unidentified',
    license: 'Public domain',
    page: 'https://commons.wikimedia.org/wiki/File:Famille_Copte.jpg',
  },
  {
    what: 'The Monastery of St. Antony',
    author: 'Tentoila',
    license: 'Public domain',
    page: 'https://commons.wikimedia.org/wiki/File:St._Anthony%27s_Monastery_2006.jpg',
  },
  {
    what: 'Coptic houses, Cairo',
    author: 'Cornell University Library',
    license: 'No known restrictions',
    page: 'https://commons.wikimedia.org/wiki/File:Coptic_Houses,_Cairo.jpg',
  },
  {
    what: 'Coptic monks',
    author: 'American Colony (Jerusalem), Photo Department',
    license: 'Public domain',
    page: 'https://commons.wikimedia.org/wiki/File:Coptic_monks.jpg',
  },
  {
    what: 'Pope Kyrillos VI',
    author: 'Raafat',
    license: 'Public domain',
    page: 'https://commons.wikimedia.org/wiki/File:Pope_Cyril_VI_of.jpg',
  },
  {
    what: 'Pope Shenouda III',
    author: 'Chuck Kennedy, White House Photostream',
    license: 'Public domain',
    page: 'https://commons.wikimedia.org/wiki/File:Pope_Shenouda_III_of_Alexandria_by_Chuck_Kennedy_(Official_White_House_Photostream).jpg',
  },
  {
    what: 'SS. Mary and Antonius, Ridgewood, Queens',
    author: 'Jim Henderson',
    license: 'CC0',
    page: 'https://commons.wikimedia.org/wiki/File:Mary_%26_Antonionus_Coptic_Ch_606_Woodward_Av_Ridgewood_NY_11385_jeh.jpg',
  },
] as const;

/* ── The two dated spines ────────────────────────────────────────────────── */

export type Moment = { when: string; what: string };

/**
 * Egypt, from St. Mark to the emigration.
 *
 * The councils get one line each and no more. Our Belief is the page that
 * explains Nicaea, Ephesus and Chalcedon.
 */
export const EGYPT: readonly Moment[] = [
  {
    when: 'c. 43',
    what: 'St. Mark the Evangelist preaches in Alexandria. He is martyred there, and the line of his successors has not been broken since.',
  },
  {
    when: 'c. 270',
    what: 'St. Antony goes out into the Eastern Desert. St. Pachomius gathers the first communities a generation later; monasticism begins in Egypt and spreads from it to the whole Church.',
  },
  {
    when: '284',
    what: 'Diocletian takes the throne, and the persecution under him costs Egypt more Christians than any other province. The Coptic calendar counts its years from this one — Anno Martyrum, the Year of the Martyrs.',
  },
  {
    when: '325',
    what: 'The Council of Nicaea. Athanasius of Alexandria goes as a deacon and spends the next forty-five years defending what it wrote.',
  },
  {
    when: '431',
    what: 'The Council of Ephesus, with St. Cyril of Alexandria presiding, confesses the Virgin Mary as Theotokos.',
  },
  {
    when: '451',
    what: 'The Council of Chalcedon. Alexandria holds to St. Cyril’s formula and does not receive it, and the Coptic Orthodox Church has been a separate communion from that year on.',
  },
  {
    when: '641',
    what: 'The Arab conquest of Egypt. Over the following centuries the Christians of Egypt become a minority in their own country, and the Arabic qibṭ — from the Greek for Egyptian — becomes the word Copt.',
  },
  {
    when: '828',
    what: 'Venetian merchants take the relics of St. Mark out of Alexandria. They are in Venice for the next eleven hundred years.',
  },
  {
    when: '1900',
    what: 'Habib Girgis, a lay teacher, begins the Sunday School movement — fifteen years before Egypt had public schools. It taught the generation that would later lead the Church, and he was canonised in 2013.',
  },
  {
    when: '1959',
    what: 'Pope Kyrillos VI is enthroned. In twelve years he rebuilds the monasteries, restores the shrine of St. Mina at Mariout, and begins sending priests after Copts who have left the country.',
  },
  {
    when: '1968',
    what: 'The relics of St. Mark are returned to Cairo, and the new cathedral built to receive them is consecrated on 25 June. The same year, the American law that would bring tens of thousands of Copts to the United States takes full effect.',
  },
];

/**
 * New England, from a borrowed hall to this church.
 *
 * The dates before 2016 are St. Mark of Boston's, in Natick, because this
 * church's own history starts inside theirs.
 */
export const NEW_ENGLAND: readonly Moment[] = [
  {
    when: 'the 1960s',
    what: 'Visiting priests begin offering the Liturgy for Egyptian Orthodox Christians around Boston, many of them students.',
  },
  {
    when: '1972',
    what: 'The congregation starts renting Sts. Constantine and Helen, a Greek Orthodox church in Cambridge.',
  },
  {
    when: 'the late 1970s',
    what: 'Copts in Massachusetts ask for a priest of their own. Fr. Salib Ava Mina is sent, and the congregation moves into a rented Episcopal church in Newtonville.',
  },
  {
    when: '1985',
    what: 'They buy 145 Oak Street in Natick — a former Protestant church — for $300,000, and found St. Mark Coptic Orthodox Church of Boston there the following year.',
  },
  {
    when: '1990',
    what: 'Fr. Mousa Elgohary becomes the first full-time Coptic Orthodox priest in New England.',
  },
  {
    when: '2013',
    what: 'The Diocese of New York and New England is established, and Bishop David is consecrated its first bishop in Cairo that November.',
  },
  {
    when: '2016',
    what: 'St. Mark of Boston buys the Church of the Holy Spirit in Wayland, and this church begins.',
  },
];

/* ── The clergy ──────────────────────────────────────────────────────────── */

export type Cleric = {
  /** The website's `content` slug for this person, and the stem of their slot
   *  ids — `the-clergy-here.cleric-fr-armia-tawfik-note`. */
  slug: string;
  name: string;
  rank: string;
  note: string;
};

/**
 * In order of rank, then of when each was set here.
 *
 * The bishop first because the diocese is the church's, not the other way
 * round: a Coptic Orthodox church is a bishop's church served by his priests.
 * The three deacons follow the three fathers, as one list.
 *
 * The portraits are the website's, from `public/img/clergy/<slug>@2x.webp`.
 * All six have one today; `clericInitial` below is what a seventh gets on the
 * day he is named here, and it is the website's fallback rather than an
 * ornament — a mark standing for "no photograph yet" should still say who it
 * is.
 */
export const ROSTER: readonly Cleric[] = [
  {
    slug: 'bishop-david',
    name: 'H.G. Bishop David',
    rank: 'Bishop of the Diocese of New York and New England',
    note: 'Consecrated in Cairo on 16–17 November 2013 as the first bishop of the diocese, and enthroned that December.',
  },
  {
    slug: 'fr-youhanna-gobran',
    name: 'Hegumen Youhanna Gobran',
    rank: 'Priest',
    note: 'Ordained priest by Pope Shenouda III on 12 January 2002 and served at St. Mark in Natick. Set here by Bishop David in 2016, and elevated to hegumen in November 2022.',
  },
  {
    slug: 'fr-armia-tawfik',
    name: 'Fr. Armia Tawfik',
    rank: 'Priest',
    note: 'Ordained by Bishop Timotheos on 27 November 2015 and served in Zagazig, Egypt. Appointed here by Bishop David in January 2024.',
  },
  { slug: 'deacon-severus-ghaly', name: 'Deacon Severus Ghaly', rank: 'Deacon', note: 'Ordained in 2018.' },
  { slug: 'deacon-peter-awadalla', name: 'Deacon Peter Awadalla', rank: 'Deacon', note: 'Ordained in 2019.' },
  { slug: 'deacon-kyrillos-bebawy', name: 'Deacon Kyrillos Bebawy', rank: 'Deacon', note: 'Ordained in 2026.' },
];

/**
 * The initial to show in place of a missing photograph.
 *
 * The rank is stripped first, or all three deacons show a D. The website
 * shares this function between its roster and its homepage, for the reason it
 * gives there: the two must not disagree about which letter stands for a
 * person.
 */
export function clericInitial(name: string): string {
  return name
    .trim()
    .replace(/^(H\.G\.|H\.H\.|Fr\.|Deacon|Hegumen)\s+/, '')
    .charAt(0)
    .toUpperCase();
}

/**
 * The sanctuary at Wayland — the one photograph on these five pages that is of
 * this church.
 *
 * Kept apart from `WHO_PICTURES` for the reason the website keeps it apart:
 * those are Wikimedia plates with credits behind them and this is the church's
 * own room, which obliges nobody and belongs in no credits list. It is also
 * the only picture here served from the site root rather than from
 * `/img/who/`.
 */
export const SANCTUARY = {
  src: '/img/home-sanctuary-1600.webp',
  meta: {
    alt: 'The sanctuary at Wayland: a carved wooden screen across the front of the church, icons set into it, and the altar behind.',
    caption:
      'The sanctuary at Wayland. The screen, the icons and the altar behind them were put in by this congregation; the walls around them were built by another one.',
    width: 2400,
    height: 926,
  },
};

/* ── The prose ───────────────────────────────────────────────────────────── */

export const HERO = {
  eyebrow: 'About',
  title: 'Who We Are',
  lede: 'A Coptic Orthodox church in Wayland, Massachusetts. The Church it belongs to was founded in Alexandria in the first century and has been in Egypt ever since; this building has been ours since 2016. What follows is how the one reached the other.',
};

export const ORIGIN = {
  title: 'A word that means Egyptian',
  body: [
    'The Coptic Orthodox Church began in Alexandria. St. Mark the Evangelist brought the Gospel there around the middle of the first century and was martyred in the city, and the Church he founded has had an unbroken line of successors in that see ever since. Its patriarch is the Pope of Alexandria. This church in Wayland belongs to it.',
    '*Copt* is not the name of a denomination. It is the Greek word for Egyptian, which the Arabs shortened to *qibṭ* after they arrived in the seventh century, and which came back into English as Copt. For a long stretch of history it meant both things at once — Egyptian, and Christian — because in Egypt those were the same people.',
    'The language is the same story. Coptic is the last stage of the language of the pharaohs, written in Greek letters with seven signs kept back from demotic for the sounds Greek had no letters for. It stopped being spoken in the street centuries ago. It is still the language of the Liturgy, and a child learning to serve in the altar in Massachusetts learns to read it.',
  ],
};

export const IN_EGYPT = {
  eyebrow: 'Nineteen centuries, one country',
  title: 'The Church in Egypt',
  lede: 'The councils get a line each here and no more. What they decided, and why it is said aloud every Sunday, is on [Our Belief](/about/our-belief).',
};

export const MINORITY = {
  title: 'A minority at home',
  body: [
    'After 641 the Christians of Egypt did not go anywhere. They became, slowly and over centuries, a minority in the country they had always lived in — taxed as one, governed as one, and periodically persecuted as one. The Church that came out of that is not the Church of the majority anywhere, and has never organised itself as though it expected to be.',
    'What it did instead was keep things. It kept the calendar counted from the martyrs. It kept the fasts, which still take up more than half the year. It kept the language in the Liturgy long after the language had died everywhere else. And it kept the monasteries, which is where its bishops still come from — a Coptic bishop is a monk first, and the Pope of Alexandria is chosen from among the monks.',
    'The renewal that produced the Church as it is now started with a layman. In 1900 Habib Girgis, a teacher at the theological college in Cairo, began organising Sunday schools — fifteen years before Egypt had public schools at all. By 1949 the movement had 2,500 teachers and 43,000 children in it, and the men it taught became the monks, priests and bishops of the next fifty years. In 1959 Pope Kyrillos VI was enthroned, and in twelve years he rebuilt the monasteries and restored the shrine of St. Mina at Mariout — the saint the second half of this church is named for.',
  ],
};

export const CROSSING = {
  title: 'The crossing',
  body: [
    'Copts began arriving in America in small numbers early in the twentieth century, and in larger ones after 1952, when the revolution and the nationalisations that followed it — of businesses, of land, including land willed to churches and monasteries — made staying harder for exactly the educated class the Church had spent fifty years teaching. Then in 1965 the United States repealed the national-origins quotas that had kept the door mostly shut to anyone not European. The new law took full effect in 1968, a year after Egypt’s defeat in the Six-Day War, and a generation of Coptic engineers, doctors and pharmacists left.',
    'They arrived without churches. The first Coptic organisation in the country, the Coptic American Association, was founded in 1964 and had two hundred members by the end of that year — a mailing list, not a congregation. Pope Kyrillos VI answered by sending priests after them: Fr. Bishoy Kamel to Los Angeles in 1969, and Fr. Rofael Nakhla, who prayed the first Liturgy in the first Coptic church building in the United States — a church bought and renovated in Jersey City — on 22 March 1970.',
  ],
  more: [
    'By 1976 there were ten. Pope Shenouda III, who succeeded Kyrillos in 1971 and led the Church for forty years, came to the United States in 1977 and stayed two months, which for a Pope of Alexandria was without precedent. The first two American dioceses were established in 1995. By 2007 there were something like two hundred Coptic churches in the country.',
    'Almost none of them was built as one. They are former Methodist, Catholic, Presbyterian and Episcopal churches, bought from congregations that had grown too small to fill them, with a Coptic cross put up on the roof. That is not a temporary arrangement anybody is embarrassed by. It is what the Coptic Orthodox Church in America mostly looks like, and it is what this church is.',
  ],
};

export const IN_NEW_ENGLAND = {
  eyebrow: 'Borrowed rooms, then bought ones',
  title: 'New England',
  lede: 'The same thing happened here, later and smaller. Boston had Egyptian students before it had a Coptic church, and everything Coptic in this part of the country grew out of one building in Natick — including us.',
};

export const THIS_CHURCH = {
  title: 'This church',
  body: [
    'The Church of the Holy Spirit, at 169 Rice Road in Wayland, was an Episcopal church. Its congregation had grown small, and in June 2015 it held its last service. St. Mark of Boston bought the building in January 2016.',
    'On 24 February 2016 the two churches held one service in it to hand over the ecclesiastical authority — Episcopal hymns and Coptic prayers, the Coptic clergy and Bishop Gayle Harris of the Episcopal Diocese of Massachusetts together, and more than two hundred people, a good number of whom had been baptised or married in that room. It was a handing on rather than a closing. In June 2017 the property passed from St. Mark to St. Philopater Mercurius & St. Mina, and the church took the name it has now — a soldier martyred under Julian, and a soldier martyred under Diocletian, whose shrine in the desert west of Alexandria was rebuilt in the same decade the first Copts were landing in New York. Both of them are on [Our Patron Saints](/about/patron-saints).',
    'The Liturgy is prayed in this building in Coptic, Arabic and English, by people whose grandparents prayed it in Egypt and by people who found the church last month. It has outgrown the room, and what the church intends to build instead is on [Future Plans](/about/future-plans). Some maps still label the building Holy Spirit. That is not wrong about it, and nobody here is in a hurry to have it corrected.',
  ],
};

export const CLERGY_HEAD = {
  eyebrow: 'Serving here',
  title: 'The clergy',
  lede: 'A Coptic Orthodox church is a bishop’s church, served by his priests. A deacon is not an apprentice priest — the order is its own, and permanent. Deacons chant the responses, read the Epistle and keep the altar’s service moving, which means most of what a visitor hears at a Liturgy here is sung by them.',
};
