'use client';

import { contentAddBlocked } from '@/lib/editor-capabilities';
import { useTourSquare } from '@/hooks/editor/useTourSquare';
import { type Element, type Tab } from '@livehuddle/document';
import { useDoorToggle } from '@/hooks/canvas/useDoorToggle';
import { useStyleMemory } from '@/hooks/canvas/useStyleMemory';
import { getTheme } from '@/lib/themes';
import { connectionOf } from '@liveworkspace/workbench/components/connect/tab-connection';
import { deriveTabLoadState, patchTab } from '../editor-page-helpers';
import { useEditorHistory } from '../useEditorHistory';
import { useElementHelpers } from '../useElementHelpers';
import { useCollabDeepLink } from '../useCollabDeepLink';
import { activeElementsCommit } from '../active-elements-commit';
import type { EditorDocumentSlice } from './useEditorDocument';
import type { EditorHistorySlice } from './useEditorUndoState';
import type { EditorSelectionSlice } from './useEditorSelection';
import type { EditorToolsSlice } from './useEditorTools';
import type { EditorCollaborationSlice } from './useEditorCollaboration';
import type { EditorPersistenceSlice } from './useEditorPersistence';
import type { EditorCommentsSlice } from './useEditorComments';
import type { EditorViewportSlice } from './useEditorViewport';
import type { EditorFollowingSlice } from './useEditorFollowing';

// The edit gates (connected, read-only, loading), the active tab's commit, doors, style memory's recording
// commits, undo and redo, and the placement helpers. A slice of useEditorState (../useEditorState.ts): it takes
// the slices composed before it and returns its own, with `view`, its part of the editor's view-model.
export function useEditorEditing({
  fromDocument,
  fromHistory,
  fromSelection,
  fromTools,
  fromCollaboration,
  fromPersistence,
  fromComments,
  fromViewport,
  fromFollowing,
}: {
  fromDocument: EditorDocumentSlice;
  fromHistory: EditorHistorySlice;
  fromSelection: EditorSelectionSlice;
  fromTools: EditorToolsSlice;
  fromCollaboration: EditorCollaborationSlice;
  fromPersistence: EditorPersistenceSlice;
  fromComments: EditorCommentsSlice;
  fromViewport: EditorViewportSlice;
  fromFollowing: EditorFollowingSlice;
}) {
  const { documentId, hydrated, loadedTabIds, tabLoadErrors } = fromDocument;
  const { canHistoryRedo, canHistoryUndo, commitTabs, redoHistory, tickTabs, undoHistory } =
    fromHistory;
  const {
    activeId,
    formatSourceId,
    readSelection,
    selectionStore,
    setEditingId,
    setFormatSourceId,
    setMultiSelectedIds,
    setSelectedId,
  } = fromSelection;
  const { formatSettings } = fromTools;
  const { isReadOnly, participant } = fromCollaboration;
  const { tabsRef } = fromPersistence;
  const { activeTab, openActionPopover, openComments } = fromComments;
  const { getViewportCenter, scrollIntoView } = fromViewport;
  const { collabDeepLink } = fromFollowing;
  // --- Element-scoped history helpers (active-tab aware) -------------------

  // Lazy per-tab load gate (docs/specs/006-document/per-tab-storage.md). Until the active tab's content has
  // landed it's an empty placeholder, NOT its real server row. The canvas
  // shows a blocking overlay over this state — but that overlay only
  // captures POINTER events; window/document keyboard + paste listeners
  // (shape shortcuts, Cmd+V) sail past it. So an edit could land on the
  // placeholder, which then (a) makes the lazy fetch discard the real
  // server content as "user already edited" and (b) re-arms the autosave
  // to PUT the near-empty body over the real row — wiping it. Folding the
  // load state into editsBlocked blocks EVERY commit-based mutator
  // (keyboard, paste, AI, import, clear) at one chokepoint, not just the
  // pointer paths the overlay covers. 'ready' is the only editable state
  // (a loaded tab, a locally-created/peer-delivered tab with content, or
  // a dismissed template picker — see deriveTabLoadState).
  // A connected tab (liveworkspace/docs/specs/004-index/connected-tabs.md) holds no content: every edit is shut on it.
  const activeTabConnected = connectionOf(activeTab) !== null;
  const activeTabLoadState = deriveTabLoadState({
    hydrated,
    hasDocument: !!documentId,
    loaded: loadedTabIds.has(activeId),
    errored: tabLoadErrors.has(activeId),
    elementsLength: activeTab.elements.length,
    templateChosen: activeTab.templateChosen === true,
  });
  // A view-only session (a 'view' share role) is read-only: no element or tab mutation may land.
  // Folding the flags into one guard means every mutation helper
  // below stays blocked with a single check, and the interaction
  // starters (beginDrag, beginEdit, ...) layer on their own isReadOnly
  // checks so a viewer can still select and inspect.
  // A Participant commits too: every one of its commits passes participant.guardCommit.
  const editsBlocked =
    activeTabConnected ||
    (isReadOnly && !participant.participating) ||
    activeTabLoadState !== 'ready';
  // Everything but a Participant's own gestures stays shut to it (docs/specs/013-workspace/share-roles.md): the hooks
  // that write the tab's structure, or write without passing commit's guard, take this instead of editsBlocked.
  const structureBlocked = editsBlocked || isReadOnly;

  // An Inbox row opened this document at one element (docs/specs/013-workspace/inbox.md
  // §1): once the pinned tab is ready, select it, bring it into view and
  // open its popover. See useCollabDeepLink.
  useCollabDeepLink({
    link: collabDeepLink,
    hydrated,
    activeId,
    activeTabLoadState,
    elements: activeTab.elements,
    select: (id) => {
      setSelectedId(id);
      setMultiSelectedIds(new Set());
      setEditingId(null);
    },
    scrollIntoView,
    openActionPopover,
    openComments,
  });

  const commit = (mapElements: (els: Element[]) => Element[]) => {
    if (editsBlocked) return;
    // Read the LIVE elements (via tabsRef), not the render-time `activeTab`
    // closure. A deferred caller can run long after the render that created
    // this `commit` — e.g. the link-card unfurl resolves a few seconds
    // after the URL is set — and mapping over the stale snapshot would
    // write the element back as it was BEFORE the in-between edit, silently
    // dropping it (the bug where a link-card reset to "Add a link" once its
    // preview fetch landed).
    // A Participant's edit is checked against the live tab before it lands (guardCommit may refuse it with a
    // notice, so it runs once, here, not inside the update).
    if (participant.participating) {
      const liveTab = tabsRef.current.find((t) => t.id === activeId) ?? activeTab;
      const allowed = participant.guardCommit(liveTab, {
        ...liveTab,
        elements: mapElements(liveTab.elements),
      });
      if (!allowed) return;
      commitTabs((ts) => patchTab(ts, activeId, { elements: allowed.elements }));
      return;
    }
    // Mapped inside the update, from the tab as it is then (activeElementsCommit): a
    // drag's landed result or a peer's op queued after the last render is built on,
    // never written back over.
    commitTabs(activeElementsCommit(activeId, mapElements));
  };

  // A Door swung open or shut from Avatar mode (docs/specs/009-elements/room-builder.md "Opening and closing").
  const { toggleDoor } = useDoorToggle({
    elements: activeTab.elements,
    canSwing: participant.can.swingDoor,
    blocked: editsBlocked,
    commit,
  });

  // Style memory (docs/specs/008-canvas/quick-style-panel.md): what the panel or the context menu last
  // chose per element kind, applied to the next element the user draws. The
  // style hooks below get `commit` / `tickTabs` wrapped to record into it.
  const activeTheme = getTheme(activeTab.theme);
  const styleMemory = useStyleMemory({ documentId, theme: activeTheme });
  const liveActiveElements = () =>
    (tabsRef.current.find((t) => t.id === activeId) ?? activeTab).elements;
  const rememberingCommit = (mapElements: (els: Element[]) => Element[]) => {
    const before = liveActiveElements();
    commit(mapElements);
    if (!editsBlocked) styleMemory.recordEdit(before, mapElements(before));
  };
  const rememberingTickTabs = (mapTabs: (ts: Tab[]) => Tab[]) => {
    const beforeTabs = tabsRef.current;
    tickTabs(mapTabs);
    const before = beforeTabs.find((t) => t.id === activeId)?.elements;
    const after = mapTabs(beforeTabs).find((t) => t.id === activeId)?.elements;
    if (before && after && !editsBlocked) styleMemory.recordEdit(before, after);
  };

  // As structureBlocked, for the creation hooks: shut to a Participant.
  const structureCreateBlocked = editsBlocked || isReadOnly;

  const tourSquare = useTourSquare({ activeId, tickTabs });

  // Undo / redo handlers. See useEditorHistory.
  const editorHistory = useEditorHistory({
    activeId,
    editsBlocked,
    canUndo: canHistoryUndo,
    canRedo: canHistoryRedo,
    tickTabs,
    undoHistory,
    redoHistory,
    set: { setSelectedId, setEditingId, setFormatSourceId },
  });
  const { tick, undo, redo, canUndo, canRedo } = editorHistory;
  // --- Placement helpers ---------------------------------------------------

  // When a boxed element is selected, new elements inherit its size so a
  // user can rapidly build a sequence of similarly-sized nodes.
  // Selection + placement + format helpers. See useElementHelpers.
  const { addBoxedAt, currentSelectionIds, selectionPrimary, applyFormatFromSource } =
    useElementHelpers({
      readSelection,
      activeId,
      activeTab,
      // Creation-only helpers. Open to a Participant that may add content
      // (docs/specs/013-workspace/share-roles.md): a sticky, text or image dragged from its palette lands through
      // addBoxedAt, and every commit it makes still passes participant.guardCommit.
      editsBlocked: contentAddBlocked({
        participating: participant.participating,
        canAddContent: participant.can.addContent,
        blocked: editsBlocked,
        structureBlocked: structureCreateBlocked,
      }),
      formatSourceId,
      formatConfig: formatSettings.config,
      getViewportCenter,
      commit,
      commitTabs,
      setSelection: selectionStore.setSelection,
      setEditingId,
      setFormatSourceId,
    });
  return {
    activeTheme,
    addBoxedAt,
    applyFormatFromSource,
    commit,
    currentSelectionIds,
    editsBlocked,
    liveActiveElements,
    redo,
    rememberingCommit,
    rememberingTickTabs,
    selectionPrimary,
    structureBlocked,
    styleMemory,
    tick,
    undo,
    view: {
      tourSquare,
      activeTabConnected,
      // The whole creation gate: a view-only session or a tab still loading.
      createBlocked: editsBlocked,
      toggleDoor,
      canRedo,
      canUndo,
      activeTabLoadState,
      redo,
      // A whole-tab write in one history step, for menu controls that change many elements at once (renumbering
      // steps, Play in Order): lib/element-style-ops.ts.
      commitElements: commit,
      undo,
    },
  };
}

export type EditorEditingSlice = ReturnType<typeof useEditorEditing>;
