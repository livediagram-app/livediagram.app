import { describe, expect, it } from 'vitest';
import { isFixedSizeShape } from './selection-mode';
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
    // A Long Table resizes to take more chairs (office.md "Long Table"); the Meeting Table keeps its size.
    expect(isFixedSizeElement({ type: 'shape', shape: 'meeting-table' })).toBe(true);
    expect(isFixedSizeElement({ type: 'shape', shape: 'meeting-table', variant: 'long' })).toBe(false);
    expect(isFixedSizeElement({ type: 'text' })).toBe(false);
  });

  // A retired Session button or Done check (docs/specs/002-project-scope/not-in-livehuddle.md) is a placeholder,
  // resized like any element.
  it('leaves a retired control resizable', () => {
    expect(isFixedSizeShape('session-button')).toBe(false);
    expect(isFixedSizeShape('done-check')).toBe(false);
  });
});
