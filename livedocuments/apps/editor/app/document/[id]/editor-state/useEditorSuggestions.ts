'use client';

import { useCallback, useMemo } from 'react';
import type { Element, Tab } from '@livedocuments/document';
import { useCanvasSuggestions } from '@liveworkspace/suggestions/react/useCanvasSuggestions';
import type { CanvasSuggestionType } from '@liveworkspace/suggestions/telemetry';
import { apiSuggestionsClient } from '@/lib/api/suggestions';
import { track } from '@/lib/telemetry';
import type { EditorDocument } from './useEditorDocument';
import type { EditorSelection } from './useEditorSelection';
import type { EditorSession } from './useEditorSession';

// Suggestions on a slide's or an infographic's canvas (liveworkspace/docs/specs/014-suggestions/canvas-suggestions.md):
// an Editor's mode (Editing or Suggesting), the active tab's suggestions and the review. An article's writing has its
// own Suggesting (docs/specs/007-editor/suggestions.md); a Participant on Suggest Only suggests there, as it always
// has, since its canvas gestures stay closed. Off where there is no room to suggest through: a document in This
// Browser, an embed, a workbench. A slice of useEditorState (../useEditorState.ts).
export function useEditorSuggestions({
  documentSlice,
  selectionSlice,
  sessionSlice,
}: {
  documentSlice: EditorDocument;
  selectionSlice: EditorSelection;
  sessionSlice: EditorSession;
}) {
  const { embedMode, suggestCapture, workbench } = documentSlice;
  const { activeId } = selectionSlice;
  const { canEdit, documentId, participant, selfParticipant, sessionShareCode, toast } =
    sessionSlice;
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
  return useCanvasSuggestions<Tab, Element>({
    client,
    tabId: activeId,
    level: canEdit ? 'edit' : participant.participating ? 'participate' : 'view',
    suggestOnly: false,
    self,
    capture: suggestCapture.capture,
    connect: suggestCapture.connect,
    notify,
    track: trackSuggestion,
  });
}
