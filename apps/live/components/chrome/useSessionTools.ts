'use client';

import { useMemo } from 'react';
import type { SessionToolsProps } from '@/components/chrome/session-tools-props';
import { useEditorContext } from '@/app/document/[id]/EditorContext';

// The session-tools bundle (session-tools-props.ts) read off the editor, for the bottom-right
// cluster's Session strip (docs/specs/012-collaboration/session-tools.md "The Session strip").
export function useSessionTools(): SessionToolsProps {
  const {
    activeTab,
    facilitator,
    startTimer,
    pauseTimer,
    resumeTimer,
    resetTimer,
    extendTimer,
    clearTimer,
    startVote,
    endVote,
    revealVote,
    clearVote,
    livePoll,
    documentShareable,
    documentTeamId,
    pollCollaborators,
    layers,
    activeLayerId,
  } = useEditorContext();
  // Who is running the session when it is not us (docs/specs/012-collaboration/facilitator.md): the roster's
  // name, so a rename reads correctly, else as last seen while an absent holder keeps the baton; null when we hold it.
  const facilitatedBy =
    facilitator.sessionToolsBlocked && facilitator.facilitatorId
      ? (facilitator.facilitatorName ?? 'Someone else')
      : null;
  const timer = activeTab.timer ?? null;
  const vote = activeTab.vote ?? null;
  // A poll only reaches other people through the realtime room (docs/specs/012-collaboration/live-poll.md).
  // Unshared and off-team, it still runs, just for you; the composer says so rather than refusing.
  const pollHasAudience = documentShareable || !!documentTeamId;
  return useMemo(
    () => ({
      facilitatedBy,
      facilitating: facilitator.isFacilitator,
      timer,
      vote,
      onStartTimer: startTimer,
      onPauseTimer: pauseTimer,
      onResumeTimer: resumeTimer,
      onResetTimer: resetTimer,
      onExtendTimer: extendTimer,
      onClearTimer: clearTimer,
      onStartVote: startVote,
      onEndVote: endVote,
      onRevealVote: revealVote,
      onClearVote: clearVote,
      livePoll: livePoll.poll,
      pollHasAudience,
      onStartPoll: livePoll.startPoll,
      pollCollaborators,
      voteLayers: layers,
      activeLayerId,
    }),
    [
      facilitatedBy,
      facilitator.isFacilitator,
      timer,
      vote,
      startTimer,
      pauseTimer,
      resumeTimer,
      resetTimer,
      extendTimer,
      clearTimer,
      startVote,
      endVote,
      revealVote,
      clearVote,
      livePoll.poll,
      pollHasAudience,
      livePoll.startPoll,
      pollCollaborators,
      layers,
      activeLayerId,
    ],
  );
}
