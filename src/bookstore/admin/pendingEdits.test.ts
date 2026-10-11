/**
 * The held-edit arithmetic, now that an item holds ten fields rather than two.
 *
 * The failure these guard is the one `pendingEdits.tsx` keeps describing: a
 * "back to where it started" check that compares the field it is about and
 * forgets the others, and so releases a book with a change still held. Each
 * new field — categories, weight, Media Mail, sales tax, the title and price,
 * clearance, sizes — is a new way to
 * forget, which is why `fieldsMatch` is one function and why it is tested
 * against each of them through the two exported entry points.
 */
import { nextEditsAfterNudge, settle, type ActualValues, type PendingEdit } from './pendingEdits';

/* Nothing here touches AsyncStorage; the mock only lets the file load if
   anything it imports reaches for it. */
jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const actual: ActualValues = {
  name: 'Bible',
  description: '',
  priceCents: 2000,
  wasPriceCents: null,
  stockCount: 4,
  categoryIds: ['books', 'arabic'],
  weightOz: 16,
  mediaMail: true,
  taxable: false,
  sizes: null,
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

describe('settle, with the details, clearance and sizes', () => {
  it('drops an item whose price and clearance are back where they were', () => {
    const was: Record<string, PendingEdit> = { bible: { priceCents: 1500, wasPriceCents: 2000 } };
    expect(
      settle(was, 'bible', { priceCents: 2000, wasPriceCents: null }, actual),
    ).toEqual({});
  });

  it('keeps an item put on clearance', () => {
    const edit = { priceCents: 1500, wasPriceCents: 2000 };
    expect(settle({}, 'bible', edit, actual).bible).toEqual(edit);
  });

  it('keeps clothing sizes ticked — the change the old panel lost', () => {
    const sizes = [{ label: 'M', count: 3, extraCents: 0 }];
    expect(settle({}, 'bible', { sizes }, actual).bible).toEqual({ sizes });
  });

  it('treats "by size, none ticked yet" as a change from "one item"', () => {
    expect(settle({}, 'bible', { sizes: [] }, actual).bible).toEqual({ sizes: [] });
  });

  it('drops a title typed back to what it was', () => {
    expect(settle({ bible: { name: 'Bibles' } }, 'bible', { name: 'Bible' }, actual)).toEqual({});
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

  it('does not release an item with a sale price still held', () => {
    const was: Record<string, PendingEdit> = {
      bible: { stockCount: 5, priceCents: 1500, wasPriceCents: 2000 },
    };
    expect(nextEditsAfterNudge(was, 'bible', -1, actual).bible).toEqual({
      stockCount: 4,
      priceCents: 1500,
      wasPriceCents: 2000,
    });
  });

  it('does not release a book with a category change still held', () => {
    const was: Record<string, PendingEdit> = { bible: { stockCount: 5, categoryIds: [] } };
    expect(nextEditsAfterNudge(was, 'bible', -1, actual).bible?.categoryIds).toEqual([]);
  });
});
