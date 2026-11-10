import { useEffect, useMemo } from 'react';
import { checklistDeltaFor, pageSnapBoxes } from '@livedocuments/document';
import { useCellLinkPicker } from '@/hooks/canvas/useCellLinkPicker';
import { useEditorImages } from '@/hooks/canvas/useEditorImages';
import { useElementSelectionActions } from '@/hooks/canvas/useElementSelectionActions';
import { useShapeDrawing } from '@/hooks/canvas/useShapeDrawing';
import { useElementHelpers } from '../useElementHelpers';
import { useElementCreation } from '../useElementCreation';
import { useInlineIconMutators } from '../useInlineIconMutators';
import { useAssignRef } from '@liveworkspace/workbench/hooks/ui/useLatest';
import type { EditorDocument } from './useEditorDocument';
import type { EditorSelection } from './useEditorSelection';
import type { EditorTools } from './useEditorTools';
import type { EditorSession } from './useEditorSession';
import type { EditorCollaboration } from './useEditorCollaboration';
import type { EditorViewport } from './useEditorViewport';
import type { EditorComments } from './useEditorComments';
import type { EditorPages } from './useEditorPages';
import type { EditorLayers } from './useEditorLayers';
import type { EditorHistory } from './useEditorUndoState';
import type { EditorArticles } from './useEditorArticles';
import type { EditorTabs } from './useEditorTabs';

// Making and changing elements: the selection and placement helpers, the checklist tick, images, drawing, palette
// creation, inline icons, table cell links and the structural selection actions.
//
// One slice of useEditorState (../useEditorState.ts), which calls the slices in order and passes each the ones
// before it.
export function useEditorElements({
  documentSlice,
  selectionSlice,
  toolsSlice,
  sessionSlice,
  collaborationSlice,
  viewportSlice,
  commentsSlice,
  pagesSlice,
  layersSlice,
  historySlice,
  articlesSlice,
  tabsSlice,
}: {
  documentSlice: EditorDocument;
  selectionSlice: EditorSelection;
  toolsSlice: EditorTools;
  sessionSlice: EditorSession;
  collaborationSlice: EditorCollaboration;
  viewportSlice: EditorViewport;
  commentsSlice: EditorComments;
  pagesSlice: EditorPages;
  layersSlice: EditorLayers;
  historySlice: EditorHistory;
  articlesSlice: EditorArticles;
  tabsSlice: EditorTabs;
}) {
  // Unmemoised by the React Compiler, as the one hook it was cut from was (see ../useEditorState.ts).
  'use no memo';
  const { embedMode, workbenchMode, commitTabs } = documentSlice;
  const {
    activeId,
    readSelection,
    setSelectedId,
    setEditingId,
    formatSourceId,
    setFormatSourceId,
    setMultiSelectedIds,
  } = selectionSlice;
  const { formatSettings, canvasTool, setCanvasTool } = toolsSlice;
  const { selfParticipant, sessionShareCode, applyElementDelta, documentId, isReadOnly } =
    sessionSlice;
  const { activeTab } = collaborationSlice;
  const { getViewportCenter } = viewportSlice;
  const { lockedByOther } = commentsSlice;
  const { pagesMode, editsBlocked, pictureBlocked, structureBlocked, commit } = pagesSlice;
  const { styleMemory, layerLockedIds, layerInertIds, createBlocked } = layersSlice;
  const { tick } = historySlice;
  const { placeIntentAtRef } = articlesSlice;
  const { putToolDownRef } = tabsSlice;
  // --- Placement helpers ---------------------------------------------------

  // When a boxed element is selected, new elements inherit its size so a
  // user can rapidly build a sequence of similarly-sized nodes.
  // Selection + placement + format helpers. See useElementHelpers.
  const { addBoxedAt, currentSelectionIds, selectionPrimary, applyFormatFromSource } =
    useElementHelpers({
      layerInertIds,
      readSelection,
      activeId,
      activeTab,
      // Creation-only helpers: additionally blocked while the active layer
      // is hidden / locked (docs/specs/006-document/layers.md).
      editsBlocked: createBlocked,
      formatSourceId,
      formatConfig: formatSettings.config,
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
    setImageAlt,
    refreshRecentImages,
    closeImagePicker,
  } = useEditorImages({
    editsBlocked: structureBlocked,
    isReadOnly,
    embedMode,
    // Upload only in a workbench: no gallery read.
    galleryHidden: workbenchMode,
    // A locked tab still takes a picture swap (docs/specs/009-elements/images.md "Locked images").
    pictureBlocked: pictureBlocked || isReadOnly,
    commitPicture: (mapElements) => commit(mapElements, { picture: true }),
    getViewportCenter,
    elements: () => activeTab.elements,
    commit,
    setSelectedId,
    documentId,
    ownerId: selfParticipant.id,
    sessionShareCode,
  });

  // --- Element CRUD --------------------------------------------------------

  // Draw-to-size + polygon tooling (pendingDraw state machine +
  // commit handlers). beginDrawIfEnabled short-circuits the palette
  // adds below into draw mode; the rest is consumed by the Canvas +
  // keyboard hook. See useShapeDrawing.
  // Every page's edges, centre and margin: what a move or resize snaps to besides elements.
  const pageSnapBoxList = useMemo(() => pageSnapBoxes(pagesMode.pages), [pagesMode.pages]);
  const { pendingDraw, beginDraw, commitDraw, cancelDrawShape, beginPolygon, commitPolygon } =
    useShapeDrawing({
      editsBlocked: createBlocked,
      readSelection,
      canvasTool,
      setCanvasTool,
      activeTab,
      commit,
      setSelectedId,
      setMultiSelectedIds,
      setEditingId,
      styleNewElement: styleMemory.styleNewElement,
    });
  useEffect(() => {
    putToolDownRef.current = () => {
      cancelDrawShape();
      setCanvasTool('select');
    };
  });
  // Palette element-creation handlers. See useElementCreation.
  const {
    addShape,
    addIcon,
    addSticker,
    addTechIcon,
    addTable,
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
    addLogoStrip,
    dropPaletteItem,
    placeIntentAt,
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
    addBoxedAt,
    beginDraw,
    styleNewElement: styleMemory.styleNewElement,
    pages: pagesMode.pages,
  });
  useAssignRef(placeIntentAtRef, placeIntentAt);

  // Inline-icon attach/detach mutators (a shape's single inline icon).
  // Cohesive slice extracted to useInlineIconMutators: editsBlocked, commit and the elements.
  const { dropIconOnElement, removeIconFromElement, dropIconElementOnShape } =
    useInlineIconMutators({
      editsBlocked: structureBlocked,
      commit,
      tick,
      elements: activeTab.elements,
    });

  // Per-cell table links (docs/specs/008-canvas/canvas-and-palette.md). Which cell's link picker is open +
  // the history-committed write into that cell's style. See
  // useCellLinkPicker; the shared LinkPickerDialog renders against it
  // in EditorView.
  const { cellLinkPickerOpenFor, setCellLinkPickerOpenFor, openCellLinkPicker, applyCellLink } =
    useCellLinkPicker({ editsBlocked: structureBlocked, commit });

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
    setImageAlt,
    refreshRecentImages,
    closeImagePicker,
    pageSnapBoxList,
    pendingDraw,
    commitDraw,
    cancelDrawShape,
    beginPolygon,
    commitPolygon,
    addShape,
    addIcon,
    addSticker,
    addTechIcon,
    addTable,
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
    addLogoStrip,
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
    spawnConnectSelected,
  };
}

export type EditorElements = ReturnType<typeof useEditorElements>;
