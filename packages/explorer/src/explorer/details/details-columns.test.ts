import { describe, expect, it } from 'vitest';
import type { Folder } from '@liveworkspace/index-client';
import { makeItem } from '../../test/fakeClient';
import type { ShownItem } from '../../data/overlay';
import {
  DEFAULT_DETAILS_SORT,
  nextDetailsSort,
  parseDetailsSort,
  serialiseDetailsSort,
  sortDetailsEntries,
} from './details-columns';
import { formatDateTime, formatSize } from './details-format';

const folder = (id: string, name: string, over: Partial<Folder> = {}): Folder => ({
  id,
  name,
  parentId: null,
  teamId: null,
  ownerId: 'user_me',
  createdAt: 1,
  updatedAt: 1,
  ...over,
});
const item = (i: number, over: Partial<ShownItem> = {}) => makeItem(i, over) as ShownItem;
const kindOne = () => 'Plan';

describe('the Details sort', () => {
  it('reads its stored choice, and the default for anything else', () => {
    expect(parseDetailsSort('size:asc')).toEqual({ column: 'size', direction: 'asc' });
    expect(parseDetailsSort('nope:asc')).toEqual(DEFAULT_DETAILS_SORT);
    expect(parseDetailsSort(null)).toEqual(DEFAULT_DETAILS_SORT);
    expect(serialiseDetailsSort({ column: 'name', direction: 'desc' })).toBe('name:desc');
  });

  it('presses a new column in its natural direction, the same one in reverse', () => {
    expect(nextDetailsSort(DEFAULT_DETAILS_SORT, 'name')).toEqual({
      column: 'name',
      direction: 'asc',
    });
    expect(nextDetailsSort({ column: 'name', direction: 'asc' }, 'name').direction).toBe('desc');
  });

  it('keeps folders first, sorts each group, and puts dashes last both ways', () => {
    const folders = [folder('b', 'Beta'), folder('a', 'alpha')];
    const items = [
      item(1, { summary: { bytes: 10 } }),
      item(2, { summary: {} }),
      item(3, { summary: { bytes: 300 } }),
    ];
    for (const direction of ['asc', 'desc'] as const) {
      const out = sortDetailsEntries({
        folders,
        items,
        sort: { column: 'size', direction },
        itemCount: (id) => (id === 'a' ? 4 : undefined),
        kindOne,
      });
      expect(out.items.at(-1)!.id).toBe('item-2');
      expect(out.folders.at(-1)!.id).toBe('b');
    }
    const byName = sortDetailsEntries({
      folders,
      items,
      sort: { column: 'name', direction: 'asc' },
      itemCount: () => undefined,
      kindOne,
    });
    expect(byName.folders.map((f) => f.name)).toEqual(['alpha', 'Beta']);
    // A column folders lack sorts them by name.
    const byComments = sortDetailsEntries({
      folders,
      items,
      sort: { column: 'comments', direction: 'desc' },
      itemCount: () => undefined,
      kindOne,
    });
    expect(byComments.folders.map((f) => f.name)).toEqual(['alpha', 'Beta']);
  });

  it('sorts 20,000 items within budget', () => {
    const items = Array.from({ length: 20_000 }, (_, i) =>
      item(i, { title: `Plan ${(i * 7919) % 20_000}`, summary: { bytes: (i * 31) % 997 } }),
    );
    const t = performance.now();
    for (const column of ['name', 'size', 'updated'] as const) {
      sortDetailsEntries({
        folders: [],
        items,
        sort: { column, direction: 'asc' },
        itemCount: () => 0,
        kindOne,
      });
    }
    expect(performance.now() - t).toBeLessThan(1500);
  });
});

describe('the Details cells', () => {
  it('says size as objects and bytes', () => {
    expect(formatSize({ elements: 12, bytes: 3_500 }, 'en-GB')).toBe('12 objects (3.4 KB)');
    expect(formatSize({ elements: 1, bytes: 2 * 1024 * 1024 }, 'en-GB')).toBe('1 object (2 MB)');
    expect(formatSize({ bytes: 20_480 }, 'en-GB')).toBe('20 KB');
  });

  it('says dates in full', () => {
    expect(formatDateTime(Date.UTC(2026, 9, 23, 14, 5), { locale: 'en-GB', timeZone: 'UTC' })).toBe(
      '23 Oct 2026, 14:05',
    );
  });
});
