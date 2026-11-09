'use client';

import { useEffect, useMemo } from 'react';
import type { PollCandidate } from '@/lib/poll-collaborators';
import { withoutAgentRows } from '@/lib/agent-presence-rows';
import { usePresenceRows } from '../usePresenceRows';
import type { EditorDocumentSlice } from './useEditorDocument';
import type { EditorHistorySlice } from './useEditorHistory';
import type { EditorSelectionSlice } from './useEditorSelection';
import type { EditorToolsSlice } from './useEditorTools';
import type { EditorCollaborationSlice } from './useEditorCollaboration';
import type { EditorRoomSlice } from './useEditorRoom';
import type { EditorModesSlice } from './useEditorModes';
import type { EditorViewportSlice } from './useEditorViewport';
import type { EditorPresentationSlice } from './useEditorPresentation';

// The presence rows the canvas draws (avatars per tab, cursors, laser trails, selections) and the poll's roster.
// A slice of useEditorState (../useEditorState.ts): it takes the slices composed before it and returns its own,
// with `view`, its part of the editor's view-model.
export function useEditorPresence({
  fromDocument,
  fromHistory,
  fromSelection,
  fromTools,
  fromCollaboration,
  fromRoom,
  fromModes,
  fromViewport,
  fromPresentation,
}: {
  fromDocument: EditorDocumentSlice;
  fromHistory: EditorHistorySlice;
  fromSelection: EditorSelectionSlice;
  fromTools: EditorToolsSlice;
  fromCollaboration: EditorCollaborationSlice;
  fromRoom: EditorRoomSlice;
  fromModes: EditorModesSlice;
  fromViewport: EditorViewportSlice;
  fromPresentation: EditorPresentationSlice;
}) {
  const { selfParticipant } = fromDocument;
  const { tabs } = fromHistory;
  const { activeId } = fromSelection;
  const { laserPen } = fromTools;
  const {
    documentShareable,
    documentTeamId,
    liveAgents,
    livePresence,
    presenceClock,
    remoteCursors,
    remoteLaserTrails,
    remoteSelections,
    remoteTabFocus,
  } = fromCollaboration;
  const { pollCollaboratorsRef } = fromRoom;
  const { voteCursorsHidden } = fromModes;
  const { localLaserTrail } = fromViewport;
  const { presenting } = fromPresentation;

  // Derived realtime presence rows (avatars per tab, remote cursors,
  // laser trails, per-element selections) and the concurrent-selection
  // lock (docs/specs/007-editor/editor-app.md). Pure derivation over the usePresenceState values +
  // the local laser trail. See usePresenceRows.
  const {
    participantsByTab,
    remoteCursorRows,
    laserTrailRows,
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
    remoteCursors,
    remoteSelections,
    remoteLaserTrails,
    localLaserTrail,
    selfLaserConfig: laserPen.config,
    // A presenter sees nobody else's cursor or laser: it is their screen on a projector
    // (docs/specs/012-collaboration/presentation-mode.md). Inbound only; our own laser still broadcasts.
    cursorsHidden: voteCursorsHidden || presenting,
  });
  // Everyone in the document, as poll candidates (docs/specs/012-collaboration/live-poll.md). Self first, then
  // whoever is present on any tab — the order the Collaborators modal uses, so
  // a roster poll's ballot reads the way the panel beside it does. Someone on
  // two tabs appears twice here; de-duplicating is `pollCollaboratorOptions`'s
  // job, along with numbering shared names and applying the cap, so the
  // composer's preview and the frozen ballot cannot disagree.
  const pollCollaborators = useMemo<readonly PollCandidate[]>(
    () => [
      { id: selfParticipant.id, name: selfParticipant.name },
      ...withoutAgentRows([...participantsByTab.values()].flat()).map((p) => ({
        id: p.id,
        name: p.name,
      })),
    ],
    [participantsByTab, selfParticipant],
  );
  // The poll hook reads the roster through a ref, because it is declared long
  // before this point (see the note there).
  useEffect(() => {
    pollCollaboratorsRef.current = pollCollaborators;
  }, [pollCollaborators, pollCollaboratorsRef]);
  return {
    lockedByOther,
    view: {
      // What the agents present name in focus on the active tab, for the focus rings.
      agentFocusByElement,
      laserTrailRows,
      participantsByTab,
      pollCollaborators,
      remoteCursorRows,
      remoteSelectionsByElement,
      lockedByOther,
    },
  };
}

export type EditorPresenceSlice = ReturnType<typeof useEditorPresence>;
