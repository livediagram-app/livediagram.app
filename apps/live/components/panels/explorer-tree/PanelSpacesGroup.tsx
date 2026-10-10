'use client';

import { useMemo } from 'react';
import type { DocumentListItem } from '@/lib/api-client';
import { MyDocumentsIcon, TeamIcon } from '@/components/primitives/explorer-icons';
import { groupDocumentsByFolder, indexFolders } from '@/lib/folder-tree';
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
import { openExplorerPage } from './panel-tree-model';
import { PanelDocumentItem } from './PanelDocumentItem';
import { PanelFolderItem, type PanelFolder, type PanelFolderIndex } from './PanelFolderItem';
import { usePanelTree } from './PanelTreeContext';
import { useMyDocumentsMenu } from '@/app/explorer/sidebar/useMyDocumentsMenu';

// The panel's Spaces (docs/specs/013-workspace/explorer-structure.md#the-floating-explorer-panel):
// My documents and each team, opening in place to their root folders, then their root documents.
// My documents takes a dragged document, filing it at the root. No Invites, New team or sign-in nudge: those are the Explorer's.
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
  const rootFolders = ownIndex.foldersByParent.get(null) ?? [];
  const rootDocuments = ownIndex.documentsByFolder.get(null) ?? [];
  const draggable = !!tree.onMoveDocumentToFolder;
  const expandable = rootFolders.length + rootDocuments.length > 0;
  const { onMoveDocumentToFolder } = tree;
  const drop = useDocumentDropTarget(
    onMoveDocumentToFolder ? (id) => onMoveDocumentToFolder(id, null) : undefined,
    { onLongHover: expandable ? () => tree.onToggle(MY_DOCUMENTS_EXPAND_KEY) : undefined },
  );
  const myDocumentsMenu = useMyDocumentsMenu(tree.defaultFolders?.forRoot, { reveal: true });
  return (
    <SidebarGroup id="spaces" divider={divider} first={first}>
      <SidebarRow
        icon={<MyDocumentsIcon />}
        label={SIDEBAR_LABELS.myDocuments}
        textLabel={SIDEBAR_LABELS.myDocuments}
        selected={false}
        onActivate={() => {
          trackSidebar('MyDocuments', 'panel');
          // Nothing in it yet: its Explorer page, as an empty team does.
          if (expandable) tree.onToggle(MY_DOCUMENTS_EXPAND_KEY);
          else openExplorerPage({ kind: 'all' });
        }}
        depth={0}
        expandable={expandable}
        expanded={tree.expanded[MY_DOCUMENTS_EXPAND_KEY] ?? false}
        onToggleExpand={() => tree.onToggle(MY_DOCUMENTS_EXPAND_KEY)}
        rowProps={onMoveDocumentToFolder ? drop.handlers : undefined}
        highlighted={drop.isDragOver}
        onContextMenu={myDocumentsMenu.onContextMenu}
        trailing={myDocumentsMenu.trailing}
      >
        {rootFolders.map((f) => (
          <PanelFolderItem key={f.id} folder={f} depth={1} index={ownIndex} />
        ))}
        {rootDocuments.map((d) => (
          <PanelDocumentItem key={d.id} document={d} depth={1} draggable={draggable} />
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
