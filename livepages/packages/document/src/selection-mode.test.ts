import { describe, expect, it } from 'vitest';
import {
  buttonMode,
  DEFAULT_BUTTON_MODE,
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
} from './selection-mode';

describe('fixed-size shapes', () => {
  it('names the controls that never take resize handles', () => {
    // The Done check (docs/specs/012-collaboration/done-check.md) joined the two buttons (docs/specs/009-elements/mode-button.md): a roster
    // and a button laid out for their own content, so a bigger box only
    // spreads them over empty card.
    for (const kind of ['mode-button', 'session-button', 'done-check']) {
      expect(isFixedSizeShape(kind)).toBe(true);
    }
    expect(isFixedSizeShape('rectangle')).toBe(false);
    expect(isFixedSizeElement({ type: 'shape', shape: 'done-check' })).toBe(true);
    expect(isFixedSizeElement({ type: 'shape', shape: 'rectangle' })).toBe(false);
  });
});

describe('buttonMode', () => {
  it('reads the mode a button carries, and the default for none or one livepages lacks', () => {
    expect(buttonMode('spotlight')).toBe('spotlight');
    expect(buttonMode(undefined)).toBe(DEFAULT_BUTTON_MODE);
    // A button from livediagram can carry Avatar, which livepages does not have.
    expect(buttonMode('avatar')).toBe(DEFAULT_BUTTON_MODE);
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

  it('reads a tool it does not know as the default timer', () => {
    // A button from livediagram can name a tool livepages does not have (a poll); it presses to the timer.
    expect(sessionButtonPlan({ tool: 'poll' as never })).toEqual({
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
  it('drops a button for each tool that presses to that tool', () => {
    // The palette offers a tile per tool (docs/specs/012-collaboration/session-button.md).
    for (const tool of ['timer', 'stopwatch', 'vote'] as const) {
      expect(sessionButtonPlan(defaultSessionConfig(tool)).tool).toBe(tool);
    }
  });
});
