'use client';

import { useEffect, useState } from 'react';
import { EllipsisTriggerButton } from '@/components/primitives/EllipsisTriggerButton';
import { FolderSolidIcon } from '@/components/primitives/explorer-icons';
import { InlineRenameInput } from '@/components/primitives/InlineRenameInput';
import { useRowMenu } from '@/components/primitives/useRowMenu';
import { FolderActionsMenu } from '@/app/explorer/folder-actions-menu';
import { FolderPreview, PaneCard } from '../explorer-panel/pane-parts';
import { trackSidebar } from '@/app/explorer/sidebar/sidebar-telemetry';
import type { PaneProject } from '@/app/explorer/views';
import { useProjectDropTarget } from '../useProjectDropTarget';
import { usePanelTree } from './PanelTreeContext';
import { useDefaultFolderDescription } from '@/components/placement/DefaultFolderMarker';
import { FolderLabel } from '@/app/explorer/sidebar/SidebarFolderSubtree';
import { explorerPathFor, teamFolderPath } from '@/app/explorer/routes';
import { assignAppLocation } from '@/lib/app-location';

// A folder as the panel's tree needs it; `teamId` set on a team folder.
export type PanelFolder = {
  id: string;
  name: string;
  parentId: string | null;
  teamId?: string | null;
};

// One folder's subtree and its projects, indexed by parent (null = the space's root).
export type PanelFolderIndex = {
  foldersByParent: Map<string | null, PanelFolder[]>;
  projectsByFolder: Map<string | null, PaneProject[]>;
};

// A folder row of the editor's Explorer pane, personal or team (docs/specs/013-workspace/explorer-structure.md "The
// pane"): activating it opens it in the pane (its subfolders, then its projects, under a breadcrumb). It carries the
// folder menu plus Show in Explorer; a personal folder takes a dragged project, opening on a resting drag; a folder
// just created opens renaming.
export function PanelFolderItem({
  folder,
  index,
  team,
}: {
  folder: PanelFolder;
  index: PanelFolderIndex;
  team?: { id: string; name: string };
}) {
  const tree = usePanelTree();
  const subfolders = index.foldersByParent.get(folder.id) ?? [];
  const projects = index.projectsByFolder.get(folder.id) ?? [];
  const open = () => {
    trackSidebar(personal ? 'Folder' : 'TeamFolder', 'panel');
    tree.onOpenFolder?.(folder.id);
  };
  const [editing, setEditing] = useState(false);
  const menu = useRowMenu({ disabled: editing });
  const markerWords = useDefaultFolderDescription(folder.id);
  const personal = !team;
  const fileHere = personal ? tree.onMoveProjectToFolder : undefined;
  const drop = useProjectDropTarget(fileHere ? (id) => fileHere(id, folder.id) : undefined, {
    onLongHover: () => tree.onOpenFolder?.(folder.id),
  });

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

  const count = [
    subfolders.length
      ? `${subfolders.length} ${subfolders.length === 1 ? 'folder' : 'folders'}`
      : '',
    `${projects.length} ${projects.length === 1 ? 'project' : 'projects'}`,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <PaneCard
      preview={<FolderPreview icon={<FolderSolidIcon />} count={count} />}
      title={
        editing ? (
          <InlineRenameInput
            initial={folder.name}
            ariaLabel={`Rename ${folder.name}`}
            onCommit={commitRename}
            onCancel={() => setEditing(false)}
            className="w-full rounded border border-brand-300 bg-white px-1.5 py-0.5 text-[13px] dark:border-brand-500/50 dark:bg-slate-900 dark:text-slate-100"
          />
        ) : (
          <FolderLabel folderId={folder.id} name={folder.name} />
        )
      }
      label={folder.name}
      meta={markerWords || undefined}
      onActivate={editing ? undefined : open}
      rowProps={{ onContextMenu: menu.onContextMenu, ...(fileHere ? drop.handlers : {}) }}
      highlighted={drop.isDragOver}
      trailing={
        editing ? null : (
          <>
            <EllipsisTriggerButton
              {...menu.triggerProps}
              size="md"
              reveal
              label={`Menu for ${folder.name}`}
            />
            {menu.open ? (
              <FolderActionsMenu
                folder={folder}
                anchor={menu.triggerRef.current}
                onClose={menu.close}
                onShowInExplorer={() =>
                  assignAppLocation(
                    team
                      ? teamFolderPath(team.id, folder.id)
                      : explorerPathFor({ kind: 'folder', id: folder.id }),
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
    />
  );
}
