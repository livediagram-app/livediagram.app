'use client';

import { useConfirm } from '../ui/useConfirm';
import { useToast } from '../ui/useToast';
import { dismissLocalMove } from '../../lib/offline/local-move-dismissal';

// The open editor, where there is one: its id and its in-place moves (useSyncInPlace, useTakeOfflineInPlace).
type OpenEditor = {
  documentId: string;
  syncToCloud: () => Promise<unknown>;
  takeOfflineInPlace: () => Promise<unknown>;
};

// What each editor hands in, once, at module scope in its `hooks/persistence/useOfflineConversion.ts`: its editor
// context, telemetry, shared-tabs notice and its offline store's conversions (lib/offline/offline-convert).
export type OfflineConversionDeps = {
  useOptionalEditorContext: () => OpenEditor | null;
  // Counts the move (Document·Moved in the editor's telemetry), named by the editor so its telemetry manifest sees it.
  trackMoved: (type: 'SavedToCloud' | 'TakenOffline') => void;
  fetchSharedTabsNotice: (ownerId: string, id: string, action: 'offline') => Promise<string | null>;
  ConversionInProgressError: abstract new (...args: never[]) => Error;
  conversionInProgress: (id: string) => boolean;
  saveOfflineToCloud: (offlineId: string, ownerId: string) => Promise<unknown>;
  syncFailureMessage: (e: unknown) => string;
  takeCloudOffline: (id: string, ownerId: string, shareCode: string | null) => Promise<unknown>;
  offlineListDocuments: () => Promise<readonly unknown[]>;
};

// Offline Mode conversions (docs/specs/006-document/offline-mode.md) for the menus that offer them: the editor's
// Explorer panel's item menu (Take Offline, useOfflineItemMenu) and This Browser's rows (Sync).
// `syncToCloud` uploads an offline item to the account; `takeOffline` pulls a cloud item down and deletes
// the server copy (gated by a confirm). Neither reloads the page: the one open in this editor moves in place (useSyncInPlace, useTakeOfflineInPlace), and
// the Explorer loads its lists again once the returned promise settles. A second conversion
// of the same item while one runs does nothing: the guard is the conversion's own (offline-convert), not this
// hook's state, which goes with the menu the moment it closes. `close` runs first to dismiss the caller's menu.
type ConvertedDocument = { id: string; name: string; shareCode?: string | null };

export function createOfflineConversion({
  useOptionalEditorContext,
  trackMoved,
  fetchSharedTabsNotice,
  ConversionInProgressError,
  conversionInProgress,
  saveOfflineToCloud,
  syncFailureMessage,
  takeCloudOffline,
  offlineListDocuments,
}: OfflineConversionDeps) {
function useOfflineConversions(ownerId: string | null) {
  const confirm = useConfirm();
  const toast = useToast();
  const editor = useOptionalEditorContext();
  const isOpen = (id: string) => editor?.documentId === id;
  const syncToCloud = async (liveDoc: ConvertedDocument, close: () => void = () => {}) => {
    if (!ownerId || conversionInProgress(liveDoc.id)) return;
    close();
    try {
      if (editor && isOpen(liveDoc.id)) {
        await editor.syncToCloud();
      } else {
        await saveOfflineToCloud(liveDoc.id, ownerId);
        trackMoved('SavedToCloud');
      }
    } catch (e) {
      // Stays offline. A conversion already running reports for itself.
      if (!(e instanceof ConversionInProgressError)) toast.error(syncFailureMessage(e));
    }
  };

  const takeOffline = async (liveDoc: ConvertedDocument, close: () => void = () => {}) => {
    if (!ownerId || conversionInProgress(liveDoc.id)) return;
    close();
    // A shared tab stays in its other items and forks here (docs/specs/006-document/offline-mode.md).
    const notice = await fetchSharedTabsNotice(ownerId, liveDoc.id, 'offline');
    const ok = await confirm({
      title: `Take “${liveDoc.name}” Offline?`,
      message: [
        'This removes it from your account and every other device. It will exist only in this browser, with no backup.',
        notice,
      ]
        .filter(Boolean)
        .join(' '),
      confirmLabel: 'Take Offline',
    });
    if (!ok) return;
    try {
      if (editor && isOpen(liveDoc.id)) {
        await editor.takeOfflineInPlace();
        return;
      }
      await takeCloudOffline(liveDoc.id, ownerId, liveDoc.shareCode ?? null);
      // Kept here on purpose: the move prompt after signing in never offers it back (local-move-dismissal.ts).
      await offlineListDocuments().then(
        (kept) => dismissLocalMove(ownerId, kept.length),
        () => {},
      );
      trackMoved('TakenOffline');
    } catch (e) {
      // Stays on the server (aborts roll the local copy back). A conversion already running
      // reports for itself.
      if (e instanceof ConversionInProgressError) return;
      toast.error('Couldn’t take this offline. It stays safe on the server.');
    }
  };

  return { syncToCloud, takeOffline };
}

// The same, for one item's row.
function useOfflineConversion(
  liveDoc: ConvertedDocument,
  ownerId: string | null,
  close: () => void,
) {
  const { syncToCloud, takeOffline } = useOfflineConversions(ownerId);
  return {
    syncToCloud: () => syncToCloud(liveDoc, close),
    takeOffline: () => takeOffline(liveDoc, close),
  };
}

return { useOfflineConversions, useOfflineConversion };
}
