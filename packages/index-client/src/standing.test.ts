import { describe, expect, it } from 'vitest';
import {
  grantSignedAt,
  isPutAway,
  itemStandingPath,
  parseItemStanding,
  putAwayRefusal,
} from './standing';

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

// Work Tracker 1323: an item's room refuses a grant signed before the item was put away.
describe('putAwayRefusal', () => {
  const archived = { putAway: true, at: 10_000 };

  it('reads when a grant was signed, to the millisecond when it can', () => {
    expect(grantSignedAt({ iat: 9, iatMs: 9_500 })).toBe(9_500);
    expect(grantSignedAt({ iat: 9 })).toBe(9_000);
    expect(grantSignedAt({})).toBeNull();
  });

  it('refuses a grant from before an archive, or a trash', () => {
    expect(putAwayRefusal(archived, { iatMs: 9_999 })).toBe('archived');
    expect(putAwayRefusal({ ...archived, trashed: false }, { iat: 9 })).toBe('archived');
    expect(putAwayRefusal({ ...archived, trashed: true }, { iat: 9 })).toBe('trashed');
  });

  it('lets through a grant signed since, a trashed grant and one built by hand', () => {
    expect(putAwayRefusal(archived, { iatMs: 10_000 })).toBeNull();
    expect(putAwayRefusal(archived, { iat: 11 })).toBeNull();
    expect(putAwayRefusal({ ...archived, trashed: true }, { iat: 9, trashed: true })).toBeNull();
    expect(putAwayRefusal(archived, {})).toBeNull();
  });

  it('refuses nothing on an item that is back, or a room that never heard', () => {
    expect(putAwayRefusal({ putAway: false, at: 20_000 }, { iat: 1 })).toBeNull();
    expect(putAwayRefusal(null, { iat: 1 })).toBeNull();
  });
});
