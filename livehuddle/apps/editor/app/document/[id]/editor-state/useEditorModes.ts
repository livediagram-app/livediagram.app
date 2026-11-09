'use client';

import { useStartingTool } from '@/hooks/editor/useStartingTool';
import { useAddCustomColour } from '@/hooks/editor/useAddCustomColour';
import { useOpenWalking } from '../useOpenWalking';
import type { EditorDocumentSlice } from './useEditorDocument';
import type { EditorHistorySlice } from './useEditorHistory';
import type { EditorSelectionSlice } from './useEditorSelection';
import type { EditorToolsSlice } from './useEditorTools';
import type { EditorCollaborationSlice } from './useEditorCollaboration';
import type { EditorCommentsSlice } from './useEditorComments';

// Edit and Walk: the tool a tab starts with, a tab that opens walking, and the tab's custom colours. A slice of
// useEditorState (../useEditorState.ts): it takes the slices composed before it and returns its own, with
// `view`, its part of the editor's view-model.
export function useEditorModes({
  fromDocument,
  fromHistory,
  fromSelection,
  fromTools,
  fromCollaboration,
  fromComments,
}: {
  fromDocument: EditorDocumentSlice;
  fromHistory: EditorHistorySlice;
  fromSelection: EditorSelectionSlice;
  fromTools: EditorToolsSlice;
  fromCollaboration: EditorCollaborationSlice;
  fromComments: EditorCommentsSlice;
}) {
  const { embedMode, loadedTabIds } = fromDocument;
  const { tickTabs } = fromHistory;
  const { setMultiSelectedIds, setSelectedId } = fromSelection;
  const { canvasTool, enterWalking, setCanvasTool } = fromTools;
  const { canEdit, participant } = fromCollaboration;
  const { activeTab } = fromComments;
  // A colour picked with + joins the tab's custom colours, which every picker offers.
  const addCustomColour = useAddCustomColour({ activeId: activeTab.id, canEdit, tickTabs });
  // The tool the editor starts with: Select, or Hand on a phone (docs/specs/007-editor/editor-modes.md).
  useStartingTool(canvasTool, setCanvasTool, embedMode);
  // A tab that offers the walk opens walking (docs/specs/008-canvas/avatar-mode.md "Opening walking"). After the
  // mode's default tool, so the walk is what a Spaces board settles on.
  const openWalking = useOpenWalking({
    enabled: !embedMode,
    tabId: activeTab.id,
    elements: activeTab.elements,
    loaded: loadedTabIds.has(activeTab.id),
    // Held walking (a Participant) still judges a tab, so a Walk In button starts its character below it.
    walking: canvasTool === 'avatar' && !participant.can.alwaysWalks,
    openWalking: () => {
      setSelectedId(null);
      setMultiSelectedIds(new Set());
      enterWalking();
    },
  });
  return {
    openWalking,
    view: {
      addCustomColour,
      walkIn: openWalking.walkIn,
    },
  };
}

export type EditorModesSlice = ReturnType<typeof useEditorModes>;
