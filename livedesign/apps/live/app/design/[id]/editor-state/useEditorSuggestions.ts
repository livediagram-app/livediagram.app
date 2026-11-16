'use client';

import { useCallback, useMemo } from 'react';
import type { Element, Tab } from '@livedesign/design';
import { useCanvasSuggestions } from '@liveworkspace/suggestions/react/useCanvasSuggestions';
import type { CanvasSuggestionType } from '@liveworkspace/suggestions/telemetry';
import { apiSuggestionsClient } from '@/lib/api/suggestions';
import { track } from '@/lib/telemetry';
import type { EditorDesignSlice } from './useEditorDesign';
import type { EditorSelection } from './useEditorSelection';
import type { EditorSession } from './useEditorSession';

// Suggestions on the canvas (liveworkspace/docs/specs/014-suggestions/canvas-suggestions.md): this person's mode
// (Editing or Suggesting), the active tab's suggestions and the review. The capture behind it lives with the history
// (useEditorDesign); this slice connects it to the api. Off where there is no room to suggest through: a design in
// This Browser (no collab key is ever handed over), an embed, a workbench. A slice of useEditorState
// (../useEditorState.ts).
export function useEditorSuggestions({
  designSlice,
  selectionSlice,
  sessionSlice,
}: {
  designSlice: EditorDesignSlice;
  selectionSlice: EditorSelection;
  sessionSlice: EditorSession;
}) {
  const { embedMode, suggestCapture, workbench } = designSlice;
  const { activeId } = selectionSlice;
  const { canEdit, designId, participant, selfParticipant, sessionShareCode, toast } = sessionSlice;
  const key = selfParticipant.key ?? null;
  const ownerId = selfParticipant.id;
  const live = !!designId && !!key && !embedMode && !workbench;
  const client = useMemo(
    () => (live && designId ? apiSuggestionsClient(ownerId, designId, sessionShareCode) : null),
    [live, designId, ownerId, sessionShareCode],
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
    suggestOnly: participant.suggestOnly,
    self,
    capture: suggestCapture.capture,
    connect: suggestCapture.connect,
    notify,
    track: trackSuggestion,
  });
}
