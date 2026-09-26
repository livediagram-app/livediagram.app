'use client';

import {
  ActivityIcon,
  ClockIcon,
  ImageIcon,
  InviteIcon,
  KeyIcon,
  PaletteIcon,
  PlusIcon,
  ShareIcon,
  StarIcon,
  TeamIcon,
  TimelineIcon,
} from '@/components/primitives/explorer-icons';
import Link from 'next/link';
import { SignInIcon } from '@/components/chrome/AuthControls';
import { Tooltip } from '@/components/primitives/Tooltip';
import { useAuthHrefs } from '@/components/chrome/auth-shared';
import { clerkEnabled } from '@/lib/clerk-config';
import { useExplorer } from './ExplorerContext';
import { useMemo, useState } from 'react';
import { groupBy, indexFolders } from '@/lib/folder-tree';
import { SYNTHETIC_FOLDERS } from './synthetic-folders';
import {
  SearchSidebarIcon,
  SidebarFolderSubtree,
  SidebarRow,
  SidebarSectionLabel,
  TeamFolderSubtree,
} from './sidebar';

// The Explorer's section tree (docs/specs/013-workspace/folders.md), shared by the desktop
// sidebar and the mobile drawer in ExplorerShell. Every navigation
// goes through `go` (a route push) so picking a section on a phone
// also closes the drawer; search closes it too. Layout: the "Quick
// find" section (Timeline, Recent, Favourites, Shared with you) at the
// top, then the Personal Space tree, Teams (docs/specs/013-workspace/teams.md), and the Library.
export function ExplorerSidebar() {
  const {
    clerkDisplayName,
    clerkUserId,
    selected,
    go,
    setSearchOpen,
    setSettingsOpen,
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
    favouriteIds,
    diagrams,
    teamDiagrams,
    generatedDiagrams,
    offlineDiagrams,
    shared,
    teams,
    teamFolders,
    invites,
    teamsEnabled,
    tokens,
    recentCount,
    timelineUnread,
    activity,
    createFolder,
    setTeamModalOpen,
  } = useExplorer();
  const { signInHref } = useAuthHrefs();
  // The Dynamic group's expand state. Session-local and open by default so
  // Unsorted stays one click away; collapsing it is a per-visit tidy-up.
  const [dynamicOpen, setDynamicOpen] = useState(true);
  // Only count stars pointing at diagrams still in view: the FK cascade
  // drops rows for deleted diagrams, but a star on a team diagram you've
  // since left would linger server-side until touched.
  const favouriteCount = [...diagrams, ...teamDiagrams].filter((d) =>
    favouriteIds.has(d.id),
  ).length;

  // Per-team folder tree, indexed by parentId, for the expandable
  // team subtrees (docs/specs/013-workspace/team-shared-diagrams.md). Built from the lazy library sweep.
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

  return (
    <>
      {/* Signed-in greeting deep-links to the profile page (docs/specs/014-identity/profile-and-email-notifications.md); guests
          have no profile, so theirs is plain text. */}
      <SidebarSectionLabel first>
        {clerkUserId ? (
          <Tooltip
            title="Account"
            description="Your account, email notifications, and everything else, in Settings."
          >
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="rounded transition hover:text-brand-700 hover:underline dark:hover:text-brand-300"
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
      {/* The landing view (docs/specs/013-workspace/timeline.md §8.1), so it leads the tree. The
          badge counts OTHER people's events since the reader last
          opened it — their own work going up a counter would be noise.
          Cleared on navigation rather than after the fetch, so the
          number doesn't linger while the feed loads. */}
      <SidebarRow
        icon={<TimelineIcon />}
        label="Timeline"
        selected={selected.kind === 'timeline'}
        onClick={() => {
          timelineUnread.clear();
          go({ kind: 'timeline' });
        }}
        depth={0}
        badge={timelineUnread.count > 0 ? timelineUnread.count : undefined}
      />
      {/* What's outstanding for the reader (docs/specs/013-workspace/activity-page.md). The badge counts
          only the open actions ASSIGNED TO them — work waiting on them,
          not work they handed out — and hides at zero. */}
      <SidebarRow
        icon={<ActivityIcon />}
        label="Activity"
        selected={selected.kind === 'activity'}
        onClick={() => go({ kind: 'activity' })}
        depth={0}
        badge={activity.assignedToMe.length > 0 ? activity.assignedToMe.length : undefined}
      />
      <SidebarRow
        icon={<ClockIcon />}
        label="Recent"
        selected={selected.kind === 'recent'}
        onClick={() => go({ kind: 'recent' })}
        depth={0}
        badge={recentCount > 0 ? recentCount : undefined}
      />
      {/* Favourites lives in Quick find rather than under Personal Space >
          Dynamic (docs/specs/013-workspace/timeline.md §8.2): it's the user's own curated shortlist,
          not a synthetic view of where a diagram happens to sit, so it
          belongs beside Recent rather than a level down among Unsorted /
          Generated / Offline. */}
      <SidebarRow
        icon={<StarIcon />}
        label="Favourites"
        selected={selected.kind === 'favourites'}
        onClick={() => go({ kind: 'favourites' })}
        depth={0}
        badge={favouriteCount || undefined}
      />
      <SidebarRow
        icon={<ShareIcon />}
        label="Shared with You"
        selected={selected.kind === 'shared'}
        onClick={() => go({ kind: 'shared' })}
        depth={0}
        badge={shared.length > 0 ? shared.length : undefined}
      />

      {/* Personal Space lists the personal tree directly — Unsorted and the
          root folders, no separate "All diagrams" parent row (docs/specs/013-workspace/team-shared-diagrams.md).
          The /explorer/all route still backs the breadcrumb. The plus
          mirrors the Teams section: add a root-level folder. */}
      <SidebarSectionLabel
        action={
          <Tooltip title="New Folder" description="Add a root-level folder.">
            <button
              type="button"
              onClick={() => void createFolder(null)}
              aria-label="New Folder"
              className="-m-1.5 flex h-7 w-7 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-brand-700 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-brand-300"
            >
              <PlusIcon />
            </button>
          </Tooltip>
        }
      >
        Personal Space
      </SidebarSectionLabel>
      {/* The synthetic ("dynamic") folders live under one collapsible
          Dynamic parent so Personal Space leads with the user's own folders:
          Unsorted (folder_id IS NULL), Generated (AI-made, docs/specs/013-workspace/folders.md), and
          Offline (browser-only, docs/specs/006-diagram/offline-mode.md). All are live views, always
          present even when empty; badges hide at zero. Clicking the
          parent opens the /explorer/dynamic overview. Favourites used to
          sit here too and has moved up to Quick find (docs/specs/013-workspace/timeline.md §8.2), so
          the parent's badge no longer counts it. */}
      <SidebarRow
        icon={<SYNTHETIC_FOLDERS.dynamic.Icon />}
        label={SYNTHETIC_FOLDERS.dynamic.label}
        selected={selected.kind === 'dynamic'}
        onClick={() => go({ kind: 'dynamic' })}
        depth={0}
        badge={
          unsortedDiagrams.length + generatedDiagrams.length + offlineDiagrams.length || undefined
        }
        hasChildren
        expanded={dynamicOpen}
        onToggleExpand={() => setDynamicOpen((v) => !v)}
      />
      {dynamicOpen ? (
        <>
          {(
            [
              ['unsorted', unsortedDiagrams.length],
              ['generated', generatedDiagrams.length],
              ['offline', offlineDiagrams.length],
            ] as const
          ).map(([kind, count]) => {
            const { Icon, label } = SYNTHETIC_FOLDERS[kind];
            return (
              <SidebarRow
                key={kind}
                icon={<Icon />}
                label={label}
                selected={selected.kind === kind}
                onClick={() => go({ kind })}
                depth={1}
                badge={count || undefined}
              />
            );
          })}
        </>
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

      {/* Teams (docs/specs/013-workspace/teams.md): signed-in only. Signed-out users see neither this
          nor External connections inline; they get one bottom-of-sidebar
          sign-in banner instead. A no-auth self-host never has teams. */}
      {teamsEnabled ? (
        <>
          {/* New-team lives as a plus on the section label, with a tooltip. */}
          <SidebarSectionLabel
            action={
              <Tooltip title="New Team" description="Create a team and invite people by email.">
                <button
                  type="button"
                  onClick={() => {
                    setTeamModalOpen(true);
                    setMobileNavOpen(false);
                  }}
                  aria-label="New Team"
                  className="-m-1.5 flex h-7 w-7 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-brand-700 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-brand-300"
                >
                  <PlusIcon />
                </button>
              </Tooltip>
            }
          >
            Team Spaces
          </SidebarSectionLabel>
          {teams.map((t) => {
            const byParent = teamTree.get(t.id);
            const rootFoldersOfTeam = byParent?.get(null) ?? [];
            const hasFolders = rootFoldersOfTeam.length > 0;
            const isOpen = expanded.has(t.id);
            // Team folder click opens the team page AT that folder
            // (full load: the team page reads the &folder param at
            // mount, docs/specs/013-workspace/team-shared-diagrams.md) — same as the search panel does.
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
        label="Image Gallery"
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
      {/* External connections (docs/specs/015-api/public-api-and-tokens.md): API tokens, signed-in only. Hidden
          for signed-out users (they get the bottom banner below instead). */}
      {teamsEnabled ? (
        <>
          <SidebarSectionLabel>External connections</SidebarSectionLabel>
          <SidebarRow
            icon={<KeyIcon />}
            label="API Tokens"
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
          href={signInHref}
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
