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
  const sources = IMPORT_SOURCES.filter((s) => openers[s.id]);
  return {
    toolbar: sources.length ? (
      <ImportFromToolbar sources={sources} onImport={(id) => openers[id]?.()} />
    ) : null,
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
