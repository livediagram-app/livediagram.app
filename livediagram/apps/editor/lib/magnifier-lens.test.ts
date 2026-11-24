import { describe, expect, it } from 'vitest';
import { DEFAULT_MAGNIFIER_CONFIG } from './magnifier-config';
import { lensPlacement, TOUCH_LIFT_PX, wheelChange } from './magnifier-lens';

// docs/specs/008-canvas/blueprints/magnifier.md "Interfaces and contracts".
describe('lensPlacement', () => {
  it('centres the lens on a mouse pointer, the point under it at its centre', () => {
    const at = lensPlacement({ x: 400, y: 300, size: 200, zoom: 2, touch: false });
    expect(at).toEqual({ left: 300, top: 200, stageX: 100 - 800, stageY: 100 - 600 });
    // The canvas point under the pointer, scaled and moved by the stage, lands at the lens's centre.
    expect(400 * 2 + at.stageX).toBe(100);
    expect(300 * 2 + at.stageY).toBe(100);
  });

  it('lifts the lens above a finger, so the finger never covers it', () => {
    const at = lensPlacement({ x: 200, y: 500, size: 160, zoom: 3, touch: true });
    expect(at.left).toBe(120);
    expect(at.top).toBe(500 - 160 - TOUCH_LIFT_PX);
    // Still the fingertip's point at the centre of the lens.
    expect(200 * 3 + at.stageX).toBe(80);
    expect(500 * 3 + at.stageY).toBe(80);
  });

  it('drops it below the finger when there is no room above', () => {
    const at = lensPlacement({ x: 200, y: 60, size: 160, zoom: 2, touch: true });
    expect(at.top).toBe(60 + TOUCH_LIFT_PX);
  });
});

describe('wheelChange', () => {
  const config = DEFAULT_MAGNIFIER_CONFIG;

  it('enlarges more on a wheel up, less on a wheel down, within the range', () => {
    expect(wheelChange(config, { deltaX: 0, deltaY: -100, shiftKey: false }).zoom).toBeGreaterThan(
      2,
    );
    expect(wheelChange(config, { deltaX: 0, deltaY: 100, shiftKey: false }).zoom).toBeLessThan(2);
    expect(wheelChange(config, { deltaX: 0, deltaY: -100000, shiftKey: false }).zoom).toBe(6);
    expect(wheelChange(config, { deltaX: 0, deltaY: 100000, shiftKey: false }).zoom).toBe(1.5);
  });

  it('changes only the size with Shift, from either axis', () => {
    expect(wheelChange(config, { deltaX: 0, deltaY: -40, shiftKey: true })).toEqual({ size: 260 });
    // A Shift wheel some mice report sideways.
    expect(wheelChange(config, { deltaX: 40, deltaY: 0, shiftKey: true })).toEqual({ size: 220 });
    expect(wheelChange(config, { deltaX: 0, deltaY: 99999, shiftKey: true })).toEqual({
      size: 120,
    });
  });
});
