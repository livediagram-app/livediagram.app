'use client';

import { useCallback, type ReactNode } from 'react';
import type { ImportScenes } from '@/hooks/persistence/useBoardSceneImport';
import { useExcalidrawImportLauncher } from '@/hooks/persistence/useExcalidrawImportLauncher';
import type { ImportSourceId } from './import-sources';

/**
 * The Explorer's "Import from" (docs/specs/013-workspace/folders.md "Import from"), as the /import page runs it:
 * each source's import and the dialogs it opens. Each board becomes its own canvas, filed in `folderId`. The
 * Explorer itself draws the toolbar (@liveworkspace/explorer, from APP_ITEMS.livehuddle.imports) and sends people
 * here.
 */
export function useImportDialogs(opts: {
  ownerId: string | null;
  folderId: string | null;
  onDocumentsCreated: () => void;
}): { dialogs: ReactNode; open: (id: ImportSourceId) => boolean } {
  const { ownerId, folderId, onDocumentsCreated } = opts;
  const importScenes = useCallback<ImportScenes>(
    async (scenes, onProgress) => {
      // The landing and its image pipeline load with the import, not with the Explorer.
      const { importBoardsAsDocuments } = await import('@/lib/board-scene-import');
      return importBoardsAsDocuments(scenes, {
        ownerId: ownerId!,
        offline: false,
        folderId,
        ...(onProgress ? { onProgress } : {}),
        onDocumentsCreated,
      });
    },
    [ownerId, folderId, onDocumentsCreated],
  );
  const excalidraw = useExcalidrawImportLauncher(ownerId ? importScenes : undefined);
  const openers: Partial<Record<ImportSourceId, () => void>> = {
    excalidraw: excalidraw.openExcalidrawImport,
  };
  return {
    // Opens one source's import (the /import page, from the Explorer's toolbar); false when that source can't open
    // here.
    open: (id) => {
      const opener = openers[id];
      opener?.();
      return Boolean(opener);
    },
    // Null while no import is open.
    dialogs: excalidraw.dialog ?? null,
  };
}
