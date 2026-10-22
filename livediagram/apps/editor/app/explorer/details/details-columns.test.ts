import { describe, expect, it } from 'vitest';
import type { Folder } from '@/lib/api-client';
import type { PaneDocument } from '../views';
import {
  DEFAULT_DETAILS_SORT,
  nextDetailsSort,
  parseDetailsSort,
  serialiseDetailsSort,
  sortDetailsEntries,
} from './details-columns';

// docs/specs/013-workspace/explorer-details-view.md "Sorting".

const doc = (id: string, over: Partial<PaneDocument> = {}): PaneDocument => ({
  id,
  name: id,
  folderId: null,
  savedAt: 0,
  shareCode: null,
  ownerId: 'me',
  ...over,
});
const stats = (
  mode: 'diagram' | 'draw' | 'plan',
  elements: number,
  comments: number,
  bytes: number,
) => ({ mode, elements, comments, bytes }) as const;
const folder = (id: string, over: Partial<Folder> = {}): Folder =>
  ({ id, name: id, parentId: null, createdAt: 0, updatedAt: 0, teamId: null, ...over }) as Folder;

const ids = (r: { folders: Folder[]; documents: PaneDocument[] }) => [
  ...r.folders.map((f) => f.id),
  ...r.documents.map((d) => d.id),
];
const sort = (
  column: Parameters<typeof nextDetailsSort>[1],
  direction: 'asc' | 'desc',
  documents: PaneDocument[],
  folders: Folder[] = [],
  itemCount: (id: string) => number = () => 0,
) => ids(sortDetailsEntries({ folders, documents, sort: { column, direction }, itemCount }));

describe('the sort choice', () => {
  it('defaults to Updated, newest first', () => {
    expect(DEFAULT_DETAILS_SORT).toEqual({ column: 'updated', direction: 'desc' });
  });

  it('starts a column in its natural direction, then reverses it', () => {
    expect(nextDetailsSort(DEFAULT_DETAILS_SORT, 'name')).toEqual({
      column: 'name',
      direction: 'asc',
    });
    expect(nextDetailsSort(DEFAULT_DETAILS_SORT, 'size')).toEqual({
      column: 'size',
      direction: 'desc',
    });
    expect(nextDetailsSort(DEFAULT_DETAILS_SORT, 'access')).toEqual({
      column: 'access',
      direction: 'desc',
    });
    expect(nextDetailsSort({ column: 'name', direction: 'asc' }, 'name')).toEqual({
      column: 'name',
      direction: 'desc',
    });
    expect(nextDetailsSort(DEFAULT_DETAILS_SORT, 'updated')).toEqual({
      column: 'updated',
      direction: 'asc',
    });
  });

  it('reads back what it stores, and the default for anything else', () => {
    const s = { column: 'comments', direction: 'asc' } as const;
    expect(parseDetailsSort(serialiseDetailsSort(s))).toEqual(s);
    expect(parseDetailsSort(null)).toEqual(DEFAULT_DETAILS_SORT);
    expect(parseDetailsSort('size:sideways')).toEqual(DEFAULT_DETAILS_SORT);
    expect(parseDetailsSort('colour:asc')).toEqual(DEFAULT_DETAILS_SORT);
  });
});

describe('sortDetailsEntries', () => {
  it('sorts names A to Z ignoring case, and reverses', () => {
    const docs = [
      doc('b', { name: 'banana' }),
      doc('a', { name: 'Apple' }),
      doc('c', { name: 'cherry' }),
    ];
    expect(sort('name', 'asc', docs)).toEqual(['a', 'b', 'c']);
    expect(sort('name', 'desc', docs)).toEqual(['c', 'b', 'a']);
  });

  it('puts folders first, sorted by the same column where they have it', () => {
    const folders = [folder('f-old', { updatedAt: 1 }), folder('f-new', { updatedAt: 9 })];
    const docs = [doc('d', { savedAt: 100 })];
    expect(sort('updated', 'desc', docs, folders)).toEqual(['f-new', 'f-old', 'd']);
    expect(sort('updated', 'asc', docs, folders)).toEqual(['f-old', 'f-new', 'd']);
  });

  it('sorts folders by item count under Size and by name where they have no value', () => {
    const folders = [folder('b'), folder('a'), folder('c')];
    const items = (id: string) => ({ a: 1, b: 5, c: 3 })[id]!;
    expect(sort('size', 'desc', [], folders, items)).toEqual(['b', 'c', 'a']);
    expect(sort('comments', 'desc', [], folders)).toEqual(['a', 'b', 'c']);
    expect(sort('comments', 'asc', [], folders)).toEqual(['a', 'b', 'c']);
  });

  it('sorts by counted stats and keeps the uncounted last in both directions', () => {
    const docs = [
      doc('few', { stats: stats('draw', 1, 1, 100) }),
      doc('none', { stats: null }),
      doc('many', { stats: stats('plan', 9, 7, 9000) }),
    ];
    expect(sort('comments', 'desc', docs)).toEqual(['many', 'few', 'none']);
    expect(sort('comments', 'asc', docs)).toEqual(['few', 'many', 'none']);
    expect(sort('size', 'desc', docs)).toEqual(['many', 'few', 'none']);
    expect(sort('type', 'asc', docs)).toEqual(['few', 'many', 'none']);
  });

  it('ranks access Editor first', () => {
    const docs = [
      doc('viewer', { shared: { role: 'view', ownerName: null, shareCode: 'x' } }),
      doc('mine'),
      doc('participant', { shared: { role: 'participate', ownerName: null, shareCode: 'y' } }),
    ];
    expect(sort('access', 'desc', docs)).toEqual(['mine', 'participant', 'viewer']);
  });

  it('breaks ties by name, then id, so the order is stable', () => {
    const docs = [
      doc('2', { name: 'Same', savedAt: 5 }),
      doc('1', { name: 'Same', savedAt: 5 }),
      doc('0', { name: 'Aaa', savedAt: 5 }),
    ];
    expect(sort('updated', 'desc', docs)).toEqual(['0', '1', '2']);
  });

  it('sorts Created with a missing date last', () => {
    const docs = [doc('old', { createdAt: 1 }), doc('unknown'), doc('new', { createdAt: 5 })];
    expect(sort('created', 'desc', docs)).toEqual(['new', 'old', 'unknown']);
  });
});
