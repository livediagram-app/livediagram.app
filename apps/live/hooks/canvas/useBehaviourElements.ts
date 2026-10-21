// The runtime behaviour of the interactive Behaviour elements that act on the SESSION rather than on the
// document: the Session button (docs/specs/012-collaboration/session-button.md) and the Picker's roll
// (docs/specs/012-collaboration/picker.md).
//
// They live together because they share a shape — a press resolves what to do
// from the element, then calls something that already exists (the session-tool
// entry points, the presence list, the element commit) — and because neither
// belongs to the style hooks.

import {
  sessionButtonPlan,
  type SessionButtonConfig,
  type ShapeElement,
  type Tab,
  type TabVote,
  type TimerMode,
} from '@liveplanner/document';
import type { Participant } from '@/lib/identity';
import { pickerCandidates, rollPicker } from '@/lib/picker';
import { track } from '@/lib/telemetry';

export function useBehaviourElements({
  activeId,
  commitTabs,
  tickTabs,
  editsBlocked,
  selfParticipant,
  livePresence,
  activeTimer,
  activeVote,
  startTimer,
  pauseTimer,
  resumeTimer,
  startVote,
}: {
  activeId: string;
  commitTabs: (mapTabs: (ts: Tab[]) => Tab[]) => unknown;
  // The picker's roll: a session event, not an edit, so not undoable.
  tickTabs: (mapTabs: (ts: Tab[]) => Tab[]) => void;
  // True for a view-role visitor / a locked tab: they may take part in a
  // session tool but not start one (docs/specs/012-collaboration/session-tools.md), and their picker roll is theirs
  // alone rather than a write everyone sees.
  editsBlocked: boolean;
  selfParticipant: Participant;
  livePresence: Participant[];
  // The tab's timer right now, so a timer button can act on it rather than
  // stomping it (docs/specs/012-collaboration/session-button.md): pressing while one is running PAUSES, pressing
  // while one is paused RESUMES. Only a tab with no timer starts a new one.
  activeTimer: { running: boolean } | undefined;
  // The running vote, if any: a vote button pressed mid-vote must not start a
  // fresh one over it, which reset every dot on the canvas (docs/specs/012-collaboration/collab-race-hardening.md).
  activeVote: TabVote | undefined;
  startTimer: (mode: TimerMode, durationMs?: number) => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  startVote: (votesPerPerson: number) => void;
}) {
  // --- Session button (docs/specs/012-collaboration/session-button.md) --------------------------------------------
  // Pressing one starts the tool FOR THE ROOM, through the same entry points
  // the menus use — so the edit gate and the telemetry
  // that go with each tool all still happen exactly once, in one place.
  const pressSessionButton = (element: ShapeElement) => {
    if (editsBlocked) return;
    const plan = sessionButtonPlan(element.session);
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
    // A vote already open is the room's round: somebody pressing the
    // button again mid-vote means "we're voting", not "start over", and
    // starting over wiped every dot cast so far (docs/specs/012-collaboration/collab-race-hardening.md). Ending it stays
    // with the vote's own controls.
    if (!activeVote?.active) startVote(plan.dots);
  };

  // --- Picker (docs/specs/012-collaboration/picker.md) ----------------------------------------------------
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
      // is what lets everyone watch the same spin (docs/specs/012-collaboration/picker.md).
      shared: !editsBlocked,
      roll: () => {
        const picked = rollPicker(candidates);
        if (picked === null) return null;
        const result = picked.label;
        // A view-role visitor still gets their roll — it just stays on their
        // screen. Everyone else writes it, so the room lands on one answer.
        if (!editsBlocked) {
          // Not undoable (docs/specs/012-collaboration/collab-race-hardening.md): the room's answer is a fact about the
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
  // (docs/specs/012-collaboration/session-button.md) rather than three levels into the right-click menu. Patches the
  // one element; the selection-wide setter in usePortalSetters stays for the
  // context menu, which acts on whatever is selected.
  const setSessionConfigFor = (element: ShapeElement, config: SessionButtonConfig) => {
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
    pickerFor,
    setSessionConfigFor,
  };
}
