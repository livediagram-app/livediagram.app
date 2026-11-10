'use client';

import { contentAddBlocked } from '@/lib/editor-capabilities';
import { useEffect } from 'react';
import { useWhiteboard } from '@/hooks/canvas/useWhiteboard';
import { useSnapColours } from '@/hooks/canvas/useSnapColours';
import { isPathEditing } from '@/lib/path-edit';
import { usePathCommits } from '@/hooks/canvas/usePathCommits';
import { usePaintBucket } from '@/hooks/canvas/usePaintBucket';
import { applySwatchOverrides } from '@/lib/swatch-overrides';
import { quickSwatches } from '@livediagram/document';
import { useCanvasEraser } from '@/hooks/canvas/useCanvasEraser';
import { useSwatchOverrides } from '@/hooks/canvas/useSwatchOverrides';
import { DEFAULT_SCHEME_ID } from '@livediagram/document';
import { useCellLinkPicker } from '@/hooks/canvas/useCellLinkPicker';
import { writeUserPreferences } from '@/lib/user-preferences';
import { useEditorImages } from '@/hooks/canvas/useEditorImages';
import { useEditorNotes } from '@/hooks/canvas/useEditorNotes';
import { useElementSelectionActions } from '@/hooks/canvas/useElementSelectionActions';
import { useShapeDrawing } from '@/hooks/canvas/useShapeDrawing';
import { useElementCreation } from '../useElementCreation';
import { useMindGrowth } from '../useMindGrowth';
import { useFlowchartGrowth } from '../useFlowchartGrowth';
import { routeGrowth } from '../growth-routing';
import { useMindOutline } from '../useMindOutline';
import { useInlineIconMutators } from '../useInlineIconMutators';
import type { EditorDocumentSlice } from './useEditorDocument';
import type { EditorHistorySlice } from './useEditorUndoState';
import type { EditorSelectionSlice } from './useEditorSelection';
import type { EditorToolsSlice } from './useEditorTools';
import type { EditorCollaborationSlice } from './useEditorCollaboration';
import type { EditorPersistenceSlice } from './useEditorPersistence';
import type { EditorCommentsSlice } from './useEditorComments';
import type { EditorModesSlice } from './useEditorModes';
import type { EditorViewportSlice } from './useEditorViewport';
import type { EditorPresenceSlice } from './useEditorPresence';
import type { EditorEditingSlice } from './useEditorEditing';
import type { EditorLayersSlice } from './useEditorLayers';
import type { EditorTabsSlice } from './useEditorTabs';

// Making things: images, notes, drawing, paths, mind-map and flowchart growth, palette creation, inline icons,
// cell links, selection actions, the whiteboard dock, Fill and the Eraser. A slice of useEditorState
// (../useEditorState.ts): it takes the slices composed before it and returns its own, with `view`, its part of
// the editor's view-model.
export function useEditorCreation({
  fromDocument,
  fromHistory,
  fromSelection,
  fromTools,
  fromCollaboration,
  fromPersistence,
  fromComments,
  fromModes,
  fromViewport,
  fromPresence,
  fromEditing,
  fromLayers,
  fromTabs,
}: {
  fromDocument: EditorDocumentSlice;
  fromHistory: EditorHistorySlice;
  fromSelection: EditorSelectionSlice;
  fromTools: EditorToolsSlice;
  fromCollaboration: EditorCollaborationSlice;
  fromPersistence: EditorPersistenceSlice;
  fromComments: EditorCommentsSlice;
  fromModes: EditorModesSlice;
  fromViewport: EditorViewportSlice;
  fromPresence: EditorPresenceSlice;
  fromEditing: EditorEditingSlice;
  fromLayers: EditorLayersSlice;
  fromTabs: EditorTabsSlice;
}) {
  const { documentId, embedMode, selfParticipant, toast, workbenchMode } = fromDocument;
  const { commitTabs, markCheckpoint } = fromHistory;
  const {
    activeId,
    editingId,
    readSelection,
    setEditingId,
    setFormatSourceId,
    setMultiSelectedIds,
    setSelectedId,
  } = fromSelection;
  const { canvasTool, eraserSettings, selectCanvasTool, setCanvasTool } = fromTools;
  const { isReadOnly, participant, sessionShareCode } = fromCollaboration;
  const { setUserPreferences, userPreferences } = fromPersistence;
  const { activeTab } = fromComments;
  const { drawMode } = fromModes;
  const { getViewportCenter, scrollIntoView, zoomRef } = fromViewport;
  const { lockedByOther } = fromPresence;
  const { activeTheme, commit, editsBlocked, pictureBlocked, structureBlocked, styleMemory } =
    fromEditing;
  const {
    addBoxed,
    addBoxedAt,
    createBlocked,
    currentSelectionIds,
    layerInertIds,
    layerLockedIds,
    structureCreateBlocked,
    tick,
  } = fromLayers;
  const { putToolDownRef } = fromTabs;

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
    documentId,
    ownerId: selfParticipant.id,
    sessionShareCode,
  });

  // Per-element note popover (single plain-text paragraph; see
  // packages/document BoxedElement.note). State + handlers in
  // useEditorNotes.
  const { noteOpenId, openNote, closeNote, setNote } = useEditorNotes({ commit });

  // --- Element CRUD --------------------------------------------------------

  // Draw-to-size + freehand pen tooling (pendingDraw state machine +
  // commit handlers). beginDrawIfEnabled short-circuits the palette
  // adds below into draw mode; the rest is consumed by the Canvas +
  // keyboard hook. See useShapeDrawing.
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
    commitFreehand,
    commitPolygon,
    highlighter,
  } = useShapeDrawing({
    editsBlocked: createBlocked,
    readSelection,
    canvasTool,
    setCanvasTool,
    activeTab,
    drawMode,
    commit,
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
    commit,
    elements: () => activeTab.elements,
    styleNewElement: styleMemory.styleNewElement,
    setSelectedId,
  });

  // Mind-map growth (docs/specs/009-elements/mind-node.md) and flowchart growth
  // (docs/specs/009-elements/flowchart.md): Tab / Enter / the "+" ring, routed through one API
  // (growth-routing.ts) so the keyboard and label-editor plumbing serves both.
  const growthOpts = {
    // A Participant grows a mind map or a flowchart (docs/specs/013-workspace/share-roles.md): branches
    // and steps are content.
    editsBlocked: contentAddBlocked({
      participating: participant.participating,
      canAddContent: participant.can.addContent,
      blocked: createBlocked,
      structureBlocked: structureCreateBlocked,
    }),
    participating: participant.participating,
    activeId,
    activeTab,
    commitTabs,
    setSelectedId,
    setEditingId,
    scrollIntoView,
  };
  const flowchartGrowth = useFlowchartGrowth(growthOpts);
  const { canGrowMindNode, growMindNode, abandonMindNode, escapeGrownMindNode } = routeGrowth(
    useMindGrowth(growthOpts),
    flowchartGrowth,
  );

  // Edit Outline (docs/specs/009-elements/mind-node.md "Edit Outline"). See useMindOutline.
  const mindOutline = useMindOutline({
    editsBlocked: structureCreateBlocked,
    activeId,
    activeTab,
    commitTabs,
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
    addFlowchart,
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

  // Snap colours (docs/specs/023-draw-mode/draw-mode.md "Snap colours"): one commit, one undo step.
  const snapColours = useSnapColours({
    elements: activeTab.elements,
    inertIds: layerInertIds,
    editsBlocked: structureBlocked,
    commit,
  });

  // The whiteboard dock (docs/specs/023-draw-mode/draw-mode.md): device-local pens, recognition and
  // eraser mode, and the dock presses turned into ordinary editor calls.
  // The quick style panel's custom swatches (docs/specs/008-canvas/quick-style-panel.md), read by the
  // panel and by the Fill tool's colours (docs/specs/023-draw-mode/fill-tool.md).
  const swatchOverrides = useSwatchOverrides({
    themeId: activeTab.theme ?? DEFAULT_SCHEME_ID,
    userPreferences,
    setUserPreferences,
    writeUserPreferences,
    ownerId: selfParticipant.id,
  });
  const whiteboardDock = useWhiteboard({
    activeTab,
    drawMode,
    canvasTool,
    pendingDraw,
    editsBlocked: structureCreateBlocked,
    setCanvasTool,
    selectCanvasTool,
    beginDraw,
    cancelDraw: cancelDrawShape,
    pathEditing: isPathEditing(activeTab.elements, editingId),
    leavePathEdit: () => setEditingId(null),
    snapColours,
    fillSwatches: applySwatchOverrides(
      quickSwatches(activeTheme, 'fill'),
      swatchOverrides.overrides.fill,
    ),
    userPreferences,
    setUserPreferences,
    writeUserPreferences,
    ownerId: selfParticipant.id,
  });
  // The Fill tool's press (docs/specs/023-draw-mode/fill-tool.md): what it fills, as one commit.
  const { paintBucket } = usePaintBucket({
    pendingDraw,
    elements: () => activeTab.elements,
    layers: activeTab.layers,
    inertIds: layerInertIds,
    editsBlocked: structureBlocked,
    canRecolour: participant.can.recolour,
    commit,
    hint: toast.info,
  });

  // Eraser canvas tool (docs/specs/008-canvas/canvas-and-palette.md): press / drag to delete any element the
  // pointer touches, as a single-undo gesture. Canvas calls beginErase
  // from its capture-phase pointerdown. See useCanvasEraser.
  const { beginErase } = useCanvasEraser({
    config: eraserSettings.config,
    whiteboard: whiteboardDock.whiteboard ? { mode: whiteboardDock.prefs.eraserMode } : null,
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
    addArrow,
    addImage,
    addImageFromGallery,
    addShape,
    addSticky,
    addText,
    beginFreehand,
    beginShapePen,
    canGrowMindNode,
    cancelDrawShape,
    commitDraw,
    connectArrowTo,
    connectSourceId,
    deleteMultiSelected,
    deleteSelected,
    dropIconElementOnShape,
    duplicateMultiSelected,
    duplicateSelected,
    escapeGrownMindNode,
    growMindNode,
    highlighter,
    pendingDraw,
    selectMarquee,
    swatchOverrides,
    toggleLockMultiSelected,
    whiteboardDock,
    view: {
      whiteboardDock,
      addArrow,
      addIcon,
      addSticker,
      addTechIcon,
      connectSourceId,
      connectArrowTo,
      cancelConnect,
      dropIconOnElement,
      removeIconFromElement,
      addImage,
      addImageFromGallery,
      addShape,
      addSticky,
      addTable,
      addAnnotation,
      addLinkCard,
      addVideo,
      addBanner,
      addHero,
      addHeader,
      addCallout,
      addStatRow,
      addProcess,
      addFlowchart,
      addAvatar,
      dropPaletteItem,
      addText,
      applyImageToElement,
      beginFreehand,
      beginHighlighter,
      beginMarker,
      beginShapePen,
      beginPolygon,
      cancelDrawShape,
      beginErase,
      closeImagePicker,
      closeNote,
      commitDraw,
      commitFreehand,
      commitPolygon,
      commitPath,
      paintBucket,
      commitPathEdit,
      deleteMultiSelected,
      deleteSelected,
      spawnConnectSelected,
      duplicateMultiSelected,
      duplicateSelected,
      // Intra-layer z-order for the selection popover (docs/specs/006-document/layers.md).
      stackSelectedFront,
      stackSelectedBack,
      handleCanvasDoubleClick,
      imageContext,
      imagePickerOpenFor,
      cellLinkPickerOpenFor,
      setCellLinkPickerOpenFor,
      openCellLinkPicker,
      applyCellLink,
      narrowMultiSelection,
      noteOpenId,
      openNote,
      pendingDraw,
      refreshRecentImages,
      removeImageFromElement,
      selectMarquee,
      growMindNode,
      abandonMindNode,
      mindOutline,
      setNote,
      toggleLockMultiSelected,
    },
  };
}

export type EditorCreationSlice = ReturnType<typeof useEditorCreation>;
