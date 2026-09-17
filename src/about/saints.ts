/**
 * Our Patron Saints — the two lives, the feast days, and the seven pictures.
 *
 * A port of the website's `features/saints` and the prose in
 * `app/about/patron-saints/page.tsx`. See the header of `who.ts` for why the
 * words are copied rather than fetched.
 *
 * **On the history.** The lives are the Coptic Synaxarium's, read against the
 * accounts the wider Church keeps, and where the two disagree — Mercurius was
 * born in Rome, or in Cappadocia — the page says that they disagree instead of
 * quietly picking one. The Julian story is given as what the Church has
 * painted rather than as something that happened, because that is its actual
 * standing. Do not tidy either of those into a single claim.
 */
import { saintPicture, saintThumb } from './media';
import type { PictureMeta } from './parts';

/* ── Pictures ────────────────────────────────────────────────────────────── */

export const SAINT_PICTURES = {
  'mercurius-icon': {
    alt: 'A Coptic icon of a young soldier on a black horse, a sword raised in each hand, an angel above him holding out one of them, and a crowned man falling under the horse’s hooves.',
    caption:
      'The two swords: the one the army issued him and the one the angel brought. The crowned figure beneath the horse is Julian; the bishop at the left is St. Basil.',
    width: 792,
    height: 1186,
  },
  'mercurius-triptych': {
    alt: 'A black and white photograph of a painted wooden triptych hanging on a plastered wall, a mounted saint in the centre panel and a robed elder on each wing.',
    caption:
      'The same saint on a triptych at the Monastery of St. Paul in the Eastern Desert, photographed there in 1930.',
    width: 1100,
    height: 824,
  },
  'mercurius-church-cairo': {
    alt: 'The inside of an ancient church: two rows of stone columns, a dark wooden screen inlaid with crosses across the far end, and oil lamps hanging from a great chandelier.',
    caption:
      'The Church of St. Mercurius in Old Cairo — Dayr Abu Sefein — where his relics are kept.',
    width: 1100,
    height: 733,
  },
  'mina-mosaic': {
    alt: 'A mosaic of a young soldier in a red cloak and blue tunic, both arms raised open at his sides, with a camel kneeling on either side of him and a church in the distance behind.',
    caption:
      'St. Mina in the cathedral of the monastery at Mariout, standing between the two camels he is never shown without.',
    width: 600,
    height: 821,
  },
  'mina-plaque': {
    alt: 'A carved ivory plaque of a soldier standing under an arch with both hands raised, a kneeling camel on each side of him.',
    caption:
      'A sixth-century plaque carried out of Alexandria, now in Milan. The open hands are how the early Church is shown praying.',
    width: 1100,
    height: 1080,
  },
  'mina-ampulla': {
    alt: 'A small round clay flask with two handles, stamped with a standing figure between two animals inside a beaded circle.',
    caption:
      'A pilgrim’s flask filled at the shrine and carried home. They have been dug up as far away as France and Germany.',
    width: 1100,
    height: 1469,
  },
  'mina-basilica': {
    alt: 'Low stone walls, broken column bases and scattered blocks of white marble on flat desert sand under a clear sky.',
    caption: 'What is left of the Great Basilica at Abu Mina, in the desert south-west of Alexandria.',
    width: 1100,
    height: 825,
  },
} as const satisfies Record<string, PictureMeta>;

export type SaintPictureName = keyof typeof SAINT_PICTURES;

export const saint = (name: SaintPictureName) => saintPicture(name);
export const saintSmall = (name: SaintPictureName) => saintThumb(name);

export const SAINT_CREDITS = [
  {
    what: 'Icon of St. Mercurius',
    author: 'Yuhannarmani',
    license: 'CC BY-SA 3.0',
    page: 'https://commons.wikimedia.org/wiki/File:Yuhanna-Mercurius.jpg',
  },
  {
    what: 'Triptych at the Monastery of St. Paul',
    author: 'Kazazian, for Dumbarton Oaks',
    license: 'CC0',
    page: 'https://commons.wikimedia.org/wiki/File:Triptych_icon_of_Saint_Mercurius,_Monastery_of_Saint_Paul,_Egypt_-_MSBZ004_B17_-_Dumbarton_Oaks.jpg',
  },
  {
    what: 'The Church of St. Mercurius, Old Cairo',
    author: 'Sailko',
    license: 'CC BY 3.0',
    page: 'https://commons.wikimedia.org/wiki/File:Cairo,_monastero_di_san_mercurio,_02.JPG',
  },
  {
    what: 'Mosaic of St. Mina at the monastery, Mariout',
    author: 'Roland Unger',
    license: 'CC BY-SA 3.0',
    page: 'https://commons.wikimedia.org/wiki/File:DeirAbuMena.jpg',
  },
  {
    what: 'Sixth-century plaque from Alexandria, Castello Sforzesco, Milan',
    author: 'Sailko',
    license: 'CC BY 2.5',
    page: "https://commons.wikimedia.org/wiki/File:Tavoletta_paleocristiana_con_san_mena,_da_alessandria_d'egitto.JPG",
  },
  {
    what: 'Pilgrim flask, the Metropolitan Museum of Art',
    author: 'The Metropolitan Museum of Art',
    license: 'CC0',
    page: 'https://commons.wikimedia.org/wiki/File:Ampulla_(Flask)_with_Saint_Menas_MET_DP258369.jpg',
  },
  {
    what: 'The Great Basilica at Abu Mina',
    author: 'Institute for the Study of the Ancient World',
    license: 'CC BY 2.0',
    page: 'https://commons.wikimedia.org/wiki/File:Ruins_of_the_Great_Basilica_at_Abu_Mena_(I).jpg',
  },
] as const;

/* ── Feast days ──────────────────────────────────────────────────────────── */

/**
 * A day the Church keeps for one of them.
 *
 * Both dates, always. The Coptic date is the one the Synaxarium is read on and
 * the one a Coptic calendar prints; the Gregorian date is the one a visitor
 * reading this in Wayland can find on their phone. Giving only the first is
 * accurate and useless to a newcomer, and giving only the second quietly drops
 * the calendar the Church actually keeps.
 *
 * The Gregorian dates hold for an ordinary year and slip by a day in the year
 * before a Coptic leap year.
 */
export type Feast = { coptic: string; gregorian: string; what: string };

export const MERCURIUS_FEASTS: readonly Feast[] = [
  { coptic: '25 Hathor', gregorian: '4 December', what: 'His martyrdom' },
  { coptic: '25 Abib', gregorian: '1 August', what: 'The consecration of his church' },
];

export const MINA_FEASTS: readonly Feast[] = [
  { coptic: '15 Hathor', gregorian: '24 November', what: 'His martyrdom' },
  { coptic: '15 Paoni', gregorian: '22 June', what: 'The consecration of his church at Mariout' },
];

/* ── The prose ───────────────────────────────────────────────────────────── */

export const OPENING = {
  eyebrow: 'The names on this church',
  title: 'Two soldiers',
  /*
   * The opening line is the first paragraph of `body`, not a standfirst beside
   * it. That is the website's own shape — over there it is a `.lede`-classed
   * `<p>` *inside* the `both-heading.body` editable — and it matters here for
   * one reason: `both-heading` declares no `lede` slot, so a line kept out of
   * the body would be the one paragraph on this page an edit could not reach.
   */
  body: [
    'Sixty years apart, two officers of the Roman army were ordered to sacrifice to the gods of the empire. Both refused, said why, and were beheaded for it. This church carries both their names.',
    'They were not bishops or theologians and neither of them wrote anything. What the Church has of them is how they died and what they said before they died, kept in the Synaxarium — the book of the saints, read aloud in the liturgy on the day each of them was killed. The Church calls that day their birth.',
    'Martyrs are not a footnote to Coptic history; they are how the Coptic Church counts time. Its calendar begins in the year 284, the year Diocletian took the throne and the persecution began that killed St. Mina — the Year of the Martyrs, still printed on every Coptic calendar. To name a church for two of them is to ask for their prayers, and to keep their days.',
  ],
};

export const MERCURIUS = {
  eyebrow: 'About 225 to 250',
  title: 'St. Philopater Mercurius',
  note: 'Abu Sefein — father of the two swords',
  body: [
    'Philopater is Greek for *lover of the Father*, and it is the name his Christian parents gave him. The accounts differ on where they lived: the Synaxarium read in the Coptic Church puts the family in Rome, and the Greek accounts put them in Cappadocia. From his enlistment on they agree.',
    'He joined the army at seventeen, under the emperor Decius, and was quickly known for it. On a campaign against the barbarians an angel in white stood in front of him and held out a sword, saying: when you have overcome your enemies, remember the Lord your God. The Romans won the battle, and the emperor made him a commander.',
    'He now had two swords — the one the army had issued him and the one the angel had brought. That is where the name he is usually called by comes from. In Egypt he is Abu Sefein, أبو سيفين, the father of the two swords, and it is the two swords, not the sword, that the icons put in his hands.',
    'Then Decius went to the temple to burn incense and sent for him. He did not come. Asked why, he said that he worshipped no one except his Lord and his God Jesus Christ. He was stripped of his rank, beaten and imprisoned. The emperor did not kill him in Rome — the soldiers and the city were fond of him — so he was sent in irons to Caesarea in Cappadocia and beheaded there, on 25 Hathor, in about the year 250. He was twenty-five.',
  ],
  julian: {
    title: 'The emperor under the horse',
    body: [
      'A hundred years later a second story attaches to him. Julian, the emperor who tried to give the empire back its old gods, marched east against Persia and did not return: he was killed by a spear thrown by someone nobody ever identified. What the Church in Cappadocia said was that St. Basil had prayed before the martyr’s icon for the Church’s deliverance, and that the spear in the icon came back wet.',
      'The Church has never made a doctrine of that. It has painted it for sixteen centuries, which is why there is a crowned man falling under the horse in nearly every icon of St. Mercurius, and a bishop watching from the edge of the frame.',
    ],
  },
  now: {
    title: 'Where he is now',
    body: [
      'His relics are in Old Cairo, in the church that carries his name inside the walled compound Egyptians call Dayr Abu Sefein. A convent stands beside it, and the church is one of the oldest still in use in the city.',
    ],
  },
};

export const MINA = {
  eyebrow: 'About 285 to 309',
  title: 'St. Mina the Wonder-worker',
  note: 'Mari Mina el-Agaiby — Mina the miraculous',
  body: [
    'He was born at Niceous in the Delta, the son of Eudoxius, who governed the town, and of Euphemia, who had no children for years. The Synaxarium says she prayed in front of an icon of the Virgin and heard the answer *Amen*, and that they took the boy’s name from it.',
    'His father died when he was a boy. At fifteen he went into the army and was posted to Cotyaeum, in Phrygia. When Diocletian’s edict against the Christians reached the garrison he handed back the belt of his rank and walked into the desert, where he stayed five years. There he saw the martyrs receiving their crowns, and he went back to the city.',
    'He walked into a public festival, in the middle of the crowd, and said out loud that he was a Christian. He was offered position and threatened by turns, then tortured, then beheaded, in about the year 309. His body was thrown on a fire and the fire did not consume it; his sister recovered it and brought it home by ship to Alexandria.',
  ],
  camel: {
    title: 'The camel that stopped',
    body: [
      'The body was loaded onto a camel to be carried out into the western desert. At a place near Lake Mariout the camel knelt and would not go on, and no other beast they loaded would go on either. They took that for the answer and buried him there.',
      'Later a sick animal was made well in that ground, and then people were, and a church was built over the grave and consecrated on 15 Paoni. A city grew up around it — a great basilica, baths, hostels, workshops, a street of shops for pilgrims — and the pilgrims carried the water and the oil of the shrine home in small clay flasks stamped with a picture of him standing between two kneeling camels. Those flasks have been dug up in Italy, in Germany, in France, which is how far the news of an Egyptian soldier’s grave travelled.',
    ],
  },
  now: {
    title: 'Abu Mina now',
    body: [
      'The pilgrim city was ruined and the desert took it back. It was dug out again at the beginning of the twentieth century, and the site is a World Heritage site today — and on the list of those in danger, because irrigation in the fields around it has raised the water table under the foundations.',
      'A short distance away is the monastery Pope Cyril VI began building in 1959. The relics of St. Mina are kept there, and Pope Cyril VI is buried there himself.',
    ],
  },
};

/**
 * The two names over the opening diptych.
 *
 * A diptych, not a hero: two icons the same height, side by side, *named* —
 * because "which one is which" is the first question this page has to answer,
 * and a paragraph is a slow way to answer it. `also` is what he is called in
 * Arabic.
 */
export const DIPTYCH = {
  'mercurius-icon': { name: 'St. Philopater Mercurius', also: 'Abu Sefein' },
  'mina-mosaic': { name: 'St. Mina the Wonder-worker', also: 'Abu Mina' },
} as const;

export const ICONS = {
  eyebrow: 'In the icons',
  title: 'How to tell them apart',
  note: 'Both are painted as soldiers, and they are never painted the same way.',
  body: [
    '**St. Mercurius is moving.** He is on a black horse with a sword raised in each hand, an angel over his shoulder holding out the second one, and a crowned man going down under the hooves. Everything in the frame is the moment after something happened.',
    '**St. Mina is standing still.** His hands are open and lifted at his sides — the way the early Church is shown praying, before folded hands — and a camel kneels on either side of him. He is almost never shown without them.',
  ],
};
