/**
 * Our Belief — the Creed, the councils, and the eleven plates.
 *
 * A port of the website's `features/belief`: `BeliefScreen.tsx`'s prose,
 * `creed.ts`, `articles.tsx` and `images.ts`. See the header of `who.ts` for
 * why the words are copied rather than fetched, and what that costs.
 */
import { beliefPicture } from './media';
import type { PictureMeta } from './parts';

/* ── Pictures ────────────────────────────────────────────────────────────── */

export const BELIEF_PICTURES = {
  'wadi-natrun-frescos': {
    alt: 'Painted saints and angels filling the half-dome of a monastery apse, the plaster cracked with age.',
    caption:
      'Wall paintings in a monastery church in Wadi al-Natrun, the desert valley north-west of Cairo. Monks have lived there without a break since the fourth century.',
    width: 1280,
    height: 857,
  },
  'holy-trinity': {
    alt: 'An icon of three angels seated around a table, each with a staff, inclining towards one another.',
    caption:
      'Rublev’s Trinity, Moscow, about 1411 — the three visitors Abraham received at Mamre. The Church does not paint the divine essence; when it depicts the Trinity, it paints this.',
    width: 1280,
    height: 1594,
  },
  'council-of-nicaea': {
    alt: 'An icon of the First Council of Nicaea: bishops standing around the Emperor Constantine, holding an open scroll of Greek text.',
    caption:
      'The First Council of Nicaea. The fathers hold the Creed they wrote, with Constantine — who summoned them — at the centre; the scroll carries its opening lines in Greek.',
    width: 1024,
    height: 1388,
  },
  'alexandrian-fathers': {
    alt: 'A gold-ground icon of two bishops in patterned vestments, each holding a Gospel book.',
    caption:
      'St. Athanasius and St. Cyril of Alexandria, on a Cretan icon. Athanasius went to Nicaea as a deacon; Cyril presided at Ephesus a century later.',
    width: 1162,
    height: 1600,
  },
  'christ-pantocrator': {
    alt: 'The sixth-century Sinai icon of Christ, holding a jewelled Gospel book and raising His right hand in blessing.',
    caption:
      'Christ Pantocrator — painted in coloured wax at the Monastery of St. Catherine in Sinai in the sixth century, and among the oldest icons of Christ that survive.',
    width: 1023,
    height: 1688,
  },
  'theotokos-sinai': {
    alt: 'An early icon of the Virgin enthroned with the Christ child on her lap, a soldier-saint standing on either side and two angels behind.',
    caption:
      'The Virgin enthroned with the Christ child, between St. Theodore and St. George. Encaustic on wood, Sinai, sixth century.',
    width: 1038,
    height: 1525,
  },
  resurrection: {
    alt: 'An icon of the risen Christ standing in light above the tomb, holding a banner, with soldiers scattered below.',
    caption:
      'The Resurrection, painted by Elias Moskos on Crete in 1679 — Christ risen above the sealed tomb, the guard thrown down around it.',
    width: 1080,
    height: 1438,
  },
  'coptic-gospel-leaf': {
    alt: 'A page of a hand-copied manuscript in Coptic letters, with a decorated initial in the margin.',
    caption:
      'A leaf from a Coptic manuscript of the Pauline Epistles and the Gospel of John — the Scriptures in the language of Egypt.',
    width: 1280,
    height: 1432,
  },
  'hanging-church': {
    alt: 'The interior of an old Coptic church: rows of marble columns, dark wooden screens inlaid with ivory, and hanging lamps.',
    caption:
      'Inside the Hanging Church in Old Cairo, built above the gatehouse of a Roman fortress and in use for something like thirteen centuries.',
    width: 1280,
    height: 960,
  },
  'coptic-baptism': {
    alt: 'A priest in a black vestment leaning over a stone font, one hand steadying the child being baptised in it.',
    caption:
      'A baptism in a Coptic Orthodox church. The child is immersed three times, and is anointed with the holy Myron immediately afterwards.',
    width: 1280,
    height: 960,
  },
  'st-mark-preaching': {
    alt: 'A wide Renaissance painting of St. Mark preaching from a platform in a great square, before a domed basilica and a crowd in Eastern dress.',
    caption:
      'St. Mark Preaching in Alexandria, begun by Gentile Bellini and finished by his brother Giovanni around 1507. The Alexandria in it is imagined — the painting was made for the Venetian confraternity that kept the Evangelist’s relics.',
    width: 1280,
    height: 608,
  },
} as const satisfies Record<string, PictureMeta>;

export type BeliefPictureName = keyof typeof BELIEF_PICTURES;

export const belief = (name: BeliefPictureName) => beliefPicture(name);

export const BELIEF_CREDITS = [
  {
    what: 'Monastery wall paintings, Wadi al-Natrun',
    author: 'Diaa abdelmoneim',
    license: 'CC BY-SA 3.0',
    page: 'https://commons.wikimedia.org/wiki/File:Coptic_Frescos_from_the_Wadi_Natrun_monastery.jpg',
  },
  {
    what: 'The Trinity, Andrei Rublev',
    author: 'Andrei Rublev',
    license: 'Public domain',
    page: 'https://commons.wikimedia.org/wiki/File:Angelsatmamre-trinity-rublev-1410.jpg',
  },
  {
    what: 'The First Council of Nicaea',
    author: 'Unknown author',
    license: 'Public domain',
    page: 'https://commons.wikimedia.org/wiki/File:Nicaea_icon.jpg',
  },
  {
    what: 'St. Athanasius and St. Cyril of Alexandria',
    author: 'Unknown author',
    license: 'Public domain',
    page: 'https://commons.wikimedia.org/wiki/File:Cretan_Icon_of_Saint_Kyrillos_and_Saint_Athanasios_of_Alexandria.jpg',
  },
  {
    what: 'Christ Pantocrator, Sinai',
    author: 'Anonymous',
    license: 'Public domain',
    page: 'https://commons.wikimedia.org/wiki/File:Spas_vsederzhitel_sinay_(cropped).jpg',
  },
  {
    what: 'The Virgin enthroned, Sinai',
    author: 'Unknown author',
    license: 'Public domain',
    page: 'https://commons.wikimedia.org/wiki/File:Mary_%26_Child_Icon_Sinai_6th_century.jpg',
  },
  {
    what: 'The Resurrection, Elias Moskos',
    author: 'Elias Moskos',
    license: 'Public domain',
    page: 'https://commons.wikimedia.org/wiki/File:Resurrection_by_Ilias_Moskos_(1679,_Byzantine_museum).jpg',
  },
  {
    what: 'A Coptic manuscript leaf',
    author: 'Unknown author',
    license: 'Public domain',
    page: 'https://commons.wikimedia.org/wiki/File:Page_from_Coptic_manuscript_of_the_%27Pauline_Epistles_%26_Gospel_of_John%27_(CBL_Cpt_813,_f.3r).jpg',
  },
  {
    what: 'The Hanging Church, Old Cairo',
    author: 'Radosław Botev',
    license: 'CC BY 3.0 pl',
    page: 'https://commons.wikimedia.org/wiki/File:Hanging_Church_Cairo_interior_(1).jpg',
  },
  {
    what: 'A Coptic Orthodox baptism',
    author: 'Beshoy Makram Zaki',
    license: 'CC BY-SA 4.0',
    page: 'https://commons.wikimedia.org/wiki/File:Babtism_of_coptic_Egyptian_orthodox.jpg',
  },
  {
    what: 'St. Mark Preaching in Alexandria',
    author: 'Gentile Bellini / Giovanni Bellini',
    license: 'Public domain',
    page: 'https://commons.wikimedia.org/wiki/File:Milan_pinacoth%C3%A8que_Bramante_Sermon_of_St_Mark_in_Alexandria._(bis).jpg',
  },
] as const;

/* ── The Creed ───────────────────────────────────────────────────────────── */

/**
 * The Nicene Creed, as the Coptic Orthodox Church says it in English.
 *
 * Two properties of this English are deliberate and are not to be "fixed":
 *
 *   - **"Who proceeds from the Father"**, with no *and the Son*. The Filioque
 *     is a later Western addition; the Coptic Orthodox Church says the article
 *     as the Council of Constantinople wrote it in 381.
 *   - **"Yes, we believe in the Holy Spirit"**. The Coptic text opens that
 *     article with an affirmation, and every English service book the church
 *     uses keeps the word.
 *
 * Split into stanzas, one string per line, because the Creed is said in
 * breaths and where the lines break is where the church breathes. The breaks
 * are content, not styling — which is also why these are plain strings and
 * never go through `Rich`: nothing in the Creed is emphasised, and an asterisk
 * in it would be a typo said aloud.
 */
export type CreedStanza = { about: string; lines: readonly string[] };

export const CREED: readonly CreedStanza[] = [
  {
    about: 'the Father',
    lines: [
      'We believe in one God, the Father Almighty,',
      'Who created Heaven and earth, and all things seen and unseen;',
    ],
  },
  {
    about: 'the Son',
    lines: [
      'We believe in one Lord, Jesus Christ,',
      'The Only-Begotten Son of God,',
      'begotten of the Father before all ages,',
      'Light of Light, True God of True God,',
      'begotten, not created;',
      'Of one essence with the Father;',
      'By Whom all things were made:',
      'Who for us men and for our salvation came down from Heaven',
      'And was incarnate of the Holy Spirit and the Virgin Mary,',
      'And was made man;',
    ],
  },
  {
    about: 'the Cross and the Resurrection',
    lines: [
      'And He was crucified for us under Pontius Pilate,',
      'He suffered and was buried;',
      'The third day He rose from the dead, according to the Scriptures;',
      'And ascended into Heaven, and sits at the right hand of the Father;',
      'And He shall come again in His glory to judge the living and the dead;',
      'Whose Kingdom shall have no end.',
    ],
  },
  {
    about: 'the Holy Spirit, the Church and the age to come',
    lines: [
      'Yes, we believe in the Holy Spirit, the Lord and Giver of Life,',
      'Who proceeds from the Father, Who with the Father and the Son',
      'Together is worshiped and glorified, Who spoke in the prophets.',
      'And in One Holy Catholic and Apostolic Church.',
      'We acknowledge one Baptism for the remission of sins.',
      'We look for the Resurrection of the dead',
      'And the life of the coming age. Amen.',
    ],
  },
];

/* ── The Creed, line by line ─────────────────────────────────────────────── */

/**
 * The structure of this section is the structure of the Creed itself: every
 * article carries the words it is about, verbatim, and the articles are in the
 * Creed's order.
 */
export type Article = {
  /** The website's own id for this article, and half of its slot ids —
   *  `line-by-line.art-one-god-body`. Not a display value. */
  id: string;
  /** The Creed's own words, quoted, above the heading. */
  line: string;
  heading: string;
  body: readonly string[];
  picture: BeliefPictureName;
};

export const ARTICLES: readonly Article[] = [
  {
    id: 'one-god',
    line: 'We believe in one God, the Father Almighty, Who created Heaven and earth, and all things seen and unseen.',
    heading: 'One God, in three Persons',
    body: [
      'One God — not three, and not one God appearing under three names. The Father, the Son and the Holy Spirit are distinct Persons of one indivisible essence, equal in glory, without beginning and without end. The Church has never explained this and does not try to; it confesses it, and guards the confession against every attempt to make it simpler than it is.',
      '“Almighty” renders *Pantocrator* — the One who holds all things together, not merely the One who could do anything. And everything that exists is His work, the unseen as much as the seen: the angels, and the soul of every person who has ever lived.',
    ],
    picture: 'holy-trinity',
  },
  {
    id: 'one-lord',
    line: 'Light of Light, True God of True God, begotten, not created; of one essence with the Father.',
    heading: 'True God, and not the first of the creatures',
    body: [
      'This is the line the council was called for. A son shares his father’s nature; a thing made is of some other nature than its maker. To say the Son is *begotten, not created* is to say He is God in the same sense the Father is God — begotten of the Father before all ages, eternally, not at some moment before the world began.',
      '“Light of Light” is the image the fathers reached for when language ran out. You cannot have a light and not its radiance; neither comes after the other, and the two are one light. The Greek word the council settled on, *homoousios* — of one essence — is not in Scripture, and that was the objection to it at the time. It was chosen because every scriptural phrase the Arians were willing to sign, they signed while meaning the opposite.',
    ],
    picture: 'christ-pantocrator',
  },
  {
    id: 'incarnate',
    line: 'Who for us men and for our salvation came down from Heaven, and was incarnate of the Holy Spirit and the Virgin Mary, and was made man.',
    heading: 'Perfect God and perfect man',
    body: [
      'The Church confesses that our Lord Jesus Christ is perfect in His divinity and perfect in His humanity; that He took flesh of the Virgin Mary and made it one with His divinity without mingling, without confusion and without alteration; and that His divinity parted from His humanity not for a single moment, nor the twinkling of an eye. Those words are not a summary written for a website. They are said aloud in the church before communion, at every Liturgy.',
      'Because the One born of her is God the Word Himself, the Church calls the Virgin Mary *Theotokos* — the God-bearer, the Mother of God. The title is a statement about her Son before it is a statement about her, which is exactly why the Church fought for it.',
    ],
    picture: 'theotokos-sinai',
  },
  {
    id: 'crucified',
    line: 'And He was crucified for us under Pontius Pilate… the third day He rose from the dead, according to the Scriptures.',
    heading: 'Under Pontius Pilate',
    body: [
      'A Roman magistrate’s name, in the middle of a creed. It is there because what the Church confesses happened at a datable hour, in a named province, under an official whose paperwork an empire kept — and not in the realm of ideas, where nothing can be checked and nothing is at stake.',
      'He was crucified, died and was buried; on the third day He rose, and death was broken open from the inside. The Church keeps that day with fifty-five days of fasting before it and fifty days of standing prayer after — from Easter until Pentecost nobody in the church kneels, because those are not days for mourning.',
    ],
    picture: 'resurrection',
  },
  {
    id: 'holy-spirit',
    line: 'Yes, we believe in the Holy Spirit, the Lord and Giver of Life… Who spoke in the prophets.',
    heading: 'The Spirit, and the Scriptures He spoke',
    body: [
      'The Holy Spirit is not a force the Church has the use of. He is the Lord and Giver of Life, worshipped and glorified together with the Father and the Son — the article Constantinople added in 381, for the reason Nicaea had added *of one essence* to the article on the Son.',
      'He *spoke in the prophets*, which is why the Church reads the Old Testament and the New as one revelation, and why Scripture is never read on its own here. It is read inside the tradition that carried it — the Liturgy, the fathers, the councils, the icons on the walls. The Church that recognised which books are Scripture is the same Church that reads them, and the Coptic Orthodox canon keeps the books a later Western reckoning set aside.',
    ],
    picture: 'coptic-gospel-leaf',
  },
  {
    id: 'the-church',
    line: 'And in One Holy Catholic and Apostolic Church.',
    heading: 'One, holy, catholic, apostolic',
    body: [
      'Four marks, and the Creed asks for all four at once. **One**, because Christ has one body and not several. **Holy**, not because its members are, but because its Head is and its mysteries are. **Catholic** — universal — because it holds the whole faith, for everyone, everywhere, and not a local portion of it. **Apostolic**, because its bishops stand in unbroken succession from the Apostles and its faith is the Apostles’ faith rather than a later improvement on it.',
      'For the Coptic Orthodox Church that succession runs through St. Mark the Evangelist, who brought the Gospel to Alexandria and was martyred there.',
    ],
    picture: 'hanging-church',
  },
  {
    id: 'one-baptism',
    line: 'We acknowledge one Baptism for the remission of sins. We look for the Resurrection of the dead and the life of the coming age. Amen.',
    heading: 'One baptism, and the age to come',
    body: [
      'One baptism, not repeated, because a person is born once. It is given by three immersions in the name of the Father and of the Son and of the Holy Spirit, to infants as well as to adults; the newly baptised is anointed at once with the holy Myron and receives communion the same day. Baptism is the first of the Church’s seven mysteries — the others are Chrismation, Repentance and Confession, the Eucharist, Unction of the Sick, Matrimony and Priesthood.',
      'And the Creed ends by naming where all of this is going: the resurrection of the dead, and the life of the coming age. Not the survival of a soul somewhere — the raising of the whole person, body and all.',
    ],
    picture: 'coptic-baptism',
  },
];

/* ── The prose ───────────────────────────────────────────────────────────── */

export const HERO = {
  eyebrow: 'About',
  title: 'Our Belief',
  lede: 'The Coptic Orthodox Church confesses the faith the Apostles handed down, in the words the whole Church settled at Nicaea in 325. That Creed is said aloud at every Liturgy. Everything else on this page is an unfolding of it.',
};

export const OPENING = {
  title: 'Lex orandi, lex credendi',
  gloss: 'As the Church prays, so it believes',
  body: [
    'The phrase is Prosper of Aquitaine’s, written about 435 — *ut legem credendi lex statuat supplicandi*, that the law of praying establishes the law of believing. He was arguing that if you want to know what the Church holds, listen to how it prays; the prayers came first, and the doctrine states what was already being prayed.',
    'So the faith belongs to the whole Church, not to its scholars. It is confessed aloud by everyone present at every Liturgy, and carried out of the church into the week. Every dogma the Church states says one thing: that man is called into communion with God the Father, in Jesus Christ the incarnate Word, by His Holy Spirit.',
    'Redemption, membership of the Church, the reading of the Scriptures, the Kingdom of God within the soul, the company of the angels and the saints, the life of the age to come — all of it holds together in that communion. The Church states its dogma in order to live by it: to worship God, to serve mankind, to work for the renewal of this world, and to wait for the world to come.',
    'So the faith is sung, painted and fasted as much as it is stated. The Creed below is said standing, by everyone present, at every Divine Liturgy. The same faith is in the icons on the walls, in the seven hours of the Agpeya, and in the fasts that take up more than half the year.',
  ],
};

export const CREED_HEAD = {
  eyebrow: 'Said standing, at every Liturgy',
  title: 'The Nicene Creed',
  lede: 'Three hundred and eighteen bishops met at Nicaea in 325 to answer one question: whether the Son of God is a creature. Their answer is this. It was completed at Constantinople in 381, and the Church has said it in this form ever since — after the readings and before the offering, and again at every baptism.',
  note: 'Two things in this English are deliberate. The Church says **“Who proceeds from the Father”**, without the later Western addition *and the Son*; and it opens the article on the Holy Spirit with **“Yes”** — an affirmation, carried over from the Coptic, rather than a continuation of the sentence before it.',
};

export const COUNCILS = {
  title: 'Three councils, and one word',
  body: [
    'Arius was a priest of Alexandria who taught that there was a time when the Son was not: that He was the highest and first of the creatures, but a creature. Alexander, Pope of Alexandria, condemned it, and the argument spread far enough that the Emperor Constantine summoned the bishops of the whole world to Nicaea, in 325, to settle it.',
    'They settled it with one word — *homoousios*, of one essence with the Father — and with the Creed built around it. Among the Alexandrian delegation was a young deacon named Athanasius, who spent the next forty-five years, and five separate exiles, defending what the council had written.',
    'At Constantinople in 381 the same question was asked about the Holy Spirit, and the council answered it by completing the Creed: the articles on the Spirit, the Church, baptism and the resurrection are theirs. At Ephesus in 431, with St. Cyril of Alexandria presiding, Nestorius was answered for refusing the Virgin Mary the title *Theotokos* — on the ground that a creature cannot bear the Creator. The council replied that the One she bore is a single Person, God the Word made flesh, and that to take the title from her is to divide Him in two.',
    'Those three councils — Nicaea, Constantinople, Ephesus — are the ones the Coptic Orthodox Church receives as ecumenical, and the whole of the Creed comes from the first two.',
  ],
};

export const LINE_BY_LINE = {
  title: 'The Creed, line by line',
  lede: 'What the church is saying when it says it. The order is the Creed’s own.',
};

export const THE_SEE = {
  title: 'Whose confession this is',
  body: [
    'St. Mark the Evangelist brought the Gospel to Alexandria in the middle of the first century and was martyred there. The Church he founded has had an unbroken line of successors in that see ever since; its patriarch is the Pope of Alexandria, and this church in Wayland belongs to it. The catechetical school of that city — where Pantaenus, Clement, Origen and Didymus the Blind taught — is the oldest Christian school on record.',
    'Egypt’s calendar remembers what that cost. The Coptic year is not counted from the birth of Christ but from the year 284, the year Diocletian took the throne; the persecution he went on to launch cost Egypt more Christians than any other province of the empire. The years are numbered *Anno Martyrum*, the Year of the Martyrs. It is the Church’s way of saying which fact it organises time around. And it was into that same desert that St. Antony went out around 270, and where St. Pachomius gathered the first communities a generation later — every monastery in the world descends from them.',
    'In 451 the Council of Chalcedon defined Christ as known “in two natures”. Alexandria held to St. Cyril’s formula — one incarnate nature of God the Word — and did not receive that council, and the Church has been called *monophysite* ever since by people who take the word to mean that Christ’s humanity was swallowed up in His divinity. It does not teach that and never has: it confesses Him perfect in divinity and perfect in humanity, united without mingling, without confusion and without alteration. In the twentieth century that was said formally from both sides — with the Roman Catholic Church in 1973, and with the Eastern Orthodox churches in the agreed statements of 1989 and 1990, which found the two families confessing one faith in two vocabularies.',
  ],
};
