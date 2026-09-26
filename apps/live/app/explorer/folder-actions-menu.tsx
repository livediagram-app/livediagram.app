'use client';

// The one folder actions menu (docs/specs/013-workspace/folders.md): the Explorer page's rows, cards
// and sidebar tree, and the floating Explorer panel's personal and team
// trees all open this. Same shape as the diagram menu in
// diagram-row-shared.tsx: a header naming the folder, full-width rows
// with the icon on the left, Delete last under its own separator.
//
// Every verb is optional and a row only renders when its handler is
// passed, so a surface that can't offer one (the panel's team tree can't
// rename or delete a team folder) simply leaves it out rather than
// showing a row that does nothing.

import { CloseIcon } from '@livediagram/ui';
import {
  FolderOutlineIcon,
  OpenIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from '@/components/primitives/explorer-icons';
import {
  MenuActionRow,
  MenuGroupSeparator,
  MenuHeader,
  PortalMenu,
} from '@/components/primitives/PortalMenu';

export function FolderActionsMenu({
  folder,
  anchor,
  onClose,
  onShowInExplorer,
  onRename,
  onNewSubfolder,
  onMove,
  onDelete,
  onRemoveFromTimeline,
}: {
  folder: { id: string; name: string };
  anchor: HTMLElement | null;
  onClose: () => void;
  // Jump to this folder's page in the full Explorer. Offered by the
  // floating panel (which is a compact view of the same library); the
  // Explorer page itself leaves it out, since you are already there.
  onShowInExplorer?: () => void;
  onRename?: () => void;
  onNewSubfolder?: () => void;
  onMove?: () => void;
  onDelete?: () => void;
  // Timeline only (docs/specs/013-workspace/timeline.md §2.9): take THIS card off the reader's feed.
  // Says nothing about the folder, so it sits apart from Delete.
  onRemoveFromTimeline?: () => void;
}) {
  // Run a verb, then close: every row does this, so it's one wrapper.
  const then = (fn: () => void) => () => {
    fn();
    onClose();
  };
  const verbs = [onRename, onNewSubfolder, onMove, onRemoveFromTimeline].some(Boolean);
  return (
    <PortalMenu anchor={anchor} placement="below" onClose={onClose}>
      <MenuHeader title={folder.name} />
      {onShowInExplorer ? (
        <>
          <MenuActionRow
            plain
            icon={<OpenIcon />}
            label="Show in Explorer"
            onClick={then(onShowInExplorer)}
          />
          {verbs || onDelete ? <MenuGroupSeparator /> : null}
        </>
      ) : null}
      {onRename ? (
        <MenuActionRow
          plain
          icon={<PencilIcon size={12} />}
          label="Rename"
          onClick={then(onRename)}
        />
      ) : null}
      {onNewSubfolder ? (
        <MenuActionRow
          plain
          icon={<PlusIcon />}
          label="New Subfolder"
          onClick={then(onNewSubfolder)}
        />
      ) : null}
      {onMove ? (
        <MenuActionRow
          plain
          icon={<FolderOutlineIcon />}
          label="Change Folder"
          onClick={then(onMove)}
        />
      ) : null}
      {onRemoveFromTimeline ? (
        <MenuActionRow
          plain
          icon={<CloseIcon size={11} strokeWidth={1.8} />}
          label="Remove from Timeline"
          onClick={then(onRemoveFromTimeline)}
        />
      ) : null}
      {onDelete ? (
        <>
          {verbs ? <MenuGroupSeparator /> : null}
          <MenuActionRow
            plain
            danger
            icon={<TrashIcon size={12} />}
            label="Delete"
            onClick={then(onDelete)}
          />
        </>
      ) : null}
    </PortalMenu>
  );
}
