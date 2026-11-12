import { useId } from 'react';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { HeroDialogHeader } from '@liveworkspace/ui/dialog-hero';
import { importHeroArt } from '@liveworkspace/ui/dialog-hero-art/import';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { ExcalidrawImportPanel } from './ExcalidrawImportPanel';
import type { ImportScenes } from '@/hooks/persistence/useMsWhiteboardImport';

const EXCALIDRAW_IMPORT_TITLE = 'Import from Excalidraw';

// The Explorer's Excalidraw import as a dialog (docs/specs/020-import-export/excalidraw-import-export.md
// "Import as new documents"): host-agnostic, the host supplies the commit (one document per file).
export function ExcalidrawImportDialog({
  importScenes,
  onClose,
}: {
  importScenes: ImportScenes;
  onClose: () => void;
}) {
  const titleId = useId();
  return (
    <Dialog open onClose={onClose} ariaLabel={EXCALIDRAW_IMPORT_TITLE} size="lg">
      {/* The dialog hero header (dialog-hero-header.md): Import's art, files coming in. */}
      <HeroDialogHeader
        art={importHeroArt}
        titleId={titleId}
        title={EXCALIDRAW_IMPORT_TITLE}
        subtitle="Each file becomes its own canvas."
        actions={<HelpArticleLink article="importTabs" size="md" />}
        onClose={onClose}
      />
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <ExcalidrawImportPanel importScenes={importScenes} onClose={onClose} />
      </div>
    </Dialog>
  );
}
