import { describe, expect, it } from 'vitest';
import { MOTION_CEILING_MS } from '@liveworkspace/style-guards/motion';
import {
  arriveDelayMs,
  contentShift,
  morphFrames,
  STRIP_IN_MAX_STEPS,
  STRIP_IN_MS,
  STRIP_MORPH_MS,
  STRIP_OUT_MS,
} from './strip-morph';

// docs/specs/007-editor/toolbar-layout.md "Switching morphs the strip".

describe('strip morph timing', () => {
  it('settles within the chrome ceiling, the last arriving item included', () => {
    expect(STRIP_MORPH_MS).toBeLessThanOrEqual(MOTION_CEILING_MS);
    expect(STRIP_OUT_MS).toBeLessThanOrEqual(STRIP_MORPH_MS);
    expect(arriveDelayMs(1000) + STRIP_IN_MS).toBeLessThanOrEqual(STRIP_MORPH_MS);
  });

  it('cascades the incoming items a step apart, then holds', () => {
    expect(arriveDelayMs(0)).toBe(50);
    expect(arriveDelayMs(1)).toBe(60);
    expect(arriveDelayMs(-3)).toBe(50);
    expect(arriveDelayMs(STRIP_IN_MAX_STEPS + 5)).toBe(arriveDelayMs(STRIP_IN_MAX_STEPS));
  });

  it("brings Walk's contents in from the right and Edit's from the left, the old ones leaving the other way", () => {
    expect(contentShift('walk')).toEqual({ leave: -12, arrive: 12 });
    expect(contentShift('edit')).toEqual({ leave: 12, arrive: -12 });
  });
});

describe('morphFrames', () => {
  const root = { left: 0, top: 12 };

  it('grows the bar from the old box to the new, the clip opening from the old box to none', () => {
    // A narrower strip giving way to a wider one, both centred on 500.
    const from = { left: 300, top: 12, width: 400, height: 44 };
    const to = { left: 250, top: 12, width: 500, height: 44 };
    const f = morphFrames(from, to, root, 1, 12);
    expect(f.surface).toEqual([
      { left: 300, top: 0, width: 400, height: 44 },
      { left: 250, top: 0, width: 500, height: 44 },
    ]);
    expect(f.clip).toEqual([
      'inset(0px 50px 0px 50px round 12px)',
      'inset(0px 0px 0px 0px round 12px)',
    ]);
    // The toggle starts where the old strip's stood, 50px right of its new place.
    expect(f.ride).toBe(50);
  });

  it('clips outside the card (negative insets) when the bar shrinks', () => {
    const from = { left: 250, top: 12, width: 500, height: 44 };
    const to = { left: 300, top: 12, width: 400, height: 44 };
    const f = morphFrames(from, to, root, 1, 12);
    expect(f.clip[0]).toBe('inset(0px -50px 0px -50px round 12px)');
    expect(f.ride).toBe(-50);
  });

  it('works in the zoomed box’s own px under a UI scale', () => {
    const from = { left: 300, top: 12, width: 400, height: 44 };
    const to = { left: 250, top: 12, width: 500, height: 44 };
    const f = morphFrames(from, to, { left: 0, top: 0 }, 2, 12);
    expect(f.surface[0]).toEqual({ left: 150, top: 6, width: 200, height: 22 });
    expect(f.ride).toBe(25);
    expect(f.clip[0]).toBe('inset(0px 25px 0px 25px round 12px)');
  });

  it('treats a missing zoom as 1', () => {
    const box = { left: 10, top: 10, width: 100, height: 40 };
    expect(morphFrames(box, box, { left: 0, top: 0 }, 0, 8).surface[0]).toEqual(box);
  });
});
