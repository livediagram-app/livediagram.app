'use client';

// The panel's Teams accordion (spec/35): a team expands to its folder tree
// and the diagrams inside each folder, which open in place (any joined
// member may open them). The folders are the personal tree's FolderNode,
// handed this team's rows; a team node adds only the team header and the
// team-root diagrams (its synthetic Unsorted bucket).

import { useMemo } from 'react';
import type { DiagramListItem } from '@/lib/api-client';
import { TeamIcon } from '@/components/primitives/explorer-icons';
import { groupDiagramsByFolder, indexFolders } from '@/lib/folder-tree';
import { FolderNode, type PanelFolder, type PanelFolderTree } from './FolderNode';
import { PanelDiagramRows, type PanelRowActions } from './PanelDiagramRows';
import { TreeNodeHeader } from './TreeNodeHeader';

export function TeamNode({
  team,
  folders,
  diagrams,
  expanded,
  onToggleExpanded,
  onOpenTeam,
  rows,
  pendingRenameId,
  onRenameFolderCommitted,
  onRenameFolder,
  onDeleteFolder,
  onCreateChild,
}: {
  team: { id: string; name: string };
  // This team's folder rows (flat, with parentId and teamId).
  folders: PanelFolder[];
  // This team's diagrams (carry folderId; null = the team's Unsorted).
  diagrams: DiagramListItem[];
  expanded: Record<string, boolean>;
  onToggleExpanded: (id: string) => void;
  // The team NAME opens the full team page when there is nothing to
  // expand; otherwise folders + diagrams browse inline (spec/35).
  onOpenTeam: (teamId: string) => void;
  // The rows' verbs. Delete is open to every joined member (spec/35): a
  // team diagram is managed by the whole team, and a diagram shown here
  // means the viewer is a member, so the only gate is a wired handler.
  // Change Folder opens the panel's picker inside this team, so the pick
  // routes through the scope-aware move. No drag-and-drop here.
  rows: PanelRowActions;
  // Team-library folder management, threaded to every folder node.
  pendingRenameId?: string | null;
  onRenameFolderCommitted?: () => void;
  onRenameFolder?: (id: string, name: string) => void;
  onDeleteFolder?: (id: string) => void;
  onCreateChild?: (parentId: string | null) => void;
}) {
  const foldersByParent = useMemo(() => indexFolders(folders).childrenByParent, [folders]);
  const diagramsByFolder = useMemo(() => groupDiagramsByFolder(diagrams), [diagrams]);
  const tree: PanelFolderTree = {
    foldersByParent,
    diagramsByFolder,
    expanded,
    onToggleExpanded,
    pendingRenameId,
    onRenameFolderCommitted,
    onRenameFolder,
    onDeleteFolder,
    onCreateChild,
    rows,
  };
  const rootFolders = foldersByParent.get(null) ?? [];
  // Diagrams loose at the team root (its synthetic Unsorted bucket).
  const rootDiagrams = diagramsByFolder.get(null) ?? [];
  const hasContent = rootFolders.length > 0 || rootDiagrams.length > 0;
  const isExpanded = expanded[team.id] ?? false;
  return (
    <li>
      <TreeNodeHeader
        expanded={isExpanded}
        onToggle={() => onToggleExpanded(team.id)}
        noun="team"
        collapsible={hasContent}
        icon={<TeamIcon />}
        label={team.name}
        // Clicking the team name expands it inline (like a folder), rather
        // than navigating to the team page. An empty team has nothing to
        // expand, so it falls back to opening the page (so you can still
        // reach it to add a first diagram).
        onLabelClick={() => (hasContent ? onToggleExpanded(team.id) : onOpenTeam(team.id))}
      />
      {isExpanded && hasContent ? (
        <ul className="flex flex-col gap-0.5">
          {rootFolders.map((f) => (
            <FolderNode key={f.id} folder={f} depth={1} tree={tree} />
          ))}
          <PanelDiagramRows diagrams={rootDiagrams} indent={4 + 1 * 12} rows={rows} />
        </ul>
      ) : null}
    </li>
  );
}
