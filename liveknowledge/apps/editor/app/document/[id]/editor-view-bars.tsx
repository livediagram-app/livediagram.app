'use client';

// The editor view's two bars: the site header and the bottom bar (its footer). Built here and handed to
// SplitViewFrame by EditorView, which lays them across both panes side by side
// (docs/specs/007-editor/split-view.md); each renders nothing where its bar is hidden.

import { CUT_FROM_FORK } from '@/lib/not-in-liveknowledge';
import type { VisibilityActions } from '@liveworkspace/workbench/components/chrome/useVisibilityActions';
import { memo } from 'react';
import type { Tab } from '@liveknowledge/document';
import { withStableEventProps } from '@liveworkspace/workbench/components/primitives/withStableEventProps';
import { openSearchWithPrefetch } from '@liveworkspace/workbench/lib/open-search';
import { track } from '@/lib/telemetry';
import { addToDocumentTargets } from '@/lib/add-to-document-targets';
import { EditorCornerActions } from '@liveworkspace/workbench/components/chrome/EditorCornerActions';
import { ApprovalBadge } from '@liveworkspace/explorer/approvals';
import { WorkbenchOpenLink } from '@/components/chrome/WorkbenchChrome';
import { appHrefOfPlace } from '@/lib/workbench/workspace-place';
import { BottomBar } from '@/components/chrome/BottomBar';
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
// document, the same header and tabs) renders neither (docs/specs/007-editor/blueprints/typing.md "Performance
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
          CUT_FROM_FORK && hydrated && !anyWelcomeOpen && !isMobileViewport && slideCount > 0
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

// The tab list as the page tree reads it: a typing commit changes a tab's writing (its `elements` and `articles`),
// never its name, parent, lock or place, so a list whose tabs differ only there is the same list to the tree.
const TAB_CONTENT = new Set(['elements', 'articles']);
export function sameTabsForBar(a: readonly Tab[], b: readonly Tab[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every((x, i) => sameTabExcept(x, b[i]!, TAB_CONTENT));
}

// The bottom bar, the editor's footer: Tools, Settings and the appearance. The pages are the page tree, down the
// editor's left (components/page-tree). Hidden through the welcome flow, in zen mode and in embeds. Side by side
// (docs/specs/007-editor/split-view.md) lays it across both panes, like the header.
function EditorViewFooterBar(view: { isOffline: boolean; landscapeShown: boolean }) {
  const chrome = useEditorChromeStore();
  const hidden = useEditorChrome((s) => s.anyWelcomeOpen || s.zenMode || s.embedMode);
  const tabCount = useEditorChrome((s) => s.tabs.length);
  const activeTabHasContent = useEditorChrome((s) => s.activeTab.elements.length > 0);
  const activeTabLocked = useEditorChrome((s) => s.activeTab.locked === true);
  const documentId = useEditorChrome((s) => s.documentId);
  const documentList = useEditorChrome((s) => s.documentList);
  const workbenchShareCode = useEditorChrome((s) => s.workbench?.shareCode ?? null);
  const inWorkbench = useEditorChrome((s) => s.workbench !== null);
  const isOwner = useEditorChrome((s) => s.isOwner);
  // A tab-scoped visitor edits their page's writing at most, never the pages around it
  // (docs/specs/013-workspace/tab-scoped-share-links.md); a Participant or a Viewer changes no page.
  const readOnly = useEditorChrome((s) => s.isStructureReadOnly);
  const selfId = useEditorChrome((s) => s.selfParticipant.id);
  const canvasMenu = useEditorChrome((s) =>
    s.contextMenu?.mode === 'canvas' ? s.contextMenu : null,
  );
  const hasClipboard = useEditorChrome((s) => s.hasClipboard);
  // Version History (docs/specs/006-document/version-history.md "In the editor"): the gate's own slices.
  const hydrated = useEditorChrome((s) => s.hydrated);
  const communityVisitor = useEditorChrome((s) => s.sessionCommunity !== null);
  const { isOffline } = view;
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
  const close = () => chrome.get().closeContextMenu();
  return (
    <LandscapeBarFold shown={view.landscapeShown}>
      <AreaErrorBoundary area="TabBar" fallback="panel">
        <BottomBar
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
          // Canvas right-click (desktop) + long-press (touch) open the current page's menu with the canvas sections
          // folded in. Element / multi context menus stay on EditorContextMenu below.
          canvasMenu={canvasMenu}
          onCloseCanvasMenu={close}
          canvasActions={{
            // Paste straight from the empty-canvas right-click (docs/specs/008-canvas/canvas-and-palette.md).
            onPaste: () => chrome.get().pasteFromClipboard(),
            canPaste: hasClipboard,
          }}
          pageMenu={
            readOnly
              ? undefined
              : {
                  canDelete: tabCount > 1,
                  canClearContent: activeTabHasContent && !activeTabLocked,
                  locked: activeTabLocked,
                  selfId,
                  otherDocuments: addToDocumentTargets({
                    documentId,
                    documentList,
                    isOffline,
                    workbench: inWorkbench,
                    isOwner,
                  }),
                  // The page is renamed in its row of the page tree.
                  onRename: () => {
                    close();
                    chrome.get().requestRenameTab();
                  },
                  onDuplicate: () => {
                    close();
                    chrome.get().duplicateTab(chrome.get().activeId);
                  },
                  onClearContent: () => {
                    close();
                    void chrome.get().clearTabContent();
                  },
                  onImport: () => {
                    close();
                    chrome.get().setImportOpen(true);
                  },
                  onExport: () => {
                    close();
                    chrome.get().setExportScope('tab');
                    chrome.get().setExportOpen(true);
                  },
                  onCopyTo: async (target) => {
                    await chrome.get().linkActiveTabTo(target);
                    close();
                  },
                  onToggleLock: () => {
                    close();
                    chrome.get().toggleActiveTabLock();
                  },
                  onDelete: () => {
                    close();
                    void chrome.get().deleteTab(chrome.get().activeId);
                  },
                }
          }
        />
      </AreaErrorBoundary>
    </LandscapeBarFold>
  );
}
export const EditorViewFooter = withStableEventProps(EditorViewFooterBar);
