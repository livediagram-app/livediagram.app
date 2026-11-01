'use client';

import { useEffect, useState } from 'react';
import { countRetiredParts } from '@/lib/offline/retired-parts';

// How many documents in This Browser have parts set aside (docs/specs/006-document/offline-mode.md "Moving retired
// parts to the other apps"), for Settings' row. Read once when Settings opens, not again while it is open: the
// row holds the move's dialog, which must not vanish with the row as the last document moves. Zero while unknown,
// or when the store cannot be read.
export function useRetiredPartsCount(enabled = true): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    void countRetiredParts()
      .then((n) => {
        if (live) setCount(n);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [enabled]);
  return enabled ? count : 0;
}
