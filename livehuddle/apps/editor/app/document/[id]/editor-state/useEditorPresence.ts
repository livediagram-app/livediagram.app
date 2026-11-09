'use client';

import { usePresenceRows } from '../usePresenceRows';
import type { EditorDocumentSlice } from './useEditorDocument';
import type { EditorHistorySlice } from './useEditorUndoState';
import type { EditorSelectionSlice } from './useEditorSelection';
import type { EditorCollaborationSlice } from './useEditorCollaboration';

// The presence rows the canvas draws (avatars per tab, peers, selections) and the selection locks. A slice of
// useEditorState (../useEditorState.ts): it takes the slices composed before it and returns its own, with
// `view`, its part of the editor's view-model.
export function useEditorPresence({
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
  const { selfParticipant } = fromDocument;
  const { tabs } = fromHistory;
  const { activeId } = fromSelection;
  const {
    documentShareable,
    documentTeamId,
    liveAgents,
    livePresence,
    peerMotion,
    presenceClock,
    remoteSelections,
    remoteTabFocus,
  } = fromCollaboration;
  // Derived realtime presence rows (avatars per tab, remote cursors,
  // per-element selections) and the concurrent-selection
  // lock (docs/specs/007-editor/editor-app.md). Pure derivation over the usePresenceState values.
  // See usePresenceRows.
  const {
    participantsByTab,
    peerRows,
    remoteSelectionsByElement,
    agentFocusByElement,
    lockedByOther,
  } = usePresenceRows({
    documentShareable,
    documentTeamId,
    activeId,
    selfParticipant,
    tabs,
    livePresence,
    liveAgents,
    presenceClock,
    remoteTabFocus,
    remoteSelections,
    peerMotion,
  });
  return {
    lockedByOther,
    view: {
      // What the agents present name in focus on the active tab, for the focus rings.
      agentFocusByElement,
      participantsByTab,
      // Peers' cursors and characters, for the canvas to subscribe to (lib/peer-motion.ts).
      peerRows,
      remoteSelectionsByElement,
      lockedByOther,
    },
  };
}

export type EditorPresenceSlice = ReturnType<typeof useEditorPresence>;
