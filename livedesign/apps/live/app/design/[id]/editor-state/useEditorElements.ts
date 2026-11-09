import { contentAddBlocked } from '@/lib/editor-capabilities';
import { useEffect } from 'react';
import { useMarkerPens } from '@/hooks/canvas/useMarkerPens';
import { usePathCommits } from '@/hooks/canvas/usePathCommits';
import { useCanvasEraser } from '@/hooks/canvas/useCanvasEraser';
import { checklistDeltaFor } from '@livedesign/design';
import { usePhotoEditor } from '@/hooks/editor/usePhotoEditor';
import { useLogoEditor } from '@/hooks/editor/useLogoEditor';
import { useCellLinkPicker } from '@/hooks/canvas/useCellLinkPicker';
import { useEditorImages } from '@/hooks/canvas/useEditorImages';
import { useEditorNotes } from '@/hooks/canvas/useEditorNotes';
import { useElementSelectionActions } from '@/hooks/canvas/useElementSelectionActions';
import { useShapeDrawing } from '@/hooks/canvas/useShapeDrawing';
import { useElementHelpers } from '../useElementHelpers';
import { useElementCreation } from '../useElementCreation';
import { useInlineIconMutators } from '../useInlineIconMutators';
import type { EditorDesignSlice } from './useEditorDesign';
import type { EditorSelection } from './useEditorSelection';
import type { EditorTools } from './useEditorTools';
import type { EditorSession } from './useEditorSession';
import type { EditorCollaboration } from './useEditorCollaboration';
import type { EditorViewport } from './useEditorViewport';
import type { EditorComments } from './useEditorComments';
import type { EditorPages } from './useEditorPages';
import type { EditorLayers } from './useEditorLayers';
import type { EditorHistory } from './useEditorUndoState';
import type { EditorTabs } from './useEditorTabs';

// Making and changing elements: the selection and placement helpers, the checklist tick, images, notes, logo and
// photo pages, drawing and the Path tool, palette creation, inline icons, table cell links, the structural
// selection actions, and the marker pens and eraser.
//
// One slice of useEditorState (../useEditorState.ts), which calls the slices in order and passes each the ones
// before it.
export function useEditorElements({
  designSlice,
  selectionSlice,
  toolsSlice,
  sessionSlice,
  collaborationSlice,
  viewportSlice,
  commentsSlice,
  pagesSlice,
  layersSlice,
  historySlice,
  tabsSlice,
}: {
  designSlice: EditorDesignSlice;
  selectionSlice: EditorSelection;
  toolsSlice: EditorTools;
  sessionSlice: EditorSession;
  collaborationSlice: EditorCollaboration;
  viewportSlice: EditorViewport;
  commentsSlice: EditorComments;
  pagesSlice: EditorPages;
  layersSlice: EditorLayers;
  historySlice: EditorHistory;
  tabsSlice: EditorTabs;
}) {
  const {
    embedMode,
    workbenchMode,
    historyDepth,
    historyBranch,
    undoHistory,
    redoHistory,
    tickTabs,
    commitTabs,
    markCheckpoint,
    cancelToCheckpoint,
  } = designSlice;
  const {
    activeId,
    readSelection,
    setSelectedId,
    setEditingId,
    formatSourceId,
    setFormatSourceId,
    setMultiSelectedIds,
  } = selectionSlice;
  const { eraserSettings, formatSettings, canvasTool, setCanvasTool } = toolsSlice;
  const {
    selfParticipant,
    sessionShareCode,
    applyElementDelta,
    userPreferences,
    setUserPreferences,
    toast,
    designId,
    isReadOnly,
    participant,
  } = sessionSlice;
  const { photoPresence, activeTab } = collaborationSlice;
  const { viewport, zoomRef, getViewportCenter, getViewportCanvasRect } = viewportSlice;
  const { lockedByOther } = commentsSlice;
  const { pagesMode, editsBlocked, pictureBlocked, structureBlocked, commit } = pagesSlice;
  const { styleMemory, layerLockedIds, layerInertIds, createBlocked, structureCreateBlocked } =
    layersSlice;
  const { tick } = historySlice;
  const { putToolDownRef } = tabsSlice;
  // --- Placement helpers ---------------------------------------------------

  // When a boxed element is selected, new elements inherit its size so a
  // user can rapidly build a sequence of similarly-sized nodes.
  // Selection + placement + format helpers. See useElementHelpers.
  const { addBoxed, addBoxedAt, currentSelectionIds, selectionPrimary, applyFormatFromSource } =
    useElementHelpers({
      layerInertIds,
      readSelection,
      activeId,
      activeTab,
      // Creation-only helpers: additionally blocked while the active layer
      // is hidden / locked (docs/specs/006-design/layers.md). Open to a Participant that may add content
      // (docs/specs/013-workspace/share-roles.md): a sticky, text or image dragged from its palette lands through
      // addBoxedAt, and every commit it makes still passes participant.guardCommit.
      editsBlocked: contentAddBlocked({
        participating: participant.participating,
        canAddContent: participant.can.addContent,
        blocked: createBlocked,
        structureBlocked: structureCreateBlocked,
      }),
      formatSourceId,
      formatConfig: formatSettings.config,
      getViewportCenter,
      commit,
      commitTabs,
      setSelectedId,
      setEditingId,
      setFormatSourceId,
    });

  // A checklist tick is a room press like an answer (docs/specs/012-collaboration/collab-race-hardening.md): applied here
  // and sent to the room as a delta, never undoable. Box ticks deliberately don't track: high-frequency, low-signal.
  const toggleChecklistItem = (elementId: string, index: number) => {
    if (editsBlocked) return;
    const element = activeTab.elements.find((el) => el.id === elementId);
    const delta = element ? checklistDeltaFor(element, index) : null;
    if (delta) applyElementDelta(elementId, delta);
  };

  // Image domain (picker state, recent-images list, placement + fill
  // handlers). Lives in its own hook so the page no longer carries
  // that state or its six handlers — see useEditorImages + docs/specs/009-elements/images.md.
  const {
    imagePickerOpenFor,
    imageContext,
    addImageFromGallery,
    applyImageToElement,
    removeImageFromElement,
    refreshRecentImages,
    closeImagePicker,
  } = useEditorImages({
    // A Participant places images and swaps their pictures (docs/specs/013-workspace/share-roles.md).
    editsBlocked: contentAddBlocked({
      participating: participant.participating,
      canAddContent: participant.can.addContent,
      blocked: editsBlocked,
      structureBlocked,
    }),
    isReadOnly: isReadOnly && !(participant.participating && participant.can.addContent),
    embedMode,
    // Upload only in a workbench: no gallery read.
    galleryHidden: workbenchMode,
    // A locked tab still takes a picture swap (docs/specs/009-elements/images.md "Locked images").
    pictureBlocked: contentAddBlocked({
      participating: participant.participating,
      canAddContent: participant.can.addContent,
      blocked: pictureBlocked,
      structureBlocked: pictureBlocked || isReadOnly,
    }),
    commitPicture: (mapElements) => commit(mapElements, { picture: true }),
    getViewportCenter,
    commit,
    setSelectedId,
    designId,
    ownerId: selfParticipant.id,
    sessionShareCode,
  });

  // Per-element note popover (single plain-text paragraph; see
  // packages/design BoxedElement.note). State + handlers in
  // useEditorNotes.
  const { noteOpenId, openNote, closeNote, setNote } = useEditorNotes({ commit });

  // --- Element CRUD --------------------------------------------------------

  // Draw-to-size + freehand pen tooling (pendingDraw state machine +
  // commit handlers). beginDrawIfEnabled short-circuits the palette
  // adds below into draw mode; the rest is consumed by the Canvas +
  // keyboard hook. See useShapeDrawing.
  // Logo pages (docs/specs/007-editor/logo-pages.md): the mirror-aware draw commit, the logo tools,
  // previews, Combine and the keyline snaps. See useLogoEditor.
  const logo = useLogoEditor({
    pagesModeView: pagesMode,
    pages: pagesMode.pages,
    activeTab,
    commit,
    currentSelectionIds,
    setSelectedId,
    setMultiSelectedIds,
    prefs: userPreferences,
    setPrefs: setUserPreferences,
    selfId: selfParticipant.id,
    toast,
    readOnly: isReadOnly,
    getZoom: () => zoomRef.current,
  });
  const { canCombine, combineSelected, canTidyUp, tidyUpSelected } = logo;
  // Photo pages (docs/specs/031-photo/photo-pages.md): the page in focus, its editing session, the
  // History and the previews. See usePhotoEditor.
  const photoEditor = usePhotoEditor({
    pagesModeView: logo.view,
    pages: pagesMode?.pages ?? null,
    activeTab,
    commitTabs,
    tickTabs,
    markCheckpoint,
    cancelToCheckpoint,
    undo: undoHistory,
    redo: redoHistory,
    depth: historyDepth,
    branch: historyBranch,
    visibleRect: getViewportCanvasRect,
    viewport,
    scope: imageContext ?? null,
    canEdit: participant.can.photoEdit && !isReadOnly,
    canInspect: participant.can.photoInspect,
    presence: photoPresence.presence,
    toast,
  });
  const {
    pendingDraw,
    beginDraw,
    commitDraw,
    cancelDrawShape,
    beginFreehand,
    beginHighlighter,
    beginMarker,
    beginShapePen,
    beginPolygon,
    beginPath,
    commitFreehand,
    commitPolygon,
    highlighter,
  } = useShapeDrawing({
    editsBlocked: createBlocked,
    readSelection,
    canvasTool,
    setCanvasTool,
    activeTab,
    commit: logo.drawCommit,
    setSelectedId,
    setMultiSelectedIds,
    setEditingId,
    zoomRef,
    styleNewElement: styleMemory.styleNewElement,
  });
  useEffect(() => {
    putToolDownRef.current = () => {
      cancelDrawShape();
      setCanvasTool('select');
    };
  });
  // The Path tool (docs/specs/023-draw-mode/path-tool.md): a drawn path, a continued one, an edit.
  const { commitPath, commitPathEdit } = usePathCommits({
    editsBlocked: structureCreateBlocked,
    commit: logo.drawCommit,
    elements: () => activeTab.elements,
    styleNewElement: styleMemory.styleNewElement,
    setSelectedId,
  });

  // Palette element-creation handlers. See useElementCreation.
  const {
    addShape,
    addIcon,
    addSticker,
    addTechIcon,
    addTable,
    addAnnotation,
    addLinkCard,
    addVideo,
    addImage,
    addBanner,
    addHero,
    addHeader,
    addCallout,
    addStatRow,
    addProcess,
    addAvatar,
    dropPaletteItem,
    addText,
    addSticky,
    addArrow,
    handleCanvasDoubleClick,
    connectSourceId,
    connectArrowTo,
    cancelConnect,
  } = useElementCreation({
    editsBlocked: createBlocked,
    imagesBlocked: embedMode,
    activeId,
    activeTab,
    readSelection,
    commitTabs,
    setSelectedId,
    setEditingId,
    addBoxed,
    addBoxedAt,
    beginDraw,
    styleNewElement: styleMemory.styleNewElement,
    pages: pagesMode.pages,
  });

  // Inline-icon attach/detach mutators (a shape's single inline icon).
  // Cohesive slice extracted to useInlineIconMutators: editsBlocked, commit and the elements.
  const { dropIconOnElement, removeIconFromElement, dropIconElementOnShape } =
    useInlineIconMutators({ editsBlocked, commit, tick, elements: activeTab.elements });

  // Per-cell table links (docs/specs/008-canvas/canvas-and-palette.md). Which cell's link picker is open +
  // the history-committed write into that cell's style. See
  // useCellLinkPicker; the shared LinkPickerDialog renders against it
  // in EditorView.
  const { cellLinkPickerOpenFor, setCellLinkPickerOpenFor, openCellLinkPicker, applyCellLink } =
    useCellLinkPicker({ editsBlocked, commit });

  // Structural element operations (delete, marquee commit, lock, and the
  // duplicate family). They change the element set
  // and/or the selection rather than element fields; see
  // useElementSelectionActions.
  const {
    deleteSelected,
    selectMarquee,
    toggleLockMultiSelected,
    duplicateMultiSelected,
    deleteMultiSelected,
    narrowMultiSelection,
    duplicateSelected,
    stackSelectedFront,
    stackSelectedBack,
    spawnConnectSelected,
  } = useElementSelectionActions({
    currentSelectionIds,
    readSelection,
    activeTab,
    commit,
    setSelectedId,
    setEditingId,
    setMultiSelectedIds,
    setFormatSourceId,
    lockedByOther,
    layerLockedIds,
    layerInertIds,
  });

  // The three markers' colours and widths (docs/specs/023-draw-mode/drawing-tools.md "Markers"),
  // device-local, for a logo page's Draw and the quick style panel's pen rows.
  const markerPens = useMarkerPens();

  // Eraser canvas tool (docs/specs/008-canvas/canvas-and-palette.md): press / drag to delete any element the
  // pointer touches, as a single-undo gesture. Canvas calls beginErase
  // from its capture-phase pointerdown. See useCanvasEraser.
  const { beginErase } = useCanvasEraser({
    config: eraserSettings.config,
    editsBlocked: structureBlocked,
    layerInertIds,
    activeId,
    activeTab,
    tick,
    markCheckpoint,
    setSelectedId,
    setEditingId,
  });

  return {
    currentSelectionIds,
    selectionPrimary,
    applyFormatFromSource,
    toggleChecklistItem,
    imagePickerOpenFor,
    imageContext,
    addImageFromGallery,
    applyImageToElement,
    removeImageFromElement,
    refreshRecentImages,
    closeImagePicker,
    noteOpenId,
    openNote,
    closeNote,
    setNote,
    logo,
    canCombine,
    combineSelected,
    canTidyUp,
    tidyUpSelected,
    photoEditor,
    pendingDraw,
    beginDraw,
    commitDraw,
    cancelDrawShape,
    beginFreehand,
    beginHighlighter,
    beginMarker,
    beginShapePen,
    beginPolygon,
    beginPath,
    commitFreehand,
    commitPolygon,
    highlighter,
    commitPath,
    commitPathEdit,
    addShape,
    addIcon,
    addSticker,
    addTechIcon,
    addTable,
    addAnnotation,
    addLinkCard,
    addVideo,
    addImage,
    addBanner,
    addHero,
    addHeader,
    addCallout,
    addStatRow,
    addProcess,
    addAvatar,
    dropPaletteItem,
    addText,
    addSticky,
    addArrow,
    handleCanvasDoubleClick,
    connectSourceId,
    connectArrowTo,
    cancelConnect,
    dropIconOnElement,
    removeIconFromElement,
    dropIconElementOnShape,
    cellLinkPickerOpenFor,
    setCellLinkPickerOpenFor,
    openCellLinkPicker,
    applyCellLink,
    deleteSelected,
    selectMarquee,
    toggleLockMultiSelected,
    duplicateMultiSelected,
    deleteMultiSelected,
    narrowMultiSelection,
    duplicateSelected,
    stackSelectedFront,
    stackSelectedBack,
    spawnConnectSelected,
    markerPens,
    beginErase,
  };
}

export type EditorElements = ReturnType<typeof useEditorElements>;
