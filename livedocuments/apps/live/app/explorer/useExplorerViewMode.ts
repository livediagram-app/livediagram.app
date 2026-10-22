'use client';

import { useIsMobileViewport } from '@/hooks/ui/useIsMobileViewport';
import { useLocalStorageValue, writeLocalStorageValue } from '@/hooks/ui/useLocalStorageValue';

// List, card or details layout for the Explorer browse views (docs/specs/006-document/document-snapshots.md,
// docs/specs/013-workspace/explorer-details-view.md). Device-
// local: a view preference, not account data, so it lives in
// localStorage like the panel-docking / notifications prefs.
export type ExplorerViewMode = 'list' | 'card' | 'details';

const MODES: readonly ExplorerViewMode[] = ['list', 'card', 'details'];

const STORAGE_KEY = 'livedocuments:explorer-view';

// Cards, not rows, for somebody who has never chosen. A document is a picture,
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
  // List and Details are for larger screens: a phone always shows cards, and the
  // toggle is hidden there. The saved choice is kept for when the window widens.
  const isPhone = useIsMobileViewport();
  const mode: ExplorerViewMode = isPhone
    ? 'card'
    : MODES.includes(saved as ExplorerViewMode)
      ? (saved as ExplorerViewMode)
      : DEFAULT_MODE;

  const update = (next: ExplorerViewMode) => writeLocalStorageValue(STORAGE_KEY, next);

  return [mode, update];
}
