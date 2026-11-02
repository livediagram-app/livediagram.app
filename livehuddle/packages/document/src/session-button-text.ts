// What a Session button says when its author wrote no label (docs/specs/012-collaboration/session-button.md): derived
// from its setting, so the canvas and an image read as instructions ("Start vote · 3 dots each"). Shared by the
// editor's face and the headless render. Pure.
import type { PollStyle } from './poll-style';
import type { SessionPlan } from './selection-mode';

export function sessionButtonText(
  plan: SessionPlan | null,
  // What the tab's timer is doing, so a timer button reads as the control it
  // is mid-session ("Pause timer") rather than always promising a fresh start.
  timerState: TimerState = 'none',
): { kicker: string; action: string } {
  if (!plan) return { kicker: 'Poll', action: 'Not set up' };
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
  if (plan.tool === 'vote') {
    return {
      kicker: 'Start vote',
      action: `${plan.dots} ${plan.dots === 1 ? 'dot' : 'dots'} each`,
    };
  }
  return { kicker: `Ask · ${pollAnswers(plan.style, plan.options.length)}`, action: plan.question };
}

// What a poll's answers are, so a button shows the shape of what it asks rather than the question alone; short
// enough that "Ask · " and it fit the 104px button's kicker line.
function pollAnswers(style: PollStyle, options: number): string {
  switch (style) {
    case 'yesNo':
    case 'yesNoAbstain':
      return 'yes / no';
    case 'choice':
      return `${options} ${options === 1 ? 'option' : 'options'}`;
    case 'collaborators':
      return 'a person';
    case 'rating':
      return 'rating';
    case 'text':
      return 'open';
  }
}

// A tab's timer is either absent, counting, or held.
export type TimerState = 'none' | 'running' | 'paused';
