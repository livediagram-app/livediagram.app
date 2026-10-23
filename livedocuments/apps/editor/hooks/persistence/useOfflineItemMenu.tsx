'use client';

import { useMemo, type RefObject } from 'react';
import type { ItemMenuHost } from '@liveworkspace/explorer';
import type { Item } from '@liveworkspace/index-client';
import { SyncIcon, TakeOfflineIcon } from '@/components/primitives/explorer-icons';
import { useLatest } from '@/hooks/ui/useLatest';
import { isOfflineIdSync } from '@/lib/offline/offline-store';
import { useOfflineConversions } from './useOfflineConversion';

// The editor's Explorer panel's own verbs on a document's menu (the shared Explorer's `itemMenu`): Take Offline on a
// document in the person's library or a team's, and Sync Document on one this browser holds
// (docs/specs/006-document/offline-mode.md). Only a page on this app's origin can reach the browser's store, so
// these are the editor's, not the Explorer's. None for someone without an identity yet, another app's item, or one
// reached through a link. The host is one function for the panel's life: it reads the newest conversions when
// chosen, so the Explorer's menus never re-render for it.
export function useOfflineItemMenu(ownerId: string | null): ItemMenuHost | undefined {
  const conversions = useLatest(useOfflineConversions(ownerId));
  const hasOwner = ownerId !== null;
  return useMemo<ItemMenuHost | undefined>(
    () => (hasOwner ? (item) => offlineVerbs(item, conversions) : undefined),
    [hasOwner, conversions],
  );
}

type Conversions = RefObject<ReturnType<typeof useOfflineConversions>>;

// Read when a verb is chosen, never while the menu draws.
function offlineVerbs(item: Item, conversions: Conversions) {
  if (item.app !== 'livedocuments' || item.sharedVia || item.access !== 'edit') return [];
  const doc = { id: item.id, name: item.title || 'Untitled' };
  if (isOfflineIdSync(item.id)) {
    return [
      {
        id: 'sync-document',
        label: 'Sync Document',
        icon: <SyncIcon />,
        onSelect: () => void conversions.current.syncToCloud(doc),
      },
    ];
  }
  return [
    {
      id: 'take-offline',
      label: 'Take Offline',
      icon: <TakeOfflineIcon />,
      onSelect: () => void conversions.current.takeOffline(doc),
    },
  ];
}
