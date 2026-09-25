// The Toolbar layout's by-use tile order (spec/148).
import { describe, expect, it } from 'vitest';
import { orderByRecent, parseRecentTiles, recordTileUse } from './toolbar-recent-tiles';

const tiles = (...ids: string[]) => ids.map((id) => ({ id }));
const ids = (list: { id: string }[]) => list.map((t) => t.id);

describe('recordTileUse', () => {
  it('moves the used tile to the front', () => {
    expect(recordTileUse(['a', 'b', 'c'], 'c')).toEqual(['c', 'a', 'b']);
    expect(recordTileUse([], 'x')).toEqual(['x']);
  });

  it('returns the same list when the tile is already first', () => {
    const list = ['a', 'b'];
    expect(recordTileUse(list, 'a')).toBe(list);
  });
});

describe('orderByRecent', () => {
  it('puts used tiles first, most recent first, and keeps the rest in order', () => {
    const all = tiles('square', 'circle', 'diamond', 'table', 'timer');
    expect(ids(orderByRecent(all, ['timer']))).toEqual([
      'timer',
      'square',
      'circle',
      'diamond',
      'table',
    ]);
    expect(ids(orderByRecent(all, ['diamond', 'timer', 'elsewhere']))).toEqual([
      'diamond',
      'timer',
      'square',
      'circle',
      'table',
    ]);
  });
});

describe('parseRecentTiles', () => {
  it('reads a string array and ignores anything else', () => {
    expect(parseRecentTiles('["a","b","a",3]')).toEqual(['a', 'b']);
    expect(parseRecentTiles('{"a":1}')).toEqual([]);
    expect(parseRecentTiles('not json')).toEqual([]);
    expect(parseRecentTiles(null)).toEqual([]);
  });
});
