import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { useStableCollab } from '@/components/canvas/element-layer-props';
import { roleGates } from '@/lib/editor-capabilities';
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
  const gates = roleGates(can, runBlocked);
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
    setResponsesRevealed: !gates.run ? undefined : collabElements.setResponsesRevealed,
    clearResponses: !gates.run ? undefined : collabElements.clearResponses,
    chooseEstimateScale: !gates.shape ? undefined : collabElements.chooseEstimateScale,
    addIdea: can.takePart ? collabElements.addIdea : undefined,
    revealIdeas: !gates.run ? undefined : collabElements.revealIdeas,
    clearIdeas: !gates.run ? undefined : collabElements.clearIdeas,
    scatterIdeas: !gates.run ? undefined : collabElements.scatterIdeas,
    pressAgendaItem: !gates.run ? undefined : collabElements.pressAgendaItem,
    resetAgenda: !gates.run ? undefined : collabElements.resetAgenda,
    takeRoll: !gates.run ? undefined : collabElements.takeRoll,
    // The Q&A board (docs/specs/012-collaboration/qa-board.md). Adding and voting are a Participant's
    // (docs/specs/013-workspace/share-roles.md: a Viewer only looks); the server owns the board and
    // gates them. Running it is the facilitator's, else any editor's.
    selfOwnerId: selfParticipant.id,
    selfName: selfParticipant.name,
    addQaNote: can.takePart ? qaBoard.addQaNote : undefined,
    voteQaNote: can.takePart ? qaBoard.voteQaNote : undefined,
    discussQaNote: !gates.run ? undefined : qaBoard.discussQaNote,
    closeQaNote: !gates.run ? undefined : qaBoard.closeQaNote,
    reopenQaNote: !gates.run ? undefined : qaBoard.reopenQaNote,
    removeQaNote: !gates.run ? undefined : qaBoard.removeQaNote,
    clearQaBoard: !gates.run ? undefined : qaBoard.clearQaBoard,
    // The Quiz (docs/specs/012-collaboration/quiz.md). Picking is everyone's with edit rights;
    // editing and running the round are the facilitator's, else any editor's.
    answerQuiz: can.takePart ? quiz.answerQuiz : undefined,
    startQuiz: !gates.run ? undefined : quiz.startQuiz,
    lockQuiz: !gates.run ? undefined : quiz.lockQuiz,
    revealQuiz: !gates.run ? undefined : quiz.revealQuiz,
    resetQuiz: !gates.run ? undefined : quiz.resetQuiz,
    saveQuiz: !gates.run ? undefined : quiz.saveQuiz,
  });
}
