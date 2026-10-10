/**
 * The held-edit arithmetic, now that a book holds five fields rather than two.
 *
 * The failure these guard is the one `pendingEdits.tsx` keeps describing: a
 * "back to where it started" check that compares the field it is about and
 * forgets the others, and so releases a book with a change still held. Each
 * new field — categories, weight, Media Mail, sales tax — is a new way to
 * forget, which is why `fieldsMatch` is one function and why it is tested
 * against each of them through the two exported entry points.
 */
import { nextEditsAfterNudge, settle, type ActualValues, type PendingEdit } from './pendingEdits';

/* The module's Save bar pulls in the theme, which reads AsyncStorage at import.
   Nothing here touches either; the mock only lets the file load. */
jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const actual: ActualValues = {
  stockCount: 4,
  categoryIds: ['books', 'arabic'],
  weightOz: 16,
  mediaMail: true,
  taxable: false,
};

describe('settle', () => {
  it('drops a book whose every field is back where it was', () => {
    const was: Record<string, PendingEdit> = { bible: { stockCount: 5 } };
    expect(settle(was, 'bible', { stockCount: 4 }, actual)).toEqual({});
  });

  it('treats category order as no change', () => {
    // Ticking Arabic then Books is the same filing as Books then Arabic.
    expect(settle({}, 'bible', { categoryIds: ['arabic', 'books'] }, actual)).toEqual({});
  });

  it('keeps a book whose categories changed', () => {
    const next = settle({}, 'bible', { categoryIds: ['books'] }, actual);
    expect(next.bible?.categoryIds).toEqual(['books']);
  });

  it('keeps a cleared weight, which is a change and not "untouched"', () => {
    const next = settle({}, 'bible', { weightOz: null, mediaMail: true }, actual);
    expect(next.bible).toEqual({ weightOz: null, mediaMail: true });
  });

  it('keeps a taxable flag that differs from the saved one', () => {
    expect(settle({}, 'bible', { taxable: true }, actual).bible).toEqual({ taxable: true });
  });
});

describe('nextEditsAfterNudge', () => {
  it('releases the book when the count returns and nothing else is held', () => {
    const was: Record<string, PendingEdit> = { bible: { stockCount: 5 } };
    expect(nextEditsAfterNudge(was, 'bible', -1, actual)).toEqual({});
  });

  it('does not release a book with a weight still held', () => {
    const was: Record<string, PendingEdit> = {
      bible: { stockCount: 5, weightOz: 24, mediaMail: true },
    };
    expect(nextEditsAfterNudge(was, 'bible', -1, actual).bible).toEqual({
      stockCount: 4,
      weightOz: 24,
      mediaMail: true,
    });
  });

  it('does not release a book with a category change still held', () => {
    const was: Record<string, PendingEdit> = { bible: { stockCount: 5, categoryIds: [] } };
    expect(nextEditsAfterNudge(was, 'bible', -1, actual).bible?.categoryIds).toEqual([]);
  });
});
