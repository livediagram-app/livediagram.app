'use client';

import { useMemo } from 'react';
import { HoverCard } from '@livediagram/ui';
import { InviteIcon, PlusIcon, TeamIcon } from '@/components/primitives/explorer-icons';
import { groupBy, indexFolders } from '@/lib/folder-tree';
import { useExplorer } from '../ExplorerContext';
import { SidebarRow, SidebarSectionLabel } from './SidebarRow';
import { TeamFolderSubtree } from './TeamFolderSubtree';

// Team Spaces (docs/specs/013-workspace/teams.md): signed-in only. Each team expands
// to its folder tree (docs/specs/013-workspace/team-shared-documents.md), then the
// Invites row. A no-auth self-host never has teams.
export function TeamSpacesSection() {
  const {
    selected,
    go,
    setMobileNavOpen,
    expanded,
    toggleExpand,
    teams,
    teamFolders,
    invites,
    teamsEnabled,
    setTeamModalOpen,
  } = useExplorer();
  // Per-team folder tree, indexed by parentId, built from the lazy library sweep.
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
  if (!teamsEnabled) return null;
  return (
    <>
      <SidebarSectionLabel
        action={
          <HoverCard title="New Team" description="Create a team and invite people by email.">
            <button
              type="button"
              onClick={() => {
                setTeamModalOpen(true);
                setMobileNavOpen(false);
              }}
              aria-label="New Team"
              className="-m-1.5 flex h-7 w-7 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-brand-700 dark:hover:bg-slate-700 dark:hover:text-brand-300"
            >
              <PlusIcon />
            </button>
          </HoverCard>
        }
      >
        Team Spaces
      </SidebarSectionLabel>
      {teams.map((t) => {
        const byParent = teamTree.get(t.id);
        const rootFoldersOfTeam = byParent?.get(null) ?? [];
        const hasFolders = rootFoldersOfTeam.length > 0;
        const isOpen = expanded.has(t.id);
        // Team folder click opens the team page AT that folder (full load:
        // the team page reads the &folder param at mount).
        const openTeamFolder = (folderId: string) =>
          window.location.assign(
            `/explorer/team?id=${encodeURIComponent(t.id)}&folder=${encodeURIComponent(folderId)}`,
          );
        return (
          <div key={t.id}>
            <SidebarRow
              icon={<TeamIcon />}
              label={t.name}
              selected={selected.kind === 'team' && selected.id === t.id}
              onClick={() => go({ kind: 'team', id: t.id })}
              depth={0}
              badge={t.memberCount > 1 ? t.memberCount : undefined}
              hasChildren={hasFolders}
              expanded={isOpen}
              onToggleExpand={hasFolders ? () => toggleExpand(t.id) : undefined}
            />
            {isOpen
              ? rootFoldersOfTeam.map((f) => (
                  <TeamFolderSubtree
                    key={f.id}
                    folder={f}
                    depth={1}
                    childrenByParent={byParent ?? new Map()}
                    expanded={expanded}
                    onToggleExpand={toggleExpand}
                    onOpenFolder={openTeamFolder}
                  />
                ))
              : null}
          </div>
        );
      })}
      {/* Badge always rendered, zero included: a stable "is there anything
          waiting?" answer at a glance. */}
      <SidebarRow
        icon={<InviteIcon />}
        label="Invites"
        selected={selected.kind === 'invites'}
        onClick={() => go({ kind: 'invites' })}
        depth={0}
        badge={invites.length}
      />
    </>
  );
}
