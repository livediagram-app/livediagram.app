import { describe, expect, it } from 'vitest';
import type { Item } from '@liveplanner/items';
import { firstTabIsEmpty } from './community-first-tab';

// The first tab is the Community card's picture (docs/specs/025-community/community.md "Something to show"): the
// editor calls it empty only when it is sure.

const card = { id: 'i1' } as Item;
const shownCard = { shape: 'plan-card', planCard: { itemId: 'i1' } };

describe('firstTabIsEmpty', () => {
  it('calls a Board empty only with its cards loaded and none on it', () => {
    expect(firstTabIsEmpty({ kind: 'board', elements: [] }, new Map())).toBe(true);
    expect(firstTabIsEmpty({ kind: 'board', elements: [shownCard] }, new Map([['i1', card]]))).toBe(
      false,
    );
    expect(firstTabIsEmpty({ kind: 'board', elements: [] }, null)).toBe(false);
  });

  it('calls a Dashboard empty with no part on it', () => {
    expect(firstTabIsEmpty({ kind: 'dashboard', elements: [] }, null)).toBe(true);
    expect(firstTabIsEmpty({ kind: 'dashboard', elements: [{ id: 'w' }] }, null)).toBe(false);
  });

  it('calls a Form empty with no question in it', () => {
    expect(firstTabIsEmpty({ kind: 'form', elements: [] }, null)).toBe(true);
    expect(
      firstTabIsEmpty(
        { kind: 'form', elements: [], form: { heading: 'Sign Up', sections: [] } },
        null,
      ),
    ).toBe(true);
  });

  it('never calls a Sheet empty: its values are the server’s to count', () => {
    expect(firstTabIsEmpty({ kind: 'sheet', elements: [] }, null)).toBe(false);
  });

  it('calls an ordinary tab empty with nothing on it', () => {
    expect(firstTabIsEmpty({ elements: [] }, null)).toBe(true);
    expect(firstTabIsEmpty({ elements: [{ id: 'e' }] }, null)).toBe(false);
  });
});
