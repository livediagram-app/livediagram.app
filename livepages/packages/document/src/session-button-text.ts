// What a Session button says when its author wrote no label (docs/specs/012-collaboration/session-button.md): derived
// from its setting, so the canvas and an image read as instructions ("Start vote · 3 dots each"). Shared by the
// editor's face and the headless render. Pure.
import type { SessionPlan } from './selection-mode';

export function sessionButtonText(
  plan: SessionPlan,
  // What the tab's timer is doing, so a timer button reads as the control it
  // is mid-session ("Pause timer") rather than always promising a fresh start.
  timerState: TimerState = 'none',
): { kicker: string; action: string } {
  if (plan.tool === 'timer') {
    if (timerState === 'running') return { kicker: 'Pause', action: 'the timer' };
    if (timerState === 'paused') return { kicker: 'Continue', action: 'the timer' };
    return { kicker: 'Start', action: `${plan.minutes} min timer` };
  }
  if (plan.tool === 'stopwatch') {
    if (timerState === 'running') return { kicker: 'Pause', action: 'the stopwatch' };
    if (timerState === 'paused') return { kicker: 'Continue', action: 'the stopwatch' };
    return { kicker: 'Start', action: 'a stopwatch' };
  }
  return {
    kicker: 'Start vote',
    action: `${plan.dots} ${plan.dots === 1 ? 'dot' : 'dots'} each`,
  };
}

// A tab's timer is either absent, counting, or held.
export type TimerState = 'none' | 'running' | 'paused';
