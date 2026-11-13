import { describe, expect, it } from 'vitest';
import { isPutAway, itemStandingPath, parseItemStanding } from './standing';

describe('an item standing', () => {
  it('reads a well formed body', () => {
    expect(parseItemStanding({ archived: true, trashed: false, at: 5 })).toEqual({
      archived: true,
      trashed: false,
      at: 5,
    });
    // Anything else in it is left behind.
    expect(parseItemStanding({ archived: false, trashed: true, at: 9, extra: 1 })).toEqual({
      archived: false,
      trashed: true,
      at: 9,
    });
  });

  it('refuses anything else', () => {
    for (const body of [
      null,
      'archived',
      [],
      {},
      { archived: 'yes', trashed: false, at: 1 },
      { archived: true, trashed: 0, at: 1 },
      { archived: true, trashed: false },
      { archived: true, trashed: false, at: 0 },
      { archived: true, trashed: false, at: -1 },
      { archived: true, trashed: false, at: 1.5 },
      { archived: true, trashed: false, at: Number.MAX_VALUE },
      { archived: true, trashed: false, at: '1' },
    ]) {
      expect(parseItemStanding(body)).toBeNull();
    }
  });

  it('is put away while archived or in the Trash', () => {
    expect(isPutAway({ archived: false, trashed: false })).toBe(false);
    expect(isPutAway({ archived: true, trashed: false })).toBe(true);
    expect(isPutAway({ archived: false, trashed: true })).toBe(true);
    expect(isPutAway({ archived: true, trashed: true })).toBe(true);
  });

  it("goes to the item's standing door", () => {
    expect(itemStandingPath('a/b')).toBe('/items/a%2Fb/standing');
  });
});
