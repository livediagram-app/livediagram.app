'use client';

// The editor's two bars (docs/specs/007-editor/editor-app.md): the site header across the top and the tab bar, its
// footer. Each is the JSX EditorView lays across both panes (docs/specs/007-editor/split-view.md), or null where it
// is hidden: zen mode (docs/specs/007-editor/zen-mode.md), an embed (docs/specs/013-workspace/embeds.md) and, for
// the tab bar, the welcome flow. Plain functions that return elements, called in EditorView's render, so the tree is
// the one EditorView drew inline.
import type { VisibilityActions } from '@liveworkspace/workbench/components/chrome/useVisibilityActions';
import type { ReactNode } from 'react';
import { openSearchWithPrefetch } from '@liveworkspace/workbench/lib/open-search';
import { track } from '@/lib/telemetry';
import { appHrefOfPlace } from '@/lib/workbench/workspace-place';
import { PlanCornerActions } from '@/components/chrome/EditorHeader';
import { TabBar } from '@/components/chrome/TabBar';
import { LandscapeBarFold } from '@/components/chrome/LandscapeBars';
import { WorkbenchBackButton, WorkbenchOpenLink } from '@/components/chrome/WorkbenchChrome';
import { AreaErrorBoundary } from '@/components/primitives/AreaErrorBoundary';
import type { useEditorContext } from './EditorContext';

type EditorContextValue = ReturnType<typeof useEditorContext>;

// The project in a full tab, by its link when the frame opened it by one.
const workbenchProjectHref = (projectId: string, shareCode: string | null) =>
  appHrefOfPlace({ kind: 'project', projectId, tabId: null, shareCode });

// The site header. Zen / focus mode (docs/specs/007-editor/zen-mode.md) hides it entirely so the
// canvas gets the full height; embeds (docs/specs/013-workspace/embeds.md) never show it. Side by
// side (docs/specs/007-editor/split-view.md) lays it across both panes.
export function renderEditorHeader(
  ctx: EditorContextValue,
  view: {
    isOffline: boolean;
    headerCommunity: boolean;
    onTakeOffline: (() => void) | undefined;
    visibilityActions: VisibilityActions | undefined;
  },
): ReactNode {
  const {
    zenMode,
    appChrome,
    anyWelcomeOpen,
    canShareProject,
    hydrated,
    projectShareable,
    projectTeamId,
    projectId,
    sessionCommunity,
    makeCopy,
    copying,
    openSettingsOn,
    setShareDialogOpen,
  } = ctx;
  // Experiment (no header bar): no bar across the top. Share (or Share Form) and the account float in a card at the
  // canvas's top right (EditorCornerActions); the plan's name and badges go, the logo leads the menu box
  // (ToolbarExplorerButton).
  return zenMode || !appChrome ? null : (
    <AreaErrorBoundary area="Header" fallback="panel">
      <PlanCornerActions
        showShare={canShareProject && hydrated && !anyWelcomeOpen}
        shareable={projectShareable}
        // The Share button's colour reads the plan's visibility, as the header's badges did.
        visibility={{
          team: !!projectTeamId,
          offline: view.isOffline,
          community: view.headerCommunity,
        }}
        // Visitors see "Make a copy" instead of "Share" (a joined team member is no visitor). Hidden through the
        // welcome flow and hydration; a Community visitor gets it from the Community bar instead.
        onMakeCopy={
          !canShareProject && hydrated && !anyWelcomeOpen && projectId && !sessionCommunity
            ? () => void makeCopy()
            : undefined
        }
        copying={copying}
        onTakeOffline={view.onTakeOffline}
        visibilityActions={view.visibilityActions}
        onOpenAccount={() => openSettingsOn('account')}
        onOpenShare={() => {
          setShareDialogOpen(true);
          track('UI', 'Opened', 'Share');
        }}
      />
    </AreaErrorBoundary>
  );
}

// The tab bar, the editor's footer. Hidden through the welcome flow, in zen mode and in embeds.
// Side by side (docs/specs/007-editor/split-view.md) lays it across both panes, like the header.
export function renderEditorTabBar(
  ctx: EditorContextValue,
  {
    selectTab,
    barsShown,
  }: {
    selectTab: (id: string) => void;
    barsShown: boolean;
  },
): ReactNode {
  const {
    anyWelcomeOpen,
    zenMode,
    embedMode,
    workbench,
    projectId,
    tabs,
    activeId,
    activeTab,
    openCollaborators,
    moveTabToFolder,
    removeTabFromFolder,
    setFolderColour,
    renameTabFolder,
    addTab,
    renameTab,
    duplicateTab,
    deleteTab,
    clearTabContent,
    setImportOpen,
    trackerImport,
    setExportScope,
    setExportOpen,
    toggleActiveTabLock,
    reorderTabs,
    isStructureReadOnly,
    isOutOfScope,
    renameTabNonce,
    participantsByTab,
    selfParticipant,
    sessionRole,
    setSettingsOpen,
    setSearchOpen,
    loadAllTabs,
    contextMenu,
    closeContextMenu,
    pasteFromClipboard,
    hasClipboard,
  } = ctx;
  // A workspace frame's hooks: its Back, in the tab bar.
  const workbenchFrame = workbench?.frame ?? null;
  return anyWelcomeOpen || zenMode || embedMode ? null : (
    <LandscapeBarFold shown={barsShown}>
      <AreaErrorBoundary area="TabBar" fallback="panel">
        <TabBar
          workbenchBack={
            workbenchFrame
              ? (labelled) => (
                  <WorkbenchBackButton
                    onBack={workbenchFrame.back}
                    backTitle={workbenchFrame.backTitle}
                    labelled={labelled}
                  />
                )
              : undefined
          }
          workbenchLink={
            workbench && projectId
              ? (labelled) => (
                  <WorkbenchOpenLink
                    href={workbenchProjectHref(projectId, workbench.shareCode)}
                    labelled={labelled}
                  />
                )
              : undefined
          }
          tabs={tabs}
          activeId={activeId}
          // Clicking an avatar in a presence stack opens the Collaborators
          // modal (docs/specs/012-collaboration/collaborator-enhancements.md).
          onOpenCollaborators={openCollaborators}
          onMoveTabToFolder={moveTabToFolder}
          onRemoveTabFromFolder={removeTabFromFolder}
          onSetFolderColour={setFolderColour}
          onRenameFolder={renameTabFolder}
          activeTabHasContent={activeTab.elements.length > 0}
          onSelect={selectTab}
          onAdd={() => addTab()}
          onRename={renameTab}
          onDuplicate={duplicateTab}
          onDelete={deleteTab}
          onConnectAgain={(id) => void ctx.connectedTabs.connectAgainTab(id)}
          onClearContent={() => void clearTabContent()}
          onImportTab={() => setImportOpen(true)}
          canImportFromTool={trackerImport.canImport}
          onExportTab={() => {
            setExportScope('tab');
            setExportOpen(true);
          }}
          onToggleLockTab={toggleActiveTabLock}
          onReorder={reorderTabs}
          // A tab-scoped visitor edits their tab's content at most, never the
          // tabs around it (docs/specs/013-workspace/tab-scoped-share-links.md).
          readOnly={isStructureReadOnly}
          isOutOfScope={isOutOfScope}
          renameActiveNonce={renameTabNonce}
          participantsByTab={participantsByTab}
          selfId={selfParticipant.id}
          selfRole={sessionRole}
          onOpenSettings={() => {
            // Preferences are user-scoped, not project-scoped, so
            // view-role visitors can still flip them for their own
            // browser (e.g. opt out of telemetry).
            setSettingsOpen(true);
            track('UI', 'Opened', 'Settings');
          }}
          onOpenSearch={() => openSearchWithPrefetch(setSearchOpen, loadAllTabs)}
          // Canvas right-click (desktop) + long-press (touch) open the active
          // tab's menu with the canvas sections folded in, rendered by the
          // TabBar so it reuses every tab handler. Element / multi context
          // menus stay on EditorContextMenu below.
          canvasMenu={contextMenu?.mode === 'canvas' ? contextMenu : null}
          onCloseCanvasMenu={closeContextMenu}
          canvasActions={{
            // Paste straight from the empty-canvas right-click (docs/specs/008-canvas/canvas-and-palette.md).
            onPaste: () => pasteFromClipboard(),
            canPaste: hasClipboard,
          }}
        />
      </AreaErrorBoundary>
    </LandscapeBarFold>
  );
}
