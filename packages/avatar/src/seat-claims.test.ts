import { describe, expect, it } from 'vitest';
import {
  BESIDE_GAP,
  besideBox,
  claimBeats,
  claimOf,
  newSeatClaim,
  seatOnArrival,
  seatToYield,
  takenSeats,
  yieldFrom,
  type SeatHolder,
} from './seat-claims';
import { seatPoints } from './seats';

// livediagram's docs/specs/009-elements/chair.md "Sitting" and "Occupancy is presence"
const chair = { id: 'c', x: 0, y: 0, width: 64, height: 72, shape: 'chair' as const };
const sofa = { id: 's', x: 0, y: 0, width: 136, height: 76, shape: 'sofa' as const };
const table = { id: 't', x: 0, y: 0, width: 232, height: 168, shape: 'meeting-table' as const };
const [left, right] = seatPoints(sofa);

const sitter = (on: string, index: number, at: number, tie = 0.5): SeatHolder => ({
  x: 0,
  y: 0,
  seatedOn: on,
  seat: { index, at, tie },
});

describe('newSeatClaim', () => {
  it('claims the seat at this moment with a random tiebreak', () => {
    expect(newSeatClaim(1, 5, 0.5)).toEqual({ index: 1, at: 5, tie: 0.5 });
    const now = newSeatClaim(0);
    expect(now.at).toBeGreaterThan(0);
    expect(now.tie).toBeGreaterThanOrEqual(0);
    expect(now.tie).toBeLessThan(1);
  });
});

describe('claimOf', () => {
  it("reads a peer's own claim", () => {
    expect(claimOf(seatPoints(sofa), sitter('s', 1, 50, 0.2))).toEqual({
      index: 1,
      at: 50,
      tie: 0.2,
    });
  });

  it('gives an older client the seat nearest its feet, as the earliest claim', () => {
    expect(claimOf(seatPoints(sofa), { x: right!.x, y: right!.y, seatedOn: 's' })).toEqual({
      index: 1,
      at: 0,
      tie: 0,
    });
    expect(claimOf(seatPoints(sofa), { ...left!, seatedOn: 's', seat: null }).index).toBe(0);
  });

  it('reads a claim on a seat the piece does not have as the seat nearest the feet', () => {
    for (const index of [2, -1, 0.5]) {
      const holder = { ...right!, seatedOn: 's', seat: { index, at: 9, tie: 0 } };
      expect(claimOf(seatPoints(sofa), holder)).toEqual({ index: 1, at: 0, tie: 0 });
    }
  });
});

describe('takenSeats', () => {
  it('counts only the peers sitting on this piece', () => {
    const peers = [sitter('s', 1, 5), sitter('other', 0, 5), { x: 0, y: 0 }];
    expect([...takenSeats(sofa, peers)]).toEqual([1]);
  });
});

describe('claimBeats', () => {
  it('keeps the seat for whoever sat first', () => {
    expect(claimBeats({ index: 0, at: 1, tie: 0.9 }, { index: 0, at: 2, tie: 0.1 })).toBe(true);
    expect(claimBeats({ index: 0, at: 2, tie: 0.1 }, { index: 0, at: 1, tie: 0.9 })).toBe(false);
  });

  it('breaks a tie in time by the lower tiebreak, the same answer from both sides', () => {
    const a = { index: 0, at: 7, tie: 0.1 };
    const b = { index: 0, at: 7, tie: 0.2 };
    expect(claimBeats(a, b)).toBe(true);
    expect(claimBeats(b, a)).toBe(false);
  });
});

describe('besideBox', () => {
  const box = { x: 100, y: 100, width: 60, height: 80 };

  it('steps out of the edge nearest the point', () => {
    expect(besideBox(box, { x: 102, y: 140 })).toEqual({ x: 100 - BESIDE_GAP, y: 140 });
    expect(besideBox(box, { x: 158, y: 140 })).toEqual({ x: 160 + BESIDE_GAP, y: 140 });
    expect(besideBox(box, { x: 130, y: 101 })).toEqual({ x: 130, y: 100 - BESIDE_GAP });
    expect(besideBox(box, { x: 130, y: 179 })).toEqual({ x: 130, y: 180 + BESIDE_GAP });
  });

  it('steps straight out from a point already outside, at the gap asked for', () => {
    expect(besideBox(box, { x: 90, y: 400 }, 4)).toEqual({ x: 100, y: 184 });
  });
});

describe('seatOnArrival', () => {
  it('sits on the seat nearest where it arrived, facing away from the back', () => {
    expect(seatOnArrival(sofa, { x: 0, y: 40 }, [])).toEqual({
      sit: { x: left!.x, y: left!.y, facing: 'down', index: 0 },
    });
  });

  it("skips a taken cushion for the sofa's free one", () => {
    expect(seatOnArrival(sofa, { x: 0, y: 40 }, [sitter('s', 0, 1)])).toEqual({
      sit: { x: right!.x, y: right!.y, facing: 'down', index: 1 },
    });
  });

  it("faces a meeting table's seat the way the seat says", () => {
    const arrival = seatOnArrival(table, { x: 0, y: 72 }, []);
    expect(arrival).toMatchObject({ sit: { facing: 'right', index: 4 } });
  });

  it('stops beside a chair somebody sits in, and beside a full sofa', () => {
    expect(seatOnArrival(chair, { x: 2, y: 30 }, [sitter('c', 0, 1)])).toEqual({
      stopAt: { x: -BESIDE_GAP, y: 30 },
    });
    const full = [sitter('s', 0, 1), { ...right!, seatedOn: 's' }];
    expect(seatOnArrival(sofa, { x: 60, y: 74 }, full)).toEqual({
      stopAt: { x: 60, y: 76 + BESIDE_GAP },
    });
  });
});

describe('seatToYield', () => {
  const own = { index: 0, at: 100, tie: 0.5 };
  const yielded = besideBox(sofa, left!);

  it('stands the later of two sitters on one seat up beside it', () => {
    expect(seatToYield(sofa, own, [sitter('s', 0, 99)])).toEqual(yielded);
    expect(seatToYield(sofa, own, [sitter('s', 0, 100, 0.4)])).toEqual(yielded);
  });

  it('keeps the seat against a later claim, another seat or another piece', () => {
    expect(seatToYield(sofa, own, [sitter('s', 0, 101)])).toBeNull();
    expect(seatToYield(sofa, own, [sitter('s', 0, 100, 0.6)])).toBeNull();
    expect(seatToYield(sofa, own, [sitter('s', 1, 1)])).toBeNull();
    expect(seatToYield(sofa, own, [sitter('x', 0, 1), { x: 0, y: 0 }])).toBeNull();
  });

  it('gives way to an older client on our seat, which never gets up', () => {
    expect(seatToYield(sofa, own, [{ ...left!, seatedOn: 's' }])).toEqual(yielded);
  });

  it('keeps a seat the piece no longer has, which no claim can name', () => {
    expect(seatToYield(chair, { index: 3, at: 5, tie: 0 }, [sitter('c', 3, 1)])).toBeNull();
  });
});

describe('yieldFrom', () => {
  const board = [
    { id: 's', type: 'shape', shape: 'sofa', x: 0, y: 0, width: 136, height: 76 },
    { id: 'n', type: 'shape', shape: 'rectangle', x: 0, y: 0, width: 10, height: 10 },
    { id: 'k', type: 'sticky' },
  ];
  const own = { index: 0, at: 100, tie: 0.5 };
  const earlier = [sitter('s', 0, 1), sitter('n', 0, 1), sitter('k', 0, 1)];

  it('yields the seat we sit in to an earlier claim', () => {
    expect(yieldFrom(board, 's', own, earlier)).toEqual(besideBox(sofa, left!));
  });

  it('has nothing to give up standing, on a piece gone from the board or one that is not a seat', () => {
    expect(yieldFrom(board, null, own, earlier)).toBeNull();
    expect(yieldFrom(board, 's', null, earlier)).toBeNull();
    expect(yieldFrom(board, 'gone', own, earlier)).toBeNull();
    expect(yieldFrom(board, 'n', own, earlier)).toBeNull();
    expect(yieldFrom(board, 'k', own, earlier)).toBeNull();
  });
});
