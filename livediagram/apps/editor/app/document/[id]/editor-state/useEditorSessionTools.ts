'use client';

import { useBehaviourElements } from '@/hooks/canvas/useBehaviourElements';
import { useCollabElements } from '@/hooks/canvas/useCollabElements';
import { useQuizElements } from '@/hooks/canvas/useQuizElements';
import { track } from '@/lib/telemetry';
import { pollResultElement } from '@/lib/poll-capture';
import { useTabSession } from '@/hooks/persistence/useTabSession';
import type { EditorDocumentSlice } from './useEditorDocument';
import type { EditorHistorySlice } from './useEditorHistory';
import type { EditorSelectionSlice } from './useEditorSelection';
import type { EditorCollaborationSlice } from './useEditorCollaboration';
import type { EditorRoomSlice } from './useEditorRoom';
import type { EditorCommentsSlice } from './useEditorComments';
import type { EditorEditingSlice } from './useEditorEditing';
import type { EditorLayersSlice } from './useEditorLayers';

// The session tools: timer, dot vote, the session-acting Behaviour elements, the collaboration elements, the
// Quiz and Keep Results. A slice of useEditorState (../useEditorState.ts): it takes the slices composed before
// it and returns its own, with `view`, its part of the editor's view-model.
export function useEditorSessionTools({
  fromDocument,
  fromHistory,
  fromSelection,
  fromCollaboration,
  fromRoom,
  fromComments,
  fromEditing,
  fromLayers,
}: {
  fromDocument: EditorDocumentSlice;
  fromHistory: EditorHistorySlice;
  fromSelection: EditorSelectionSlice;
  fromCollaboration: EditorCollaborationSlice;
  fromRoom: EditorRoomSlice;
  fromComments: EditorCommentsSlice;
  fromEditing: EditorEditingSlice;
  fromLayers: EditorLayersSlice;
}) {
  const { selfParticipant, voteSelfId } = fromDocument;
  const { commitTabs, tickTabs } = fromHistory;
  const { activeId } = fromSelection;
  const { applyElementDelta, ideaPosts, livePresence, roomRef } = fromCollaboration;
  const { facilitator, livePoll } = fromRoom;
  const { activeTab } = fromComments;
  const { editsBlocked, runsBlocked } = fromEditing;
  const { addBoxed } = fromLayers;

  // Live session tools (docs/specs/012-collaboration/session-tools.md): facilitator timer + dot-voting handlers.
  // State lives on the tab (`activeTab.timer` / `activeTab.vote`), so the
  // UI reads it straight off the tab; these are just the mutators.
  const {
    startTimer,
    pauseTimer,
    resumeTimer,
    resetTimer,
    setTimerDuration,
    extendTimer,
    clearTimer,
    startVote,
    endVote,
    revealVote,
    clearVote,
    setVoteReviewIndex,
    castVote,
    retractVote,
  } = useTabSession({
    editsBlocked,
    sessionToolsBlocked: runsBlocked,
    isFacilitator: facilitator.isFacilitator,
    activeId,
    activeTab,
    // The non-history mutator, per docs/specs/012-collaboration/session-tools.md: starting a timer or
    // placing a dot isn't undoable (and mustn't evict real edits
    // from the bounded undo stack).
    commitTabs: tickTabs,
    // Dots and the host are keyed by the collab key, not the owner id: the
    // owner id is a guest's credential, and a dot op broadcasts its voter to
    // every socket in the room (docs/specs/012-collaboration/collab-race-hardening.md, docs/specs/012-collaboration/participant-responses.md).
    selfId: voteSelfId,
    // Straight down the socket, ahead of the autosave (docs/specs/012-collaboration/session-tools.md). A no-op
    // before the room is open, exactly like every other presence-speed send —
    // a solo vote still works, it just has nobody to tell.
    emitVote: (tabId, elementId, delta, round) =>
      roomRef.current?.send({
        kind: 'op',
        op: {
          kind: 'vote',
          tabId,
          elementId,
          voter: voteSelfId,
          delta,
          ...(round ? { round } : {}),
        },
      }),
  });

  // The interactive Behaviour elements that act on the SESSION rather than the
  // document (docs/specs/012-collaboration/session-button.md, /106, /107): the session button's press, the reveal
  // zone's local uncover, and the picker's roll.
  const { pressSessionButton, revealedIds, toggleRevealForMe, pickerFor, setSessionConfigFor } =
    useBehaviourElements({
      activeId,
      commitTabs,
      tickTabs,
      editsBlocked,
      sessionToolsBlocked: runsBlocked,
      selfParticipant,
      livePresence,
      activeTimer: activeTab.timer,
      activeVote: activeTab.vote,
      startTimer,
      pauseTimer,
      resumeTimer,
      startVote,
      startPoll: livePoll.startPoll,
    });

  // The collaboration elements (docs/specs/012-collaboration/participant-responses.md to docs/specs/012-collaboration/roll-call.md). Sibling of the
  // behaviour hook above: these write to the document through `tickTabs`,
  // which does NOT push undo history, so one person's Ctrl+Z can never
  // retract another person's answer (docs/specs/012-collaboration/collab-race-hardening.md). Scatter alone commits.
  const collabElements = useCollabElements({
    activeId,
    commitTabs,
    tickTabs,
    applyElementDelta,
    postIdea: ideaPosts.post,
    activeElements: activeTab.elements,
    editsBlocked,
    sessionToolsBlocked: runsBlocked,
    selfParticipant,
    livePresence,
    startTimer,
  });
  // A checklist tick is a room press like an answer (docs/specs/012-collaboration/collab-race-hardening.md).
  const { toggleChecklistItem } = collabElements;
  // The Quiz (docs/specs/012-collaboration/quiz.md): its own verbs, on the same facilitator-gated patch.
  const quiz = useQuizElements({
    activeId,
    commitTabs,
    applyElementDelta,
    patchAsFacilitator: collabElements.patchAsFacilitator,
    editsBlocked,
    sessionToolsBlocked: runsBlocked,
    selfParticipant,
  });

  // Keeping a poll's results (docs/specs/012-collaboration/poll-result-capture.md). Ends the poll for the room through
  // the SAME `endPoll` the plain End uses — one op, so a participant sees no
  // difference and no new op kind exists — and additionally drops the tallies
  // onto the canvas as an ordinary, undoable element.
  // Keep Results (docs/specs/012-collaboration/poll-result-capture.md): drop a chart of the tallies so far onto the
  // active tab. The poll keeps running, so it can be kept again later
  // (a second chart), and End is still the only thing that ends it.
  const keepPollResults = () => {
    const poll = livePoll.poll;
    if (!poll) return;
    addBoxed((x, y) => pollResultElement(poll, livePoll.answers, x, y));
    track('Element', 'Added', 'PollResult');
  };
  return {
    castVote,
    clearVote,
    retractVote,
    setVoteReviewIndex,
    view: {
      // Live session tools (docs/specs/012-collaboration/session-tools.md)
      startTimer,
      pauseTimer,
      resumeTimer,
      resetTimer,
      setTimerDuration,
      extendTimer,
      clearTimer,
      startVote,
      endVote,
      revealVote,
      clearVote,
      castVote,
      retractVote,
      keepPollResults,
      toggleChecklistItem,
      pressSessionButton,
      revealedIds,
      toggleRevealForMe,
      setSessionConfigFor,
      pickerFor,
      collabElements,
      quiz,
    },
  };
}

export type EditorSessionToolsSlice = ReturnType<typeof useEditorSessionTools>;
