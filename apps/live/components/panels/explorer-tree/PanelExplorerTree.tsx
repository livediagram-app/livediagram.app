'use client';

import { useMemo, useRef } from 'react';
import { useDefaultFolderMenus } from '@/hooks/persistence/useDefaultFolderMenus';
import type { DocumentListItem, SharedWithItem } from '@/lib/api-client';
import { useTreeNavigation } from '@/app/explorer/sidebar/useTreeNavigation';
import { sharedToPaneDocument } from '@/app/explorer/views';
import { groupDocumentsByFolder, indexFolders } from '@/lib/folder-tree';
import type { PanelSection } from '../explorer-panel/panel-sections';
import { PanelFolderItem, type PanelFolder, type PanelFolderIndex } from './PanelFolderItem';
import { PanelDocumentItem } from './PanelDocumentItem';
import { PanelTreeProvider, type PanelTree } from './PanelTreeContext';

export type PanelTreeSection = Extract<
  PanelSection,
  { kind: 'mine' } | { kind: 'team' } | { kind: 'browser' } | { kind: 'shared' }
>;

export const isTreeSection = (s: PanelSection): s is PanelTreeSection =>
  s.kind === 'mine' || s.kind === 'team' || s.kind === 'browser' || s.kind === 'shared';

// The rows of one of the editor's Explorer sections that hold documents (docs/specs/013-workspace/explorer-structure.md
// "The pane"): My documents' and a team's root folders then root documents, This browser's documents, or what is shared
// with the reader. The sidebar's rows and keyboard model; folders open in place.
export function PanelExplorerTree({
  section,
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
  // The reader's default folders (docs/specs/013-workspace/default-folders.md): the panel's folder
  // menus check and set them; its rows show the marker.
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
  const navRef = useRef<HTMLElement>(null);
  const keyboard = useTreeNavigation(navRef);
  const team = section.kind === 'team' ? teams.find((t) => t.id === section.id) : undefined;
  const draggable = !!tree.onMoveDocumentToFolder;
  const rows =
    section.kind === 'mine'
      ? [
          ...(ownIndex.foldersByParent.get(null) ?? []).map((f) => (
            <PanelFolderItem key={f.id} folder={f} depth={0} index={ownIndex} />
          )),
          ...(ownIndex.documentsByFolder.get(null) ?? []).map((d) => (
            <PanelDocumentItem key={d.id} document={d} depth={0} draggable={draggable} />
          )),
        ]
      : section.kind === 'browser'
        ? offlineDocuments.map((d) => <PanelDocumentItem key={d.id} document={d} depth={0} />)
        : section.kind === 'shared'
          ? shared.map((s) => (
              <PanelDocumentItem key={s.id} document={sharedToPaneDocument(s)} depth={0} />
            ))
          : [];
  const teamRows = team ? (
    <TeamRows
      team={team}
      folders={foldersByTeam.get(team.id) ?? NO_FOLDERS}
      documents={documentsByTeam.get(team.id) ?? NO_DOCUMENTS}
    />
  ) : null;
  const empty = team
    ? !(foldersByTeam.get(team.id)?.length || documentsByTeam.get(team.id)?.length)
    : rows.length === 0;
  return (
    <PanelTreeProvider value={{ ...tree, defaultFolders }}>
      <nav ref={navRef} aria-label="Explorer" aria-busy={busy || undefined} {...keyboard}>
        {!empty ? (
          <ul role="tree" aria-label={team?.name ?? undefined}>
            {teamRows ?? rows}
          </ul>
        ) : busy ? null : (
          <p className="px-2 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
            {EMPTY_LINES[section.kind]}
          </p>
        )}
      </nav>
    </PanelTreeProvider>
  );
}

const EMPTY_LINES: Record<PanelTreeSection['kind'], string> = {
  mine: 'No documents here yet',
  team: 'Nothing in this team yet',
  browser: 'No documents in this browser',
  shared: 'Nothing shared with you yet',
};

const NO_FOLDERS: PanelFolder[] = [];
const NO_DOCUMENTS: DocumentListItem[] = [];

// A team's root folders, then its root documents, indexed from its swept library.
function TeamRows({
  team,
  folders,
  documents,
}: {
  team: { id: string; name: string };
  folders: PanelFolder[];
  documents: DocumentListItem[];
}) {
  const index = useMemo<PanelFolderIndex>(
    () => ({
      foldersByParent: indexFolders(folders).childrenByParent,
      documentsByFolder: groupDocumentsByFolder(documents),
    }),
    [folders, documents],
  );
  return (
    <>
      {(index.foldersByParent.get(null) ?? []).map((f) => (
        <PanelFolderItem key={f.id} folder={f} depth={0} index={index} team={team} />
      ))}
      {(index.documentsByFolder.get(null) ?? []).map((d) => (
        <PanelDocumentItem key={d.id} document={{ ...d, team }} depth={0} />
      ))}
    </>
  );
}
