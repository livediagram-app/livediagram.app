'use client';

// The editor view's two bars: the site header and the tab bar (its footer). Built here and handed to
// SplitViewFrame by EditorView, which lays them across both panes side by side
// (docs/specs/007-editor/split-view.md). Plain functions over the editor context, not components, so the
// view's tree is what it always was; each is null where its bar is hidden.

import type { ReactNode } from 'react';
import { truncateName } from '@livedocuments/document';
import { openSearchWithPrefetch } from '@liveworkspace/workbench/lib/open-search';
import { track } from '@/lib/telemetry';
import { addToDocumentTargets } from '@/lib/add-to-document-targets';
import { EditorHeader } from '@/components/chrome/EditorHeader';
import { WorkbenchOpenLink } from '@/components/chrome/WorkbenchChrome';
import { appHrefOfPlace } from '@/lib/workbench/workspace-place';
import { TabBar } from '@/components/chrome/TabBar';
import { LandscapeBarFold } from '@/components/chrome/LandscapeBars';
import { RolePill } from '@/components/chrome/RoleIndicator';
import { AreaErrorBoundary } from '@/components/primitives/AreaErrorBoundary';
import type { useEditorContext } from './EditorContext';
import type { useRoleIndicator } from './useRoleIndicator';
import type { useSelectTab } from './useSelectTab';
import type { documentIsPublic } from '@/lib/community-public';

type EditorContextValue = ReturnType<typeof useEditorContext>;

// The document in a full tab, by its link when the frame opened it by one.
const workbenchDocumentHref = (documentId: string, shareCode: string | null) =>
  appHrefOfPlace({ kind: 'document', documentId, tabId: null, shareCode });

// The site header. Zen / focus mode (docs/specs/007-editor/zen-mode.md) hides it entirely so the
// canvas gets the full height; embeds (docs/specs/013-workspace/embeds.md) never show it. Side by
// side (docs/specs/007-editor/split-view.md) lays it across both panes.
export function editorViewHeader(
  ctx: EditorContextValue,
  view: {
    isOffline: boolean;
    headerCommunity: ReturnType<typeof documentIsPublic>;
    role: ReturnType<typeof useRoleIndicator>;
    isMobileViewport: boolean;
    landscapeShown: boolean;
  },
): ReactNode {
  const {
    slideDeck,
    anyWelcomeOpen,
    appChrome,
    copying,
    documentId,
    nameDocument,
    documentName,
    documentShareable,
    documentTeamId,
    hydrated,
    canShareDocument,
    isStructureReadOnly,
    makeCopy,
    openSettingsOn,
    setShareDialogOpen,
    renameDocumentNonce,
    zenMode,
    sessionCommunity,
  } = ctx;
  const { isOffline, headerCommunity, role, isMobileViewport } = view;
  return zenMode || !appChrome ? null : (
    <LandscapeBarFold shown={view.landscapeShown}>
      <AreaErrorBoundary area="Header" fallback="panel">
        <EditorHeader
          documentName={documentName}
          hideTitle={anyWelcomeOpen}
          showShare={canShareDocument && hydrated && !anyWelcomeOpen}
          shareable={documentShareable}
          community={headerCommunity}
          teamDocument={!!documentTeamId}
          offline={isOffline}
          // Visitors see "Make a copy" instead of "Share": same slot (a joined
          // team member is no visitor: the team's documents are theirs to share),
          // different action. Hidden during the welcome flow so the
          // first-paint chrome stays minimal, and during hydration so
          // we don't render the button before we know whether the user
          // is the owner. A Community visitor gets it from the Community bar instead.
          onMakeCopy={
            !canShareDocument && hydrated && !anyWelcomeOpen && documentId && !sessionCommunity
              ? () => void makeCopy()
              : undefined
          }
          copying={copying}
          readOnly={isStructureReadOnly}
          renameNonce={renameDocumentNonce}
          rolePill={<RolePill {...role} />}
          // docs/specs/012-collaboration/presentation-mode.md "The header's Present button": only
          // while the deck has a slide to show, on a desktop, once the document is up. Every role.
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
          onRename={(next) => {
            const prev = documentName.trim();
            // docs/specs/006-document/name-length.md: capped here so the header rename can't outrun the
            // limit the auto-namer and the Explorer renames both respect.
            const nextTrim = truncateName(next);
            nameDocument(nextTrim);
            if (nextTrim && nextTrim !== prev) track('Document', 'Renamed');
          }}
        />
      </AreaErrorBoundary>
    </LandscapeBarFold>
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
    documentId,
    documentList,
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
            onPaste: () => pasteFromClipboard(),
            canPaste: hasClipboard,
          }}
        />
      </AreaErrorBoundary>
    </LandscapeBarFold>
  );
}
