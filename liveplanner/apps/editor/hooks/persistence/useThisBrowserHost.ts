'use client';

import { useMemo } from 'react';
import { useThisBrowserList, type ThisBrowserHost } from '@liveworkspace/explorer';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { useAppNavigation } from '@liveworkspace/workbench/hooks/navigation/useAppNavigation';
import { useOfflineConversions } from './useOfflineConversion';

// This Browser in the editor's Explorer panel (docs/specs/013-workspace/explorer-structure.md "This Browser"): the plans kept only in this browser, from the
// list the offline store keeps for the Explorer (@liveworkspace/explorer/this-browser), heard as it changes. The same
// host the Explorer page on this address builds (its items, addresses and help), with the editor's own verbs: each
// opens in the editor without a page load, and Sync (signed in) moves one into the account here, in place. One host per
// list change; the verbs read the newest conversions when chosen.
export function useThisBrowserHost(ownerId: string | null, signedIn: boolean): ThisBrowserHost {
  const items = useThisBrowserList('liveplanner');
  const conversions = useLatest(useOfflineConversions(ownerId));
  const router = useAppNavigation();
  return useMemo<ThisBrowserHost>(
    () => ({
      items,
      itemHref: (item) => `/project/${encodeURIComponent(item.id)}`,
      helpHref: '/help/privacy-and-security/offline-mode/',
      open: (item) => router.push(`/project/${encodeURIComponent(item.id)}`),
      ...(signedIn
        ? {
            sync: (item) =>
              void conversions.current.syncToCloud({ id: item.id, name: item.title || 'Untitled' }),
          }
        : {}),
    }),
    [items, signedIn, conversions, router],
  );
}
