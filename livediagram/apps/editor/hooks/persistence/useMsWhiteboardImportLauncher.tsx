import dynamic from 'next/dynamic';
import { useCallback, useState, type ReactNode } from 'react';
import type { ImportScenes } from './useMsWhiteboardImport';

// Loaded on first open: the import's decoder joins nothing on the host's first load.
const MsWhiteboardImportDialog = dynamic(
  () =>
    import('@/components/dialogs/MsWhiteboardImportDialog').then((m) => m.MsWhiteboardImportDialog),
  { ssr: false },
);

/**
 * The one entry any host offers for the Microsoft Whiteboard import
 * (docs/specs/020-import-export/whiteboard-import.md "Where it lives"): call
 * `openMicrosoftWhiteboardImport` from the entry point, render `dialog`.
 */
export function useMsWhiteboardImportLauncher(importScenes: ImportScenes | undefined): {
  openMicrosoftWhiteboardImport: (() => void) | undefined;
  dialog: ReactNode;
} {
  const [open, setOpen] = useState(false);
  const openMicrosoftWhiteboardImport = useCallback(() => setOpen(true), []);
  return {
    openMicrosoftWhiteboardImport: importScenes ? openMicrosoftWhiteboardImport : undefined,
    dialog:
      open && importScenes ? (
        <MsWhiteboardImportDialog importScenes={importScenes} onClose={() => setOpen(false)} />
      ) : null,
  };
}
