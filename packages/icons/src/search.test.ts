import { describe, expect, it } from 'vitest';
import { searchIcons } from './search';
import { matches, paletteRank } from './search-rank';

describe('paletteRank', () => {
  it('ranks exact, prefix, substring, keyword, then no match', () => {
    const item = { name: 'Database', keywords: 'db storage' };
    expect(['database', 'data', 'base', 'storage', 'zzz'].map((q) => paletteRank(q, item))).toEqual(
      [0, 1, 2, 3, 4],
    );
    expect(matches('', 'anything')).toBe(true);
  });
});

describe('searchIcons', () => {
  it('finds line art and Technology icons, best first, and counts the rest', () => {
    const { icons, more } = searchIcons('database', 3);
    expect(icons).toHaveLength(3);
    expect(icons[0]!.label.toLowerCase()).toBe('database');
    expect(
      new Set(searchIcons('database', 50).icons.map((i) => i.set)).size,
    ).toBeGreaterThanOrEqual(1);
    expect(more).toBe(
      searchIcons('database', 50).icons.length + searchIcons('database', 50).more - 3,
    );
  });

  it('reaches the Technology catalogue, and finds nothing for nonsense', () => {
    const all = searchIcons('a', 1000).icons;
    expect(all.length).toBeGreaterThan(10);
    expect(searchIcons('qqqqzzzz', 10)).toEqual({ icons: [], more: 0 });
    expect(searchIcons('lambda', 50).icons.some((i) => i.set === 'technology')).toBe(true);
  });
});
