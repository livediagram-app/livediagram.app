'use client';

import { useCallback, useMemo } from 'react';
import type { Element, Tab } from '@livediagram/document';
import { useCanvasSuggestions } from '@liveworkspace/suggestions/react/useCanvasSuggestions';
import type { CanvasSuggestionType } from '@liveworkspace/suggestions/telemetry';
import { apiSuggestionsClient } from '@/lib/api/suggestions';
import { track } from '@/lib/telemetry';
import type { EditorDocumentSlice } from './useEditorDocument';
import type { EditorHistorySlice } from './useEditorUndoState';
import type { EditorSelectionSlice } from './useEditorSelection';
import type { EditorCollaborationSlice } from './useEditorCollaboration';

// Suggestions on the canvas (liveworkspace/docs/specs/014-suggestions/canvas-suggestions.md): this person's mode
// (Editing or Suggesting), the active tab's suggestions and the review. The capture behind it lives with the history
// (useEditorUndoState); this slice connects it to the api. Off where there is no room to suggest through: a document
// in This Browser (no collab key is ever handed over), an embed, a workbench. A slice of useEditorState
// (../useEditorState.ts).
export function useEditorSuggestions({
  fromDocument,
  fromHistory,
  fromSelection,
  fromCollaboration,
}: {
  fromDocument: EditorDocumentSlice;
  fromHistory: EditorHistorySlice;
  fromSelection: EditorSelectionSlice;
  fromCollaboration: EditorCollaborationSlice;
}) {
  const { documentId, embedMode, selfParticipant, toast, workbench } = fromDocument;
  const { suggestCapture } = fromHistory;
  const { activeId } = fromSelection;
  const { canEdit, participant, sessionShareCode } = fromCollaboration;
  const key = selfParticipant.key ?? null;
  const ownerId = selfParticipant.id;
  const live = !!documentId && !!key && !embedMode && !workbench;
  const client = useMemo(
    () => (live && documentId ? apiSuggestionsClient(ownerId, documentId, sessionShareCode) : null),
    [live, documentId, ownerId, sessionShareCode],
  );
  const self = useMemo(
    () => (key ? { key, name: selfParticipant.name, color: selfParticipant.color } : null),
    [key, selfParticipant.name, selfParticipant.color],
  );
  const notify = useCallback((message: string) => toast.info(message), [toast]);
  const trackSuggestion = useCallback(
    (type: CanvasSuggestionType) => track('Element', 'Changed', type),
    [],
  );
  const canvasSuggestions = useCanvasSuggestions<Tab, Element>({
    client,
    tabId: activeId,
    level: canEdit ? 'edit' : participant.participating ? 'participate' : 'view',
    suggestOnly: participant.suggestOnly,
    self,
    capture: suggestCapture.capture,
    connect: suggestCapture.connect,
    notify,
    track: trackSuggestion,
  });
  return {
    canvasSuggestions,
    view: {
      // The bar, the review list and the ghosts read this (EditorView, CanvasElementsLayer).
      canvasSuggestions,
    },
  };
}

export type EditorSuggestionsSlice = ReturnType<typeof useEditorSuggestions>;
