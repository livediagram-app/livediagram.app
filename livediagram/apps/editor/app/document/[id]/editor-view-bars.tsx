'use client';

// The editor view's two bars: the site header and the tab bar (its footer). Built here and handed to
// SplitViewFrame by EditorView, which lays them across both panes side by side
// (docs/specs/007-editor/split-view.md). Plain functions over the editor context, not components, so the
// view's tree is what it always was; each is null where its bar is hidden.

import type { ReactNode } from 'react';
import { openSearchWithPrefetch } from '@liveworkspace/workbench/lib/open-search';
import { track } from '@/lib/telemetry';
import { addToDocumentTargets } from '@/lib/add-to-document-targets';
import { EditorCornerActions } from '@liveworkspace/workbench/components/chrome/EditorCornerActions';
import type { VisibilityActions } from '@liveworkspace/workbench/components/chrome/useVisibilityActions';
import { ApprovalBadge } from '@liveworkspace/explorer/approvals';
import { WorkbenchOpenLink } from '@/components/chrome/WorkbenchChrome';
import { appHrefOfPlace } from '@/lib/workbench/workspace-place';
import { TabBar } from '@/components/chrome/TabBar';
import { LandscapeBarFold } from '@/components/chrome/LandscapeBars';
// Each major area fails on its own and reports which one it was (docs/specs/017-telemetry/telemetry.md).
import { AreaErrorBoundary } from '@/components/primitives/AreaErrorBoundary';
import type { useEditorContext } from './EditorContext';
import type { useSelectTab } from './useSelectTab';
import type { documentIsPublic } from '@/lib/community-public';

type EditorContextValue = ReturnType<typeof useEditorContext>;

// The document in a full tab, by its link when the frame opened it by one.
const workbenchDocumentHref = (documentId: string, shareCode: string | null) =>
  appHrefOfPlace({ kind: 'document', documentId, tabId: null, shareCode });

// The site header. Zen / focus mode (docs/specs/007-editor/zen-mode.md) hides it entirely so the
// canvas gets the full height; embeds (docs/specs/013-workspace/embeds.md) never show it.
export function editorViewHeader(
  ctx: EditorContextValue,
  view: {
    isOffline: boolean;
    onTakeOffline: (() => void) | undefined;
    visibilityActions: VisibilityActions | undefined;
    headerCommunity: ReturnType<typeof documentIsPublic>;
    isMobileViewport: boolean;
    landscapeShown: boolean;
  },
): ReactNode {
  const {
    zenMode,
    appChrome,
    anyWelcomeOpen,
    canShareDocument,
    hydrated,
    documentShareable,
    documentId,
    sessionCommunity,
    makeCopy,
    copying,
    slideDeck,
    openSettingsOn,
    setShareDialogOpen,
  } = ctx;
  const { isMobileViewport } = view;
  // Experiment: no header bar. The name and its visibility badge are gone; Copy, Present, Share and the account float in a
  // card at the top right.
  return zenMode || !appChrome ? null : (
    <AreaErrorBoundary area="Header" fallback="panel">
      <EditorCornerActions
        approval={<ApprovalBadge corner />}
        showShare={canShareDocument && hydrated && !anyWelcomeOpen}
        shareable={documentShareable}
        // The Share button's words wear who can see the document; hovering it shows the legend.
        visibility={{
          team: !!ctx.documentTeamId,
          offline: view.isOffline,
          community: !!view.headerCommunity,
        }}
        // Visitors see "Make a copy" instead of "Share" (a joined team member is no visitor). Hidden during the
        // welcome flow and hydration; a Community visitor gets it from the Community bar instead.
        onMakeCopy={
          !canShareDocument && hydrated && !anyWelcomeOpen && documentId && !sessionCommunity
            ? () => void makeCopy()
            : undefined
        }
        onTakeOffline={view.onTakeOffline}
        visibilityActions={view.visibilityActions}
        copying={copying}
        copyDescription="Duplicate this canvas into your own files."
        // docs/specs/012-collaboration/presentation-mode.md "The header's Present button".
        present={
          hydrated && !anyWelcomeOpen && !isMobileViewport && slideDeck.runnable.length > 0
            ? {
                slideCount: slideDeck.runnable.length,
                starting: slideDeck.startingDeck,
                onPresent: () => {
                  track('UI', 'Opened', 'HeaderPresent');
                  void slideDeck.start();
                },
              }
            : undefined
        }
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
export function editorViewFooter(
  ctx: EditorContextValue,
  view: {
    isOffline: boolean;
    selectTab: ReturnType<typeof useSelectTab>;
    landscapeShown: boolean;
  },
): ReactNode {
  const {
    anyWelcomeOpen,
    zenMode,
    embedMode,
    workbench,
    documentId,
    tabs,
    activeId,
    followMe,
    openCollaborators,
    moveTabToFolder,
    removeTabFromFolder,
    renameTabFolder,
    activeTab,
    addTab,
    renameTab,
    duplicateTab,
    deleteTab,
    clearTabContent,
    setImportOpen,
    setExportScope,
    setExportOpen,
    documentList,
    isOwner,
    linkActiveTabTo,
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
  const { isOffline, selectTab } = view;
  return anyWelcomeOpen || zenMode || embedMode ? null : (
    <LandscapeBarFold shown={view.landscapeShown}>
      <AreaErrorBoundary area="TabBar" fallback="panel">
        <TabBar
          workbenchLink={
            workbench && documentId
              ? (labelled) => (
                  <WorkbenchOpenLink
                    href={workbenchDocumentHref(documentId, workbench.shareCode)}
                    labelled={labelled}
                  />
                )
              : undefined
          }
          tabs={tabs}
          activeId={activeId}
          // Clicking an avatar in a presence stack opens the Collaborators
          // modal (docs/specs/012-collaboration/collaborator-enhancements.md), which is where Follow (docs/specs/012-collaboration/follow-me-viewport.md) lives.
          followingId={followMe.followingId}
          followerCount={followMe.followerCount}
          onOpenCollaborators={openCollaborators}
          onMoveTabToFolder={moveTabToFolder}
          onRemoveTabFromFolder={removeTabFromFolder}
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
          onExportTab={() => {
            setExportScope('tab');
            setExportOpen(true);
          }}
          otherDocuments={addToDocumentTargets({
            documentId,
            documentList,
            isOffline,
            workbench: workbench !== null,
            isOwner,
          })}
          onCopyTabTo={linkActiveTabTo}
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
            // Preferences are user-scoped, not document-scoped, so
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
            onPaste: () =>
              pasteFromClipboard(
                undefined,
                contextMenu?.mode === 'canvas' ? (contextMenu.canvasPoint ?? null) : null,
              ),
            canPaste: hasClipboard,
          }}
        />
      </AreaErrorBoundary>
    </LandscapeBarFold>
  );
}
