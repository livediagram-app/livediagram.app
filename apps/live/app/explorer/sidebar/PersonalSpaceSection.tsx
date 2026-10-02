'use client';

import { useState } from 'react';
import { HoverCard } from '@livediagram/ui';
import { PlusIcon } from '@/components/primitives/explorer-icons';
import { useExplorer } from '../ExplorerContext';
import { SYNTHETIC_FOLDERS } from '../synthetic-folders';
import { SidebarRow, SidebarSectionLabel } from './SidebarRow';
import { SidebarFolderSubtree } from './SidebarFolderSubtree';

// The Personal Space section: the Dynamic parent (Unsorted, Generated,
// Offline) and the root folders, with a plus on the label for a new
// root-level folder (docs/specs/013-workspace/folders.md).
export function PersonalSpaceSection() {
  const {
    selected,
    go,
    rootFolders,
    childrenByParent,
    expanded,
    toggleExpand,
    renamingFolderId,
    commitRenameFolder,
    setRenamingFolderId,
    folderActions,
    unsortedDocuments,
    generatedDocuments,
    offlineDocuments,
    createFolder,
  } = useExplorer();
  // The Dynamic group's expand state. Session-local and open by default so
  // Unsorted stays one click away.
  const [dynamicOpen, setDynamicOpen] = useState(true);
  return (
    <>
      <SidebarSectionLabel
        action={
          <HoverCard title="New Folder" description="Add a root-level folder.">
            <button
              type="button"
              onClick={() => void createFolder(null)}
              aria-label="New Folder"
              className="-m-1.5 flex h-7 w-7 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-brand-700 dark:hover:bg-slate-700 dark:hover:text-brand-300"
            >
              <PlusIcon />
            </button>
          </HoverCard>
        }
      >
        Personal Space
      </SidebarSectionLabel>
      <SidebarRow
        icon={<SYNTHETIC_FOLDERS.dynamic.Icon />}
        label={SYNTHETIC_FOLDERS.dynamic.label}
        selected={selected.kind === 'dynamic'}
        onClick={() => go({ kind: 'dynamic' })}
        depth={0}
        badge={
          unsortedDocuments.length + generatedDocuments.length + offlineDocuments.length ||
          undefined
        }
        hasChildren
        expanded={dynamicOpen}
        onToggleExpand={() => setDynamicOpen((v) => !v)}
      />
      {dynamicOpen
        ? (
            [
              ['unsorted', unsortedDocuments.length],
              ['generated', generatedDocuments.length],
              ['offline', offlineDocuments.length],
            ] as const
          ).map(([kind, count]) => {
            const { Icon, label } = SYNTHETIC_FOLDERS[kind];
            return (
              <SidebarRow
                key={kind}
                icon={<Icon />}
                label={label}
                selected={selected.kind === kind}
                onClick={() => go({ kind })}
                depth={1}
                badge={count || undefined}
              />
            );
          })
        : null}
      {rootFolders.map((f) => (
        <SidebarFolderSubtree
          key={f.id}
          folder={f}
          depth={0}
          expanded={expanded}
          onToggleExpand={toggleExpand}
          selected={selected}
          onSelect={(id) => go({ kind: 'folder', id })}
          childrenByParent={childrenByParent}
          renamingFolderId={renamingFolderId}
          onCommitRenameFolder={commitRenameFolder}
          onCancelRenameFolder={() => setRenamingFolderId(null)}
          folderActions={folderActions}
        />
      ))}
    </>
  );
}
