import { useImportUndoView } from '@liveworkspace/workbench/hooks/canvas/useImportUndoView';
import { useEditorHistory as useUndoRedo } from '../useEditorHistory';
import type { EditorDocument } from './useEditorDocument';
import type { EditorSelection } from './useEditorSelection';
import type { EditorPages } from './useEditorPages';
import type { EditorViewport } from './useEditorViewport';
import type { EditorSession } from './useEditorSession';
import { useEditorKnowledgeStyle } from './useEditorKnowledgeStyle';
import { styleOfferedOf } from '@/lib/knowledge-style/style-offered';

// Undo and redo (../useEditorHistory): the handlers over the document history, gated like every other edit.
//
// One slice of useEditorState (../useEditorState.ts), which calls the slices in order and passes each the ones
// before it.
export function useEditorUndoState({
  documentSlice,
  selectionSlice,
  pagesSlice,
  viewportSlice,
  sessionSlice,
}: {
  sessionSlice: EditorSession;
  documentSlice: EditorDocument;
  selectionSlice: EditorSelection;
  pagesSlice: EditorPages;
  viewportSlice: EditorViewport;
}) {
  // Unmemoised by the React Compiler, as the one hook it was cut from was (see ../useEditorState.ts).
  'use no memo';
  const { canHistoryUndo, canHistoryRedo, undoHistory, redoHistory, tickTabs, tabs } =
    documentSlice;
  // The Knowledgebase Style's changes are steps of this history too (page-surface.md "Knowledgebase Style").
  const knowledgeStyle = useEditorKnowledgeStyle({
    documentId: sessionSlice.documentId,
    ownerId: sessionSlice.selfParticipant.id,
    shareCode: sessionSlice.sessionShareCode,
    mayStyle: styleOfferedOf({
      can: sessionSlice.participant.can,
      isStructureReadOnly: sessionSlice.isStructureReadOnly,
      hydrated: sessionSlice.hydrated,
      embedMode: documentSlice.embedMode,
      workbench: documentSlice.workbench,
      sessionCommunity: sessionSlice.realtime.sessionCommunity,
      documentId: sessionSlice.documentId,
    }),
    depth: documentSlice.historyDepth,
    branch: documentSlice.historyBranch,
    markCheckpoint: documentSlice.markCheckpoint,
  });
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
    beforeUndo: knowledgeStyle.beforeUndo,
    beforeRedo: knowledgeStyle.beforeRedo,
    set: { setSelectedId, setEditingId, setFormatSourceId },
  });
  const { tick, undo, redo, canUndo, canRedo } = editorHistory;

  return { tick, undo, redo, canUndo, canRedo, importUndoView };
}

export type EditorHistory = ReturnType<typeof useEditorUndoState>;
