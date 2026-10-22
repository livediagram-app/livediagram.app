// What an undo has to fix up after re-grafting the live fields
// (`graftLiveTabState`, docs/specs/012-collaboration/collab-race-hardening.md).
//
// The graft keeps everybody's presses (answers, the current segment) from the
// present while the authored fields come back from the snapshot. That is right
// until the authored fields are what the presses were ABOUT: picks cast
// against a quiz's new options, or an agenda index into rows that are no
// longer there. Then the press has to follow the authored change, the same
// way the edit itself handled it. Pure.

import type { ShapeElement } from './index';
import { followAgendaCurrent } from './agenda-current';
import { quizResetPatch } from './quiz';

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// `restored` is the snapshot's element with the present's live fields grafted
// on; `present` is the element as it stood before the undo.
export function reconcileRestoredElement(
  restored: ShapeElement,
  present: ShapeElement,
  mintRound: () => string,
): ShapeElement {
  if (restored.shape === 'quiz' && present.shape === 'quiz') {
    // A quiz edit returns the card to ready (docs/specs/012-collaboration/quiz.md),
    // so undoing one does too: picks made against the other question or
    // options no longer mean anything.
    const authoredChanged =
      (restored.label ?? '') !== (present.label ?? '') ||
      !same(restored.quizOptions, present.quizOptions) ||
      restored.quizCorrect !== present.quizCorrect;
    const inPlay =
      (restored.responses?.length ?? 0) > 0 ||
      restored.quizStartedAt !== undefined ||
      restored.quizRevealed === true;
    return authoredChanged && inPlay ? { ...restored, ...quizResetPatch(mintRound()) } : restored;
  }
  if (restored.shape === 'agenda' && !same(restored.agendaItems, present.agendaItems)) {
    // docs/specs/012-collaboration/agenda.md "The current segment".
    const current = followAgendaCurrent(
      present.agendaCurrent,
      present.agendaItems ?? [],
      restored.agendaItems ?? [],
    );
    if (current === restored.agendaCurrent) return restored;
    const next: ShapeElement = { ...restored };
    if (current === undefined) {
      delete next.agendaCurrent;
      delete next.agendaTimerStartedAt;
    } else next.agendaCurrent = current;
    return next;
  }
  return restored;
}
