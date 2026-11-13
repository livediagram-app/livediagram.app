'use client';

// The tab bar's organise picker as a proper centred modal: "Add to Folder" (docs/specs/006-project/tab-folders.md,
// file the tab into a one-level tab-bar folder). It used to be a cramped sub-view squeezed inside the tab portal
// menu; the modal gives it the same tile-grid language as the shared placement browser
// (docs/specs/013-workspace/folders.md), with room to breathe. Single-click commits: it is a one-shot picker.
// (Add to Plan is not offered: docs/specs/006-project/tab-project-many-to-many.md "Add to Plan".)

import { lucideFolderX } from '@liveworkspace/icons/lucide';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import {
  FolderPlaceIcon,
  NewFolderTile,
  PlacementCard,
} from '@liveworkspace/workbench/components/placement/PlacementCard';
import { DialogCloseButton, lucideGlyph, useEscape } from '@liveplanner/ui';

// Shared modal frame: header (title + sub + close) over a scrollable body.
function OrganiseDialogFrame({
  title,
  sub,
  onClose,
  children,
}: {
  title: string;
  sub: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  // Capture-phase Esc so this wins over the editor's global shortcuts; the
  // Dialog shell's own (bubble-phase) Esc is suppressed via closeOnEscape.
  useEscape(onClose, { capture: true, stopPropagation: true });
  return (
    <Dialog
      open
      onClose={onClose}
      ariaLabel={title}
      size="lg"
      closeOnEscape={false}
      className="max-h-[80vh]"
    >
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 pb-3 pt-5 dark:border-slate-800">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-slate-900 dark:text-slate-100">
            {title}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{sub}</p>
        </div>
        <div className="-mt-1 flex shrink-0 items-center">
          <DialogCloseButton onClick={onClose} />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
    </Dialog>
  );
}

// The No Folder tile: a folder struck out.
const NoFolderIcon = lucideGlyph(lucideFolderX, 20);

// Organise in Tab Folder (docs/specs/006-project/tab-folders.md): a tile per existing tab folder,
// a No Folder tile (the loose end of the bar), and the create-in-place New Folder tile.
// Picking commits immediately and closes — one-level folders need no browse.
export function AddTabToFolderDialog({
  folderNames,
  currentFolder,
  onMoveToFolder,
  onRemoveFromFolder,
  onClose,
}: {
  folderNames: string[];
  currentFolder: string | null;
  onMoveToFolder: (folderName: string) => void;
  onRemoveFromFolder: () => void;
  onClose: () => void;
}) {
  return (
    <OrganiseDialogFrame
      title="Organise in Tab Folder"
      sub="File this tab into a folder on the tab bar. Same name means same folder."
      onClose={onClose}
    >
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        <PlacementCard
          label="No Folder"
          sub={currentFolder === null ? 'Current' : 'Loose on the bar'}
          icon={<NoFolderIcon />}
          selected={currentFolder === null}
          onSelect={() => {
            if (currentFolder !== null) onRemoveFromFolder();
            onClose();
          }}
        />
        {folderNames.map((name) => (
          <PlacementCard
            key={name}
            label={name}
            sub={name === currentFolder ? 'Current' : 'Folder'}
            icon={<FolderPlaceIcon />}
            selected={name === currentFolder}
            onSelect={() => {
              if (name !== currentFolder) onMoveToFolder(name);
              onClose();
            }}
          />
        ))}
        <NewFolderTile
          onCreate={(name) => {
            // Typing an existing name just moves the tab into it (same
            // name = same folder, docs/specs/006-project/tab-folders.md) — exactly what the move does.
            onMoveToFolder(name);
            onClose();
            return Promise.resolve(true);
          }}
        />
      </div>
    </OrganiseDialogFrame>
  );
}
