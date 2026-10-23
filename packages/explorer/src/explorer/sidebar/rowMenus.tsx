'use client';

// The sidebar rows' menus (liveplanner's SidebarFolderSubtree and useMyProjectsMenu): a folder row carries the
// folder menu, and My Work its own. Each opens from its ⋯ (out of the tab order: the tree owns the keys), a
// right-click on the row, or Shift+F10 / the Menu key on the focused row (useTreeNavigation turns those into the
// row's context menu). Rename and a new folder's name are typed in the sidebar's own row.

import type { Folder } from '@liveworkspace/index-client';
import { EllipsisTriggerButton, useRowMenu } from '../../ui/RowMenu';
import { SIDEBAR_LABELS } from '../../views';
import { FolderMenu, MyWorkMenu } from '../menus';

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

/** My Work's own menu: Open, New Folder at its root (named in the row, My Work opened to show it), and Use as
 *  Default for… (the root of My Work as where those creates land). */
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
