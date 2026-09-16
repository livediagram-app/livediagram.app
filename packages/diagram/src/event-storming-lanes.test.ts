import { describe, expect, it } from 'vitest';
import {
  activeTimeline,
  ES_LANE_GAP,
  ES_LANE_HEIGHT,
  ES_LANE_PITCH,
  ES_LANE_SNAP_Y,
  ES_NOTE_GAP,
  initialTimelineOrigin,
  laneCentre,
  laneIndexAt,
  laneTop,
  prevailingNoteGap,
  snapToLane,
  snapToNeighbours,
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

describe('the gutter between notes', () => {
  const square = { width: 200, height: 200 };
  // A row as the template and the insertion ripple actually build it.
  const row = [note({ id: 'a', x: 0, y: 0 }), note({ id: 'b', x: 200 + ES_NOTE_GAP, y: 0 })];

  it('is the board OWN gap, which the template and the ripple already use', () => {
    expect(ES_NOTE_GAP).toBe(72);
  });

  it('measures what a board actually does rather than assuming', () => {
    const tight = [note({ id: 'a', x: 0, y: 0 }), note({ id: 'b', x: 240, y: 0 })];
    expect(prevailingNoteGap(tight)).toBe(40);
  });

  it('falls back to the board gap when there is nothing to measure', () => {
    expect(prevailingNoteGap([])).toBe(ES_NOTE_GAP);
    expect(prevailingNoteGap([note({ id: 'a', x: 0, y: 0 })])).toBe(ES_NOTE_GAP);
  });

  it('ignores notes that overlap or touch — a seam is not a gap', () => {
    const docked = [note({ id: 'a', x: 0, y: 0 }), note({ id: 'b', x: 200, y: 0 })];
    expect(prevailingNoteGap(docked)).toBe(ES_NOTE_GAP);
  });

  it('never counts a DOCK SEAM as a gutter — a seam is a join', () => {
    const pair = [
      note({ id: 'host', x: 300, y: 0 }),
      note({ id: 'cmd', x: 300 - 16 - 200, y: 0, esDock: { hostId: 'host', side: 'before' } }),
      note({ id: 'host2', x: 2000, y: 0 }),
      note({ id: 'cmd2', x: 2000 - 16 - 200, y: 0, esDock: { hostId: 'host2', side: 'before' } }),
      // A real gutter elsewhere on the board, so there IS something to measure.
      note({ id: 'far', x: 1000, y: 0 }),
      note({ id: 'far2', x: 1000 + 200 + 40, y: 0 }),
    ];
    expect(prevailingNoteGap(pair)).toBe(40);
  });

  it('only measures notes that share a row', () => {
    const stacked = [note({ id: 'a', x: 0, y: 0 }), note({ id: 'b', x: 300, y: 400 })];
    expect(prevailingNoteGap(stacked)).toBe(ES_NOTE_GAP);
  });

  it('places a note one gutter to the RIGHT of the one it is dropped beside', () => {
    const snap = snapToNeighbours({ x: 200 + ES_NOTE_GAP + 6, y: 0, ...square }, row.slice(0, 1), {
      gap: ES_NOTE_GAP,
    });
    expect(snap!.x).toBe(200 + ES_NOTE_GAP);
    expect(snap!.reason).toBe('gutter');
  });

  it('places a note one gutter to the LEFT', () => {
    const snap = snapToNeighbours({ x: -200 - ES_NOTE_GAP - 5, y: 0, ...square }, row.slice(0, 1), {
      gap: ES_NOTE_GAP,
    });
    expect(snap!.x).toBe(-200 - ES_NOTE_GAP);
  });

  it('lines a note up with the LEFT EDGE of one in another row — the operators case', () => {
    // The note below sits at the board's own rhythm; a note dragged near it
    // in the lane above must be able to land exactly above it.
    const below = note({ id: 'b', x: 200 + ES_NOTE_GAP, y: ES_LANE_PITCH });
    const snap = snapToNeighbours({ x: 200 + ES_NOTE_GAP + 5, y: 0, ...square }, [below], {
      gap: ES_NOTE_GAP,
    });
    expect(snap!.x).toBe(200 + ES_NOTE_GAP);
    expect(snap!.reason).toBe('edge');
  });

  it('lines up RIGHT edges too, so a wide note can close a column', () => {
    const below = note({ id: 'b', x: 100, y: ES_LANE_PITCH, width: 300 });
    // A 200 square whose right edge is near the wide note's right edge (400).
    const snap = snapToNeighbours({ x: 196, y: 0, ...square }, [below], { gap: ES_NOTE_GAP });
    expect(snap!.x).toBe(200);
  });

  it('prefers an EDGE to a gutter when both are in reach', () => {
    // Aligning with a column that exists beats inventing a new gap beside it.
    const beside = note({ id: 'a', x: 0, y: 0 });
    const below = note({ id: 'b', x: 200 + ES_NOTE_GAP + 3, y: ES_LANE_PITCH });
    const snap = snapToNeighbours({ x: 200 + ES_NOTE_GAP + 2, y: 0, ...square }, [beside, below], {
      gap: ES_NOTE_GAP,
    });
    expect(snap!.reason).toBe('edge');
    expect(snap!.x).toBe(200 + ES_NOTE_GAP + 3);
  });

  it('leaves a note alone in open space — lanes are an aid, not a cage', () => {
    expect(snapToNeighbours({ x: 900, y: 0, ...square }, row, { gap: ES_NOTE_GAP })).toBeNull();
  });

  it('ignores the notes being dragged', () => {
    const snap = snapToNeighbours({ x: 6, y: 0, ...square }, row, {
      gap: ES_NOTE_GAP,
      exclude: new Set(['a', 'b']),
    });
    expect(snap).toBeNull();
  });

  it('only considers notes within reach vertically, so a far row cannot pull x', () => {
    const faraway = note({ id: 'b', x: 4, y: 12 * ES_LANE_PITCH });
    expect(snapToNeighbours({ x: 0, y: 0, ...square }, [faraway], { gap: ES_NOTE_GAP })).toBeNull();
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
