'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState, type ReactNode } from 'react';
import { Brand, ProductNav } from '@livediagram/ui';
import { AuthControls } from '@/components/chrome/AuthControls';
import { ChromeControls } from '@/components/chrome/ChromeControls';
import { TeamFormModal } from '@/components/dialogs/TeamFormModal';
import { MoveToFolderDialog } from '@/components/dialogs/MoveToFolderDialog';
import { SettingsDialog } from '@/components/dialogs/SettingsDialog';
import { SignInBanner, SIGNIN_BANNER_DISMISS_KEY } from '@/components/chrome/SignInBanner';
import { clerkEnabled } from '@/lib/clerk-config';
import { HELP_SEARCH_ITEMS } from '@/lib/help-search';
import {
  fetchUserPreferences,
  readUserPreferences,
  writeUserPreferences,
  type UserPreferences,
} from '@/lib/user-preferences';
import { useDismissibleBanner } from '@/hooks/ui/useDismissibleBanner';
import { CustomThemeProvider } from '@/components/primitives/CustomThemeProvider';
import { ExplorerProvider, useExplorer } from './ExplorerContext';
import { ExplorerSidebar } from './ExplorerSidebar';
import { useExplorerState } from './useExplorerState';
import { CloseIcon } from './icons';

// Lazy-load SearchPanel — same rationale as the editor route: it's
// gated on `searchOpen`, never default-rendered, and dropping ~375
// lines from the Explorer's initial chunk pays for itself immediately
// on the first paint of the dashboard.
const SearchPanel = dynamic(() =>
  import('@/components/panels/SearchPanel').then((m) => m.SearchPanel),
);

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
      {/* Owner-scoped custom themes (spec/44) so the Themes section + its
          builder share one source of truth, keyed by the same owner id
          the rest of the Explorer uses. */}
      <CustomThemeProvider ownerId={state.ownerId}>
        <ShellChrome>{children}</ShellChrome>
      </CustomThemeProvider>
    </ExplorerProvider>
  );
}

function ShellChrome({ children }: { children: ReactNode }) {
  const {
    diagrams,
    folders,
    shared,
    teams,
    teamFolders,
    teamDiagrams,
    go,
    mobileNavOpen,
    setMobileNavOpen,
    searchOpen,
    setSearchOpen,
    moveTarget,
    setMoveTarget,
    movePersonalFolders,
    moveTeamDests,
    moveDiagramTo,
    moveFolderToParent,
    createMoveFolder,
    teamModalOpen,
    setTeamModalOpen,
    hookCreateTeam,
    clerkUserId,
    ownerId,
  } = useExplorer();

  // Settings live in the bottom bar's gear (same synced UserPreferences as
  // the editor, spec/20). Seed from the localStorage cache for an instant
  // first paint, then merge the authoritative D1 copy in on mount.
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [prefs, setPrefs] = useState<UserPreferences>(() => readUserPreferences());
  useEffect(() => {
    if (!ownerId) return;
    let cancelled = false;
    void fetchUserPreferences(ownerId).then((merged) => {
      if (!cancelled && merged) setPrefs(merged);
    });
    return () => {
      cancelled = true;
    };
  }, [ownerId]);

  // Guest sign-in nudge (spec/36): only when Clerk is actually wired
  // up for this deployment, the visitor isn't signed in (a guest owner
  // id doesn't count), and they haven't dismissed it. When shown, the
  // pane reserves extra bottom space so the last row clears the
  // floating card.
  const { dismissed: bannerDismissed, dismiss: dismissBanner } =
    useDismissibleBanner(SIGNIN_BANNER_DISMISS_KEY);
  const showSignInBanner = clerkEnabled && !clerkUserId && !bannerDismissed;

  return (
    <div className="relative flex min-h-dvh flex-col bg-slate-50 dark:bg-slate-900">
      {/* pr-0 so the account control (a full-height, left-bordered toolbar
          button) sits flush to the right edge instead of leaving a 16px gap
          after it; pl-4 keeps the brand padded on the left. */}
      <header className="sticky top-0 z-[var(--z-chrome)] flex h-14 shrink-0 items-center justify-between gap-4 border-y border-slate-200 bg-white/85 pl-4 pr-0 backdrop-blur dark:border-slate-700 dark:bg-slate-900/85">
        <div className="flex items-center gap-3">
          <Brand href="/" size="md" />
          <ProductNav current="explorer" showOnMobile />
        </div>
        <AuthControls />
      </header>

      <main
        className={`mx-auto flex w-full max-w-7xl flex-1 gap-6 px-4 pt-6 sm:px-6 ${
          showSignInBanner ? 'pb-44 sm:pb-28' : 'pb-16'
        }`}
      >
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
          <div className="sticky top-20 rounded-xl border border-slate-200 bg-white px-3 py-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <ExplorerSidebar />
          </div>
        </aside>

        {/* ---------- Mobile section drawer ---------- */}
        {/* The sidebar is hidden below `sm`; this slides the same tree in
            from the left, opened by the hamburger in the pane header. */}
        {mobileNavOpen ? (
          <div className="fixed inset-0 z-[var(--z-overlay)] sm:hidden">
            <div
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setMobileNavOpen(false)}
              aria-hidden
            />
            <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] animate-slide-in-left flex-col overflow-y-auto border-r border-slate-200 bg-white px-3 py-4 shadow-xl dark:border-slate-700 dark:bg-slate-800">
              <div className="mb-1 flex items-center justify-between pl-1">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Sections
                </span>
                <button
                  type="button"
                  onClick={() => setMobileNavOpen(false)}
                  aria-label="Close"
                  className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
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

      {/* Bottom bar (spec/07): the same strip as the editor's tab bar, minus
          the tabs — the shared right-hand control cluster (search / GitHub /
          settings / dark-mode). Sticky so it stays in view while the dashboard
          scrolls; the sign-in banner is nudged up to clear it. */}
      <div className="sticky bottom-0 z-[var(--z-chrome)] flex h-12 shrink-0 items-center justify-end gap-2 border-t border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-900">
        <ChromeControls
          onOpenSearch={() => setSearchOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      </div>

      {/* Move-destination modal (spec/15 + spec/35): the shared
          placement browser (spec/76's Save In UI) for every diagram
          (personal or team) and for folder re-parenting. It offers
          "My Work" plus each team as a space (for diagram moves);
          `moveDiagramTo` routes the pick from the subject's current
          placement. Folder moves are personal-only, so they pass no
          teams. The New Folder tile creates in the picked scope. */}
      {moveTarget
        ? (() => {
            const teamRow =
              moveTarget.kind === 'diagram'
                ? teamDiagrams.find((d) => d.id === moveTarget.id)
                : undefined;
            const personalRow =
              moveTarget.kind === 'diagram'
                ? diagrams.find((d) => d.id === moveTarget.id)
                : undefined;
            const folderRow =
              moveTarget.kind === 'folder'
                ? folders.find((f) => f.id === moveTarget.id)
                : undefined;
            const subjectName = teamRow?.name || personalRow?.name || folderRow?.name || 'Untitled';
            const currentTeamId = teamRow?.team.id ?? null;
            const currentFolderId =
              moveTarget.kind === 'folder'
                ? (folderRow?.parentId ?? null)
                : (teamRow?.folderId ?? personalRow?.folderId ?? null);
            return (
              <MoveToFolderDialog
                subjectName={subjectName}
                subjectKind={moveTarget.kind}
                personalFolders={movePersonalFolders}
                teams={moveTarget.kind === 'diagram' ? moveTeamDests : undefined}
                currentTeamId={currentTeamId}
                currentFolderId={currentFolderId}
                onCreateFolder={createMoveFolder}
                onPick={(dest) => {
                  if (moveTarget.kind === 'folder')
                    moveFolderToParent(moveTarget.id, dest.folderId);
                  else moveDiagramTo(moveTarget.id, dest);
                }}
                onClose={() => setMoveTarget(null)}
              />
            );
          })()
        : null}
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
          teamFolders={teamFolders}
          teamDiagrams={teamDiagrams.map((d) => ({
            id: d.id,
            name: d.name,
            teamId: d.team.id,
            teamName: d.team.name,
          }))}
          onSelectDiagram={(id) => {
            window.location.assign(`/diagram/${id}`);
          }}
          onSelectShared={(id, shareCode) => {
            // Non-owners can only open the diagram on the visitor URL.
            window.location.assign(`/diagram/${id}?s=${encodeURIComponent(shareCode)}`);
          }}
          onSelectFolder={(id) => {
            go({ kind: 'folder', id });
            setSearchOpen(false);
          }}
          onSelectTeam={(id) => {
            go({ kind: 'team', id });
            setSearchOpen(false);
          }}
          onSelectTeamFolder={(teamId, folderId) => {
            // Full load rather than go(): the team page reads the
            // folder deep-link param at mount (spec/35).
            window.location.assign(
              `/explorer/team?id=${encodeURIComponent(teamId)}&folder=${encodeURIComponent(folderId)}`,
            );
          }}
          helpItems={HELP_SEARCH_ITEMS}
          onClose={() => setSearchOpen(false)}
        />
      ) : null}

      {settingsOpen ? (
        <SettingsDialog
          settings={prefs}
          onChange={(next) => {
            setPrefs(next);
            writeUserPreferences(next, ownerId);
          }}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}

      {/* Guest sign-in encouragement (spec/36): Explorer only, never
          the editor. Dismissal persists per device. */}
      {showSignInBanner ? <SignInBanner onDismiss={dismissBanner} /> : null}
    </div>
  );
}
