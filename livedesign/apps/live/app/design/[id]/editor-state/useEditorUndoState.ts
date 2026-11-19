import { useImportUndoView } from '@liveworkspace/workbench/hooks/canvas/useImportUndoView';
import { useEditorHistory as useUndoRedo } from '../useEditorHistory';
import type { EditorDesignSlice } from './useEditorDesign';
import type { EditorSelection } from './useEditorSelection';
import type { EditorPages } from './useEditorPages';
import type { EditorViewport } from './useEditorViewport';

// Undo and redo (../useEditorHistory): the handlers over the document history, gated like every other edit.
//
// One slice of useEditorState (../useEditorState.ts), which calls the slices in order and passes each the ones
// before it.
export function useEditorUndoState({
  designSlice,
  selectionSlice,
  pagesSlice,
  viewportSlice,
}: {
  designSlice: EditorDesignSlice;
  selectionSlice: EditorSelection;
  pagesSlice: EditorPages;
  viewportSlice: EditorViewport;
}) {
  const { canHistoryUndo, canHistoryRedo, undoHistory, redoHistory, tickTabs, tabs } = designSlice;
  const { viewport, requestFit } = viewportSlice;
  const { activeId, setSelectedId, setEditingId, setFormatSourceId } = selectionSlice;
  const { activeTabLocked, editsBlocked } = pagesSlice;
  // An import's undo puts the view back where it was before the import, and its redo frames it again
  // (docs/specs/008-canvas/canvas-and-palette.md "Undoing an import brings its view back").
  const importUndoView = useImportUndoView({ tabs, activeId, viewport, land: requestFit });
  // Undo / redo handlers. See useEditorHistory.
  const editorHistory = useUndoRedo({
    activeId,
    editsBlocked,
    canUndo: canHistoryUndo,
    canRedo: canHistoryRedo,
    tabLocked: activeTabLocked,
    tickTabs,
    undoHistory,
    redoHistory,
    beforeStep: importUndoView.beforeStep,
    set: { setSelectedId, setEditingId, setFormatSourceId },
  });
  const { tick, undo, redo, canUndo, canRedo } = editorHistory;

  return { tick, undo, redo, canUndo, canRedo, importUndoView };
}

export type EditorHistory = ReturnType<typeof useEditorUndoState>;
