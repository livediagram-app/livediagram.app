'use client';

import { LocalMovePrompt } from '@/components/dialogs/LocalMovePrompt';
import dynamic from 'next/dynamic';
import { dropSettingsLink } from '@/lib/settings-link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { Brand, SITE_ID, SiteSwitcher } from '@liveplanner/ui';
import { AuthControls } from '@/components/chrome/AuthControls';
import { LensField } from './lens/LensField';
import { LensAnnouncer } from './lens/LensStates';
import { ChromeControls } from '@/components/chrome/ChromeControls';
import { SignInBanner, SIGNIN_BANNER_DISMISS_KEY } from '@/components/chrome/SignInBanner';
import { useAccessEndedToast } from './useAccessEndedToast';
import { signInEnabled } from '@/lib/auth-config';
import { HELP_SEARCH_ITEMS } from '@/lib/help-search';
import { SETTINGS_SEARCH_ITEMS } from '@/lib/settings-search-items';
import { commitUserPreferences } from '@/lib/user-preferences';
import { isPowerUserMode } from '@/lib/power-user-mode';
import { useDismissibleBanner } from '@/hooks/ui/useDismissibleBanner';
import { useSearchShortcut } from '@/hooks/ui/useSearchShortcut';
import { CustomThemeProvider } from '@/components/primitives/CustomThemeProvider';
import { ProjectTagsProvider } from '@/components/tags/ProjectTagsProvider';
import { AreaErrorBoundary } from '@/components/primitives/AreaErrorBoundary';
import { ExplorerProvider, useExplorer } from './ExplorerContext';
import { ExplorerSidebar } from './sidebar/ExplorerSidebar';
import { SectionsDrawer } from './SectionsDrawer';
import { HomeHero } from '@/components/panels/home/HomeHero';
import { useHeroPresence } from '@/components/panels/home/useHeroPresence';
import { homeBannerShown } from '@/lib/home-banner';
import { useMidnightPalette } from '@/hooks/ui/useMidnightPalette';
import { useExplorerState } from './useExplorerState';
import { teamFolderPath } from './routes';
import { searchPanelSources } from '@/components/panels/search-panel-sources';
import { explorerSurfaceFlags, useExplorerSurface } from './explorer-surface';
import { explorerPathFor } from './routes';
import { WorkbenchOpenLink } from '@/components/chrome/WorkbenchChrome';
import { assignAppLocation } from '@/lib/app-location';

// Lazy-load SearchPanel — same rationale as the editor route: it's
// gated on `searchOpen`, never default-rendered, and dropping ~375
// lines from the Explorer's initial chunk pays for itself immediately
// on the first paint of the dashboard.
const SearchPanel = dynamic(
  () => import('@/components/panels/SearchPanel').then((m) => m.SearchPanel),
  { ssr: false },
);

// Settings and the move picker mount only while open, so they load on first open rather than
// with every Explorer page: Settings alone carries every category's panes.
const SettingsDialog = dynamic(
  () => import('@/components/dialogs/SettingsDialog').then((m) => m.SettingsDialog),
  { ssr: false },
);
const MoveToFolderDialog = dynamic(
  () => import('@/components/dialogs/MoveToFolderDialog').then((m) => m.MoveToFolderDialog),
  { ssr: false },
);

// Sidebar width. Wide enough for ~3 levels of indented folder names,
// narrow enough that the list view keeps its breathing room.
const SIDEBAR_WIDTH = 256;

// The Explorer chrome (docs/specs/013-workspace/folders.md): header, desktop sidebar, mobile
// drawer, and the cross-section overlays (move picker, new-team
// modal, search), wrapped around whichever /explorer/<section> route
// page is active. Rendered by app/explorer/layout.tsx so the chrome —
// and all the state behind it — persists across section navigations;
// only the right pane (children) changes.
export function ExplorerShell({ children }: { children: ReactNode }) {
  const state = useExplorerState();
  const surface = explorerSurfaceFlags(useExplorerSurface());
  // Dark mode's Midnight palette, before the first paint (docs/specs/004-interface-design/color-scheme.md).
  useMidnightPalette();
  // Wait for auth to settle so a signed-in user never momentarily
  // reads the localStorage guest id and refreshes against the wrong
  // owner. After this gate, `ownerId` is either the account id or
  // the guest UUID (never null in practice).
  if (!state.authLoaded) return null;
  return (
    <ExplorerProvider value={state}>
      {/* Owner-scoped custom themes (docs/specs/011-theme/custom-themes.md) so the Themes section + its
          builder share one source of truth, keyed by the same owner id
          the rest of the Explorer uses. */}
      <CustomThemeProvider ownerId={state.ownerId}>
        {/* The reader's tags (docs/specs/013-workspace/tags.md): the sidebar's Tags rows, the Tags page, every
            row's chips and every project menu's Tags read the one list. */}
        <ProjectTagsProvider ownerId={state.ownerId}>
          <ShellChrome>{children}</ShellChrome>
        </ProjectTagsProvider>
      </CustomThemeProvider>
      {/* Moving this browser's projects in This Browser after signing in
          (docs/specs/014-identity/auth-and-guest-access.md). */}
      {surface.guestPrompts ? <LocalMovePrompt /> : null}
    </ExplorerProvider>
  );
}

function ShellChrome({ children }: { children: ReactNode }) {
  const {
    projects: liveDocs,
    folders,
    shared,
    teams,
    teamFolders,
    teamProjects,
    go,
    mobileNavOpen,
    setMobileNavOpen,
    searchOpen,
    setSearchOpen,
    settingsOpen,
    setSettingsOpen,
    settingsFocus,
    setSettingsFocus,
    settingsCategory,
    openSettingsOn,
    setSettingsCategory,
    settingsSection,
    setSettingsSection,
    moveTarget,
    setMoveTarget,
    movePersonalFolders,
    moveTeamDests,
    moveProjectTo,
    moveFolderToParent,
    createMoveFolder,
    accountUserId,
    ownerId,
    prefs,
    lens,
    lensResult,
    selected,
  } = useExplorer();
  // In a workspace frame: no app header, account menu, Settings or Teams administration (explorer-surface.ts).
  const surface = explorerSurfaceFlags(useExplorerSurface());
  // Navigating to another section clears a crashed pane's notice.
  const pathname = usePathname();
  // Home's hero folds away when the reader leaves Home and unfolds when they return; hidden by its close, Home
  // opens on the header's field and its own page header instead (explorer-home.md "Hiding the banner").
  const heroOnHome = selected.kind === 'home' && homeBannerShown(prefs);
  const hero = useHeroPresence(heroOnHome);
  // Cmd/Ctrl+K and Cmd/Ctrl+. open search here as in the editor (docs/specs/007-editor/command-palette.md).
  useSearchShortcut(() => setSearchOpen(true));

  // Settings live in the bottom bar's gear (same synced UserPreferences as
  // the editor, docs/specs/007-editor/user-preferences.md). The prefs themselves are owned by
  // useExplorerState — the pane reads them too (Recent honours the
  // hidden-from-Recent list, docs/specs/013-workspace/hide-from-recent.md), and a second useState here would
  // drift the moment either wrote.

  // Guest sign-in nudge (docs/specs/014-identity/sign-in-encouragement.md): only when sign-in is actually wired
  // up for this deployment, the visitor isn't signed in (a guest owner
  // id doesn't count), and they haven't dismissed it. When shown, the
  // pane reserves extra bottom space so the last row clears the
  // floating card.
  const { dismissed: bannerDismissed, dismiss: dismissBanner } =
    useDismissibleBanner(SIGNIN_BANNER_DISMISS_KEY);
  const showSignInBanner =
    surface.guestPrompts && signInEnabled && !accountUserId && !bannerDismissed;
  // Arrived here because a pass was revoked under an open project: say so (lib/access-notice.ts).
  useAccessEndedToast();

  return (
    <div className="relative flex min-h-dvh flex-col bg-slate-50 dark:bg-slate-900">
      {/* pr-0 so the account control (a full-height, left-bordered toolbar
          button) sits flush to the right edge instead of leaving a 16px gap
          after it; pl-4 keeps the brand padded on the left. */}
      {/* The search field (docs/specs/013-workspace/explorer-filters.md "The field") sits left of the
          account; below `sm` it wraps onto its own full-width row, so the header grows rather than
          squeezing the brand. */}
      {/* On a desktop the header is three columns, the field centred between the brand and the account on every
          page; each side grows to its content first, so a narrow desktop never overlaps them. */}
      {surface.appHeader ? (
        <header className="sticky top-0 z-[var(--z-chrome)] flex shrink-0 flex-wrap items-center justify-between gap-x-4 border-y border-slate-200 bg-white/85 pl-4 pr-0 backdrop-blur sm:h-14 sm:flex-nowrap lg:grid lg:grid-cols-[minmax(max-content,1fr)_auto_minmax(max-content,1fr)] dark:border-slate-700 dark:bg-slate-900/85">
          <div className="flex h-14 items-center gap-3 lg:col-start-1">
            {/* Hover the logo for liveworkspace's other sites (liveworkspace/docs/site-switcher.md). */}
            <SiteSwitcher current={SITE_ID}>
              <Brand href="/" size="md" />
            </SiteSwitcher>
          </div>
          {/* While Home shows its hero the field sits there instead (docs/specs/013-workspace/explorer-filters.md "The
              field"). */}
          {heroOnHome ? null : (
            <div className="order-last w-full pb-2 pr-4 sm:order-none sm:ml-auto sm:w-auto sm:pb-0 sm:pr-0 lg:col-start-2 lg:ml-0">
              <LensField lens={lens} subjects={lensResult.subjects} />
              {/* Counts what the lens left once typing settles; the team library counts its own. */}
              <LensAnnouncer
                input={lens.input}
                shown={lensResult.shown}
                total={lensResult.total}
                muted={lens.view === null || selected.kind === 'team'}
              />
            </div>
          )}
          <div className="flex h-14 items-stretch lg:col-start-3 lg:justify-self-end">
            <AuthControls onOpenAccount={() => openSettingsOn('account')} />
          </div>
        </header>
      ) : heroOnHome ? null : (
        // A workspace frame keeps the Explorer's field in a slim bar of its own (WB61): no brand, product nav or
        // account.
        <div className="sticky top-0 z-[var(--z-chrome)] flex h-12 shrink-0 items-center border-b border-slate-200 bg-white/85 px-4 backdrop-blur dark:border-slate-700 dark:bg-slate-900/85">
          <div className="w-full sm:mx-auto sm:max-w-md">
            <LensField lens={lens} subjects={lensResult.subjects} />
            <LensAnnouncer
              input={lens.input}
              shown={lensResult.shown}
              total={lensResult.total}
              muted={lens.view === null || selected.kind === 'team'}
            />
          </div>
        </div>
      )}

      {/* Home's front-page band (docs/specs/013-workspace/explorer-home.md "The hero"), above the sidebar. */}
      {hero.mounted ? (
        <div
          data-home-hero-fold={hero.open ? 'open' : 'closed'}
          // Folded, it takes no focus and says nothing: the page it folds away from is gone.
          inert={!hero.open}
          aria-hidden={!hero.open || undefined}
          className={`grid transition-[grid-template-rows,opacity] duration-long ease-out ${
            hero.open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          }`}
        >
          <div className="min-h-0 overflow-hidden">
            <HomeHero active={heroOnHome} />
          </div>
        </div>
      ) : null}

      <main
        className={`mx-auto flex w-full max-w-7xl flex-1 gap-8 px-4 pt-8 sm:px-6 ${
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
          {/* No box: the tree sits on the page (docs/specs/013-workspace/explorer-structure.md "Look"). */}
          <div className="sticky top-20 px-1 py-1">
            <AreaErrorBoundary area="ExplorerSidebar" fallback="panel">
              <ExplorerSidebar />
            </AreaErrorBoundary>
          </div>
        </aside>

        {/* ---------- Mobile section drawer ---------- */}
        {/* The sidebar is hidden below `sm`; this slides the same tree in
            from the left, opened by the hamburger in the pane header. */}
        {mobileNavOpen ? (
          <SectionsDrawer onClose={() => setMobileNavOpen(false)}>
            <AreaErrorBoundary area="ExplorerSidebar" fallback="panel">
              <ExplorerSidebar />
            </AreaErrorBoundary>
          </SectionsDrawer>
        ) : null}

        {/* ---------- Right pane: the active section route ---------- */}
        <section className="min-w-0 flex-1">
          <AreaErrorBoundary area="ExplorerPane" fallback="panel" resetKey={pathname}>
            {children}
          </AreaErrorBoundary>
        </section>
      </main>

      {/* Bottom bar (docs/specs/007-editor/editor-app.md): the same strip as the editor's tab bar, minus
          the tabs — the shared right-hand control cluster (search /
          settings / dark-mode). Sticky so it stays in view while the dashboard
          scrolls; the sign-in banner is nudged up to clear it. */}
      <div
        // The toasts stand on it (docs/specs/004-interface-design/toasts.md "Placement").
        data-toast-floor=""
        className="sticky bottom-0 z-[var(--z-chrome)] flex h-12 shrink-0 items-center justify-end gap-2 border-t border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-900"
      >
        <ChromeControls
          onOpenSearch={() => setSearchOpen(true)}
          onOpenSettings={surface.settings ? () => setSettingsOpen(true) : undefined}
          powerUser={isPowerUserMode(prefs)}
          appearance={surface.appearance}
        />
        {/* A workspace frame's Open in liveplanner: this view in a full tab. */}
        {surface.appHeader ? null : (
          <WorkbenchOpenLink
            href={explorerPathFor(selected)}
            labelled
            description="Opens this view in a full tab."
          />
        )}
      </div>

      {/* Move-destination modal (docs/specs/013-workspace/folders.md + docs/specs/013-workspace/team-shared-projects.md): the shared
          placement browser (docs/specs/006-project/offline-mode.md's Save In UI) for every project
          (personal or team) and for folder re-parenting. It offers
          "My Projects" plus each team as a space (for project moves);
          `moveProjectTo` routes the pick from the subject's current
          placement. Folder moves are personal-only, so they pass no
          teams. The New Folder tile creates in the picked scope. */}
      {moveTarget
        ? (() => {
            const teamRow =
              moveTarget.kind === 'project'
                ? teamProjects.find((d) => d.id === moveTarget.id)
                : undefined;
            const personalRow =
              moveTarget.kind === 'project'
                ? liveDocs.find((d) => d.id === moveTarget.id)
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
                teams={moveTarget.kind === 'project' ? moveTeamDests : undefined}
                currentTeamId={currentTeamId}
                currentFolderId={currentFolderId}
                onCreateFolder={createMoveFolder}
                onPick={(dest) => {
                  if (moveTarget.kind === 'folder')
                    moveFolderToParent(moveTarget.id, dest.folderId);
                  else moveProjectTo(moveTarget.id, dest);
                }}
                onClose={() => setMoveTarget(null)}
              />
            );
          })()
        : null}
      {searchOpen ? (
        <SearchPanel
          {...searchPanelSources({ projects: liveDocs, folders, shared, teams, teamProjects })}
          teamFolders={teamFolders}
          onSelectProject={(id) => {
            assignAppLocation(`/project/${id}`);
          }}
          onSelectShared={(id, shareCode) => {
            // Non-owners can only open the project on the visitor URL.
            assignAppLocation(`/project/${id}?s=${encodeURIComponent(shareCode)}`);
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
            // folder deep-link param at mount (docs/specs/013-workspace/team-shared-projects.md).
            assignAppLocation(teamFolderPath(teamId, folderId));
          }}
          helpItems={HELP_SEARCH_ITEMS}
          settingItems={surface.settings ? SETTINGS_SEARCH_ITEMS : []}
          onSelectSetting={(categoryId, rowKey) => {
            setSettingsFocus({ categoryId, rowKey });
            setSettingsOpen(true);
          }}
          onClose={() => setSearchOpen(false)}
        />
      ) : null}

      {surface.settings && settingsOpen ? (
        <SettingsDialog
          settings={prefs}
          onChange={(next) => {
            // The row built `next` on this render's preferences; only its change is written, onto
            // the freshest, so another tab's change since is kept. The cache drives `prefs`.
            commitUserPreferences(prefs, next, ownerId);
          }}
          ownerId={ownerId}
          onClose={() => {
            setSettingsOpen(false);
            setSettingsFocus(null);
            setSettingsCategory(null);
            setSettingsSection(null);
            dropSettingsLink();
          }}
          focus={settingsFocus}
          initialCategoryId={settingsCategory}
          initialSectionId={settingsSection}
        />
      ) : null}

      {/* Guest sign-in encouragement (docs/specs/014-identity/sign-in-encouragement.md): Explorer only, never
          the editor. Dismissal persists per device. */}
      {showSignInBanner ? <SignInBanner surface="Explorer" onDismiss={dismissBanner} /> : null}
    </div>
  );
}
