'use client';

import { useEffect, useState } from 'react';
import type { DiagramListItem } from '@/lib/api-client';
import { InlineRenameInput } from '@/components/primitives/InlineRenameInput';
import { EllipsisTriggerButton } from '@/components/primitives/EllipsisTriggerButton';
import { FolderOutlineIcon } from '@/components/primitives/explorer-icons';
import { useRowMenu } from '@/components/primitives/useRowMenu';
import { FolderActionsMenu } from '@/app/explorer/folder-actions-menu';
import { useDiagramDropTarget } from './useDiagramDropTarget';
import { PanelDiagramRows, type PanelRowActions } from './PanelDiagramRows';
import { TreeNodeHeader } from './TreeNodeHeader';

// A folder as the panel's tree needs it. Personal folders and the team
// sweep's rows both fit; `teamId` (set on a team folder) is what points
// Show in Explorer at the team page instead of the personal one.
export type PanelFolder = {
  id: string;
  name: string;
  parentId: string | null;
  teamId?: string | null;
};

// Everything a folder node shares with its whole subtree, passed down
// unchanged at every level.
export type PanelFolderTree = {
  foldersByParent: Map<string | null, PanelFolder[]>;
  diagramsByFolder: Map<string | null, DiagramListItem[]>;
  // Folder ids are globally unique, so the personal and team trees share
  // the panel's one expanded record.
  expanded: Record<string, boolean>;
  onToggleExpanded: (key: string) => void;
  // A folder just created arrives with its id pending, and opens renaming.
  pendingRenameId?: string | null;
  onRenameFolderCommitted?: () => void;
  // Folder verbs. Each menu row renders only when its handler is here.
  onRenameFolder?: (id: string, name: string) => void;
  onDeleteFolder?: (id: string) => void;
  onCreateChild?: (parentId: string) => Promise<void> | void;
  rows: PanelRowActions;
};

// Recursive folder node in the panel's tree, personal (Personal tab) and
// team (Teams tab) alike: the header with its menu, and when expanded the
// child folders then the folder's diagrams. It was two near-identical
// components (FolderNode and TeamFolderNode) until they were merged; a
// team folder simply arrives without the drag-and-drop handler.
export function FolderNode({
  folder,
  depth,
  tree,
}: {
  folder: PanelFolder;
  depth: number;
  tree: PanelFolderTree;
}) {
  const { expanded, onToggleExpanded, pendingRenameId, onRenameFolderCommitted } = tree;
  const { onRenameFolder, onDeleteFolder, onCreateChild } = tree;
  const childFolders = tree.foldersByParent.get(folder.id) ?? [];
  const childDiagrams = tree.diagramsByFolder.get(folder.id) ?? [];
  const childCount = childFolders.length + childDiagrams.length;
  const isExpanded = expanded[folder.id] ?? false;

  const [editing, setEditing] = useState(false);
  const menu = useRowMenu({ disabled: editing });
  // Drop a dragged diagram on the header to file it here (spec/15).
  const drop = useDiagramDropTarget(folder.id, tree.rows.onMoveDiagramToFolder);

  // Auto-enter rename mode for freshly-created folders.
  useEffect(() => {
    if (pendingRenameId === folder.id) {
      setEditing(true);
      onRenameFolderCommitted?.();
    }
  }, [pendingRenameId, folder.id, onRenameFolderCommitted]);

  const commitRename = (name: string) => {
    const next = name.trim();
    if (next && next !== folder.name && onRenameFolder) onRenameFolder(folder.id, next);
    setEditing(false);
  };

  return (
    <li>
      <TreeNodeHeader
        depth={depth}
        expanded={isExpanded}
        onToggle={() => onToggleExpanded(folder.id)}
        noun="folder"
        collapsible={childCount > 0}
        icon={<FolderOutlineIcon />}
        label={folder.name}
        count={childCount}
        drop={tree.rows.onMoveDiagramToFolder ? drop : undefined}
        // Right-click anywhere on the folder row opens the same actions
        // menu as the ellipsis button (anchored to it).
        onContextMenu={menu.onContextMenu}
        renameInput={
          editing ? (
            <InlineRenameInput
              initial={folder.name}
              onCommit={commitRename}
              onCancel={() => setEditing(false)}
              className="min-w-0 flex-1 rounded border border-brand-300 bg-white px-1 py-0.5 text-xs text-slate-800 dark:border-brand-400 dark:bg-slate-800 dark:text-slate-100"
            />
          ) : undefined
        }
        trailing={
          editing ? null : (
            <EllipsisTriggerButton {...menu.triggerProps} size="sm" reveal label="Folder menu" />
          )
        }
      />
      {menu.open ? (
        // The Explorer's shared folder menu, plus Show in Explorer: the
        // panel is a compact view of the same library, and the page is
        // where the folder can be browsed in full.
        <FolderActionsMenu
          folder={folder}
          anchor={menu.triggerRef.current}
          onClose={menu.close}
          onShowInExplorer={() =>
            window.location.assign(
              folder.teamId
                ? `/explorer/team?id=${encodeURIComponent(folder.teamId)}&folder=${encodeURIComponent(folder.id)}`
                : `/explorer/folder?id=${encodeURIComponent(folder.id)}`,
            )
          }
          onRename={onRenameFolder ? () => setEditing(true) : undefined}
          onNewSubfolder={onCreateChild ? () => void onCreateChild(folder.id) : undefined}
          onDelete={onDeleteFolder ? () => onDeleteFolder(folder.id) : undefined}
        />
      ) : null}
      {isExpanded && childCount > 0 ? (
        <ul className="flex flex-col gap-0.5">
          {childFolders.map((f) => (
            <FolderNode key={f.id} folder={f} depth={depth + 1} tree={tree} />
          ))}
          <PanelDiagramRows
            diagrams={childDiagrams}
            indent={4 + (depth + 1) * 12}
            rows={tree.rows}
          />
        </ul>
      ) : null}
    </li>
  );
}
