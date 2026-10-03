'use client';

import type { Folder } from '@/lib/api-client';
import { InlineRenameInput } from '@/components/primitives/InlineRenameInput';
import { EllipsisTriggerButton } from '@/components/primitives/EllipsisTriggerButton';
import { useRowMenu } from '@/components/primitives/useRowMenu';
import { FolderSolidIcon } from '@/components/primitives/explorer-icons';
import type { FolderActions } from '../explorer-view-props';
import { folderMenuHandlers, type SelectedNode } from '../views';
import { FolderActionsMenu } from '../folder-actions-menu';
import { SidebarRow } from './SidebarRow';
import { trackSidebar } from './sidebar-telemetry';

// A personal folder row and its subfolders (docs/specs/013-workspace/folders.md). It carries
// the folder menu: the ⋯ button, a right-click, or Shift+F10 / the Menu key on
// the focused row. The ⋯ button is out of the tab order: the tree owns it.
export function SidebarFolderSubtree({
  folder,
  depth,
  expanded,
  onToggleExpand,
  selected,
  onSelect,
  childrenByParent,
  renamingFolderId,
  onCommitRenameFolder,
  onCancelRenameFolder,
  folderActions,
}: {
  folder: Folder;
  depth: number;
  expanded: Set<string>;
  onToggleExpand: (id: string) => void;
  selected: SelectedNode;
  onSelect: (id: string) => void;
  childrenByParent: Map<string | null, Folder[]>;
  renamingFolderId: string | null;
  onCommitRenameFolder: (id: string, name: string) => void;
  onCancelRenameFolder: () => void;
  folderActions: FolderActions;
}) {
  const kids = childrenByParent.get(folder.id) ?? [];
  const hasKids = kids.length > 0;
  const isOpen = expanded.has(folder.id);
  const isSelected = selected.kind === 'folder' && selected.id === folder.id;
  const renaming = renamingFolderId === folder.id;
  const menu = useRowMenu({ disabled: renaming });

  return (
    <SidebarRow
      icon={<FolderSolidIcon open={isOpen} />}
      label={
        renaming ? (
          <InlineRenameInput
            initial={folder.name}
            onCommit={(name) => onCommitRenameFolder(folder.id, name)}
            onCancel={onCancelRenameFolder}
            className="rounded border border-brand-300 bg-white px-1 py-0 text-xs dark:border-brand-500/50 dark:bg-slate-900 dark:text-slate-100"
          />
        ) : (
          folder.name
        )
      }
      textLabel={folder.name}
      selected={isSelected}
      onActivate={() => {
        trackSidebar('Folder');
        onSelect(folder.id);
      }}
      depth={depth}
      expandable={hasKids}
      expanded={isOpen}
      onToggleExpand={() => onToggleExpand(folder.id)}
      renaming={renaming}
      onContextMenu={menu.onContextMenu}
      trailing={
        renaming ? null : (
          <>
            <EllipsisTriggerButton
              {...menu.triggerProps}
              size="md"
              tabIndex={-1}
              label={`Menu for ${folder.name}`}
            />
            {menu.open ? (
              <FolderActionsMenu
                folder={folder}
                anchor={menu.triggerRef.current}
                onClose={menu.close}
                {...folderMenuHandlers(folderActions(folder, menu.triggerRef.current))}
              />
            ) : null}
          </>
        )
      }
    >
      {kids.map((k) => (
        <SidebarFolderSubtree
          key={k.id}
          folder={k}
          depth={depth + 1}
          expanded={expanded}
          onToggleExpand={onToggleExpand}
          selected={selected}
          onSelect={onSelect}
          childrenByParent={childrenByParent}
          renamingFolderId={renamingFolderId}
          onCommitRenameFolder={onCommitRenameFolder}
          onCancelRenameFolder={onCancelRenameFolder}
          folderActions={folderActions}
        />
      ))}
    </SidebarRow>
  );
}
