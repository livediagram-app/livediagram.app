import { useWorkbenchEnd } from '../useWorkbenchEnd';
import { useWorkbenchMessages } from '../useWorkbenchMessages';
import type { EditorDocument } from './useEditorDocument';
import type { EditorSelection } from './useEditorSelection';
import type { EditorSession } from './useEditorSession';
import type { EditorPersistence } from './useEditorPersistence';
import type { EditorCollaboration } from './useEditorCollaboration';

// The workbench's side of the conversation (useWorkbenchMessages) and the ends the editor learns of.
//
// One slice of useEditorState (../useEditorState.ts), which calls the slices in order and passes each the ones
// before it.
export function useEditorWorkbench({
  documentSlice,
  selectionSlice,
  sessionSlice,
  persistenceSlice,
  collaborationSlice,
}: {
  documentSlice: EditorDocument;
  selectionSlice: EditorSelection;
  sessionSlice: EditorSession;
  persistenceSlice: EditorPersistence;
  collaborationSlice: EditorCollaboration;
}) {
  // Unmemoised by the React Compiler, as the one hook it was cut from was (see ../useEditorState.ts).
  'use no memo';
  const { workbench, tabs } = documentSlice;
  const { activeId, selectionStore } = selectionSlice;
  const { selfParticipant, sessionRole, documentName, documentId, hydrated, documentTrashed } =
    sessionSlice;
  const { tabRevisions } = persistenceSlice;
  const { revealChangesetRef, changesetFeed } = collaborationSlice;
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
}
