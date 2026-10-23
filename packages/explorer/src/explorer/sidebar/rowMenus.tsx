'use client';

// The sidebar rows' menus (liveplanner's SidebarFolderSubtree and useMyProjectsMenu): a folder row carries the
// folder menu, and My Work its own. Each opens from its ⋯ (out of the tab order: the tree owns the keys), a
// right-click on the row, or Shift+F10 / the Menu key on the focused row (useTreeNavigation turns those into the
// row's context menu). Rename and a new folder's name are typed in the sidebar's own row.

import type { Folder } from '@liveworkspace/index-client';
import { MenuActionRow, MenuHeader, PortalMenu } from '../../ui/Menu';
import { EllipsisTriggerButton, useRowMenu } from '../../ui/RowMenu';
import { NewFolderIcon, OpenIcon } from '../../ui/icons';
import { SIDEBAR_LABELS } from '../../views';
import { useExplorer } from '../context';
import { FolderMenu } from '../menus';
import { MY_WORK } from './expansion';

export type RowMenuParts = {
  onContextMenu?: (e: React.MouseEvent) => void;
  trailing: React.ReactNode;
};

/** A folder row's menu: Open, Rename (in the row), New Subfolder, Move Folder, Delete Folder. */
export function useFolderRowMenu(
  folder: Folder,
  { renaming, onRename }: { renaming: boolean; onRename: (folderId: string) => void },
): RowMenuParts {
  const menu = useRowMenu({ disabled: renaming });
  if (renaming) return { trailing: null };
  return {
    onContextMenu: menu.onContextMenu,
    trailing: (
      <>
        <EllipsisTriggerButton
          {...menu.triggerProps}
          size="md"
          reveal
          tabIndex={-1}
          label={`Menu for ${folder.name}`}
        />
        {menu.open ? (
          <FolderMenu
            folder={folder}
            anchor={menu.triggerRef.current}
            onClose={menu.close}
            onRename={onRename}
          />
        ) : null}
      </>
    ),
  };
}

/** My Work's own menu: Open, and New Folder at its root (named in the row, My Work opened to show it). */
export function useMyWorkMenu({
  onRename,
}: {
  onRename: (folderId: string) => void;
}): RowMenuParts {
  const menu = useRowMenu();
  return {
    onContextMenu: menu.onContextMenu,
    trailing: (
      <>
        <EllipsisTriggerButton
          {...menu.triggerProps}
          size="md"
          reveal
          tabIndex={-1}
          label={`Menu for ${SIDEBAR_LABELS.myWork}`}
        />
        {menu.open ? (
          <MyWorkMenu anchor={menu.triggerRef.current} onClose={menu.close} onRename={onRename} />
        ) : null}
      </>
    ),
  };
}

function MyWorkMenu({
  anchor,
  onClose,
  onRename,
}: {
  anchor: HTMLElement | null;
  onClose: () => void;
  onRename: (folderId: string) => void;
}) {
  const { folders, navigate, expansion } = useExplorer();
  const run = (fn: () => void) => () => {
    onClose();
    fn();
  };
  return (
    <PortalMenu anchor={anchor} onClose={onClose} label={`Actions for ${SIDEBAR_LABELS.myWork}`}>
      <MenuHeader title={SIDEBAR_LABELS.myWork} />
      <MenuActionRow
        label="Open"
        icon={<OpenIcon />}
        onClick={run(() => navigate({ kind: 'all' }))}
      />
      <MenuActionRow
        label="New Folder"
        icon={<NewFolderIcon />}
        onClick={run(() => {
          expansion.expand(MY_WORK);
          void folders
            .create({ name: 'New Folder', parentId: null, teamId: null })
            .then((made) => made && onRename(made.id));
        })}
      />
    </PortalMenu>
  );
}
