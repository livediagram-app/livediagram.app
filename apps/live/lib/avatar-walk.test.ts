import { describe, expect, it } from 'vitest';
import { createShape, type Element } from '@livediagram/diagram';
import {
  AVATAR_HEIGHT,
  AVATAR_JUMP_VELOCITY,
  AVATAR_SPEED,
  AVATAR_WIDTH,
  arrowDirection,
  elementUnderFeet,
  facingFromDelta,
  followCorrection,
  hitTestAvatar,
  jumpStep,
  stepTowards,
  waveFrame,
} from './avatar-walk';

describe('stepTowards', () => {
  it('walks at a constant speed toward the target', () => {
    const { pos, arrived } = stepTowards({ x: 0, y: 0 }, { x: 1000, y: 0 }, 0.5);
    expect(pos.x).toBeCloseTo(AVATAR_SPEED * 0.5);
    expect(pos.y).toBe(0);
    expect(arrived).toBe(false);
  });

  it('does not overshoot: a long frame lands exactly on the target', () => {
    const { pos, arrived } = stepTowards({ x: 0, y: 0 }, { x: 10, y: 0 }, 1);
    expect(pos).toEqual({ x: 10, y: 0 });
    expect(arrived).toBe(true);
  });

  it('walks diagonals at the same speed as straight lines', () => {
    const { pos } = stepTowards({ x: 0, y: 0 }, { x: 1000, y: 1000 }, 0.5);
    expect(Math.hypot(pos.x, pos.y)).toBeCloseTo(AVATAR_SPEED * 0.5);
  });

  it('arrives when already within the epsilon, without jittering', () => {
    const { pos, arrived } = stepTowards({ x: 100, y: 100 }, { x: 100.5, y: 100 }, 0.016);
    expect(arrived).toBe(true);
    expect(pos).toEqual({ x: 100.5, y: 100 });
  });

  it('stands still with no target', () => {
    const { pos, arrived } = stepTowards({ x: 5, y: 5 }, null, 0.016);
    expect(pos).toEqual({ x: 5, y: 5 });
    expect(arrived).toBe(false);
  });
});

describe('arrowDirection', () => {
  it('mirrors a single held key', () => {
    expect(arrowDirection({ right: true })).toEqual({ x: 1, y: 0 });
    expect(arrowDirection({ up: true })).toEqual({ x: 0, y: -1 });
  });

  it('normalises a diagonal so it is not faster', () => {
    const d = arrowDirection({ down: true, right: true });
    expect(Math.hypot(d!.x, d!.y)).toBeCloseTo(1);
  });

  it('cancels opposite keys', () => {
    expect(arrowDirection({ left: true, right: true })).toBeNull();
    expect(arrowDirection({})).toBeNull();
  });
});

describe('facingFromDelta', () => {
  it('picks the dominant axis', () => {
    expect(facingFromDelta(-30, 5)).toBe('left');
    expect(facingFromDelta(30, -5)).toBe('right');
    expect(facingFromDelta(5, 30)).toBe('down');
    expect(facingFromDelta(-5, -30)).toBe('up');
  });

  it('gives a tie to the vertical facing, so a straight-down walk stays front-on', () => {
    expect(facingFromDelta(20, 20)).toBe('down');
  });

  it('keeps the caller in charge when there is no movement', () => {
    expect(facingFromDelta(0, 0)).toBeNull();
  });
});

describe('followCorrection', () => {
  const size = { width: 1000, height: 800 };

  it('is a no-op while the avatar is comfortably inside', () => {
    expect(followCorrection({ x: 500, y: 400 }, size, 1)).toEqual({ x: 0, y: 0 });
  });

  it('pans the content right when the avatar nears the left edge', () => {
    const c = followCorrection({ x: 20, y: 400 }, size, 1, 120);
    expect(c.x).toBe(100); // needs to sit 120px in
    expect(c.y).toBe(0);
  });

  it('pans the content left when the avatar nears the right edge', () => {
    const c = followCorrection({ x: 980, y: 400 }, size, 1, 120);
    expect(c.x).toBe(-100);
  });

  it('divides by zoom, since the offset is applied before the scale', () => {
    const c = followCorrection({ x: 20, y: 400 }, size, 2, 120);
    expect(c.x).toBe(50);
  });

  it('clamps a margin wider than half the viewport so the edges cannot fight', () => {
    const c = followCorrection({ x: 300, y: 400 }, { width: 600, height: 800 }, 1, 400);
    expect(c.x).toBe(0);
  });
});

describe('jumpStep', () => {
  it('rises then falls, and reports the landing', () => {
    // Integrate a whole hop at 60fps and watch it come back down.
    let lift = 0.001;
    let vy = AVATAR_JUMP_VELOCITY;
    let peak = 0;
    let frames = 0;
    let landed = false;
    while (!landed && frames < 600) {
      const step = jumpStep(lift, vy, 1 / 60);
      lift = step.lift;
      vy = step.vy;
      landed = step.landed;
      peak = Math.max(peak, lift);
      frames += 1;
    }
    expect(landed).toBe(true);
    expect(lift).toBe(0);
    // A hop worth seeing from across a room, over in well under a second.
    expect(peak).toBeGreaterThan(50);
    expect(peak).toBeLessThan(100);
    expect(frames / 60).toBeLessThan(1);
  });

  it('clamps to the ground rather than going negative', () => {
    const step = jumpStep(1, -900, 1 / 30);
    expect(step).toEqual({ lift: 0, vy: 0, landed: true });
  });
});

describe('waveFrame', () => {
  it('cycles through three frames', () => {
    expect(waveFrame(0, 1000)).toBe(0);
    expect(waveFrame(120, 1000)).toBe(1);
    expect(waveFrame(240, 1000)).toBe(2);
    expect(waveFrame(360, 1000)).toBe(0);
  });

  it('reports null once the wave is over, so the flag comes down', () => {
    expect(waveFrame(1001, 1000)).toBeNull();
    expect(waveFrame(-1, 1000)).toBeNull();
  });
});

describe('hitTestAvatar', () => {
  const feet = { x: 100, y: 200 };

  it('hits the body above the feet', () => {
    expect(hitTestAvatar(feet, { x: 100, y: 200 - AVATAR_HEIGHT / 2 })).toBe(true);
    expect(hitTestAvatar(feet, { x: 100 + AVATAR_WIDTH / 2 - 1, y: 199 })).toBe(true);
  });

  it('misses beside, below, and above the sprite', () => {
    expect(hitTestAvatar(feet, { x: 100 + AVATAR_WIDTH, y: 190 })).toBe(false);
    expect(hitTestAvatar(feet, { x: 100, y: 210 })).toBe(false);
    expect(hitTestAvatar(feet, { x: 100, y: 200 - AVATAR_HEIGHT - 5 })).toBe(false);
  });

  it('follows the character into the air mid-jump', () => {
    const midAir = { x: 100, y: 200 - 60 - 10 }; // 10px above a 60px hop's feet
    expect(hitTestAvatar(feet, midAir)).toBe(false);
    expect(hitTestAvatar(feet, midAir, 60)).toBe(true);
  });
});

describe('elementUnderFeet', () => {
  const box: Element = { ...createShape('square', 100, 100), id: 'a', width: 200, height: 100 };
  const overlapping: Element = {
    ...createShape('square', 150, 120),
    id: 'b',
    width: 200,
    height: 100,
  };
  const frame: Element = { ...createShape('frame', 0, 0), id: 'f', width: 900, height: 900 };

  it('finds the element the feet are inside', () => {
    expect(elementUnderFeet([box], { x: 150, y: 150 })).toBe('a');
  });

  it('returns null when standing on bare canvas', () => {
    expect(elementUnderFeet([box], { x: 500, y: 500 })).toBeNull();
  });

  it('picks the frontmost of two overlapping elements', () => {
    expect(elementUnderFeet([box, overlapping], { x: 200, y: 150 })).toBe('b');
  });

  it('ignores frames, which would otherwise ring on every step', () => {
    expect(elementUnderFeet([frame], { x: 400, y: 400 })).toBeNull();
    expect(elementUnderFeet([frame, box], { x: 150, y: 150 })).toBe('a');
  });
});
