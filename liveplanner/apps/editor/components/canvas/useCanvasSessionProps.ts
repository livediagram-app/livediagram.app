// The Canvas's Timer and Vote props (docs/specs/012-collaboration/session-tools.md): the tab's timer and vote, who
// can cast, the results review and every timer and vote action, read from EditorContext. Split from
// EditorCanvasHost, which spreads them into the Canvas.
import type { CanvasProps } from '@/components/canvas/Canvas.types';
import { useEditorContext } from '@/app/project/[id]/EditorContext';
import { isVoteHost } from '@liveplanner/project';
import { answeringKeys, participantKey, selfInRoom } from '@/lib/identity';

export function useCanvasSessionProps(): Pick<
  CanvasProps,
  | 'timerState'
  | 'voteResults'
  | 'onJumpToVoteResult'
  | 'isVoteHost'
  | 'participantCount'
  | 'tabTimer'
  | 'tabVote'
  | 'onStartTimer'
  | 'onPauseTimer'
  | 'onResumeTimer'
  | 'onResetTimer'
  | 'onClearTimer'
  | 'onSetTimerDuration'
  | 'onStartVote'
  | 'onEndVote'
  | 'onRevealVote'
  | 'onClearVote'
  | 'onCastVote'
  | 'onRetractVote'
  | 'voteReview'
  | 'onNextVoteResult'
  | 'onPrevVoteResult'
  | 'onDoneVoteReview'
> {
  const {
    activeTab,
    voteResults,
    jumpToVoteResult,
    castVote,
    clearTimer,
    clearVote,
    endVote,
    can,
    livePresence,
    pauseTimer,
    resetTimer,
    resumeTimer,
    retractVote,
    voteReview,
    nextVoteResult,
    prevVoteResult,
    doneVoteReview,
    revealVote,
    selfParticipant,
    setTimerDuration,
    startTimer,
    startVote,
  } = useEditorContext();
  return {
    timerState: activeTab.timer ? (activeTab.timer.running ? 'running' : 'paused') : 'none',
    voteResults,
    onJumpToVoteResult: jumpToVoteResult,
    isVoteHost: isVoteHost(activeTab.vote, participantKey(selfParticipant)),
    // Who can cast, ourselves included (livePresence is the REMOTE roster): one per person, never a
    // view-link guest or an agent row (answeringKeys), so turnout never waits on someone who cannot vote.
    participantCount: answeringKeys([selfInRoom(selfParticipant, can.level), ...livePresence])
      .length,
    tabTimer: activeTab.timer,
    tabVote: activeTab.vote,
    onStartTimer: startTimer,
    onPauseTimer: pauseTimer,
    onResumeTimer: resumeTimer,
    onResetTimer: resetTimer,
    onClearTimer: clearTimer,
    onSetTimerDuration: setTimerDuration,
    onStartVote: startVote,
    onEndVote: endVote,
    onRevealVote: revealVote,
    onClearVote: clearVote,
    onCastVote: castVote,
    onRetractVote: retractVote,
    voteReview,
    onNextVoteResult: nextVoteResult,
    onPrevVoteResult: prevVoteResult,
    onDoneVoteReview: doneVoteReview,
  };
}
