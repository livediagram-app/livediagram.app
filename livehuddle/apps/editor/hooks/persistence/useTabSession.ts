// Per-tab live session tools (docs/specs/012-collaboration/session-tools.md): the facilitator-run TIMER
// (countdown / stopwatch) handlers. State lives on the
// Tab (`timer`) so it rides the normal tab sync + persistence +
// late-joiner replay; the realtime room already drops view-role
// mutations, so every handler here is naturally edit-role only.
//
// All mutations go through `commitTabs` (which does NOT push undo
// history), so a timer start isn't undoable.

import { timerDisplayMs, type Tab, type TimerMode } from '@livehuddle/document';
import { track } from '@/lib/telemetry';

type TabSessionDeps = {
  editsBlocked: boolean;
  // Somebody else is facilitating (docs/specs/012-collaboration/facilitator.md), so the lifecycle verbs below are
  // theirs for now.
  sessionToolsBlocked: boolean;
  activeId: string;
  activeTab: Tab;
  // Tab mutator that does NOT push undo history (same one the appearance
  // setters use).
  commitTabs: (mapTabs: (ts: Tab[]) => Tab[]) => void;
};

export function useTabSession(deps: TabSessionDeps) {
  const { editsBlocked, activeId, commitTabs } = deps;
  // One flag for every verb that runs the room, so a new one cannot be added
  // without deciding which side of the line it is on.
  const runBlocked = deps.editsBlocked || deps.sessionToolsBlocked;

  const patchActive = (patch: (t: Tab) => Tab) =>
    commitTabs((ts) => ts.map((t) => (t.id === activeId ? patch(t) : t)));

  // --- Timer ---------------------------------------------------------------

  // Returns the run's `startedAt`, so a caller that started it (an Agenda
  // segment, docs/specs/012-collaboration/agenda.md) can recognise it later;
  // undefined when nothing started.
  const startTimer = (mode: TimerMode, durationMs?: number): number | undefined => {
    if (runBlocked) return undefined;
    const now = Date.now();
    const timer =
      mode === 'countdown'
        ? { mode, running: true, durationMs, anchorAt: now + (durationMs ?? 0), startedAt: now }
        : { mode, running: true, anchorAt: now, startedAt: now };
    patchActive((t) => ({ ...t, timer }));
    track('Tab', 'Started', mode === 'countdown' ? 'CountdownTimer' : 'StopwatchTimer');
    return now;
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

  return {
    startTimer,
    pauseTimer,
    resumeTimer,
    resetTimer,
    setTimerDuration,
    extendTimer,
    clearTimer,
  };
}
