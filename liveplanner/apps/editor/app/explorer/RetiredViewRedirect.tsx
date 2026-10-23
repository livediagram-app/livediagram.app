'use client';

import { useEffect } from 'react';
import { useAppNavigation } from '@/hooks/navigation/useAppNavigation';

// Explorer addresses that no longer have a view of their own (docs/specs/013-workspace/explorer-structure.md):
// Dynamic became My Work, Generated the Made by AI filter (Search results narrowed to the items the index records
// with source 'ai'), and Activity is the Inbox. The routes stay so links already out there keep working: each
// replaces itself with its successor, so Back does not return to it.
export const RETIRED_VIEW_TARGETS = {
  dynamic: '/explorer/all',
  generated: '/explorer/search?q=made-by%3Aai',
  activity: '/explorer/inbox',
} as const;

export function RetiredViewRedirect({ from }: { from: keyof typeof RETIRED_VIEW_TARGETS }) {
  const router = useAppNavigation();
  useEffect(() => {
    router.replace(RETIRED_VIEW_TARGETS[from]);
  }, [router, from]);
  return null;
}
