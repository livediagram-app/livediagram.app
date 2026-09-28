'use client';

import { useLocalStorageValue, writeLocalStorageValue } from '@/hooks/ui/useLocalStorageValue';

// List vs card layout for the Explorer browse views (docs/specs/006-diagram/diagram-snapshots.md). Device-
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
  // The saved choice, read as an external store. The static export
  // prerenders with the default (no window at build), and the hydrating
  // render matches it; the saved choice lands on the render after.
  const saved = useLocalStorageValue(STORAGE_KEY);
  const mode: ExplorerViewMode = saved === 'card' || saved === 'list' ? saved : DEFAULT_MODE;

  const update = (next: ExplorerViewMode) => writeLocalStorageValue(STORAGE_KEY, next);

  return [mode, update];
}
