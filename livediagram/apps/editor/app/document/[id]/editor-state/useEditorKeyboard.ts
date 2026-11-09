'use client';

import { openSearchWithPrefetch } from '@liveworkspace/workbench/lib/open-search';
import { dropsOnTap } from '@/lib/draw-mode';
import { selectAllIds } from '@/lib/select-all-ids';
import { editorModeShortcut } from '@/hooks/editor/editor-mode-shortcut';
import { announce } from '@liveworkspace/workbench/lib/announcer';
import { voteKeyHandler } from '@/lib/vote-by-key';
import { track } from '@/lib/telemetry';
import { useEditorKeyboardShortcuts } from '@/hooks/canvas/useEditorKeyboardShortcuts';
import type { EditorDocumentSlice } from './useEditorDocument';
import type { EditorSelectionSlice } from './useEditorSelection';
import type { EditorDialogsSlice } from './useEditorDialogs';
import type { EditorToolsSlice } from './useEditorTools';
import type { EditorCollaborationSlice } from './useEditorCollaboration';
import type { EditorRoomSlice } from './useEditorRoom';
import type { EditorCommentsSlice } from './useEditorComments';
import type { EditorModesSlice } from './useEditorModes';
import type { EditorViewportSlice } from './useEditorViewport';
import type { EditorPresentationSlice } from './useEditorPresentation';
import type { EditorPresenceSlice } from './useEditorPresence';
import type { EditorLayersSlice } from './useEditorLayers';
import type { EditorSessionToolsSlice } from './useEditorSessionTools';
import type { EditorCreationSlice } from './useEditorCreation';
import type { EditorStyleSlice } from './useEditorStyle';
import type { EditorInteractionSlice } from './useEditorInteraction';

// Zen mode and the global keyboard shortcuts. A slice of useEditorState (../useEditorState.ts): it takes the
// slices composed before it and returns its own, with `view`, its part of the editor's view-model.
export function useEditorKeyboard({
  fromDocument,
  fromSelection,
  fromDialogs,
  fromTools,
  fromCollaboration,
  fromRoom,
  fromComments,
  fromModes,
  fromViewport,
  fromPresentation,
  fromPresence,
  fromLayers,
  fromSessionTools,
  fromCreation,
  fromStyle,
  fromInteraction,
}: {
  fromDocument: EditorDocumentSlice;
  fromSelection: EditorSelectionSlice;
  fromDialogs: EditorDialogsSlice;
  fromTools: EditorToolsSlice;
  fromCollaboration: EditorCollaborationSlice;
  fromRoom: EditorRoomSlice;
  fromComments: EditorCommentsSlice;
  fromModes: EditorModesSlice;
  fromViewport: EditorViewportSlice;
  fromPresentation: EditorPresentationSlice;
  fromPresence: EditorPresenceSlice;
  fromLayers: EditorLayersSlice;
  fromSessionTools: EditorSessionToolsSlice;
  fromCreation: EditorCreationSlice;
  fromStyle: EditorStyleSlice;
  fromInteraction: EditorInteractionSlice;
}) {
  const { voteSelfId } = fromDocument;
  const {
    editingId,
    formatSourceId,
    readSelection,
    setFormatSourceId,
    setMultiSelectedIds,
    setSelectedId,
  } = fromSelection;
  const { dialogs, panelLayout } = fromDialogs;
  const { canvasTool, pickCanvasTool } = fromTools;
  const { isReadOnly, participant } = fromCollaboration;
  const { loadAllTabs } = fromRoom;
  const { activeTab } = fromComments;
  const { editorMode } = fromModes;
  const { fitToScreen, getViewportCenter, setViewportZoom } = fromViewport;
  const { keyboardEnabled } = fromPresentation;
  const { lockedByOther } = fromPresence;
  const { layerInertIds, redo, undo } = fromLayers;
  const { castVote, retractVote } = fromSessionTools;
  const {
    addArrow,
    addImage,
    addShape,
    addSticky,
    addText,
    beginFreehand,
    beginShapePen,
    canGrowMindNode,
    cancelDrawShape,
    commitDraw,
    deleteMultiSelected,
    deleteSelected,
    duplicateMultiSelected,
    duplicateSelected,
    escapeGrownMindNode,
    growMindNode,
    pendingDraw,
    selectMarquee,
    toggleLockMultiSelected,
    whiteboardDock,
  } = fromCreation;
  const { bringSelectedToFront, sendSelectedToBack, toggleLockSelected } = fromStyle;
  const { beginEdit, copySelection, nudgeSelection, typeIntoSelected } = fromInteraction;

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
    formatSourceId,
    setFormatSourceId,
    readSelection,
    editingId,
    isReadOnly,
    participant: participant.participating,
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
    canGrowMindNode,
    onGrowMindNode: growMindNode,
    onEscapeMindNode: escapeGrownMindNode,
    onBeginShapePen: beginShapePen,
    onBeginEditSelected: beginEdit,
    onNudgeSelection: nudgeSelection,
    onTypeIntoSelected: typeIntoSelected,
    // Dot voting from the keyboard (docs/specs/012-collaboration/blueprints/vote-keys.md).
    onVoteKey: voteKeyHandler(
      {
        elements: activeTab.elements,
        vote: activeTab.vote,
        layers: activeTab.layers,
        selfId: voteSelfId,
        canTakePart: participant.can.takePart,
        cast: castVote,
        retract: retractVote,
      },
      announce,
    ),
    pendingDraw,
    onCancelDraw: cancelDrawShape,
    onDropDrawAtCentre: () => {
      if (!dropsOnTap(pendingDraw)) return false;
      const centre = getViewportCenter();
      commitDraw(pendingDraw, centre.x, centre.y, centre.x, centre.y);
      return true;
    },
    onToggleLock: () => {
      if (readSelection().multiSelectedIds.size > 0) {
        toggleLockMultiSelected();
      } else {
        toggleLockSelected();
      }
    },
    onSelectAll: () => {
      // Hidden / locked layers and elements another participant holds are left out.
      const allIds = selectAllIds(activeTab, layerInertIds, lockedByOther);
      if (allIds.size === 0) return;
      // The marquee's commit: one element becomes the single selection (type-to-edit, Space), more a multi.
      selectMarquee(allIds);
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
    onFitToScreen: fitToScreen,
    onCycleEditorMode: editorModeShortcut(editorMode, announce),
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
    enabled: keyboardEnabled,
    // A whiteboard's keys are its dock's (docs/specs/023-draw-mode/draw-mode.md "Keyboard shortcuts").
    whiteboard: whiteboardDock.whiteboard
      ? {
          pickSelect: whiteboardDock.pickSelect,
          pickPen: whiteboardDock.pickPen,
          pickEraser: whiteboardDock.pickEraser,
          pickSticky: whiteboardDock.pickSticky,
          pickText: whiteboardDock.pickText,
          pickShape: whiteboardDock.pickShape,
          pickPath: whiteboardDock.pickPath,
          pickFill: whiteboardDock.pickFill,
          openShapes: whiteboardDock.openShapes,
        }
      : null,
  });
  return {
    view: {
      toggleZenMode,
    },
  };
}

export type EditorKeyboardSlice = ReturnType<typeof useEditorKeyboard>;
