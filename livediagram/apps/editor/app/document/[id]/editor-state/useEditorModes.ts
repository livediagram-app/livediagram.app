'use client';

import { useModeDefaultTool } from '@/hooks/editor/useModeDefaultTool';
import { voteHidesCursors } from '@livediagram/document';
import { useEditorMode } from '@/hooks/editor/useEditorMode';
import { useAddCustomColour } from '@/hooks/editor/useAddCustomColour';
import { useTagColourSetter } from '@/hooks/editor/useTagColourSetter';
import type { EditorDocumentSlice } from './useEditorDocument';
import type { EditorHistorySlice } from './useEditorUndoState';
import type { EditorToolsSlice } from './useEditorTools';
import type { EditorCollaborationSlice } from './useEditorCollaboration';
import type { EditorCommentsSlice } from './useEditorComments';

// The tab's editor mode (Diagram, Draw), the tab's custom and tag colours, and the vote's cursor privacy. A
// slice of useEditorState (../useEditorState.ts): it takes the slices composed before it and returns its own,
// with `view`, its part of the editor's view-model.
export function useEditorModes({
  fromDocument,
  fromHistory,
  fromTools,
  fromCollaboration,
  fromComments,
}: {
  fromDocument: EditorDocumentSlice;
  fromHistory: EditorHistorySlice;
  fromTools: EditorToolsSlice;
  fromCollaboration: EditorCollaborationSlice;
  fromComments: EditorCommentsSlice;
}) {
  const { embedMode, toast } = fromDocument;
  const { commitTabs, tickTabs } = fromHistory;
  const { canvasTool, setCanvasTool } = fromTools;
  const { canEdit } = fromCollaboration;
  const { activeTab } = fromComments;
  // The tab's editor mode, the same for everyone on it (docs/specs/007-editor/editor-modes.md): every
  // tool and rule gate keys on it, never on what the tab is. A switch is one tab edit.
  const editorMode = useEditorMode(activeTab, {
    canEdit,
    commitTabs,
    toastInfo: toast.info,
  });
  // A colour picked with + joins the tab's custom colours, which every picker offers.
  const addCustomColour = useAddCustomColour({ activeId: activeTab.id, canEdit, tickTabs });
  // A card tag's colour for the tab (docs/specs/009-elements/tag-colours.md).
  const setTagColour = useTagColourSetter({ activeTab, canEdit, commitTabs });
  const drawMode = editorMode.mode === 'draw';
  // The tool a mode starts with: Select, or Hand on a phone (docs/specs/007-editor/editor-modes.md).
  useModeDefaultTool(editorMode.mode, canvasTool, setCanvasTool, embedMode);

  // Vote privacy (docs/specs/012-collaboration/session-tools.md): while a hide-cursors vote is open on this tab,
  // peer cursors + laser trails are neither sent nor drawn. Derived here so
  // the outbound gate (useEditorBroadcast) and the render gate
  // (usePresenceRows) read the same value off the synced tab.
  const voteCursorsHidden = voteHidesCursors(activeTab.vote);
  return {
    drawMode,
    editorMode,
    voteCursorsHidden,
    view: {
      addCustomColour,
      setTagColour,
      // The person's editor mode on the active tab, for the mode switch and the canvas.
      editorMode,
    },
  };
}

export type EditorModesSlice = ReturnType<typeof useEditorModes>;
