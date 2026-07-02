// Per-tab live session tools (spec/39): the facilitator-run TIMER
// (countdown / stopwatch) and dot-VOTING handlers. State lives on the
// Tab (`timer`, `vote`) so it rides the normal tab sync + persistence +
// late-joiner replay; the realtime room already drops view-role
// mutations, so every handler here is naturally edit-role only.
//
// All mutations go through `commitTabs` (which does NOT push undo
// history) — a timer start or a vote dot shouldn't be undoable. The
// facilitator lifecycle actions emit a one-shot activity-log line via
// `emitTabMeta` with `undoable: false` (no history step was pushed,
// so the entry must stay out of the undo pairing); the high-frequency
// vote casts deliberately do NOT log.

import {
  timerDisplayMs,
  votesSpentBy,
  type Tab,
  type TabVote,
  type TimerMode,
} from '@livediagram/diagram';
import { track } from '@/lib/telemetry';

type TabSessionDeps = {
  editsBlocked: boolean;
  activeId: string;
  activeTab: Tab;
  // Tab mutator that does NOT push undo history (same one the appearance
  // setters use); we pair the facilitator actions with an explicit log emit.
  commitTabs: (mapTabs: (ts: Tab[]) => Tab[]) => void;
  emitTabMeta: (tabId: string, summary: string, opts?: { undoable?: boolean }) => void;
  // The local participant id — whose dots a cast/retract adds or removes.
  selfId: string;
};

export function useTabSession(deps: TabSessionDeps) {
  const { editsBlocked, activeId, commitTabs, emitTabMeta, selfId } = deps;

  const patchActive = (patch: (t: Tab) => Tab) =>
    commitTabs((ts) => ts.map((t) => (t.id === activeId ? patch(t) : t)));

  // --- Timer ---------------------------------------------------------------

  const startTimer = (mode: TimerMode, durationMs?: number) => {
    if (editsBlocked) return;
    const now = Date.now();
    const timer =
      mode === 'countdown'
        ? { mode, running: true, durationMs, anchorAt: now + (durationMs ?? 0) }
        : { mode, running: true, anchorAt: now };
    patchActive((t) => ({ ...t, timer }));
    emitTabMeta(
      activeId,
      mode === 'countdown' ? 'Started a countdown timer' : 'Started a stopwatch',
      { undoable: false },
    );
    track('Tab', 'Started', mode === 'countdown' ? 'CountdownTimer' : 'StopwatchTimer');
  };

  const pauseTimer = () => {
    if (editsBlocked) return;
    patchActive((t) => {
      if (!t.timer?.running) return t;
      const frozenMs = timerDisplayMs(t.timer, Date.now());
      return { ...t, timer: { ...t.timer, running: false, anchorAt: undefined, frozenMs } };
    });
  };

  const resumeTimer = () => {
    if (editsBlocked) return;
    const now = Date.now();
    patchActive((t) => {
      const timer = t.timer;
      if (!timer || timer.running) return t;
      // Re-anchor so the displayed value continues from where it paused:
      // countdown -> endsAt = now + remaining; stopwatch -> start = now - elapsed.
      const base = timer.frozenMs ?? (timer.mode === 'countdown' ? (timer.durationMs ?? 0) : 0);
      const anchorAt = timer.mode === 'countdown' ? now + base : now - base;
      return { ...t, timer: { ...timer, running: true, anchorAt, frozenMs: undefined } };
    });
  };

  const resetTimer = () => {
    if (editsBlocked) return;
    patchActive((t) => {
      const timer = t.timer;
      if (!timer) return t;
      return {
        ...t,
        timer:
          timer.mode === 'countdown'
            ? {
                mode: 'countdown',
                running: false,
                durationMs: timer.durationMs,
                frozenMs: timer.durationMs,
              }
            : { mode: 'stopwatch', running: false, frozenMs: 0 },
      };
    });
  };

  const clearTimer = () => {
    if (editsBlocked) return;
    patchActive((t) => {
      if (!t.timer) return t;
      const { timer: _drop, ...rest } = t;
      return rest;
    });
  };

  // --- Voting --------------------------------------------------------------

  const startVote = (votesPerPerson: number) => {
    if (editsBlocked) return;
    const vote: TabVote = { active: true, revealed: false, votesPerPerson, votes: {} };
    patchActive((t) => ({ ...t, vote }));
    emitTabMeta(
      activeId,
      `Started a vote (${votesPerPerson} ${votesPerPerson === 1 ? 'dot' : 'dots'} each)`,
      { undoable: false },
    );
    track('Tab', 'Started', 'Vote');
  };

  const endVote = () => {
    if (editsBlocked) return;
    patchActive((t) => (t.vote ? { ...t, vote: { ...t.vote, active: false } } : t));
    emitTabMeta(activeId, 'Ended the vote', { undoable: false });
    track('Tab', 'Ended', 'Vote');
  };

  const revealVote = () => {
    if (editsBlocked) return;
    patchActive((t) => (t.vote ? { ...t, vote: { ...t.vote, revealed: true } } : t));
    emitTabMeta(activeId, 'Revealed the vote results', { undoable: false });
    track('Tab', 'Revealed', 'Vote');
  };

  const clearVote = () => {
    if (editsBlocked) return;
    patchActive((t) => {
      if (!t.vote) return t;
      const { vote: _drop, ...rest } = t;
      return rest;
    });
  };

  // Add one of MY dots to an element, if a vote is open and I have budget
  // left. No history, no activity-log line (too frequent).
  const castVote = (elementId: string) => {
    if (editsBlocked) return;
    patchActive((t) => {
      const vote = t.vote;
      if (!vote || !vote.active) return t;
      if (votesSpentBy(vote, selfId) >= vote.votesPerPerson) return t;
      const existing = vote.votes[elementId] ?? [];
      return {
        ...t,
        vote: { ...vote, votes: { ...vote.votes, [elementId]: [...existing, selfId] } },
      };
    });
    track('Element', 'Voted');
  };

  // Remove ONE of my dots from an element (if any).
  const retractVote = (elementId: string) => {
    if (editsBlocked) return;
    patchActive((t) => {
      const vote = t.vote;
      if (!vote) return t;
      const existing = vote.votes[elementId];
      if (!existing || existing.length === 0) return t;
      const idx = existing.lastIndexOf(selfId);
      if (idx === -1) return t;
      const next = [...existing.slice(0, idx), ...existing.slice(idx + 1)];
      return { ...t, vote: { ...vote, votes: { ...vote.votes, [elementId]: next } } };
    });
  };

  return {
    startTimer,
    pauseTimer,
    resumeTimer,
    resetTimer,
    clearTimer,
    startVote,
    endVote,
    revealVote,
    clearVote,
    castVote,
    retractVote,
  };
}
