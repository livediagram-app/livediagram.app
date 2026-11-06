import { describe, expect, it } from 'vitest';
import { BUSY_CANVAS_ELEMENTS, canvasIsBusy } from './canvas-busy';

// docs/specs/008-canvas/canvas-performance.md "A Tab Style change on a busy Space eases the canvas, not its parts".
describe('canvasIsBusy', () => {
  it('is busy above 20 elements only', () => {
    expect(BUSY_CANVAS_ELEMENTS).toBe(20);
    expect(canvasIsBusy(0)).toBe(false);
    expect(canvasIsBusy(20)).toBe(false);
    expect(canvasIsBusy(21)).toBe(true);
    expect(canvasIsBusy(2000)).toBe(true);
  });
});
