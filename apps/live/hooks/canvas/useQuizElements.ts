// The runtime behaviour of the Quiz (docs/specs/012-collaboration/quiz.md):
// editing the question, starting, locking, revealing and resetting a round,
// and picking an answer.
//
// Its own hook rather than more verbs in useCollabElements, which already
// holds five elements' worth; it reuses that hook's facilitator-gated patch so
// the line between "running the room" and "answering it" is drawn once.

import {
  clampQuizSeconds,
  QUIZ_MAX_OPTIONS,
  QUIZ_OPTION_MAX_TEXT,
  quizPhase,
  quizResetPatch,
  quizStartPatch,
  responseDeltaFor,
  type ShapeElement,
  type Tab,
} from '@livediagram/diagram';
import { participantKey, type Participant } from '@/lib/identity';
import { track } from '@/lib/telemetry';
import type { ApplyElementDelta } from '@/hooks/collab/useElementDeltas';

// What the Edit Quiz dialog hands back.
export type QuizDraft = {
  question: string;
  options: string[];
  correct: number;
  seconds: number;
};

export function useQuizElements({
  activeId,
  commitTabs,
  applyElementDelta,
  patchAsFacilitator,
  editsBlocked,
  sessionToolsBlocked,
  selfParticipant,
}: {
  activeId: string;
  // Undoable: only saving an edit uses it, because the question and its
  // answers are authoring like any other label.
  commitTabs: (mapTabs: (ts: Tab[]) => Tab[]) => unknown;
  applyElementDelta: ApplyElementDelta;
  // useCollabElements' non-history patch, gated on the baton.
  patchAsFacilitator: (
    elementId: string,
    patch: (el: ShapeElement) => Partial<ShapeElement>,
  ) => void;
  editsBlocked: boolean;
  sessionToolsBlocked: boolean;
  selfParticipant: Participant;
}) {
  // --- Answering: everyone's -------------------------------------------------
  // One pick per person on the responses primitive, the answer's index as the
  // value. Pressing your own pick again withdraws it (responseDeltaFor), and
  // pressing another moves it. Refused once the round has locked: the face
  // stops offering the press at the same instant, this is the backstop.
  const answerQuiz = (element: ShapeElement, index: number) => {
    if (editsBlocked) return;
    if (quizPhase(element, Date.now()) !== 'open') return;
    applyElementDelta(
      element.id,
      responseDeltaFor(element, participantKey(selfParticipant), String(index), Date.now()),
    );
    track('Element', 'Changed', 'Quiz');
  };

  // --- Running the round: the facilitator's ----------------------------------
  // A new collabRound on every start and reset, so a pick cast in one round can
  // never land in the next (docs/specs/012-collaboration/collab-race-hardening.md).
  const startQuiz = (element: ShapeElement) => {
    if (quizPhase(element, Date.now()) === 'setup') return;
    patchAsFacilitator(element.id, () => quizStartPatch(Date.now(), crypto.randomUUID()));
    track('Element', 'Changed', 'Quiz');
  };

  const lockQuiz = (element: ShapeElement) => {
    patchAsFacilitator(element.id, (el) =>
      quizPhase(el, Date.now()) === 'open' ? { quizLockedAt: Date.now() } : {},
    );
    track('Element', 'Changed', 'Quiz');
  };

  // Revealing an open round locks it at the same time, so nobody can change a
  // pick after the answer is out.
  const revealQuiz = (element: ShapeElement) => {
    patchAsFacilitator(element.id, (el) => ({
      quizRevealed: true,
      ...(quizPhase(el, Date.now()) === 'open' ? { quizLockedAt: Date.now() } : {}),
    }));
    track('Element', 'Changed', 'Quiz');
  };

  const resetQuiz = (element: ShapeElement) => {
    patchAsFacilitator(element.id, () => quizResetPatch(crypto.randomUUID()));
    track('Element', 'Changed', 'Quiz');
  };

  // Saving an edit is authoring, so it is undoable and logged like any label
  // change. It also returns the card to `ready`: picks cast against the old
  // answers no longer mean anything.
  const saveQuiz = (element: ShapeElement, draft: QuizDraft) => {
    if (editsBlocked || sessionToolsBlocked) return;
    const options = draft.options
      .map((o) => o.trim().slice(0, QUIZ_OPTION_MAX_TEXT))
      .slice(0, QUIZ_MAX_OPTIONS);
    const patch: Partial<ShapeElement> = {
      label: draft.question.trim(),
      quizOptions: options,
      quizCorrect: draft.correct,
      quizSeconds: clampQuizSeconds(draft.seconds),
      ...quizResetPatch(crypto.randomUUID()),
    };
    commitTabs((ts) =>
      ts.map((tab) =>
        tab.id !== activeId
          ? tab
          : {
              ...tab,
              elements: tab.elements.map((el) =>
                el.id === element.id && el.type === 'shape' ? { ...el, ...patch } : el,
              ),
            },
      ),
    );
    track('Element', 'Changed', 'Quiz');
  };

  return { answerQuiz, startQuiz, lockQuiz, revealQuiz, resetQuiz, saveQuiz };
}
