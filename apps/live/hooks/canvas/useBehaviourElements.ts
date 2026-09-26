// The runtime behaviour of the three interactive Behaviour elements that act
// on the SESSION rather than on the document: the Session button (spec/105),
// the Reveal zone's local uncover (spec/106), and the Picker's roll (spec/107).
//
// They live together because they share a shape — a press resolves what to do
// from the element, then calls something that already exists (the session-tool
// entry points, the presence list, the element commit) — and because none of
// them belongs to the style hooks: two of the three don't write to the diagram
// at all.

import { useState } from 'react';
import {
  sessionButtonPlan,
  type PollStyle,
  type SessionButtonConfig,
  type ShapeElement,
  type Tab,
  type TabVote,
  type TimerMode,
} from '@livediagram/diagram';
import type { Participant } from '@/lib/identity';
import { pickerCandidates, rollPicker } from '@/lib/picker';
import { track } from '@/lib/telemetry';

export function useBehaviourElements({
  activeId,
  commitTabs,
  tickTabs,
  editsBlocked,
  sessionToolsBlocked,
  selfParticipant,
  livePresence,
  activeTimer,
  activeVote,
  startTimer,
  pauseTimer,
  resumeTimer,
  startVote,
  startPoll,
}: {
  activeId: string;
  commitTabs: (mapTabs: (ts: Tab[]) => Tab[]) => unknown;
  // The picker's roll: a session event, not an edit, so not undoable.
  tickTabs: (mapTabs: (ts: Tab[]) => Tab[]) => void;
  // True for a view-role visitor / a locked tab: they may take part in a
  // session tool but not start one (spec/39), and their picker roll is theirs
  // alone rather than a write everyone sees.
  editsBlocked: boolean;
  // Somebody else is facilitating (spec/149): pressing a session button,
  // spinning the picker for the room and lifting a cover are theirs.
  sessionToolsBlocked: boolean;
  selfParticipant: Participant;
  livePresence: Participant[];
  // The tab's timer right now, so a timer button can act on it rather than
  // stomping it (spec/105): pressing while one is running PAUSES, pressing
  // while one is paused RESUMES. Only a tab with no timer starts a new one.
  activeTimer: { running: boolean } | undefined;
  // The running vote, if any: a vote button pressed mid-vote must not start a
  // fresh one over it, which reset every dot on the board (spec/152).
  activeVote: TabVote | undefined;
  startTimer: (mode: TimerMode, durationMs?: number) => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  startVote: (votesPerPerson: number) => void;
  startPoll: (draft: { question: string; style: PollStyle; options: string[] }) => void;
}) {
  // --- Session button (spec/105) --------------------------------------------
  // Pressing one starts the tool FOR THE ROOM, through the same entry points
  // the menus use — so the edit gate, the change-log entry, and the telemetry
  // that go with each tool all still happen exactly once, in one place.
  const pressSessionButton = (element: ShapeElement) => {
    // It starts the timer / vote / poll for the room, so it is one of the
    // facilitator's (spec/149) rather than an ordinary press.
    if (editsBlocked || sessionToolsBlocked) return;
    const plan = sessionButtonPlan(element.session);
    if (!plan) return;
    if (plan.tool === 'timer') {
      // Mid-session the button is the timer's control, not a reset: someone
      // pressing it while five minutes are running means "hold on", and
      // silently restarting the countdown would be the one behaviour nobody
      // wants. Clearing a timer stays with the timer's own controls.
      if (!activeTimer) startTimer('countdown', plan.minutes * 60_000);
      else if (activeTimer.running) pauseTimer();
      else resumeTimer();
      return;
    }
    if (plan.tool === 'stopwatch') {
      // Same three-way control as the countdown: pressing mid-run means "hold
      // on", never a silent restart.
      if (!activeTimer) startTimer('stopwatch');
      else if (activeTimer.running) pauseTimer();
      else resumeTimer();
      return;
    }
    if (plan.tool === 'vote') {
      // A vote already open is the room's round: somebody pressing the
      // button again mid-vote means "we're voting", not "start over", and
      // starting over wiped every dot cast so far (spec/152). Ending it stays
      // with the vote's own controls.
      if (activeVote?.active) return;
      startVote(plan.dots);
      return;
    }
    // The button's OWN style and answers (spec/105). This used to hard-code
    // `style: 'text'`, which threw away every answer the author had written
    // and asked the room a free-text question instead.
    startPoll({ question: plan.question, style: plan.style, options: plan.options });
  };

  // --- Reveal zone (spec/106) -----------------------------------------------
  // Which covers THIS viewer has lifted. Session state, deliberately: it is
  // not a property of the diagram, it is a property of having looked. Lost on
  // reload, which is right for something whose job is to start closed.
  const [revealedIds, setRevealedIds] = useState<ReadonlySet<string>>(new Set());
  const toggleRevealForMe = (elementId: string) => {
    // While somebody is facilitating (spec/149) a cover is theirs to lift, and
    // they lift it for the room through the element's own `revealed` field
    // rather than peeking privately. The personal lift below is what a board
    // with no facilitator keeps.
    if (sessionToolsBlocked) return;
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (!next.delete(elementId)) next.add(elementId);
      return next;
    });
  };

  // --- Picker (spec/107) ----------------------------------------------------
  // What a roll can land on right now, plus the roll. Participants come from
  // LIVE presence at press time, with our own name folded in — presence lists
  // peers, and a picker that can't pick you is a picker that lies.
  const pickerFor = (element: ShapeElement) => {
    const candidates = pickerCandidates({
      source: element.pickerSource ?? 'participants',
      options: element.pickerOptions,
      // Ourselves first: presence lists the OTHERS, and a picker that can't
      // pick the person pressing it is a picker that lies.
      participants: [selfParticipant, ...livePresence],
    });
    return {
      candidates,
      // Whether OUR roll reaches the element (and so the room). The face needs
      // it to tell its own landing apart from one arriving from a peer, which
      // is what lets everyone watch the same spin (spec/107).
      shared: !editsBlocked && !sessionToolsBlocked,
      roll: () => {
        const picked = rollPicker(candidates);
        if (picked === null) return null;
        const result = picked.label;
        // A view-role visitor still gets their roll — it just stays on their
        // screen. Everyone else writes it, so the room lands on one answer.
        // Under a facilitator (spec/149) the same is true of anybody who is
        // not them: they may spin for themselves, but the room's answer is the
        // facilitator's to land.
        if (!editsBlocked && !sessionToolsBlocked) {
          // Not undoable (spec/152): the room's answer is a fact about the
          // session, and one person's Ctrl+Z must not re-roll it for all.
          tickTabs((ts) =>
            ts.map((tab) =>
              tab.id !== activeId
                ? tab
                : {
                    ...tab,
                    elements: tab.elements.map((el) =>
                      el.id === element.id ? { ...el, pickerResult: result } : el,
                    ),
                  },
            ),
          );
          track('Element', 'Changed', 'Picker');
        }
        return picked;
      },
    };
  };

  // Per-element session settings, edited from the element's own `…` menu
  // (spec/105) rather than three levels into the right-click menu. Patches the
  // one element; the selection-wide setter in usePortalSetters stays for the
  // context menu, which acts on whatever is selected.
  const setSessionConfigFor = (element: ShapeElement, config: SessionButtonConfig) => {
    // Its configuration IS the timer's length and the poll's question, so
    // changing it mid-session changes what the next press does to everybody
    // (spec/149). The owner who wants to edit it takes the baton back.
    if (sessionToolsBlocked) return;
    if (editsBlocked) return;
    commitTabs((ts) =>
      ts.map((tab) =>
        tab.id !== activeId
          ? tab
          : {
              ...tab,
              elements: tab.elements.map((el) =>
                el.id === element.id ? { ...el, session: config } : el,
              ),
            },
      ),
    );
    track('Element', 'Changed', 'SessionButton');
  };

  return {
    pressSessionButton,
    revealedIds,
    toggleRevealForMe,
    pickerFor,
    setSessionConfigFor,
  };
}
