import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { useStableCollab } from '@/components/canvas/element-layer-props';
import { participantKey, selfInRoom } from '@/lib/identity';

// The collaboration elements (docs/specs/012-collaboration/estimate-card.md to
// docs/specs/012-collaboration/roll-call.md). One bag for all their faces; the write handlers drop out
// entirely for a view-role visitor. Held stable while nothing a face shows changes, so a render here
// does not re-render every element (docs/specs/008-canvas/canvas-performance.md).
export function useHostCollab(runBlocked: boolean) {
  const {
    selfParticipant,
    can,
    livePresence,
    activeTab,
    isReadOnly,
    collabElements,
    qaBoard,
    quiz,
  } = useEditorContext();
  return useStableCollab({
    // The document-write key, not the owner id: see CollabApi.selfKey.
    selfKey: participantKey(selfParticipant),
    // Ourselves first: livePresence is the REMOTE roster, and an estimate
    // card that can't show your own avatar is showing the wrong room. Our row carries our own level, as a peer's
    // does, so a Viewer's screen never waits on the Viewer.
    participants: [selfInRoom(selfParticipant, can.level), ...livePresence],
    tabTimer: activeTab.timer,
    canArrange: !isReadOnly,
    // Taking part is a Participant's too (docs/specs/013-workspace/share-roles.md); running stays an Editor's.
    respond: can.takePart ? collabElements.respond : undefined,
    setResponsesRevealed:
      isReadOnly || runBlocked ? undefined : collabElements.setResponsesRevealed,
    clearResponses: isReadOnly || runBlocked ? undefined : collabElements.clearResponses,
    chooseEstimateScale: isReadOnly ? undefined : collabElements.chooseEstimateScale,
    addIdea: can.takePart ? collabElements.addIdea : undefined,
    revealIdeas: isReadOnly || runBlocked ? undefined : collabElements.revealIdeas,
    clearIdeas: isReadOnly || runBlocked ? undefined : collabElements.clearIdeas,
    scatterIdeas: isReadOnly || runBlocked ? undefined : collabElements.scatterIdeas,
    pressAgendaItem: isReadOnly || runBlocked ? undefined : collabElements.pressAgendaItem,
    resetAgenda: isReadOnly || runBlocked ? undefined : collabElements.resetAgenda,
    takeRoll: isReadOnly || runBlocked ? undefined : collabElements.takeRoll,
    // The Q&A board (docs/specs/012-collaboration/qa-board.md). Adding and voting are a Participant's
    // (docs/specs/013-workspace/share-roles.md: a Viewer only looks); the server owns the board and
    // gates them. Running it is the facilitator's, else any editor's.
    selfOwnerId: selfParticipant.id,
    selfName: selfParticipant.name,
    addQaNote: can.takePart ? qaBoard.addQaNote : undefined,
    voteQaNote: can.takePart ? qaBoard.voteQaNote : undefined,
    discussQaNote: isReadOnly || runBlocked ? undefined : qaBoard.discussQaNote,
    closeQaNote: isReadOnly || runBlocked ? undefined : qaBoard.closeQaNote,
    reopenQaNote: isReadOnly || runBlocked ? undefined : qaBoard.reopenQaNote,
    removeQaNote: isReadOnly || runBlocked ? undefined : qaBoard.removeQaNote,
    clearQaBoard: isReadOnly || runBlocked ? undefined : qaBoard.clearQaBoard,
    // The Quiz (docs/specs/012-collaboration/quiz.md). Picking is everyone's with edit rights;
    // editing and running the round are the facilitator's, else any editor's.
    answerQuiz: can.takePart ? quiz.answerQuiz : undefined,
    startQuiz: isReadOnly || runBlocked ? undefined : quiz.startQuiz,
    lockQuiz: isReadOnly || runBlocked ? undefined : quiz.lockQuiz,
    revealQuiz: isReadOnly || runBlocked ? undefined : quiz.revealQuiz,
    resetQuiz: isReadOnly || runBlocked ? undefined : quiz.resetQuiz,
    saveQuiz: isReadOnly || runBlocked ? undefined : quiz.saveQuiz,
  });
}
