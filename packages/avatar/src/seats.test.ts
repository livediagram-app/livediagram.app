import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SEATING_FACING,
  facingView,
  MEETING_TABLE_SEATS,
  nearestSeat,
  SEAT_GRIDS,
  SEAT_VIEWS,
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
      // Drawn from behind, their sitters facing up at what they use (furniture-facing.md "The camera").
      'bar-stool': 's',
      // The social pieces' fixed seats (livehuddle's docs/specs/009-elements/social-pieces.md).
      'ping-pong-table': 'n',
      bench: 'n',
      'picnic-table': 'n',
      hammock: 'n',
      'bean-bag': 'n',
      'reading-nook': 'n',
      // The workday pieces' seats (livehuddle's docs/specs/009-elements/workday-pieces.md).
      'nap-pod': 'n',
      treadmill: 's',
      'weight-bench': 'n',
      'phone-booth': 'n',
      'standing-desk': 's',
      'hot-desk': 's',
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

  it('turns its sitters with the table, every seat still facing it', () => {
    // livehuddle's docs/specs/009-elements/furniture-facing.md "A turn": a half turn faces each sitter the other way.
    expect(seatPoints({ ...table, chairFacing: 's' }).map((s) => s.facing)).toEqual([
      'up',
      'up',
      'down',
      'down',
      'left',
      'right',
    ]);
    // A quarter turn: the two beyond now sit at the right facing left; mirrored, at the left facing right.
    expect(seatPoints({ ...table, chairFacing: 'e' })[0]!.facing).toBe('left');
    expect(seatPoints({ ...table, chairFacing: 'w' })[0]!.facing).toBe('right');
  });

  it('carries each chair round with the table, every sitter at the table facing it', () => {
    // From behind: the two beyond are now the two in front, the ends swapped.
    const back = seatPoints({ ...table, chairFacing: 's' });
    expect(back[0]!.y).toBeGreaterThan(84);
    expect(back[2]!.y).toBeLessThan(84);
    expect(back[0]!.x).toBeGreaterThan(back[1]!.x);
    expect(back[4]!.x).toBeGreaterThan(back[5]!.x);
    // On its side, a tall table: the two beyond down its right facing left, the two in front down its left facing
    // right, the left end's chair at its top facing down and the right end's at its foot facing up.
    const tall = { x: 0, y: 0, width: 168, height: 232, shape: 'meeting-table' as const };
    const side = seatPoints({ ...tall, chairFacing: 'e' });
    expect(side.map((s) => s.facing)).toEqual(['left', 'left', 'right', 'right', 'down', 'up']);
    expect(side.slice(0, 2).every((s) => s.x > 120)).toBe(true);
    expect(side.slice(2, 4).every((s) => s.x < 48)).toBe(true);
    expect(side[0]!.y).toBeLessThan(side[1]!.y);
    expect(side[4]!.y).toBeLessThan(50);
    expect(side[5]!.y).toBeGreaterThan(170);
    // Facing right, the same table mirrored.
    const right = seatPoints({ ...tall, chairFacing: 'w' });
    expect(right.map((s) => s.facing)).toEqual(['right', 'right', 'left', 'left', 'down', 'up']);
    expect(right[0]!.x).toBeCloseTo(168 - side[0]!.x);
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
  it('seats one facing the bar, and turns its sitter with it', () => {
    const stool = { shape: 'bar-stool' as const, x: 0, y: 0, width: 44, height: 64 };
    expect(seatPoints(stool)).toEqual([{ x: 22, y: 25.6, facing: 'up' }]);
    expect(seatFor(stool, { x: 0, y: 100 }).facing).toBe('up');
    expect(seatingFacing(stool)).toBe('s');
    expect(seatPoints({ ...stool, chairFacing: 'n' })[0]!.facing).toBe('down');
    expect(seatPoints({ ...stool, chairFacing: 'e' })[0]!.facing).toBe('left');
    expect(seatPoints({ ...stool, chairFacing: 'w' })[0]!.facing).toBe('right');
  });
});

// docs/specs/009-elements/furniture-facing.md "A turn": seat i is the same cushion in every drawing, so every view of
// every kind has one spot per sitter facing.
describe('every seat view', () => {
  it('has as many seats as facings, in every drawing', () => {
    for (const [kind, views] of Object.entries(SEAT_VIEWS))
      for (const view of ['front', 'back', 'side'] as const)
        expect(views[view].seats.length, `${kind} ${view}`).toBe(views.facings.length);
  });
});
