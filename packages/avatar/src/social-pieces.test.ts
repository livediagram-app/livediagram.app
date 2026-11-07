import { describe, expect, it } from 'vitest';
import {
  isFixedSeatShape,
  isSceneryShape,
  isWallPieceShape,
  officeFootprint,
  seatsACharacter,
} from './office-geometry';
import { facingView, type SeatFacing } from './facing';
import { SEAT_VIEWS, seatPoints } from './seats';

// livehuddle's docs/specs/009-elements/social-pieces.md: the seats, the footprints and the wall pieces.
describe('the social pieces', () => {
  it('seats two at a ping-pong table and a bench, six at a picnic table, one in a hammock', () => {
    const cases = [
      ['ping-pong-table', 184, 112, 2],
      ['bench', 136, 64, 2],
      ['picnic-table', 200, 152, 6],
      ['hammock', 152, 80, 1],
      ['bean-bag', 64, 56, 1],
      ['reading-nook', 160, 112, 1],
    ] as const;
    for (const [shape, width, height, n] of cases) {
      expect(isFixedSeatShape(shape)).toBe(true);
      expect(seatsACharacter(shape)).toBe(true);
      const seats = seatPoints({ x: 0, y: 0, width, height, shape });
      expect(seats, shape).toHaveLength(n);
      for (const s of seats) {
        expect(s.x).toBeGreaterThanOrEqual(0);
        expect(s.x).toBeLessThanOrEqual(width);
        expect(s.y).toBeGreaterThanOrEqual(0);
        expect(s.y).toBeLessThanOrEqual(height);
      }
    }
  });

  it('faces the ping-pong players at each other and the picnic diners at the table', () => {
    const pp = seatPoints({ x: 0, y: 0, width: 184, height: 112, shape: 'ping-pong-table' });
    expect(pp.map((s) => s.facing)).toEqual(['right', 'left']);
    const picnic = seatPoints({ x: 0, y: 0, width: 200, height: 152, shape: 'picnic-table' });
    expect(picnic.filter((s) => s.facing === 'down')).toHaveLength(3);
    expect(picnic.filter((s) => s.facing === 'up')).toHaveLength(3);
  });

  it('blocks only at the base of the scenery pieces', () => {
    const cases = [
      ['jukebox', 72, 112],
      ['arcade-machine', 64, 112],
      ['fireplace', 128, 120],
      ['garden-umbrella', 120, 152],
      ['fountain', 136, 120],
      ['pond', 240, 152],
      ['campfire', 80, 72],
      ['pool-table', 200, 128],
      ['foosball-table', 168, 104],
      ['vending-machine', 72, 128],
    ] as const;
    for (const [shape, width, height] of cases) {
      expect(isSceneryShape(shape), shape).toBe(true);
      const f = officeFootprint({ x: 0, y: 0, width, height, shape })!;
      expect(f, shape).not.toBeNull();
      expect(f.x).toBeGreaterThanOrEqual(0);
      expect(f.x + f.width).toBeLessThanOrEqual(width);
      expect(f.y + f.height).toBeLessThanOrEqual(height);
    }
    // The umbrella's canopy is overhead: only its narrow base is in the way.
    const umbrella = officeFootprint({
      x: 0,
      y: 0,
      width: 120,
      height: 152,
      shape: 'garden-umbrella',
    })!;
    expect(umbrella.width).toBeLessThan(30);
  });

  it('seats the bean bag and the reading nook one each, facing down the canvas', () => {
    const bag = seatPoints({ x: 0, y: 0, width: 64, height: 56, shape: 'bean-bag' });
    const nook = seatPoints({ x: 0, y: 0, width: 160, height: 112, shape: 'reading-nook' });
    expect([...bag, ...nook].map((s) => s.facing)).toEqual(['down', 'down']);
  });

  it('keeps the games tables visual: they block, and nobody sits at them', () => {
    for (const shape of ['pool-table', 'foosball-table', 'vending-machine', 'dartboard']) {
      expect(isFixedSeatShape(shape), shape).toBe(false);
      expect(seatsACharacter(shape), shape).toBe(false);
    }
  });

  it('hangs the notice board, the world clock and the dartboard on the wall: nothing to walk into or stand on', () => {
    expect(isWallPieceShape('notice-board')).toBe(true);
    expect(isWallPieceShape('world-clock')).toBe(true);
    expect(isWallPieceShape('dartboard')).toBe(true);
    expect(isWallPieceShape('jukebox')).toBe(false);
    for (const shape of ['notice-board', 'world-clock', 'dartboard'])
      expect(officeFootprint({ x: 0, y: 0, width: 100, height: 60, shape })).toBeNull();
  });

  // livehuddle's furniture-facing.md "A turn": each seat stays on its cushion in every drawing.
  it('turns the garden seats and the bean bag, each seat on its own cushion, its sitter turned with it', () => {
    const at = (
      shape: 'bench' | 'picnic-table' | 'hammock' | 'bean-bag',
      chairFacing: SeatFacing,
    ) => {
      const { view } = facingView(chairFacing);
      const grid = SEAT_VIEWS[shape][view];
      return seatPoints({ x: 0, y: 0, width: grid.width, height: grid.height, shape, chairFacing });
    };
    // A bench on its side seats its two one above the other, the left end's seat on top, facing its front.
    const left = at('bench', 'e');
    expect(left.map((s) => s.facing)).toEqual(['left', 'left']);
    expect(left[0]!.x).toBe(left[1]!.x);
    expect(left[0]!.y).toBeLessThan(left[1]!.y);
    const right = at('bench', 'w');
    expect(right.map((s) => s.facing)).toEqual(['right', 'right']);
    expect(right[0]!.x).toBeGreaterThan(left[0]!.x);
    // From behind its sitters face up, and its left seat is now on the right.
    const back = at('bench', 's');
    expect(back.map((s) => s.facing)).toEqual(['up', 'up']);
    expect(back[0]!.x).toBeGreaterThan(back[1]!.x);
    // A picnic table on its side: the far bench's diners on the right facing left, the near's on the left facing right.
    const picnic = at('picnic-table', 'e');
    expect(picnic.map((s) => s.facing)).toEqual([
      'left',
      'left',
      'left',
      'right',
      'right',
      'right',
    ]);
    expect(picnic[0]!.x).toBeGreaterThan(picnic[3]!.x);
    // From behind, the far bench's seats are the near bench's, in reverse.
    const picnicBack = at('picnic-table', 's');
    expect(picnicBack.slice(0, 3).map((s) => s.facing)).toEqual(['up', 'up', 'up']);
    expect(picnicBack[0]!.y).toBeGreaterThan(picnicBack[3]!.y);
    expect(picnicBack[0]!.x).toBeGreaterThan(picnicBack[2]!.x);
    // A hammock and a bean bag seat one, facing the way the piece faces.
    for (const shape of ['hammock', 'bean-bag'] as const)
      for (const [f, facing] of [
        ['n', 'down'],
        ['e', 'left'],
        ['s', 'up'],
        ['w', 'right'],
      ] as const)
        expect(
          at(shape, f).map((s) => s.facing),
          `${shape} ${f}`,
        ).toEqual([facing]);
    // On its side the hammock is long: its seat is in the middle of the sling, down the canvas.
    expect(SEAT_VIEWS.hammock.side.height).toBeGreaterThan(SEAT_VIEWS.hammock.side.width);
    expect(SEAT_VIEWS.hammock.back).toEqual(SEAT_VIEWS.hammock.front);
  });

  it('turns what blocks at the games tables with them: along their length when turned', () => {
    const pool = officeFootprint({
      x: 0,
      y: 0,
      width: 88,
      height: 240,
      shape: 'pool-table',
      chairFacing: 'e',
    })!;
    expect(pool.height).toBeGreaterThan(pool.width);
    const foos = officeFootprint({
      x: 0,
      y: 0,
      width: 84,
      height: 190,
      shape: 'foosball-table',
      chairFacing: 'w',
    })!;
    expect(foos.height).toBeGreaterThan(foos.width);
    // Mirrored, facing right: the cabinet's footprint mirrors across the box.
    const foosLeft = officeFootprint({
      x: 0,
      y: 0,
      width: 84,
      height: 190,
      shape: 'foosball-table',
      chairFacing: 'e',
    })!;
    expect(foos.x).toBeCloseTo(84 - (foosLeft.x + foosLeft.width));
    // From behind a table blocks where it does from the front.
    expect(
      officeFootprint({
        x: 0,
        y: 0,
        width: 200,
        height: 128,
        shape: 'pool-table',
        chairFacing: 's',
      }),
    ).toEqual(officeFootprint({ x: 0, y: 0, width: 200, height: 128, shape: 'pool-table' }));
  });
});
