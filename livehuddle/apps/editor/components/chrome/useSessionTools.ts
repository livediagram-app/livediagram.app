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
      layers,
      activeLayerId,
    ],
  );
}
