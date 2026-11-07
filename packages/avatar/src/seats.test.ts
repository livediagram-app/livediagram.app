import { describe, expect, it } from 'vitest';
import {
  LONG_TABLE_VARIANT,
  longTableGrid,
  longTableSideXs,
  DEFAULT_SEATING_FACING,
  facingView,
  MEETING_TABLE_SEATS,
  nearestSeat,
  SEAT_GRIDS,
  SEAT_SITTER_FACING,
  seatFor,
  seatingFacing,
  seatPoints,
} from './seats';

// livediagram's docs/specs/009-elements/chair.md "Seat point"
describe('facings', () => {
  it('shows the front, back or side, mirroring the side for facing right', () => {
    expect(facingView('n')).toEqual({ view: 'front', mirrored: false });
    expect(facingView('s')).toEqual({ view: 'back', mirrored: false });
    expect(facingView('e')).toEqual({ view: 'side', mirrored: false });
    expect(facingView('w')).toEqual({ view: 'side', mirrored: true });
  });

  it('faces a new desk at the computer and a chair and sofa at the reader', () => {
    expect(DEFAULT_SEATING_FACING).toEqual({
      chair: 'n',
      sofa: 'n',
      desk: 's',
      'meeting-table': 'n',
      'office-pod': 'n',
      'bar-stool': 'n',
      // The social pieces' fixed seats (livehuddle's docs/specs/009-elements/social-pieces.md).
      'ping-pong-table': 'n',
      bench: 'n',
      'picnic-table': 'n',
      hammock: 'n',
      'bean-bag': 'n',
      'reading-nook': 'n',
      // The workday pieces' seats (livehuddle's docs/specs/009-elements/workday-pieces.md).
      'nap-pod': 'n',
      treadmill: 'n',
      'weight-bench': 'n',
      'phone-booth': 'n',
      'standing-desk': 'n',
      'hot-desk': 'n',
    });
    expect(seatingFacing({ shape: 'desk' })).toBe('s');
    expect(seatingFacing({ shape: 'desk', chairFacing: 'e' })).toBe('e');
  });

  it('seats the sitter looking away from the back', () => {
    expect(SEAT_SITTER_FACING).toEqual({ n: 'down', e: 'left', s: 'up', w: 'right' });
  });
});

describe('seatPoints', () => {
  const box = { x: 0, y: 0, width: 152, height: 85 };

  it('seats a chair sitter on the seat, never on the backrest, at every facing', () => {
    const chair = { x: 100, y: 200, width: 80, height: 100, shape: 'chair' as const };
    // Facing you: below the middle, on the seat in front of the back.
    // On the drawing as drawn: the box is taller than the chair's grid, so the grid is letterboxed in it.
    const [seat] = seatPoints(chair);
    expect(seat!.x).toBe(140);
    expect(seat!.y).toBeCloseTo(260.8, 6);
    // Back to you: above the middle, beyond the backrest.
    expect(seatPoints({ ...chair, chairFacing: 's' })[0]!.y).toBeLessThan(250);
    // Facing left the backrest is on the right, so the seat is left of the middle; right mirrors it.
    const [left] = seatPoints({ ...chair, chairFacing: 'e' });
    const [right] = seatPoints({ ...chair, chairFacing: 'w' });
    expect(left!.x).toBeLessThan(140);
    expect(right!.x).toBeCloseTo(280 - left!.x, 6);
  });

  it('seats on the drawing where it is drawn, in a box of other proportions', () => {
    // A sofa turned on its side through an agent, its 152 x 85 box not swapped: the drawing is letterboxed to the
    // box's height and centred, so each seat lies on the drawn cushion, not at its share of the whole box.
    const { view: name, mirrored } = facingView('e');
    const view = SEAT_GRIDS.sofa[name];
    const scale = Math.min(box.width / view.width, box.height / view.height);
    const [dw, dh] = [view.width * scale, view.height * scale];
    const [dx, dy] = [(box.width - dw) / 2, (box.height - dh) / 2];
    const seats = seatPoints({ ...box, shape: 'sofa', chairFacing: 'e' });
    view.seats.forEach(({ u, v }, i) => {
      expect(seats[i]!.x).toBeCloseTo(dx + dw * (mirrored ? 1 - u : u), 6);
      expect(seats[i]!.y).toBeCloseTo(dy + dh * v, 6);
    });
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

// livediagram's docs/specs/009-elements/office.md "Meeting Table"
describe('the meeting table', () => {
  const table = { x: 0, y: 0, width: 232, height: 168, shape: 'meeting-table' as const };

  it('seats six, every seat facing the table', () => {
    const seats = seatPoints(table);
    expect(seats).toHaveLength(6);
    expect(seats.map((s) => s.facing)).toEqual(['down', 'down', 'up', 'up', 'right', 'left']);
    expect(MEETING_TABLE_SEATS.seats).toHaveLength(6);
  });

  it('seats you on the seat nearest where you arrived, facing the table', () => {
    expect(nearestSeat(table, { x: 230, y: 70 })).toMatchObject({ facing: 'left' });
    expect(nearestSeat(table, { x: 90, y: 0 })).toMatchObject({ facing: 'down' });
    expect(nearestSeat(table, { x: 150, y: 168 })).toMatchObject({ facing: 'up' });
  });

  it('never turns, whatever facing it carries', () => {
    expect(seatPoints({ ...table, chairFacing: 'w' })).toEqual(seatPoints(table));
  });
});

describe('seatFor', () => {
  it("faces a meeting-table sitter the seat's own way", () => {
    const table = { x: 0, y: 0, width: 232, height: 168, shape: 'meeting-table' as const };
    expect(seatFor(table, { x: 230, y: 70 })).toMatchObject({ facing: 'left' });
  });

  it('faces any other sitter away from the back, defaulting the facing by kind', () => {
    const desk = { x: 0, y: 0, width: 120, height: 112, shape: 'desk' as const };
    const [seat] = seatPoints(desk);
    expect(seatFor(desk, { x: 0, y: 0 })).toEqual({ x: seat!.x, y: seat!.y, facing: 'up' });
    const chair = {
      x: 0,
      y: 0,
      width: 64,
      height: 72,
      shape: 'chair' as const,
      chairFacing: 'e' as const,
    };
    expect(seatFor(chair, { x: 0, y: 0 }).facing).toBe('left');
  });
});

// livehuddle's docs/specs/009-elements/office.md "Bar, Bar Stool".
describe('the bar stool', () => {
  it('seats one facing the bar, whatever facing it carries', () => {
    const stool = { shape: 'bar-stool' as const, x: 0, y: 0, width: 44, height: 64 };
    expect(seatPoints(stool)).toEqual([{ x: 22, y: 25.6, facing: 'up' }]);
    expect(seatPoints({ ...stool, chairFacing: 'e' })).toEqual(seatPoints(stool));
    expect(seatFor(stool, { x: 0, y: 100 }).facing).toBe('up');
    expect(seatingFacing(stool)).toBe('n');
  });
});

// livehuddle's office.md "Long Table": the Meeting Table's long type, seated along its width.
describe('a long table', () => {
  it('seats both sides as many as fit 60 apart, and one at each end, every seat facing it', () => {
    expect(longTableSideXs(560)).toHaveLength(7);
    expect(longTableSideXs(232)).toHaveLength(2);
    expect(longTableSideXs(100)).toHaveLength(2);
    const seats = seatPoints({
      shape: 'meeting-table',
      x: 0,
      y: 0,
      width: 560,
      height: 168,
      variant: LONG_TABLE_VARIANT,
    });
    expect(seats).toHaveLength(16);
    expect(seats.filter((s) => s.facing === 'down')).toHaveLength(7);
    expect(seats.filter((s) => s.facing === 'up')).toHaveLength(7);
    expect(seats.at(-2)).toMatchObject({ x: 21, y: 72, facing: 'right' });
    expect(seats.at(-1)).toMatchObject({ x: 539, y: 72, facing: 'left' });
    expect(seats[0]).toMatchObject({ x: 86, y: 40 });
  });

  it('fills a box of other proportions as wide as its depth allows', () => {
    // Twice as deep: the drawing is 280 wide at that depth's scale, so fewer chairs, each where it is drawn.
    const grid = longTableGrid(560, 336);
    expect(grid.width).toBe(280);
    const box = { shape: 'meeting-table' as const, x: 0, y: 0, width: 560, height: 336 };
    expect(seatPoints({ ...box, variant: 'long' })).toHaveLength(grid.seats.length);
    // A Meeting Table of no type keeps its six.
    expect(seatPoints({ ...box, width: 232, height: 168 })).toHaveLength(6);
  });
});
