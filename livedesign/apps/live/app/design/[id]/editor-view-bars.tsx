'use client';

// The editor view's two bars: the site header and the tab bar (its footer). Built here and handed to
// SplitViewFrame by EditorView, which lays them across both panes side by side
// (docs/specs/007-editor/split-view.md). Plain functions over the editor context, not components, so the
// view's tree is what it always was; each is null where its bar is hidden.

import type { VisibilityActions } from '@liveworkspace/workbench/components/chrome/useVisibilityActions';
import type { ReactNode } from 'react';
import { offersPrototype, PrototypeHeaderButton } from '@/components/chrome/PrototypeHeaderButton';
import { openSearchWithPrefetch } from '@liveworkspace/workbench/lib/open-search';
import { track } from '@/lib/telemetry';
import { addToDesignTargets } from '@/lib/add-to-design-targets';
import { EditorCornerActions } from '@liveworkspace/workbench/components/chrome/EditorCornerActions';
import { ApprovalBadge } from '@liveworkspace/explorer/approvals';
import { WorkbenchOpenLink } from '@/components/chrome/WorkbenchChrome';
import { appHrefOfPlace } from '@/lib/workbench/workspace-place';
// The tab bar with Connect a File beside its + (connected-tabs.md "From the tab bar").
import { TabBarWithConnect } from '@/components/chrome/TabBar';
import { LandscapeBarFold } from '@/components/chrome/LandscapeBars';
import { AreaErrorBoundary } from '@/components/primitives/AreaErrorBoundary';
import type { useEditorContext } from './EditorContext';
import type { useSelectTab } from './useSelectTab';

type EditorContextValue = ReturnType<typeof useEditorContext>;

// The design in a full tab, by its link when the frame opened it by one.
const workbenchDesignHref = (designId: string, shareCode: string | null) =>
  appHrefOfPlace({ kind: 'design', designId, tabId: null, shareCode });

// The site header. Zen / focus mode (docs/specs/007-editor/zen-mode.md) hides it entirely so the
// canvas gets the full height; embeds (docs/specs/013-workspace/embeds.md) never show it. Side by
// side (docs/specs/007-editor/split-view.md) lays it across both panes.
export function editorViewHeader(
  ctx: EditorContextValue,
  view: {
    isOffline: boolean;
    headerCommunity: boolean;
    onTakeOffline: (() => void) | undefined;
    visibilityActions: VisibilityActions | undefined;
  },
): ReactNode {
  const {
    anyWelcomeOpen,
    appChrome,
    copying,
    designId,
    designShareable,
    designTeamId,
    hydrated,
    canShareDesign,
    makeCopy,
    openSettingsOn,
    setShareDialogOpen,
    zenMode,
    sessionCommunity,
    activeTab,
    can,
  } = ctx;
  // Prototype (docs/specs/007-editor/wireframe-pages.md "Prototype mode"): on a wireframe tab, for every role.
  const prototype = offersPrototype(can, activeTab, anyWelcomeOpen) ? (
    <PrototypeHeaderButton />
  ) : undefined;
  // Experiment: no header bar. The name and its visibility badge are gone; Prototype, Copy, Share and the account float in a
  // card at the top right.
  return zenMode || !appChrome ? null : (
    <AreaErrorBoundary area="Header" fallback="panel">
      <EditorCornerActions
        approval={<ApprovalBadge corner />}
        leadAction={prototype}
        showShare={canShareDesign && hydrated && !anyWelcomeOpen}
        shareable={designShareable}
        // The Share button's colour reads the design's visibility, as the header's badge did.
        visibility={{
          team: !!designTeamId,
          offline: view.isOffline,
          community: view.headerCommunity,
        }}
        // Visitors see "Make a copy" instead of "Share" (a joined team member is no visitor). Hidden during the
        // welcome flow and hydration; a Community visitor gets it from the Community bar instead.
        onMakeCopy={
          !canShareDesign && hydrated && !anyWelcomeOpen && designId && !sessionCommunity
            ? () => void makeCopy()
            : undefined
        }
        onTakeOffline={view.onTakeOffline}
        visibilityActions={view.visibilityActions}
        copying={copying}
        copyDescription="Duplicate this design into your own files."
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
export function editorViewFooter(
  ctx: EditorContextValue,
  view: {
    isOffline: boolean;
    selectTab: ReturnType<typeof useSelectTab>;
    landscapeShown: boolean;
  },
): ReactNode {
  const {
    pasteFromClipboard,
    hasClipboard,
    activeId,
    activeTab,
    addTab,
    followMe,
    anyWelcomeOpen,
    embedMode,
    workbench,
    clearTabContent,
    closeContextMenu,
    contextMenu,
    deleteTab,
    designId,
    designList,
    duplicateTab,
    setImportOpen,
    isOwner,
    isStructureReadOnly,
    isOutOfScope,
    linkActiveTabTo,
    loadAllTabs,
    participantsByTab,
    renameTab,
    renameTabFolder,
    moveTabToFolder,
    removeTabFromFolder,
    setFolderColour,
    reorderTabs,
    selfParticipant,
    sessionRole,
    setExportOpen,
    setExportScope,
    setSearchOpen,
    setSettingsOpen,
    renameTabNonce,
    tabs,
    toggleActiveTabLock,
    zenMode,
    openCollaborators,
  } = ctx;
  const { isOffline, selectTab } = view;
  return anyWelcomeOpen || zenMode || embedMode ? null : (
    <LandscapeBarFold shown={view.landscapeShown}>
      <AreaErrorBoundary area="TabBar" fallback="panel">
        <TabBarWithConnect
          workbenchLink={
            workbench && designId
              ? (labelled) => (
                  <WorkbenchOpenLink
                    href={workbenchDesignHref(designId, workbench.shareCode)}
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
          onExportTab={() => {
            setExportScope('tab');
            setExportOpen(true);
          }}
          otherDesigns={addToDesignTargets({
            designId,
            designList,
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
            // Preferences are user-scoped, not design-scoped, so
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
