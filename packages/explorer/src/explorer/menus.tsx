'use client';

// The ⋯ menus (liveplanner's ProjectEntryMenu and FolderActionsMenu): one row per verb, grouped, the same
// menu from a row, a card, the sidebar or the panel. What a row offers follows what the person may do:
// an item reached through a link can be opened, copied, starred and dismissed, and renamed when
// the link edits; one in the Trash can be restored or deleted for good.

import type { ReactNode } from 'react';
import type { Folder } from '@liveworkspace/index-client';
import type { ShownItem } from '../data/overlay';
import { MenuActionRow, MenuGroupSeparator, MenuHeader, PortalMenu } from '../ui/Menu';
import {
  DismissIcon,
  DuplicateIcon,
  FolderOutlineIcon,
  NewFolderIcon,
  OpenIcon,
  PencilIcon,
  RestoreIcon,
  ShareIcon,
  StarIcon,
  ClockIcon,
  ClockOffIcon,
  DefaultPinIcon,
  TeamIcon,
  TrashIcon,
} from '../ui/icons';
import { useExplorer } from './context';
import { rowsAbove } from './sidebar/expansion';
import { VisibilityBadge } from './badges';
import { useExtras } from './extras';

export function canManage(item: ShownItem): boolean {
  return item.access === 'edit' && !item.sharedVia;
}

export function ItemMenu({
  item,
  anchor,
  onClose,
  extra,
}: {
  item: ShownItem;
  anchor: HTMLElement | null;
  onClose: () => void;
  /** Rows a surface adds before the destructive ones (the Timeline's Remove from Timeline). */
  extra?: ReactNode;
}) {
  const { actions, openItem, setRenamingId, openDialog, navigate, kind } = useExplorer();
  const { slideOut } = useExtras();
  const run = (fn: () => void) => () => {
    onClose();
    fn();
  };
  const title = item.title || 'Untitled';
  const header = <MenuHeader title={title} aside={<VisibilityBadge item={item} />} />;

  if (item.trashedAt !== null) {
    return (
      <PortalMenu anchor={anchor} onClose={onClose} label={`Actions for ${title}`}>
        {header}
        <MenuActionRow
          label="Restore"
          icon={<RestoreIcon />}
          onClick={run(() => void actions.restore(item))}
        />
        {extra}
        <MenuGroupSeparator />
        <MenuActionRow
          label="Delete Forever"
          icon={<TrashIcon />}
          onClick={run(() => openDialog({ kind: 'purge-item', item }))}
        />
      </PortalMenu>
    );
  }

  const manage = canManage(item);
  const renames = item.access === 'edit';
  return (
    <PortalMenu anchor={anchor} onClose={onClose} label={`Actions for ${title}`}>
      {header}
      <MenuActionRow label="Open" icon={<OpenIcon />} onClick={run(() => openItem(item))} />
      {renames ? (
        <MenuActionRow
          label="Rename"
          icon={<PencilIcon />}
          onClick={run(() => setRenamingId(item.id))}
        />
      ) : null}
      <MenuActionRow
        label="Duplicate"
        icon={<DuplicateIcon />}
        onClick={run(() => void actions.duplicate(item, `${title} (copy)`))}
      />
      {manage ? (
        <MenuActionRow
          label="Change Folder"
          icon={<FolderOutlineIcon />}
          onClick={run(() => openDialog({ kind: 'move-item', item }))}
        />
      ) : null}
      {manage ? (
        <MenuActionRow
          label="Share"
          icon={<ShareIcon />}
          onClick={run(() => openDialog({ kind: 'share', item }))}
        />
      ) : null}
      <MenuGroupSeparator />
      <MenuActionRow
        label={item.favourite ? 'Remove from Favourites' : 'Add to Favourites'}
        icon={<StarIcon filled={item.favourite} />}
        onClick={run(() => void actions.setFavourite(item, !item.favourite))}
      />
      {/* The label says what the click does, and so the state: no badge anywhere else. */}
      <MenuActionRow
        label={item.hiddenFromRecent ? 'Show in Recent' : 'Hide from Recent'}
        icon={item.hiddenFromRecent ? <ClockOffIcon /> : <ClockIcon />}
        onClick={run(() => void actions.setHiddenFromRecent(item, !item.hiddenFromRecent))}
      />
      {item.teamId && !item.sharedVia ? (
        <MenuActionRow
          label="Open Team"
          icon={<TeamIcon />}
          // Its own folder in the team's library, where it sits among its neighbours.
          onClick={run(() =>
            navigate(
              item.folderId
                ? { kind: 'team', id: item.teamId!, folderId: item.folderId }
                : { kind: 'team', id: item.teamId! },
            ),
          )}
        />
      ) : null}
      {extra}
      <MenuGroupSeparator />
      {item.sharedVia ? (
        <MenuActionRow
          label="Remove from Shared With Me"
          icon={<DismissIcon />}
          onClick={run(() => void actions.dismissShared(item))}
        />
      ) : manage ? (
        <MenuActionRow
          label={`Delete ${kind.one}`}
          icon={<TrashIcon />}
          // The row slides out, then goes to the Trash.
          onClick={run(() => slideOut(item.id, () => void actions.trash(item)))}
        />
      ) : null}
    </PortalMenu>
  );
}

export function FolderMenu({
  folder,
  anchor,
  onClose,
  onRename,
}: {
  folder: Folder;
  anchor: HTMLElement | null;
  onClose: () => void;
  // Where Rename (and a new subfolder's name) is typed: in the sidebar's row when opened there; else wherever the
  // folder is listed.
  onRename?: (folderId: string) => void;
}) {
  const { folders, setRenamingId, openDialog, navigate, expansion } = useExplorer();
  const rename = onRename ?? setRenamingId;
  const run = (fn: () => void) => () => {
    onClose();
    fn();
  };
  const open = () =>
    navigate(
      folder.teamId
        ? { kind: 'team', id: folder.teamId, folderId: folder.id }
        : { kind: 'folder', id: folder.id },
    );
  return (
    <PortalMenu anchor={anchor} onClose={onClose} label={`Actions for ${folder.name}`}>
      <MenuHeader title={folder.name} />
      <MenuActionRow label="Open" icon={<OpenIcon />} onClick={run(open)} />
      <MenuActionRow label="Rename" icon={<PencilIcon />} onClick={run(() => rename(folder.id))} />
      <MenuActionRow
        label="New Subfolder"
        icon={<NewFolderIcon />}
        onClick={run(() => {
          // The sidebar opens down to the parent, so the new row is in sight.
          expansion.expand(...rowsAbove(folder.id, folders.byId));
          void folders
            .create({ name: 'New Folder', parentId: folder.id, teamId: folder.teamId })
            .then((made) => made && rename(made.id));
        })}
      />
      <MenuActionRow
        label="Move Folder"
        icon={<FolderOutlineIcon />}
        onClick={run(() => openDialog({ kind: 'move-folder', folderId: folder.id }))}
      />
      <MenuActionRow
        label="Use as Default for…"
        icon={<DefaultPinIcon />}
        onClick={run(() => openDialog({ kind: 'use-as-default', folderId: folder.id }))}
      />
      <MenuGroupSeparator />
      <MenuActionRow
        label="Delete Folder"
        icon={<TrashIcon />}
        onClick={run(() => openDialog({ kind: 'delete-folder', folderId: folder.id }))}
      />
    </PortalMenu>
  );
}
