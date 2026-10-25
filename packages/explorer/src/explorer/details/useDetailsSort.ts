'use client';

// The Details view's sort: device-local, beside the layout choice, the same for every folder. A choice the
// person made in an app's own Explorer (its older key) carries over.

import { useCallback, useState } from 'react';
import { readStored, writeStored } from '../../ui/storage';
import {
  nextDetailsSort,
  parseDetailsSort,
  serialiseDetailsSort,
  type DetailsColumnId,
  type DetailsSort,
} from './details-columns';

export const DETAILS_SORT_KEY = 'liveworkspace:explorer-details-sort';
export const LEGACY_DETAILS_SORT_KEYS = [
  'liveplanner:explorer-details-sort',
  'livediagram:explorer-details-sort',
] as const;

export function useDetailsSort(): [DetailsSort, (column: DetailsColumnId) => void] {
  const [sort, setSort] = useState<DetailsSort>(() =>
    parseDetailsSort(readStored(DETAILS_SORT_KEY, LEGACY_DETAILS_SORT_KEYS)),
  );
  const sortBy = useCallback((column: DetailsColumnId) => {
    setSort((now) => {
      const next = nextDetailsSort(now, column);
      writeStored(DETAILS_SORT_KEY, serialiseDetailsSort(next));
      return next;
    });
  }, []);
  return [sort, sortBy];
}
