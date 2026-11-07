import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { roomInterior } from '@liveworkspace/avatar/office-geometry';
import {
  hashId,
  msToNextLeg,
  PET_INSET,
  PET_LEG_MS,
  PET_NAP_EVERY,
  PET_BODY,
  PET_RADIUS,
  PET_TRIES,
  petArea,
  petClear,
  petLeg,
  petLegAt,
  seeded,
  type PetArea,
} from './pet-wander';

// docs/specs/009-elements/workday-pieces.md "Pet Bed and its dog"
const room = { x: 0, y: 0, width: 600, height: 400 };
const bed = { x: 200, y: 200, width: 72, height: 48 };
const box: PetArea = petArea(bed, [room]);

describe('the office dog', () => {
  it('hashes and seeds the same everywhere', () => {
    expect(hashId('bed-1')).toBe(hashId('bed-1'));
    expect(hashId('bed-1')).not.toBe(hashId('bed-2'));
    const a = seeded(42);
    const b = seeded(42);
    const xs = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(xs);
    for (const x of xs) expect(x >= 0 && x < 1).toBe(true);
  });

  it('wanders its room floor, inset from the walls, or a circle round a bed in no room', () => {
    const f = roomInterior(room);
    expect(box).toEqual({
      kind: 'box',
      box: {
        x: f.x + PET_INSET,
        y: f.y + PET_INSET,
        width: f.width - 2 * PET_INSET,
        height: f.height - 2 * PET_INSET,
      },
    });
    // The innermost room wins.
    const booth = { x: 150, y: 150, width: 200, height: 150 };
    expect(petArea(bed, [room, booth])).toEqual(petArea(bed, [booth]));
    expect(petArea(bed, [])).toEqual({ kind: 'circle', at: { x: 236, y: 224 }, r: PET_RADIUS });
    // A room too small to inset: the circle.
    const cupboard = { x: 180, y: 180, width: 120, height: 90 };
    expect(petArea(bed, [cupboard]).kind).toBe('circle');
  });

  it('goes to the same spot on every screen, inside its area, and naps every fourth leg', () => {
    const circle = petArea(bed, []);
    for (let n = 0; n < 400; n += 1) {
      const spot = petLeg('bed-1', n, box);
      expect(petLeg('bed-1', n, box)).toEqual(spot);
      if (n % PET_NAP_EVERY === PET_NAP_EVERY - 1) {
        expect(spot).toBeNull();
        expect(petLeg('bed-1', n, circle)).toBeNull();
        continue;
      }
      if (box.kind !== 'box' || !spot) throw new Error('a wandering leg');
      expect(spot.x >= box.box.x && spot.x <= box.box.x + box.box.width).toBe(true);
      expect(spot.y >= box.box.y && spot.y <= box.box.y + box.box.height).toBe(true);
      const round = petLeg('bed-1', n, circle)!;
      expect(Math.hypot(round.x - 236, round.y - 224)).toBeLessThanOrEqual(PET_RADIUS + 1e-9);
    }
    // Two beds wander apart; negative legs (a clock before 1970) still nap on the same beat.
    expect(petLeg('bed-1', 1, box)).not.toEqual(petLeg('bed-2', 1, box));
    expect(petLeg('bed-1', -1, box)).toBeNull();
  });

  it('agrees on the leg to the second, and wakes once a leg', () => {
    expect(petLegAt(0)).toBe(0);
    expect(petLegAt(PET_LEG_MS - 1)).toBe(0);
    expect(petLegAt(PET_LEG_MS)).toBe(1);
    expect(msToNextLeg(0)).toBe(PET_LEG_MS);
    expect(msToNextLeg(PET_LEG_MS + 1000)).toBe(PET_LEG_MS - 1000);
    expect(msToNextLeg(-1000)).toBe(1000);
  });

  it('never ends a leg behind or under a piece, or in another room, the same spot on every screen', () => {
    // A coffee machine, a desk and a small meeting room in the dog's room, and a cabinet outside it (out of reach).
    const machine = { x: 60, y: 60, width: 72, height: 96 };
    const desk = { x: 320, y: 120, width: 120, height: 112 };
    const meeting = { x: 380, y: 260, width: 200, height: 120 };
    const far = { x: 2000, y: 2000, width: 50, height: 50 };
    // The room round the bed's room is the bed's own, never a block.
    const hall = { x: -500, y: -500, width: 2000, height: 2000 };
    const area = petArea(bed, [hall, room, meeting], [machine, desk, far]);
    expect(area.kind).toBe('box');
    expect(area.blocks).toEqual([machine, desk, meeting]);
    const body = (p: { x: number; y: number }) => ({
      x0: p.x - PET_BODY.left,
      x1: p.x + PET_BODY.right,
      y0: p.y - PET_BODY.up,
      y1: p.y + PET_BODY.down,
    });
    let wandered = 0;
    for (let n = 0; n < 2000; n += 1) {
      const spot = petLeg('bed-1', n, area);
      expect(petLeg('bed-1', n, area)).toEqual(spot);
      if (!spot) continue;
      wandered += 1;
      const d = body(spot);
      for (const b of [machine, desk, meeting])
        expect(d.x1 <= b.x || d.x0 >= b.x + b.width || d.y1 <= b.y || d.y0 >= b.y + b.height).toBe(
          true,
        );
    }
    // It still wanders most legs: a few pieces only move it on to the generator's next spot.
    expect(wandered).toBeGreaterThan(1400);
    // A spot is clear only with its whole body clear: feet just below a piece clear it, a head behind its foot does not.
    expect(petClear({ x: 96, y: 156 + PET_BODY.up }, [machine])).toBe(true);
    expect(petClear({ x: 96, y: 156 + PET_BODY.up - 1 }, [machine])).toBe(false);
    expect(petClear({ x: 96, y: 10 }, undefined)).toBe(true);
  });

  it('naps in its bed when its room has no clear spot in PET_TRIES tries', () => {
    const packed = petArea(bed, [room], [{ x: -10, y: -10, width: 700, height: 500 }]);
    for (let n = 0; n < 40; n += 1) expect(petLeg('bed-1', n, packed)).toBeNull();
    expect(PET_TRIES).toBeGreaterThan(1);
    // A bed in no room keeps clear of the rooms near it, and of pieces round it.
    const nearby = { x: 300, y: 150, width: 200, height: 160 };
    const round = petArea(bed, [nearby], [{ x: 100, y: 300, width: 60, height: 60 }]);
    expect(round.kind).toBe('circle');
    expect(round.blocks).toEqual([{ x: 100, y: 300, width: 60, height: 60 }, nearby]);
  });

  it('works out a hundred thousand legs well inside a frame budget', () => {
    expect(
      cpuMsOf(() => {
        for (let n = 0; n < 100_000; n += 1) petLeg('bed-1', n, box);
      }),
    ).toBeLessThan(cpuBudgetMs(60));
    // A room crowded with two hundred pieces, every leg trying its spots against them all.
    const crowd = Array.from({ length: 200 }, (_, i) => ({
      x: 40 + (i % 20) * 27,
      y: 40 + Math.floor(i / 20) * 33,
      width: 8,
      height: 8,
    }));
    const crowded = petArea(bed, [room], crowd);
    expect(
      cpuMsOf(() => {
        for (let n = 0; n < 10_000; n += 1) petLeg('bed-1', n, crowded);
      }),
    ).toBeLessThan(cpuBudgetMs(200));
  });
});
