/**
 * Welcome, Newcomers — the six stations, as data.
 *
 * ---------------------------------------------------------------------------
 * A port of the website's `features/tour`: `stations.ts`, `content.tsx` and
 * `coptic.ts`. The website keeps this prose as JSX and says why — it is
 * paragraphs with disclosures, tables and a switcher set into the middle of
 * them, and a schema general enough to hold all of that would be a small CMS
 * nobody asked for.
 *
 * **Here it is data anyway, and the difference is worth naming.** That
 * argument is about a format staff would *author* in. Nobody authors in this
 * one: it is a fixed transcription of six stations that already exist, read by
 * exactly one screen, and the union below can only express the eight shapes
 * the six stations actually use. Adding a ninth means adding a case to
 * `Station` in `TourScreen.tsx`, which is the compiler's job and not a
 * volunteer's. What this buys is that the six stations read here as six
 * stations rather than as four hundred lines of nested elements.
 *
 * **What is not ported: the passport.** On the website each station has a
 * stamp a visitor collects as they walk the hall, kept in `localStorage`, and
 * every station has a fragment because a QR code beside it deep-links there.
 * Both are festival-floor machinery — the stamps mean something because a
 * servant is standing at the station, and the fragments are printed on
 * physical signs. An app that showed six stamp buttons to somebody reading in
 * an armchair would be offering a game with no board. The words of all six
 * stations are here in full; the stamps are at the festival.
 * ---------------------------------------------------------------------------
 */
import { tourPicture, tourThumb } from './media';
import type { PictureMeta } from './parts';

/* ── Pictures ────────────────────────────────────────────────────────────── */

export const TOUR_PICTURES = {
  'st-mark-evangelist': {
    alt: 'An engraving of St. Mark seated with a book, a winged lion beside him.',
    caption: 'St. Mark the Evangelist, who founded the Church in Alexandria around 43 A.D.',
    width: 1280,
    height: 1957,
  },
  'st-athanasius': {
    alt: 'A painted icon of St. Athanasius in bishop’s vestments, holding a book.',
    caption: 'St. Athanasius, 20th Pope of Alexandria, called "the Father of Orthodoxy".',
    width: 1280,
    height: 1782,
  },
  'coptic-manuscript': {
    alt: 'Two leaves of a manuscript written in Coptic letters, worn at the edges.',
    caption:
      'Coptic script — the Egyptian language written in Greek letters, plus seven of its own.',
    width: 1280,
    height: 1771,
  },
  'sothis-star-chart': {
    alt: 'A drawing from an Egyptian tomb ceiling showing figures standing in boats among stars.',
    caption:
      'Sothis — the star we call Sirius — among the constellations the Egyptian calendar was set by.',
    width: 512,
    height: 383,
  },
  iconostasis: {
    alt: 'The carved wooden icon screen of a Coptic church, with the altar visible through its central arch.',
    caption:
      'The iconostasis — the barrier between the nave and the sanctuary, and the icons that bridge it.',
    width: 1280,
    height: 1707,
  },
  'icon-archangel': {
    alt: 'A Coptic icon of the Archangel Michael holding a scale, with large eyes and a flat gold ground.',
    caption: 'Large eyes, flat ground, no shadow. An icon is drawn as a diagram, not a likeness.',
    width: 1280,
    height: 1857,
  },
  'st-mark-lion': {
    alt: 'An illuminated manuscript page of St. Mark writing, with a winged lion at his feet.',
    caption: 'The lion, which is St. Mark’s: his Gospel opens with a voice roaring in the desert.',
    width: 1280,
    height: 1943,
  },
  'shroud-of-turin': {
    alt: 'The photographic negative of the Shroud of Turin, showing the faint front and back of a man.',
    caption: 'The Shroud of Turin, one of the images tradition holds was not made by human hands.',
    width: 1280,
    height: 1253,
  },
  'deacons-in-tunics': {
    alt: 'Rows of deacons seated in white tunics with red embroidered stoles over the left shoulder.',
    caption: 'Deacons in the white tunic, each with the red badrashil over the left shoulder.',
    width: 1280,
    height: 991,
  },
  'bishops-emma': {
    alt: 'Two bishops in embroidered white copes and tall embroidered hats, incense smoke in the air.',
    caption:
      'The em’ma — the hat, once a cap with a turban wound round it — worn by bishops and priests.',
    width: 1280,
    height: 853,
  },
  'coptic-tunic': {
    alt: 'An ancient linen tunic with woven decorative panels, laid flat.',
    caption: 'A Coptic tunic from late antiquity. The shape of the tonia has changed very little.',
    width: 1280,
    height: 1040,
  },
  'tunic-embroidery': {
    alt: 'A fragment of woven Coptic textile with a geometric figured panel in dark thread.',
    caption:
      'Woven tunic decoration, 5th–6th century — the ancestor of the embroidered strip worn today.',
    width: 1280,
    height: 1269,
  },
  'sagat-engraving': {
    alt: 'An 1836 engraving of Egyptian hand cymbals and a frame drum, drawn in outline.',
    caption: 'Egyptian hand cymbals, drawn in 1836 — a pair of concave disks joined by a cord.',
    width: 1025,
    height: 509,
  },
  'hand-cymbals': {
    alt: 'A hand holding a pair of small brass cymbals joined by elastic loops.',
    caption:
      'How a pair is held. The cymbals used in church are larger — five to seven inches across.',
    width: 612,
    height: 622,
  },
  triangle: {
    alt: 'A plain iron triangle with the two ends curled into spirals, photographed against a light ground.',
    caption: 'The triangle, which the Book of Samuel already knew.',
    width: 629,
    height: 596,
  },
  'liturgical-codex': {
    alt: 'An illustrated page from a Coptic liturgical manuscript, with decorated initials.',
    caption: 'A Coptic liturgical book — the words the cymbals keep time to.',
    width: 1280,
    height: 1301,
  },
  ney: {
    alt: 'A long reed flute with six finger holes, laid vertically against a plain ground.',
    caption: 'A ney — a length of reed, six holes in front and one behind, and nothing else.',
    width: 1280,
    height: 2986,
  },
  'ney-player': {
    alt: 'A musician holding a ney at an angle to the mouth, playing.',
    caption:
      'Blown across the rim rather than into a mouthpiece, which is why it takes so long to learn.',
    width: 1280,
    height: 960,
  },
  'egyptian-musicians': {
    alt: 'An ancient Egyptian tomb painting of seated women playing a double flute and other instruments.',
    caption: 'Musicians painted on the wall of an Egyptian tomb, roughly 3,400 years ago.',
    width: 1280,
    height: 1468,
  },
  oud: {
    alt: 'A pear-shaped stringed instrument with a bent-back neck and a decorated soundhole.',
    caption: 'The oud, from Cairo — the ney’s usual companion.',
    width: 349,
    height: 640,
  },
  censer: {
    alt: 'A priest in a white cope seen from behind, swinging a censer, smoke rising toward the altar.',
    caption:
      'The censer: three chains for the Trinity, and the coal inside it for the womb that carried Christ.',
    width: 1280,
    height: 1707,
  },
  'altar-ark': {
    alt: 'A Coptic altar under a painted apse, with a small decorated wooden box standing on it.',
    caption: 'The Ark — the box at the centre of the altar that the chalice stands in.',
    width: 1280,
    height: 1707,
  },
  'veil-of-veronica': {
    alt: 'A painting of a white cloth pinned flat, the faint face of Christ visible on it.',
    caption: 'The Veil of Veronica, pressed to Christ’s face on the way to the cross.',
    width: 1280,
    height: 1768,
  },
} as const satisfies Record<string, PictureMeta>;

export type TourPictureName = keyof typeof TOUR_PICTURES;

export const tour = (name: TourPictureName) => tourPicture(name);
export const tourSmall = (name: TourPictureName) => tourThumb(name);

/* ── The blocks a station body is made of ────────────────────────────────── */

/**
 * Eight shapes, and the eight the six stations use. See the header: this is a
 * transcription format, not an authoring one, and it is deliberately unable to
 * express anything the website's six stations do not already contain.
 */
export type Block =
  /** Paragraphs, in the markup `Rich` reads. */
  | { kind: 'prose'; paragraphs: readonly string[] }
  /** A pulled-out line — the website's `.note` and `.tour-quote`. */
  | { kind: 'aside'; text: string }
  /** A quoted text with a label over it: the Creed as the Agpeya prints it. */
  | { kind: 'quote'; label: string; paragraphs: readonly string[] }
  /** Disclosures. The website's `Reveal`, which is most of the tour. */
  | {
      kind: 'folds';
      entries: readonly {
        label: string;
        aside?: string;
        body: readonly string[];
        /** A run of term/detail pairs under the words — the censer's four
         *  parts, which the website sets as a list rather than a sentence. */
        parts?: readonly { term: string; detail: string }[];
      }[];
    }
  /** Two lists side by side. The website's `Switcher` — priest and deacon. */
  | { kind: 'sides'; sides: readonly { label: string; items: readonly string[] }[] }
  /** A numbered walk-through. The website's `Stepper` — the liturgy as a wedding. */
  | { kind: 'steps'; steps: readonly { title: string; service: string; body: readonly string[] }[] }
  /** The three widgets, each named rather than described. */
  | { kind: 'hymn' }
  | { kind: 'year' }
  | { kind: 'name' };

export type Section = { title: string; blocks: readonly Block[] };

export type Station = {
  /** The website's fragment for this station — `station-3` — which is printed
   *  on the QR codes at the festival and is the stem of its slot ids. */
  id: string;
  number: number;
  title: string;
  /** One sentence, shown under the title. */
  lede: string;
  pictures: readonly TourPictureName[];
  sections: readonly Section[];
};

/* ── The six ─────────────────────────────────────────────────────────────── */

export const STATIONS: readonly Station[] = [
  {
    id: 'station-1',
    number: 1,
    title: 'Origins of the Coptic Orthodox Church',
    lede: 'Where the word "Coptic" comes from, the calendar the Church still keeps, and the language it prayed in for a thousand years.',
    pictures: ['st-mark-evangelist', 'st-athanasius', 'coptic-manuscript', 'sothis-star-chart'],
    sections: [
      {
        title: 'Two words: Coptic, and Orthodox',
        blocks: [
          {
            kind: 'prose',
            paragraphs: [
              'The Coptic Church was established in the name of the Lord Jesus Christ by St. Mark the Evangelist, in the city of Alexandria, around 43 A.D.',
              '**Coptic** comes through Greek. The Greek word for Egypt was *Aigyptos*; when the Arabs reached Egypt in the seventh century they shortened it to *qibt*. Because the Egyptians they found there were Christians, the same word came to carry both meanings at once — Egyptian, and Christian.',
              '**Orthodoxy** means keeping the original faith. The Creed settled at Nicaea in 325 A.D. has been attacked repeatedly in the centuries since, and the Coptic Church has defended it each time. At Nicaea itself the defence of Christ’s divinity was led by St. Athanasius, later the 20th Pope of Alexandria, who is called the Father of Orthodoxy and the Apostolic for it.',
            ],
          },
          {
            kind: 'quote',
            label: 'The Orthodox Creed, as printed in the Agpeya',
            paragraphs: [
              'We believe in one God, God the Father, the Pantocrator, who created heaven and earth, and all things, seen and unseen.',
              'We believe in one Lord Jesus Christ, the only-begotten Son of God, begotten of the Father before all ages. Light of Light, true God of true God, begotten, not created, of one essence with the Father, by whom all things were made; who, for us men and for our salvation, came down from heaven, and was incarnate of the Holy Spirit and of the Virgin Mary, and became man.',
              'And He was crucified for us under Pontius Pilate, suffered and was buried. And on the third day He rose from the dead, according to the scriptures, ascended into the heavens and sat at the right hand of His Father; and He is coming again in His glory to judge the living and the dead, whose kingdom shall have no end.',
              'Yes, we believe in the Holy Spirit, the Lord, the Giver of Life, who proceeds from the Father; who, with the Father and the Son, is worshipped and glorified; who spoke by the prophets.',
              'And in one holy, catholic and apostolic Church. We confess one baptism for the remission of sins. We look for the resurrection of the dead, and the life of the age to come. Amen.',
            ],
          },
        ],
      },
      {
        title: 'The Coptic language',
        blocks: [
          {
            kind: 'prose',
            paragraphs: [
              'The first Christians in Egypt prayed in Coptic — not a borrowed language but their own, the ancient Egyptian of the pharaohs carried forward and written in Greek letters, with seven extra letters kept from Demotic for the sounds Greek had no use for. It remained the Church’s main language until the eleventh century, and it is still what the hymns are sung in.',
              'Here is one of them.',
            ],
          },
          { kind: 'hymn' },
          { kind: 'prose', paragraphs: ['Write your own name in the same letters:'] },
          { kind: 'name' },
        ],
      },
      {
        title: 'The Coptic calendar',
        blocks: [
          {
            kind: 'prose',
            paragraphs: [
              'The Alexandrian calendar is the oldest calendar in history, and it was set by the stars. The Egyptians watched for the star they called Sothis — Sirius — to reappear at dawn, and fixed the year by it.',
              'Its count of years begins in 284 A.D. and is called *Anno Martyrum*, the Year of the Martyrs. That date is the start of the reign of the Emperor Diocletian, who is remembered for persecuting Christians more savagely than any emperor before him. Choosing it was deliberate. The Church dates itself from the worst thing that was ever done to it, because what the years count from is the point at which dying stopped being a reason to stop believing.',
              'The month names are the ancient Egyptian ones, each named for a god held to govern that stretch of the farming year, and the year divides into three seasons of the Nile with one short month left over:',
            ],
          },
          { kind: 'year' },
        ],
      },
      {
        title: 'Relics',
        blocks: [
          {
            kind: 'prose',
            paragraphs: [
              'A relic is a fragment associated with a saint, kept by the Church because the saint is a role model and not a memory. On the saint’s feast day the relics are brought out during the service and carried in procession while the melody belonging to that saint is sung.',
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'station-2',
    number: 2,
    title: 'Icons & Architecture',
    lede: 'Why the faces in an icon do not look like photographs, and what the wooden screen across the front of the church is for.',
    pictures: ['iconostasis', 'icon-archangel', 'st-mark-lion', 'shroud-of-turin'],
    sections: [
      {
        title: 'What an icon is',
        blocks: [
          {
            kind: 'prose',
            paragraphs: [
              '*Icon* is simply the Greek word for image. The first images of Christ were made during His lifetime, by people who had seen Him and followed Him; the Evangelist Luke is held to have been among the first to paint and to sculpt Him, and is credited by tradition with images of the bleeding woman who was healed by touching Him.',
              'An icon holds past, present and future at once — the way God sees them — which is why nothing in one is set at a particular hour of a particular day.',
            ],
          },
        ],
      },
      {
        title: 'Three images tradition says were not painted',
        blocks: [
          {
            kind: 'folds',
            entries: [
              {
                label: 'The Veil of St. Veronica',
                aside: 'On the road to the cross',
                body: [
                  'A cloth pressed to the face of Christ as He carried the cross, which kept the impression of it.',
                ],
              },
              {
                label: 'The Image of Edessa',
                aside: 'Sent to a king who was ill',
                body: [
                  'Christ sent a cloth marked with His own face to the King of Edessa, who was suffering from an illness.',
                ],
              },
              {
                label: 'The Shroud of Turin',
                aside: 'Fourteen feet of linen',
                body: [
                  'A linen cloth fourteen feet long bearing the image of a crucified man, front and back.',
                ],
              },
            ],
          },
        ],
      },
      {
        title: 'Why the faces do not look like photographs',
        blocks: [
          {
            kind: 'prose',
            paragraphs: [
              'Orthodox icons are not attempts at likeness, and the flatness is not a want of skill. During the Italian Renaissance painters were praised for rendering the human body convincingly — its weight, its muscle, its light. An icon refuses that on purpose. The subject is the transfigured body, not the physical one, and a painter who draws the eye to the physique has painted the wrong thing.',
              'Everyone perceives God differently, so an icon is drawn simply and leaves room. Less is more here: an icon is a diagram, not a portrait, and it is not claiming to show what Jesus or the saints looked like.',
            ],
          },
        ],
      },
      {
        title: 'The nave, and the barrier across it',
        blocks: [
          {
            kind: 'prose',
            paragraphs: [
              'The nave is where the congregation stands and sits to pray. The word is the word for a ship — everyone in it is on a journey to the Father, together, in the same vessel.',
              'Between the nave and the sanctuary there is usually a wooden barrier, and the icons set into it are what bridge the gap: St. Mary as mother to Jesus, Jesus as the doorway to the Father, St. John the Baptist as the last of the prophets, saying *make a path in the wilderness and get ready for the Lord*. The barrier separates, and the icons on it are how you come to know the One on the other side.',
            ],
          },
        ],
      },
      {
        title: 'Reading one icon: St. Mark',
        blocks: [
          {
            kind: 'prose',
            paragraphs: [
              'St. Mark is this church’s founder, and his icon is the one worth learning to read. He was young and always close to the Lord — one of the seventy rather than the Twelve, but near enough that he was at the wedding at Cana, and near enough that he is the man carrying the jar of water whom two disciples were sent to follow when they went to prepare the Passover. The room they prepared was in his own house (Mark 14:13–14; Luke 22:11).',
              'Four things in the picture, and what each is doing there:',
            ],
          },
          {
            kind: 'folds',
            entries: [
              {
                label: 'The loose sandal strap',
                aside: 'Alexandria, on arrival',
                body: [
                  'His sandal strap broke as he came into the city. The cobbler mending it, Anianos, drove the awl through his own hand and cried out *O One God* — St. Mark healed the hand, and Anianos was converted, and then his household, and then a great many more. The Church in Egypt starts with a broken strap.',
                ],
              },
              {
                label: 'The lighthouse and the sea',
                aside: 'Alexandria itself',
                body: [
                  'The Pharos, and the harbour it stood in. It is how the icon says *this happened in Alexandria*.',
                ],
              },
              {
                label: 'The angel with a crown',
                aside: 'In some icons',
                body: [
                  'His martyrdom. An angel appeared to him in prison to tell him his hour had come, and the crown is what a martyr receives.',
                ],
              },
              {
                label: 'The lion',
                aside: 'Of the four creatures, his',
                body: [
                  'Mark opens his Gospel with John the Baptist as a voice crying in the wilderness — a lion roaring in the desert (Mark 1:3).',
                  'There is also the story from Jordan, where a lion and a lioness came at Mark and his father, and Mark’s prayer struck the beasts dead; his father was converted by it. Of the four incorporeal creatures, Mark is the lion: roaring in the desert with prophetic power, proclaiming Jesus as king.',
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'station-3',
    number: 3,
    title: 'Ranks in the Church, and What They Wear',
    lede: 'Every garment worn at the altar means something. Here is what each one is and who wears it.',
    pictures: ['deacons-in-tunics', 'bishops-emma', 'coptic-tunic', 'tunic-embroidery'],
    sections: [
      {
        title: 'Who wears what',
        blocks: [
          {
            kind: 'prose',
            paragraphs: [
              'Nothing worn at the altar is decoration. Every garment is a statement about the person wearing it, and a priest and a deacon are dressed differently because they are doing different things.',
            ],
          },
          {
            kind: 'sides',
            sides: [
              {
                label: 'Priest',
                items: [
                  'The Tunic — Tonia',
                  'The Presbyterial or Episcopal Stole — Sadra',
                  'The Sleeves — Epimanikia',
                  'The Girdle — Al Mintaqa',
                  'The Cope — Bornos',
                  'The Taylassan',
                ],
              },
              { label: 'Deacon', items: ['The Tunic — Tonia', 'The Stole — Badrashil'] },
            ],
          },
        ],
      },
      {
        title: 'The garments, one at a time',
        blocks: [
          {
            kind: 'folds',
            entries: [
              {
                label: 'The Tunic',
                aside: 'Tonia',
                body: [
                  'The white robe. White for the purity asked of anyone serving God — a colour the Bible returns to again and again for the same reason.',
                  'It is long, from the neck to the ankles, and the length is the meaning: God’s grace covering over the sins of the one who is serving.',
                ],
              },
              {
                label: 'The Stole',
                aside: 'Badrashil',
                body: [
                  'A strip of coloured, embroidered cloth, and a sign of service and obedience. The word is Greek, for a grace a person takes up and carries on the shoulders.',
                  'Deacons and archdeacons wear it over the left shoulder, brought down under the right elbow, with the ends hanging front and back — a wide red ribbon around the shoulders. It reverses to dark blue, purple or black for funerals and for Holy Week.',
                  'Not everyone in the choir wears one. The Chanter *(Epsaltos)* wears the tunic without it. The Reader *(Anagnostes)* and the Subdeacon *(Epi-diakon)* wear it crossed over the back and wrapped round to the front like a belt, both ends hanging from the shoulders: crossed because he shares in carrying the cross with Christ, belted as a sign of readiness for service — John the Baptist girding his waist.',
                ],
              },
              {
                label: 'The Stole of a priest',
                aside: 'Sadra',
                body: [
                  'The presbyterial or episcopal stole, which answers to the breastplate Aaron was commanded to wear (Exodus 28). It is essentially the deacon’s stole worn differently — around the neck instead of over one shoulder, both ends hanging in front. The two ends were later joined into a single strip down the front, and the seam where they were joined is still visible.',
                ],
              },
              {
                label: 'The Hat',
                aside: 'Em’ma',
                body: [
                  'Worn by bishops and priests, and originally a cap with a turban wound around it. It means one thing, and it means it at the person wearing it: that a bishop, a priest, a pope, however much authority he has been given, is still under God’s.',
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'station-4',
    number: 4,
    title: 'Cymbals, Triangle & the Midnight Praises',
    lede: 'The two instruments the Coptic Church plays, how they are held, and the all-night service they belong to.',
    pictures: ['sagat-engraving', 'hand-cymbals', 'triangle', 'liturgical-codex'],
    sections: [
      {
        title: 'Two instruments, and no others',
        blocks: [
          {
            kind: 'prose',
            paragraphs: [
              'The Coptic Church plays percussion and nothing else: small hand cymbals — *daff* in Arabic — and a metal triangle. A deacon plays them, with the *ma’lm*, the cantor who leads the singing.',
              'They are not accompaniment in the ordinary sense. They keep the congregation together, mark where a hymn turns, and tell several hundred people when to come in — which is most of what an instrument is for in a church with no organ and no choir stalls.',
              'Both are scriptural. Hand cymbals appear in the Old Testament and the New — Psalm 150, and 1 Corinthians 13:1 — and the triangle is in the Book of Samuel.',
            ],
          },
        ],
      },
      {
        title: 'What the cymbals are, and how they are played',
        blocks: [
          {
            kind: 'prose',
            paragraphs: [
              'A pair of slightly concave metal disks, five to seven inches across, with a cupped centre about an inch and a quarter deep. A hole through the middle takes a string, held in place by a pin, and the pin is the handle.',
            ],
          },
          {
            kind: 'folds',
            entries: [
              {
                label: 'The slide',
                aside: 'Diagonal',
                body: [
                  'The disks are drawn diagonally across each other rather than struck together. It is the deeper of the two sounds.',
                ],
              },
              {
                label: 'The circle',
                aside: 'Rim on rim',
                body: [
                  'The rims are turned against one another in a circular motion. Alternating this with the slide is what gives a single pair of cymbals more than one voice.',
                ],
              },
              {
                label: 'The ending',
                aside: 'Trill, then clap',
                body: [
                  'A hymn is closed with a trill on the rims and a single clap. When you hear it, the hymn has finished — that is the signal the congregation is listening for.',
                ],
              },
            ],
          },
          {
            kind: 'aside',
            text: 'At the festival, the youth musicians play these here. Ask them to show you the difference between the two strokes.',
          },
        ],
      },
      {
        title: 'Tasbeha — the midnight praises',
        blocks: [
          {
            kind: 'prose',
            paragraphs: [
              'Tasbeha is the praise the Church keeps at night, and part of it is sung with the cymbals and the triangle. It is the service that runs from late evening towards morning, and it is where most Copts learn the hymns they know by heart.',
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'station-5',
    number: 5,
    title: 'The Ney, and the Oldest Music in Egypt',
    lede: 'A reed flute that has been played without a break for something like five thousand years.',
    pictures: ['ney', 'ney-player', 'egyptian-musicians', 'oud'],
    sections: [
      {
        title: 'The ney',
        blocks: [
          {
            kind: 'prose',
            paragraphs: [
              'The ney is an end-blown flute — a length of reed with six holes in front and one behind, and no mouthpiece at all. It is central to Persian, Turkish, Jewish and Arabic music, and in several of those traditions it is the only wind instrument used.',
              'It has been played continuously for something between four and a half and five thousand years, back to ancient Egypt, which makes it one of the oldest instruments still in use anywhere in the world. The musicians painted on the walls of Egyptian tombs are playing an instrument a player today would recognise.',
              'Because there is no mouthpiece, the sound is made entirely by the player’s lips against the rim of the reed. That is why it takes years to get a note out of one, and why it sounds like breath.',
            ],
          },
        ],
      },
      {
        title: 'And the oud',
        blocks: [
          {
            kind: 'prose',
            paragraphs: [
              'The ney’s usual companion: a short-necked lute with a bent-back pegbox and no frets, which is what gives it the sliding tones that a guitar cannot make.',
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'station-6',
    number: 6,
    title: 'The Liturgy, the Sacraments & What Is on the Altar',
    lede: 'What each object on the altar is for, the seven sacraments, and why the whole service is told as a wedding.',
    pictures: ['censer', 'altar-ark', 'veil-of-veronica'],
    sections: [
      {
        title: 'What is on the altar',
        blocks: [
          {
            kind: 'folds',
            entries: [
              {
                label: 'The Censer',
                aside: 'And the incense in it',
                body: [
                  'Three chains, for the Holy Trinity. The censer with its coal is St. Mary’s womb, carrying Jesus; the priest raising it is prayer going up to heaven; and the bells on it are there to keep the people praying awake to what they are doing.',
                  'Incense runs through both Testaments — the angel appearing to Zechariah in the temple as he offered it; frankincense among the first gifts brought to the infant Christ; and in Revelation, John seeing an angel burning incense in a golden censer (Rev 8:3–4).',
                ],
                parts: [
                  { term: 'The upper dome', detail: 'heaven' },
                  { term: 'The lower dome', detail: 'the womb of St. Mary' },
                  { term: 'The coal', detail: 'Christ’s humanity' },
                  { term: 'The fire', detail: 'Christ’s divinity' },
                ],
              },
              {
                label: 'The Throne',
                aside: 'The Ark',
                body: [
                  'A box at the centre of the altar — in Coptic *pi totc*, a seat or a throne — cubicle-shaped with high flaps, which the chalice stands in. It is called the Ark because the life-giving Blood it holds answers to the pot of manna kept in the Ark of the Covenant, which was itself a sign of the true Body of Christ.',
                ],
              },
              {
                label: 'The Chalice',
                aside: 'The Communion Cup',
                body: [
                  'Wine mixed with water, consecrated into the Blood of the Lord during the Liturgy of the Eucharist — following Christ’s own use of the cup (Matthew 26:26–27) and the Apostles’ after Him. St. Paul calls it the Cup of Blessing and the Cup of the Lord (1 Corinthians 10:16, 21).',
                ],
              },
              {
                label: 'The Paten',
                aside: 'A plain round tray',
                body: [
                  'Silver or gold, without a stand and without engraving. It stands for the Lord’s manger and for His tomb — the two places He was laid. Christ used it at the Last Supper (Matthew 26:26–27), and the Apostles after Him (1 Corinthians 10:16).',
                ],
              },
              {
                label: 'The Orban',
                aside: 'The communion bread',
                body: [
                  'Round, because a circle has no beginning and no end, as Christ is everlasting. A large cross in the centre is Jesus Christ; the twelve smaller crosses around it are the twelve disciples.',
                  'Five holes are pierced through it, for His wounds: three for the nails in the hands and the feet, one for the crown of thorns, one for the spear in His side.',
                  'Around the edge it is printed in Coptic — *Agios Otheos, Agios Esheros, Agios Athanatos*: Holy God, Holy Mighty, Holy Immortal.',
                ],
              },
            ],
          },
        ],
      },
      {
        title: 'The seven sacraments',
        blocks: [
          {
            kind: 'prose',
            paragraphs: [
              'A sacrament is an invisible grace received through a visible rite — a sign or a substance, administered by a priest. There are seven, and each has its own.',
            ],
          },
          {
            kind: 'folds',
            entries: [
              {
                label: 'Baptism',
                aside: 'Water',
                body: [
                  'Instituted by Christ’s own baptism in the Jordan, by what He said to Nicodemus (John 3), and by what He commanded the Apostles (Matthew 28:19).',
                ],
              },
              {
                label: 'Confirmation',
                aside: 'The oil of Myron',
                body: [
                  'Rooted in John 7:37–39 and Acts 8:14–17. As the believers grew too many for the Apostles to lay hands on each one, the Myron was developed — oil mixed with the spices that had been used to embalm the body of Christ — so that priests could anoint new believers to the same effect.',
                ],
              },
              {
                label: 'Confession',
                aside: 'The prayer of absolution',
                body: [
                  'Repentance. The sign is the confessing person receiving the prayer of absolution. Matthew 18:18; John 20:21–22.',
                ],
              },
              {
                label: 'Eucharist',
                aside: 'Bread and wine',
                body: [
                  'Transformed into the Body and Blood of Christ. Instituted at the Last Supper (Mark 14:22–24).',
                ],
              },
              {
                label: 'Unction of the Sick',
                aside: 'Oil',
                body: [
                  'For healing, of the body and of the mind. Matthew 10:8; Luke 10:8; Mark 6:13; James 5:14–15.',
                ],
              },
              {
                label: 'Holy Matrimony',
                aside: 'The prayers over the couple',
                body: [
                  'The sign is the bride and groom receiving the prayers that unite them in body and in spirit. Instituted by Christ’s presence at the wedding at Cana (John 2:1–11); St. Paul calls marriage a great mystery, reflecting Christ and the Church (Ephesians 5:32).',
                ],
              },
              {
                label: 'Priesthood',
                aside: 'The laying on of hands',
                body: [
                  'The sign is the ordained person receiving the prayers and the laying on of hands. Instituted when Christ chose the Twelve after a night of prayer (Luke 6:12–13) and sent them out (Matthew 28:19–20; John 20:23).',
                ],
              },
            ],
          },
        ],
      },
      {
        title: 'The liturgy, told as a wedding',
        blocks: [
          {
            kind: 'prose',
            paragraphs: [
              'This is how the shape of the service is taught: not as a list of parts but as a courtship, in order, each stage following from the one before it.',
            ],
          },
          {
            kind: 'steps',
            steps: [
              {
                title: 'The Groom’s invitation',
                service: 'Vespers, Matins and the midnight praises',
                body: [
                  'The Groom knocks, to say that the proposal is coming. The bride — the Church — cannot sleep, and stays up praising Him all night.',
                  '*Arise, O you children of the night, let us praise the Lord of Hosts, that He may grant us the salvation of our souls.*',
                ],
              },
              {
                title: 'The meeting',
                service: 'The Offering of the Lamb',
                body: ['The Groom arrives, and formally proposes.'],
              },
              {
                title: 'The dialogue',
                service: 'The readings',
                body: [
                  'The bride’s family asks to know Him better. The Church listens — the Pauline, the Catholic, the Praxis, the Synaxarium, the Psalm and the Gospel — and in them He tells them His life and what He believes.',
                ],
              },
              {
                title: 'Reconciliation',
                service: 'Before the union proceeds',
                body: [
                  'Whatever stands between the Groom and the bride is taken out of the way first. Nothing goes further until it is.',
                ],
              },
              {
                title: 'The marriage',
                service: 'The Eucharistic Liturgy',
                body: [
                  'The bride asks whether He really loves her. He answers by being broken into pieces for her, in the breaking of the bread — and she takes His Body and His Blood. That is the union, and it is where the service has been going the whole time.',
                ],
              },
            ],
          },
          {
            kind: 'aside',
            text: 'Which is why the liturgy is not called a ritual but a battle of the morning: something to be prepared for and taken part in, not attended. Servants and parents are asked to help children taste and experience Christ here — not simply to bring them.',
          },
        ],
      },
    ],
  },
];

export const HERO = {
  eyebrow: 'Follow the tour',
  title: 'Six stations through the Coptic Orthodox Church',
  lede: 'The same six stops the guides walk. Collect a stamp at each one.',
};

export const TOUR_CREDITS = [
  { what: 'The Ark on a Coptic altar', author: 'That Coptic Guy', license: 'CC BY-SA 4.0', page: 'https://commons.wikimedia.org/wiki/File:Coptic_Church_altar.jpg' },
  { what: 'A bishop in the em’ma', author: 'Andre Forget - Andrew Scheer', license: 'CC0', page: 'https://commons.wikimedia.org/wiki/File:Church_of_the_Virgin_Mary_and_Saint_Athanasius_in_Mississauga_(32807384017).jpg' },
  { what: 'A censer, alight', author: 'Fadyashrafmahfouz', license: 'CC0', page: 'https://commons.wikimedia.org/wiki/File:Sacred_Incense.jpg' },
  { what: 'Leaves from a Coptic manuscript', author: 'Unknown', license: 'CC0', page: 'https://commons.wikimedia.org/wiki/File:Leaves_from_a_Coptic_Manuscript_MET_sf21-148-1as2.jpg' },
  { what: 'A Coptic tunic, late antiquity', author: 'Coptic Byzantine', license: 'Public domain', page: 'https://commons.wikimedia.org/wiki/File:Coptic_-_Tunic_-_Walters_83484.jpg' },
  { what: 'Deacons in the white tunic', author: 'Andre Forget - Andrew Scheer', license: 'CC0', page: 'https://commons.wikimedia.org/wiki/File:Church_of_the_Virgin_Mary_and_Saint_Athanasius_in_Mississauga_(33873841828).jpg' },
  { what: 'Musicians in the tomb of Nakht', author: 'Maler der Grabkammer des Nacht', license: 'Public domain', page: 'https://commons.wikimedia.org/wiki/File:Maler_der_Grabkammer_des_Nacht_001.jpg' },
  { what: 'Finger cymbals, and how a pair is held', author: 'Gudzwabofer', license: 'CC BY-SA 4.0', page: 'https://commons.wikimedia.org/wiki/File:Finger_cymbals.jpg' },
  { what: 'Coptic icon of the Archangel Michael', author: 'Unknown', license: 'Public domain', page: 'https://commons.wikimedia.org/wiki/File:Coptic_Icon_of_the_Archangel_Michael.jpg' },
  { what: 'A Coptic iconostasis', author: 'That Coptic Guy', license: 'CC BY-SA 4.0', page: 'https://commons.wikimedia.org/wiki/File:Coptic_Church_Iconostasis_and_Setup.jpg' },
  { what: 'A Coptic liturgical codex', author: 'Unknown', license: 'CC0', page: 'https://commons.wikimedia.org/wiki/File:Coptic_Liturgical_Codex_MET_DP100664.jpg' },
  { what: 'A ney', author: 'Zimbricchio', license: 'CC BY-SA 4.0', page: 'https://commons.wikimedia.org/wiki/File:Persian_ney_with_6_holes.jpg' },
  { what: 'A ney player', author: 'Michael Coghlan from Adelaide, Australia', license: 'CC BY-SA 2.0', page: 'https://commons.wikimedia.org/wiki/File:Ney_(Flute)_Player_(13305680305).jpg' },
  { what: 'An oud, from Cairo', author: 'Frank Kovalchek from Anchorage, Alaska, USA', license: 'CC BY 2.0', page: 'https://commons.wikimedia.org/wiki/File:Oud_(plucked_lute),_Cairo,_Egypt,_2009_-_MIM_PHX.jpg' },
  { what: 'Sagat and tar, engraved 1836', author: 'Edward William Lane (1801–1876), via TIMEA; derivative work by Clusternote', license: 'Public domain', page: 'https://commons.wikimedia.org/wiki/File:Sa%27ga%27t_(1),_Ta%27r_(2)._(1836)_-_TIMEA_(clip,_rotate,_%26_whiten).jpg' },
  { what: 'The Shroud of Turin, in negative', author: 'Unknown', license: 'Public domain', page: 'https://commons.wikimedia.org/wiki/File:Full_length_negatives_of_the_shroud_of_Turin.jpg' },
  { what: 'Orion and Sothis in their barks', author: 'Original — unknown (ancient egyptians), drawing — Lefébure?', license: 'Public domain', page: 'https://commons.wikimedia.org/wiki/File:Orion,_Sothis,_and_two_Horus-planets_standing_in_their_barks.jpg' },
  { what: 'Icon of St. Athanasius', author: 'Unknown', license: 'Public domain', page: 'https://commons.wikimedia.org/wiki/File:Saint-Athanasius-of-Alexandria-icon-Sozopol-Bulgaria-17century.jpg' },
  { what: 'St. Mark, from The Four Evangelists', author: 'Heinrich Aldegrever / Georg Pencz', license: 'CC0', page: 'https://commons.wikimedia.org/wiki/File:Saint_Mark,_from_The_Four_Evangelists_MET_DP836697.jpg' },
  { what: 'St. Mark and his lion, Grandes Heures', author: 'Jean Bourdichon', license: 'Public domain', page: 'https://commons.wikimedia.org/wiki/File:Grandes_Heures_Anne_de_Bretagne_Saint_Marc.jpg' },
  { what: 'A triangle', author: 'Unknown', license: 'CC0', page: 'https://commons.wikimedia.org/wiki/File:Triangle_MET_204948.jpg' },
  { what: 'Coptic tunic embroidery, 5th–6th century', author: 'Giorgi1975', license: 'CC BY-SA 4.0', page: 'https://commons.wikimedia.org/wiki/File:Fragment_of_coptic_textile._Tunic_decoration._V-VI_cc.jpg' },
  { what: 'The Veil of Veronica, Zurbarán', author: 'Francisco de Zurbarán', license: 'Public domain', page: 'https://commons.wikimedia.org/wiki/File:Francisco_de_Zurbar%C3%A1n_-_Veil_of_Veronica_-_BF.1980.9_-_Museum_of_Fine_Arts.jpg' },
  /*
   * The Pharos is credited although no station's gallery shows it: it is named
   * in station 2's reading of the icon of St. Mark, and the website lists it
   * with the other twenty-three. A credits list that quietly drops an entry is
   * the thing all four of these sets are written to avoid.
   */
  { what: 'The Pharos of Alexandria, engraved 1572', author: 'Philip Galle', license: 'Public domain', page: 'https://commons.wikimedia.org/wiki/File:Philip_Galle_-_Lighthouse_of_Alexandria_(Pharos_of_Alexandria)_-_1572.jpg' },
] as const;
