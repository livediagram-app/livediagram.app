// The Details view's columns and their sort (docs/specs/013-workspace/explorer-details-view.md
// "Columns", "Sorting"). Pure: the table and its header read these, the tests pin them.
import type { AccessLevel } from '@livediagram/api-schema';
import { editorModeLabel } from '@livediagram/document';
import type { Folder } from '@/lib/api-client';
import { readerAccessOf } from '@/lib/document-space';
import type { PaneDocument } from '../views';

export type DetailsColumnId =
  'name' | 'type' | 'comments' | 'access' | 'size' | 'created' | 'updated';

export type SortDirection = 'asc' | 'desc';
export type DetailsSort = { column: DetailsColumnId; direction: SortDirection };

export type DetailsColumn = {
  id: DetailsColumnId;
  label: string;
  // The direction a first press sorts in.
  natural: SortDirection;
  // Numbers line up on the right; the icon columns centre their one icon.
  align: 'start' | 'center' | 'end';
  // A narrow column of one icon, headed by an icon rather than its label ("Icon columns").
  iconOnly: boolean;
  // The narrowest width that shows the column ("Narrow screens").
  shownFrom: 'always' | 'sm' | 'md';
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
    shownFrom: 'md',
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

// A press on `column`: its natural direction when another column was sorted, else the reverse.
export function nextDetailsSort(current: DetailsSort, column: DetailsColumnId): DetailsSort {
  if (current.column !== column) return { column, direction: COLUMN.get(column)!.natural };
  return { column, direction: current.direction === 'asc' ? 'desc' : 'asc' };
}

export function serialiseDetailsSort(sort: DetailsSort): string {
  return `${sort.column}:${sort.direction}`;
}

// The stored choice, or the default for anything unreadable.
export function parseDetailsSort(raw: string | null): DetailsSort {
  const [column, direction] = (raw ?? '').split(':');
  if (COLUMN.has(column as DetailsColumnId) && (direction === 'asc' || direction === 'desc')) {
    return { column: column as DetailsColumnId, direction };
  }
  return DEFAULT_DETAILS_SORT;
}

// Editor first when sorted largest first.
const ACCESS_RANK: Record<AccessLevel, number> = { view: 1, participate: 2, edit: 3 };

// A sort key: a number or a string to compare, or undefined for a cell with no value (`–`), which
// always sorts last.
type Key = number | string | undefined;

function documentKey(d: PaneDocument, column: DetailsColumnId): Key {
  switch (column) {
    case 'name':
      return d.name;
    case 'type':
      return d.stats ? editorModeLabel(d.stats.mode) : undefined;
    case 'comments':
      return d.stats?.comments;
    case 'access':
      return ACCESS_RANK[readerAccessOf(d)];
    case 'size':
      return d.stats?.bytes;
    case 'created':
      return d.createdAt;
    case 'updated':
      return d.savedAt;
  }
}

// Folders have a name, an item count and their dates; every other column sorts them by name.
function folderKey(f: Folder, column: DetailsColumnId, itemCount: number): Key | null {
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

function byNameThenId(a: { name: string; id: string }, b: { name: string; id: string }): number {
  return collator.compare(a.name, b.name) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

// Folders first, then documents, each sorted by the column; ties by name, then id.
export function sortDetailsEntries({
  folders,
  documents,
  sort,
  itemCount,
}: {
  folders: readonly Folder[];
  documents: readonly PaneDocument[];
  sort: DetailsSort;
  itemCount: (folderId: string) => number;
}): { folders: Folder[]; documents: PaneDocument[] } {
  const { column, direction } = sort;
  const sortedFolders = [...folders].sort((a, b) => {
    const ka = folderKey(a, column, itemCount(a.id));
    const kb = folderKey(b, column, itemCount(b.id));
    if (ka === null || kb === null) return byNameThenId(a, b);
    return compareKeys(ka, kb, direction) || byNameThenId(a, b);
  });
  const sortedDocuments = [...documents].sort(
    (a, b) =>
      compareKeys(documentKey(a, column), documentKey(b, column), direction) || byNameThenId(a, b),
  );
  return { folders: sortedFolders, documents: sortedDocuments };
}
