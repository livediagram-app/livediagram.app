import { describe, expect, it } from 'vitest';
import { footprintFraction, officeFootprint } from './office-geometry';
import { SEAT_VIEWS, seatPoints, type SeatFacing } from './seats';

// livehuddle's docs/specs/009-elements/social-pieces.md and furniture-facing.md "A turn": the social pieces with live
// faces, turned. Their seats keep their cushions and order, and their footprints stand on their turned base.

const FACINGS: readonly SeatFacing[] = ['n', 'e', 's', 'w'];

describe('a turned ping-pong table', () => {
  const at = (chairFacing: SeatFacing, width: number, height: number) =>
    seatPoints({ x: 0, y: 0, width, height, shape: 'ping-pong-table', chairFacing });

  it('keeps its two players at its two ends, facing each other, at every facing', () => {
    const front = at('n', 184, 112);
    expect(front.map((s) => s.facing)).toEqual(['right', 'left']);
    expect(front[0]!.x).toBeLessThan(front[1]!.x);
    // From behind the left seat is at the right end.
    const back = at('s', 184, 112);
    expect(back.map((s) => s.facing)).toEqual(['left', 'right']);
    expect(back[0]!.x).toBeGreaterThan(back[1]!.x);
    // On its side, the left seat at the far end (the top), the right seat at the near end, either way round.
    for (const facing of ['e', 'w'] as const) {
      const side = at(facing, 112, 184);
      expect(
        side.map((s) => s.facing),
        facing,
      ).toEqual(['down', 'up']);
      expect(side[0]!.y).toBeLessThan(40);
      expect(side[1]!.y).toBeGreaterThan(150);
      expect(side[0]!.x).toBeCloseTo(56);
      expect(side[1]!.x).toBeCloseTo(56);
    }
  });

  it('draws every view on its own grid, the side a quarter turn of the front', () => {
    const v = SEAT_VIEWS['ping-pong-table'];
    expect([v.front.width, v.front.height]).toEqual([184, 112]);
    expect([v.back.width, v.back.height]).toEqual([184, 112]);
    expect([v.side.width, v.side.height]).toEqual([112, 184]);
    for (const grid of [v.front, v.back, v.side]) expect(grid.seats).toHaveLength(2);
  });
});

describe('a turned reading nook', () => {
  it('seats its one sitter in the armchair, facing away from its back at every facing', () => {
    const want: Record<SeatFacing, string> = { n: 'down', e: 'left', s: 'up', w: 'right' };
    for (const facing of FACINGS) {
      const sideways = facing === 'e' || facing === 'w';
      const [w, h] = sideways ? [112, 160] : [160, 112];
      const seats = seatPoints({
        x: 0,
        y: 0,
        width: w,
        height: h,
        shape: 'reading-nook',
        chairFacing: facing,
      });
      expect(seats, facing).toHaveLength(1);
      expect(seats[0]!.facing, facing).toBe(want[facing]);
      expect(seats[0]!.x).toBeGreaterThan(w * 0.3);
      expect(seats[0]!.x).toBeLessThan(w * 0.7);
    }
  });
});

describe('the turned scenery pieces', () => {
  const cases = [
    ['jukebox', 72, 112, 56],
    ['arcade-machine', 64, 112, 60],
    ['fireplace', 128, 120, 48],
    ['vending-machine', 72, 128, 60],
  ] as const;

  it('block on their base at every facing: the front base from behind, the side base on their side', () => {
    for (const [shape, width, height, sideWidth] of cases) {
      expect(footprintFraction(shape, 's'), shape).toEqual(footprintFraction(shape, 'n'));
      for (const facing of ['e', 'w'] as const) {
        const f = officeFootprint({
          x: 0,
          y: 0,
          width: sideWidth,
          height,
          shape,
          chairFacing: facing,
        })!;
        expect(f.x, shape).toBeGreaterThanOrEqual(0);
        expect(f.x + f.width, shape).toBeLessThanOrEqual(sideWidth);
        // At the foot of the drawing, under three quarters of its height.
        expect(f.y, shape).toBeGreaterThan(height * 0.7);
        expect(f.y + f.height, shape).toBeLessThanOrEqual(height);
      }
      // Facing right is the side mirrored.
      const e = footprintFraction(shape, 'e')!;
      const w = footprintFraction(shape, 'w')!;
      expect(w.x0).toBeCloseTo(1 - e.x1);
      expect(w.x1).toBeCloseTo(1 - e.x0);
      // Narrower on its side than across its front.
      expect(sideWidth).toBeLessThan(width);
    }
  });
});
