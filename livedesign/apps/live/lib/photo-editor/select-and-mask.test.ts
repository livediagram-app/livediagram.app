import { describe, expect, it } from 'vitest';
import { createMask, maskAt, maskBounds, type PixelLayer } from '@livedesign/photo-engine';
import { harness, photoOf, solid } from './photo-test-utils';
import {
  MASK_REFINE_DEFAULTS,
  refineMask,
  scaleMask,
  SHIFT_EDGE_MAX_PX,
  withinZone,
} from './select-and-mask';
import { applySelectAndMask } from './selection-ops';

// docs/specs/031-photo/photo-tools.md "Smart selections" Refining: Select and Mask.
const square = () => createMask({ x: 20, y: 20, width: 20, height: 20 }, 255);

describe('the Select and Mask settings', () => {
  it('leave the selection as it is at their defaults', () => {
    const m = square();
    expect(refineMask(m, MASK_REFINE_DEFAULTS)).toBe(m);
  });

  it('shift the edge out and in, scaled for a small copy', () => {
    const out = refineMask(square(), { ...MASK_REFINE_DEFAULTS, shiftEdge: 0.5 });
    expect(maskBounds(out)!.width).toBe(20 + SHIFT_EDGE_MAX_PX);
    const inward = refineMask(square(), { ...MASK_REFINE_DEFAULTS, shiftEdge: -0.25 });
    expect(maskBounds(inward)!.width).toBe(20 - SHIFT_EDGE_MAX_PX / 2);
    const half = refineMask(square(), { ...MASK_REFINE_DEFAULTS, shiftEdge: 0.5 }, 0.5);
    expect(maskBounds(half)!.width).toBe(20 + SHIFT_EDGE_MAX_PX / 2);
  });

  it('feather, smooth and then harden the edge with Contrast', () => {
    const soft = refineMask(square(), { ...MASK_REFINE_DEFAULTS, feather: 4 });
    const edge = maskAt(soft, 20, 30);
    expect(edge).toBeGreaterThan(0);
    expect(edge).toBeLessThan(255);
    const hard = refineMask(square(), { ...MASK_REFINE_DEFAULTS, feather: 4, contrast: 0.9 });
    expect(Math.abs(maskAt(hard, 20, 30) - 128)).toBeGreaterThan(Math.abs(edge - 128));
    const smooth = refineMask(square(), { ...MASK_REFINE_DEFAULTS, smooth: 100 });
    expect(maskAt(smooth, 30, 30)).toBe(255);
  });

  it('scale a mask for the small copy and back', () => {
    const half = scaleMask(square(), 0.5);
    expect(half).toMatchObject({ x: 10, y: 10, width: 10, height: 10 });
    expect(scaleMask(half, 2)).toMatchObject({ x: 20, y: 20, width: 20, height: 20 });
  });

  it('take the refined mask only where the brush painted', () => {
    const m = createMask({ x: 0, y: 0, width: 4, height: 1 }, 0);
    const refined = createMask({ x: 0, y: 0, width: 4, height: 1 }, 255);
    const zone = createMask({ x: 2, y: 0, width: 2, height: 1 }, 255);
    expect([...withinZone(m, refined, zone).data]).toEqual([0, 0, 255, 255]);
    // Past the selection's own rect too.
    const wide = withinZone(
      m,
      createMask({ x: 0, y: 0, width: 6, height: 1 }, 255),
      createMask({ x: 4, y: 0, width: 2, height: 1 }, 255),
    );
    expect([...wide.data]).toEqual([0, 0, 0, 0, 255, 255]);
  });
});

describe('Select and Mask’s OK', () => {
  const twoTone = () => {
    const r = solid(40, 40, [240, 240, 240, 255]);
    for (let y = 0; y < 40; y++)
      for (let x = 0; x < 22; x++) r.data.set([20, 30, 160, 255], (y * 40 + x) * 4);
    return harness(photoOf(40, 40), { a: r });
  };

  it('keeps the worked selection, re-decided by colour where painted', async () => {
    const h = twoTone();
    expect(await applySelectAndMask(h.s, MASK_REFINE_DEFAULTS, null, 'selection')).toBe(
      'Make a selection first.',
    );
    // A selection that stops short of the colour edge at x 22.
    h.s.selection = createMask({ x: 0, y: 0, width: 18, height: 40 }, 255);
    const zone = createMask({ x: 14, y: 0, width: 12, height: 40 }, 255);
    expect(await applySelectAndMask(h.s, MASK_REFINE_DEFAULTS, zone, 'selection')).toBeNull();
    const sel = h.s.selection;
    expect(sel && maskAt(sel, 20, 20)).toBeGreaterThan(128);
    expect(sel && maskAt(sel, 30, 20)).toBeLessThan(128);
  });

  it('makes it the active layer’s mask with Output To: Layer Mask', async () => {
    const h = twoTone();
    h.s.choose('a', 'layer');
    h.s.selection = createMask({ x: 0, y: 0, width: 22, height: 40 }, 255);
    expect(await applySelectAndMask(h.s, MASK_REFINE_DEFAULTS, null, 'mask')).toBeNull();
    await h.s.settled();
    expect((h.s.layer('a') as PixelLayer).mask).toBeDefined();
    expect(h.s.selection).toBeNull();
  });
});
