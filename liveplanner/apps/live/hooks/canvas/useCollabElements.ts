// The runtime behaviour of the collaboration elements (docs/specs/012-collaboration/participant-responses.md,
// temperature-check.md): casting a response, clearing the readings, and ticking a checklist row.
//
// Sibling of useBehaviourElements, and the same shape: a press resolves what
// to do from the element, then calls something that already exists. It is its
// own hook because these write to the PROJECT (the behaviour elements mostly
// don't) and because they share one rule the rest of the editor doesn't — see
// `patchElement` below.

import {
  checklistDeltaFor,
  responseDeltaFor,
  type Element,
  type ShapeElement,
  type Tab,
} from '@liveplanner/project';
import { participantKey, type Participant } from '@/lib/identity';
import { track } from '@/lib/telemetry';
import type { ApplyElementDelta } from '@/hooks/collab/useElementDeltas';

export function useCollabElements({
  activeId,
  tickTabs,
  applyElementDelta,
  activeElements,
  editsBlocked,
  selfParticipant,
}: {
  activeId: string;
  // Not undoable, and not logged: every press below (docs/specs/012-collaboration/collab-race-hardening.md).
  tickTabs: (mapTabs: (ts: Tab[]) => Tab[]) => void;
  // An answer: applied here and sent to the room as a delta, so two people pressing the same card at once both
  // land (docs/specs/012-collaboration/collab-race-hardening.md).
  applyElementDelta: ApplyElementDelta;
  // The active tab's elements, to read a checklist row before ticking it.
  activeElements: Element[];
  // A view-role visitor / locked tab. The room already drops their mutations
  // (docs/specs/015-api/api.md), so this is about not lying to them in the UI.
  editsBlocked: boolean;
  selfParticipant: Participant;
}) {
  // Patch one element on the active tab, through `tickTabs`: no undo history,
  // because undo is a personal control and one person's Ctrl+Z must never
  // retract another's answer (docs/specs/012-collaboration/participant-responses.md). Undo re-grafts these fields too
  // (`LIVE_ELEMENT_FIELDS`), so an older snapshot can't take them back.
  const patchElement = (elementId: string, patch: (el: ShapeElement) => Partial<ShapeElement>) => {
    if (editsBlocked) return;
    tickTabs((ts) =>
      ts.map((tab) =>
        tab.id !== activeId
          ? tab
          : {
              ...tab,
              elements: tab.elements.map((el) =>
                el.id === elementId && el.type === 'shape' ? { ...el, ...patch(el) } : el,
              ),
            },
      ),
    );
  };

  // --- Responses (docs/specs/012-collaboration/participant-responses.md) -------------------------------------------------
  // Cast, or withdraw by pressing your own answer again — one press, so there
  // is no second control to find.
  //
  // Keyed on `participantKey`, NOT on `selfParticipant.id`. The id is our
  // OWNER id: writing it into a shared project publishes an `X-Owner-Id`
  // credential to every co-viewer, and it is also unjoinable — peers see us
  // under the room's per-socket presence id (docs/specs/015-api/public-api-and-tokens.md §6), never under this.
  const respond = (element: ShapeElement, value: string) => {
    if (editsBlocked) return;
    // ONE answer, as a delta stamped with the card's round (docs/specs/012-collaboration/collab-race-hardening.md): it
    // commutes with everybody else's, and a cast from before a clear is
    // dropped rather than landing in the next round.
    applyElementDelta(
      element.id,
      responseDeltaFor(element, participantKey(selfParticipant), value, Date.now()),
    );
    track('Element', 'Changed', 'Temperature');
  };

  const clearResponses = (element: ShapeElement) => {
    // A new round (docs/specs/012-collaboration/collab-race-hardening.md): an answer cast before this clear names the old
    // one, so no peer can let it into the next round.
    patchElement(element.id, () => ({ responses: [], collabRound: crypto.randomUUID() }));
    track('Element', 'Changed', 'Temperature');
  };

  // --- Checklist (docs/specs/009-elements/checklist.md) --------------------------------------------------
  // Not one of the collaboration family, but the same problem: a whole room
  // ticking rows on one shared list. A tick used to replace the whole element
  // (and push undo), so two people ticking different rows lost one of them.
  // Now it is one delta naming the row by index and text (docs/specs/012-collaboration/collab-race-hardening.md).
  const toggleChecklistItem = (elementId: string, index: number) => {
    if (editsBlocked) return;
    const element = activeElements.find((el) => el.id === elementId);
    const delta = element ? checklistDeltaFor(element, index) : null;
    if (delta) applyElementDelta(elementId, delta);
    // Box ticks deliberately don't track: high-frequency, low-signal,
    // matching docs/specs/012-collaboration/session-tools.md's vote-cast precedent.
  };

  return { toggleChecklistItem, respond, clearResponses };
}
