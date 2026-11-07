import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { roomInterior } from '@liveworkspace/avatar/office-geometry';
import {
  hashId,
  msToNextLeg,
  PET_INSET,
  PET_LEG_MS,
  PET_NAP_EVERY,
  PET_RADIUS,
  petArea,
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

  it('works out a hundred thousand legs well inside a frame budget', () => {
    expect(
      cpuMsOf(() => {
        for (let n = 0; n < 100_000; n += 1) petLeg('bed-1', n, box);
      }),
    ).toBeLessThan(cpuBudgetMs(60));
  });
});
