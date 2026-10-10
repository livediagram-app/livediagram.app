'use client';

import { useMemo } from 'react';
import { TeamIcon } from '@/components/primitives/explorer-icons';
import type { TeamListItem } from '@/lib/api-client';
import { groupBy, indexFolders } from '@/lib/folder-tree';
import { useExplorer } from '../ExplorerContext';
import { useExplorerDropTarget } from '../useExplorerDropTarget';
import { trackSidebar } from './sidebar-telemetry';
import { SidebarRow } from './SidebarRow';
import { TeamFolderSubtree, type TeamFolderNode } from './TeamFolderSubtree';

// One root-level row per team (docs/specs/013-workspace/teams.md), expanding to the
// team's folder tree (docs/specs/013-workspace/team-shared-documents.md), built from the
// lazy library sweep.
export function TeamRows() {
  const { teamFolders, teams } = useExplorer();
  const teamTree = useMemo(
    () =>
      new Map(
        [...groupBy(teamFolders, (f) => f.teamId)].map(([teamId, rows]) => [
          teamId,
          indexFolders(rows).childrenByParent,
        ]),
      ),
    [teamFolders],
  );
  return teams.map((t) => (
    <TeamRow
      key={t.id}
      team={t}
      byParent={teamTree.get(t.id) ?? new Map<string | null, TeamFolderNode[]>()}
    />
  ));
}

function TeamRow({
  team: t,
  byParent,
}: {
  team: TeamListItem;
  byParent: Map<string | null, TeamFolderNode[]>;
}) {
  const { selected, go, expanded, toggleExpand } = useExplorer();
  const rootFolders = byParent.get(null) ?? [];
  // A dropped document moves to the team's root; resting on the row opens or closes it.
  const drop = useExplorerDropTarget(
    { teamId: t.id, folderId: null },
    { onLongHover: rootFolders.length > 0 ? () => toggleExpand(t.id) : undefined },
  );
  // A team folder opens the team page AT that folder: a full load, since
  // the team page reads the &folder param at mount.
  const openTeamFolder = (folderId: string) =>
    window.location.assign(
      `/explorer/team?id=${encodeURIComponent(t.id)}&folder=${encodeURIComponent(folderId)}`,
    );
  return (
    <SidebarRow
      icon={<TeamIcon />}
      label={t.name}
      textLabel={t.name}
      selected={selected.kind === 'team' && selected.id === t.id}
      onActivate={() => {
        trackSidebar('Team');
        go({ kind: 'team', id: t.id });
      }}
      depth={0}
      badge={t.memberCount > 1 ? t.memberCount : undefined}
      expandable={rootFolders.length > 0}
      expanded={expanded.has(t.id)}
      onToggleExpand={() => toggleExpand(t.id)}
      rowProps={drop.handlers}
      highlighted={drop.isDragOver}
    >
      {rootFolders.map((f) => (
        <TeamFolderSubtree
          key={f.id}
          teamId={t.id}
          folder={f}
          depth={1}
          childrenByParent={byParent}
          expanded={expanded}
          onToggleExpand={toggleExpand}
          onOpenFolder={openTeamFolder}
        />
      ))}
    </SidebarRow>
  );
}
