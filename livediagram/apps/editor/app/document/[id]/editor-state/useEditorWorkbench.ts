'use client';

import { useWorkbenchEnd } from '../useWorkbenchEnd';
import { useWorkbenchMessages } from '../useWorkbenchMessages';
import type { EditorDocumentSlice } from './useEditorDocument';
import type { EditorHistorySlice } from './useEditorHistory';
import type { EditorSelectionSlice } from './useEditorSelection';
import type { EditorCollaborationSlice } from './useEditorCollaboration';
import type { EditorPersistenceSlice } from './useEditorPersistence';
import type { EditorRoomSlice } from './useEditorRoom';

// The editor's side of a workbench conversation, and the ends it learns of. A slice of useEditorState
// (../useEditorState.ts): it takes the slices composed before it and returns its own, with `view`, its part of
// the editor's view-model.
export function useEditorWorkbench({
  fromDocument,
  fromHistory,
  fromSelection,
  fromCollaboration,
  fromPersistence,
  fromRoom,
}: {
  fromDocument: EditorDocumentSlice;
  fromHistory: EditorHistorySlice;
  fromSelection: EditorSelectionSlice;
  fromCollaboration: EditorCollaborationSlice;
  fromPersistence: EditorPersistenceSlice;
  fromRoom: EditorRoomSlice;
}) {
  const { documentId, hydrated, selfParticipant, workbench } = fromDocument;
  const { tabs } = fromHistory;
  const { activeId, selectionStore } = fromSelection;
  const { sessionRole } = fromCollaboration;
  const { documentName, documentTrashed, tabRevisions } = fromPersistence;
  const { changesetFeed, revealChangesetRef } = fromRoom;

  // The workbench's side of the conversation, and the ends the editor learns of.
  useWorkbenchMessages({
    workbench,
    hydrated,
    documentId,
    documentName,
    tabs,
    activeId,
    sessionRole,
    selection: selectionStore,
    revOf: tabRevisions.revOf,
    revealInView: (tabId, ids) => revealChangesetRef.current?.(tabId, ids),
    reveals: changesetFeed.reveals,
    selfColor: selfParticipant.color,
  });
  useWorkbenchEnd(workbench, documentTrashed.trashed);
  return {
    view: {},
  };
}

export type EditorWorkbenchSlice = ReturnType<typeof useEditorWorkbench>;
