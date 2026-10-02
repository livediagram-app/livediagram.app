import dynamic from 'next/dynamic';
import { useCallback, useState, type ReactNode } from 'react';
import type { ImportDrawioDocuments, ImportDrawioLibraries } from './useDrawioFileImport';

// Loaded on first open: the importer joins nothing on the host's first load.
const DrawioImportDialog = dynamic(
  () => import('@/components/dialogs/DrawioImportDialog').then((m) => m.DrawioImportDialog),
  { ssr: false },
);

/** The host's two commits: diagrams as new documents, libraries as shape libraries. */
export type DrawioImportCommits = {
  importDocuments: ImportDrawioDocuments;
  importLibraries: ImportDrawioLibraries;
};

/**
 * The one entry any host offers for importing draw.io files
 * (docs/specs/020-import-export/drawio-import.md "Import as new documents",
 * docs/specs/013-workspace/shape-libraries.md "Making libraries"): call `openDrawioImport` from the
 * entry point, render `dialog`. Absent commits (no owner yet) offer nothing.
 */
export function useDrawioImportLauncher(commits: DrawioImportCommits | undefined): {
  openDrawioImport: (() => void) | undefined;
  dialog: ReactNode;
} {
  const [open, setOpen] = useState(false);
  const openDrawioImport = useCallback(() => setOpen(true), []);
  return {
    openDrawioImport: commits ? openDrawioImport : undefined,
    dialog:
      open && commits ? (
        <DrawioImportDialog
          importDocuments={commits.importDocuments}
          importLibraries={commits.importLibraries}
          onClose={() => setOpen(false)}
        />
      ) : null,
  };
}
