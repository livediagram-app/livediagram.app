// The runtime behaviour of the collaboration elements (spec/122 to spec/129):
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
  clampAgendaMinutes,
  clearResponse,
  responseOf,
  setResponse,
  type Element,
  type ShapeElement,
  type Tab,
  type TimerMode,
} from '@livediagram/diagram';
import type { Participant } from '@/lib/identity';
import { track } from '@/lib/telemetry';

// How far apart scattered ideas land, in canvas px (spec/125).
const SCATTER_STEP = 20;
const SCATTER_COLS = 4;
const STICKY_SIZE = 160;

export function useCollabElements({
  activeId,
  commitTabs,
  editsBlocked,
  selfParticipant,
  livePresence,
  startTimer,
}: {
  activeId: string;
  commitTabs: (mapTabs: (ts: Tab[]) => Tab[]) => unknown;
  // A view-role visitor / locked tab. The room already drops their mutations
  // (spec/11), so this is about not lying to them in the UI.
  editsBlocked: boolean;
  selfParticipant: Participant;
  livePresence: Participant[];
  startTimer: (mode: TimerMode, durationMs?: number) => void;
}) {
  // Patch one element on the active tab.
  //
  // Every write here goes through `commitTabs`, which does NOT push undo
  // history — the same call a dot-vote cast makes (spec/39). That is
  // deliberate and load-bearing: undo is a personal control, and one person
  // pressing Ctrl+Z must never retract another person's answer (spec/122).
  const patchElement = (elementId: string, patch: (el: ShapeElement) => Partial<ShapeElement>) => {
    if (editsBlocked) return;
    commitTabs((ts) =>
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

  // --- Responses (spec/122) -------------------------------------------------
  // Cast, or withdraw by pressing your own answer again — one press, so there
  // is no second control to find.
  const respond = (element: ShapeElement, value: string) => {
    const already = responseOf(element.responses, selfParticipant.id) === value;
    patchElement(element.id, (el) => ({
      responses: already
        ? clearResponse(el.responses, selfParticipant.id)
        : setResponse(el.responses, selfParticipant.id, value, Date.now()),
    }));
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

  // --- Estimate card (spec/123) --------------------------------------------
  const setResponsesRevealed = (element: ShapeElement, revealed: boolean) => {
    patchElement(element.id, () => ({ responsesRevealed: revealed }));
    track('Element', 'Changed', 'Estimate');
  };

  const clearResponses = (element: ShapeElement) => {
    // Clearing un-reveals as well: the next round starts closed, or the card
    // would collect its first answer in the open. (A done check has nothing to
    // reveal, so the second field is a harmless no-op there.)
    patchElement(element.id, () => ({ responses: [], responsesRevealed: false }));
    track('Element', 'Changed', element.shape === 'done-check' ? 'DoneCheck' : 'Estimate');
  };

  // --- Idea box (spec/125) --------------------------------------------------
  // Anonymity is structural — there is nowhere in `ideaCards` to record an
  // author. Two other routes to a name are closed here rather than in the
  // schema:
  //   * no change-log entry, the same exception the high-frequency vote casts
  //     take (spec/39) — "Priya edited Idea Box" beside six anonymous cards is
  //     a five-second deanonymisation. `commitTabs` is already the non-logging
  //     path, so this comes for free and must STAY free: routing this through
  //     a logging commit would quietly undo the feature.
  //   * no selection, so the spec/07 concurrent-selection ring doesn't put a
  //     name on the box at the moment somebody types into it. This function
  //     deliberately never touches the selection.
  const addIdea = (element: ShapeElement, text: string) => {
    const clean = text.trim();
    if (!clean) return;
    patchElement(element.id, (el) => ({ ideaCards: [...(el.ideaCards ?? []), clean] }));
    track('Element', 'Changed', 'Idea-box');
  };

  const revealIdeas = (element: ShapeElement) => {
    patchElement(element.id, () => ({ ideasRevealed: true }));
    track('Element', 'Changed', 'Idea-box');
  };

  // Turn an open box's cards into ordinary sticky notes beside it, which is
  // what a retro does next — they group, move, theme and dot-vote like
  // anything else. Created WITHOUT authorship, so the scatter doesn't undo the
  // anonymity that was the point.
  const scatterIdeas = (element: ShapeElement) => {
    if (editsBlocked) return;
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

  // --- Agenda (spec/127) ----------------------------------------------------
  // Pressing a segment starts the tab timer through `startTimer` — the same
  // entry point the Current Tab menu and the session button use, so the
  // edit-role gate, the change-log line and the telemetry all still happen
  // exactly once, where they are owned.
  //
  // Pressing while another segment runs REPLACES the timer rather than
  // queueing: an agenda that refuses to move on because the last segment
  // overran is an agenda nobody uses twice.
  const pressAgendaItem = (element: ShapeElement, index: number) => {
    if (editsBlocked) return;
    const item = (element.agendaItems ?? [])[index];
    if (!item) return;
    startTimer('countdown', clampAgendaMinutes(item.minutes) * 60_000);
    patchElement(element.id, () => ({ agendaCurrent: index }));
    track('Element', 'Changed', 'Agenda');
  };

  // --- Roll call (spec/129) -------------------------------------------------
  // Freezes who is here INTO the element: names and colours are copied and
  // never re-joined to the live participant, so someone since renamed or
  // deleted still appears under the name they were in the room under.
  //
  // Ourselves first, then presence — presence lists the OTHERS, and a roll
  // call that omits the person taking it is wrong in the most obvious way.
  const takeRoll = (element: ShapeElement) => {
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

  return {
    respond,
    setResponsesRevealed,
    clearResponses,
    addIdea,
    revealIdeas,
    scatterIdeas,
    pressAgendaItem,
    takeRoll,
  };
}
