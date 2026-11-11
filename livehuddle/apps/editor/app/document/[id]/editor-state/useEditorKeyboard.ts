'use client';

import { openSearchWithPrefetch } from '@liveworkspace/workbench/lib/open-search';
import { dropsOnTap } from '@/lib/draw-mode';
import { selectAllIds } from '@/lib/select-all-ids';
import { useEditorKeyboardShortcuts } from '@/hooks/canvas/useEditorKeyboardShortcuts';
import type { EditorSelectionSlice } from './useEditorSelection';
import type { EditorDialogsSlice } from './useEditorDialogs';
import type { EditorToolsSlice } from './useEditorTools';
import type { EditorCollaborationSlice } from './useEditorCollaboration';
import type { EditorRoomSlice } from './useEditorRoom';
import type { EditorCommentsSlice } from './useEditorComments';
import type { EditorViewportSlice } from './useEditorViewport';
import type { EditorEditingSlice } from './useEditorEditing';
import type { EditorCreationSlice } from './useEditorCreation';
import type { EditorStyleSlice } from './useEditorStyle';
import type { EditorInteractionSlice } from './useEditorInteraction';

// The global keyboard shortcuts. A slice of useEditorState (../useEditorState.ts): it takes the slices composed
// before it and returns its own, with `view`, its part of the editor's view-model.
export function useEditorKeyboard({
  fromSelection,
  fromDialogs,
  fromTools,
  fromCollaboration,
  fromRoom,
  fromComments,
  fromViewport,
  fromEditing,
  fromCreation,
  fromStyle,
  fromInteraction,
}: {
  fromSelection: EditorSelectionSlice;
  fromDialogs: EditorDialogsSlice;
  fromTools: EditorToolsSlice;
  fromCollaboration: EditorCollaborationSlice;
  fromRoom: EditorRoomSlice;
  fromComments: EditorCommentsSlice;
  fromViewport: EditorViewportSlice;
  fromEditing: EditorEditingSlice;
  fromCreation: EditorCreationSlice;
  fromStyle: EditorStyleSlice;
  fromInteraction: EditorInteractionSlice;
}) {
  const {
    editingId,
    formatSourceId,
    readSelection,
    setFormatSourceId,
    setMultiSelectedIds,
    setSelectedId,
  } = fromSelection;
  const { dialogs } = fromDialogs;
  const { canvasTool, pickCanvasTool, shortcutsEnabled } = fromTools;
  const { isReadOnly } = fromCollaboration;
  const { loadAllTabs } = fromRoom;
  const { activeTab } = fromComments;
  const { fitToScreen, getViewportCenter, setViewportZoom } = fromViewport;
  const { redo, undo } = fromEditing;
  const {
    addSticky,
    addText,
    cancelDrawShape,
    commitDraw,
    deleteMultiSelected,
    deleteSelected,
    duplicateMultiSelected,
    duplicateSelected,
    pendingDraw,
  } = fromCreation;
  const { bringSelectedToFront, sendSelectedToBack } = fromStyle;
  const { beginEdit, copySelection, nudgeSelection, typeIntoSelected } = fromInteraction;
  // Global keyboard shortcuts (Escape cancels modes / deselects, Delete /
  // Backspace wipes selection, Cmd-Z / Cmd-Shift-Z undo / redo, Cmd-X / -C
  // / -V cut / copy / paste, Cmd-D duplicate, V / H / K canvas-tool switch,
  // z-order + fit-to-screen). The full keymap + rationale lives in
  // useEditorKeyboardShortcuts and is catalogued in docs/specs/008-canvas/canvas-and-palette.md.
  useEditorKeyboardShortcuts({
    formatSourceId,
    setFormatSourceId,
    readSelection,
    editingId,
    isReadOnly,
    deleteSelected,
    deleteMultiSelected,
    undo,
    redo,
    copySelection,
    setCanvasTool: pickCanvasTool,
    canvasTool,
    addText,
    addSticky,
    onBeginEditSelected: beginEdit,
    onNudgeSelection: nudgeSelection,
    onTypeIntoSelected: typeIntoSelected,
    pendingDraw,
    onCancelDraw: cancelDrawShape,
    onDropDrawAtCentre: () => {
      if (!dropsOnTap(pendingDraw)) return false;
      const centre = getViewportCenter();
      commitDraw(pendingDraw, centre.x, centre.y, centre.x, centre.y);
      return true;
    },
    onSelectAll: () => {
      const allIds = selectAllIds(activeTab);
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
      copySelection();
      if (readSelection().multiSelectedIds.size > 0) {
        deleteMultiSelected();
      } else {
        deleteSelected();
      }
    },
    onBringToFront: bringSelectedToFront,
    onSendToBack: sendSelectedToBack,
    onFitToScreen: fitToScreen,
    onDeselect: () => {
      setSelectedId(null);
      setMultiSelectedIds(new Set());
    },
    onZoomIn: () => setViewportZoom((z) => Math.min(5, Math.round((z + 0.1) * 10) / 10)),
    onZoomOut: () => setViewportZoom((z) => Math.max(0.1, Math.round((z - 0.1) * 10) / 10)),
    onZoomReset: () => setViewportZoom(1),
    onOpenSearch: () => openSearchWithPrefetch(dialogs.setSearchOpen, loadAllTabs),
    enabled: shortcutsEnabled,
  });
  return {
    view: {},
  };
}

export type EditorKeyboardSlice = ReturnType<typeof useEditorKeyboard>;
