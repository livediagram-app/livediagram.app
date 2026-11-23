'use client';

// The editor view's two bars: the site header and the tab bar (its footer). Built here and handed to
// SplitViewFrame by EditorView, which lays them across both panes side by side
// (docs/specs/007-editor/split-view.md); each renders nothing where its bar is hidden.

import type { VisibilityActions } from '@liveworkspace/workbench/components/chrome/useVisibilityActions';
import { memo } from 'react';
import type { Tab } from '@livedocuments/document';
import { withStableEventProps } from '@liveworkspace/workbench/components/primitives/withStableEventProps';
import { openSearchWithPrefetch } from '@liveworkspace/workbench/lib/open-search';
import { track } from '@/lib/telemetry';
import { addToDocumentTargets } from '@/lib/add-to-document-targets';
import { EditorCornerActions } from '@liveworkspace/workbench/components/chrome/EditorCornerActions';
import { ApprovalBadge } from '@liveworkspace/explorer/approvals';
import { WorkbenchOpenLink } from '@/components/chrome/WorkbenchChrome';
import { appHrefOfPlace } from '@/lib/workbench/workspace-place';
// The tab bar with Connect a File beside its + (connected-tabs.md "From the tab bar").
import { TabBarWithConnect } from '@/components/connect/useConnectFileDialog';
import { LandscapeBarFold } from '@/components/chrome/LandscapeBars';
import { offersHistory, openHistoryFromFooter } from '@/components/versions/history-tools-item';
import { AreaErrorBoundary } from '@/components/primitives/AreaErrorBoundary';
import { useEditorChrome, useEditorChromeStore } from './EditorContext';
import { sameTabExcept } from './editor-chrome-equal';

// The document in a full tab, by its link when the frame opened it by one.
const workbenchDocumentHref = (documentId: string, shareCode: string | null) =>
  appHrefOfPlace({ kind: 'document', documentId, tabId: null, shareCode });

// The site header. Zen / focus mode (docs/specs/007-editor/zen-mode.md) hides it entirely so the
// canvas gets the full height; embeds (docs/specs/013-workspace/embeds.md) never show it. Side by
// side (docs/specs/007-editor/split-view.md) lays it across both panes.
//
// Each bar reads the chrome store one slice at a time and is memoised on its props, so a typing commit (a new
// document, the same header and tabs) renders neither (docs/specs/007-editor/blueprints/flashcards.md "Performance
// and limits"). Its handlers read the newest view-model when they run.
export const EditorViewHeader = memo(function EditorViewHeader(view: {
  isOffline: boolean;
  onTakeOffline?: (() => void) | undefined;
  visibilityActions?: VisibilityActions | undefined;
  headerCommunity: boolean;
  isMobileViewport: boolean;
  landscapeShown: boolean;
}) {
  const chrome = useEditorChromeStore();
  const hidden = useEditorChrome((s) => s.zenMode || !s.appChrome);
  const anyWelcomeOpen = useEditorChrome((s) => s.anyWelcomeOpen);
  const documentId = useEditorChrome((s) => s.documentId);
  const documentShareable = useEditorChrome((s) => s.documentShareable);
  const hydrated = useEditorChrome((s) => s.hydrated);
  const canShareDocument = useEditorChrome((s) => s.canShareDocument);
  const communityVisitor = useEditorChrome((s) => s.sessionCommunity !== null);
  const copying = useEditorChrome((s) => s.copying);
  const teamDocument = useEditorChrome((s) => !!s.documentTeamId);
  const slideCount = useEditorChrome((s) => s.slideDeck.runnable.length);
  const startingDeck = useEditorChrome((s) => s.slideDeck.startingDeck);
  const { isMobileViewport } = view;
  if (hidden) return null;
  // Experiment: no header bar. The name and its visibility badge are gone; Copy, Present, Share and the account float in a
  // card at the top right.
  return (
    <AreaErrorBoundary area="Header" fallback="panel">
      <EditorCornerActions
        approval={<ApprovalBadge corner />}
        showShare={canShareDocument && hydrated && !anyWelcomeOpen}
        shareable={documentShareable}
        // The Share button's colour reads the document's visibility, as the header's badge did.
        visibility={{
          team: teamDocument,
          offline: view.isOffline,
          community: view.headerCommunity,
        }}
        // Visitors see "Make a copy" instead of "Share" (a joined team member is no visitor). Hidden during the
        // welcome flow and hydration; a Community visitor gets it from the Community bar instead.
        onMakeCopy={
          !canShareDocument && hydrated && !anyWelcomeOpen && documentId && !communityVisitor
            ? () => void chrome.get().makeCopy()
            : undefined
        }
        onTakeOffline={view.onTakeOffline}
        visibilityActions={view.visibilityActions}
        copying={copying}
        copyDescription="Duplicate this document into your own files."
        // docs/specs/012-collaboration/presentation-mode.md "The header's Present button".
        present={
          hydrated && !anyWelcomeOpen && !isMobileViewport && slideCount > 0
            ? {
                slideCount,
                starting: startingDeck,
                onPresent: () => {
                  track('UI', 'Opened', 'HeaderPresent');
                  void chrome.get().slideDeck.start();
                },
              }
            : undefined
        }
        onOpenAccount={() => chrome.get().openSettingsOn('account')}
        onOpenShare={() => {
          chrome.get().setShareDialogOpen(true);
          track('UI', 'Opened', 'Share');
        }}
      />
    </AreaErrorBoundary>
  );
});

// The tab list as the tab bar reads it: a typing commit changes a tab's writing (its `elements` and `articles`),
// never its name, folder, lock or place, so a list whose tabs differ only there is the same list to the bar.
const TAB_CONTENT = new Set(['elements', 'articles']);
export function sameTabsForBar(a: readonly Tab[], b: readonly Tab[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every((x, i) => sameTabExcept(x, b[i]!, TAB_CONTENT));
}

// The tab bar, the editor's footer. Hidden through the welcome flow, in zen mode and in embeds.
// Side by side (docs/specs/007-editor/split-view.md) lays it across both panes, like the header.
function EditorViewFooterBar(view: {
  isOffline: boolean;
  landscapeShown: boolean;
  onSelectTab: (tabId: string) => void;
}) {
  const chrome = useEditorChromeStore();
  const hidden = useEditorChrome((s) => s.anyWelcomeOpen || s.zenMode || s.embedMode);
  const tabs = useEditorChrome((s) => s.tabs, sameTabsForBar);
  const activeId = useEditorChrome((s) => s.activeId);
  const followingId = useEditorChrome((s) => s.followMe.followingId);
  const followerCount = useEditorChrome((s) => s.followMe.followerCount);
  const activeTabHasContent = useEditorChrome((s) => s.activeTab.elements.length > 0);
  const documentId = useEditorChrome((s) => s.documentId);
  const documentList = useEditorChrome((s) => s.documentList);
  const workbenchShareCode = useEditorChrome((s) => s.workbench?.shareCode ?? null);
  const inWorkbench = useEditorChrome((s) => s.workbench !== null);
  const isOwner = useEditorChrome((s) => s.isOwner);
  const readOnly = useEditorChrome((s) => s.isStructureReadOnly);
  // `isOutOfScope` answers from the session's tab scope and is made afresh only when the scope changes (useTabScope),
  // so the bar subscribes to the function itself: a scope set after mount (a tab-scoped link) marks the other tabs.
  // A `chrome.get()` here was kept at its first value by the React Compiler (Work Tracker 946).
  const isOutOfScope = useEditorChrome((s) => s.isOutOfScope);
  const renameTabNonce = useEditorChrome((s) => s.renameTabNonce);
  const participantsByTab = useEditorChrome((s) => s.participantsByTab);
  const selfId = useEditorChrome((s) => s.selfParticipant.id);
  const sessionRole = useEditorChrome((s) => s.sessionRole);
  const canvasMenu = useEditorChrome((s) =>
    s.contextMenu?.mode === 'canvas' ? s.contextMenu : null,
  );
  const hasClipboard = useEditorChrome((s) => s.hasClipboard);
  // Version History (docs/specs/006-document/version-history.md "In the editor"): the gate's own slices.
  const hydrated = useEditorChrome((s) => s.hydrated);
  const communityVisitor = useEditorChrome((s) => s.sessionCommunity !== null);
  const { isOffline, onSelectTab } = view;
  if (hidden) return null;
  // The bar is already hidden in an embed and behind a welcome, so those two answer false here.
  const history = offersHistory({
    documentId,
    hydrated,
    offline: isOffline,
    embed: false,
    workbench: inWorkbench,
    welcomeOpen: false,
    community: communityVisitor,
  });
  return (
    <LandscapeBarFold shown={view.landscapeShown}>
      <AreaErrorBoundary area="TabBar" fallback="panel">
        <TabBarWithConnect
          workbenchLink={
            inWorkbench && documentId
              ? (labelled) => (
                  <WorkbenchOpenLink
                    href={workbenchDocumentHref(documentId, workbenchShareCode)}
                    labelled={labelled}
                  />
                )
              : undefined
          }
          tabs={tabs}
          activeId={activeId}
          // Clicking an avatar in a presence stack opens the Collaborators
          // modal (docs/specs/012-collaboration/collaborator-enhancements.md), which is where Follow (docs/specs/012-collaboration/follow-me-viewport.md) lives.
          followingId={followingId}
          followerCount={followerCount}
          onOpenCollaborators={(...a) => chrome.get().openCollaborators(...a)}
          onMoveTabToFolder={(...a) => chrome.get().moveTabToFolder(...a)}
          onRemoveTabFromFolder={(...a) => chrome.get().removeTabFromFolder(...a)}
          onSetFolderColour={(...a) => chrome.get().setFolderColour(...a)}
          onRenameFolder={(...a) => chrome.get().renameTabFolder(...a)}
          activeTabHasContent={activeTabHasContent}
          onSelect={onSelectTab}
          onAdd={() => chrome.get().addTab()}
          onRename={(...a) => chrome.get().renameTab(...a)}
          onDuplicate={(...a) => chrome.get().duplicateTab(...a)}
          onDelete={(...a) => chrome.get().deleteTab(...a)}
          onConnectAgain={(id) => void chrome.get().connectedTabs.connectAgainTab(id)}
          onClearContent={() => void chrome.get().clearTabContent()}
          onImportTab={() => chrome.get().setImportOpen(true)}
          onExportTab={() => {
            chrome.get().setExportScope('tab');
            chrome.get().setExportOpen(true);
          }}
          otherDocuments={addToDocumentTargets({
            documentId,
            documentList,
            isOffline,
            workbench: inWorkbench,
            isOwner,
          })}
          onCopyTabTo={(...a) => chrome.get().linkActiveTabTo(...a)}
          onToggleLockTab={(...a) => chrome.get().toggleActiveTabLock(...a)}
          onReorder={(...a) => chrome.get().reorderTabs(...a)}
          // A tab-scoped visitor edits their tab's content at most, never the
          // tabs around it (docs/specs/013-workspace/tab-scoped-share-links.md).
          readOnly={readOnly}
          isOutOfScope={isOutOfScope}
          renameActiveNonce={renameTabNonce}
          participantsByTab={participantsByTab}
          selfId={selfId}
          selfRole={sessionRole}
          onOpenSettings={() => {
            // Preferences are user-scoped, not document-scoped, so
            // view-role visitors can still flip them for their own
            // browser (e.g. opt out of telemetry).
            chrome.get().setSettingsOpen(true);
            track('UI', 'Opened', 'Settings');
          }}
          onOpenSearch={() =>
            openSearchWithPrefetch(chrome.get().setSearchOpen, chrome.get().loadAllTabs)
          }
          // History, between Search and Settings, on a document stored on the server, for every role.
          onOpenHistory={history ? () => openHistoryFromFooter(chrome.get().activeId) : undefined}
          // Canvas right-click (desktop) + long-press (touch) open the active
          // tab's menu with the canvas sections folded in, rendered by the
          // TabBar so it reuses every tab handler. Element / multi context
          // menus stay on EditorContextMenu below.
          canvasMenu={canvasMenu}
          onCloseCanvasMenu={() => chrome.get().closeContextMenu()}
          canvasActions={{
            // Paste straight from the empty-canvas right-click (docs/specs/008-canvas/canvas-and-palette.md).
            onPaste: () => chrome.get().pasteFromClipboard(),
            canPaste: hasClipboard,
          }}
        />
      </AreaErrorBoundary>
    </LandscapeBarFold>
  );
}
export const EditorViewFooter = withStableEventProps(EditorViewFooterBar);
