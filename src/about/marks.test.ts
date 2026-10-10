/**
 * The formatting buttons, which are one pure function and therefore testable.
 *
 * Worth the file because every case below is one somebody will hit in the first
 * minute of using the toolbar, and none of them is visible from reading the
 * implementation: where the caret lands after an unwrap, what happens when the
 * selection swallows the markers, and the one case the tiny markup cannot
 * express — a mark inside a mark.
 */
import { markAt, toggleMark } from './marks';

describe('toggleMark', () => {
  it('wraps what is selected', () => {
    // "world" in "hello world"
    expect(toggleMark('hello world', { start: 6, end: 11 }, 'bold')).toEqual({
      text: 'hello **world**',
      selection: { start: 8, end: 13 },
    });
  });

  it('opens an empty pair at a caret, ready to type into', () => {
    expect(toggleMark('hello ', { start: 6, end: 6 }, 'italic')).toEqual({
      text: 'hello **',
      selection: { start: 7, end: 7 },
    });
  });

  it('takes the markers off again when the caret is inside them', () => {
    // The caret sits between "wor" and "ld", inside **world**.
    expect(toggleMark('hello **world**', { start: 11, end: 11 }, 'bold')).toEqual({
      text: 'hello world',
      selection: { start: 6, end: 11 },
    });
  });

  it('takes the markers off when the selection swallows them', () => {
    expect(toggleMark('hello **world**', { start: 6, end: 15 }, 'bold')).toEqual({
      text: 'hello world',
      selection: { start: 6, end: 11 },
    });
  });

  it('swaps one mark for the other rather than nesting them', () => {
    // `MARKUP` is `[^*]+` inside both forms, so ***word*** renders as stray
    // asterisks. Pressing Italic inside bold replaces the bold.
    expect(toggleMark('hello **world**', { start: 11, end: 11 }, 'italic')).toEqual({
      text: 'hello *world*',
      selection: { start: 7, end: 12 },
    });
  });

  it('undoes itself when the pair it just opened is still empty', () => {
    // `MARKUP` cannot see `****` — both its forms need a character inside — so
    // this is the one case the run scanner is no help for.
    expect(toggleMark('hello ****', { start: 8, end: 8 }, 'bold')).toEqual({
      text: 'hello ',
      selection: { start: 6, end: 6 },
    });
    expect(toggleMark('hello **', { start: 7, end: 7 }, 'italic')).toEqual({
      text: 'hello ',
      selection: { start: 6, end: 6 },
    });
  });

  it('does not let italic strip the inside of an empty bold pair', () => {
    // The caret in the middle of `****` has an asterisk either side, which is
    // not an empty *italic* pair — taking one from each side would leave a
    // stray `**`.
    expect(toggleMark('hello ****', { start: 8, end: 8 }, 'italic').text).toBe('hello ******');
  });

  it('leaves a link alone and marks inside it', () => {
    const source = 'see [our belief](/about/our-belief)';
    // "belief", inside the link's words.
    expect(toggleMark(source, { start: 9, end: 15 }, 'italic').text).toBe(
      'see [our *belief*](/about/our-belief)',
    );
  });

  it('clamps a selection that is past the end of the text', () => {
    // Android reports the previous value's selection for a frame after the
    // value is replaced; the marker must not land outside the string.
    expect(toggleMark('hi', { start: 40, end: 90 }, 'bold')).toEqual({
      text: 'hi****',
      selection: { start: 4, end: 4 },
    });
  });
});

describe('markAt', () => {
  it('is on inside a run and off outside it', () => {
    const source = 'a **bold** word';
    expect(markAt(source, { start: 5, end: 5 })).toBe('bold');
    expect(markAt(source, { start: 13, end: 13 })).toBeNull();
  });

  it('is on at the inner edge, where the next keystroke lands', () => {
    const source = 'a *word*';
    // Just before the closing marker: typing here is italic.
    expect(markAt(source, { start: 7, end: 7 })).toBe('italic');
    // Just after it: typing here is not.
    expect(markAt(source, { start: 8, end: 8 })).toBeNull();
  });

  it('reads a link as neither', () => {
    expect(markAt('see [here](/x)', { start: 6, end: 6 })).toBeNull();
  });
});
