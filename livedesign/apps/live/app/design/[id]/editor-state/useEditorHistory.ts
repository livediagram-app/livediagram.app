import { useEditorHistory as useUndoRedo } from '../useEditorHistory';
import type { EditorDocument } from './useEditorDocument';
import type { EditorSelection } from './useEditorSelection';
import type { EditorPages } from './useEditorPages';

// Undo and redo (../useEditorHistory): the handlers over the document history, gated like every other edit.
//
// One slice of useEditorState (../useEditorState.ts), which calls the slices in order and passes each the ones
// before it.
export function useEditorHistory({
  documentSlice,
  selectionSlice,
  pagesSlice,
}: {
  documentSlice: EditorDocument;
  selectionSlice: EditorSelection;
  pagesSlice: EditorPages;
}) {
  const { canHistoryUndo, canHistoryRedo, undoHistory, redoHistory, tickTabs } = documentSlice;
  const { activeId, setSelectedId, setEditingId, setFormatSourceId } = selectionSlice;
  const { activeTabLocked, editsBlocked } = pagesSlice;
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
    set: { setSelectedId, setEditingId, setFormatSourceId },
  });
  const { tick, undo, redo, canUndo, canRedo } = editorHistory;

  return { tick, undo, redo, canUndo, canRedo };
}

export type EditorHistory = ReturnType<typeof useEditorHistory>;
