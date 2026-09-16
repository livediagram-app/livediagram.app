import { describe, expect, it } from 'vitest';
import {
  activeTimeline,
  ES_GRID_CELL,
  ES_LANE_GAP,
  ES_LANE_HEIGHT,
  ES_LANE_PITCH,
  ES_LANE_SNAP_X,
  ES_LANE_SNAP_Y,
  initialTimelineOrigin,
  laneCentre,
  laneIndexAt,
  laneTop,
  snapToLanes,
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
    expect(ES_GRID_CELL).toBe(ES_NOTE_SIZE_PX.square.width / 2);
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

describe('snapToLanes', () => {
  const square = { width: 200, height: 200 };

  it('centres the note on the nearest lane', () => {
    const snap = snapToLanes({ x: 0, y: 8, ...square }, T);
    expect(snap).not.toBeNull();
    expect(snap!.snappedY).toBe(true);
    expect(snap!.laneIndex).toBe(0);
    // Centred: a 200-tall note on a 200-tall lane sits flush at the lane top.
    expect(snap!.y).toBe(laneCentre(0, T) - 100);
  });

  it('centres SHORTER stationery on the lane rather than hanging it from the top', () => {
    // Each dropped a few px off its own centred position, so only the
    // centring rule decides where it lands.
    for (const size of [ES_NOTE_SIZE_PX.wide, ES_NOTE_SIZE_PX.small]) {
      const centred = laneCentre(0, T) - size.height / 2;
      const snap = snapToLanes({ x: 0, y: centred + 5, ...size }, T);
      expect(snap!.snappedY, `${size.height}`).toBe(true);
      expect(snap!.y, `${size.height}`).toBe(centred);
    }
  });

  it('leaves y alone beyond the threshold', () => {
    const farY = laneCentre(0, T) - 100 + ES_LANE_SNAP_Y + 1;
    // x is off the grid AND given no tolerance, so only y could answer.
    const snap = snapToLanes({ x: 61, y: farY, ...square }, T, { y: ES_LANE_SNAP_Y, x: 0 });
    expect(snap).toBeNull();
  });

  it('snaps the LEFT EDGE to the half-note grid', () => {
    expect(snapToLanes({ x: 92, y: 0, ...square }, T)!.x).toBe(ES_GRID_CELL);
    expect(snapToLanes({ x: 92, y: 0, ...square }, T)!.cellIndex).toBe(1);
    expect(snapToLanes({ x: 240, y: 0, ...square }, T)!.x).toBe(2 * ES_GRID_CELL);
  });

  it('snaps the left edge whatever the silhouette', () => {
    for (const size of Object.values(ES_NOTE_SIZE_PX)) {
      const snap = snapToLanes({ x: 305, y: 0, ...size }, T);
      expect(snap!.x).toBe(3 * ES_GRID_CELL);
    }
  });

  it('snaps to negative cells and lanes', () => {
    const snap = snapToLanes({ x: -190, y: -ES_LANE_PITCH + 3, ...square }, T);
    expect(snap!.cellIndex).toBe(-2);
    expect(snap!.x).toBe(-2 * ES_GRID_CELL);
    expect(snap!.laneIndex).toBe(-1);
  });

  it('measures both axes from the origin', () => {
    const snap = snapToLanes({ x: OFFSET.originX + 4, y: OFFSET.originY + 4, ...square }, OFFSET);
    expect(snap!.x).toBe(OFFSET.originX);
    expect(snap!.y).toBe(OFFSET.originY);
    expect(snap!.cellIndex).toBe(0);
    expect(snap!.laneIndex).toBe(0);
  });

  it('snaps each axis independently', () => {
    // y is far from any lane, x is on the grid's doorstep: x alone moves.
    const y = laneCentre(0, T) - 100 + ES_LANE_SNAP_Y + 30;
    const snap = snapToLanes({ x: 92, y, ...square }, T, { x: ES_LANE_SNAP_X, y: ES_LANE_SNAP_Y });
    expect(snap!.snappedX).toBe(true);
    expect(snap!.snappedY).toBe(false);
    expect(snap!.y).toBe(y);
    expect(snap!.laneIndex).toBeNull();
  });

  it('returns null when neither axis snaps', () => {
    expect(snapToLanes({ x: 92, y: 60, ...square }, T, { x: 1, y: 1 })).toBeNull();
  });

  it('claims every x at the default threshold (the grid is a grid)', () => {
    for (const x of [0, 1, 49, 50, 51, 99, 100, -23]) {
      expect(snapToLanes({ x, y: 0, ...square }, T)!.snappedX).toBe(true);
    }
    expect(ES_LANE_SNAP_X).toBe(ES_GRID_CELL / 2);
    expect(ES_LANE_SNAP_Y).toBe(ES_LANE_GAP / 2);
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
