// Per-tab live session tools (docs/specs/012-collaboration/session-tools.md): the facilitator-run TIMER
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
  applyVoteDelta,
  canCastVote,
  isVoteHost,
  timerDisplayMs,
  type Tab,
  type TabVote,
  type TimerMode,
  type VoteSetup,
} from '@livediagram/diagram';
import { track } from '@/lib/telemetry';

type TabSessionDeps = {
  editsBlocked: boolean;
  // Somebody else is facilitating (docs/specs/012-collaboration/facilitator.md), so the lifecycle verbs below are
  // theirs for now. Casting and retracting a dot stay open: answering is what
  // the room is for, and a vote only the facilitator can vote in is not a vote.
  sessionToolsBlocked: boolean;
  activeId: string;
  activeTab: Tab;
  // Tab mutator that does NOT push undo history (same one the appearance
  // setters use); we pair the facilitator actions with an explicit log emit.
  commitTabs: (mapTabs: (ts: Tab[]) => Tab[]) => void;
  emitTabMeta: (tabId: string, summary: string, opts?: { undoable?: boolean }) => void;
  // The local participant id — whose dots a cast/retract adds or removes.
  selfId: string;
  // Broadcast ONE dot the instant it is cast or taken back (docs/specs/012-collaboration/session-tools.md).
  //
  // Not left to the autosave like every other tab change: dots are the one
  // field the whole room writes at once, and the debounced whole-object patch
  // that used to carry them let a peer's stale snapshot erase a dot somebody
  // had just placed. This sends the CHANGE, immediately, so concurrent dots
  // commute instead of racing. No-op before the room is open.
  // `round` is the open vote's (docs/specs/012-collaboration/collab-race-hardening.md), so peers drop a dot meant for
  // another round.
  emitVote: (tabId: string, elementId: string, delta: 1 | -1, round?: string) => void;
};

export function useTabSession(deps: TabSessionDeps) {
  const { editsBlocked, activeId, commitTabs, emitTabMeta, selfId, emitVote } = deps;
  // One flag for every verb that runs the room, so a new one cannot be added
  // without deciding which side of the line it is on.
  const runBlocked = deps.editsBlocked || deps.sessionToolsBlocked;

  const patchActive = (patch: (t: Tab) => Tab) =>
    commitTabs((ts) => ts.map((t) => (t.id === activeId ? patch(t) : t)));

  // --- Timer ---------------------------------------------------------------

  const startTimer = (mode: TimerMode, durationMs?: number) => {
    if (runBlocked) return;
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

  // Timer telemetry (docs/specs/017-telemetry/telemetry.md) covers the whole lifecycle, not just the
  // start: how many timers get paused, reset, or abandoned versus run to
  // the end is the thing that says whether the feature actually works in a
  // session. Each is gated on the state actually changing, so a press that
  // does nothing (pausing an already-paused timer) counts nothing.
  const pauseTimer = () => {
    if (runBlocked) return;
    if (!deps.activeTab.timer?.running) return;
    patchActive((t) => {
      if (!t.timer?.running) return t;
      const frozenMs = timerDisplayMs(t.timer, Date.now());
      return { ...t, timer: { ...t.timer, running: false, anchorAt: undefined, frozenMs } };
    });
    track('Tab', 'Toggled', 'TimerPaused');
  };

  const resumeTimer = () => {
    if (runBlocked) return;
    const current = deps.activeTab.timer;
    if (!current || current.running) return;
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
    track('Tab', 'Toggled', 'TimerResumed');
  };

  // Change a countdown's LENGTH, restarting it at the new one (docs/specs/012-collaboration/session-button.md).
  //
  // Called from the Timer element's `…` menu. Changing the length of a timer
  // that is mid-run and leaving it mid-run would be the one thing nobody
  // wants: the remaining time would be a number from the old length shown
  // against the new one. So it goes back to the top.
  //
  // The RUNNING state is preserved. A facilitator who extends a running timer
  // is asking for more time, not for the session to stop; one who extends a
  // paused timer is setting up the next round.
  const setTimerDuration = (durationMs: number) => {
    if (runBlocked) return;
    const existing = deps.activeTab.timer;
    // Nothing running: the element's own config is the length, and it will be
    // used at the next start. Nothing to do here.
    if (!existing || existing.mode !== 'countdown') return;
    const now = Date.now();
    patchActive((t) => ({
      ...t,
      timer: existing.running
        ? { mode: 'countdown', running: true, durationMs, anchorAt: now + durationMs }
        : { mode: 'countdown', running: false, durationMs, frozenMs: durationMs },
    }));
  };

  const resetTimer = () => {
    if (runBlocked) return;
    if (!deps.activeTab.timer) return;
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
    track('Tab', 'Changed', 'TimerReset');
  };

  // Give a running countdown more time without restarting it (docs/specs/012-collaboration/session-tools.md):
  // "another minute, everyone". Both the end instant and the length grow by
  // the same amount, so the dial's wedge and the progress track stay a true
  // fraction of the whole instead of jumping back to full. A paused
  // countdown grows its frozen remainder the same way. A stopwatch has no
  // length to extend, so it is left alone.
  const extendTimer = (deltaMs: number) => {
    if (editsBlocked) return;
    const current = deps.activeTab.timer;
    if (!current || current.mode !== 'countdown' || deltaMs <= 0) return;
    patchActive((t) => {
      const timer = t.timer;
      if (!timer || timer.mode !== 'countdown') return t;
      const now = Date.now();
      // A countdown already at zero restarts from now rather than from an end
      // instant in the past, which would add time the room never sees.
      const remaining = timerDisplayMs(timer, now);
      const durationMs = (timer.durationMs ?? remaining) + deltaMs;
      return {
        ...t,
        timer: timer.running
          ? { ...timer, durationMs, anchorAt: now + remaining + deltaMs }
          : { ...timer, durationMs, frozenMs: remaining + deltaMs },
      };
    });
    track('Tab', 'Changed', 'TimerExtended');
  };

  const clearTimer = () => {
    if (runBlocked) return;
    // Read the mode BEFORE the patch drops it — this is the counterpart to
    // the typed Started event, so the two are directly comparable.
    const mode = deps.activeTab.timer?.mode;
    if (!mode) return;
    patchActive((t) => {
      if (!t.timer) return t;
      const { timer: _drop, ...rest } = t;
      return rest;
    });
    track('Tab', 'Ended', mode === 'countdown' ? 'CountdownTimer' : 'StopwatchTimer');
  };

  // --- Voting --------------------------------------------------------------

  // Privacy is decided HERE, at start, and baked into the vote — docs/specs/012-collaboration/session-tools.md
  // has no mid-vote toggle, so a participant can trust that what was
  // hidden stayed hidden for the whole vote.
  const startVote = (votesPerPerson: number, setup?: VoteSetup) => {
    if (runBlocked) return;
    const vote: TabVote = {
      active: true,
      revealed: false,
      votesPerPerson,
      votes: {},
      hideCursors: setup?.hideCursors === true,
      hideCounts: setup?.hideCounts === true,
      // Layer scope (docs/specs/012-collaboration/vote-layer-scope.md). Undefined = every layer, which is what a
      // single-layer tab always gets since the picker never shows there.
      voteLayerId: setup?.layerId,
      // Absent rather than false when off, so an ordinary vote's wire shape
      // is unchanged.
      ...(setup?.onePerElement ? { onePerElement: true } : {}),
      // A vote is one person's to run (docs/specs/012-collaboration/session-tools.md): the starter is the only
      // one who can end / reveal / clear it or move the results focus.
      startedBy: selfId,
      // A fresh round (docs/specs/012-collaboration/collab-race-hardening.md): dots in flight from any earlier vote on this
      // tab name a different round, so no peer can count them against this one.
      round: crypto.randomUUID(),
    };
    patchActive((t) => ({ ...t, vote }));
    const layerName = vote.voteLayerId
      ? (deps.activeTab.layers ?? []).find((l) => l.id === vote.voteLayerId)?.name
      : undefined;
    const privacyNote = [
      layerName ? `on ${layerName}` : null,
      vote.onePerElement ? 'one dot per item' : null,
      vote.hideCursors ? 'cursors hidden' : null,
      vote.hideCounts ? 'counts hidden' : null,
    ].filter(Boolean);
    emitTabMeta(
      activeId,
      `Started a vote (${votesPerPerson} ${votesPerPerson === 1 ? 'dot' : 'dots'} each${
        privacyNote.length > 0 ? `, ${privacyNote.join(', ')}` : ''
      })`,
      { undoable: false },
    );
    track('Tab', 'Started', 'Vote');
    // A second, separate line for the privacy modes so the vote-start series
    // stays comparable across the change (docs/specs/017-telemetry/telemetry.md): cursors default ON, so
    // folding it into the 'Vote' type would have hollowed out that series.
    if (vote.hideCursors || vote.hideCounts) track('Tab', 'Started', 'PrivateVote');
  };

  const endVote = () => {
    if (runBlocked) return;
    // Host-only (docs/specs/012-collaboration/session-tools.md). Ending is destructive-ish — you can restart a
    // vote but every dot is lost — so a participant can't do it by
    // accident. Re-checked here as well as hidden in the UI, since the
    // handler is reachable from more than one surface.
    if (!isVoteHost(deps.activeTab.vote, selfId)) return;
    patchActive((t) => (t.vote ? { ...t, vote: { ...t.vote, active: false } } : t));
    emitTabMeta(activeId, 'Ended the vote', { undoable: false });
    track('Tab', 'Ended', 'Vote');
  };

  const revealVote = () => {
    if (runBlocked) return;
    if (!isVoteHost(deps.activeTab.vote, selfId)) return;
    // Revealing also seats the shared walkthrough on the top pick, so
    // every participant lands on the same element as the host.
    patchActive((t) =>
      t.vote ? { ...t, vote: { ...t.vote, revealed: true, reviewIndex: 0 } } : t,
    );
    emitTabMeta(activeId, 'Revealed the vote results', { undoable: false });
    track('Tab', 'Revealed', 'Vote');
  };

  const clearVote = () => {
    if (runBlocked) return;
    if (!isVoteHost(deps.activeTab.vote, selfId)) return;
    if (!deps.activeTab.vote) return;
    patchActive((t) => {
      if (!t.vote) return t;
      const { vote: _drop, ...rest } = t;
      return rest;
    });
    // Distinct from Ended: ending closes casting and keeps the tallies,
    // clearing discards the round entirely. Conflating them would hide how
    // often a vote gets thrown away and restarted.
    track('Tab', 'Cleared', 'Vote');
  };

  // Add one of MY dots to an element, if a vote is open and I have budget
  // left. No history, no activity-log line (too frequent).
  //
  // Whether a dot lands is decided OUTSIDE the state updater, from the
  // rendered tab: a press with the budget spent (or a second dot on a
  // one-per-item vote) casts nothing and must not count as Element·Voted
  // (docs/specs/017-telemetry/telemetry.md), and a flag set inside an updater is unreliable (React may run
  // it later, or twice). The updater keeps its own guard so the write can
  // never exceed the budget either way.
  const castVote = (elementId: string) => {
    if (editsBlocked) return;
    const current = deps.activeTab.vote;
    if (!current || !canCastVote(current, selfId, elementId)) return;
    patchActive((t) => {
      const vote = t.vote;
      if (!vote || !canCastVote(vote, selfId, elementId)) return t;
      return { ...t, vote: applyVoteDelta(vote, elementId, selfId, 1) };
    });
    // Straight out, ahead of the 600ms autosave: the point of the op is that a
    // dot stops waiting behind a debounce it can lose a race inside.
    emitVote(activeId, elementId, 1, current.round);
    track('Element', 'Voted');
  };

  // Move the shared results walkthrough to a rank. Host-only: the room
  // reviews the picks together, so participants follow rather than each
  // wandering the list on their own screen (docs/specs/012-collaboration/session-tools.md).
  const setVoteReviewIndex = (index: number) => {
    if (runBlocked) return;
    if (!isVoteHost(deps.activeTab.vote, selfId)) return;
    patchActive((t) => (t.vote ? { ...t, vote: { ...t.vote, reviewIndex: index } } : t));
  };

  // Remove ONE of my dots from an element (if any). Decided from the rendered
  // tab for the same reason as castVote.
  const retractVote = (elementId: string) => {
    if (editsBlocked) return;
    const mine = deps.activeTab.vote?.votes[elementId] ?? [];
    if (!mine.includes(selfId)) return;
    patchActive((t) =>
      t.vote ? { ...t, vote: applyVoteDelta(t.vote, elementId, selfId, -1) } : t,
    );
    emitVote(activeId, elementId, -1, deps.activeTab.vote?.round);
    // The counterpart to Element·Voted, so "dots cast" can be read net of
    // second thoughts. Only when a dot actually came off.
    track('Element', 'Removed', 'Vote');
  };

  return {
    startTimer,
    pauseTimer,
    resumeTimer,
    resetTimer,
    setTimerDuration,
    extendTimer,
    clearTimer,
    startVote,
    endVote,
    revealVote,
    clearVote,
    setVoteReviewIndex,
    castVote,
    retractVote,
  };
}
