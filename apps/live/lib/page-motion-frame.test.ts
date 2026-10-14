import { describe, expect, it } from 'vitest';
import { cubicBezier, openingPhase, openingPose, poseAt } from './page-motion-frame';

// Where an animated background stands as the slide opens (docs/specs/007-editor/
// illustrate-pages.md "Animated backgrounds"): the export draws this still. The poses were checked
// against Chrome's own computed transforms for every part of all eighteen motions.

describe('openingPhase', () => {
  it('opens a loop as far in as its start is below zero', () => {
    expect(openingPhase({ d: 10, dl: -2.5 })).toEqual({ p: 0.25, reversed: false });
  });

  it('opens at the start with no delay', () => {
    expect(openingPhase({ d: 10 })).toEqual({ p: 0, reversed: false });
  });

  it('wraps a start more than a loop in, noting an alternate loop on its way back', () => {
    const { p, reversed } = openingPhase({ d: 19, dl: -28.5 });
    expect(p).toBeCloseTo(0.5);
    expect(reversed).toBe(true);
  });

  it('treats a zero-length loop as at rest', () => {
    expect(openingPhase({ d: 0, dl: -3 })).toEqual({ p: 0, reversed: false });
  });
});

describe('poseAt', () => {
  it('slides along the way, and back', () => {
    expect(poseAt({ name: 'slide-x', d: 1, x: 100 }, 0.25).tx).toBe(25);
    expect(poseAt({ name: 'slide-x-back', d: 1, x: 100 }, 0.25).tx).toBe(75);
    expect(poseAt({ name: 'slide-y', d: 1, y: 40 }, 0.5).ty).toBe(20);
  });

  it('falls on both axes and turns a full circle a loop', () => {
    expect(poseAt({ name: 'fall', d: 1, x: 10, y: 100 }, 0.5)).toMatchObject({ tx: 5, ty: 50 });
    expect(poseAt({ name: 'turn', d: 1 }, 0.25).rotate).toBe(90);
  });

  it('glides at its fixed slant', () => {
    expect(poseAt({ name: 'glide', d: 1, x: 200 }, 0.5)).toMatchObject({ tx: 100, rotate: 18 });
  });

  it('wanders through its four corners, eased', () => {
    const anim = { name: 'wander', d: 1, x: 100, y: 50 } as const;
    expect(poseAt(anim, 0.25)).toMatchObject({ tx: 100, ty: -50 });
    expect(poseAt(anim, 0.5)).toMatchObject({ tx: 40, ty: 50 });
    expect(poseAt(anim, 0.75).tx).toBeCloseTo(-80);
    expect(poseAt(anim, 1)).toMatchObject({ tx: 0, ty: 0 });
  });

  it('rises, fading in then out', () => {
    const anim = { name: 'rise', d: 1, y: -100 } as const;
    expect(poseAt(anim, 0)).toMatchObject({ opacity: 0, scale: 0.8 });
    expect(poseAt(anim, 0.15).opacity).toBeCloseTo(1);
    expect(poseAt(anim, 0.7).opacity).toBeCloseTo(0.8);
    expect(poseAt(anim, 1)).toMatchObject({ ty: -100, opacity: 0 });
  });

  it('spreads from a dot, fading after its first eighth', () => {
    const anim = { name: 'spread', d: 1 } as const;
    expect(poseAt(anim, 0).scale).toBeCloseTo(0.05);
    expect(poseAt(anim, 0.12).opacity).toBeCloseTo(1);
    expect(poseAt(anim, 1)).toMatchObject({ scale: 1, opacity: 0 });
  });

  it('twinkles, floats and pulses at their peaks halfway', () => {
    expect(poseAt({ name: 'twinkle', d: 1 }, 0.5)).toMatchObject({ scale: 1, opacity: 1 });
    expect(poseAt({ name: 'float', d: 1, x: 10, y: 20 }, 0.5)).toMatchObject({
      tx: 10,
      ty: 20,
      scale: 1.12,
      opacity: 1,
    });
    expect(poseAt({ name: 'pulse', d: 1 }, 0)).toMatchObject({ scale: 0.55, opacity: 0.35 });
    expect(poseAt({ name: 'pulse', d: 1 }, 0.5)).toMatchObject({ scale: 1.15, opacity: 1 });
  });

  it('sweeps eased, and an alternate loop opening on its way back runs from the far end', () => {
    expect(poseAt({ name: 'sweep', d: 1, x: 100 }, 0.5).tx).toBeCloseTo(50);
    // 9s into a 19s loop on its first pass; 28.5s in is halfway back.
    const back = openingPose({ name: 'sweep', d: 19, dl: -23.75, x: 100 });
    const out = openingPose({ name: 'sweep', d: 19, dl: -4.75, x: 100 });
    expect(back.tx).toBeCloseTo(100 - out.tx);
  });

  it('rests a part that does not move', () => {
    expect(openingPose(undefined)).toEqual({ tx: 0, ty: 0, scale: 1, rotate: 0, opacity: 1 });
  });
});

describe('cubicBezier', () => {
  it('runs from 0 to 1 and eases in-out symmetrically', () => {
    const ease = cubicBezier(0.42, 0, 0.58, 1);
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    expect(ease(0.5)).toBeCloseTo(0.5);
    expect(ease(0.25)).toBeLessThan(0.25);
    expect(ease(0.25) + ease(0.75)).toBeCloseTo(1);
  });

  it('is linear on the diagonal', () => {
    expect(cubicBezier(1 / 3, 1 / 3, 2 / 3, 2 / 3)(0.3)).toBeCloseTo(0.3);
  });
});
