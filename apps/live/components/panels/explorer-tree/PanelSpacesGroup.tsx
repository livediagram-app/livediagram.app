'use client';

import { useMemo } from 'react';
import type { DocumentListItem } from '@/lib/api-client';
import { MyDocumentsIcon, TeamIcon } from '@/components/primitives/explorer-icons';
import { groupDocumentsByFolder, indexFolders } from '@/lib/folder-tree';
import { SYNTHETIC_FOLDERS } from '@/app/explorer/synthetic-folders';
import {
  MY_DOCUMENTS_EXPAND_KEY,
  SIDEBAR_LABELS,
  type SidebarDivider,
  type SidebarRowKind,
} from '@/app/explorer/sidebar/sidebar-structure';
import { trackSidebar } from '@/app/explorer/sidebar/sidebar-telemetry';
import { SidebarGroup } from '@/app/explorer/sidebar/SidebarGroup';
import { SidebarRow } from '@/app/explorer/sidebar/SidebarRow';
import { useDocumentDropTarget } from '../useDocumentDropTarget';
import { openExplorerPage, splitRootDocuments } from './panel-tree-model';
import { PanelDocumentItem } from './PanelDocumentItem';
import { PanelFolderItem, type PanelFolder, type PanelFolderIndex } from './PanelFolderItem';
import { usePanelTree } from './PanelTreeContext';

// The panel's Spaces (docs/specs/013-workspace/explorer-structure.md#the-floating-explorer-panel):
// My documents (Unsorted, Generated, then its folders) and each team, opening in place to their
// folders and documents. No Invites, New team or sign-in nudge: those are the Explorer's.
export function PanelSpacesGroup({
  rows,
  divider,
  first,
  ownIndex,
  teams,
  foldersByTeam,
  documentsByTeam,
}: {
  rows: SidebarRowKind[];
  divider: SidebarDivider;
  first: boolean;
  // The reader's own tree, this browser's documents excluded.
  ownIndex: PanelFolderIndex;
  teams: { id: string; name: string }[];
  foldersByTeam: Map<string, PanelFolder[]>;
  documentsByTeam: Map<string, DocumentListItem[]>;
}) {
  const tree = usePanelTree();
  const { unsorted, generated } = splitRootDocuments(ownIndex.documentsByFolder.get(null) ?? []);
  const draggable = !!tree.onMoveDocumentToFolder;
  return (
    <SidebarGroup id="spaces" divider={divider} first={first}>
      <SidebarRow
        icon={<MyDocumentsIcon />}
        label={SIDEBAR_LABELS.myDocuments}
        textLabel={SIDEBAR_LABELS.myDocuments}
        selected={false}
        onActivate={() => {
          trackSidebar('MyDocuments', 'panel');
          tree.onToggle(MY_DOCUMENTS_EXPAND_KEY);
        }}
        depth={0}
        expandable
        expanded={tree.expanded[MY_DOCUMENTS_EXPAND_KEY] ?? false}
        onToggleExpand={() => tree.onToggle(MY_DOCUMENTS_EXPAND_KEY)}
      >
        <BucketItem kind="unsorted" documents={unsorted} dropTarget draggable={draggable} />
        <BucketItem kind="generated" documents={generated} draggable={draggable} />
        {(ownIndex.foldersByParent.get(null) ?? []).map((f) => (
          <PanelFolderItem key={f.id} folder={f} depth={1} index={ownIndex} />
        ))}
      </SidebarRow>
      {rows.includes('teams')
        ? teams.map((t) => (
            <PanelTeamItem
              key={t.id}
              team={t}
              folders={foldersByTeam.get(t.id) ?? []}
              documents={documentsByTeam.get(t.id) ?? []}
            />
          ))
        : null}
    </SidebarGroup>
  );
}

// Unsorted or Generated under My documents: opens in place to its documents. Unsorted takes a
// dragged document (filed back to no folder).
function BucketItem({
  kind,
  documents,
  dropTarget = false,
  draggable,
}: {
  kind: 'unsorted' | 'generated';
  documents: DocumentListItem[];
  dropTarget?: boolean;
  draggable: boolean;
}) {
  const tree = usePanelTree();
  const { Icon, label } = SYNTHETIC_FOLDERS[kind];
  const drop = useDocumentDropTarget(null, dropTarget ? tree.onMoveDocumentToFolder : undefined);
  const key = `space:${kind}`;
  return (
    <SidebarRow
      icon={<Icon />}
      label={label}
      textLabel={label}
      selected={false}
      onActivate={() => {
        trackSidebar(kind === 'unsorted' ? 'Unsorted' : 'Generated', 'panel');
        if (documents.length > 0) tree.onToggle(key);
      }}
      depth={1}
      badge={documents.length || undefined}
      expandable={documents.length > 0}
      expanded={tree.expanded[key] ?? false}
      onToggleExpand={() => tree.onToggle(key)}
      rowProps={
        dropTarget && tree.onMoveDocumentToFolder
          ? { onDragOver: drop.onDragOver, onDragLeave: drop.onDragLeave, onDrop: drop.onDrop }
          : undefined
      }
      highlighted={drop.isDragOver}
    >
      {documents.map((d) => (
        <PanelDocumentItem key={d.id} document={d} depth={2} draggable={draggable} />
      ))}
    </SidebarRow>
  );
}

// A team as a root folder: opens in place to its folders, then the documents at its root. A
// team with nothing in it goes to its Explorer page.
function PanelTeamItem({
  team,
  folders,
  documents,
}: {
  team: { id: string; name: string };
  folders: PanelFolder[];
  documents: DocumentListItem[];
}) {
  const tree = usePanelTree();
  const index = useMemo<PanelFolderIndex>(
    () => ({
      foldersByParent: indexFolders(folders).childrenByParent,
      documentsByFolder: groupDocumentsByFolder(documents),
    }),
    [folders, documents],
  );
  const rootFolders = index.foldersByParent.get(null) ?? [];
  const rootDocuments = index.documentsByFolder.get(null) ?? [];
  const expandable = rootFolders.length + rootDocuments.length > 0;
  return (
    <SidebarRow
      icon={<TeamIcon />}
      label={team.name}
      textLabel={team.name}
      selected={false}
      onActivate={() => {
        trackSidebar('Team', 'panel');
        if (expandable) tree.onToggle(team.id);
        else openExplorerPage({ kind: 'team', id: team.id });
      }}
      depth={0}
      expandable={expandable}
      expanded={tree.expanded[team.id] ?? false}
      onToggleExpand={() => tree.onToggle(team.id)}
    >
      {rootFolders.map((f) => (
        <PanelFolderItem key={f.id} folder={f} depth={1} index={index} team={team} />
      ))}
      {rootDocuments.map((d) => (
        <PanelDocumentItem key={d.id} document={{ ...d, team }} depth={1} />
      ))}
    </SidebarRow>
  );
}
