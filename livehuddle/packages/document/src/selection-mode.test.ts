import { describe, expect, it } from 'vitest';
import { SESSION_TOOLS, TIMER_MINUTES_RANGE, isFixedSizeShape } from './selection-mode';
import { isFixedSizeElement } from './placed-kinds';

describe('fixed-size shapes', () => {
  it('names the controls that never take resize handles', () => {
    for (const kind of ['mode-button', 'badge']) {
      expect(isFixedSizeShape(kind)).toBe(true);
    }
    expect(isFixedSizeShape('rectangle')).toBe(false);
    expect(isFixedSizeElement({ type: 'shape', shape: 'mode-button' })).toBe(true);
    expect(isFixedSizeElement({ type: 'shape', shape: 'rectangle' })).toBe(false);
    expect(isFixedSizeElement({ type: 'shape', shape: 'square', fixedSize: true })).toBe(true);
    // Placed pieces keep their own size (docs/specs/010-palette/palette-drag-ghost.md); sized ones resize.
    for (const shape of ['chair', 'bar-stool', 'avatar-pad', 'door', 'plant'])
      expect(isFixedSizeElement({ type: 'shape', shape })).toBe(true);
    for (const shape of ['room', 'stage', 'rug', 'grass'])
      expect(isFixedSizeElement({ type: 'shape', shape })).toBe(false);
  });

  // A retired Session button or Done check (docs/specs/002-project-scope/not-in-livehuddle.md) is a placeholder,
  // resized like any element.
  it('leaves a retired control resizable', () => {
    expect(isFixedSizeShape('session-button')).toBe(false);
    expect(isFixedSizeShape('done-check')).toBe(false);
  });
});

describe('the Session strip tools (docs/specs/012-collaboration/session-tools.md)', () => {
  it('are the timer and its stopwatch: no poll, no vote', () => {
    expect(SESSION_TOOLS).toEqual(['timer', 'stopwatch']);
  });

  it('bound a countdown to a sensible range', () => {
    expect(TIMER_MINUTES_RANGE.min).toBeLessThan(TIMER_MINUTES_RANGE.max);
  });
});
