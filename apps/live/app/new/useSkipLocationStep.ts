'use client';

import { useEffect } from 'react';
import { useCachedPreferences } from '@/hooks/persistence/useEditorPreferences';
import { debugLog } from '@/lib/debug-log';
import {
  readSkipLocationStep,
  resolveSkipLocation,
  type SkipLocationStep,
  type SkipPlaceLists,
} from '@/lib/skip-location-step';
import { fetchUserPreferences } from '@/lib/user-preferences';

// Where /new saves without a Location step (docs/specs/013-workspace/default-folders.md "Skipping
// the Location step"): the reader's `skipLocationStep` preference, from this device's cache and
// then the server's copy, resolved against the URL's context and the loaded folders. Null is the
// normal two-step wizard.
export function useSkipLocationStep({
  ownerId,
  context,
  lists,
  ready,
}: {
  /** The resolved owner, or null while identity is still pending. */
  ownerId: string | null;
  context: string | undefined;
  lists: SkipPlaceLists;
  ready: boolean;
}): SkipLocationStep | null {
  const prefs = useCachedPreferences();
  // The server copy, merged over the cache (it re-renders through the cache's change event), so a
  // preference set on another device applies here on its first visit too.
  useEffect(() => {
    if (ownerId) void fetchUserPreferences(ownerId);
  }, [ownerId]);
  const { place, unavailable } = resolveSkipLocation({
    pref: readSkipLocationStep(prefs),
    context,
    lists,
    ready,
  });
  useEffect(() => {
    if (unavailable)
      debugLog(`[skip-location] place-unavailable scope=${unavailable}, showing the Location step`);
  }, [unavailable]);
  return place;
}
