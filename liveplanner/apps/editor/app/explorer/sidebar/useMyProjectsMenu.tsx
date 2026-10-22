'use client';

import { EllipsisTriggerButton } from '@/components/primitives/EllipsisTriggerButton';
import { useRowMenu } from '@/components/primitives/useRowMenu';
import type { DefaultFolderMenu } from '@/hooks/persistence/useDefaultFolderMenus';
import { FolderActionsMenu } from '../folder-actions-menu';
import { SIDEBAR_LABELS } from './sidebar-structure';

// My Work' own menu (docs/specs/013-workspace/explorer-structure.md, default-folders.md "Use as
// default for"): the folder menu with "Use as Default for" alone, where an entry is checked while
// its projects land at the root. Its ⋯ (out of the tab order: the tree owns the keys), a
// right-click and Shift+F10 open it, as a folder row's do. Nothing until the defaults load.
export function useMyProjectsMenu(
  defaults: DefaultFolderMenu | undefined,
  opts: { reveal?: boolean } = {},
) {
  const menu = useRowMenu({ disabled: !defaults });
  if (!defaults) return { onContextMenu: undefined, trailing: null };
  return {
    onContextMenu: menu.onContextMenu,
    trailing: (
      <>
        <EllipsisTriggerButton
          {...menu.triggerProps}
          size="md"
          reveal={opts.reveal}
          tabIndex={-1}
          label={`Menu for ${SIDEBAR_LABELS.myProjects}`}
        />
        {menu.open ? (
          <FolderActionsMenu
            folder={{ id: 'my-projects', name: SIDEBAR_LABELS.myProjects }}
            anchor={menu.triggerRef.current}
            onClose={menu.close}
            defaults={defaults}
          />
        ) : null}
      </>
    ),
  };
}
