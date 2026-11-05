// The per-tab live session tool (docs/specs/012-collaboration/session-tools.md): a facilitator-run TIMER,
// synced to every participant. It lives as an optional `Tab` field (`timer`) so
// it rides the existing tab-content sync + persistence + late-joiner
// replay with no realtime/api changes, and the room already gates
// mutations to edit-role, so control is edit-role (viewers watch).
// Everything here is PURE (the caller passes `now`) so the countdown /
// stopwatch is unit-testable and the clients tick locally off an absolute
// anchor rather than over the wire. (The dot Vote that shared this module left
// livehuddle: docs/specs/002-project-scope/not-in-livehuddle.md "The Vote".)

// --- Timer -----------------------------------------------------------------

export type TimerMode = 'countdown' | 'stopwatch';

export type TabTimer = {
  mode: TimerMode;
  running: boolean;
  // Countdown: the configured length, so Reset returns to it.
  durationMs?: number;
  // Wall-clock anchor while running: for a countdown it's the instant the
  // timer hits zero (`endsAt`); for a stopwatch it's the instant the
  // current run began. null/undefined while paused.
  anchorAt?: number;
  // The frozen value captured at the last pause: remaining ms for a
  // countdown, elapsed ms for a stopwatch. Undefined before the first run.
  frozenMs?: number;
  // The instant this run was started (`startTimer`), carried unchanged through
  // pause, resume and extend, so a reader can tell it is still the same run.
  // Absent on a timer started before this existed.
  startedAt?: number;
};

// The ms a timer should DISPLAY at `now`: remaining for a countdown
// (floored at 0), elapsed for a stopwatch. Pure — pass Date.now() in.
export function timerDisplayMs(timer: TabTimer, now: number): number {
  if (timer.mode === 'countdown') {
    if (timer.running && timer.anchorAt !== undefined) return Math.max(0, timer.anchorAt - now);
    return Math.max(0, timer.frozenMs ?? timer.durationMs ?? 0);
  }
  // stopwatch: elapsed accumulates while running from the anchor.
  if (timer.running && timer.anchorAt !== undefined) return Math.max(0, now - timer.anchorAt);
  return Math.max(0, timer.frozenMs ?? 0);
}

// A countdown that has reached zero (only meaningful for countdown mode).
export function timerDone(timer: TabTimer, now: number): boolean {
  return timer.mode === 'countdown' && timerDisplayMs(timer, now) <= 0;
}

// m:ss readout for a timer's display ms — the one formatting rule the
// Session strip's Timer button (live ticking clock) and the Session tools
// section (static snapshot) share; each used to carry its own copy.
export function formatTimerClock(ms: number): string {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
