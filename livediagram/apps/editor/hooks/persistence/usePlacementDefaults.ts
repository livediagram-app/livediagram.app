'use client';

import { useEffect, useSyncExternalStore } from 'react';
import type { PlacementDefaultKey } from '@livediagram/api-schema';
import { folderDefaultKeys } from '@/lib/placement-defaults/default-destination';
import {
  loadPlacementDefaults,
  placementDefaultsSnapshot,
  subscribePlacementDefaults,
  type PlacementDefaultsState,
} from '@/lib/placement-defaults/placement-defaults-store';

// The reader's default folders as React reads them (docs/specs/013-workspace/default-folders.md
// "Surfaces"): the page's one store, loaded for the owner a surface passes. Any number of surfaces
// may call it; the store loads each owner once.

const SERVER_STATE: PlacementDefaultsState = { ownerId: null, status: 'idle', defaults: new Map() };
const serverSnapshot = () => SERVER_STATE;

export function usePlacementDefaultsState(): PlacementDefaultsState {
  return useSyncExternalStore(
    subscribePlacementDefaults,
    placementDefaultsSnapshot,
    serverSnapshot,
  );
}

/** Loads (once) and reads the owner's defaults. A null owner (identity still resolving) loads
 *  nothing and reads what the store holds. */
export function usePlacementDefaults(ownerId: string | null | undefined): PlacementDefaultsState {
  useEffect(() => {
    if (ownerId) void loadPlacementDefaults(ownerId);
  }, [ownerId]);
  return usePlacementDefaultsState();
}

/** The keys this folder is the reader's default for, in list order: the marker's source. */
export function useFolderDefaultKeys(folderId: string): PlacementDefaultKey[] {
  const { defaults } = usePlacementDefaultsState();
  return folderDefaultKeys(folderId, defaults);
}
