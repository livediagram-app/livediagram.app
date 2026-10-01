'use client';

import { useCallback, type ReactNode } from 'react';
import type { ImportScenes } from '@/hooks/persistence/useMsWhiteboardImport';
import { useMsWhiteboardImportLauncher } from '@/hooks/persistence/useMsWhiteboardImportLauncher';
import { useExcalidrawImportLauncher } from '@/hooks/persistence/useExcalidrawImportLauncher';
import { ImportFromToolbar } from './ImportFromToolbar';
import { IMPORT_SOURCES, type ImportSourceId } from './import-sources';

/**
 * The Explorer page's imports (docs/specs/013-workspace/folders.md "Import from"): the header's
 * toolbar and the dialogs it opens. Each board becomes its own document, filed in `folderId`, and
 * the lists refresh once they exist.
 */
export function useExplorerImport(opts: {
  ownerId: string | null;
  folderId: string | null;
  onDocumentsCreated: () => void;
}): { toolbar: ReactNode; dialogs: ReactNode } {
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
  const msWhiteboard = useMsWhiteboardImportLauncher(ownerId ? importScenes : undefined);
  const excalidraw = useExcalidrawImportLauncher(ownerId ? importScenes : undefined);
  const openers: Partial<Record<ImportSourceId, () => void>> = {
    'microsoft-whiteboard': msWhiteboard.openMicrosoftWhiteboardImport,
    excalidraw: excalidraw.openExcalidrawImport,
  };
  const sources = IMPORT_SOURCES.filter((s) => openers[s.id]);
  return {
    toolbar: sources.length ? (
      <ImportFromToolbar sources={sources} onImport={(id) => openers[id]?.()} />
    ) : null,
    // Null while no import is open.
    dialogs:
      msWhiteboard.dialog || excalidraw.dialog ? (
        <>
          {msWhiteboard.dialog}
          {excalidraw.dialog}
        </>
      ) : null,
  };
}
