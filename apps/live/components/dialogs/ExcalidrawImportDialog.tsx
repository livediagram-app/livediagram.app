import { Dialog } from '@/components/dialogs/Dialog';
import { DialogCloseButton } from '@/components/dialogs/DialogCloseButton';
import { DialogHeader } from './DialogHeader';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { ExcalidrawImportPanel } from './ExcalidrawImportPanel';
import type { ImportScenes } from '@/hooks/persistence/useMsWhiteboardImport';

export const EXCALIDRAW_IMPORT_TITLE = 'Import from Excalidraw';

// The Explorer's Excalidraw import as a dialog (docs/specs/020-import-export/excalidraw-import-export.md
// "Import as new documents"): host-agnostic, the host supplies the commit (one document per file).
export function ExcalidrawImportDialog({
  importScenes,
  onClose,
}: {
  importScenes: ImportScenes;
  onClose: () => void;
}) {
  return (
    <Dialog open onClose={onClose} ariaLabel={EXCALIDRAW_IMPORT_TITLE} size="lg">
      <DialogHeader
        title={EXCALIDRAW_IMPORT_TITLE}
        subtitle="Each file becomes its own document, named and dated after the file."
      >
        <HelpArticleLink article="importTabs" size="md" />
        <DialogCloseButton onClick={onClose} />
      </DialogHeader>
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <ExcalidrawImportPanel importScenes={importScenes} onClose={onClose} />
      </div>
    </Dialog>
  );
}
