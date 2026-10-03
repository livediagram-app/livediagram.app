'use client';

import { useEffect, useState } from 'react';
import { EllipsisTriggerButton } from '@/components/primitives/EllipsisTriggerButton';
import { FolderSolidIcon } from '@/components/primitives/explorer-icons';
import { InlineRenameInput } from '@/components/primitives/InlineRenameInput';
import { useRowMenu } from '@/components/primitives/useRowMenu';
import { FolderActionsMenu } from '@/app/explorer/folder-actions-menu';
import { SidebarRow } from '@/app/explorer/sidebar/SidebarRow';
import { trackSidebar } from '@/app/explorer/sidebar/sidebar-telemetry';
import type { PaneDocument } from '@/app/explorer/views';
import { useDocumentDropTarget } from '../useDocumentDropTarget';
import { PanelDocumentItem } from './PanelDocumentItem';
import { usePanelTree } from './PanelTreeContext';
import { useDefaultFolderDescription } from '@/components/placement/DefaultFolderMarker';
import { FolderLabel } from '@/app/explorer/sidebar/SidebarFolderSubtree';

// A folder as the panel's tree needs it; `teamId` set on a team folder.
export type PanelFolder = {
  id: string;
  name: string;
  parentId: string | null;
  teamId?: string | null;
};

// One folder's subtree and its documents, indexed by parent (null = the space's root).
export type PanelFolderIndex = {
  foldersByParent: Map<string | null, PanelFolder[]>;
  documentsByFolder: Map<string | null, PaneDocument[]>;
};

// A folder row of the panel's tree, personal or team
// (docs/specs/013-workspace/explorer-structure.md#the-floating-explorer-panel): activating it
// opens or closes it, showing its subfolders, then its documents. It carries the folder menu
// plus Show in Explorer; a personal folder takes a dragged document; a folder just created
// opens renaming.
export function PanelFolderItem({
  folder,
  depth,
  index,
  team,
}: {
  folder: PanelFolder;
  depth: number;
  index: PanelFolderIndex;
  team?: { id: string; name: string };
}) {
  const tree = usePanelTree();
  const subfolders = index.foldersByParent.get(folder.id) ?? [];
  const documents = index.documentsByFolder.get(folder.id) ?? [];
  const expandable = subfolders.length + documents.length > 0;
  const expanded = tree.expanded[folder.id] ?? false;
  const [editing, setEditing] = useState(false);
  const menu = useRowMenu({ disabled: editing });
  const markerWords = useDefaultFolderDescription(folder.id);
  const personal = !team;
  const drop = useDocumentDropTarget(folder.id, personal ? tree.onMoveDocumentToFolder : undefined);

  // A folder just created enters renaming in the render that finds it pending, and the tree is
  // told (an effect) so it clears the request.
  const pending = tree.pendingRenameFolderId === folder.id;
  const [wasPending, setWasPending] = useState(false);
  if (pending !== wasPending) {
    setWasPending(pending);
    if (pending) setEditing(true);
  }
  const { onRenameFolderCommitted } = tree;
  useEffect(() => {
    if (pending) onRenameFolderCommitted();
  }, [pending, onRenameFolderCommitted]);

  const rename = personal ? tree.onRenameFolder : tree.onTeamFolders?.rename;
  const remove = personal ? tree.onDeleteFolder : tree.onTeamFolders?.delete;
  const createChild = personal
    ? () => tree.onCreateChild(folder.id)
    : tree.onTeamFolders && team
      ? () => tree.onCreateTeamChild(team.id, folder.id)
      : undefined;

  const commitRename = (name: string) => {
    const next = name.trim();
    if (next && next !== folder.name) rename?.(folder.id, next);
    setEditing(false);
  };

  return (
    <SidebarRow
      icon={<FolderSolidIcon open={expanded} />}
      label={
        editing ? (
          <InlineRenameInput
            initial={folder.name}
            onCommit={commitRename}
            onCancel={() => setEditing(false)}
            className="rounded border border-brand-300 bg-white px-1 py-0 text-xs dark:border-brand-500/50 dark:bg-slate-900 dark:text-slate-100"
          />
        ) : (
          <FolderLabel folderId={folder.id} name={folder.name} />
        )
      }
      textLabel={folder.name}
      description={markerWords || undefined}
      selected={false}
      onActivate={() => {
        trackSidebar(personal ? 'Folder' : 'TeamFolder', 'panel');
        if (expandable) tree.onToggle(folder.id);
      }}
      depth={depth}
      expandable={expandable}
      expanded={expanded}
      onToggleExpand={() => tree.onToggle(folder.id)}
      renaming={editing}
      onContextMenu={menu.onContextMenu}
      rowProps={
        personal && tree.onMoveDocumentToFolder
          ? { onDragOver: drop.onDragOver, onDragLeave: drop.onDragLeave, onDrop: drop.onDrop }
          : undefined
      }
      highlighted={drop.isDragOver}
      trailing={
        editing ? null : (
          <>
            <EllipsisTriggerButton
              {...menu.triggerProps}
              size="md"
              reveal
              tabIndex={-1}
              label={`Menu for ${folder.name}`}
            />
            {menu.open ? (
              <FolderActionsMenu
                folder={folder}
                anchor={menu.triggerRef.current}
                onClose={menu.close}
                onShowInExplorer={() =>
                  window.location.assign(
                    team
                      ? `/explorer/team?id=${encodeURIComponent(team.id)}&folder=${encodeURIComponent(folder.id)}`
                      : `/explorer/folder?id=${encodeURIComponent(folder.id)}`,
                  )
                }
                onRename={rename ? () => setEditing(true) : undefined}
                onNewSubfolder={createChild}
                onDelete={remove ? () => remove(folder.id) : undefined}
                defaults={tree.defaultFolders?.forFolder({
                  id: folder.id,
                  teamId: team?.id ?? null,
                })}
              />
            ) : null}
          </>
        )
      }
    >
      {subfolders.map((f) => (
        <PanelFolderItem key={f.id} folder={f} depth={depth + 1} index={index} team={team} />
      ))}
      {documents.map((d) => (
        <PanelDocumentItem
          key={d.id}
          document={team ? { ...d, team } : d}
          depth={depth + 1}
          draggable={personal && !!tree.onMoveDocumentToFolder}
        />
      ))}
    </SidebarRow>
  );
}
