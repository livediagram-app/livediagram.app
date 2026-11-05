import { describe, expect, it } from 'vitest';
import {
  SESSION_TOOLS,
  TIMER_MINUTES_RANGE,
  VOTE_DOTS_RANGE,
  isFixedSizeShape,
  isFixedSizeElement,
} from './selection-mode';

describe('fixed-size shapes', () => {
  it('names the controls that never take resize handles', () => {
    for (const kind of ['mode-button', 'badge']) {
      expect(isFixedSizeShape(kind)).toBe(true);
    }
    expect(isFixedSizeShape('rectangle')).toBe(false);
    expect(isFixedSizeElement({ type: 'shape', shape: 'mode-button' })).toBe(true);
    expect(isFixedSizeElement({ type: 'shape', shape: 'rectangle' })).toBe(false);
    expect(isFixedSizeElement({ type: 'shape', shape: 'square', fixedSize: true })).toBe(true);
  });

  // A retired Session button or Done check (docs/specs/002-project-scope/not-in-livehuddle.md) is a placeholder,
  // resized like any element.
  it('leaves a retired control resizable', () => {
    expect(isFixedSizeShape('session-button')).toBe(false);
    expect(isFixedSizeShape('done-check')).toBe(false);
  });
});

describe('the Session strip tools (docs/specs/012-collaboration/session-tools.md)', () => {
  it('are the timer, its stopwatch, and the vote: no poll', () => {
    expect(SESSION_TOOLS).toEqual(['timer', 'stopwatch', 'vote']);
  });

  it('bound a countdown and a vote to sensible ranges', () => {
    expect(TIMER_MINUTES_RANGE.min).toBeLessThan(TIMER_MINUTES_RANGE.max);
    expect(VOTE_DOTS_RANGE.min).toBeGreaterThan(0);
  });
});
