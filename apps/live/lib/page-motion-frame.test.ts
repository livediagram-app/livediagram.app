import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ANIM_ORIGIN,
  animOrigin,
  cubicBezier,
  openingPhase,
  openingPose,
  poseAt,
} from './page-motion-frame';

// Where an animated background stands as the slide opens (docs/specs/007-editor/
// illustrate-pages.md "Animated backgrounds"): the export draws this still. The poses were checked
// against Chrome's own computed transforms for every part of all twenty-four motions.

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
    expect(openingPose(undefined)).toEqual({
      tx: 0,
      ty: 0,
      scale: 1,
      sx: 1,
      sy: 1,
      rotate: 0,
      opacity: 1,
    });
  });

  it('warps a streak out along its heading, lengthening as it speeds up', () => {
    const anim = { name: 'warp', d: 1, x: 1000, r: 90 } as const;
    const start = poseAt(anim, 0);
    expect(start).toMatchObject({ rotate: 90, sx: 0.2, opacity: 0 });
    expect(start.tx).toBeCloseTo(0);
    expect(start.ty).toBeCloseTo(60);
    const end = poseAt(anim, 1);
    expect(end).toMatchObject({ sx: 1, opacity: 1 });
    expect(end.ty).toBeCloseTo(1000);
    // Easing in: a quarter of the way through, well under a quarter of the way out.
    expect(poseAt(anim, 0.25).ty).toBeLessThan(250);
  });

  it('orbits from its starting angle, a full turn a loop', () => {
    expect(poseAt({ name: 'orbit', d: 1, r: 30 }, 0).rotate).toBe(30);
    expect(poseAt({ name: 'orbit', d: 1, r: 30 }, 0.5).rotate).toBe(210);
  });

  it('flashes a blip and fades it over the rest of the turn', () => {
    expect(poseAt({ name: 'blip', d: 1 }, 0)).toMatchObject({ scale: 1.5, opacity: 1 });
    expect(poseAt({ name: 'blip', d: 1 }, 0.35).opacity).toBeCloseTo(0.4);
    expect(poseAt({ name: 'blip', d: 1 }, 1).opacity).toBeCloseTo(0.08);
  });

  it('raises a bar through its beats, tallest at three fifths', () => {
    expect(poseAt({ name: 'bars', d: 1 }, 0).sy).toBe(0.25);
    expect(poseAt({ name: 'bars', d: 1 }, 0.6).sy).toBeCloseTo(1);
    expect(poseAt({ name: 'bars', d: 1 }, 0.8).sy).toBeCloseTo(0.4);
  });

  it('tumbles confetti down, swaying either side and spinning', () => {
    const anim = { name: 'tumble', d: 1, x: 20, y: 400, r: 720 } as const;
    expect(poseAt(anim, 0.25)).toMatchObject({ tx: 20, ty: 100, rotate: 180 });
    expect(poseAt(anim, 0.75).tx).toBeCloseTo(-20);
    expect(poseAt(anim, 1)).toMatchObject({ ty: 400, rotate: 720 });
  });
});

describe('animOrigin', () => {
  const css = readFileSync(join(__dirname, '..', 'app', 'motion-page.css'), 'utf8');

  it('turns a part about its centre unless its loop says otherwise', () => {
    expect(animOrigin(undefined)).toEqual([0.5, 0.5]);
    expect(animOrigin({ name: 'turn', d: 1 })).toEqual([0.5, 0.5]);
    expect(animOrigin({ name: 'warp', d: 1 })).toEqual([0, 0.5]);
  });

  it.each(Object.entries(ANIM_ORIGIN))('matches the stylesheet for %s', (name, origin) => {
    const rule = css.match(new RegExp(`\\.pm-${name} \\{([^}]*)\\}`))?.[1] ?? '';
    const pct = (f: number) => (f === 0 ? '0' : `${f * 100}%`);
    expect(rule).toContain(`transform-origin: ${pct(origin[0])} ${pct(origin[1])};`);
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
