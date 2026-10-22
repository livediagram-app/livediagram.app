'use client';

import { useMemo } from 'react';
import type { SessionToolsProps } from '@/components/chrome/session-tools-props';
import { useEditorContext } from '@/app/document/[id]/EditorContext';

// The session-tools bundle (session-tools-props.ts) read off the editor, for the bottom-right
// cluster's Session strip (docs/specs/012-collaboration/session-tools.md "The Session strip").
export function useSessionTools(): SessionToolsProps {
  const {
    activeTab,
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
  const timer = activeTab.timer ?? null;
  const vote = activeTab.vote ?? null;
  return useMemo(
    () => ({
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
