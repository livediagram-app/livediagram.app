// The Details view's columns and their sort. Pure: the table and its header read these, the tests pin them.
// Folders come first, each group sorted by the column; a cell with no value (a dash) sorts last either way;
// ties go by name, then id.

import type { Folder, Level } from '@liveworkspace/index-client';
import type { ShownItem } from '../../data/overlay';

export type DetailsColumnId =
  'name' | 'type' | 'comments' | 'access' | 'size' | 'created' | 'updated';
export type SortDirection = 'asc' | 'desc';
export type DetailsSort = { column: DetailsColumnId; direction: SortDirection };

export type DetailsColumn = {
  id: DetailsColumnId;
  label: string;
  // The direction a first press sorts in.
  natural: SortDirection;
  align: 'start' | 'center' | 'end';
  // A narrow column of one icon, headed by an icon rather than its label.
  iconOnly: boolean;
  // The narrowest width that shows the column.
  shownFrom: 'always' | 'sm' | 'md' | 'lg';
};

export const DETAILS_COLUMNS: readonly DetailsColumn[] = [
  {
    id: 'name',
    label: 'Name',
    natural: 'asc',
    align: 'start',
    iconOnly: false,
    shownFrom: 'always',
  },
  { id: 'type', label: 'Type', natural: 'asc', align: 'center', iconOnly: true, shownFrom: 'sm' },
  {
    id: 'comments',
    label: 'Comments',
    natural: 'desc',
    align: 'center',
    iconOnly: true,
    shownFrom: 'md',
  },
  {
    id: 'access',
    label: 'Access',
    natural: 'desc',
    align: 'center',
    iconOnly: true,
    shownFrom: 'md',
  },
  { id: 'size', label: 'Size', natural: 'desc', align: 'end', iconOnly: false, shownFrom: 'sm' },
  {
    id: 'created',
    label: 'Created',
    natural: 'desc',
    align: 'start',
    iconOnly: false,
    shownFrom: 'lg',
  },
  {
    id: 'updated',
    label: 'Updated',
    natural: 'desc',
    align: 'start',
    iconOnly: false,
    shownFrom: 'always',
  },
];

const COLUMN = new Map(DETAILS_COLUMNS.map((c) => [c.id, c]));

export const DEFAULT_DETAILS_SORT: DetailsSort = { column: 'updated', direction: 'desc' };

/** A press on `column`: its natural direction when another column was sorted, else the reverse. */
export function nextDetailsSort(current: DetailsSort, column: DetailsColumnId): DetailsSort {
  if (current.column !== column) return { column, direction: COLUMN.get(column)!.natural };
  return { column, direction: current.direction === 'asc' ? 'desc' : 'asc' };
}

export function serialiseDetailsSort(sort: DetailsSort): string {
  return `${sort.column}:${sort.direction}`;
}

/** The stored choice, or the default for anything unreadable. */
export function parseDetailsSort(raw: string | null): DetailsSort {
  const [column, direction] = (raw ?? '').split(':');
  if (COLUMN.has(column as DetailsColumnId) && (direction === 'asc' || direction === 'desc')) {
    return { column: column as DetailsColumnId, direction };
  }
  return DEFAULT_DETAILS_SORT;
}

// Edit first when sorted largest first.
const ACCESS_RANK: Record<Level, number> = { view: 1, participate: 2, edit: 3 };

/** A sort key: a number or string, or undefined for a cell with no value. */
type Key = number | string | undefined;

/** What the Type cell names: the item's mode when the app reports one, else the host's noun for it. */
export function typeLabel(item: Pick<ShownItem, 'summary'>, kindOne: string): string {
  const mode = item.summary.mode;
  return typeof mode === 'string' && mode ? mode.charAt(0).toUpperCase() + mode.slice(1) : kindOne;
}

function itemKey(
  item: ShownItem,
  column: DetailsColumnId,
  kindOne: (item: ShownItem) => string,
): Key {
  switch (column) {
    case 'name':
      return item.title || 'Untitled';
    case 'type':
      return typeLabel(item, kindOne(item));
    case 'comments':
      return item.summary.comments;
    case 'access':
      return ACCESS_RANK[item.access];
    case 'size':
      return item.summary.bytes;
    case 'created':
      return item.createdAt;
    case 'updated':
      return item.updatedAt;
  }
}

// Folders have a name, an item count and their dates; every other column sorts them by name.
function folderKey(f: Folder, column: DetailsColumnId, itemCount: number | undefined): Key | null {
  switch (column) {
    case 'name':
      return f.name;
    case 'size':
      return itemCount;
    case 'created':
      return f.createdAt;
    case 'updated':
      return f.updatedAt;
    default:
      return null;
  }
}

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

function compareKeys(a: Key, b: Key, direction: SortDirection): number {
  if (a === undefined || b === undefined) {
    if (a === b) return 0;
    return a === undefined ? 1 : -1;
  }
  const order =
    typeof a === 'string' && typeof b === 'string'
      ? collator.compare(a, b)
      : (a as number) - (b as number);
  return direction === 'asc' ? order : -order;
}

function byNameThenId(an: string, ai: string, bn: string, bi: string): number {
  return collator.compare(an, bn) || (ai < bi ? -1 : ai > bi ? 1 : 0);
}

/**
 * Folders first, then items, each sorted by the column. Keys are worked out once per entry (a decorate-sort),
 * so a long list sorts in n log n comparisons of plain values.
 */
export function sortDetailsEntries({
  folders,
  items,
  sort,
  itemCount,
  kindOne,
}: {
  folders: readonly Folder[];
  items: readonly ShownItem[];
  sort: DetailsSort;
  itemCount: (folderId: string) => number | undefined;
  kindOne: (item: ShownItem) => string;
}): { folders: Folder[]; items: ShownItem[] } {
  const { column, direction } = sort;
  const keyedFolders = folders.map((f) => ({ f, k: folderKey(f, column, itemCount(f.id)) }));
  keyedFolders.sort((a, b) => {
    if (a.k === null || b.k === null) return byNameThenId(a.f.name, a.f.id, b.f.name, b.f.id);
    return compareKeys(a.k, b.k, direction) || byNameThenId(a.f.name, a.f.id, b.f.name, b.f.id);
  });
  const keyedItems = items.map((i) => ({
    i,
    k: itemKey(i, column, kindOne),
    n: i.title || 'Untitled',
  }));
  keyedItems.sort(
    (a, b) => compareKeys(a.k, b.k, direction) || byNameThenId(a.n, a.i.id, b.n, b.i.id),
  );
  return { folders: keyedFolders.map((x) => x.f), items: keyedItems.map((x) => x.i) };
}
