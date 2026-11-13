import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { fenceSegments } from './collision';
import { FRONT_SPOT_GAP, freeFrontSpot } from './front-spot';
import type { AvatarSceneElement } from './scene';

// docs/specs/009-elements/social-pieces.md "A crowded machine stays reachable" (Work Tracker 635). A machine 64 px wide
// at x 0..64, its walk point 16 px below it, its reach 24 px past either side (useSocialPieces arcadeFront).
const reach = (p: { x: number; y: number }) => p.x >= -24 && p.x <= 88 && p.y >= 60 && p.y <= 136;
const want = { x: 32, y: 128 };

describe('freeFrontSpot', () => {
  it('keeps the walk point while nobody stands there', () => {
    expect(freeFrontSpot({ want, axis: 'x', others: [], inReach: reach })).toEqual(want);
    // Somebody further off than a shoulder's width is not in the way.
    expect(
      freeFrontSpot({
        want,
        axis: 'x',
        others: [{ x: 32 + FRONT_SPOT_GAP, y: 128 }],
        inReach: reach,
      }),
    ).toEqual(want);
  });

  it('walks a newcomer to the nearest free spot beside the one already there', () => {
    const at = freeFrontSpot({ want, axis: 'x', others: [want], inReach: reach });
    expect(at).toEqual({ x: 32 + FRONT_SPOT_GAP, y: 128 });
    expect(reach(at)).toBe(true);
  });

  it('with two at the machine, a third still ends in reach, clear of both', () => {
    const others = [want, { x: 56, y: 128 }];
    const at = freeFrontSpot({ want, axis: 'x', others, inReach: reach });
    expect(reach(at)).toBe(true);
    for (const o of others)
      expect(Math.hypot(o.x - at.x, o.y - at.y)).toBeGreaterThanOrEqual(FRONT_SPOT_GAP);
    expect(at).toEqual({ x: 8, y: 128 });
  });

  it('with no free spot, ends where there is the most room, still in reach', () => {
    const others = [-16, 8, 32, 56, 80].map((x) => ({ x, y: 128 }));
    const at = freeFrontSpot({ want, axis: 'x', others, inReach: reach });
    expect(reach(at)).toBe(true);
    expect(at.y).toBe(128);
    // Between two of them, a step's width from the nearer: more room than standing on anyone.
    expect(Math.min(...others.map((o) => Math.abs(o.x - at.x)))).toBe(8);
  });

  it('searches down the canvas for a piece turned onto its side', () => {
    const side = (p: { x: number; y: number }) => p.x >= 0 && p.x <= 30 && p.y >= 0 && p.y <= 120;
    const w = { x: 16, y: 60 };
    expect(freeFrontSpot({ want: w, axis: 'y', others: [w], inReach: side })).toEqual({
      x: 16,
      y: 60 + FRONT_SPOT_GAP,
    });
  });

  it('never ends past a wall, inside a footprint or within a wall’s reach', () => {
    // A wall just right of the walk point, and a plant's pot just left of it.
    const elements = [
      { id: 'w', type: 'shape', shape: 'fence', x: 44, y: 100, width: 4, height: 60 },
      { id: 'p', type: 'shape', shape: 'plant', x: -30, y: 100, width: 40, height: 50 },
    ] as unknown as AvatarSceneElement[];
    const fences = fenceSegments(elements);
    const at = freeFrontSpot({ want, axis: 'x', others: [want], inReach: reach, fences });
    expect(at.x).toBeGreaterThan(-30 + 40);
    expect(at.x).toBeLessThan(44);
  });

  it('a crowded tab stays cheap', () => {
    const others = Array.from({ length: 2000 }, (_, i) => ({
      x: (i % 50) * 8,
      y: 128 + Math.floor(i / 50),
    }));
    const ms = cpuMsOf(() => {
      for (let i = 0; i < 100; i++) freeFrontSpot({ want, axis: 'x', others, inReach: reach });
    });
    expect(ms).toBeLessThan(cpuBudgetMs(150));
  });
});
