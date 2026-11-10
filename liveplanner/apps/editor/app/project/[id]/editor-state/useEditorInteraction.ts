import { voteTallyWritesOf } from '@/hooks/plan/vote-tally';
import { useCanvasA11y } from '@/hooks/canvas/useCanvasA11y';
import { useNudgeSelection } from '@/hooks/canvas/useNudgeSelection';
import { useEditorDrag } from '@/hooks/canvas/useEditorDrag';
import { useElementLinks } from '@/hooks/canvas/useElementLinks';
import { useVoteReview } from '@/hooks/canvas/useVoteReview';
import { useSelectionEditing } from '../useSelectionEditing';
import type { EditorSelectionSlice } from './useEditorSelection';
import type { EditorProjectSlice } from './useEditorProject';
import type { EditorDialogsSlice } from './useEditorDialogs';
import type { EditorCollaborationSlice } from './useEditorCollaboration';
import type { EditorPlanDataSlice } from './useEditorPlanData';
import type { EditorViewportSlice } from './useEditorViewport';
import type { EditorCommentsSlice } from './useEditorComments';
import type { EditorEditingSlice } from './useEditorEditing';
import type { EditorPlanSlice } from './useEditorPlan';
import type { EditorTabsSlice } from './useEditorTabs';
import type { EditorTabToolsSlice } from './useEditorTabTools';

// A slice of the editor's state, composed by useEditorState in a fixed order (docs/development/architecture.md
// "The editor's shape"). It takes the slices composed before it and returns what the slices after it, and the
// view (editor-view.ts), read. Its hooks run in the order they did in the one hook this was split from, so the
// effects keep their order.
//
// Element links, label editing, canvas accessibility, vote review, the keyboard nudge and dragging.
export function useEditorInteraction(
  selectionSlice: EditorSelectionSlice,
  projectSlice: EditorProjectSlice,
  dialogsSlice: EditorDialogsSlice,
  collaborationSlice: EditorCollaborationSlice,
  planDataSlice: EditorPlanDataSlice,
  viewportSlice: EditorViewportSlice,
  commentsSlice: EditorCommentsSlice,
  editingSlice: EditorEditingSlice,
  planSlice: EditorPlanSlice,
  tabsSlice: EditorTabsSlice,
  tabToolsSlice: EditorTabToolsSlice,
) {
  const {
    editingId,
    readSelection,
    selectionStore,
    setActiveId,
    setEditCursorAtEnd,
    setEditingId,
    setMultiSelectedIds,
    setSelectedId,
  } = selectionSlice;
  const { cancelToCheckpoint, markCheckpoint, tabs, tickTabs, voteSelfId } = projectSlice;
  const { shortcutsEnabled } = dialogsSlice;
  const {
    alignmentGuidesRef,
    autoRebindArrowsRef,
    isReadOnly,
    participant,
    projectName,
    setContextMenu,
    setProjectName,
  } = collaborationSlice;
  const { activeTab, itemTypes, planItems } = planDataSlice;
  const { isPinchingRef, scrollIntoView, zoomRef } = viewportSlice;
  const { lockedByOther } = commentsSlice;
  const { activeTabLocked, commit, editsBlocked, layerInertIds, layersState, styleMemory } =
    editingSlice;
  const { plan } = planSlice;
  const { currentSelectionIds, openProject, tick } = tabsSlice;
  const { clearVote, dropIconElementOnShape, endVote, setVoteReviewIndex } = tabToolsSlice;
  // Element link picker state + the link read/write/follow handlers.
  // See useElementLinks.
  const {
    linkPickerOpenForId,
    setLinkPickerOpenForId,
    linkPickerInitialMode,
    openLinkPicker,
    applyElementLink,
    followLink,
  } = useElementLinks({
    currentSelectionIds,
    commit,
    tabs,
    setActiveId,
    setSelectedId,
    setEditingId,
    openProject,
  });

  // Selection-editing handlers (label edit, type-to-edit,
  // single + shift-click select). See useSelectionEditing.
  const {
    beginEdit,
    commitLabel,
    commitTable,
    commitHeaderSize,
    cancelEdit,
    typeIntoSelected,
    selectElement,
    toggleInMultiSelect,
  } = useSelectionEditing({
    readSelection,
    isReadOnly,
    tabLocked: activeTabLocked,
    canWriteText: participant.can.writeText,
    layerInertIds,
    adoptLayerName: layersState.adoptLayerNameFromLabel,
    projectName,
    tabs,
    activeTab,
    editingId,
    commit,
    discardLastStep: cancelToCheckpoint,
    tickTabs,
    lockedByOther,
    set: {
      setSelectedId,
      setEditingId,
      setEditCursorAtEnd,
      setMultiSelectedIds,
      setProjectName,
      setContextMenu,
    },
  });

  // Canvas accessibility baseline (docs/specs/004-interface-design/canvas-accessibility.md): Tab / Shift+Tab element
  // traversal while the canvas surface is focused, plus SR live-region
  // announcements on selection changes. See useCanvasA11y.
  useCanvasA11y({
    enabled: shortcutsEnabled,
    elements: activeTab.elements,
    selection: selectionStore,
    editingId,
    selectElement,
    lockedByOther,
    layerInertIds,
    scrollIntoView,
  });

  // Vote-results review (docs/specs/012-collaboration/session-tools.md): the local walkthrough of revealed top
  // picks — focus highlight + Previous / Next / Done in the vote banner.
  const {
    voteReview,
    voteResults,
    jumpToVoteResult,
    nextVoteResult,
    prevVoteResult,
    doneVoteReview,
  } = useVoteReview({
    activeTab,
    selfId: voteSelfId,
    scrollIntoView,
    clearVote,
    setVoteReviewIndex,
  });

  // Ending a vote adds its Plan cards' dots to the cards (docs/specs/026-plan/items.md "Tally"): the host's editor,
  // once, after the end lands. Undo does not take it back. Only when endVote really ended it: a vote's starter
  // while somebody else facilitates is refused there, and tallying anyway counted the cards twice.
  const endVoteAndTally = () => {
    const vote = activeTab.vote;
    if (!endVote() || !vote) return;
    // In the Votes field the vote counts in (session-tools.md "Count In"), the built-in for a type without it.
    void voteTallyWritesOf(vote, planItems.items, itemTypes.types).then((writes) => {
      for (const write of writes) void planItems.writeQuiet(write);
    });
  };

  // Keyboard nudge (docs/specs/008-canvas/canvas-and-palette.md Move). See useNudgeSelection for the
  // burst-coalescing + auto-rebind behaviour; this hook also owns
  // the timer-cleanup-on-unmount that the prior inline version
  // didn't have.
  const nudgeSelection = useNudgeSelection({
    isReadOnly,
    readSelection,
    activeTab,
    markCheckpoint,
    tick,
    autoRebindArrowsRef,
  });

  // Drag state machine + its global pointer-move / pointer-up
  // listeners live in useEditorDrag (see apps/editor/hooks/useEditorDrag.ts).
  // The hook owns the drag state and the four `begin*` dispatchers.
  // Wiring it up here passes the editor-page's "what is going on
  // right now" state as deps so the hook can read fresh values on
  // every pointer move without re-attaching listeners.
  // `drag` itself isn't consumed in the page (Canvas pulls cursor
  // styling from `canvasTool`, not the drag state); only the four
  // begin-handlers below are passed through to Canvas as props.
  const {
    drag,
    shiftDupGhostIds,
    snapGuideStore,
    beginDrag,
    beginAnchorDrag,
    beginArrowTranslate,
    beginEndpointDrag,
    beginArrowCurveDrag,
    beginArrowCurvePointDrag,
    beginArrowBend,
    beginArrowScale,
    deleteCurvePoint,
    beginArrowElbowDrag,
    beginArrowLabelDrag,
  } = useEditorDrag({
    activeTab,
    layerInertIds,
    zoomRef,
    readSelection,
    setSelectedId,
    setMultiSelectedIds,
    editingId,
    isReadOnly,
    canMove: participant.can.move,
    canResize: participant.can.resize,
    tick,
    commit,
    markCheckpoint,
    cancelToCheckpoint,
    onIconElementDroppedOnShape: editsBlocked ? undefined : dropIconElementOnShape,
    onPlanCardDroppedOnBoard: editsBlocked ? undefined : plan.dropPlanCardOnBoard,
    autoRebindArrowsRef,
    styleNewElement: styleMemory.styleNewElement,
    alignmentGuidesRef,
    isPinchingRef,
  });
  return {
    applyElementLink,
    beginAnchorDrag,
    beginArrowBend,
    beginArrowCurveDrag,
    beginArrowCurvePointDrag,
    beginArrowElbowDrag,
    beginArrowLabelDrag,
    beginArrowScale,
    beginArrowTranslate,
    beginDrag,
    beginEdit,
    beginEndpointDrag,
    cancelEdit,
    commitHeaderSize,
    commitLabel,
    commitTable,
    deleteCurvePoint,
    doneVoteReview,
    drag,
    endVoteAndTally,
    followLink,
    jumpToVoteResult,
    linkPickerInitialMode,
    linkPickerOpenForId,
    nextVoteResult,
    nudgeSelection,
    openLinkPicker,
    prevVoteResult,
    selectElement,
    setLinkPickerOpenForId,
    shiftDupGhostIds,
    snapGuideStore,
    toggleInMultiSelect,
    typeIntoSelected,
    voteResults,
    voteReview,
  };
}

export type EditorInteractionSlice = ReturnType<typeof useEditorInteraction>;
