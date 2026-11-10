import { pageStep } from '@liveworkspace/workbench/lib/page-step';
import { openSearchWithPrefetch } from '@liveworkspace/workbench/lib/open-search';
import { useRef } from 'react';
import { selectAllIds } from '@/lib/select-all-ids';
import { currentPageIdNow } from '@/lib/current-page-kind';
import { useClipboard } from '@/hooks/canvas/useClipboard';
import { useCanvasA11y } from '@/hooks/canvas/useCanvasA11y';
import { useNudgeSelection } from '@/hooks/canvas/useNudgeSelection';
import { MAKE_COMPONENT_REFUSAL } from '../useComponentActions';
import { track } from '@/lib/telemetry';
import { useEditorDrag } from '@/hooks/canvas/useEditorDrag';
import { useElementLinks } from '@/hooks/canvas/useElementLinks';
import { useEditorKeyboardShortcuts } from '@/hooks/canvas/useEditorKeyboardShortcuts';
import { useSelectionEditing } from '../useSelectionEditing';
import type { EditorDesignSlice } from './useEditorDesign';
import type { EditorSelection } from './useEditorSelection';
import type { EditorTools } from './useEditorTools';
import type { EditorSession } from './useEditorSession';
import type { EditorCollaboration } from './useEditorCollaboration';
import type { EditorViewport } from './useEditorViewport';
import type { EditorComments } from './useEditorComments';
import type { EditorPages } from './useEditorPages';
import type { EditorComponents } from './useEditorComponents';
import type { EditorLayers } from './useEditorLayers';
import type { EditorHistory } from './useEditorUndoState';
import type { EditorTabs } from './useEditorTabs';
import type { EditorElements } from './useEditorElements';
import type { EditorStyle } from './useEditorStyle';

// Pointer, keyboard and clipboard: element links, selection editing, canvas accessibility, the nudge, the drag
// state machine, copy and paste, Zen mode and the global keyboard shortcuts.
//
// One slice of useEditorState (../useEditorState.ts), which calls the slices in order and passes each the ones
// before it.
export function useEditorInput({
  designSlice,
  selectionSlice,
  toolsSlice,
  sessionSlice,
  collaborationSlice,
  viewportSlice,
  commentsSlice,
  pagesSlice,
  componentsSlice,
  layersSlice,
  historySlice,
  tabsSlice,
  elementsSlice,
  styleSlice,
}: {
  designSlice: EditorDesignSlice;
  selectionSlice: EditorSelection;
  toolsSlice: EditorTools;
  sessionSlice: EditorSession;
  collaborationSlice: EditorCollaboration;
  viewportSlice: EditorViewport;
  commentsSlice: EditorComments;
  pagesSlice: EditorPages;
  componentsSlice: EditorComponents;
  layersSlice: EditorLayers;
  historySlice: EditorHistory;
  tabsSlice: EditorTabs;
  elementsSlice: EditorElements;
  styleSlice: EditorStyle;
}) {
  const { embedMode, tabs, tickTabs, markCheckpoint, cancelToCheckpoint } = designSlice;
  const {
    setActiveId,
    readSelection,
    selectionStore,
    setSelectedId,
    editingId,
    setEditingId,
    setEditCursorAtEnd,
    formatSourceId,
    setFormatSourceId,
    setMultiSelectedIds,
  } = selectionSlice;
  const { panelLayout, dialogs, canvasTool, formatToolActive, pickCanvasTool } = toolsSlice;
  const {
    selfParticipant,
    shortcutsEnabled,
    autoRebindArrowsRef,
    alignmentGuidesRef,
    setContextMenu,
    toast,
    designName,
    setDesignName,
    designId,
    isReadOnly,
    participant,
  } = sessionSlice;
  const { componentLibrary, loadAllTabs, activeTab, editorMode } = collaborationSlice;
  const { setViewportZoom, zoomRef, getViewportCanvasRect, scrollIntoView, isPinchingRef } =
    viewportSlice;
  const { lockedByOther } = commentsSlice;
  const { pagesMode, activeTabLocked, editsBlocked, commit } = pagesSlice;
  const { componentActions } = componentsSlice;
  const { styleMemory, layersState, layerLockedIds, layerInertIds, createBlocked } = layersSlice;
  const { tick, undo, redo } = historySlice;
  const { openDesign } = tabsSlice;
  const {
    currentSelectionIds,
    applyFormatFromSource,
    addImageFromGallery,
    logo,
    pendingDraw,
    cancelDrawShape,
    beginFreehand,
    beginShapePen,
    addShape,
    addImage,
    addText,
    addSticky,
    addArrow,
    connectSourceId,
    connectArrowTo,
    dropIconElementOnShape,
    deleteSelected,
    toggleLockMultiSelected,
    duplicateMultiSelected,
    deleteMultiSelected,
    duplicateSelected,
  } = elementsSlice;
  const { toggleLockSelected, bringSelectedToFront, sendSelectedToBack } = styleSlice;
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
    openDesign,
  });

  // Selection-editing handlers (label edit, type-to-edit,
  // single + shift-click select). See useSelectionEditing.
  const {
    beginEdit,
    commitLabel,
    commitTable,
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
    designName,
    tabs,
    activeTab,
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
      setDesignName,
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
  // listeners live in useEditorDrag (see apps/live/hooks/useEditorDrag.ts).
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
    inspectToolActive: canvasTool === 'inspect',
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
    // Every page's edges and margin, and a logo page's keylines (useLogoEditor).
    pageSnapBoxes: logo.snapBoxes,
    pagesMode: pagesMode.pages,
    isPinchingRef,
  });

  // Copy / paste (in-app element clipboard + OS-clipboard image
  // paste). `copySelection` feeds the keyboard hook below; paste is
  // driven by a native `paste` listener the hook owns. See
  // useClipboard.
  // The pointer's canvas position while it is over the canvas, null
  // otherwise. Written by the canvas host on every pointer move; read by paste
  //.
  const canvasPointerRef = useRef<{ x: number; y: number } | null>(null);
  const { copySelection, pasteFromClipboard, dropBoardFile, hasClipboard } = useClipboard({
    addMissingComponents: componentLibrary.addMissing,
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
    designId,
    toast,
    getViewportCanvasRect,
  });

  // Zen / focus mode (docs/specs/007-editor/zen-mode.md). Flips the chrome-hidden flag and emits
  // the toggle telemetry BEFORE the state change (matches the dark-mode /
  // settings pattern so an opt-out still reaches the wire). Shared by the
  // palette enter button, the zoom-dock exit button, and the Z shortcut.
  const toggleZenMode = () => {
    const next = !panelLayout.zenMode;
    track('UI', 'Toggled', next ? 'ZenModeOn' : 'ZenModeOff');
    panelLayout.setZenMode(next);
  };

  // Global keyboard shortcuts (Escape cancels modes / deselects, Delete /
  // Backspace wipes selection, Cmd-Z / Cmd-Shift-Z undo / redo, Cmd-X / -C
  // / -V cut / copy / paste, Cmd-D duplicate, V / H / K canvas-tool switch,
  // Z zen, z-order + fit-to-screen). The full keymap + rationale lives in
  // useEditorKeyboardShortcuts and is catalogued in docs/specs/008-canvas/canvas-and-palette.md.
  useEditorKeyboardShortcuts({
    onMakeComponent: () => {
      const { selectedId, multiSelectedIds } = readSelection();
      const ids =
        multiSelectedIds.size > 0 ? multiSelectedIds : new Set(selectedId ? [selectedId] : []);
      const refusal = componentActions.makeRefusal(ids);
      if (refusal) toast.info(MAKE_COMPONENT_REFUSAL[refusal]);
      else componentActions.makeFromSelection(ids);
    },
    onDetachComponent: () => {
      const { selectedId } = readSelection();
      if (selectedId) componentActions.detach(selectedId);
    },
    formatSourceId,
    setFormatSourceId,
    readSelection,
    editingId,
    // While Inspect is on the keys act as a Viewer's (docs/specs/007-editor/wireframe-pages.md "Inspect").
    isReadOnly: isReadOnly || canvasTool === 'inspect',
    participant: participant.participating && canvasTool !== 'inspect',
    deleteSelected,
    deleteMultiSelected,
    undo,
    redo,
    copySelection,
    setCanvasTool: pickCanvasTool,
    canvasTool,
    addShape,
    addText,
    addSticky,
    addArrow,
    onAddImage: addImage ?? null,
    onBeginFreehand: beginFreehand,
    onBeginShapePen: beginShapePen,
    onBeginEditSelected: beginEdit,
    onNudgeSelection: nudgeSelection,
    onStepPage: (dir) => {
      const to = pageStep(pagesMode.pages, currentPageIdNow(), dir);
      if (to) pagesMode.focusPage(to);
      return !!to;
    },
    onTypeIntoSelected: typeIntoSelected,
    pendingDraw,
    onCancelDraw: cancelDrawShape,
    onToggleLock: () => {
      if (readSelection().multiSelectedIds.size > 0) {
        toggleLockMultiSelected();
      } else {
        toggleLockSelected();
      }
    },
    onSelectAll: () => {
      // Hidden / locked layers are left out; in Pages mode, every page but the one someone is on.
      const allIds = selectAllIds(activeTab, editorMode.mode, layerInertIds, currentPageIdNow());
      if (allIds.size === 0) return;
      setSelectedId(null);
      setMultiSelectedIds(allIds);
    },
    onDuplicate: () => {
      if (readSelection().multiSelectedIds.size > 0) {
        duplicateMultiSelected();
      } else {
        duplicateSelected();
      }
    },
    onCut: () => {
      // Copy to the in-app clipboard, then delete: the two halves the
      // editor already exposes, composed into one undo-friendly action.
      copySelection({ cut: true });
      if (readSelection().multiSelectedIds.size > 0) {
        deleteMultiSelected();
      } else {
        deleteSelected();
      }
    },
    onBringToFront: bringSelectedToFront,
    onSendToBack: sendSelectedToBack,
    // Fit frames the page you are nearest, not the whole tab.
    onFitToScreen: pagesMode.fitPageInView,
    onDeselect: () => {
      setSelectedId(null);
      setMultiSelectedIds(new Set());
    },
    onZoomIn: () => setViewportZoom((z) => Math.min(5, Math.round((z + 0.1) * 10) / 10)),
    onZoomOut: () => setViewportZoom((z) => Math.max(0.1, Math.round((z - 0.1) * 10) / 10)),
    onZoomReset: () => setViewportZoom(1),
    zenMode: panelLayout.zenMode,
    onToggleZen: toggleZenMode,
    onOpenSearch: () => openSearchWithPrefetch(dialogs.setSearchOpen, loadAllTabs),
    enabled: shortcutsEnabled,
  });

  return {
    linkPickerOpenForId,
    setLinkPickerOpenForId,
    linkPickerInitialMode,
    openLinkPicker,
    applyElementLink,
    followLink,
    beginEdit,
    commitLabel,
    commitTable,
    cancelEdit,
    selectElement,
    toggleInMultiSelect,
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
    canvasPointerRef,
    copySelection,
    pasteFromClipboard,
    dropBoardFile,
    hasClipboard,
    toggleZenMode,
  };
}

export type EditorInput = ReturnType<typeof useEditorInput>;
