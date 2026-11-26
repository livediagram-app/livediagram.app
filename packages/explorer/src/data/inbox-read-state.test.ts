// The read state on screen (inbox-reading.md "Read and unread"): the index's, with this page's marks laid over it.
import { describe, expect, it } from 'vitest';
import { withMarks } from './inbox-read-state';

describe('withMarks', () => {
  const index = { before: 5, at: { a: 10, b: 0 } };

  it('is the index’s own with no marks, and a guest’s marks alone without one', () => {
    const none = { at: new Map<string, number>(), before: null };
    expect(withMarks(index, none)).toBe(index);
    expect(withMarks(undefined, none)).toBeUndefined();
    expect(withMarks(undefined, { at: new Map([['a', 3]]), before: null })).toEqual({
      before: 0,
      at: { a: 3 },
    });
  });

  it('lays read and unread over the index’s, the page’s mark winning', () => {
    expect(
      withMarks(index, {
        at: new Map([
          ['a', 0],
          ['c', 7],
        ]),
        before: null,
      }),
    ).toEqual({
      before: 5,
      at: { a: 0, b: 0, c: 7 },
    });
  });

  it('sets aside every entry the index had before a Mark All Read here, keeping marks after it', () => {
    expect(withMarks(index, { at: new Map([['c', 0]]), before: 50 })).toEqual({
      before: 50,
      at: { c: 0 },
    });
  });
});
