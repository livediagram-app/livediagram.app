'use client';

// The menus of This Browser's Space (one-explorer.md "This Browser, a Space"), as My Work's: its own row's (Open, New
// Folder) and each local folder's (Open, Rename, New Subfolder, Move Folder, Delete Folder), the same from the
// sidebar's ⋯ and right-click and a folder card's ⋯. Rename and a new folder's name are typed wherever the caller
// says (the sidebar's row, or the card).

import type { ThisBrowserFolder } from '../../this-browser';
import { MenuActionRow, MenuGroupSeparator, MenuHeader, PortalMenu } from '../../ui/Menu';
import { FolderOutlineIcon, NewFolderIcon, OpenIcon, PencilIcon, TrashIcon } from '../../ui/icons';
import { SIDEBAR_LABELS } from '../../views';
import { useExplorer } from '../context';
import { useCreateLocalFolder } from './space';

export function LocalFolderMenu({
  folder,
  anchor,
  onClose,
  onRename,
}: {
  folder: ThisBrowserFolder;
  anchor: HTMLElement | null;
  onClose: () => void;
  onRename: (folderId: string) => void;
}) {
  const { navigate, openDialog } = useExplorer();
  const create = useCreateLocalFolder();
  const run = (fn: () => void) => () => {
    onClose();
    fn();
  };
  return (
    <PortalMenu anchor={anchor} onClose={onClose} label={`Actions for ${folder.name}`}>
      <MenuHeader title={folder.name} />
      <MenuActionRow
        label="Open"
        icon={<OpenIcon />}
        onClick={run(() => navigate({ kind: 'offline', folder: folder.id }))}
      />
      <MenuActionRow
        label="Rename"
        icon={<PencilIcon />}
        onClick={run(() => onRename(folder.id))}
      />
      <MenuActionRow
        label="New Subfolder"
        icon={<NewFolderIcon />}
        onClick={run(() => create(folder.id, onRename))}
      />
      <MenuActionRow
        label="Move Folder"
        icon={<FolderOutlineIcon />}
        onClick={run(() => openDialog({ kind: 'move-local-folder', folderId: folder.id }))}
      />
      <MenuGroupSeparator />
      <MenuActionRow
        label="Delete Folder"
        icon={<TrashIcon />}
        onClick={run(() => openDialog({ kind: 'delete-local-folder', folderId: folder.id }))}
      />
    </PortalMenu>
  );
}

/** This Browser's own row's menu: Open, and New Folder at its root. */
export function ThisBrowserSpaceMenu({
  anchor,
  onClose,
  onRename,
}: {
  anchor: HTMLElement | null;
  onClose: () => void;
  onRename: (folderId: string) => void;
}) {
  const { navigate } = useExplorer();
  const create = useCreateLocalFolder();
  const run = (fn: () => void) => () => {
    onClose();
    fn();
  };
  return (
    <PortalMenu
      anchor={anchor}
      onClose={onClose}
      label={`Actions for ${SIDEBAR_LABELS.thisBrowser}`}
    >
      <MenuHeader title={SIDEBAR_LABELS.thisBrowser} />
      <MenuActionRow
        label="Open"
        icon={<OpenIcon />}
        onClick={run(() => navigate({ kind: 'offline' }))}
      />
      <MenuActionRow
        label="New Folder"
        icon={<NewFolderIcon />}
        onClick={run(() => create(null, onRename))}
      />
    </PortalMenu>
  );
}
