'use client';

import { contentAddBlocked } from '@/lib/editor-capabilities';
import { useEffect } from 'react';
import { useSwatchOverrides } from '@/hooks/canvas/useSwatchOverrides';
import { DEFAULT_SCHEME_ID } from '@livehuddle/document';
import { writeUserPreferences } from '@/lib/user-preferences';
import { useEditorImages } from '@/hooks/canvas/useEditorImages';
import { useEditorNotes } from '@/hooks/canvas/useEditorNotes';
import { useElementSelectionActions } from '@/hooks/canvas/useElementSelectionActions';
import { useShapeDrawing } from '@/hooks/canvas/useShapeDrawing';
import { useElementCreation } from '../useElementCreation';
import { useInlineIconMutators } from '../useInlineIconMutators';
import type { EditorDocumentSlice } from './useEditorDocument';
import type { EditorHistorySlice } from './useEditorUndoState';
import type { EditorSelectionSlice } from './useEditorSelection';
import type { EditorToolsSlice } from './useEditorTools';
import type { EditorCollaborationSlice } from './useEditorCollaboration';
import type { EditorPersistenceSlice } from './useEditorPersistence';
import type { EditorCommentsSlice } from './useEditorComments';
import type { EditorPresenceSlice } from './useEditorPresence';
import type { EditorEditingSlice } from './useEditorEditing';
import type { EditorTabsSlice } from './useEditorTabs';

// Making things: images, notes, drawing (room walls included), palette creation, inline icons and selection
// actions. A slice of useEditorState (../useEditorState.ts): it takes the slices composed before it and returns
// its own, with `view`, its part of the editor's view-model.
export function useEditorCreation({
  fromDocument,
  fromHistory,
  fromSelection,
  fromTools,
  fromCollaboration,
  fromPersistence,
  fromComments,
  fromPresence,
  fromEditing,
  fromTabs,
}: {
  fromDocument: EditorDocumentSlice;
  fromHistory: EditorHistorySlice;
  fromSelection: EditorSelectionSlice;
  fromTools: EditorToolsSlice;
  fromCollaboration: EditorCollaborationSlice;
  fromPersistence: EditorPersistenceSlice;
  fromComments: EditorCommentsSlice;
  fromPresence: EditorPresenceSlice;
  fromEditing: EditorEditingSlice;
  fromTabs: EditorTabsSlice;
}) {
  const { documentId, embedMode, selfParticipant } = fromDocument;
  const { commitTabs } = fromHistory;
  const {
    activeId,
    readSelection,
    selectionStore,
    setEditingId,
    setFormatSourceId,
    setMultiSelectedIds,
    setSelectedId,
  } = fromSelection;
  const { canvasTool, setCanvasTool } = fromTools;
  const { isReadOnly, participant, sessionShareCode } = fromCollaboration;
  const { setUserPreferences, userPreferences } = fromPersistence;
  const { activeTab } = fromComments;
  const { lockedByOther } = fromPresence;
  const {
    addBoxedAt,
    commit,
    currentSelectionIds,
    editsBlocked,
    structureBlocked,
    styleMemory,
    tick,
  } = fromEditing;
  const { putToolDownRef } = fromTabs;
  // Image domain (picker state, recent-images list, placement + fill
  // handlers). Lives in its own hook so the page no longer carries
  // that state or its six handlers — see useEditorImages + docs/specs/009-elements/images.md.
  const {
    imagePickerOpenFor,
    imageContext,
    applyImageToElement,
    removeImageFromElement,
    refreshRecentImages,
    closeImagePicker,
  } = useEditorImages({
    // A Participant swaps a stored image's picture (docs/specs/013-workspace/share-roles.md).
    editsBlocked: contentAddBlocked({
      participating: participant.participating,
      canAddContent: participant.can.addContent,
      blocked: editsBlocked,
      structureBlocked,
    }),
    isReadOnly: isReadOnly && !(participant.participating && participant.can.addContent),
    embedMode,
    commit,
    documentId,
    ownerId: selfParticipant.id,
    sessionShareCode,
  });

  // Per-element note popover (single plain-text paragraph; see
  // packages/document BoxedElement.note). State + handlers in
  // useEditorNotes.
  const { noteOpenId, openNote, closeNote, setNote } = useEditorNotes({ commit });

  // --- Element CRUD --------------------------------------------------------

  // Draw-to-size tooling (pendingDraw state machine +
  // commit handlers). beginDrawIfEnabled short-circuits the palette
  // adds below into draw mode; the rest is consumed by the Canvas +
  // keyboard hook. See useShapeDrawing.
  const { pendingDraw, beginDraw, commitDraw, cancelDrawShape, beginRoomWalls, commitRoomWalls } =
    useShapeDrawing({
      editsBlocked,
      readSelection,
      canvasTool,
      setCanvasTool,
      activeTab,
      commit,
      setSelectedId,
      setMultiSelectedIds,
      setSelection: selectionStore.setSelection,
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
    addSticker,
    addLinkCard,
    addImage,
    addAvatar,
    dropPaletteItem,
    addText,
    addSticky,
    handleCanvasDoubleClick,
  } = useElementCreation({
    editsBlocked,
    imagesBlocked: embedMode,
    activeId,
    activeTab,
    commitTabs,
    setSelectedId,
    setEditingId,
    addBoxedAt,
    beginDraw,
    styleNewElement: styleMemory.styleNewElement,
  });

  // Inline-icon attach/detach mutators (a shape's single inline icon).
  // Cohesive slice extracted to useInlineIconMutators: editsBlocked, commit and the elements.
  const { removeIconFromElement, dropIconElementOnShape } = useInlineIconMutators({
    editsBlocked,
    commit,
    tick,
  });

  // Structural element operations (delete, marquee commit, and the
  // duplicate family). They change the element set
  // and/or the selection rather than element fields; see
  // useElementSelectionActions.
  const {
    deleteSelected,
    deleteElementById,
    selectMarquee,
    duplicateMultiSelected,
    deleteMultiSelected,
    narrowMultiSelection,
    duplicateSelected,
    stackSelectedFront,
    stackSelectedBack,
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
  });

  // The quick bar's custom swatches (docs/specs/008-canvas/quick-style-panel.md), for the Quick Style view.
  const swatchOverrides = useSwatchOverrides({
    themeId: activeTab.theme ?? DEFAULT_SCHEME_ID,
    userPreferences,
    setUserPreferences,
    writeUserPreferences,
    ownerId: selfParticipant.id,
  });
  return {
    addShape,
    addSticky,
    addText,
    cancelDrawShape,
    commitDraw,
    deleteMultiSelected,
    deleteSelected,
    dropIconElementOnShape,
    duplicateMultiSelected,
    duplicateSelected,
    pendingDraw,
    swatchOverrides,
    view: {
      addSticker,
      removeIconFromElement,
      addImage,
      addShape,
      addSticky,
      addLinkCard,
      addAvatar,
      dropPaletteItem,
      addText,
      applyImageToElement,
      beginRoomWalls,
      cancelDrawShape,
      closeImagePicker,
      closeNote,
      commitDraw,
      commitRoomWalls,
      deleteMultiSelected,
      deleteSelected,
      deleteElementById,
      duplicateMultiSelected,
      duplicateSelected,
      // Z-order for the selection popover (docs/specs/006-document/layers.md "Stacking").
      stackSelectedFront,
      stackSelectedBack,
      handleCanvasDoubleClick,
      imageContext,
      imagePickerOpenFor,
      narrowMultiSelection,
      noteOpenId,
      openNote,
      pendingDraw,
      refreshRecentImages,
      removeImageFromElement,
      selectMarquee,
      setNote,
    },
  };
}

export type EditorCreationSlice = ReturnType<typeof useEditorCreation>;
