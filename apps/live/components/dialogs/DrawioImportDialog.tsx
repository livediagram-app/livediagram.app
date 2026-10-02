import { Dialog } from '@/components/dialogs/Dialog';
import { DialogCloseButton } from '@/components/dialogs/DialogCloseButton';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import type { ImportDrawioDocuments } from '@/hooks/persistence/useDrawioFileImport';
import { DialogHeader } from './DialogHeader';
import { DrawioImportPanel } from './DrawioImportPanel';

export const DRAWIO_IMPORT_TITLE = 'Import from draw.io';

// The Explorer's draw.io import as a dialog (docs/specs/020-import-export/drawio-import.md "Import as
// new documents"): host-agnostic, the host supplies the commit (one document per diagram file).
export function DrawioImportDialog({
  importDocuments,
  onClose,
}: {
  importDocuments: ImportDrawioDocuments;
  onClose: () => void;
}) {
  return (
    <Dialog open onClose={onClose} ariaLabel={DRAWIO_IMPORT_TITLE} size="lg">
      <DialogHeader
        title={DRAWIO_IMPORT_TITLE}
        subtitle="Each diagram becomes its own document, named and dated after the file."
      >
        <HelpArticleLink article="drawioImport" size="md" />
        <DialogCloseButton onClick={onClose} />
      </DialogHeader>
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <DrawioImportPanel importDocuments={importDocuments} onClose={onClose} />
      </div>
    </Dialog>
  );
}
