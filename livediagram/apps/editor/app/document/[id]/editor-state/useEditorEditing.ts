'use client';

import { onlyDraftNotesChanged, type Element, type Tab } from '@livediagram/document';
import { useStyleMemory } from '@/hooks/canvas/useStyleMemory';
import { getTheme } from '@/lib/themes';
import { connectionOf } from '@liveworkspace/workbench/components/connect/tab-connection';
import { deriveTabLoadState, patchTab } from '../editor-page-helpers';
import { useCollabDeepLink } from '../useCollabDeepLink';
import { activeElementsCommit } from '../active-elements-commit';
import type { EditorDocumentSlice } from './useEditorDocument';
import type { EditorHistorySlice } from './useEditorHistory';
import type { EditorSelectionSlice } from './useEditorSelection';
import type { EditorCollaborationSlice } from './useEditorCollaboration';
import type { EditorPersistenceSlice } from './useEditorPersistence';
import type { EditorRoomSlice } from './useEditorRoom';
import type { EditorCommentsSlice } from './useEditorComments';
import type { EditorModesSlice } from './useEditorModes';
import type { EditorViewportSlice } from './useEditorViewport';
import type { EditorFollowingSlice } from './useEditorFollowing';

// The edit gates (locked, connected, read-only, loading) and the active tab's commit, with style memory's
// recording commits. A slice of useEditorState (../useEditorState.ts): it takes the slices composed before it
// and returns its own, with `view`, its part of the editor's view-model.
export function useEditorEditing({
  fromDocument,
  fromHistory,
  fromSelection,
  fromCollaboration,
  fromPersistence,
  fromRoom,
  fromComments,
  fromModes,
  fromViewport,
  fromFollowing,
}: {
  fromDocument: EditorDocumentSlice;
  fromHistory: EditorHistorySlice;
  fromSelection: EditorSelectionSlice;
  fromCollaboration: EditorCollaborationSlice;
  fromPersistence: EditorPersistenceSlice;
  fromRoom: EditorRoomSlice;
  fromComments: EditorCommentsSlice;
  fromModes: EditorModesSlice;
  fromViewport: EditorViewportSlice;
  fromFollowing: EditorFollowingSlice;
}) {
  const { documentId, hydrated, loadedTabIds, tabLoadErrors } = fromDocument;
  const { commitTabs, photoDraftOpenRef, tickTabs } = fromHistory;
  const { activeId, setEditingId, setMultiSelectedIds, setSelectedId } = fromSelection;
  const { isReadOnly, participant } = fromCollaboration;
  const { tabsRef } = fromPersistence;
  const { facilitator } = fromRoom;
  const { activeTab, openActionPopover, openComments } = fromComments;
  const { drawMode } = fromModes;
  const { scrollIntoView } = fromViewport;
  const { collabDeepLink } = fromFollowing;
  // --- Element-scoped history helpers (active-tab aware) -------------------

  // A locked tab refuses every element mutation. Commit /
  // tick / element-add helpers all consult this early-return guard
  // so a single check covers drag, edit, paint, delete, etc.
  const activeTabLocked = activeTab.locked === true;
  // A connected tab (liveworkspace/docs/specs/004-index/connected-tabs.md) holds no content: every edit is shut on it.
  const activeTabConnected = connectionOf(activeTab) !== null;
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
  const activeTabLoadState = deriveTabLoadState({
    hydrated,
    hasDocument: !!documentId,
    loaded: loadedTabIds.has(activeId),
    errored: tabLoadErrors.has(activeId),
    elementsLength: activeTab.elements.length,
    templateChosen: activeTab.templateChosen === true,
  });
  // A view-only session (a 'view' share role) is read-only in exactly
  // the same way a locked tab is: no element or tab mutation may land.
  // Folding the flags into one guard means every mutation helper
  // below stays blocked with a single check, and the interaction
  // starters (beginDrag, beginEdit, ...) layer on their own isReadOnly
  // checks so a viewer can still select and inspect.
  // Running a session (start, end, reveal, clear, pace) is an Editor's, whoever holds the baton
  // (docs/specs/013-workspace/share-roles.md): a Participant's editsBlocked is false, so it is shut here.
  const runsBlocked = facilitator.sessionToolsBlocked || isReadOnly;
  // A Participant commits too: every one of its commits passes participant.guardCommit.
  const editsBlocked =
    activeTabLocked ||
    activeTabConnected ||
    (isReadOnly && !participant.participating) ||
    activeTabLoadState !== 'ready';
  // What a picture swap answers to (docs/specs/009-elements/images.md "Locked images"): all of the above but the
  // tab's lock, which holds every element's place, not an image's picture.
  const pictureBlocked =
    (isReadOnly && !participant.participating) || activeTabLoadState !== 'ready';
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

  // A picture swap passes `{ picture: true }` and answers to `pictureBlocked` instead of `editsBlocked`.
  const commit = (mapElements: (els: Element[]) => Element[], opts?: { picture?: boolean }) => {
    if (opts?.picture ? pictureBlocked : editsBlocked) return;
    // Read the LIVE elements (via tabsRef), not the render-time `activeTab`
    // closure. A deferred caller can run long after the render that created
    // this `commit` — e.g. the link-card unfurl resolves a few seconds
    // after the URL is set — and mapping over the stale snapshot would
    // write the element back as it was BEFORE the in-between edit, silently
    // dropping it (the bug where a link-card reset to "Add a link" once its
    // preview fetch landed).
    // An edit confined to the notes a photo draft brought in belongs to the
    // draft's gesture, not to the undo stack: it is written live and folded
    // into the one step Add leaves behind. Anything touching the author's own
    // work commits normally, so a Discard can never take it with it.
    if (photoDraftOpenRef.current) {
      const liveTab = tabsRef.current.find((t) => t.id === activeId) ?? activeTab;
      const before = liveTab.elements;
      const after = mapElements(before);
      if (onlyDraftNotesChanged(before, after)) {
        tickTabs((ts) => patchTab(ts, activeId, { elements: after }));
        return;
      }
      commitTabs((ts) => patchTab(ts, activeId, { elements: after }));
      return;
    }
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

  // Tab-level history commit scoped to the ACTIVE tab, for mutations
  // that touch more than the elements array — the layer ops and the
  // layer-aware Bring to Front / Send to Back also restack
  // `tab.layers`. Reads the LIVE tab (same rationale as `commit`).
  const commitActiveTab = (mapTab: (t: Tab) => Tab) => {
    if (editsBlocked) return;
    const liveTab = tabsRef.current.find((t) => t.id === activeId) ?? activeTab;
    const next = mapTab(liveTab);
    if (next === liveTab) return;
    if (participant.participating && !participant.guardCommit(liveTab, next)) return;
    commitTabs((ts) => ts.map((t) => (t.id === activeId ? mapTab(t) : t)));
  };

  // Style memory (docs/specs/008-canvas/quick-style-panel.md): what the panel or the context menu last
  // chose per element kind, applied to the next element the user draws. The
  // style hooks below get `commit` / `tickTabs` wrapped to record into it.
  const activeTheme = getTheme(activeTab.theme);
  const styleMemory = useStyleMemory({
    documentId,
    theme: activeTheme,
    board: drawMode,
  });
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
  return {
    activeTabLocked,
    activeTheme,
    commit,
    commitActiveTab,
    editsBlocked,
    liveActiveElements,
    pictureBlocked,
    rememberingCommit,
    rememberingTickTabs,
    runsBlocked,
    structureBlocked,
    styleMemory,
    view: {
      activeTabLocked,
      activeTabConnected,
      styleNewElement: styleMemory.styleNewElement,
      activeTabLoadState,
      // A whole-tab write in one history step, for menu controls that change many elements at once (renumbering
      // steps, Play in Order): lib/element-style-ops.ts.
      commitElements: commit,
    },
  };
}

export type EditorEditingSlice = ReturnType<typeof useEditorEditing>;
