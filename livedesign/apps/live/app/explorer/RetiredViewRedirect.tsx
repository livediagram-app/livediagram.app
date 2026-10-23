'use client';

import { useEffect } from 'react';
import { useAppNavigation } from '@/hooks/navigation/useAppNavigation';
import { debugLog } from '@/lib/debug-log';

// An Explorer address that no longer has a view of its own
// (docs/specs/013-workspace/folders.md#explorer-routes): Dynamic became My Work, Generated the Made by AI filter,
// and Activity was renamed the Inbox. The route survives so links already out there keep working.
export const RETIRED_VIEW_TARGETS = {
  dynamic: '/explorer/all',
  generated: '/explorer/search?q=made-by%3Aai',
  activity: '/explorer/inbox',
} as const;

export function RetiredViewRedirect({ from }: { from: keyof typeof RETIRED_VIEW_TARGETS }) {
  const router = useAppNavigation();
  useEffect(() => {
    debugLog(`[explorer] retired view replaced from=${from}`);
    router.replace(RETIRED_VIEW_TARGETS[from]);
  }, [router, from]);
  return null;
}
