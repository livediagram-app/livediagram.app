import { Dialog } from '@/components/dialogs/Dialog';
import { DialogCloseButton, DialogHeader } from '@livediagram/ui';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { MsWhiteboardImportPanel } from './MsWhiteboardImportPanel';
import type { ImportScenes } from '@/hooks/persistence/useMsWhiteboardImport';

export const MS_WHITEBOARD_IMPORT_TITLE = 'Import from Microsoft Whiteboard';

// The Microsoft Whiteboard import as a dialog (docs/specs/020-import-export/whiteboard-import.md
// "Where it lives"): host-agnostic, the host supplies the commit (one new document per board).
export function MsWhiteboardImportDialog({
  importScenes,
  onClose,
}: {
  importScenes: ImportScenes;
  onClose: () => void;
}) {
  return (
    <Dialog
      open
      onClose={onClose}
      ariaLabel={MS_WHITEBOARD_IMPORT_TITLE}
      size="xl"
      className="max-h-[90vh]"
    >
      <DialogHeader
        title={MS_WHITEBOARD_IMPORT_TITLE}
        subtitle="Each board becomes its own document, named and dated as the board."
      >
        <HelpArticleLink article="microsoftWhiteboardImport" size="md" />
        <DialogCloseButton onClick={onClose} />
      </DialogHeader>
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <MsWhiteboardImportPanel importScenes={importScenes} onClose={onClose} />
      </div>
    </Dialog>
  );
}
