import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SESSION_TOOL,
  DEFAULT_TIMER_MINUTES,
  DEFAULT_VOTE_DOTS,
  defaultSessionConfig,
  isPickerSource,
  isSessionTool,
  sessionButtonPlan,
  TIMER_MINUTES_RANGE,
  VOTE_DOTS_RANGE,
  isFixedSizeShape,
  isFixedSizeElement,
} from './behaviour-config';

describe('fixed-size shapes', () => {
  it('names the controls that never take resize handles', () => {
    for (const kind of ['session-button', 'badge']) {
      expect(isFixedSizeShape(kind)).toBe(true);
    }
    expect(isFixedSizeShape('rectangle')).toBe(false);
    expect(isFixedSizeElement({ type: 'shape', shape: 'session-button' })).toBe(true);
    expect(isFixedSizeElement({ type: 'shape', shape: 'rectangle' })).toBe(false);
  });
});

describe('isSessionTool / isPickerSource', () => {
  it('accepts the known tokens and nothing else', () => {
    expect(isSessionTool('timer')).toBe(true);
    expect(isSessionTool('vote')).toBe(true);
    expect(isSessionTool('stopwatch')).toBe(true);
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
});

describe('defaultSessionConfig', () => {
  it('places a button that starts its tool as it is', () => {
    expect(defaultSessionConfig('timer')).toEqual({ tool: 'timer', minutes: DEFAULT_TIMER_MINUTES });
    expect(defaultSessionConfig('stopwatch')).toEqual({ tool: 'stopwatch' });
    expect(defaultSessionConfig('vote')).toEqual({ tool: 'vote', dots: DEFAULT_VOTE_DOTS });
  });
});
