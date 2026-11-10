import { useEditorContext } from '@/app/document/[id]/EditorContext';
import type { CanvasProps } from '@/components/canvas/Canvas.types';
import type { useSessionTools } from '@/components/chrome/useSessionTools';
import { PARTICIPANT_CANVAS_TOOLS } from '@/components/palette/palette-layouts';
import { isButtonMode, isBoxed, isVoteHost } from '@livediagram/document';
import { commentPersisters } from '@/lib/comment-persistence';
import { pollHostFor } from '@/hooks/collab/useLivePoll';
import { answeringKeys, participantKey, selfInRoom } from '@/lib/identity';

// The Canvas props for running a session (EditorCanvasHost): reactions, Bring Focus, the behaviour
// elements, the comment and action panels, Follow-me, the Session strip, the live poll, the timer and the
// vote. Read straight from EditorContext, as the host does.
export function useSessionCanvasProps({
  runBlocked,
  sessionTools,
}: {
  runBlocked: boolean;
  sessionTools: ReturnType<typeof useSessionTools>;
}) {
  const {
    activeTab,
    voteResults,
    jumpToVoteResult,
    livePoll,
    fireReaction,
    pressFocusButton,
    reactionBursts,
    clearReactionBurst,
    castVote,
    clearTimer,
    clearVote,
    accountUserId,
    documentId,
    endVote,
    facilitator,
    isReadOnly,
    can,
    livePresence,
    openAssignActionDialog,
    completeAction,
    reopenAction,
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
    sessionShareCode,
    pressModeButton,
    pressSessionButton,
    revealedIds,
    toggleRevealForMe,
    setSessionConfigFor,
    setTimerDuration,
    addComment,
    deleteComment,
    resolveThread,
    unresolveThread,
    pickerFor,
    followMe,
    keepPollResults,
    startTimer,
    startVote,
  } = useEditorContext();
  // Who may end the poll: its starter or the facilitator (pollHostFor).
  const pollHost = pollHostFor({
    started: livePoll.isHost,
    open: !!livePoll.poll,
    sessionToolsBlocked: runBlocked,
    facilitating: facilitator.isFacilitator,
  });
  // How a comment change made on a Comment panel is kept: shared with the anchored popover.
  const commentPersist = commentPersisters({
    readOnly: isReadOnly,
    documentId,
    tabId: activeTab.id,
    selfId: selfParticipant.id,
    shareCode: sessionShareCode,
  });
  const threadOn = (elementId: string) => {
    const el = activeTab.elements.find((e) => e.id === elementId);
    return el && isBoxed(el) ? el.commentThread : undefined;
  };
  return {
    onFireReaction: can.takePart ? fireReaction : undefined,
    // Bring Focus (docs/specs/012-collaboration/bring-focus.md) is live for view-role visitors too: it mutates
    // nothing, which makes it the same read-only act as following somebody,
    // and the person who spots the thing worth looking at is often not the
    // one with edit rights.
    // Bring Focus (docs/specs/012-collaboration/bring-focus.md) is the facilitator's while somebody holds the
    // baton (docs/specs/012-collaboration/facilitator.md): "everybody look here" is the same act as "everybody
    // stop and listen". Undefined renders the face inert, which is what a
    // read-only surface already gets.
    onPressFocusButton: isReadOnly || runBlocked ? undefined : pressFocusButton,
    reactionBursts: reactionBursts,
    onReactionBurstDone: clearReactionBurst,
    // Mode button (docs/specs/009-elements/mode-button.md): pressing one is exactly picking that mode from
    // the palette, so it goes through the same setter: telemetry, the
    // selection clear, and the empty-canvas guard all included. Pressing it
    // again, while already in that mode, hands you back your previous one.
    // A read-only session presses only the modes it has (PARTICIPANT_CANVAS_TOOLS): a button set to the Eraser or
    // Format Painter does nothing for it (docs/specs/013-workspace/share-roles.md).
    onPressModeButton: (element) => {
      // A retired Avatar button (docs/specs/009-elements/retired-elements.md) hands out nothing.
      const mode = element.mode;
      if (!isButtonMode(mode)) return;
      if (isReadOnly && !PARTICIPANT_CANVAS_TOOLS.includes(mode)) return;
      pressModeButton(mode);
    },
    // Session button (docs/specs/012-collaboration/session-button.md) / Reveal zone (docs/specs/009-elements/reveal-zone.md) / Picker (docs/specs/012-collaboration/picker.md):
    // see useBehaviourElements: the press resolves what to do from the
    // element and calls the tool that already exists.
    onPressSessionButton: pressSessionButton,
    sessionStartBlocked: isReadOnly || runBlocked,
    sessionRunBy: isReadOnly ? null : sessionTools.facilitatedBy,
    timerState: activeTab.timer ? (activeTab.timer.running ? 'running' : 'paused') : 'none',
    revealedIds: revealedIds,
    // A cover is the facilitator's to lift while one is running the session
    // (docs/specs/012-collaboration/facilitator.md); with nobody facilitating it stays the private peek it has
    // always been (docs/specs/009-elements/reveal-zone.md).
    onToggleReveal: runBlocked ? undefined : toggleRevealForMe,
    onSetSessionConfig: isReadOnly || runBlocked ? undefined : setSessionConfigFor,
    // Comment panels (docs/specs/012-collaboration/comment-pin.md) drive the SAME thread machinery the anchored
    // popover does: it is all keyed by element id already.
    commentSelfId: selfParticipant.id,
    // Commenting is a Participant's too (docs/specs/013-workspace/share-roles.md); a Viewer only reads.
    commentPanelActions: !can.takePart
      ? undefined
      : {
          // A Participant has no autosave: its panel changes go through the comment endpoints, as the
          // popover's do (lib/comment-persistence.ts); an Editor's ride the room and its save.
          add: (id, text, mentions) =>
            addComment(id, text, commentPersist.add(id, text, mentions), mentions),
          remove: (id, cid) => deleteComment(id, cid, commentPersist.remove(cid), threadOn(id)),
          resolve: (id) => resolveThread(id, commentPersist.threadState(threadOn(id), true)),
          unresolve: (id) => unresolveThread(id, commentPersist.threadState(threadOn(id), false)),
        },
    // Action panels (docs/specs/012-collaboration/action-panel.md) drive the SAME action machinery the popover
    // and the Assign Action dialog do. The viewer identity is the one the
    // popover uses: the signed-in account, else the guest participant.
    actionSelfId: accountUserId ?? selfParticipant.id,
    actionPanelActions: isReadOnly
      ? undefined
      : {
          configure: openAssignActionDialog,
          complete: completeAction,
          reopen: reopenAction,
        },
    // Everyone sees what a Picker holds; only an Editor spins it (ElementFaceRouter, share-roles.md).
    onRollPicker: pickerFor,
    // Follow-me (docs/specs/012-collaboration/follow-me-viewport.md): resolved to a NAME here, where presence lives,
    // so the pill doesn't have to look one up.
    followingName: followMe.followingId
      ? (livePresence.find((p) => p.id === followMe.followingId)?.name ?? 'someone')
      : null,
    onStopFollowing: followMe.stopFollowing,
    pollPanel:
      // Results are for the host and for anyone who has responded
      // (docs/specs/012-collaboration/live-poll.md): answering is what buys you the tally. A local
      // Dismiss hides it without ending the poll for everyone.
      livePoll.poll && !livePoll.dismissed && (pollHost || livePoll.myAnswer)
        ? {
            poll: livePoll.poll,
            answers: livePoll.answers,
            isHost: pollHost,
            onEnd: livePoll.endPoll,
            // docs/specs/012-collaboration/poll-result-capture.md: drops the tallies so far onto the canvas without
            // ending the poll. Read-only visitors never see it: they are
            // never the host.
            onKeepResults: isReadOnly ? undefined : keepPollResults,
            onDismiss: livePoll.dismissPoll,
          }
        : null,
    voteResults: voteResults,
    onJumpToVoteResult: jumpToVoteResult,
    // A vote's starter is not its host while somebody else facilitates: every control would be refused.
    isVoteHost:
      !runBlocked &&
      isVoteHost(activeTab.vote, participantKey(selfParticipant), facilitator.isFacilitator),
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
    voteReview: voteReview,
    onNextVoteResult: nextVoteResult,
    onPrevVoteResult: prevVoteResult,
    onDoneVoteReview: doneVoteReview,
  } satisfies Partial<CanvasProps>;
}
