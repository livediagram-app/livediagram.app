import { describe, expect, it } from 'vitest';
import {
  SEAT_PILL_GAP,
  sameSitterList,
  sameSitters,
  seatedPeer,
  seatPillBottom,
  seatsOnBoard,
  sittersByChair,
  type SitterSource,
} from './chair-sitters';
import { avatarScale } from './config';
import { MEETING_TABLE_SEATS, SEAT_GRIDS, seatPoints } from './seats';
import { AVATAR_HEAD_CHROME, AVATAR_HEIGHT } from './walk';

// docs/specs/008-canvas/avatar-mode.md and docs/specs/009-elements/chair.md "Occupancy is presence": who sits in each
// chair, on which seat, from presence; and where the piece marks them.

const you = (seatedOn: string | null, color = '#f00', extra: Partial<SitterSource> = {}) => ({
  name: 'You',
  color,
  seatedOn,
  ...extra,
});

describe('sittersByChair', () => {
  // docs/specs/009-elements/chair.md "A table that loses seats": a sitter on a seat the table lost is left off it.
  it('leaves off a sitter whose seat the table has lost, and moves a remaining one to its seat', () => {
    const table = { id: 't', x: 0, y: 0, width: 232, height: 168, shape: 'meeting-table' as const };
    const seats = seatPoints(table);
    const map = sittersByChair(
      null,
      [
        { name: 'Gone', color: '#0f0', seatedOn: 't', seat: { index: 5, at: 1, tie: 0, of: 16 } },
        { name: 'End', color: '#00f', seatedOn: 't', seat: { index: 14, at: 1, tie: 0, of: 16 } },
      ],
      (id) => (id === 't' ? seats : null),
    );
    expect(map.get('t')).toEqual([{ name: 'End', color: '#00f', seat: 4 }]);
  });

  it('lists our own character and every seated peer by chair', () => {
    const map = sittersByChair(you('c1'), [
      { name: 'Ann', color: '#0f0', seatedOn: 'c1' },
      { name: 'Bo', color: '#00f', seatedOn: null },
    ]);
    expect(map.get('c1')).toEqual([
      { name: 'You', color: '#f00' },
      { name: 'Ann', color: '#0f0' },
    ]);
    expect(map.size).toBe(1);
    expect(sittersByChair(null, []).size).toBe(0);
  });

  const sofa = {
    id: 'sofa',
    type: 'shape',
    shape: 'sofa' as const,
    x: 0,
    y: 0,
    width: 136,
    height: 76,
  };
  const [left, right] = seatPoints(sofa);

  it('puts each sitter on the seat they hold, in seat order, with their size', () => {
    const map = sittersByChair(
      you('sofa', '#f00', { seat: { index: 1, at: 1, tie: 0 }, scale: 1.95 }),
      [{ name: 'Ann', color: '#0f0', seatedOn: 'sofa', seat: { index: 0, at: 2, tie: 0 } }],
      seatsOnBoard([sofa]),
    );
    expect(map.get('sofa')).toEqual([
      { name: 'Ann', color: '#0f0', seat: 0 },
      { name: 'You', color: '#f00', seat: 1, scale: 1.95 },
    ]);
  });

  it("takes an older client's seat (no claim, or one the piece lacks) as the one nearest its feet", () => {
    const map = sittersByChair(
      null,
      [
        { name: 'Old', color: '#0f0', seatedOn: 'sofa', x: right!.x, y: right!.y },
        { name: 'Odd', color: '#00f', seatedOn: 'sofa', seat: { index: 9, at: 1, tie: 0 } },
      ],
      seatsOnBoard([sofa]),
    );
    expect(map.get('sofa')!.map((s) => [s.name, s.seat])).toEqual([
      ['Odd', 0],
      ['Old', 1],
    ]);
    expect(left).toBeDefined();
  });

  it('keeps only the claim for a piece the board lacks, and sorts a sitter without a seat last', () => {
    const seatsOf = seatsOnBoard([sofa, { id: 'note', type: 'text' }]);
    const map = sittersByChair(
      you('gone', '#f00', { seat: { index: 2, at: 1, tie: 0 } }),
      [
        { name: 'Ann', color: '#0f0', seatedOn: 'gone' },
        { name: 'Bo', color: '#00f', seatedOn: 'note', seat: { index: 0, at: 1, tie: 0 } },
        { name: 'Cy', color: '#0ff', seatedOn: 'note' },
      ],
      seatsOf,
    );
    expect(map.get('gone')).toEqual([
      { name: 'You', color: '#f00', seat: 2 },
      { name: 'Ann', color: '#0f0' },
    ]);
    expect(map.get('note')!.map((s) => s.name)).toEqual(['Bo', 'Cy']);
    // Worked out once and kept.
    expect(seatsOf('sofa')).toBe(seatsOf('sofa'));
    expect(seatsOf('note')).toBeNull();
  });
});

describe('seatedPeer', () => {
  it('reads a seated peer whole, their size from their costume', () => {
    const seat = { index: 1, at: 5, tie: 0.5 };
    expect(
      seatedPeer({
        name: 'Ann',
        color: '#0f0',
        avatar: { x: 3, y: 4, seatedOn: 'sofa', seat, config: { size: 'tall' } },
      }),
    ).toEqual({
      name: 'Ann',
      color: '#0f0',
      seatedOn: 'sofa',
      seat,
      x: 3,
      y: 4,
      scale: avatarScale('tall'),
    });
  });

  it('leaves a standing peer at their name and colour', () => {
    expect(seatedPeer({ name: 'Bo', color: '#00f', avatar: { x: 0, y: 0 } })).toEqual({
      name: 'Bo',
      color: '#00f',
    });
  });
});

describe('sameSitterList', () => {
  it('compares one chair: the same people in order, or not', () => {
    const ada = { name: 'Ada', color: '#f00' };
    expect(sameSitterList([ada], [{ ...ada }])).toBe(true);
    expect(sameSitterList([ada], [])).toBe(false);
    expect(sameSitterList([ada], [{ ...ada, seat: 2 }])).toBe(false);
  });
});

describe('sameSitters', () => {
  it('is equal when every chair holds the same sitters, however the maps were built', () => {
    expect(sameSitters(sittersByChair(you(null), []), sittersByChair(you(null, '#0f0'), []))).toBe(
      true,
    );
    expect(
      sameSitters(
        sittersByChair(you('c1'), []),
        sittersByChair(you('c1'), [{ name: 'Ann', color: '#0f0', seatedOn: null }]),
      ),
    ).toBe(true);
  });

  it('differs when a sitter arrives, leaves, changes colour, seat or size', () => {
    const one = sittersByChair(you('c1'), []);
    expect(sameSitters(one, sittersByChair(you(null), []))).toBe(false);
    expect(sameSitters(one, sittersByChair(you('c1', '#0f0'), []))).toBe(false);
    expect(sameSitters(one, sittersByChair(you('c2'), []))).toBe(false);
    expect(
      sameSitters(
        one,
        sittersByChair(you('c1', '#f00', { seat: { index: 1, at: 0, tie: 0 } }), []),
      ),
    ).toBe(false);
    expect(sameSitters(one, sittersByChair(you('c1', '#f00', { scale: 2 }), []))).toBe(false);
    expect(
      sameSitters(one, sittersByChair(you('c1'), [{ name: 'Ann', color: '#0f0', seatedOn: 'c1' }])),
    ).toBe(false);
  });
});

describe('seatPillBottom', () => {
  const chair = SEAT_GRIDS.chair.front;
  const box = { x: 100, y: 200, width: 64, height: 72 };
  const feet = 0.62 * 72;
  const headroom = (scale: number) => AVATAR_HEIGHT * scale + AVATAR_HEAD_CHROME;

  it("lifts the pill clear of the sitter's head and the chip over it", () => {
    const bottom = seatPillBottom(box, chair, [{ seat: 0, scale: 1.5 }]);
    expect(bottom).toBeCloseTo(feet - headroom(1.5) - SEAT_PILL_GAP);
    expect(bottom).toBeLessThan(-SEAT_PILL_GAP);
  });

  it('rises with a taller character, and takes Regular for a sitter without a size', () => {
    const tall = seatPillBottom(box, chair, [{ seat: 0, scale: avatarScale('tall') }]);
    const regular = seatPillBottom(box, chair, [{ seat: 0 }]);
    expect(tall).toBeLessThan(regular);
    expect(regular).toBeCloseTo(feet - headroom(avatarScale('regular')) - SEAT_PILL_GAP);
  });

  it('clears the highest head of several, from each seat in the drawn (letterboxed) drawing', () => {
    // A meeting table drawn twice as wide as its grid: the drawing is centred, full height.
    const table = { x: 0, y: 0, width: 464, height: 168 };
    const far = seatPillBottom(table, MEETING_TABLE_SEATS, [{ seat: 2 }, { seat: 0 }]);
    expect(far).toBeCloseTo(40 - headroom(avatarScale('regular')) - SEAT_PILL_GAP);
    // Squashed into a box half its height, every seat point rises with the smaller drawing.
    const squat = seatPillBottom({ ...table, height: 84 }, MEETING_TABLE_SEATS, [{ seat: 0 }]);
    expect(squat).toBeCloseTo(20 - headroom(avatarScale('regular')) - SEAT_PILL_GAP);
  });

  it("never sits lower than the piece's top, and takes a seat the drawing lacks as its first", () => {
    const deep = { width: 64, height: 400, seats: [{ u: 0.5, v: 0.95 }] };
    expect(seatPillBottom({ x: 0, y: 0, width: 64, height: 400 }, deep, [{ seat: 0 }])).toBe(
      -SEAT_PILL_GAP,
    );
    expect(seatPillBottom(box, chair, [{ seat: 5 }])).toBe(seatPillBottom(box, chair, [{}]));
    expect(seatPillBottom(box, { width: 10, height: 10, seats: [] }, [{ seat: 0 }])).toBe(
      -SEAT_PILL_GAP,
    );
  });
});
