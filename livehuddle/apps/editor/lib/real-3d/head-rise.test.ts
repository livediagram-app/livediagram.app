// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { HEAD_CHIP_CLEAR, headRisePx, writeHeadRise } from './head-rise';

// docs/specs/008-canvas/3d-engine.md "Chips over heads".
describe('headRisePx', () => {
  // A camera that maps world z straight to clip y over a 400 px view: 1 world unit up is 0.01 clip, 2 px on screen.
  const projection = new THREE.Matrix4().set(0.01, 0, 0, 0, 0, 0, 0.01, 0, 0, 0, 0, 0, 0, 0, 0, 1);

  it('is the head top over the feet on the screen, in the card px, plus the air', () => {
    expect(headRisePx(projection, { x: 0, y: 0 }, 0, 50, 400, 1)).toBeCloseTo(
      100 + HEAD_CHIP_CLEAR,
    );
    // The card at twice the size (the zoom, or nearer the camera): half the card px for the same screen gap.
    expect(headRisePx(projection, { x: 0, y: 0 }, 0, 50, 400, 2)).toBeCloseTo(50 + HEAD_CHIP_CLEAR);
  });

  it('grows with a taller head: a tall hairstyle lifts the chip', () => {
    const short = headRisePx(projection, { x: 0, y: 0 }, 0, 50, 400, 1)!;
    const tall = headRisePx(projection, { x: 0, y: 0 }, 0, 58, 400, 1)!;
    expect(tall - short).toBeCloseTo(16);
  });

  it('counts a raised floor (a pad) under the feet, as the chip stands on the floor', () => {
    expect(headRisePx(projection, { x: 0, y: 0 }, 10, 50, 400, 1)).toBeCloseTo(
      120 + HEAD_CHIP_CLEAR,
    );
  });

  it('answers nothing for a degenerate card', () => {
    expect(headRisePx(projection, { x: 0, y: 0 }, 0, 50, 400, 0)).toBeNull();
  });
});

describe('writeHeadRise', () => {
  it('writes to every box, only when it moves half a px, and clears it', () => {
    const a = document.createElement('div');
    const b = document.createElement('div');
    const last = { rise: null as number | null };
    writeHeadRise([a, b], 40, last);
    expect(a.style.getPropertyValue('--avatar-head-rise')).toBe('40.0px');
    expect(b.style.getPropertyValue('--avatar-head-rise')).toBe('40.0px');
    writeHeadRise([a, b], 40.3, last);
    expect(a.style.getPropertyValue('--avatar-head-rise')).toBe('40.0px');
    writeHeadRise([a, b], 41, last);
    expect(a.style.getPropertyValue('--avatar-head-rise')).toBe('41.0px');
    writeHeadRise([a, b], null, last);
    expect(a.style.getPropertyValue('--avatar-head-rise')).toBe('');
    expect(b.style.getPropertyValue('--avatar-head-rise')).toBe('');
  });
});
