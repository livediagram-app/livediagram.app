'use client';

import { track } from '@/lib/telemetry';
import { OFFLINE_OWNER_ID } from '@/lib/offline/offline-store';
import { getTheme } from '@/lib/themes';
import { EditorCanvasHost } from '@/components/canvas/EditorCanvasHost';
import { EditorHeader } from '@/components/chrome/EditorHeader';
import { EmbedChrome } from '@/components/chrome/EmbedChrome';
import { TabBar } from '@/components/chrome/TabBar';
import { SignInBanner, SIGNIN_BANNER_DISMISS_KEY } from '@/components/chrome/SignInBanner';
import { EmptyCanvasBanner } from '@/components/canvas/EmptyCanvasBanner';
import { EditorModals } from '@/components/dialogs/EditorModals';
import { EditorTabDialogs } from '@/components/dialogs/EditorTabDialogs';
import { EditorElementDialogs } from '@/components/dialogs/EditorElementDialogs';
import { EditorContextMenuHost } from '@/components/palette/EditorContextMenuHost';
import { TourHost } from '@/components/tour/TourHost';
import { EditorAnchoredPopovers } from '@/components/panels/EditorAnchoredPopovers';
import { EditorSearchPanel } from '@/components/panels/EditorSearchPanel';
import { ThemeModeBanner } from '@/components/chrome/ThemeModeBanner';
import { ShiftHintBanner } from '@/components/chrome/ShiftHintBanner';
import { clerkEnabled } from '@/lib/clerk-config';
import { useDismissibleBanner } from '@/hooks/ui/useDismissibleBanner';
import { useIsOfflineDiagram } from '@/hooks/persistence/useIsOfflineDiagram';
import { useDelayedReveal } from '@/hooks/ui/useDelayedReveal';
import { useEditorAccent } from '@/hooks/ui/useEditorAccent';
import { useEditorContext } from './EditorContext';

// How long a guest edits before the sign-in nudge appears (spec/36).
// Long enough that it never greets someone the instant they open a
// diagram; short enough to catch an invested session.
const SIGNIN_BANNER_DELAY_MS = 5 * 60_000;

// The editor's full view (header + canvas + tab bar + all dialogs),
// lifted out of editor-page.tsx. Every value/handler it needs is read
// from EditorContext (provided by the page), so the page no longer
// threads ~150 props through this JSX. The JSX is verbatim; only its
// scope changed from the page's locals to the destructured context.
export function EditorView() {
  const ctx = useEditorContext();
  // Offline Mode (spec/76): a diagram saved only in this browser. Drives the
  // "Offline" header badge and hides server-only actions (Share).
  const isOffline = useIsOfflineDiagram(ctx.diagramId);
  const {
    activeId,
    activeTab,
    addTab,
    anyWelcomeOpen,
    embedMode,
    autoAlignTab,
    autoLayoutTab,
    applyTabFontToAll,
    startTimer,
    pauseTimer,
    resumeTimer,
    resetTimer,
    clearTimer,
    startVote,
    endVote,
    revealVote,
    clearVote,
    canvasTool,
    drag,
    clearTabContent,
    clerkUserId,
    closeContextMenu,
    contextMenu,
    copying,
    deleteTab,
    diagramId,
    diagramList,
    setDiagramList,
    diagramName,
    diagramShareable,
    diagramTeamId,
    duplicateTab,
    templateGridOpen,
    formatSourceId,
    groupSourceId,
    hydrated,
    setImportOpen,
    isOwner,
    isReadOnly,
    linkActiveTabTo,
    loadAllTabs,
    makeCopy,
    openTemplatePicker,
    participantsByTab,
    pendingDraw,
    renameTab,
    renameTabFolder,
    moveTabToFolder,
    removeTabFromFolder,
    reorderTabs,
    selectedId,
    connectSourceId,
    cancelConnect,
    selfParticipant,
    sessionRole,
    sessionShareCode,
    setActiveId,
    setDiagramName,
    setEditingId,
    setExportOpen,
    setExportScope,
    setFormatSourceId,
    setGroupSourceId,
    setMultiSelectedIds,
    setSearchOpen,
    setSelectedId,
    setSettingsOpen,
    setShareDialogOpen,
    setCanvasThemeTab,
    renameDiagramNonce,
    renameTabNonce,
    setShortcutsOpen,
    setTabFont,
    setTabDefaultTextSize,
    tabs,
    toggleActiveTabLock,
    zenMode,
  } = ctx;
  // Contextual command palette for the SearchPanel "Actions" group (spec/09):
  // selection-aware command list + dispatcher, built off the same editor
  // actions the menus use. Empty (undefined items) for view-only sessions.
  // Retarget the brand-* accent (buttons, rings, focus) to the active tab's
  // theme so the editor chrome matches the diagram (spec/42).
  useEditorAccent(activeTab.theme);
  // Guest sign-in nudge (spec/36): the same banner the Explorer shows,
  // but on the editor it waits ~5 minutes into the session before
  // appearing so it never interrupts someone the moment they open a
  // diagram. Hidden in embed (read-only iframe) and zen mode. zenMode
  // is deliberately kept OUT of the timer's `enabled` so toggling zen
  // doesn't restart the countdown; it only hides the card at render.
  const { dismissed: signInDismissed, dismiss: dismissSignIn } =
    useDismissibleBanner(SIGNIN_BANNER_DISMISS_KEY);
  const signInTimerEnabled = clerkEnabled && !clerkUserId && !embedMode && !signInDismissed;
  const signInDelayElapsed = useDelayedReveal(SIGNIN_BANNER_DELAY_MS, signInTimerEnabled);
  const showSignInBanner = signInTimerEnabled && !zenMode && signInDelayElapsed;
  // Empty-canvas hint (spec/14): a bottom banner while the active tab has no
  // elements. Not dismissible — it just goes away once there's content. Hidden
  // in zen / embed, while a draw tool is armed, or while Quick Start is open;
  // yields the bottom slot to the sign-in banner.
  const showEmptyCanvasBanner =
    hydrated &&
    !zenMode &&
    !embedMode &&
    !showSignInBanner &&
    !templateGridOpen &&
    !pendingDraw &&
    activeTab.elements.length === 0;
  // The primary selection's flavour for the shift hint's no-drag messages.
  const shiftSelected = selectedId ? activeTab.elements.find((el) => el.id === selectedId) : null;
  const shiftSelectedKind = !shiftSelected
    ? null
    : shiftSelected.type === 'arrow'
      ? ('arrow' as const)
      : shiftSelected.type === 'table'
        ? ('table' as const)
        : ('other' as const);

  return (
    <div className="flex h-dvh flex-col">
      {/* Arrow click-to-connect hint (spec/09): shown while the gesture
          is armed so the user knows the next shape click connects, and
          gives a click target to cancel (clicking empty canvas also
          cancels). */}
      {connectSourceId !== null ? (
        <div className="pointer-events-none fixed inset-x-0 top-16 z-[var(--z-modal)] flex justify-center">
          <button
            type="button"
            onClick={cancelConnect}
            className="pointer-events-auto flex items-center gap-2 rounded-full border border-brand-300 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 shadow-sm transition hover:bg-brand-100 dark:border-brand-500/40 dark:bg-brand-500/15 dark:text-brand-200"
          >
            Click a shape to connect the arrow
            <span className="text-brand-300" aria-hidden>
              |
            </span>
            <span className="text-brand-500 dark:text-brand-300">Cancel</span>
          </button>
        </div>
      ) : null}
      {/* Zen / focus mode (spec/26) hides the header entirely so the
          canvas gets the full height. Embeds (spec/33) never show it. */}
      {zenMode || embedMode ? null : (
        <EditorHeader
          diagramName={diagramName}
          hideTitle={anyWelcomeOpen}
          showShare={isOwner && hydrated && !anyWelcomeOpen}
          shareable={diagramShareable}
          teamDiagram={!!diagramTeamId}
          offline={isOffline}
          // Visitors see "Make a copy" instead of "Share": same slot,
          // different action. Hidden during the welcome flow so the
          // first-paint chrome stays minimal, and during hydration so
          // we don't render the button before we know whether the user
          // is the owner.
          onMakeCopy={!isOwner && hydrated && !anyWelcomeOpen && diagramId ? makeCopy : undefined}
          copying={copying}
          readOnly={isReadOnly}
          renameNonce={renameDiagramNonce}
          brandAccent={getTheme(activeTab.theme).elementStroke ?? undefined}
          onOpenShare={() => {
            setShareDialogOpen(true);
            track('UI', 'Opened', 'Share');
          }}
          onRename={(next) => {
            const prev = diagramName.trim();
            const nextTrim = next.trim();
            setDiagramName(next);
            // Keep the Explorer panel's row for THIS diagram in sync —
            // autosave persists the name, but the in-memory list would
            // otherwise show the old name until a reload re-fetched it.
            if (nextTrim && diagramId)
              setDiagramList((prev) =>
                prev.map((d) => (d.id === diagramId ? { ...d, name: nextTrim } : d)),
              );
            if (nextTrim && nextTrim !== prev) track('Diagram', 'Renamed');
          }}
        />
      )}
      <EditorTabDialogs />
      <EditorCanvasHost />
      {embedMode ? (
        // Embed chrome (spec/33): the link-out badge + a minimal tab
        // switcher replace the full TabBar. Same selection clears as
        // the TabBar's onSelect so element state never leaks across a
        // tab switch.
        <EmbedChrome
          tabs={tabs}
          activeId={activeId}
          shareCode={sessionShareCode}
          onSelectTab={(id) => {
            setActiveId(id);
            setSelectedId(null);
            setMultiSelectedIds(new Set());
            setEditingId(null);
            setFormatSourceId(null);
            setGroupSourceId(null);
          }}
        />
      ) : null}
      {anyWelcomeOpen || zenMode || embedMode ? null : (
        <TabBar
          tabs={tabs}
          activeId={activeId}
          onMoveTabToFolder={moveTabToFolder}
          onRemoveTabFromFolder={removeTabFromFolder}
          onRenameFolder={renameTabFolder}
          activeTabHasContent={activeTab.elements.length > 0}
          onSelect={(id) => {
            setActiveId(id);
            setSelectedId(null);
            setMultiSelectedIds(new Set());
            setEditingId(null);
            setFormatSourceId(null);
            setGroupSourceId(null);
          }}
          onAdd={addTab}
          onRename={renameTab}
          onDuplicate={duplicateTab}
          onDelete={deleteTab}
          onClearContent={clearTabContent}
          onImportTab={() => setImportOpen(true)}
          onExportTab={() => {
            setExportScope('tab');
            setExportOpen(true);
          }}
          timer={activeTab.timer ?? null}
          vote={activeTab.vote ?? null}
          onStartTimer={startTimer}
          onPauseTimer={pauseTimer}
          onResumeTimer={resumeTimer}
          onResetTimer={resetTimer}
          onClearTimer={clearTimer}
          onStartVote={startVote}
          onEndVote={endVote}
          onRevealVote={revealVote}
          onClearVote={clearVote}
          otherDiagrams={
            // Tab linking is a server-side row insert (spec/17), so neither an
            // offline diagram's tabs nor an offline destination can take part
            // (spec/76) — empty list disables the menu entry.
            isOffline
              ? []
              : diagramList.filter((d) => d.id !== diagramId && d.ownerId !== OFFLINE_OWNER_ID)
          }
          onCopyTabTo={linkActiveTabTo}
          onToggleLockTab={toggleActiveTabLock}
          onReorder={reorderTabs}
          readOnly={isReadOnly}
          renameActiveNonce={renameTabNonce}
          participantsByTab={participantsByTab}
          selfId={selfParticipant.id}
          selfRole={sessionRole}
          onOpenShortcuts={() => {
            setShortcutsOpen(true);
            track('UI', 'Opened', 'Shortcuts');
          }}
          onOpenSettings={() => {
            // Preferences are user-scoped, not diagram-scoped, so
            // view-role visitors can still flip them for their own
            // browser (e.g. opt out of telemetry).
            setSettingsOpen(true);
            track('UI', 'Opened', 'Settings');
          }}
          onOpenSearch={() => {
            setSearchOpen(true);
            // Element search walks local tab state; pull every
            // not-yet-visited tab's content so matches cover the
            // whole diagram (spec/09 "Search panel"). Best-effort
            // and fire-and-forget: results refresh as tabs land.
            void loadAllTabs();
          }}
          // Canvas right-click (desktop) + long-press (touch) open the active
          // tab's menu with the canvas sections folded in, rendered by the
          // TabBar so it reuses every tab handler. Element / multi context
          // menus stay on EditorContextMenu below.
          canvasMenu={contextMenu?.mode === 'canvas' ? contextMenu : null}
          onCloseCanvasMenu={closeContextMenu}
          canvasActions={{
            onChangeTheme: () => {
              setCanvasThemeTab('theme');
              track('UI', 'Opened', 'ThemePicker');
            },
            onChangeCanvas: () => {
              setCanvasThemeTab('canvas');
              track('UI', 'Opened', 'CanvasStyle');
            },
            onAutoAlign: autoAlignTab,
            onAutoLayout: autoLayoutTab,
            font: activeTab.font ?? null,
            onApplyFontToAll: applyTabFontToAll,
            onSetFont: setTabFont,
            defaultTextSize: activeTab.defaultTextSize,
            onSetDefaultTextSize: setTabDefaultTextSize,
          }}
        />
      )}
      <EditorSearchPanel />
      <EditorModals />
      <EditorAnchoredPopovers />
      <EditorContextMenuHost />
      <EditorElementDialogs />
      {/* Interactive editor tour (spec/79): renders nothing unless the /new
          wizard's "Show me around" handoff flag is pending. */}
      <TourHost />

      {/* Guest sign-in nudge (spec/36), delayed ~5 min. Lifted above
          the 48px tab bar (pb-16) and over the canvas chrome (z-[var(--z-overlay)]). */}
      {showSignInBanner ? (
        <SignInBanner
          onDismiss={dismissSignIn}
          placementClassName="bottom-0 z-[var(--z-overlay)] pb-16"
        />
      ) : null}
      {/* Empty-canvas hint (spec/14) — replaces the old centre-of-canvas card
          with a subdued, dismissible bottom banner so a blank diagram reads as
          intentionally blank. */}
      {showEmptyCanvasBanner ? (
        <EmptyCanvasBanner
          tabName={activeTab.name}
          readOnly={isReadOnly}
          onQuickStart={openTemplatePicker}
        />
      ) : null}
      {/* Offer to match the editor chrome to the active tab's theme
          (dark theme -> dark mode, light theme -> light mode). Hidden in
          zen / embed like the other floating prompts, and yields the
          bottom-centre slot to the sign-in / empty-canvas banners. */}
      {zenMode || embedMode || showSignInBanner || showEmptyCanvasBanner ? null : (
        <ThemeModeBanner themeId={activeTab.theme} />
      )}
      {/* Shift hint (spec/09): names what holding Shift does right now.
          Suppressed while a mode banner owns the top slot. */}
      <ShiftHintBanner
        drag={drag}
        selectedKind={shiftSelectedKind}
        hasElements={activeTab.elements.length > 0}
        suppressed={
          canvasTool === 'format' ||
          formatSourceId !== null ||
          groupSourceId !== null ||
          pendingDraw !== null
        }
      />
    </div>
  );
}
