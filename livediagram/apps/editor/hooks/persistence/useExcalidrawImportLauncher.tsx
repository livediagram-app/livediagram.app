import dynamic from 'next/dynamic';
import { useCallback, useState, type ReactNode } from 'react';
import type { ImportScenes } from './useMsWhiteboardImport';

// Loaded on first open: the parser joins nothing on the host's first load.
const ExcalidrawImportDialog = dynamic(
  () => import('@/components/dialogs/ExcalidrawImportDialog').then((m) => m.ExcalidrawImportDialog),
  { ssr: false },
);

/**
 * The one entry any host offers for importing Excalidraw files as new documents
 * (docs/specs/020-import-export/excalidraw-import-export.md "Import as new documents"): call
 * `openExcalidrawImport` from the entry point, render `dialog`.
 */
export function useExcalidrawImportLauncher(importScenes: ImportScenes | undefined): {
  openExcalidrawImport: (() => void) | undefined;
  dialog: ReactNode;
} {
  const [open, setOpen] = useState(false);
  const openExcalidrawImport = useCallback(() => setOpen(true), []);
  return {
    openExcalidrawImport: importScenes ? openExcalidrawImport : undefined,
    dialog:
      open && importScenes ? (
        <ExcalidrawImportDialog importScenes={importScenes} onClose={() => setOpen(false)} />
      ) : null,
  };
}
