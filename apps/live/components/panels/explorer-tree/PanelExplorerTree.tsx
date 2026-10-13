'use client';

import { useMemo, useState } from 'react';
import { useDefaultFolderMenus } from '@/hooks/persistence/useDefaultFolderMenus';
import type { DocumentListItem, SharedWithItem } from '@/lib/api-client';
import { sharedToPaneDocument, type PaneDocument, type SelectedNode } from '@/app/explorer/views';
import { EmptyPane } from '@/app/explorer/ExplorerEmptyState';
import { groupDocumentsByFolder, indexFolders } from '@/lib/folder-tree';
import type { PanelSection } from '../explorer-panel/panel-sections';
import { PaneList, PaneSkeleton } from '../explorer-panel/pane-parts';
import { PanelFolderItem, type PanelFolder, type PanelFolderIndex } from './PanelFolderItem';
import { PanelDocumentItem } from './PanelDocumentItem';
import { PanelTreeProvider, type PanelTree } from './PanelTreeContext';

export type PanelTreeSection = Extract<
  PanelSection,
  { kind: 'mine' } | { kind: 'team' } | { kind: 'browser' } | { kind: 'shared' }
>;

export const isTreeSection = (s: PanelSection): s is PanelTreeSection =>
  s.kind === 'mine' || s.kind === 'team' || s.kind === 'browser' || s.kind === 'shared';

const NO_FOLDERS: PanelFolder[] = [];
const NO_DOCUMENTS: DocumentListItem[] = [];

// The rows of one of the editor's Explorer sections that hold documents (docs/specs/013-workspace/explorer-structure.md
// "The pane"): My documents' and a team's folders then documents, opening a folder in place under a breadcrumb back
// to the space's root; This browser's documents; what is shared with the reader. Each empty place says so in the
// Explorer's own empty state.
export function PanelExplorerTree({
  section,
  rootLabel,
  tree,
  busy = false,
  shared,
  ownIndex,
  offlineDocuments,
  teams,
  foldersByTeam,
  documentsByTeam,
}: {
  section: PanelTreeSection;
  // The space's name, the breadcrumb's first step.
  rootLabel: string;
  tree: PanelTree;
  // The document lists are still loading.
  busy?: boolean;
  shared: SharedWithItem[];
  // The reader's own tree, this browser's documents excluded.
  ownIndex: PanelFolderIndex;
  offlineDocuments: DocumentListItem[];
  teams: { id: string; name: string }[];
  foldersByTeam: Map<string, PanelFolder[]>;
  documentsByTeam: Map<string, DocumentListItem[]>;
}) {
  // The reader's default folders (docs/specs/013-workspace/default-folders.md): the folder menus check and set them.
  const defaultFolders = useDefaultFolderMenus(
    tree.ownerId,
    useMemo(
      () => ({
        personal: [...ownIndex.foldersByParent.values()].flat(),
        team: Object.fromEntries(foldersByTeam),
        teams,
      }),
      [ownIndex, foldersByTeam, teams],
    ),
  );
  const team = section.kind === 'team' ? teams.find((t) => t.id === section.id) : undefined;
  const teamFolders = (team && foldersByTeam.get(team.id)) || NO_FOLDERS;
  const teamDocuments = (team && documentsByTeam.get(team.id)) || NO_DOCUMENTS;
  const teamIndex = useMemo<PanelFolderIndex>(
    () => ({
      foldersByParent: indexFolders(teamFolders).childrenByParent,
      documentsByFolder: groupDocumentsByFolder(teamDocuments),
    }),
    [teamFolders, teamDocuments],
  );
  // The folder open in the pane, null at the space's root. The host keys this component by section, so a new
  // section starts at its root.
  const [folderId, setFolderId] = useState<string | null>(null);
  const draggable = !!tree.onMoveDocumentToFolder;

  const value = { ...tree, defaultFolders, onOpenFolder: setFolderId };
  let body: React.ReactNode;
  if (section.kind === 'browser' || section.kind === 'shared') {
    const docs: PaneDocument[] =
      section.kind === 'browser' ? offlineDocuments : shared.map(sharedToPaneDocument);
    body = docs.length ? (
      <PaneList label={rootLabel}>
        {docs.map((d) => (
          <PanelDocumentItem key={d.id} document={d} />
        ))}
      </PaneList>
    ) : (
      <EmptyPane compact selected={{ kind: section.kind === 'browser' ? 'offline' : 'shared' }} />
    );
  } else {
    const index = section.kind === 'team' ? teamIndex : ownIndex;
    const byId = new Map([...index.foldersByParent.values()].flat().map((f) => [f.id, f]));
    // A folder deleted (or moved away) while open: back to the root.
    const here = folderId && byId.has(folderId) ? folderId : null;
    const trail: PanelFolder[] = [];
    for (
      let f = here ? byId.get(here) : undefined;
      f;
      f = f.parentId ? byId.get(f.parentId) : undefined
    )
      trail.unshift(f);
    const folders = index.foldersByParent.get(here) ?? [];
    const docs = index.documentsByFolder.get(here) ?? [];
    const empty: SelectedNode = here ? { kind: 'folder', id: here } : { kind: 'all' };
    body = (
      <div className="flex flex-col gap-2">
        {trail.length ? (
          <nav
            aria-label="Folder path"
            className="flex min-w-0 flex-wrap items-center gap-1 px-2 text-xs"
          >
            {[{ id: null as string | null, name: rootLabel }, ...trail].map((step, i, all) => {
              const last = i === all.length - 1;
              return (
                <span key={step.id ?? 'root'} className="flex min-w-0 items-center gap-1">
                  {last ? (
                    <span
                      aria-current="location"
                      className="truncate font-semibold text-slate-800 dark:text-slate-100"
                    >
                      {step.name}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setFolderId(step.id)}
                      className="cursor-pointer truncate rounded text-slate-500 transition hover:text-slate-900 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-slate-400 dark:hover:text-white"
                    >
                      {step.name}
                    </button>
                  )}
                  {last ? null : (
                    <span aria-hidden className="text-slate-300 dark:text-slate-600">
                      ›
                    </span>
                  )}
                </span>
              );
            })}
          </nav>
        ) : null}
        {folders.length + docs.length ? (
          <PaneList label={trail.at(-1)?.name ?? rootLabel}>
            {folders.map((f) => (
              <PanelFolderItem key={f.id} folder={f} index={index} team={team} />
            ))}
            {docs.map((d) => (
              <PanelDocumentItem
                key={d.id}
                document={team ? { ...d, team } : d}
                draggable={!team && draggable}
              />
            ))}
          </PaneList>
        ) : (
          <EmptyPane compact cta={false} selected={empty} />
        )}
      </div>
    );
  }
  return (
    <PanelTreeProvider value={value}>
      {busy && section.kind !== 'shared' ? <PaneSkeleton /> : body}
    </PanelTreeProvider>
  );
}
