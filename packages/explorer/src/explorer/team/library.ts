// A team's Library tab (liveworkspace/docs/specs/004-index/one-explorer.md "A team's page"): what each kind chip
// counts, and the two orders its Sort menu offers. Pure, so each is tested on its own.

import { APP_KINDS, type Kind } from '@liveworkspace/index-client';
import { OPENS_IN_VALUES } from '../../lens';
import { readStored, writeStored } from '../../ui/storage';

export type LibrarySort = 'updated' | 'name';
export const LIBRARY_SORTS: readonly { id: LibrarySort; label: string }[] = [
  { id: 'updated', label: 'Last Changed' },
  { id: 'name', label: 'Name' },
];

/** How many of the loaded items open in each app, in the chips' order, the kinds with none left out. */
export function kindCounts(items: readonly { app: string }[]): { kind: Kind; count: number }[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const kind = APP_KINDS[item.app as keyof typeof APP_KINDS];
    if (kind) counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  return OPENS_IN_VALUES.filter((kind) => counts.has(kind)).map((kind) => ({
    kind,
    count: counts.get(kind)!,
  }));
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

/** The items in the chosen order: newest change first, or by name, A to Z (ties by id, so the order is stable). */
export function sortLibrary<T extends { id: string; title: string; updatedAt: number }>(
  items: readonly T[],
  sort: LibrarySort,
): T[] {
  if (sort === 'updated') {
    return [...items].sort((a, b) => b.updatedAt - a.updatedAt || (a.id < b.id ? -1 : 1));
  }
  const keyed = items.map((item) => ({ item, name: item.title || 'Untitled' }));
  keyed.sort((a, b) => collator.compare(a.name, b.name) || (a.item.id < b.item.id ? -1 : 1));
  return keyed.map((k) => k.item);
}

export const LIBRARY_SORT_KEY = 'liveworkspace:team-library-sort';

export function readLibrarySort(): LibrarySort {
  return readStored(LIBRARY_SORT_KEY) === 'name' ? 'name' : 'updated';
}

export function writeLibrarySort(sort: LibrarySort): void {
  writeStored(LIBRARY_SORT_KEY, sort);
}
