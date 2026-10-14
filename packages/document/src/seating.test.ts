import { describe, expect, it } from 'vitest';
import { createShape } from './shape-factory';
import {
  DEFAULT_SEATING_FACING,
  CHAIR_ART,
  DESK_ART,
  facingSwapsBox,
  facingView,
  FURNITURE_ART,
  furnitureRing,
  facingTurn,
  furnitureFrame,
  furnitureParts,
  isSeatingShape,
  nearestSeat,
  seatingFacing,
  seatPoints,
  SOFA_ART,
  turnedSeatingBox,
} from './seating';

// docs/specs/009-elements/chair.md "Desk and sofa"
describe('seating kinds', () => {
  it('are the chair, the desk and the sofa', () => {
    expect(['chair', 'desk', 'sofa'].every(isSeatingShape)).toBe(true);
    expect(isSeatingShape('fence')).toBe(false);
  });

  it('a new desk faces its sitter at the computer; a sofa faces the reader', () => {
    expect(createShape('desk', 0, 0).chairFacing).toBe('s');
    expect(createShape('sofa', 0, 0).chairFacing).toBe('n');
    expect(DEFAULT_SEATING_FACING.chair).toBe('n');
  });

  it('a new desk and sofa keep the proportions of their drawings', () => {
    for (const [kind, art] of [
      ['desk', DESK_ART],
      ['sofa', SOFA_ART],
    ] as const) {
      const el = createShape(kind, 0, 0);
      const view = kind === 'desk' ? art.back : art.front;
      expect(el.width / el.height).toBeCloseTo(view.width / view.height, 2);
      expect(el.aspectLocked).toBe(true);
    }
  });
});

describe('seatPoints', () => {
  const box = { x: 0, y: 0, width: 152, height: 85 };

  it('seats a chair sitter on the seat, never on the backrest, at every facing', () => {
    const chair = { x: 100, y: 200, width: 80, height: 100, shape: 'chair' as const };
    // Facing you: below the middle, on the seat in front of the back.
    expect(seatPoints(chair)).toEqual([{ x: 140, y: 262 }]);
    // Back to you: above the middle, beyond the backrest.
    expect(seatPoints({ ...chair, chairFacing: 's' })[0]!.y).toBeLessThan(250);
    // Facing left the backrest is on the right, so the seat is left of the middle; right mirrors it.
    const [left] = seatPoints({ ...chair, chairFacing: 'e' });
    const [right] = seatPoints({ ...chair, chairFacing: 'w' });
    expect(left!.x).toBeLessThan(140);
    expect(right!.x).toBeCloseTo(280 - left!.x, 6);
  });

  it('gives the sofa two seats, side by side', () => {
    const [left, right] = seatPoints({ ...box, shape: 'sofa' });
    expect(left!.y).toBeCloseTo(right!.y, 6);
    expect(left!.x).toBeLessThan(76);
    expect(right!.x).toBeGreaterThan(76);
  });

  it('turns the seats with the facing', () => {
    // On its side the box is tall, and the two seats stack down it.
    const tall = { x: 0, y: 0, width: 85, height: 152 };
    const [first, second] = seatPoints({ ...tall, shape: 'sofa', chairFacing: 'e' });
    expect(first!.x).toBeCloseTo(second!.x, 6);
    expect(first!.y).not.toBeCloseTo(second!.y, 0);
  });

  it('seats the desk sitter in front of the desk, below its middle when facing up', () => {
    const [seat] = seatPoints({ x: 0, y: 0, width: 120, height: 112, shape: 'desk' });
    expect(seat!.x).toBe(60);
    expect(seat!.y).toBeGreaterThan(56);
  });
});

describe('nearestSeat', () => {
  it('seats you on the sofa cushion on your side', () => {
    const sofa = { x: 0, y: 0, width: 152, height: 85, shape: 'sofa' as const };
    const [left, right] = seatPoints(sofa);
    expect(nearestSeat(sofa, { x: 10, y: 40 })).toEqual(left);
    expect(nearestSeat(sofa, { x: 140, y: 40 })).toEqual(right);
  });
});

describe('turning', () => {
  it('measures the clockwise turn between facings', () => {
    expect(facingTurn('n', 'e')).toBe(90);
    expect(facingTurn('s', 'n')).toBe(180);
    expect(facingTurn('n', 'w')).toBe(270);
    expect(facingSwapsBox('n', 's')).toBe(false);
    expect(facingSwapsBox('s', 'w')).toBe(true);
  });

  it('swaps a desk or sofa box about its centre on a quarter turn, never a chair', () => {
    const sofa = { x: 0, y: 0, width: 152, height: 86, shape: 'sofa' as const };
    expect(turnedSeatingBox(sofa, 'n', 'e')).toEqual({ x: 33, y: -33, width: 86, height: 152 });
    expect(turnedSeatingBox(sofa, 'n', 's')).toMatchObject({ width: 152, height: 86 });
    const chair = { x: 0, y: 0, width: 76, height: 84, shape: 'chair' as const };
    expect(turnedSeatingBox(chair, 'n', 'e')).toMatchObject({ width: 76, height: 84 });
  });

  it('shows a drawing per facing, never a rotation (docs/specs/009-elements/chair.md "Facing")', () => {
    expect(facingView('n')).toEqual({ view: 'front', mirrored: false });
    expect(facingView('s')).toEqual({ view: 'back', mirrored: false });
    expect(facingView('e')).toEqual({ view: 'side', mirrored: false });
    expect(facingView('w')).toEqual({ view: 'side', mirrored: true });
    for (const art of Object.values(FURNITURE_ART))
      for (const facing of ['n', 'e', 's', 'w'] as const)
        expect(furnitureFrame(art, facing).transform).not.toMatch(/rotate/);
    expect(furnitureFrame(SOFA_ART, 'n')).toMatchObject({ viewBox: '0 0 136 76', transform: '' });
    expect(furnitureFrame(SOFA_ART, 'w').transform).toBe('translate(76 0) scale(-1 1)');
  });

  it('keeps every piece standing: a shadow under it in every drawing', () => {
    for (const art of Object.values(FURNITURE_ART))
      for (const facing of ['n', 'e', 's', 'w'] as const) {
        const { view } = furnitureFrame(art, facing);
        const shadows = furnitureParts(art, facing).flatMap((p) =>
          p.role === 'shadow' && p.tag === 'ellipse' ? [p.cy] : [],
        );
        // The lowest shadow is in the lowest fifth of the drawing: the piece stands on it.
        expect(Math.max(...shadows) / view.height).toBeGreaterThan(0.8);
      }
  });

  it('gives a side view the footprint of a quarter turn, so the box swap fits it', () => {
    for (const art of [DESK_ART, SOFA_ART]) {
      expect(art.side.width).toBe(art.front.height);
      expect(art.side.height).toBe(art.front.width);
      expect([art.back.width, art.back.height]).toEqual([art.front.width, art.front.height]);
    }
    expect([CHAIR_ART.side.width, CHAIR_ART.side.height]).toEqual([64, 72]);
  });

  it('puts every seat inside its drawing, and the ring round it, mirrored for facing right', () => {
    for (const art of Object.values(FURNITURE_ART))
      for (const view of [art.front, art.back, art.side])
        for (const { u, v } of view.seats) {
          expect(u).toBeGreaterThan(0);
          expect(u).toBeLessThan(1);
          expect(v).toBeGreaterThan(0);
          expect(v).toBeLessThan(1);
        }
    expect(furnitureRing(SOFA_ART, 'w').cx).toBe(76 - SOFA_ART.side.ring.cx);
    expect(furnitureRing(SOFA_ART, 'e')).toEqual(SOFA_ART.side.ring);
  });

  it('reads the facing a desk was made with when none is stored', () => {
    expect(seatingFacing({ shape: 'desk' })).toBe('s');
    expect(seatingFacing({ shape: 'desk', chairFacing: 'e' })).toBe('e');
  });
});
