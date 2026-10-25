'use client';

import { useMemo } from 'react';
import { useThisBrowserList, type ThisBrowserHost } from '@liveworkspace/explorer';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { useAppNavigation } from '@liveworkspace/workbench/hooks/navigation/useAppNavigation';
import { offlineDeleteDocument } from '@/lib/offline/offline-store';
import { useOfflineConversions } from './useOfflineConversion';

// This Browser in the editor's Explorer panel (docs/specs/013-workspace/explorer-structure.md "This Browser"): the documents kept only in this browser, from the
// list the offline store keeps for the Explorer (@liveworkspace/explorer/this-browser), heard as it changes. The same
// host the Explorer page on this address builds (its items, addresses and help), with the editor's own verbs: each
// opens in the editor without a page load, and Sync (signed in) moves one into the account here, in place. One host per
// list change; the verbs read the newest conversions when chosen.
export function useThisBrowserHost(ownerId: string | null, signedIn: boolean): ThisBrowserHost {
  const items = useThisBrowserList('livedocuments');
  const conversions = useLatest(useOfflineConversions(ownerId));
  const router = useAppNavigation();
  return useMemo<ThisBrowserHost>(
    () => ({
      items,
      itemHref: (item) => `/document/${encodeURIComponent(item.id)}`,
      helpHref: '/help/privacy-and-security/offline-mode/',
      open: (item) => router.push(`/document/${encodeURIComponent(item.id)}`),
      ...(signedIn
        ? {
            sync: (item) =>
              conversions.current.syncToCloud({ id: item.id, name: item.title || 'Untitled' }),
          }
        : {}),
      // Nothing else holds one, so Delete removes it for good (the Explorer asks first).
      remove: (item) => void offlineDeleteDocument(item.id),
    }),
    [items, signedIn, conversions, router],
  );
}
