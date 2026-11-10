import type { Element } from '@livedesign/design';
import { usePagesMode } from '@/hooks/editor/usePagesMode';
import { connectionOf } from '@liveworkspace/workbench/components/connect/tab-connection';
import { deriveTabLoadState, patchTab } from '../editor-page-helpers';
import { useCollabDeepLink } from '../useCollabDeepLink';
import { useAssignRef } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { announcePageLocked } from '@/lib/page-lock-guard';
import { usePageLockedIds } from '@/hooks/editor/usePageLockedIds';
import { activeElementsCommit } from '../active-elements-commit';
import type { EditorDesignSlice } from './useEditorDesign';
import type { EditorSelection } from './useEditorSelection';
import type { EditorSession } from './useEditorSession';
import type { EditorPersistence } from './useEditorPersistence';
import type { EditorCollaboration } from './useEditorCollaboration';
import type { EditorViewport } from './useEditorViewport';
import type { EditorComments } from './useEditorComments';

// Pages mode and the edit gates: the pages and their locks, the locked / connected / loading / read-only gates, the
// Inbox deep link, and the element commit every mutator goes through.
//
// One slice of useEditorState (../useEditorState.ts), which calls the slices in order and passes each the ones
// before it.
export function useEditorPages({
  designSlice,
  selectionSlice,
  sessionSlice,
  persistenceSlice,
  collaborationSlice,
  viewportSlice,
  commentsSlice,
}: {
  designSlice: EditorDesignSlice;
  selectionSlice: EditorSelection;
  sessionSlice: EditorSession;
  persistenceSlice: EditorPersistence;
  collaborationSlice: EditorCollaboration;
  viewportSlice: EditorViewport;
  commentsSlice: EditorComments;
}) {
  const { pageLockGuardRef, commitTabs } = designSlice;
  const { activeId, setSelectedId, setEditingId, setMultiSelectedIds } = selectionSlice;
  const {
    openComments,
    toast,
    followingRef,
    loadedTabIds,
    tabLoadErrors,
    designId,
    hydrated,
    isReadOnly,
    participant,
  } = sessionSlice;
  const { tabsRef } = persistenceSlice;
  const { activeTab } = collaborationSlice;
  const {
    viewport,
    setViewportOffset,
    setViewportZoom,
    zoomRef,
    viewportOffsetRef,
    canvasMainRef,
    scrollIntoView,
    collabDeepLink,
    frameFirstPageRef,
  } = viewportSlice;
  const { openActionPopover } = commentsSlice;
  // --- Element-scoped history helpers (active-tab aware) -------------------

  // Pages mode's pages: their edits, and the view centred on them.
  const pagesMode = usePagesMode({
    activeTab,
    canEdit: !isReadOnly,
    tabLoaded: loadedTabIds.has(activeId),
    commitTabs,
    canvasMainRef,
    setViewportZoom,
    setViewportOffset,
    getViewport: () => ({ zoom: zoomRef.current, offset: viewportOffsetRef.current }),
    clearSelection: () => {
      setSelectedId(null);
      setMultiSelectedIds(new Set());
    },
    toastInfo: toast.info,
    frameFirstPageRef,
    designId: designId ?? undefined,
    viewport,
    snapSuspended: () => followingRef.current !== null,
  });
  // What a locked page holds is inert, as on a locked layer.
  const pageLockedIds = usePageLockedIds(activeTab.elements, pagesMode.pages);
  const canvasInertIds = pageLockedIds;
  useAssignRef(pageLockGuardRef, {
    tabId: activeId,
    // Said after the commit: the guard runs inside a state update, where no toast may be set.
    onBlocked: () => queueMicrotask(() => announcePageLocked(toast.info)),
  });

  // A locked tab refuses every element mutation. Commit /
  // tick / element-add helpers all consult this early-return guard
  // so a single check covers drag, edit, paint, delete, etc.
  const activeTabLocked = activeTab.locked === true;
  // A connected tab (liveworkspace/docs/specs/004-index/connected-tabs.md) holds no content: every edit is shut on it.
  const activeTabConnected = connectionOf(activeTab) !== null;
  // Lazy per-tab load gate (docs/specs/006-design/per-tab-storage.md). Until the active tab's content has
  // landed it's an empty placeholder, NOT its real server row. The canvas
  // shows a blocking overlay over this state — but that overlay only
  // captures POINTER events; window/design keyboard + paste listeners
  // (shape shortcuts, Cmd+V) sail past it. So an edit could land on the
  // placeholder, which then (a) makes the lazy fetch discard the real
  // server content as "user already edited" and (b) re-arms the autosave
  // to PUT the near-empty body over the real row — wiping it. Folding the
  // load state into editsBlocked blocks EVERY commit-based mutator
  // (keyboard, paste, import, clear) at one chokepoint, not just the
  // pointer paths the overlay covers. 'ready' is the only editable state
  // (a loaded tab, a locally-created/peer-delivered tab with content, or
  // a dismissed template picker — see deriveTabLoadState).
  const activeTabLoadState = deriveTabLoadState({
    hydrated,
    hasDesign: !!designId,
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

  // An Inbox row opened this design at one element (docs/specs/013-workspace/inbox.md
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

  return {
    pagesMode,
    canvasInertIds,
    activeTabLocked,
    activeTabConnected,
    activeTabLoadState,
    editsBlocked,
    pictureBlocked,
    structureBlocked,
    commit,
  };
}

export type EditorPages = ReturnType<typeof useEditorPages>;
