import { describe, expect, it } from 'vitest';
import { boothInterior } from './booth';
import {
  isFixedSeatShape,
  isSceneryShape,
  isStandingSeatShape,
  officeFootprint,
  seatsACharacter,
} from './office-geometry';
import { pieceStatusOf, shownStatus } from './seat-status';
import { seatPoints } from './seats';

// livehuddle's docs/specs/009-elements/workday-pieces.md "How each one walks" and "Statuses a piece sets".
const SEATS = [
  ['nap-pod', 120, 112, 'down'],
  ['treadmill', 72, 112, 'up'],
  ['weight-bench', 136, 88, 'down'],
  ['phone-booth', 80, 136, 'down'],
  ['standing-desk', 112, 104, 'up'],
  ['hot-desk', 120, 112, 'up'],
] as const;

describe('the workday pieces', () => {
  it('seats one in each seat piece, facing the way the spec says, inside its box', () => {
    for (const [shape, width, height, facing] of SEATS) {
      expect(isFixedSeatShape(shape), shape).toBe(true);
      expect(seatsACharacter(shape), shape).toBe(true);
      const seats = seatPoints({ shape, x: 100, y: 50, width, height });
      expect(seats, shape).toHaveLength(1);
      expect(seats[0]!.facing, shape).toBe(facing);
      expect(seats[0]!.x).toBeGreaterThan(100);
      expect(seats[0]!.x).toBeLessThan(100 + width);
      expect(seats[0]!.y).toBeGreaterThan(50);
      expect(seats[0]!.y).toBeLessThan(50 + height);
    }
  });

  it('draws the treadmill and the standing desk standing, every other seat sitting', () => {
    expect(isStandingSeatShape('treadmill')).toBe(true);
    expect(isStandingSeatShape('standing-desk')).toBe(true);
    for (const shape of ['nap-pod', 'weight-bench', 'phone-booth', 'hot-desk', 'chair', 'desk'])
      expect(isStandingSeatShape(shape), shape).toBe(false);
  });

  it('blocks with the reception desk counter, full width, and the pet bed not at all', () => {
    const desk = officeFootprint({ shape: 'reception-desk', x: 0, y: 0, width: 200, height: 112 })!;
    expect(desk.x).toBeCloseTo(4);
    expect(desk.width).toBeCloseTo(192);
    expect(desk.y).toBeCloseTo(52);
    expect(desk.y + desk.height).toBeCloseTo(106);
    expect(isSceneryShape('reception-desk')).toBe(true);
    expect(isSceneryShape('pet-bed')).toBe(false);
    expect(seatsACharacter('pet-bed')).toBe(false);
    expect(officeFootprint({ shape: 'pet-bed', x: 0, y: 0, width: 72, height: 48 })).toBeNull();
  });

  it("holds the phone booth's seat inside its call, at any size", () => {
    for (const scale of [1, 2]) {
      const box = { x: 40, y: 20, width: 80 * scale, height: 136 * scale };
      const inside = boothInterior(box);
      const seat = seatPoints({ shape: 'phone-booth', ...box })[0]!;
      expect(seat.x).toBeGreaterThan(inside.x);
      expect(seat.x).toBeLessThan(inside.x + inside.width);
      expect(seat.y).toBeGreaterThan(inside.y);
      expect(seat.y).toBeLessThan(inside.y + inside.height);
      expect(inside.x).toBeGreaterThan(box.x);
      expect(inside.y + inside.height).toBeLessThan(box.y + box.height);
    }
  });
});

describe('the status a piece sets', () => {
  it('names Focusing for a nap pod, On a Break for the gym, Busy for a booth, none elsewhere', () => {
    expect(pieceStatusOf('nap-pod')).toBe('focus');
    expect(pieceStatusOf('treadmill')).toBe('break');
    expect(pieceStatusOf('weight-bench')).toBe('break');
    expect(pieceStatusOf('phone-booth')).toBe('busy');
    for (const kind of ['hot-desk', 'standing-desk', 'chair', '', null, undefined])
      expect(pieceStatusOf(kind)).toBeNull();
  });

  it("shows the piece's status while seated, over whatever you had, and yours again on standing", () => {
    expect(shownStatus('available', null, 'pod', 'focus')).toBe('focus');
    expect(shownStatus(null, null, 'pod', 'focus')).toBe('focus');
    // Standing up (or the piece gone, or one that sets none): your own, never lost.
    expect(shownStatus('available', null, null, 'focus')).toBe('available');
    expect(shownStatus('available', null, 'pod', null)).toBe('available');
  });

  it('lets a status picked while sitting win, None included, and not carry into another seat', () => {
    expect(shownStatus('meeting', 'pod', 'pod', 'focus')).toBe('meeting');
    expect(shownStatus(null, 'pod', 'pod', 'focus')).toBeNull();
    // Picked on one seat, now sitting on another: the new piece's status shows.
    expect(shownStatus('meeting', 'pod', 'treadmill', 'break')).toBe('break');
  });
});
