// What an undo has to fix up after re-grafting the live fields
// (`graftLiveTabState`, docs/specs/012-collaboration/collab-race-hardening.md).
//
// The graft keeps everybody's presses (answers, the current segment) from the
// present while the authored fields come back from the snapshot. That is right
// until the authored fields are what the presses were ABOUT: an agenda index
// into rows that are no longer there. Then the press has to follow the authored change, the same
// way the edit itself handled it. Pure.

import type { ShapeElement } from './index';
import { followAgendaCurrent } from './agenda-current';

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// `restored` is the snapshot's element with the present's live fields grafted
// on; `present` is the element as it stood before the undo.
export function reconcileRestoredElement(
  restored: ShapeElement,
  present: ShapeElement,
): ShapeElement {
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
