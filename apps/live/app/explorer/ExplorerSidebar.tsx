'use client';

import Link from 'next/link';
import { SignInIcon } from '@/components/AuthControls';
import { Tooltip } from '@/components/Tooltip';
import { clerkEnabled } from '@/lib/clerk-config';
import { useExplorer } from './ExplorerContext';
import {
  ClockIcon,
  FolderIcon,
  HomeIcon,
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
    invites,
    teamsEnabled,
    setTeamModalOpen,
  } = useExplorer();

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
        <span className="flex-1 truncate">Search...</span>
      </button>
      <div className="my-4 h-px bg-slate-100" aria-hidden />
      <SidebarSectionLabel>Quick find</SidebarSectionLabel>
      <SidebarRow
        icon={<ClockIcon />}
        label="Recent diagrams"
        selected={selected.kind === 'recent'}
        onClick={() => go({ kind: 'recent' })}
        depth={0}
      />
      <SidebarRow
        icon={<ShareIcon />}
        label="Shared with me"
        selected={selected.kind === 'shared'}
        onClick={() => go({ kind: 'shared' })}
        depth={0}
        badge={shared.length > 0 ? shared.length : undefined}
      />

      <SidebarSectionLabel>My Work</SidebarSectionLabel>
      <SidebarRow
        icon={<HomeIcon />}
        label="All diagrams"
        selected={selected.kind === 'all'}
        onClick={() => go({ kind: 'all' })}
        depth={0}
        hasChildren={rootFolders.length > 0}
        expanded={true}
        onToggleExpand={undefined}
      />
      {/* Unsorted is a synthetic folder backed by folder_id IS NULL —
          always present at the top of the root level so loose diagrams
          have somewhere obvious to land. */}
      <SidebarRow
        icon={<FolderIcon open={false} />}
        label="Unsorted"
        selected={selected.kind === 'unsorted'}
        onClick={() => go({ kind: 'unsorted' })}
        depth={1}
        badge={unsortedDiagrams.length > 0 ? unsortedDiagrams.length : undefined}
      />
      {rootFolders.map((f) => (
        <SidebarFolderSubtree
          key={f.id}
          folder={f}
          depth={1}
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
              {teams.map((t) => (
                <SidebarRow
                  key={t.id}
                  icon={<TeamIcon />}
                  label={t.name}
                  selected={selected.kind === 'team' && selected.id === t.id}
                  onClick={() => go({ kind: 'team', id: t.id })}
                  depth={0}
                  badge={t.memberCount > 1 ? t.memberCount : undefined}
                />
              ))}
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
