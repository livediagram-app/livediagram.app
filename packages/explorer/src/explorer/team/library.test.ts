import { describe, expect, it } from 'vitest';
import { kindCounts, readLibrarySort, sortLibrary, writeLibrarySort } from './library';

const item = (id: string, title: string, updatedAt: number, app = 'liveplanner') => ({
  id,
  title,
  updatedAt,
  app,
});

describe('a team’s Library', () => {
  it('counts each kind in the chips’ order, leaving out kinds with none', () => {
    expect(
      kindCounts([
        item('a', 'A', 1, 'liveplanner'),
        item('b', 'B', 1, 'livediagram'),
        item('c', 'C', 1, 'liveplanner'),
        item('d', 'D', 1, 'unknown'),
      ]),
    ).toEqual([
      { kind: 'canvas', count: 1 },
      { kind: 'plan', count: 2 },
    ]);
  });

  it('sorts by last change or by name, ties by id', () => {
    const items = [
      item('2', 'beta', 5),
      item('1', 'Alpha 10', 9),
      item('3', 'alpha 9', 5),
      item('4', '', 1),
    ];
    expect(sortLibrary(items, 'updated').map((i) => i.id)).toEqual(['1', '2', '3', '4']);
    expect(sortLibrary(items, 'name').map((i) => i.id)).toEqual(['3', '1', '2', '4']);
  });

  it('remembers the sort on this device', () => {
    localStorage.clear();
    expect(readLibrarySort()).toBe('updated');
    writeLibrarySort('name');
    expect(readLibrarySort()).toBe('name');
  });

  it('sorts a big library inside a budget', () => {
    const many = Array.from({ length: 5000 }, (_, i) => item(String(i), `Plan ${5000 - i}`, i));
    const start = performance.now();
    sortLibrary(many, 'name');
    expect(performance.now() - start).toBeLessThan(1000);
  });
});
