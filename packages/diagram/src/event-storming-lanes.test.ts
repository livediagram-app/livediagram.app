import { describe, expect, it } from 'vitest';
import {
  activeTimeline,
  ES_LANE_GAP,
  ES_LANE_HEIGHT,
  ES_LANE_PITCH,
  ES_LANE_SNAP_Y,
  ES_CANDIDATE_RADIUS_X,
  ES_NOTE_GAP,
  initialTimelineOrigin,
  laneCentre,
  laneIndexAt,
  laneTop,
  captureCandidate,
  capturePlacement,
  laneCandidates,
  type LaneCandidate,
  snapToLane,
  visibleLaneIndices,
  type EsTimeline,
} from './event-storming-lanes';
import { ES_NOTE_SIZE_PX } from './event-storming';
import type { Element } from './index';

const T: EsTimeline = { originX: 0, originY: 0, enabled: true };
const OFFSET: EsTimeline = { originX: 37, originY: -114, enabled: true };

function note(over: Partial<Element> & { id: string }): Element {
  return {
    type: 'sticky',
    x: 0,
    y: 0,
    width: 200,
    height: 200,
    ...over,
  } as Element;
}

describe('lane geometry', () => {
  it('pitches one note plus a gap', () => {
    expect(ES_LANE_HEIGHT).toBe(ES_NOTE_SIZE_PX.square.height);
    expect(ES_LANE_PITCH).toBe(ES_LANE_HEIGHT + ES_LANE_GAP);
  });

  it('places lane 0 at the origin', () => {
    expect(laneTop(0, T)).toBe(0);
    expect(laneCentre(0, T)).toBe(ES_LANE_HEIGHT / 2);
    expect(laneTop(0, OFFSET)).toBe(OFFSET.originY);
  });

  it('stacks lanes in both directions', () => {
    expect(laneTop(3, T)).toBe(3 * ES_LANE_PITCH);
    expect(laneTop(-2, T)).toBe(-2 * ES_LANE_PITCH);
    expect(laneCentre(-1, OFFSET)).toBe(OFFSET.originY - ES_LANE_PITCH + ES_LANE_HEIGHT / 2);
  });

  it('round trips index -> centre -> index, negatives included', () => {
    for (const i of [-7, -1, 0, 1, 12]) {
      expect(laneIndexAt(laneCentre(i, T), T)).toBe(i);
      expect(laneIndexAt(laneCentre(i, OFFSET), OFFSET)).toBe(i);
    }
  });

  it('answers with the NEAREST lane for a y in the gap between two', () => {
    // The gap belongs to no lane, but a snap needs an answer: the nearest one.
    const gapTop = laneTop(0, T) + ES_LANE_HEIGHT;
    expect(laneIndexAt(gapTop + 1, T)).toBe(0);
    expect(laneIndexAt(gapTop + ES_LANE_GAP - 1, T)).toBe(1);
  });
});

describe('snapToLane', () => {
  const square = { width: 200, height: 200 };

  it('centres the note on the nearest lane', () => {
    const snap = snapToLane({ x: 0, y: 8, ...square }, T);
    expect(snap).not.toBeNull();
    expect(snap!.laneIndex).toBe(0);
    // Centred: a 200-tall note on a 200-tall lane sits flush at the lane top.
    expect(snap!.y).toBe(laneCentre(0, T) - 100);
  });

  it('centres SHORTER stationery on the lane rather than hanging it from the top', () => {
    for (const size of [ES_NOTE_SIZE_PX.wide, ES_NOTE_SIZE_PX.small]) {
      const centred = laneCentre(0, T) - size.height / 2;
      const snap = snapToLane({ x: 0, y: centred + 5, ...size }, T);
      expect(snap, `${size.height}`).not.toBeNull();
      expect(snap!.y, `${size.height}`).toBe(centred);
    }
  });

  it('leaves y alone beyond the threshold', () => {
    const farY = laneCentre(0, T) - 100 + ES_LANE_SNAP_Y + 1;
    expect(snapToLane({ x: 61, y: farY, ...square }, T)).toBeNull();
  });

  it('never touches x — a lane is a ROW, and x is the neighbours business', () => {
    // The whole defect this replaced: an absolute column lattice could only
    // express gaps that were multiples of half a note, so a row built with
    // the board's own 72px gutter could never be lined up with one above it.
    for (const x of [0, 37, 92, 271, -13]) {
      expect(snapToLane({ x, y: 4, ...square }, T)!.x, String(x)).toBe(x);
    }
  });

  it('snaps to negative lanes', () => {
    const snap = snapToLane({ x: -190, y: -ES_LANE_PITCH + 3, ...square }, T);
    expect(snap!.laneIndex).toBe(-1);
  });

  it('measures the stack from the origin', () => {
    const snap = snapToLane({ x: OFFSET.originX + 4, y: OFFSET.originY + 4, ...square }, OFFSET);
    expect(snap!.y).toBe(OFFSET.originY);
    expect(snap!.laneIndex).toBe(0);
  });
});

// THE PLACEMENT RULES (spec/139 Phase 6 "Placement rules"), stated by the
// operator and asserted here line by line — including the positions that must
// NOT be offered, which is where every round of this has gone wrong.
describe('the slots a lane offers', () => {
  const square = { width: 200, height: 200 };
  const GAP = ES_NOTE_GAP;
  const PITCH = 200 + GAP;
  const lone = [note({ id: 'first', x: 0, y: 0 })];
  const pair = [note({ id: 'left', x: 0, y: 0 }), note({ id: 'right', x: PITCH, y: 0 })];
  const inRow = (x: number) => ({ x, y: 0, ...square });
  const below = (x: number) => ({ x, y: ES_LANE_PITCH, ...square });
  const xs = (cs: LaneCandidate[], kind?: LaneCandidate['kind']) =>
    [...new Set(cs.filter((c) => !kind || c.kind === kind).map((c) => c.x))].sort((a, b) => a - b);

  describe('in the SAME lane', () => {
    it('offers the rhythm: right after with the gap, then one empty place on', () => {
      const cs = laneCandidates(inRow(400), lone);
      expect(xs(cs)).toContain(PITCH);
      expect(xs(cs)).toContain(2 * PITCH);
    });

    it('offers the same rhythm to the left', () => {
      const cs = laneCandidates(inRow(-400), lone);
      expect(xs(cs)).toContain(-PITCH);
      expect(xs(cs)).toContain(-2 * PITCH);
    });

    it('NEVER offers a touching position', () => {
      const cs = laneCandidates(inRow(210), lone);
      expect(xs(cs)).not.toContain(200);
      expect(xs(cs)).not.toContain(-200);
    });

    it('NEVER offers one gap plus one sticky — that is a note edge, not a slot', () => {
      // The operator's case: from the first note's right edge, gap + sticky
      // lands flush against where the next note ends. It is in no rhythm.
      const cs = laneCandidates(inRow(460), lone);
      expect(xs(cs)).not.toContain(200 + GAP + 200);
    });

    it('NEVER offers half a pitch in the same lane', () => {
      const cs = laneCandidates(inRow(136), lone);
      expect(xs(cs)).not.toContain(PITCH / 2);
      expect(xs(cs)).not.toContain(200 + GAP / 2);
    });

    it('never offers a slot that lands on a note already there', () => {
      // Between two notes a gutter apart there is no room: opening the row is
      // the Alt insertion, a different verb.
      const cs = laneCandidates(inRow(120), pair);
      expect(cs.every((c) => c.x <= -PITCH || c.x >= 2 * PITCH)).toBe(true);
    });
  });

  describe('in an ADJACENT lane', () => {
    it('offers exactly above or below a note', () => {
      expect(xs(laneCandidates(below(10), lone), 'aligned')).toContain(0);
    });

    it('offers exactly above or below a GAP, centred on it', () => {
      // The gap right of the lone note runs 200..216, centre 208: a 200-wide
      // note centred there starts at 108.
      expect(xs(laneCandidates(below(100), lone), 'staggered')).toContain(108);
    });

    it('gives the pair ONE brick between them, named by both notes', () => {
      const cs = laneCandidates(below(100), pair);
      expect(xs(cs, 'staggered')).toContain(108);
    });

    it('offers the DIAGONAL: one step along from the column, either way', () => {
      // A note in the lane above sitting diagonally against its neighbour,
      // still on the row's rhythm.
      const step = 200 + GAP;
      expect(xs(laneCandidates(below(step), lone), 'aligned')).toContain(step);
      expect(xs(laneCandidates(below(-step), lone), 'aligned')).toContain(-step);
    });

    it('offers exactly three columns and two bricks, and nothing else', () => {
      const step = 200 + GAP;
      const cs = laneCandidates(below(10), lone);
      expect(xs(cs, 'aligned')).toEqual([-step, 0, step]);
      expect(xs(cs, 'staggered')).toEqual([-108, 108]);
    });

    it('never offers same-lane rhythm slots from the row next door', () => {
      const cs = laneCandidates(below(10), lone);
      expect(xs(cs, 'gutter')).toEqual([]);
    });
  });

  describe('with nothing in reach', () => {
    it('offers nothing at all, so the note is free within its lane', () => {
      expect(laneCandidates(below(0), [note({ id: 'f', x: 0, y: 4 * ES_LANE_PITCH })])).toEqual([]);
      expect(laneCandidates(inRow(0), [])).toEqual([]);
    });
  });

  describe('stationery of different silhouettes', () => {
    const wide = { width: 300, height: 180 };
    const small = { width: 140, height: 140 };

    it('resumes the rhythm after a WIDE neighbour own right edge', () => {
      const wideNeighbour = [note({ id: 'w', x: 0, y: 0, width: 300, height: 180 })];
      const cs = laneCandidates({ x: 400, y: 0, ...square }, wideNeighbour);
      expect(xs(cs)).toContain(300 + GAP);
    });

    it('steps by a SQUARE note whatever is being placed — one row, one set of places', () => {
      const forSquare = xs(laneCandidates({ x: 400, y: 0, ...square }, lone));
      const forWide = xs(laneCandidates({ x: 400, y: 0, ...wide }, lone));
      const forSmall = xs(laneCandidates({ x: 400, y: 0, ...small }, lone));
      for (const list of [forSquare, forWide, forSmall]) {
        expect(list).toContain(200 + GAP);
        expect(list).toContain(200 + GAP + 200 + GAP);
      }
    });

    it('lines a different silhouette up on EITHER edge, and offers no brick', () => {
      // A 300-wide policy under a 200 square: left edge to left edge, or right
      // edge to right edge — each also one step along. No brick between the two.
      const step = 200 + GAP;
      const cs = laneCandidates({ x: 10, y: ES_LANE_PITCH, ...wide }, lone);
      expect(xs(cs, 'aligned')).toEqual(
        [-100 - step, -step, -100, 0, -100 + step, step].sort((a, b) => a - b),
      );
      expect(xs(cs, 'staggered')).toEqual([]);
    });

    it('offers the same two edges to a SMALL note', () => {
      const step = 200 + GAP;
      const cs = laneCandidates({ x: 10, y: ES_LANE_PITCH, ...small }, lone);
      expect(xs(cs, 'aligned')).toEqual(
        [-step, 60 - step, 0, 60, step, 60 + step].sort((a, b) => a - b),
      );
      expect(xs(cs, 'staggered')).toEqual([]);
    });

    it('keeps the brick for two notes of the same square silhouette', () => {
      const cs = laneCandidates(below(100), lone);
      expect(xs(cs, 'staggered')).toEqual([-108, 108]);
    });

    it('offers no brick between two WIDE notes — the brick is a square thing', () => {
      const wideNeighbour = [note({ id: 'w', x: 0, y: 0, width: 300, height: 180 })];
      const step = 200 + GAP;
      const cs = laneCandidates({ x: 10, y: ES_LANE_PITCH, ...wide }, wideNeighbour);
      expect(xs(cs, 'aligned')).toEqual([-step, 0, step]);
      expect(xs(cs, 'staggered')).toEqual([]);
    });
  });
});

describe('placing a note right behind another', () => {
  const GAP = ES_NOTE_GAP;
  const PITCH = 200 + GAP;
  const square = { width: 200, height: 200 };
  const row = [note({ id: 'a', x: 0, y: 0 }), note({ id: 'b', x: PITCH, y: 0 })];
  const place = (x: number) => capturePlacement({ x, y: 0, ...square }, row);

  it('resolves a note dropped ON TOP of its neighbour to the next slot', () => {
    // "As close behind as possible" overshoots: the hand ends up inside the
    // note before it, which is further from the next slot than the capture
    // radius. That is how a row came to have gaps of 4, 16 and 60px.
    expect(place(PITCH + 120)!.x).toBe(2 * PITCH);
    expect(place(PITCH + 60)!.x).toBe(2 * PITCH);
  });

  it('resolves an overlap to the slot on the side the note is leaning', () => {
    expect(place(-60)!.x).toBe(-PITCH);
  });

  it('still leaves a note alone in open space', () => {
    // Well clear of every slot this row offers, and touching nothing.
    expect(place(3000)).toBeNull();
  });

  it('never leaves a note lying on top of another', () => {
    for (let x = -199; x < 200; x += 7) {
      const placed = place(x);
      expect(placed, `dropped at ${x}`).not.toBeNull();
      const lands = placed!.x;
      const clashes = row.some(
        (r) => lands < (r as { x: number }).x + 200 && lands + 200 > (r as { x: number }).x,
      );
      expect(clashes, `dropped at ${x} landed at ${lands}`).toBe(false);
    }
  });
});

describe('capturing a suggested slot', () => {
  const square = { width: 200, height: 200 };
  const GAP = ES_NOTE_GAP;
  const pair = [note({ id: 'left', x: 0, y: 0 }), note({ id: 'right', x: 200 + GAP, y: 0 })];
  const capture = (x: number) =>
    captureCandidate(
      { x, y: ES_LANE_PITCH, ...square },
      laneCandidates({ x, y: ES_LANE_PITCH, ...square }, pair),
    );

  it('has a radius of half a standard note, so a slot is OFFERED not guessed', () => {
    expect(ES_CANDIDATE_RADIUS_X).toBe(100);
  });

  it('takes the note from up to half a note away', () => {
    // The outermost slot this row offers within reach; a hand 100px beyond it
    // is still captured, 101 is not.
    // One step past the right note of the pair, the furthest column it offers.
    const outer = 2 * (200 + GAP);
    expect(capture(outer + 100)!.x).toBe(outer);
    expect(capture(outer + 101)).toBeNull();
  });

  it('leaves the hand alone beyond the radius, in open space', () => {
    expect(capture(2000)).toBeNull();
  });

  it('takes the NEAREST candidate, whichever kind it is', () => {
    const stagger = (200 + GAP) / 2;
    expect(capture(stagger + 8)!.x).toBe(stagger);
    expect(capture(stagger + 8)!.kind).toBe('staggered');
    expect(capture(8)!.kind).toBe('aligned');
  });

  it('lets the note OWN ROW win over the row next door', () => {
    // A row of events being built, with a row below whose bricks fall between
    // this row's slots: the row's own rhythm takes the note, or the row comes
    // out irregular while its neighbour looks tidy.
    const ownRow = [note({ id: 'own', x: 0, y: 0 })];
    const nextDoor = [note({ id: 'below', x: 60, y: ES_LANE_PITCH })];
    const placed = capturePlacement({ x: 250, y: 0, width: 200, height: 200 }, [
      ...ownRow,
      ...nextDoor,
    ]);
    expect(placed!.kind).toBe('gutter');
    expect(placed!.x).toBe(200 + ES_NOTE_GAP);
  });

  it('still uses the row next door when this row has nothing to offer', () => {
    const nextDoor = [note({ id: 'below', x: 300, y: ES_LANE_PITCH })];
    const placed = capturePlacement({ x: 290, y: 0, width: 200, height: 200 }, nextDoor);
    expect(placed!.kind).toBe('aligned');
    expect(placed!.x).toBe(300);
  });

  it('ranks an edge and a stagger equally — distance decides', () => {
    // Between the aligned 0 and the brick at 108: the nearer wins, and nothing
    // about the KIND breaks the tie.
    expect(capture(40)!.x).toBe(0);
    expect(capture(70)!.x).toBe(108);
  });
});

describe('activeTimeline', () => {
  it('is null for a board that has never had lanes', () => {
    expect(activeTimeline({})).toBeNull();
    expect(activeTimeline(undefined)).toBeNull();
  });

  it('is null while lanes are switched off, even though the origin is remembered', () => {
    expect(
      activeTimeline({ esTimeline: { originX: 120, originY: 80, enabled: false } }),
    ).toBeNull();
  });

  it('is the stack itself while lanes are on', () => {
    const t = { originX: 120, originY: 80, enabled: true };
    expect(activeTimeline({ esTimeline: t })).toBe(t);
  });
});

describe('initialTimelineOrigin', () => {
  it('is the canvas origin on an empty board', () => {
    expect(initialTimelineOrigin([])).toEqual({ originX: 0, originY: 0, enabled: true });
  });

  it('takes the top-left corner of the top-most note', () => {
    const els = [
      note({ id: 'a', x: 500, y: 300 }),
      note({ id: 'b', x: 120, y: 80 }),
      note({ id: 'c', x: 900, y: 700 }),
    ];
    expect(initialTimelineOrigin(els)).toEqual({ originX: 120, originY: 80, enabled: true });
  });

  it('breaks a tie on the top edge with the left-most note', () => {
    const els = [note({ id: 'a', x: 500, y: 80 }), note({ id: 'b', x: 120, y: 80 })];
    expect(initialTimelineOrigin(els)).toEqual({ originX: 120, originY: 80, enabled: true });
  });

  it('ignores everything that is not a note', () => {
    const els = [
      { id: 's', type: 'shape', shape: 'square', x: 0, y: -900, width: 100, height: 100 },
      note({ id: 'b', x: 120, y: 80 }),
    ] as Element[];
    expect(initialTimelineOrigin(els)).toEqual({ originX: 120, originY: 80, enabled: true });
  });

  it('ignores notes the author cannot see', () => {
    const els = [note({ id: 'hidden', x: 0, y: -400 }), note({ id: 'b', x: 120, y: 80 })];
    expect(initialTimelineOrigin(els, new Set(['hidden']))).toEqual({
      originX: 120,
      originY: 80,
      enabled: true,
    });
  });

  it('falls back to the canvas origin when every note is hidden', () => {
    const els = [note({ id: 'hidden', x: 40, y: 40 })];
    expect(initialTimelineOrigin(els, new Set(['hidden']))).toEqual({
      originX: 0,
      originY: 0,
      enabled: true,
    });
  });
});

describe('visibleLaneIndices', () => {
  it('covers the viewport inclusively at both edges', () => {
    // Lane 0 spans 0..200, lane 1 spans 240..440.
    expect(visibleLaneIndices({ top: 0, bottom: 440 }, T)).toEqual([0, 1]);
    // Touching lane 1's top edge exactly still counts it in.
    expect(visibleLaneIndices({ top: 0, bottom: 240 }, T)).toEqual([0, 1]);
  });

  it('spans negative lanes', () => {
    expect(visibleLaneIndices({ top: -ES_LANE_PITCH, bottom: 10 }, T)).toEqual([-1, 0]);
  });

  it('returns a lane even when the viewport sits entirely in a gap', () => {
    expect(visibleLaneIndices({ top: 205, bottom: 235 }, T)).toEqual([]);
  });

  it('follows the origin', () => {
    expect(visibleLaneIndices({ top: OFFSET.originY, bottom: OFFSET.originY + 1 }, OFFSET)).toEqual(
      [0],
    );
  });
});
