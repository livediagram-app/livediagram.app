'use client';

import { useConversionHandoff as useHandoff } from '@liveworkspace/explorer/conversion-handoff';
import { useConfirm } from '@liveworkspace/workbench/hooks/ui/useConfirm';
import { useToast } from '@/hooks/ui/useToast';
import { indexClient } from '@/lib/index-client';
import { offlineListDesigns } from '@/lib/offline/offline-store';
import { useOfflineConversions } from './useOfflineConversion';

// Take Offline and Sync handed over by the Explorer on this app's address to the editor (ConversionHandoff), run by
// the shared handoff (@liveworkspace/explorer/conversion-handoff) with this app's conversions, confirm, toast and
// offline list (docs/specs/006-design/offline-mode.md).
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
  });
}
