import { useId } from 'react';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { HeroDialogHeader } from '@liveworkspace/ui/dialog-hero';
import { importHeroArt } from '@liveworkspace/ui/dialog-hero-art/import';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import type {
  ImportDrawioDocuments,
  ImportDrawioLibraries,
} from '@/hooks/persistence/useDrawioFileImport';
import { DrawioImportPanel } from './DrawioImportPanel';

const DRAWIO_IMPORT_TITLE = 'Import from draw.io';

// The Explorer's draw.io import as a dialog (docs/specs/020-import-export/drawio-import.md "Import as
// new documents"): host-agnostic, the host supplies the commit (one document per diagram file).
export function DrawioImportDialog({
  importDocuments,
  importLibraries,
  onClose,
}: {
  importDocuments: ImportDrawioDocuments;
  importLibraries: ImportDrawioLibraries;
  onClose: () => void;
}) {
  const titleId = useId();
  return (
    <Dialog open onClose={onClose} ariaLabel={DRAWIO_IMPORT_TITLE} size="lg">
      {/* The dialog hero header (dialog-hero-header.md): Import's art, files coming in. */}
      <HeroDialogHeader
        art={importHeroArt}
        titleId={titleId}
        title={DRAWIO_IMPORT_TITLE}
        subtitle="Each diagram becomes its own canvas."
        actions={<HelpArticleLink article="drawioImport" size="md" />}
        onClose={onClose}
      />
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <DrawioImportPanel
          importDocuments={importDocuments}
          importLibraries={importLibraries}
          onClose={onClose}
        />
      </div>
    </Dialog>
  );
}
