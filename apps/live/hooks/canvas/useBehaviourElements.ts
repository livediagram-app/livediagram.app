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
  type ShapeElement,
  type Tab,
  type TimerMode,
} from '@livediagram/diagram';
import type { Participant } from '@/lib/identity';
import { pickerCandidates, rollPicker } from '@/lib/picker';
import { track } from '@/lib/telemetry';

export function useBehaviourElements({
  activeId,
  commitTabs,
  editsBlocked,
  selfParticipant,
  livePresence,
  activeTimer,
  startTimer,
  pauseTimer,
  resumeTimer,
  startVote,
  startPoll,
}: {
  activeId: string;
  commitTabs: (mapTabs: (ts: Tab[]) => Tab[]) => unknown;
  // True for a view-role visitor / a locked tab: they may take part in a
  // session tool but not start one (spec/39), and their picker roll is theirs
  // alone rather than a write everyone sees.
  editsBlocked: boolean;
  selfParticipant: Participant;
  livePresence: Participant[];
  // The tab's timer right now, so a timer button can act on it rather than
  // stomping it (spec/105): pressing while one is running PAUSES, pressing
  // while one is paused RESUMES. Only a tab with no timer starts a new one.
  activeTimer: { running: boolean } | undefined;
  startTimer: (mode: TimerMode, durationMs?: number) => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  startVote: (votesPerPerson: number) => void;
  startPoll: (draft: { question: string; style: 'text'; options: string[] }) => void;
}) {
  // --- Session button (spec/105) --------------------------------------------
  // Pressing one starts the tool FOR THE ROOM, through the same entry points
  // the menus use — so the edit gate, the change-log entry, and the telemetry
  // that go with each tool all still happen exactly once, in one place.
  const pressSessionButton = (element: ShapeElement) => {
    if (editsBlocked) return;
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
    if (plan.tool === 'vote') {
      startVote(plan.dots);
      return;
    }
    startPoll({ question: plan.question, style: 'text', options: plan.options });
  };

  // --- Reveal zone (spec/106) -----------------------------------------------
  // Which covers THIS viewer has lifted. Session state, deliberately: it is
  // not a property of the diagram, it is a property of having looked. Lost on
  // reload, which is right for something whose job is to start closed.
  const [revealedIds, setRevealedIds] = useState<ReadonlySet<string>>(new Set());
  const toggleRevealForMe = (elementId: string) => {
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
      roll: () => {
        const picked = rollPicker(candidates);
        if (picked === null) return null;
        const result = picked.label;
        // A view-role visitor still gets their roll — it just stays on their
        // screen. Everyone else writes it, so the room lands on one answer.
        if (!editsBlocked) {
          commitTabs((ts) =>
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

  return { pressSessionButton, revealedIds, toggleRevealForMe, pickerFor };
}
