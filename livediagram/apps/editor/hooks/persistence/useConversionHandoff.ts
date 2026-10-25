'use client';

import { useConversionHandoff as useHandoff } from '@liveworkspace/explorer/conversion-handoff';
import { useConfirm } from '@liveworkspace/workbench/hooks/ui/useConfirm';
import { useToast } from '@/hooks/ui/useToast';
import { indexClient } from '@liveworkspace/workbench/lib/index-client';
import { offlineListDocuments } from '@/lib/offline/offline-store';
import { useOfflineConversions } from './useOfflineConversion';

// Take Offline and Sync handed over by the Explorer on this app's address, run by the shared handoff
// (@liveworkspace/explorer/conversion-handoff) with this app's conversions, confirm, toast and offline list
// (docs/specs/006-document/offline-mode.md).
export function useConversionHandoff(ownerId: string | null, signedIn: boolean) {
  const toast = useToast();
  useHandoff({
    ownerId,
    signedIn,
    app: 'livediagram',
    noun: 'canvas',
    conversions: useOfflineConversions(ownerId),
    confirm: useConfirm(),
    toastError: toast.error,
    getItem: (id) => indexClient.getItem(id),
    listKept: offlineListDocuments,
  });
}
