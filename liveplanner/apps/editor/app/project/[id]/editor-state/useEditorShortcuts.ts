import { useFocusNewPlanElement } from '@/hooks/plan/useFocusNewPlanElement';
import { useWorkbenchEnd } from '../useWorkbenchEnd';
import { useWorkbenchMessages } from '../useWorkbenchMessages';
import { openSearchWithPrefetch } from '@liveworkspace/workbench/lib/open-search';
import { useSheetCsvDrop } from '@/hooks/sheets/useSheetCsvDrop';
import { useRef, useCallback } from 'react';
import { useClipboard } from '@/hooks/canvas/useClipboard';
import { track } from '@/lib/telemetry';
import { useEditorKeyboardShortcuts } from '@/hooks/canvas/useEditorKeyboardShortcuts';
import { useAssignRef } from '@liveworkspace/workbench/hooks/ui/useLatest';
import type { EditorEnvSlice } from './useEditorEnv';
import type { EditorSelectionSlice } from './useEditorSelection';
import type { EditorDocumentSlice } from './useEditorDocument';
import type { EditorDialogsSlice } from './useEditorDialogs';
import type { EditorCollaborationSlice } from './useEditorCollaboration';
import type { EditorPersistenceSlice } from './useEditorPersistence';
import type { EditorPlanDataSlice } from './useEditorPlanData';
import type { EditorViewportSlice } from './useEditorViewport';
import type { EditorEditingSlice } from './useEditorEditing';
import type { EditorPlanSlice } from './useEditorPlan';
import type { EditorTabsSlice } from './useEditorTabs';
import type { EditorStyleSlice } from './useEditorStyle';
import type { EditorInteractionSlice } from './useEditorInteraction';

// A slice of the editor's state, composed by useEditorState in a fixed order (docs/development/architecture.md
// "The editor's shape"). It takes the slices composed before it and returns what the slices after it, and the
// view (editor-view.ts), read. Its hooks run in the order they did in the one hook this was split from, so the
// effects keep their order.
//
// The clipboard and file drops, Zen mode, keyboard shortcuts, the workbench's messages, Focus, and the sheets
// bridge's way back into the editor.
export function useEditorShortcuts(
  env: EditorEnvSlice,
  selectionSlice: EditorSelectionSlice,
  documentSlice: EditorDocumentSlice,
  dialogsSlice: EditorDialogsSlice,
  collaborationSlice: EditorCollaborationSlice,
  persistenceSlice: EditorPersistenceSlice,
  planDataSlice: EditorPlanDataSlice,
  viewportSlice: EditorViewportSlice,
  editingSlice: EditorEditingSlice,
  planSlice: EditorPlanSlice,
  tabsSlice: EditorTabsSlice,
  styleSlice: EditorStyleSlice,
  interactionSlice: EditorInteractionSlice,
) {
  const { workbench } = env;
  const {
    activeId,
    editingId,
    readSelection,
    selectionStore,
    setEditingId,
    setMultiSelectedIds,
    setSelectedId,
  } = selectionSlice;
  const { hydrated, projectId, selfParticipant, tabs } = documentSlice;
  const { dialogs, panelLayout, shortcutsEnabled } = dialogsSlice;
  const { isReadOnly, participant, projectName, projectTrashed, sessionRole, toast } =
    collaborationSlice;
  const { changesetFeed, tabRevisions } = persistenceSlice;
  const { activeTab, loadAllTabs, sheetsCommitRef, sheetsPlaceRef } = planDataSlice;
  const { fitToScreen, focusOn, getViewportCanvasRect, revealChangesetRef, setViewportZoom } =
    viewportSlice;
  const { commit, createBlocked, layerInertIds, layersState } = editingSlice;
  const { planCover } = planSlice;
  const { addBoxedAt, redo, undo } = tabsSlice;
  const {
    bringSelectedToFront,
    deleteMultiSelected,
    deleteSelected,
    duplicateMultiSelected,
    duplicateSelected,
    sendSelectedToBack,
    toggleLockMultiSelected,
    toggleLockSelected,
  } = styleSlice;
  const { beginEdit, nudgeSelection, typeIntoSelected } = interactionSlice;
  // Copy / paste (in-app element clipboard + OS-clipboard image
  // paste). `copySelection` feeds the keyboard hook below; paste is
  // driven by a native `paste` listener the hook owns. See
  // useClipboard.
  // The pointer's canvas position while it is over the canvas, null
  // otherwise. Written by the canvas host on every pointer move; read by paste
  //.
  const canvasPointerRef = useRef<{ x: number; y: number } | null>(null);
  const { copySelection, pasteFromClipboard, dropBoardFile, hasClipboard } = useClipboard({
    isReadOnly,
    createBlocked,
    explainCreateBlocked: layersState.explainCreateBlocked,
    readSelection,
    editingId,
    setEditingId,
    activeTab,
    commit,
    setSelectedId,
    setMultiSelectedIds,
    toast,
    getViewportCanvasRect,
  });
  // A CSV file dropped in Plan mode places a Sheet from it (docs/specs/029-sheets/sheet.md "Placing a sheet").
  const dropFileOnCanvas = useSheetCsvDrop({
    blocked: createBlocked,
    addBoxedAt,
    dropOther: dropBoardFile,
    toast: (message) => toast.error(message),
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
    canvasCovered: planCover.canvasCovered,
    readSelection,
    editingId,
    isReadOnly,
    participant: participant.participating,
    deleteSelected,
    deleteMultiSelected,
    undo,
    redo,
    copySelection,
    onBeginEditSelected: beginEdit,
    onNudgeSelection: nudgeSelection,
    onTypeIntoSelected: typeIntoSelected,
    onToggleLock: () => {
      if (readSelection().multiSelectedIds.size > 0) {
        toggleLockMultiSelected();
      } else {
        toggleLockSelected();
      }
    },
    onSelectAll: () => {
      // Hidden / locked layers are left out (docs/specs/006-project/layers.md).
      const allIds = new Set(
        activeTab.elements.map((el) => el.id).filter((id) => !layerInertIds.has(id)),
      );
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
        deleteMultiSelected({ cut: true });
      } else {
        deleteSelected({ cut: true });
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
    zenMode: panelLayout.zenMode,
    onToggleZen: toggleZenMode,
    onOpenSearch: () => openSearchWithPrefetch(dialogs.setSearchOpen, loadAllTabs),
    enabled: shortcutsEnabled,
  });

  // The workbench's side of the conversation, and the ends the editor learns of.
  useWorkbenchMessages({
    workbench,
    hydrated,
    projectId,
    projectName,
    tabs,
    activeId,
    sessionRole,
    selection: selectionStore,
    revOf: tabRevisions.revOf,
    revealInView: (tabId, ids) => revealChangesetRef.current?.(tabId, ids),
    reveals: changesetFeed.reveals,
    selfColor: selfParticipant.color,
  });
  useWorkbenchEnd(workbench, projectTrashed.trashed);

  // Focus zooms in no further than this on a small element.
  const FOCUS_ZOOM_MAX = 1.5;
  // Focus (docs/specs/026-plan/plan-board.md "Focus"): a board's or a Sheet's header glides the view to fit it.
  const focusBounds = useCallback(
    (b: { x: number; y: number; w: number; h: number }) => focusOn(b, FOCUS_ZOOM_MAX),
    [focusOn],
  );
  // A board, visualisation or Sheet this person just added glides into view, as Focus does.
  const selectedNow = useCallback(() => readSelection().selectedId, [readSelection]);
  useFocusNewPlanElement({
    tabId: activeId,
    elements: activeTab.elements,
    selectedId: selectedNow,
    focus: focusBounds,
  });

  // The sheets bridge's way back into the editor (hooks/sheets/useSheetsBridge.ts): assigned last, once every
  // slice it reaches exists.
  useAssignRef(sheetsCommitRef, commit);
  useAssignRef(sheetsPlaceRef, (at, make, opts) => addBoxedAt(at.x, at.y, make, opts));
  return {
    canvasPointerRef,
    copySelection,
    dropFileOnCanvas,
    focusBounds,
    hasClipboard,
    pasteFromClipboard,
    toggleZenMode,
  };
}

export type EditorShortcutsSlice = ReturnType<typeof useEditorShortcuts>;
