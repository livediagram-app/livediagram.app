import { useSheetChartInertIds } from '@/hooks/sheets/useSheetChartInertIds';
import type { Element, Tab } from '@liveplanner/project';
import { useStyleMemory } from '@/hooks/canvas/useStyleMemory';
import { getTheme } from '@/lib/themes';
import { connectionOf } from '@liveworkspace/workbench/components/connect/tab-connection';
import { deriveTabLoadState, patchTab } from '../editor-page-helpers';
import { usePruneInertSelection } from '@liveworkspace/workbench/hooks/canvas/usePruneInertSelection';
import { useLayersState } from '../useLayersState';
import { useCollabDeepLink } from '../useCollabDeepLink';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { activeElementsCommit } from '../active-elements-commit';
import type { EditorSelectionSlice } from './useEditorSelection';
import type { EditorProjectSlice } from './useEditorProject';
import type { EditorCollaborationSlice } from './useEditorCollaboration';
import type { EditorPersistenceSlice } from './useEditorPersistence';
import type { EditorPlanDataSlice } from './useEditorPlanData';
import type { EditorViewportSlice } from './useEditorViewport';
import type { EditorCommentsSlice } from './useEditorComments';
import type { EditorLate } from './editor-late';

// The open tab's elements before the tabs load.
const NO_IDS: ReadonlySet<string> = new Set();

// A slice of the editor's state, composed by useEditorState in a fixed order (docs/development/architecture.md
// "The editor's shape"). It takes the slices composed before it and returns what the slices after it, and the
// view (editor-view.ts), read. Its hooks run in the order they did in the one hook this was split from, so the
// effects keep their order.
//
// What may be edited now (locked, connected, loading, read-only, the share role) and the commit paths built on
// it, style memory, layers, and an Inbox link arriving at an element.
export function useEditorEditing(
  selectionSlice: EditorSelectionSlice,
  projectSlice: EditorProjectSlice,
  collaborationSlice: EditorCollaborationSlice,
  persistenceSlice: EditorPersistenceSlice,
  planDataSlice: EditorPlanDataSlice,
  viewportSlice: EditorViewportSlice,
  commentsSlice: EditorCommentsSlice,
  late: Pick<EditorLate, 'plan'>,
) {
  const { activeId, selectionStore, setEditingId, setMultiSelectedIds, setSelectedId } =
    selectionSlice;
  const { commitTabs, hydrated, loadedTabIds, markCheckpoint, projectId, tabLoadErrors, tickTabs } =
    projectSlice;
  const { isReadOnly, openComments, participant, toast } = collaborationSlice;
  const { tabsRef } = persistenceSlice;
  const { activeTab, cardThreads } = planDataSlice;
  const { arrivingCardRef, collabDeepLink, scrollIntoView } = viewportSlice;
  const { openActionPopover } = commentsSlice;
  // --- Element-scoped history helpers (active-tab aware) -------------------

  const { inertIds: canvasInertIds, chartIds: sheetChartIds } = useSheetChartInertIds(
    activeTab.elements,
    NO_IDS,
  );

  // A locked tab refuses every element mutation. Commit /
  // tick / element-add helpers all consult this early-return guard
  // so a single check covers drag, edit, paint, delete, etc.
  const activeTabLocked = activeTab.locked === true;
  // A connected tab (liveworkspace/docs/specs/004-index/connected-tabs.md) holds no content: every edit is shut on it.
  const activeTabConnected = connectionOf(activeTab) !== null;
  // Lazy per-tab load gate (docs/specs/006-project/per-tab-storage.md). Until the active tab's content has
  // landed it's an empty placeholder, NOT its real server row. The canvas
  // shows a blocking overlay over this state — but that overlay only
  // captures POINTER events; window/project keyboard + paste listeners
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
    hasProject: !!projectId,
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
  // Running a session (start, end, reveal, clear, pace) is an Editor's
  // (docs/specs/013-workspace/share-roles.md): a Participant's editsBlocked is false, so it is shut here.
  const runsBlocked = isReadOnly;
  // A Participant commits too: every one of its commits passes participant.guardCommit.
  const editsBlocked =
    activeTabLocked ||
    activeTabConnected ||
    (isReadOnly && !participant.participating) ||
    activeTabLoadState !== 'ready';
  // Everything but a Participant's own gestures stays shut to it (docs/specs/013-workspace/share-roles.md): the hooks
  // that write the tab's structure, or write without passing commit's guard, take this instead of editsBlocked.
  const structureBlocked = editsBlocked || isReadOnly;

  // An Inbox row opened this project at one element (docs/specs/013-workspace/inbox.md
  // §1): once the pinned tab is ready, select it, bring it into view and
  // open its popover (or a Plan card's item panel). See useCollabDeepLink.
  const arriveAtLink = useCollabDeepLink({
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
    // Read when the link lands, after this render has made the Plan slice below.
    openItem: (itemId, threadId) => {
      arrivingCardRef.current = itemId;
      late.plan().context.openItem(itemId);
      // The thread a link names opens on the card (docs/specs/026-plan/items.md "Where it shows").
      if (threadId) cardThreads.focus(threadId);
    },
  });

  const commit = (mapElements: (els: Element[]) => Element[]) => {
    if (editsBlocked) return;
    // Read the LIVE elements (via tabsRef), not the render-time `activeTab`
    // closure. A deferred caller can run long after the render that created
    // this `commit` — e.g. a fetch that resolves a few seconds later — and
    // mapping over the stale snapshot would write the element back as it was
    // BEFORE the in-between edit, silently dropping it.
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
    projectId,
    theme: activeTheme,
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

  // Layers domain slice (docs/specs/006-project/layers.md): the active layer, the panel /
  // context-menu ops, and the hidden / locked element-id sets every
  // interaction gate below reads.
  const layersState = useLayersState({
    activeId,
    activeTab,
    editsBlocked: structureBlocked,
    commitActiveTab,
    tickTabs,
    markCheckpoint,
    toastInfo: toast.info,
    extraInertIds: canvasInertIds,
  });
  const {
    layers,
    activeLayerId,
    activeLayerBlocked,
    layerHiddenIds,
    layerLockedIds,
    layerInertIds,
  } = layersState;
  // Refresh the commit choke point's stamp (see commitTabs above).
  // Active-layer stamp for the commit choke point below (docs/specs/006-project/layers.md). A ref
  // (not state): commitTabs is defined before the layers slice computes,
  // so the slice refreshes this every render and the closure reads the
  // latest value at commit time.
  const activeLayerStampRef = useLatest<{ tabId: string; layerId: string } | null>({
    tabId: activeId,
    layerId: activeLayerId,
  });

  // Element creation lands on the active layer, so it's additionally
  // blocked while that layer is hidden or locked (docs/specs/006-project/layers.md).
  const createBlocked = editsBlocked || activeLayerBlocked;
  // As structureBlocked, for the hooks that take createBlocked: shut to a Participant.
  const structureCreateBlocked = createBlocked || isReadOnly;

  // A layer turning hidden or locked drops its elements from the live selection (layers.md).
  // A chart its Sheet draws stays selected while its element menu acts on it (sheet.md "Charts").
  usePruneInertSelection(layerInertIds, selectionStore, sheetChartIds);
  return {
    activeLayerBlocked,
    activeLayerId,
    activeLayerStampRef,
    activeTabConnected,
    activeTabLoadState,
    activeTabLocked,
    arriveAtLink,
    commit,
    commitActiveTab,
    createBlocked,
    editsBlocked,
    layerHiddenIds,
    layerInertIds,
    layerLockedIds,
    layers,
    layersState,
    rememberingCommit,
    rememberingTickTabs,
    runsBlocked,
    structureBlocked,
    structureCreateBlocked,
    styleMemory,
  };
}

export type EditorEditingSlice = ReturnType<typeof useEditorEditing>;
