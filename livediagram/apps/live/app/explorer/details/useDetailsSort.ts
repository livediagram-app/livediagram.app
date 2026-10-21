'use client';

import { useLocalStorageValue, writeLocalStorageValue } from '@/hooks/ui/useLocalStorageValue';
import {
  nextDetailsSort,
  parseDetailsSort,
  serialiseDetailsSort,
  type DetailsColumnId,
  type DetailsSort,
} from './details-columns';

// The Details view's sort (docs/specs/013-workspace/explorer-details-view.md "Sorting"): device-local,
// beside the view choice, the same for every folder.
export const DETAILS_SORT_STORAGE_KEY = 'livediagram:explorer-details-sort';

export function useDetailsSort(): [DetailsSort, (column: DetailsColumnId) => void] {
  const sort = parseDetailsSort(useLocalStorageValue(DETAILS_SORT_STORAGE_KEY));
  const sortBy = (column: DetailsColumnId) =>
    writeLocalStorageValue(
      DETAILS_SORT_STORAGE_KEY,
      serialiseDetailsSort(nextDetailsSort(sort, column)),
    );
  return [sort, sortBy];
}
