'use client';

import Link from 'next/link';
import { SignInIcon } from '@/components/chrome/AuthControls';
import { Tooltip } from '@/components/primitives/Tooltip';
import { clerkEnabled } from '@/lib/clerk-config';
import { useExplorer } from './ExplorerContext';
import { useMemo } from 'react';
import {
  ClockIcon,
  FolderIcon,
  ImageIcon,
  InviteIcon,
  KeyIcon,
  PaletteIcon,
  PlusIcon,
  ShareIcon,
  SparkleIcon,
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
    clerkUserId,
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
    generatedDiagrams,
    shared,
    teams,
    teamFolders,
    invites,
    teamsEnabled,
    tokens,
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
      {/* Signed-in greeting deep-links to the profile page (spec/65); guests
          have no profile, so theirs is plain text. */}
      <SidebarSectionLabel first>
        {clerkUserId ? (
          <Tooltip title="Profile" description="Your account, email notifications, and more.">
            <button
              type="button"
              onClick={() => go({ kind: 'profile' })}
              className={`rounded transition hover:text-brand-700 hover:underline dark:hover:text-brand-300 ${
                selected.kind === 'profile' ? 'text-brand-700 dark:text-brand-300' : ''
              }`}
            >
              Hi {clerkDisplayName ?? 'there'}
            </button>
          </Tooltip>
        ) : (
          <>Hi {clerkDisplayName ?? 'there'}</>
        )}
      </SidebarSectionLabel>
      <button
        type="button"
        onClick={() => {
          setSearchOpen(true);
          setMobileNavOpen(false);
        }}
        className="mt-2 flex w-full items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-2 text-left text-xs text-slate-500 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-brand-500/50 dark:hover:bg-brand-500/15 dark:hover:text-brand-300"
      >
        <SearchSidebarIcon />
        <span className="flex-1 truncate">Search…</span>
      </button>
      <div className="my-4 h-px bg-slate-100 dark:bg-slate-800" aria-hidden />
      <SidebarSectionLabel>Quick find</SidebarSectionLabel>
      <SidebarRow
        icon={<ClockIcon />}
        label="Recent"
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
              className="-my-1 flex h-5 w-5 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-brand-700 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-brand-300"
            >
              <PlusIcon />
            </button>
          </Tooltip>
        }
      >
        My Work
      </SidebarSectionLabel>
      {/* Unsorted is a synthetic folder backed by folder_id IS NULL.
          Always shown (even when empty) so "My Work" never looks bare
          before the user has filed anything; the badge hides at zero. */}
      <SidebarRow
        icon={<FolderIcon open={false} />}
        label="Unsorted"
        selected={selected.kind === 'unsorted'}
        onClick={() => go({ kind: 'unsorted' })}
        depth={0}
        badge={unsortedDiagrams.length || undefined}
      />
      {/* Generated is a second synthetic folder (spec/15): diagrams the AI
          assistant / MCP server created (source != null). Always shown so
          it's discoverable; badge hides at zero. */}
      <SidebarRow
        icon={<SparkleIcon />}
        label="Generated"
        selected={selected.kind === 'generated'}
        onClick={() => go({ kind: 'generated' })}
        depth={0}
        badge={generatedDiagrams.length || undefined}
      />
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

      {/* Teams (spec/32): signed-in only. Signed-out users see neither this
          nor External connections inline; they get one bottom-of-sidebar
          sign-in banner instead. A no-auth self-host never has teams. */}
      {teamsEnabled ? (
        <>
          {/* New-team lives as a plus on the section label, with a tooltip. */}
          <SidebarSectionLabel
            action={
              <Tooltip title="New team" description="Create a team and invite people by email.">
                <button
                  type="button"
                  onClick={() => {
                    setTeamModalOpen(true);
                    setMobileNavOpen(false);
                  }}
                  aria-label="New team"
                  className="-my-1 flex h-5 w-5 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-brand-700 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-brand-300"
                >
                  <PlusIcon />
                </button>
              </Tooltip>
            }
          >
            Teams
          </SidebarSectionLabel>
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
      ) : null}

      <SidebarSectionLabel>Library</SidebarSectionLabel>
      <SidebarRow
        icon={<ImageIcon />}
        label="Image gallery"
        selected={selected.kind === 'gallery'}
        onClick={() => go({ kind: 'gallery' })}
        depth={0}
      />
      <SidebarRow
        icon={<PaletteIcon />}
        label="Themes"
        selected={selected.kind === 'themes'}
        onClick={() => go({ kind: 'themes' })}
        depth={0}
      />
      {/* External connections (spec/61): API tokens, signed-in only. Hidden
          for signed-out users (they get the bottom banner below instead). */}
      {teamsEnabled ? (
        <>
          <SidebarSectionLabel>External connections</SidebarSectionLabel>
          <SidebarRow
            icon={<KeyIcon />}
            label="API tokens"
            selected={selected.kind === 'tokens'}
            onClick={() => go({ kind: 'tokens' })}
            depth={0}
            badge={tokens.count > 0 ? tokens.count : undefined}
          />
        </>
      ) : null}

      {/* One sign-in banner at the bottom, in place of per-section nudges, when
          auth is configured but the visitor is signed out. */}
      {clerkEnabled && !teamsEnabled ? (
        <Link
          href="/sign-in/"
          className="mt-5 flex items-start gap-2 rounded-lg border border-slate-200 bg-gradient-to-br from-brand-50 to-white p-3 text-left transition hover:border-brand-300 hover:from-brand-100 dark:border-slate-700 dark:from-slate-800 dark:to-slate-800/40 dark:hover:border-brand-500/50"
        >
          <span className="mt-0.5 shrink-0 text-brand-600 dark:text-brand-400">
            <SignInIcon />
          </span>
          <span>
            <span className="block text-xs font-semibold text-slate-700 dark:text-slate-100">
              Sign in to access Teams and External connections
            </span>
            <span className="mt-0.5 block text-[11px] leading-snug text-slate-500 dark:text-slate-400">
              Free, and your guest diagrams come with you.
            </span>
          </span>
        </Link>
      ) : null}
    </>
  );
}
