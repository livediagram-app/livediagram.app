import { useId } from 'react';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { HeroDialogHeader } from '@liveworkspace/ui/dialog-hero';
import { importHeroArt } from '@liveworkspace/ui/dialog-hero-art/import';
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
  const titleId = useId();
  return (
    <Dialog
      open
      onClose={onClose}
      ariaLabel={MS_WHITEBOARD_IMPORT_TITLE}
      size="xl"
      className="max-h-[90vh]"
    >
      {/* The dialog hero header (dialog-hero-header.md): Import's art, files coming in. */}
      <HeroDialogHeader
        art={importHeroArt}
        titleId={titleId}
        title={MS_WHITEBOARD_IMPORT_TITLE}
        subtitle="Each board becomes its own canvas."
        actions={<HelpArticleLink article="microsoftWhiteboardImport" size="md" />}
        onClose={onClose}
      />
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <MsWhiteboardImportPanel importScenes={importScenes} onClose={onClose} />
      </div>
    </Dialog>
  );
}
