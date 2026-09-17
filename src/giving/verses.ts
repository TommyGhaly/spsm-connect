/**
 * The scripture on this screen.
 *
 * ---------------------------------------------------------------------------
 * Two of these are the website's and are here to match it verse for verse:
 * 1 Chronicles 29:14 opens `/giving` and 2 Corinthians 9:7 closes the giving
 * band on the homepage. The website's own note on the first is worth keeping,
 * because it is the reason it is not simply the better-known one:
 *
 *   > It is here rather than 2 Corinthians 9:7 because the homepage band
 *   > already carries that one, and because this is the sentence that says what
 *   > an offering *is*: not a gift to God but the return of what was His.
 *
 * David says it at the offering for the Temple, and the priest says it at the
 * altar in the Liturgy.
 *
 * The other five are the app's, and they are chosen to be the ones a
 * congregation would recognise rather than a case being built at somebody. They
 * are ordered as an argument the Church actually makes — give and you are
 * given to, your heart follows your treasure, the poor are lent to the Lord,
 * the tithe belongs in the storehouse, and it is the giving rather than the
 * getting that is blessed.
 *
 * ## Two rules for editing this list
 *
 * **Nothing here says where the money goes.** The website had a paragraph under
 * its giving hero about what an offering supports and how the church receives
 * one in person, and Tommy cut it — *"a lot of the text at the bottom is
 * unnecessary and inaccurate"* — because nobody had told us. That has not
 * changed. Scripture about giving is not a claim about this church's finances;
 * a sentence about the building fund would be, and would have to come from the
 * church.
 *
 * **The wording is the traditional English, not a paraphrase.** Each is cut to
 * the clause that is actually quoted, because a phone shows four lines of a
 * verse before it becomes a paragraph nobody reads. If a priest wants a
 * different rendering, change it here — the screen reads this file and nothing
 * else.
 * ---------------------------------------------------------------------------
 */

export type Scripture = {
  /** The words, without the quotation marks — the component draws those. */
  text: string;
  /** Book, chapter and verse. Drawn uppercase; write it in ordinary case. */
  reference: string;
};

/** The hero, and the website's `/giving` verse. */
export const OFFERING_VERSE: Scripture = {
  text: 'For all things come from You, and of Your own we have given You.',
  reference: '1 Chronicles 29:14',
};

/** The closing band, and the website's homepage verse. */
export const CHEERFUL_VERSE: Scripture = {
  text: 'God loves a cheerful giver.',
  reference: '2 Corinthians 9:7',
};

/** The middle band, in the order described above. */
export const GIVING_VERSES: readonly Scripture[] = [
  {
    text: 'Give, and it will be given to you: good measure, pressed down, shaken together, and running over.',
    reference: 'Luke 6:38',
  },
  {
    text: 'For where your treasure is, there your heart will be also.',
    reference: 'Matthew 6:21',
  },
  {
    text: 'He who has pity on the poor lends to the Lord, and He will pay back what he has given.',
    reference: 'Proverbs 19:17',
  },
  {
    text: 'Bring all the tithes into the storehouse, that there may be food in My house.',
    reference: 'Malachi 3:10',
  },
  {
    text: 'It is more blessed to give than to receive.',
    reference: 'Acts 20:35',
  },
];
