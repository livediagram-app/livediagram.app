'use client';

import { useEffect, useState } from 'react';
import { readLocalStorageSafe, writeLocalStorageSafe } from '@/lib/local-storage-safe';

// List vs card layout for the Explorer browse views (spec/67). Device-
// local: a view preference, not account data, so it lives in
// localStorage like the panel-docking / notifications prefs.
export type ExplorerViewMode = 'list' | 'card';

const STORAGE_KEY = 'livediagram:explorer-view';

// Cards, not rows, for somebody who has never chosen. A diagram is a picture,
// and a wall of names in one typeface makes you read every line to find the one
// you would have recognised on sight. The people who prefer the density of rows
// know where the toggle is; the people arriving for the first time don't know
// there is anything to look for, so the default is the view that shows them
// their work.
const DEFAULT_MODE: ExplorerViewMode = 'card';

export function useExplorerViewMode(): [ExplorerViewMode, (mode: ExplorerViewMode) => void] {
  const [mode, setMode] = useState<ExplorerViewMode>(DEFAULT_MODE);

  // Read the saved choice on mount. The static export prerenders with the
  // default (no window at build), so seeding here rather than in a lazy
  // initializer avoids a hydration mismatch; a returning list-view user sees a
  // brief card flash, acceptable for a layout toggle.
  useEffect(() => {
    const saved = readLocalStorageSafe(STORAGE_KEY);
    if (saved === 'card' || saved === 'list') setMode(saved);
  }, []);

  const update = (next: ExplorerViewMode) => {
    setMode(next);
    writeLocalStorageSafe(STORAGE_KEY, next);
  };

  return [mode, update];
}
