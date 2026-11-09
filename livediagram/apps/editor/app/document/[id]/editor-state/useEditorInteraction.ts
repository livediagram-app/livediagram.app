'use client';

import { useRef } from 'react';
import { useBoardSceneInsert } from '@/hooks/canvas/useBoardSceneInsert';
import { useLibraryShapeInsert } from '@/hooks/canvas/useLibraryShapeInsert';
import { useClipboard } from '@/hooks/canvas/useClipboard';
import { useCanvasA11y } from '@/hooks/canvas/useCanvasA11y';
import { useNudgeSelection } from '@/hooks/canvas/useNudgeSelection';
import { useEditorDrag } from '@/hooks/canvas/useEditorDrag';
import { useElementLinks } from '@/hooks/canvas/useElementLinks';
import { useVoteReview } from '@/hooks/canvas/useVoteReview';
import { useEntityActions } from '@/hooks/canvas/useEntityActions';
import { useSelectionEditing } from '../useSelectionEditing';
import type { EditorDocumentSlice } from './useEditorDocument';
import type { EditorHistorySlice } from './useEditorHistory';
import type { EditorSelectionSlice } from './useEditorSelection';
import type { EditorDialogsSlice } from './useEditorDialogs';
import type { EditorToolsSlice } from './useEditorTools';
import type { EditorCollaborationSlice } from './useEditorCollaboration';
import type { EditorPersistenceSlice } from './useEditorPersistence';
import type { EditorRoomSlice } from './useEditorRoom';
import type { EditorCommentsSlice } from './useEditorComments';
import type { EditorModesSlice } from './useEditorModes';
import type { EditorViewportSlice } from './useEditorViewport';
import type { EditorPresentationSlice } from './useEditorPresentation';
import type { EditorFollowingSlice } from './useEditorFollowing';
import type { EditorPresenceSlice } from './useEditorPresence';
import type { EditorEditingSlice } from './useEditorEditing';
import type { EditorLayersSlice } from './useEditorLayers';
import type { EditorEventStormingSlice } from './useEditorEventStorming';
import type { EditorTabsSlice } from './useEditorTabs';
import type { EditorSessionToolsSlice } from './useEditorSessionTools';
import type { EditorCreationSlice } from './useEditorCreation';

// Pointer and selection interaction: links, label editing, canvas accessibility, vote review, nudge, drag,
// entity verbs, the clipboard, board scenes and library shapes. A slice of useEditorState
// (../useEditorState.ts): it takes the slices composed before it and returns its own, with `view`, its part of
// the editor's view-model.
export function useEditorInteraction({
  fromDocument,
  fromHistory,
  fromSelection,
  fromDialogs,
  fromTools,
  fromCollaboration,
  fromPersistence,
  fromRoom,
  fromComments,
  fromModes,
  fromViewport,
  fromPresentation,
  fromFollowing,
  fromPresence,
  fromEditing,
  fromLayers,
  fromEventStorming,
  fromTabs,
  fromSessionTools,
  fromCreation,
}: {
  fromDocument: EditorDocumentSlice;
  fromHistory: EditorHistorySlice;
  fromSelection: EditorSelectionSlice;
  fromDialogs: EditorDialogsSlice;
  fromTools: EditorToolsSlice;
  fromCollaboration: EditorCollaborationSlice;
  fromPersistence: EditorPersistenceSlice;
  fromRoom: EditorRoomSlice;
  fromComments: EditorCommentsSlice;
  fromModes: EditorModesSlice;
  fromViewport: EditorViewportSlice;
  fromPresentation: EditorPresentationSlice;
  fromFollowing: EditorFollowingSlice;
  fromPresence: EditorPresenceSlice;
  fromEditing: EditorEditingSlice;
  fromLayers: EditorLayersSlice;
  fromEventStorming: EditorEventStormingSlice;
  fromTabs: EditorTabsSlice;
  fromSessionTools: EditorSessionToolsSlice;
  fromCreation: EditorCreationSlice;
}) {
  const { documentId, embedMode, selfParticipant, toast, voteSelfId } = fromDocument;
  const { cancelToCheckpoint, markCheckpoint, tabs, tickTabs } = fromHistory;
  const {
    editingId,
    formatSourceId,
    readSelection,
    selectionStore,
    setActiveId,
    setEditCursorAtEnd,
    setEditingId,
    setFormatSourceId,
    setMultiSelectedIds,
    setSelectedId,
  } = fromSelection;
  const { setContextMenu } = fromDialogs;
  const { formatToolActive } = fromTools;
  const { isReadOnly, participant } = fromCollaboration;
  const { alignmentGuidesRef, autoRebindArrowsRef, documentName, setDocumentName } =
    fromPersistence;
  const { facilitator } = fromRoom;
  const { activeTab } = fromComments;
  const { drawMode } = fromModes;
  const { getViewportCanvasRect, getViewportCenter, scrollIntoView, zoomRef } = fromViewport;
  const { keyboardEnabled } = fromPresentation;
  const { isPinchingRef } = fromFollowing;
  const { lockedByOther } = fromPresence;
  const { activeTabLocked, commit, editsBlocked, structureBlocked, styleMemory } = fromEditing;
  const {
    applyFormatFromSource,
    createBlocked,
    currentSelectionIds,
    esBoard,
    layerInertIds,
    layerLockedIds,
    layersState,
    tick,
  } = fromLayers;
  const { readPhotoFile } = fromEventStorming;
  const { openDocument } = fromTabs;
  const { clearVote, setVoteReviewIndex } = fromSessionTools;
  const {
    addImageFromGallery,
    canGrowMindNode,
    connectArrowTo,
    connectSourceId,
    dropIconElementOnShape,
  } = fromCreation;

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
    setFormatSourceId,
    openDocument,
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
    formatSourceId,
    formatToolActive,
    documentName,
    tabs,
    activeTab,
    drawMode,
    editingId,
    commit,
    discardLastStep: cancelToCheckpoint,
    tickTabs,
    applyFormatFromSource,
    lockedByOther,
    set: {
      setFormatSourceId,
      setSelectedId,
      setEditingId,
      setEditCursorAtEnd,
      setMultiSelectedIds,
      setDocumentName,
      setContextMenu,
    },
  });

  // Canvas accessibility baseline (docs/specs/004-interface-design/canvas-accessibility.md): Tab / Shift+Tab element
  // traversal while the canvas surface is focused, plus SR live-region
  // announcements on selection changes. See useCanvasA11y.
  useCanvasA11y({
    enabled: keyboardEnabled,
    elements: activeTab.elements,
    selection: selectionStore,
    editingId,
    selectElement,
    lockedByOther,
    layerInertIds,
    scrollIntoView,
    ownsTabKey: canGrowMindNode,
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
    facilitating: facilitator.isFacilitator,
    scrollIntoView,
    clearVote,
    setVoteReviewIndex,
  });

  // Keyboard nudge (docs/specs/008-canvas/canvas-and-palette.md Move). See useNudgeSelection for the
  // burst-coalescing + auto-rebind behaviour; this hook also owns
  // the timer-cleanup-on-unmount that the prior inline version
  // didn't have.
  const nudgeSelection = useNudgeSelection({
    isReadOnly,
    readSelection,
    activeTab,
    laneBoard: esBoard,
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
    pressArmedAction,
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
    formatSourceId,
    applyFormatFromSource,
    formatToolActive,
    setFormatSourceId,
    connectSourceId,
    connectArrowTo,
    tick,
    commit,
    markCheckpoint,
    cancelToCheckpoint,
    onIconElementDroppedOnShape: editsBlocked ? undefined : dropIconElementOnShape,
    autoRebindArrowsRef,
    styleNewElement: styleMemory.styleNewElement,
    alignmentGuidesRef,
    isPinchingRef,
    // Insert between (docs/specs/021-event-storming/event-storming.md): dragging a note already on the board into a
    // gap, while Alt is held. Same gate the palette drag uses, so both entry
    // points agree about when the gesture is available.
    insertGate: {
      esBoard,
      readOnly: isReadOnly,
      tabLocked: activeTabLocked,
      createBlocked,
    },
  });

  // The entity's verbs (docs/specs/009-elements/entity.md): fields saved from the canvas, relationships drawn
  // from a field, the ring's Add Field and Add Related Entity, and the Cardinality presets.
  const entityActions = useEntityActions({
    activeTab,
    readSelection,
    commit,
    styleNewElement: styleMemory.styleNewElement,
    setSelectedId,
    setEditingId,
    beginAnchorDrag,
    editsBlocked,
  });

  // Copy / paste (in-app element clipboard + OS-clipboard image
  // paste). `copySelection` feeds the keyboard hook below; paste is
  // driven by a native `paste` listener the hook owns. See
  // useClipboard.
  // The pointer's canvas position while it is over the canvas, null
  // otherwise. Written by the canvas host on every pointer move; read by paste
  // (docs/specs/021-event-storming/event-storming.md "Always on a lane": a paste lands at the pointer).
  const canvasPointerRef = useRef<{ x: number; y: number } | null>(null);
  const { copySelection, pasteFromClipboard, dropBoardFile, hasClipboard } = useClipboard({
    isReadOnly,
    createBlocked,
    explainCreateBlocked: layersState.explainCreateBlocked,
    embedMode,
    readSelection,
    editingId,
    setEditingId,
    activeTab,
    layerLockedIds,
    commit,
    setSelectedId,
    setMultiSelectedIds,
    addImageFromGallery,
    ownerId: selfParticipant.id,
    documentId,
    toast,
    onPastePhoto: readPhotoFile,
    canvasPointerRef,
    getViewportCanvasRect,
    // An Excalidraw copy or file lands through the board-scene insert below (called at paste time).
    insertBoardScene: (scene, at) => void boardSceneInsert.insertScene(scene, at),
  });
  // Board scenes pasted or dropped from another tool (docs/specs/020-import-export/board-scene.md
  // "In the editor"): one commit at the pointer, selected, with its notice.
  const boardSceneInsert = useBoardSceneInsert({
    activeTab,
    drawMode,
    editsBlocked: structureBlocked,
    commit,
    setSelectedId,
    setMultiSelectedIds,
    canvasPointerRef,
    getViewportCenter,
    ownerId: selfParticipant.id,
    documentId,
  });
  // Shapes placed from the palette's My shapes (docs/specs/013-workspace/shape-libraries.md): like a
  // paste, one commit, selected.
  const insertLibraryShape = useLibraryShapeInsert({
    activeTab,
    editsBlocked: structureBlocked,
    commit,
    setSelectedId,
    setMultiSelectedIds,
    getViewportCenter,
  });
  return {
    beginEdit,
    copySelection,
    nudgeSelection,
    typeIntoSelected,
    view: {
      // Clipboard copy, also exposed to the event-storming note menu (docs/specs/021-event-storming/event-storming.md),
      // plus paste + its enabled flag for the canvas menu's Paste row.
      copySelection,
      pasteFromClipboard,
      dropBoardFile,
      hasClipboard,
      boardSceneInsert,
      insertLibraryShape,
      beginAnchorDrag,
      beginArrowCurveDrag,
      beginArrowCurvePointDrag,
      beginArrowBend,
      beginArrowScale,
      deleteCurvePoint,
      beginArrowElbowDrag,
      beginArrowLabelDrag,
      drag,
      beginArrowTranslate,
      beginDrag,
      pressArmedAction,
      beginEdit,
      beginEndpointDrag,
      canvasPointerRef,
      cancelEdit,
      commitLabel,
      commitTable,
      commitHeaderSize,
      followLink,
      linkPickerOpenForId,
      linkPickerInitialMode,
      openLinkPicker,
      applyElementLink,
      voteReview,
      voteResults,
      jumpToVoteResult,
      nextVoteResult,
      prevVoteResult,
      doneVoteReview,
      selectElement,
      entityActions,
      setLinkPickerOpenForId,
      shiftDupGhostIds,
      snapGuideStore,
      toggleInMultiSelect,
    },
  };
}

export type EditorInteractionSlice = ReturnType<typeof useEditorInteraction>;
