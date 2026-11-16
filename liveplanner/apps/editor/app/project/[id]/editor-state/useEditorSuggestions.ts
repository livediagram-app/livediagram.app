'use client';

import { useCallback, useMemo } from 'react';
import type { Element, Tab } from '@liveplanner/project';
import { useCanvasSuggestions } from '@liveworkspace/suggestions/react/useCanvasSuggestions';
import type { CanvasSuggestionType } from '@liveworkspace/suggestions/telemetry';
import { apiSuggestionsClient } from '@/lib/api/suggestions';
import { track } from '@/lib/telemetry';
import type { EditorEnvSlice } from './useEditorEnv';
import type { EditorSelectionSlice } from './useEditorSelection';
import type { EditorProjectSlice } from './useEditorProject';
import type { EditorCollaborationSlice } from './useEditorCollaboration';

// Suggestions on the canvas (liveworkspace/docs/specs/014-suggestions/canvas-suggestions.md): this person's mode
// (Editing or Suggesting), the active tab's suggestions and the review. The capture behind it lives with the history
// (useEditorProject); this slice connects it to the api. Off where there is no room to suggest through: a plan in
// This Browser (no collab key is ever handed over), an embed, a workbench. Board cards and Sheet cells are not
// canvas elements and are never suggested. A slice of useEditorState (../useEditorState.ts).
export function useEditorSuggestions(
  env: EditorEnvSlice,
  selectionSlice: EditorSelectionSlice,
  projectSlice: EditorProjectSlice,
  collaborationSlice: EditorCollaborationSlice,
) {
  const { embedMode, workbench } = env;
  const { activeId } = selectionSlice;
  const { projectId, selfParticipant, suggestCapture } = projectSlice;
  const { canEdit, participant, sessionShareCode, toast } = collaborationSlice;
  const key = selfParticipant.key ?? null;
  const ownerId = selfParticipant.id;
  const live = !!projectId && !!key && !embedMode && !workbench;
  const client = useMemo(
    () => (live && projectId ? apiSuggestionsClient(ownerId, projectId, sessionShareCode) : null),
    [live, projectId, ownerId, sessionShareCode],
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
