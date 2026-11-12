'use client';

import { useRef } from 'react';
import { useClipboard } from '@/hooks/canvas/useClipboard';
import { useCanvasA11y } from '@/hooks/canvas/useCanvasA11y';
import { useNudgeSelection } from '@/hooks/canvas/useNudgeSelection';
import { useEditorDrag } from '@/hooks/canvas/useEditorDrag';
import { useElementLinks } from '@/hooks/canvas/useElementLinks';
import { useSelectionEditing } from '../useSelectionEditing';
import type { EditorDocumentSlice } from './useEditorDocument';
import type { EditorHistorySlice } from './useEditorUndoState';
import type { EditorSelectionSlice } from './useEditorSelection';
import type { EditorDialogsSlice } from './useEditorDialogs';
import type { EditorToolsSlice } from './useEditorTools';
import type { EditorCollaborationSlice } from './useEditorCollaboration';
import type { EditorPersistenceSlice } from './useEditorPersistence';
import type { EditorActiveTabSlice } from './useEditorActiveTab';
import type { EditorViewportSlice } from './useEditorViewport';
import type { EditorFollowingSlice } from './useEditorFollowing';
import type { EditorPresenceSlice } from './useEditorPresence';
import type { EditorEditingSlice } from './useEditorEditing';
import type { EditorTabsSlice } from './useEditorTabs';
import type { EditorCreationSlice } from './useEditorCreation';

// Pointer and selection interaction: links, label editing, canvas accessibility, nudge, drag and the clipboard.
// A slice of useEditorState (../useEditorState.ts): it takes the slices composed before it and returns its own,
// with `view`, its part of the editor's view-model.
export function useEditorInteraction({
  fromDocument,
  fromHistory,
  fromSelection,
  fromDialogs,
  fromTools,
  fromCollaboration,
  fromPersistence,
  fromActiveTab,
  fromViewport,
  fromFollowing,
  fromPresence,
  fromEditing,
  fromTabs,
  fromCreation,
}: {
  fromDocument: EditorDocumentSlice;
  fromHistory: EditorHistorySlice;
  fromSelection: EditorSelectionSlice;
  fromDialogs: EditorDialogsSlice;
  fromTools: EditorToolsSlice;
  fromCollaboration: EditorCollaborationSlice;
  fromPersistence: EditorPersistenceSlice;
  fromActiveTab: EditorActiveTabSlice;
  fromViewport: EditorViewportSlice;
  fromFollowing: EditorFollowingSlice;
  fromPresence: EditorPresenceSlice;
  fromEditing: EditorEditingSlice;
  fromTabs: EditorTabsSlice;
  fromCreation: EditorCreationSlice;
}) {
  const { documentId, embedMode, selfParticipant, toast } = fromDocument;
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
  const { formatToolActive, shortcutsEnabled } = fromTools;
  const { isReadOnly, participant } = fromCollaboration;
  const { alignmentGuidesRef, documentName, setDocumentName } = fromPersistence;
  const { activeTab } = fromActiveTab;
  const { getViewportCanvasRect, scrollIntoView, zoomRef } = fromViewport;
  const { isPinchingRef } = fromFollowing;
  const { lockedByOther } = fromPresence;
  const { applyFormatFromSource, commit, currentSelectionIds, editsBlocked, tick } = fromEditing;
  const { openDocument } = fromTabs;
  const { dropIconElementOnShape } = fromCreation;
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
    cancelEdit,
    typeIntoSelected,
    selectElement,
    toggleInMultiSelect,
  } = useSelectionEditing({
    readSelection,
    isReadOnly,
    canWriteText: participant.can.writeText,
    formatSourceId,
    formatToolActive,
    documentName,
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
      setDocumentName,
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
    scrollIntoView,
  });

  // Keyboard nudge (docs/specs/008-canvas/canvas-and-palette.md Move). See useNudgeSelection for the
  // burst-coalescing behaviour; this hook also owns
  // the timer-cleanup-on-unmount that the prior inline version
  // didn't have.
  const nudgeSelection = useNudgeSelection({
    isReadOnly,
    readSelection,
    activeTab,
    markCheckpoint,
    tick,
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
  const { drag, shiftDupGhostIds, snapGuideStore, beginDrag, pressArmedAction } = useEditorDrag({
    activeTab,
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
    tick,
    commit,
    markCheckpoint,
    cancelToCheckpoint,
    onIconElementDroppedOnShape: editsBlocked ? undefined : dropIconElementOnShape,
    alignmentGuidesRef,
    isPinchingRef,
  });

  // Copy / paste (in-app element clipboard + OS-clipboard picture
  // paste and drop). `copySelection` feeds the keyboard hook below; paste is
  // driven by a native `paste` listener the hook owns. See
  // useClipboard.
  // The pointer's canvas position while it is over the canvas, null
  // otherwise. Written by the canvas host on every pointer move; read by paste
  // (a paste lands at the pointer).
  const canvasPointerRef = useRef<{ x: number; y: number } | null>(null);
  const { copySelection, pasteFromClipboard, dropBoardFile, hasClipboard } = useClipboard({
    isReadOnly,
    createBlocked: editsBlocked,
    readSelection,
    editingId,
    setEditingId,
    activeTab,
    commit,
    setSelectedId,
    setMultiSelectedIds,
    toast,
    getViewportCanvasRect,
    // A pasted or dropped picture (docs/specs/009-elements/images.md "Paste and drop"): uploaded to this person's
    // gallery for this Space, never in an embed.
    ownerId: selfParticipant.id,
    documentId,
    embedMode,
  });
  return {
    beginEdit,
    copySelection,
    nudgeSelection,
    typeIntoSelected,
    view: {
      // Clipboard copy, plus paste + its enabled flag for the canvas menu's Paste row.
      copySelection,
      pasteFromClipboard,
      dropBoardFile,
      hasClipboard,
      drag,
      beginDrag,
      pressArmedAction,
      beginEdit,
      canvasPointerRef,
      cancelEdit,
      commitLabel,
      followLink,
      linkPickerOpenForId,
      linkPickerInitialMode,
      openLinkPicker,
      applyElementLink,
      selectElement,
      setLinkPickerOpenForId,
      shiftDupGhostIds,
      snapGuideStore,
      toggleInMultiSelect,
    },
  };
}

export type EditorInteractionSlice = ReturnType<typeof useEditorInteraction>;
