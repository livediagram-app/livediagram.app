import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SESSION_TOOL,
  DEFAULT_TIMER_MINUTES,
  DEFAULT_VOTE_DOTS,
  isPickerSource,
  isSessionTool,
  sessionButtonPlan,
  SESSION_POLL_MAX_OPTIONS,
  TIMER_MINUTES_RANGE,
  VOTE_DOTS_RANGE,
} from './selection-mode';

describe('isSessionTool / isPickerSource', () => {
  it('accepts the known tokens and nothing else', () => {
    expect(isSessionTool('timer')).toBe(true);
    expect(isSessionTool('vote')).toBe(true);
    expect(isSessionTool('poll')).toBe(true);
    expect(isSessionTool('launch-missiles')).toBe(false);
    expect(isSessionTool(undefined)).toBe(false);
    expect(isPickerSource('participants')).toBe(true);
    expect(isPickerSource('options')).toBe(true);
    expect(isPickerSource('everyone')).toBe(false);
  });
});

describe('sessionButtonPlan', () => {
  it('falls back to a default timer for a button with no configuration', () => {
    // An older client, an API write, or a half-built button still presses to
    // something sensible rather than doing nothing.
    expect(sessionButtonPlan(undefined)).toEqual({
      tool: DEFAULT_SESSION_TOOL,
      minutes: DEFAULT_TIMER_MINUTES,
    });
  });

  it('clamps a duration instead of rejecting the element', () => {
    expect(sessionButtonPlan({ tool: 'timer', minutes: 0 })).toEqual({
      tool: 'timer',
      minutes: TIMER_MINUTES_RANGE.min,
    });
    expect(sessionButtonPlan({ tool: 'timer', minutes: 10_000 })).toEqual({
      tool: 'timer',
      minutes: TIMER_MINUTES_RANGE.max,
    });
    // Not a number at all (a string from an import, say) takes the default.
    expect(sessionButtonPlan({ tool: 'timer', minutes: Number.NaN })).toEqual({
      tool: 'timer',
      minutes: DEFAULT_TIMER_MINUTES,
    });
  });

  it('rounds and clamps the dot count the same way', () => {
    expect(sessionButtonPlan({ tool: 'vote', dots: 2.6 })).toEqual({ tool: 'vote', dots: 3 });
    expect(sessionButtonPlan({ tool: 'vote', dots: 99 })).toEqual({
      tool: 'vote',
      dots: VOTE_DOTS_RANGE.max,
    });
    expect(sessionButtonPlan({ tool: 'vote' })).toEqual({ tool: 'vote', dots: DEFAULT_VOTE_DOTS });
  });

  it('builds a poll from the written question and answers', () => {
    expect(
      sessionButtonPlan({ tool: 'poll', question: '  Ship it?  ', options: [' Yes', 'No '] }),
    ).toEqual({ tool: 'poll', question: 'Ship it?', options: ['Yes', 'No'] });
  });

  it('refuses a poll that cannot be answered', () => {
    // Fewer than two real answers is a half-written button: the face goes
    // inert and says why, rather than opening a poll nobody can respond to.
    expect(sessionButtonPlan({ tool: 'poll', options: ['Only one'] })).toBeNull();
    expect(sessionButtonPlan({ tool: 'poll', options: ['  ', ''] })).toBeNull();
    expect(sessionButtonPlan({ tool: 'poll' })).toBeNull();
  });

  it('caps the answers and names an unnamed poll', () => {
    const plan = sessionButtonPlan({
      tool: 'poll',
      options: Array.from({ length: 20 }, (_, i) => `Option ${i}`),
    });
    expect(plan?.tool).toBe('poll');
    expect(plan && 'options' in plan && plan.options).toHaveLength(SESSION_POLL_MAX_OPTIONS);
    expect(plan && 'question' in plan && plan.question).toBe('Quick question');
  });
});
