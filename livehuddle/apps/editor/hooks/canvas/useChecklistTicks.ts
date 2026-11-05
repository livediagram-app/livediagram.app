// Ticking a checklist row on the canvas (docs/specs/009-elements/checklist.md): a whole room ticking rows on one
// shared list. A tick used to replace the whole element (and push undo), so two people ticking different rows lost
// one of them. It is one delta naming the row by index and text (docs/specs/012-collaboration/collab-race-hardening.md),
// applied here and sent to the room ahead of the autosave.
//
// What is left of the collaboration elements' room verbs: the rest (responses, ideas, agendas, roll calls) left with
// those elements (docs/specs/002-project-scope/not-in-livehuddle.md "Retired elements").

import { checklistDeltaFor, type Element } from '@livehuddle/document';
import type { ApplyElementDelta } from '@/hooks/collab/useElementDeltas';

export function useChecklistTicks({
  applyElementDelta,
  activeElements,
  editsBlocked,
}: {
  applyElementDelta: ApplyElementDelta;
  // The active tab's elements, to read a checklist row before ticking it.
  activeElements: Element[];
  // A view-role visitor / locked tab. The room already drops their mutations
  // (docs/specs/015-api/api.md), so this is about not lying to them in the UI.
  editsBlocked: boolean;
}) {
  const toggleChecklistItem = (elementId: string, index: number) => {
    if (editsBlocked) return;
    const element = activeElements.find((el) => el.id === elementId);
    const delta = element ? checklistDeltaFor(element, index) : null;
    if (delta) applyElementDelta(elementId, delta);
    // Box ticks deliberately don't track: high-frequency, low-signal,
    // matching docs/specs/012-collaboration/session-tools.md's vote-cast precedent.
  };
  return { toggleChecklistItem };
}
