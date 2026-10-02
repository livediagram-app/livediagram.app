import dynamic from 'next/dynamic';
import { useCallback, useState, type ReactNode } from 'react';
import type { ImportDrawioDocuments } from './useDrawioFileImport';

// Loaded on first open: the importer joins nothing on the host's first load.
const DrawioImportDialog = dynamic(
  () => import('@/components/dialogs/DrawioImportDialog').then((m) => m.DrawioImportDialog),
  { ssr: false },
);

/**
 * The one entry any host offers for importing draw.io files as new documents
 * (docs/specs/020-import-export/drawio-import.md "Import as new documents"): call
 * `openDrawioImport` from the entry point, render `dialog`.
 */
export function useDrawioImportLauncher(importDocuments: ImportDrawioDocuments | undefined): {
  openDrawioImport: (() => void) | undefined;
  dialog: ReactNode;
} {
  const [open, setOpen] = useState(false);
  const openDrawioImport = useCallback(() => setOpen(true), []);
  return {
    openDrawioImport: importDocuments ? openDrawioImport : undefined,
    dialog:
      open && importDocuments ? (
        <DrawioImportDialog importDocuments={importDocuments} onClose={() => setOpen(false)} />
      ) : null,
  };
}
