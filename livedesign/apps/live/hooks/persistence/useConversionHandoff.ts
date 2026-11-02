'use client';

import { useConversionHandoff as useHandoff } from '@liveworkspace/explorer/conversion-handoff';
import { useConfirm } from '@liveworkspace/workbench/hooks/ui/useConfirm';
import { useToast } from '@/hooks/ui/useToast';
import { indexClient } from '@liveworkspace/workbench/lib/index-client';
import { offlineDeleteDesign, offlineListDesigns } from '@/lib/offline/offline-store';
import { markDesignDeleted } from '@/lib/design-tombstones';
import { explorerHref } from '@liveworkspace/workbench/lib/explorer-href';
import { removeThisBrowserItem } from '@liveworkspace/workbench/lib/this-browser-remove';
import { useOfflineConversions } from './useOfflineConversion';

// Take Offline, Sync and Delete handed over by the Explorer on this app's address to the editor (ConversionHandoff),
// run by the shared handoff (@liveworkspace/explorer/conversion-handoff) with this app's conversions, confirm, toast
// and offline list (docs/specs/006-design/offline-mode.md).
export function useConversionHandoff(ownerId: string | null, signedIn: boolean) {
  const toast = useToast();
  useHandoff({
    ownerId,
    signedIn,
    app: 'livedesign',
    noun: 'design',
    conversions: useOfflineConversions(ownerId),
    confirm: useConfirm(),
    toastError: toast.error,
    getItem: (id) => indexClient.getItem(id),
    listKept: offlineListDesigns,
    // Delete handed over by the Explorer page: the item is the one open here, so it is tombstoned, removed, and the
    // editor goes back to This Browser's view it came from.
    remove: (id) =>
      removeThisBrowserItem(id, id, {
        remove: offlineDeleteDesign,
        tombstone: markDesignDeleted,
        leave: () => window.location.assign(explorerHref('offline')),
      }),
  });
}
