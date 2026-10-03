'use client';

import { useEffect } from 'react';
import { useAppNavigation } from '@/hooks/navigation/useAppNavigation';
import { debugLog } from '@/lib/debug-log';

// An Explorer address that no longer has a view of its own
// (docs/specs/013-workspace/folders.md#the-root-and-the-retired-buckets): Unsorted and Dynamic
// became the My documents root, Generated the Made by AI filter. The route survives so links
// already out there keep working. `selectedFromRoute` reads these paths as their successors, so
// the sidebar highlights the right row while this replaces the address.
export const RETIRED_VIEW_TARGETS = {
  unsorted: '/explorer/all',
  dynamic: '/explorer/all',
  generated: '/explorer/search?q=made-by%3Aai',
} as const;

export function RetiredViewRedirect({ from }: { from: keyof typeof RETIRED_VIEW_TARGETS }) {
  const router = useAppNavigation();
  useEffect(() => {
    debugLog(`[explorer] retired view replaced from=${from}`);
    router.replace(RETIRED_VIEW_TARGETS[from]);
  }, [router, from]);
  return null;
}
