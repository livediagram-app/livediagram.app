// The runtime behaviour of the collaboration elements (docs/specs/012-collaboration/participant-responses.md to docs/specs/012-collaboration/roll-call.md):
// casting a response, revealing an estimate, dropping an anonymous idea,
// pressing an agenda segment, and taking a roll call.
//
// Sibling of useBehaviourElements, and the same shape: a press resolves what
// to do from the element, then calls something that already exists. It is its
// own hook because these write to the DOCUMENT (the behaviour elements mostly
// don't) and because they share one rule the rest of the editor doesn't — see
// `patchElement` below.

import { createSticky } from '@livediagram/diagram';
import {
  checklistDeltaFor,
  clampAgendaMinutes,
  IDEA_MAX_CARDS,
  responseDeltaFor,
  type Element,
  type ShapeElement,
  type Tab,
  type TimerMode,
} from '@livediagram/diagram';
import { participantKey, type Participant } from '@/lib/identity';
import { track } from '@/lib/telemetry';
import type { ApplyElementDelta } from '@/hooks/collab/useElementDeltas';

// How far apart scattered ideas land, in canvas px (docs/specs/012-collaboration/idea-box.md).
const SCATTER_STEP = 20;
const SCATTER_COLS = 4;
const STICKY_SIZE = 160;

export function useCollabElements({
  activeId,
  commitTabs,
  tickTabs,
  applyElementDelta,
  activeElements,
  editsBlocked,
  sessionToolsBlocked,
  selfParticipant,
  livePresence,
  startTimer,
}: {
  activeId: string;
  // Undoable: only scatter uses it, because scatter CREATES stickies, which is
  // authoring like any other add.
  commitTabs: (mapTabs: (ts: Tab[]) => Tab[]) => unknown;
  // Not undoable, and not logged: every press below (docs/specs/012-collaboration/collab-race-hardening.md).
  tickTabs: (mapTabs: (ts: Tab[]) => Tab[]) => void;
  // An answer or an idea: applied here and sent to the room as a delta, so
  // two people pressing the same card at once both land (docs/specs/012-collaboration/collab-race-hardening.md).
  applyElementDelta: ApplyElementDelta;
  // The active tab's elements, to read a checklist row before ticking it.
  activeElements: Element[];
  // A view-role visitor / locked tab. The room already drops their mutations
  // (docs/specs/015-api/api.md), so this is about not lying to them in the UI.
  editsBlocked: boolean;
  // Somebody else is facilitating (docs/specs/012-collaboration/facilitator.md). Revealing, clearing, scattering,
  // rolling and pressing an agenda item are theirs; responding is everyone's.
  sessionToolsBlocked: boolean;
  selfParticipant: Participant;
  livePresence: Participant[];
  startTimer: (mode: TimerMode, durationMs?: number) => void;
}) {
  // `patchElement`, for a verb that runs the room rather than answering it:
  // reveal, clear, roll, agenda. One helper rather than a flag on every call,
  // so which side of the facilitator line a verb sits on is visible in the
  // call itself (docs/specs/012-collaboration/facilitator.md).
  const patchAsFacilitator = (
    elementId: string,
    patch: (el: ShapeElement) => Partial<ShapeElement>,
  ) => {
    if (sessionToolsBlocked) return;
    patchElement(elementId, patch);
  };

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
  // OWNER id: writing it into a shared diagram publishes an `X-Owner-Id`
  // credential to every co-viewer, and it is also unjoinable — peers see us
  // under the room's per-socket presence id (docs/specs/015-api/public-api-and-tokens.md §6), never under this.
  // That mismatch is what made a done check invisible to everyone but the
  // person pressing it.
  const respond = (element: ShapeElement, value: string) => {
    if (editsBlocked) return;
    // ONE answer, as a delta stamped with the card's round (docs/specs/012-collaboration/collab-race-hardening.md): it
    // commutes with everybody else's, and a cast from before a clear is
    // dropped rather than landing in the next round.
    applyElementDelta(
      element.id,
      responseDeltaFor(element, participantKey(selfParticipant), value, Date.now()),
    );
    track(
      'Element',
      'Changed',
      element.shape === 'estimate'
        ? 'Estimate'
        : element.shape === 'done-check'
          ? 'DoneCheck'
          : 'Temperature',
    );
  };

  // --- Estimate card (docs/specs/012-collaboration/estimate-card.md) --------------------------------------------
  const setResponsesRevealed = (element: ShapeElement, revealed: boolean) => {
    patchAsFacilitator(element.id, () => ({ responsesRevealed: revealed }));
    track('Element', 'Changed', 'Estimate');
  };

  const clearResponses = (element: ShapeElement) => {
    // Clearing un-reveals as well: the next round starts closed, or the card
    // would collect its first answer in the open. (A done check has nothing to
    // reveal, so the second field is a harmless no-op there.)
    // A new round (docs/specs/012-collaboration/collab-race-hardening.md): an answer cast before this clear names the old
    // one, so no peer can let it into the next round.
    patchAsFacilitator(element.id, () => ({
      responses: [],
      responsesRevealed: false,
      collabRound: crypto.randomUUID(),
    }));
    track('Element', 'Changed', element.shape === 'done-check' ? 'DoneCheck' : 'Estimate');
  };

  // --- Idea box (docs/specs/012-collaboration/idea-box.md) --------------------------------------------------
  // Anonymity is structural — there is nowhere in `ideaCards` to record an
  // author. Two other routes to a name are closed here rather than in the
  // schema:
  //   * no change-log entry, the same exception the high-frequency vote casts
  //     take (docs/specs/012-collaboration/session-tools.md) — "Priya edited Idea Box" beside six anonymous cards is
  //     a five-second deanonymisation. `tickTabs` is already the non-logging
  //     path, so this comes for free and must STAY free: routing this through
  //     a logging commit would quietly undo the feature.
  //   * no selection, so the docs/specs/007-editor/live-app.md concurrent-selection ring doesn't put a
  //     name on the box at the moment somebody types into it. This function
  //     deliberately never touches the selection.
  const addIdea = (element: ShapeElement, text: string) => {
    const clean = text.trim();
    if (!clean || editsBlocked) return;
    // A full box takes no more: one card past the cap would fail the whole
    // tab's validation on save (docs/specs/012-collaboration/collab-race-hardening.md).
    if ((element.ideaCards ?? []).length >= IDEA_MAX_CARDS) return;
    // ONE idea, as a delta (docs/specs/012-collaboration/collab-race-hardening.md), so two people posting at once both
    // land. Still no author: the delta has nowhere to put one either.
    applyElementDelta(element.id, {
      kind: 'idea',
      text: clean,
      ...(element.collabRound ? { round: element.collabRound } : {}),
    });
    track('Element', 'Changed', 'Idea-box');
  };

  const revealIdeas = (element: ShapeElement) => {
    patchAsFacilitator(element.id, () => ({ ideasRevealed: true }));
    track('Element', 'Changed', 'Idea-box');
  };

  // Empty the box for the next round. Un-reveals as well, exactly as
  // clearResponses does: a box that kept its lid off would collect the first
  // card of the next round in the open, and the whole point of the element is
  // that nothing is visible until somebody decides it is.
  const clearIdeas = (element: ShapeElement) => {
    patchAsFacilitator(element.id, () => ({
      ideaCards: [],
      ideasRevealed: false,
      collabRound: crypto.randomUUID(),
    }));
    track('Element', 'Changed', 'Idea-box');
  };

  // Turn an open box's cards into ordinary sticky notes beside it, which is
  // what a retro does next — they group, move, theme and dot-vote like
  // anything else. Created WITHOUT authorship, so the scatter doesn't undo the
  // anonymity that was the point.
  const scatterIdeas = (element: ShapeElement) => {
    if (editsBlocked || sessionToolsBlocked) return;
    const cards = element.ideaCards ?? [];
    if (cards.length === 0) return;
    const stickies: Element[] = cards.map((text, i) => {
      const col = i % SCATTER_COLS;
      const row = Math.floor(i / SCATTER_COLS);
      const sticky = createSticky(
        element.x + element.width + SCATTER_STEP + col * (STICKY_SIZE + SCATTER_STEP),
        element.y + row * (STICKY_SIZE + SCATTER_STEP),
      );
      return { ...sticky, width: STICKY_SIZE, height: STICKY_SIZE, label: text };
    });
    commitTabs((ts) =>
      ts.map((tab) =>
        tab.id !== activeId ? tab : { ...tab, elements: [...tab.elements, ...stickies] },
      ),
    );
    track('Element', 'Added', 'Sticky');
  };

  // --- Agenda (docs/specs/012-collaboration/agenda.md) ----------------------------------------------------
  // Pressing a segment starts the tab timer through `startTimer` — the same
  // entry point the Current Tab menu and the session button use, so the
  // edit-role gate, the change-log line and the telemetry all still happen
  // exactly once, where they are owned.
  //
  // Pressing while another segment runs REPLACES the timer rather than
  // queueing: an agenda that refuses to move on because the last segment
  // overran is an agenda nobody uses twice.
  const pressAgendaItem = (element: ShapeElement, index: number) => {
    // It starts that item's countdown, so it is the timer wearing a row.
    if (editsBlocked || sessionToolsBlocked) return;
    const item = (element.agendaItems ?? [])[index];
    if (!item) return;
    startTimer('countdown', clampAgendaMinutes(item.minutes) * 60_000);
    patchElement(element.id, () => ({ agendaCurrent: index }));
    track('Element', 'Changed', 'Agenda');
  };

  // --- Roll call (docs/specs/012-collaboration/roll-call.md) -------------------------------------------------
  // Freezes who is here INTO the element: names and colours are copied and
  // never re-joined to the live participant, so someone since renamed or
  // deleted still appears under the name they were in the room under.
  //
  // Ourselves first, then presence — presence lists the OTHERS, and a roll
  // call that omits the person taking it is wrong in the most obvious way.
  const takeRoll = (element: ShapeElement) => {
    if (sessionToolsBlocked) return;
    const at = Date.now();
    const seen = new Set<string>();
    const entries = [selfParticipant, ...livePresence]
      .filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)))
      .map((p) => ({ name: p.name, color: p.color, at }));
    // Replaces rather than merges: a merge would quietly turn "who was here"
    // into "who has ever been here", a different and less useful question.
    patchElement(element.id, () => ({ rollCall: entries }));
    track('Element', 'Changed', 'Roll-call');
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

  return {
    toggleChecklistItem,
    respond,
    setResponsesRevealed,
    clearResponses,
    addIdea,
    revealIdeas,
    clearIdeas,
    scatterIdeas,
    pressAgendaItem,
    takeRoll,
  };
}
