'use client';

import { useCallback, useMemo, type ReactNode } from 'react';
import type { ImportScenes } from '@/hooks/persistence/useMsWhiteboardImport';
import { useMsWhiteboardImportLauncher } from '@/hooks/persistence/useMsWhiteboardImportLauncher';
import { useExcalidrawImportLauncher } from '@/hooks/persistence/useExcalidrawImportLauncher';
import { useDrawioImportLauncher } from '@/hooks/persistence/useDrawioImportLauncher';
import type {
  ImportDrawioDocuments,
  ImportDrawioLibraries,
} from '@/hooks/persistence/useDrawioFileImport';
import { useShapeLibraries } from '@/components/primitives/ShapeLibraryProvider';
import type { ImportSourceId } from './import-sources';

/**
 * The Explorer's "Import from" (docs/specs/013-workspace/folders.md "Import from"), as the /import page runs it:
 * each source's import and the dialogs it opens. Each board becomes its own canvas, filed in `folderId`; draw.io
 * libraries go to Shape Libraries. The Explorer itself draws the toolbar (@liveworkspace/explorer, from
 * APP_ITEMS.livediagram.imports) and sends people here.
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
  const importDrawioDocuments = useCallback<ImportDrawioDocuments>(
    async (files, onProgress) => {
      const [{ importDocuments }, { drawioDocumentSource }] = await Promise.all([
        import('@/lib/board-scene-import'),
        import('@/lib/drawio/new-document'),
      ]);
      return importDocuments(
        files.map((file) => drawioDocumentSource(file, { ownerId: ownerId!, offline: false })),
        {
          ownerId: ownerId!,
          offline: false,
          folderId,
          ...(onProgress ? { onProgress } : {}),
          onDocumentsCreated,
        },
      );
    },
    [ownerId, folderId, onDocumentsCreated],
  );
  // Libraries go through the shared provider, so the Shape libraries page and My shapes see them.
  const { createLibrary } = useShapeLibraries();
  const importDrawioLibraries = useCallback<ImportDrawioLibraries>(
    async (files, progress) => {
      const { importShapeLibraries } = await import('@/lib/drawio/library-store');
      return importShapeLibraries(files, {
        ownerId: ownerId!,
        createLibrary,
        onProgress: progress.onProgress,
        progressOffset: progress.offset,
        progressTotal: progress.total,
      });
    },
    [ownerId, createLibrary],
  );
  const drawioCommits = useMemo(
    () =>
      ownerId
        ? { importDocuments: importDrawioDocuments, importLibraries: importDrawioLibraries }
        : undefined,
    [ownerId, importDrawioDocuments, importDrawioLibraries],
  );
  const msWhiteboard = useMsWhiteboardImportLauncher(ownerId ? importScenes : undefined);
  const excalidraw = useExcalidrawImportLauncher(ownerId ? importScenes : undefined);
  const drawio = useDrawioImportLauncher(drawioCommits);
  const openers: Partial<Record<ImportSourceId, () => void>> = {
    'microsoft-whiteboard': msWhiteboard.openMicrosoftWhiteboardImport,
    excalidraw: excalidraw.openExcalidrawImport,
    drawio: drawio.openDrawioImport,
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
    dialogs:
      msWhiteboard.dialog || excalidraw.dialog || drawio.dialog ? (
        <>
          {msWhiteboard.dialog}
          {excalidraw.dialog}
          {drawio.dialog}
        </>
      ) : null,
  };
}
