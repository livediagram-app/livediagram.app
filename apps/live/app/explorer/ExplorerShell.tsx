'use client';

import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';
import { Brand } from '@livediagram/ui';
import { AuthControls } from '@/components/AuthControls';
import { TeamFormModal } from '@/components/TeamFormModal';
import { MenuItem, PortalMenu } from '@/components/PortalMenu';
import { MenuSection } from '@/components/PortalMenu';
import { ExplorerProvider, useExplorer } from './ExplorerContext';
import { ExplorerSidebar } from './ExplorerSidebar';
import { useExplorerState } from './useExplorerState';
import { CloseIcon, MenuFolderIcon, TeamIcon } from './icons';

// Lazy-load SearchPanel — same rationale as the editor route: it's
// gated on `searchOpen`, never default-rendered, and dropping ~375
// lines from the Explorer's initial chunk pays for itself immediately
// on the first paint of the dashboard.
const SearchPanel = dynamic(() => import('@/components/SearchPanel').then((m) => m.SearchPanel));

// Sidebar width. Wide enough for ~3 levels of indented folder names,
// narrow enough that the list view keeps its breathing room.
const SIDEBAR_WIDTH = 256;

// The Explorer chrome (spec/15): header, desktop sidebar, mobile
// drawer, and the cross-section overlays (move picker, new-team
// modal, search), wrapped around whichever /explorer/<section> route
// page is active. Rendered by app/explorer/layout.tsx so the chrome —
// and all the state behind it — persists across section navigations;
// only the right pane (children) changes.
export function ExplorerShell({ children }: { children: ReactNode }) {
  const state = useExplorerState();
  // Wait for Clerk to settle so a signed-in user never momentarily
  // reads the localStorage guest id and refreshes against the wrong
  // owner. After this gate, `ownerId` is either the Clerk userId or
  // the guest UUID (never null in practice).
  if (!state.authLoaded) return null;
  return (
    <ExplorerProvider value={state}>
      <ShellChrome>{children}</ShellChrome>
    </ExplorerProvider>
  );
}

function ShellChrome({ children }: { children: ReactNode }) {
  const {
    diagrams,
    folders,
    shared,
    teams,
    go,
    mobileNavOpen,
    setMobileNavOpen,
    searchOpen,
    setSearchOpen,
    moveTarget,
    setMoveTarget,
    moveAnchorRef,
    movePickerRows,
    moveDiagramToFolder,
    moveDiagramToTeam,
    moveFolderToParent,
    teamModalOpen,
    setTeamModalOpen,
    hookCreateTeam,
  } = useExplorer();

  return (
    <div className="relative flex min-h-dvh flex-col bg-slate-50">
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white/85 px-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <Brand href="/" size="md" />
          <span className="text-sm font-medium text-slate-500">Explorer</span>
        </div>
        <AuthControls />
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-1 gap-6 px-4 pb-16 pt-6 sm:px-6">
        {/* ---------- Sidebar tree ---------- */}
        {/* Hidden on mobile: at 375px the 256px sidebar swallows
            the right pane entirely. Users on a phone navigate via
            the right pane (folder rows + the existing header search
            button); the full sidebar tree is desktop chrome. */}
        <aside
          className="hidden shrink-0 self-start sm:block"
          style={{ width: SIDEBAR_WIDTH }}
          aria-label="Sections"
        >
          <div className="sticky top-20 rounded-xl border border-slate-200 bg-white px-3 py-5 shadow-sm">
            <ExplorerSidebar />
          </div>
        </aside>

        {/* ---------- Mobile section drawer ---------- */}
        {/* The sidebar is hidden below `sm`; this slides the same tree in
            from the left, opened by the hamburger in the pane header. */}
        {mobileNavOpen ? (
          <div className="fixed inset-0 z-40 sm:hidden">
            <div
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setMobileNavOpen(false)}
              aria-hidden
            />
            <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] animate-slide-in-left flex-col overflow-y-auto border-r border-slate-200 bg-white px-3 py-4 shadow-xl">
              <div className="mb-1 flex items-center justify-between pl-1">
                <span className="text-sm font-semibold text-slate-700">Sections</span>
                <button
                  type="button"
                  onClick={() => setMobileNavOpen(false)}
                  aria-label="Close"
                  className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                >
                  <CloseIcon />
                </button>
              </div>
              <ExplorerSidebar />
            </div>
          </div>
        ) : null}

        {/* ---------- Right pane: the active section route ---------- */}
        <section className="min-w-0 flex-1">{children}</section>
      </main>

      {moveTarget ? (
        <PortalMenu
          anchor={moveAnchorRef.current}
          placement="below"
          onClose={() => setMoveTarget(null)}
        >
          <MenuItem
            icon={<MenuFolderIcon />}
            label="All diagrams"
            onClick={() => {
              if (moveTarget.kind === 'diagram') moveDiagramToFolder(moveTarget.id, null);
              else moveFolderToParent(moveTarget.id, null);
              setMoveTarget(null);
            }}
          />
          {movePickerRows.map((row) => (
            <MenuItem
              key={row.id}
              icon={<MenuFolderIcon />}
              label={row.path}
              onClick={() => {
                if (moveTarget.kind === 'diagram') moveDiagramToFolder(moveTarget.id, row.id);
                else moveFolderToParent(moveTarget.id, row.id);
                setMoveTarget(null);
              }}
            />
          ))}
          {/* Team destinations (spec/35): diagrams only — folders
              stay personal. Lands in the team's Unsorted; organise
              further on the team page. */}
          {moveTarget.kind === 'diagram' && teams.length > 0 ? (
            <>
              <MenuSection label="Teams" />
              {teams.map((t) => (
                <MenuItem
                  key={t.id}
                  icon={<TeamIcon />}
                  label={t.name}
                  onClick={() => {
                    moveDiagramToTeam(moveTarget.id, t.id);
                    setMoveTarget(null);
                  }}
                />
              ))}
            </>
          ) : null}
        </PortalMenu>
      ) : null}
      <TeamFormModal
        open={teamModalOpen}
        title="New team"
        submitLabel="Create team"
        onSubmit={(values) => {
          setTeamModalOpen(false);
          void hookCreateTeam(values).then((team) => {
            if (team) go({ kind: 'team', id: team.id });
          });
        }}
        onCancel={() => setTeamModalOpen(false)}
      />
      {searchOpen ? (
        <SearchPanel
          diagrams={diagrams.map((d) => ({ id: d.id, name: d.name }))}
          folders={folders.map((f) => ({ id: f.id, name: f.name }))}
          shared={shared.map((s) => ({ id: s.id, name: s.name, shareCode: s.shareCode }))}
          teams={teams.map((t) => ({ id: t.id, name: t.name }))}
          onSelectDiagram={(id) => {
            window.location.assign(`/live/diagram/${id}`);
          }}
          onSelectShared={(id, shareCode) => {
            // Non-owners can only open the diagram on the visitor URL.
            window.location.assign(`/live/diagram/${id}?s=${encodeURIComponent(shareCode)}`);
          }}
          onSelectFolder={(id) => {
            go({ kind: 'folder', id });
            setSearchOpen(false);
          }}
          onSelectTeam={(id) => {
            go({ kind: 'team', id });
            setSearchOpen(false);
          }}
          onClose={() => setSearchOpen(false)}
        />
      ) : null}
    </div>
  );
}
