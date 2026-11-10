'use client';

// The dialogs of This Browser's Space (one-explorer.md "This Browser, a Space"): Move to Folder for a live item (This
// Browser's folders, or, signed in, the account's places through Sync), Move Folder for a local folder (within This
// Browser, never into itself or below it), and Delete Folder (asked first; its contents move up a level).

import { ConfirmDialog } from '@liveworkspace/ui';
import type { ReactNode } from 'react';
import {
  createThisBrowserFolder,
  deleteThisBrowserFolder,
  isLocalWithin,
  localPath,
  moveThisBrowserFolder,
  type ThisBrowserFolder,
} from '../../this-browser';
import { useMoveLocal } from '../../drag/drag';
import type { PickerFolder, PickerTeam } from '../../dialogs/PlacementBrowser';
import { SIDEBAR_LABELS } from '../../views';
import { useExplorer, type DialogTarget } from '../context';
import { BrowserIcon, useHostExtras } from '../host';
import { MoveToFolderDialog } from '../lazy-dialogs';
import { useThisBrowserFolders } from '../ThisBrowser';
import { LOCAL_FOLDER_COPY, LOCAL_SPACE_ID } from './space';

type LocalDialog = Extract<
  NonNullable<DialogTarget>,
  { kind: 'move-local-item' | 'move-local-folder' | 'delete-local-folder' }
>;

const pickLocal = (f: ThisBrowserFolder): PickerFolder => ({
  id: f.id,
  name: f.name,
  parentId: f.parentId,
});

/** This Browser as a space of the placement browser, beside My Work and the teams. */
export function localSpace(folders: readonly ThisBrowserFolder[]): PickerTeam {
  return {
    id: LOCAL_SPACE_ID,
    name: SIDEBAR_LABELS.thisBrowser,
    folders: folders.map(pickLocal),
    icon: <BrowserIcon size={16} />,
    sub: 'Kept only in this browser',
    rootLabel: SIDEBAR_LABELS.thisBrowser,
  };
}

export function LocalSpaceDialog({
  dialog,
  personal,
  teams,
  createFolder,
}: {
  dialog: LocalDialog;
  // The account's places, offered for a live item where it can sync (signed in).
  personal: PickerFolder[];
  teams: PickerTeam[];
  createFolder: (
    name: string,
    parentId: string | null,
    teamId: string | null,
  ) => Promise<PickerFolder | null>;
}): ReactNode {
  const { app, openDialog, navigate, view } = useExplorer();
  const { thisBrowser } = useHostExtras();
  const folders = useThisBrowserFolders(thisBrowser ? app : null);
  const moveLocal = useMoveLocal();
  const close = () => openDialog(null);
  // New Folder inside This Browser's space makes a local one; anywhere else an account folder.
  const createAny = async (name: string, parentId: string | null, teamId: string | null) => {
    if (teamId !== LOCAL_SPACE_ID) return createFolder(name, parentId, teamId);
    const made = createThisBrowserFolder(app, name, parentId);
    return made ? pickLocal(made) : null;
  };

  switch (dialog.kind) {
    case 'move-local-item': {
      const item = dialog.item;
      const syncs = Boolean(thisBrowser?.sync || thisBrowser?.syncHref?.(item));
      // A place in the account asks to sync next: the dialog closes onto that question.
      let next: DialogTarget = null;
      return (
        <MoveToFolderDialog
          subjectName={item.title || 'Untitled'}
          subjectKind="item"
          personalFolders={syncs ? personal : undefined}
          teams={[localSpace(folders), ...(syncs ? teams : [])]}
          currentTeamId={LOCAL_SPACE_ID}
          currentFolderId={item.folderId ?? null}
          subtitle={
            syncs
              ? 'Pick a folder here, or a place in your account to sync it to.'
              : 'Pick a folder in Browser Storage.'
          }
          onCreateFolder={createAny}
          onPick={(to) => {
            if (to.teamId === LOCAL_SPACE_ID) moveLocal(item, to.folderId);
            else next = { kind: 'sync-local', item, to };
          }}
          onClose={() => openDialog(next)}
        />
      );
    }
    case 'move-local-folder': {
      const folder = folders.find((f) => f.id === dialog.folderId);
      if (!folder) return null;
      const scope = folders.filter((f) => !isLocalWithin(folders, f.id, folder.id));
      return (
        <MoveToFolderDialog
          subjectName={folder.name}
          subjectKind="folder"
          teams={[localSpace(scope)]}
          currentTeamId={LOCAL_SPACE_ID}
          currentFolderId={folder.parentId}
          subtitle="Pick the folder it should live inside."
          onPick={(to) => void moveThisBrowserFolder(app, folder.id, to.folderId)}
          onClose={close}
        />
      );
    }
    case 'delete-local-folder': {
      const folder = folders.find((f) => f.id === dialog.folderId);
      if (!folder) return null;
      const parent = folder.parentId ? folders.find((f) => f.id === folder.parentId) : undefined;
      return (
        <ConfirmDialog
          open
          title={LOCAL_FOLDER_COPY.deleteTitle(folder.name)}
          message={LOCAL_FOLDER_COPY.deleteMessage(parent?.name ?? SIDEBAR_LABELS.thisBrowser)}
          confirmLabel="Delete Folder"
          onCancel={close}
          onConfirm={() => {
            close();
            // Deleting the folder on screen, or one holding it, goes up to where its contents went.
            const open = view.kind === 'offline' ? (view.folder ?? null) : null;
            const onScreen =
              open !== null && localPath(folders, open).some((f) => f.id === folder.id);
            if (deleteThisBrowserFolder(app, folder.id) && onScreen)
              navigate(
                folder.parentId
                  ? { kind: 'offline', folder: folder.parentId }
                  : { kind: 'offline' },
              );
          }}
        />
      );
    }
  }
}
