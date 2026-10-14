import { describe, expect, it } from 'vitest';
import { chairSeatPoint } from './collab-shapes';
import { createShape } from './shape-factory';
import {
  DEFAULT_SEATING_FACING,
  DESK_ART,
  facingSwapsBox,
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
      expect(el.width / el.height).toBeCloseTo(art.width / art.height, 2);
      expect(el.aspectLocked).toBe(true);
    }
  });
});

describe('seatPoints', () => {
  const box = { x: 0, y: 0, width: 152, height: 85 };

  it('gives the chair its one seat point, unchanged', () => {
    const chair = { ...box, shape: 'chair' as const, chairFacing: 'e' as const };
    expect(seatPoints(chair)).toEqual([chairSeatPoint(chair, 'e')]);
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

  it('frames the turned drawing with its sides swapped on a quarter turn', () => {
    expect(furnitureFrame(SOFA_ART, 'n')).toEqual({ viewBox: '0 0 136 76', transform: '' });
    expect(furnitureFrame(SOFA_ART, 'e').viewBox).toBe('0 0 76 136');
    expect(furnitureFrame(DESK_ART, 'n').transform).toContain('rotate(180)');
  });

  it('drops the contact shadows from a turned piece', () => {
    expect(furnitureParts(SOFA_ART, 'n').some((p) => p.role === 'shadow')).toBe(true);
    expect(furnitureParts(SOFA_ART, 'e').some((p) => p.role === 'shadow')).toBe(false);
  });

  it('reads the facing a desk was made with when none is stored', () => {
    expect(seatingFacing({ shape: 'desk' })).toBe('s');
    expect(seatingFacing({ shape: 'desk', chairFacing: 'e' })).toBe('e');
  });
});
