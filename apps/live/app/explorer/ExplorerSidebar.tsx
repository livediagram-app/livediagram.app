'use client';

import Link from 'next/link';
import { SignInIcon } from '@/components/AuthControls';
import { Tooltip } from '@/components/Tooltip';
import { clerkEnabled } from '@/lib/clerk-config';
import { useExplorer } from './ExplorerContext';
import { useMemo } from 'react';
import {
  ClockIcon,
  FolderIcon,
  ImageIcon,
  InviteIcon,
  PlusIcon,
  ShareIcon,
  TeamIcon,
} from './icons';
import {
  SearchSidebarIcon,
  SidebarFolderSubtree,
  SidebarRow,
  SidebarSectionLabel,
  TeamFolderSubtree,
  type TeamFolderNode,
} from './sidebar';

// The Explorer's section tree (spec/15), shared by the desktop
// sidebar and the mobile drawer in ExplorerShell. Every navigation
// goes through `go` (a route push) so picking a section on a phone
// also closes the drawer; search closes it too. Layout: the "Quick
// find" section (Recent diagrams, Shared with me) at the top, then
// the My Work tree, Teams (spec/32), and the Library.
export function ExplorerSidebar() {
  const {
    clerkDisplayName,
    selected,
    go,
    setSearchOpen,
    setMobileNavOpen,
    rootFolders,
    childrenByParent,
    expanded,
    toggleExpand,
    renamingFolderId,
    commitRenameFolder,
    setRenamingFolderId,
    folderActions,
    unsortedDiagrams,
    shared,
    teams,
    teamFolders,
    invites,
    teamsEnabled,
    recentCount,
    createFolder,
    setTeamModalOpen,
  } = useExplorer();

  // Per-team folder tree, indexed by parentId, for the expandable
  // team subtrees (spec/35). Built from the lazy library sweep.
  const teamTree = useMemo(() => {
    const byTeam = new Map<string, Map<string | null, TeamFolderNode[]>>();
    for (const f of teamFolders) {
      const byParent = byTeam.get(f.teamId) ?? new Map<string | null, TeamFolderNode[]>();
      const bucket = byParent.get(f.parentId) ?? [];
      bucket.push({ id: f.id, name: f.name, parentId: f.parentId });
      byParent.set(f.parentId, bucket);
      byTeam.set(f.teamId, byParent);
    }
    for (const byParent of byTeam.values())
      for (const bucket of byParent.values()) bucket.sort((a, b) => a.name.localeCompare(b.name));
    return byTeam;
  }, [teamFolders]);

  return (
    <>
      <SidebarSectionLabel first>Hi {clerkDisplayName ?? 'there'}</SidebarSectionLabel>
      <button
        type="button"
        onClick={() => {
          setSearchOpen(true);
          setMobileNavOpen(false);
        }}
        className="mt-2 flex w-full items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-2 text-left text-xs text-slate-500 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
      >
        <SearchSidebarIcon />
        <span className="flex-1 truncate">Search…</span>
      </button>
      <div className="my-4 h-px bg-slate-100" aria-hidden />
      <SidebarSectionLabel>Quick find</SidebarSectionLabel>
      <SidebarRow
        icon={<ClockIcon />}
        label="Recent diagrams"
        selected={selected.kind === 'recent'}
        onClick={() => go({ kind: 'recent' })}
        depth={0}
        badge={recentCount > 0 ? recentCount : undefined}
      />
      <SidebarRow
        icon={<ShareIcon />}
        label="Shared with you"
        selected={selected.kind === 'shared'}
        onClick={() => go({ kind: 'shared' })}
        depth={0}
        badge={shared.length > 0 ? shared.length : undefined}
      />

      {/* My Work lists the personal tree directly — Unsorted and the
          root folders, no separate "All diagrams" parent row (spec/35).
          The /explorer/all route still backs the breadcrumb. The plus
          mirrors the Teams section: add a root-level folder. */}
      <SidebarSectionLabel
        action={
          <Tooltip title="New folder" description="Add a root-level folder.">
            <button
              type="button"
              onClick={() => void createFolder(null)}
              aria-label="New folder"
              className="-my-1 flex h-5 w-5 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-brand-700"
            >
              <PlusIcon />
            </button>
          </Tooltip>
        }
      >
        My Work
      </SidebarSectionLabel>
      {/* Unsorted is a synthetic folder backed by folder_id IS NULL.
          Shown only when it actually holds loose diagrams — an empty
          Unsorted row is just noise. */}
      {unsortedDiagrams.length > 0 ? (
        <SidebarRow
          icon={<FolderIcon open={false} />}
          label="Unsorted"
          selected={selected.kind === 'unsorted'}
          onClick={() => go({ kind: 'unsorted' })}
          depth={0}
          badge={unsortedDiagrams.length}
        />
      ) : null}
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

      {/* Teams (spec/32): signed-in only. Guests see a sign-in nudge
          instead of rows; when Clerk isn't part of the deployment the
          section disappears entirely (teams can't exist without it). */}
      {clerkEnabled ? (
        <>
          {/* New-team lives as a plus on the section label (not a row
              of its own) with a desktop tooltip. */}
          <SidebarSectionLabel
            action={
              teamsEnabled ? (
                <Tooltip title="New team" description="Create a team and invite people by email.">
                  <button
                    type="button"
                    onClick={() => {
                      setTeamModalOpen(true);
                      setMobileNavOpen(false);
                    }}
                    aria-label="New team"
                    className="-my-1 flex h-5 w-5 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-brand-700"
                  >
                    <PlusIcon />
                  </button>
                </Tooltip>
              ) : undefined
            }
          >
            Teams
          </SidebarSectionLabel>
          {teamsEnabled ? (
            <>
              {teams.map((t) => {
                const byParent = teamTree.get(t.id);
                const rootFoldersOfTeam = byParent?.get(null) ?? [];
                const hasFolders = rootFoldersOfTeam.length > 0;
                const isOpen = expanded.has(t.id);
                // Team folder click opens the team page AT that folder
                // (full load: the team page reads the &folder param at
                // mount, spec/35) — same as the search panel does.
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
              {/* Badge always rendered, zero included — the user gets a
                  stable "is there anything waiting?" answer at a glance
                  rather than having to notice an absence. */}
              <SidebarRow
                icon={<InviteIcon />}
                label="Invites"
                selected={selected.kind === 'invites'}
                onClick={() => go({ kind: 'invites' })}
                depth={0}
                badge={invites.length}
              />
            </>
          ) : (
            <Link
              href="/sign-in/"
              className="flex w-full items-center gap-1.5 rounded-md py-1 pl-7 pr-1 text-left text-xs text-slate-500 transition hover:bg-slate-100 hover:text-brand-700"
            >
              <span className="shrink-0 text-slate-400">
                <SignInIcon />
              </span>
              Sign in to use teams
            </Link>
          )}
        </>
      ) : null}

      <SidebarSectionLabel>Library</SidebarSectionLabel>
      <SidebarRow
        icon={<ImageIcon />}
        label="Image gallery"
        selected={selected.kind === 'gallery'}
        onClick={() => go({ kind: 'gallery' })}
        depth={0}
      />
    </>
  );
}
