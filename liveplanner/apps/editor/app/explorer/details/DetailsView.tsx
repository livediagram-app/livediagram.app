'use client';

import { useMemo } from 'react';
import { projectEntryPropsFor, type ExplorerViewProps } from '@/app/explorer/explorer-view-props';
import { LIST_CARD } from '@/components/primitives/surface-classes';
import { sortDetailsEntries } from './details-columns';
import { DetailsProjectRow } from './DetailsProjectRow';
import { DetailsFolderRow } from './DetailsFolderRow';
import { DetailsHeader } from './DetailsHeader';
import { useDetailsSort } from './useDetailsSort';

// The Explorer's Details view (docs/specs/013-workspace/explorer-details-view.md): the same folders
// and projects the list and cards show, as one flat table sorted by any column, folders first.
// Takes the same props as ListView and CardView, so ExplorerPane swaps the three on the toggle.
export function DetailsView(props: ExplorerViewProps) {
  const {
    folders,
    projects,
    onOpenFolder,
    onCommitRenameFolder,
    onCancelRenameFolder,
    renamingFolderId,
    folderActions,
    childrenCount,
    projectsCount,
  } = props;
  const [sort, sortBy] = useDetailsSort();
  const sorted = useMemo(
    () =>
      sortDetailsEntries({
        folders,
        projects,
        sort,
        itemCount: (id) => childrenCount(id) + projectsCount(id),
      }),
    [folders, projects, sort, childrenCount, projectsCount],
  );
  return (
    <div className={`${LIST_CARD} overflow-x-auto`}>
      <table className="w-full table-fixed border-collapse" aria-label="Folders and plans">
        <DetailsHeader sort={sort} onSort={sortBy} />
        <tbody className="lvd-cascade divide-y divide-slate-100 dark:divide-slate-700/60">
          {sorted.folders.map((f) => (
            <DetailsFolderRow
              key={f.id}
              folder={f}
              itemCount={childrenCount(f.id) + projectsCount(f.id)}
              renaming={renamingFolderId === f.id}
              onOpen={() => onOpenFolder(f.id)}
              onCommitRename={(name) => onCommitRenameFolder(f.id, name)}
              onCancelRename={onCancelRenameFolder}
              getActions={(anchor) => folderActions(f, anchor)}
            />
          ))}
          {sorted.projects.map((d) => (
            <DetailsProjectRow key={d.id} {...projectEntryPropsFor(props, d)} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
