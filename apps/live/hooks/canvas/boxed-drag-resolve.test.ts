import { describe, expect, it } from 'vitest';
import {
  ES_GRID_CELL,
  ES_LANE_PITCH,
  laneCentre,
  type Element,
  type EsTimeline,
  type StickyElement,
} from '@livediagram/diagram';
import type { ShapeBounds } from '@/lib/canvas';
import { resolveBoxedMove } from './boxed-drag-resolve';

// The move resolver's placement ladder (spec/139 Phase 6). Free placement is
// the top rung here (an open insertion slot is resolved before this function is
// reached at all), then the lane + column grid, then alignment / distribution.

const TIMELINE: EsTimeline = { originX: 0, originY: 0, enabled: true };

function note(id: string, x: number, y: number): StickyElement {
  return { id, type: 'sticky', x, y, width: 200, height: 200 } as StickyElement;
}

const START: ShapeBounds = { x: 1000, y: 1000, width: 200, height: 200 };

function resolve(
  dx: number,
  dy: number,
  over: { timeline?: EsTimeline | null; noSnap?: boolean; elements?: Element[] } = {},
) {
  return resolveBoxedMove({
    elements: over.elements ?? [note('drag', 1000, 1000)],
    startBounds: new Map([['drag', START]]),
    primaryId: 'drag',
    dx,
    dy,
    noSnap: over.noSnap === true,
    guidesOn: true,
    timeline: over.timeline === undefined ? TIMELINE : over.timeline,
  });
}

describe('resolveBoxedMove — timeline lanes', () => {
  it('pulls the note onto the lane and the column', () => {
    // Aim a few px off lane 1 / column 3.
    const targetX = 3 * ES_GRID_CELL + 9;
    const targetY = ES_LANE_PITCH + 7;
    const out = resolve(targetX - START.x, targetY - START.y);
    expect(START.x + out.tx).toBe(3 * ES_GRID_CELL);
    expect(START.y + out.ty).toBe(laneCentre(1, TIMELINE) - 100);
    expect(out.lane).toEqual({ laneIndex: 1, cellIndex: 3 });
  });

  it('draws no alignment guides when the lane has claimed both axes', () => {
    // A neighbour sharing an edge would normally guide; the lane owns it.
    const out = resolve(-1000 + 9, -1000 + 7, {
      elements: [note('drag', 1000, 1000), note('n', 0, 0)],
    });
    expect(out.guides).toEqual([]);
    expect(out.distGuides).toEqual([]);
  });

  it('leaves the axis the lane did not claim to alignment', () => {
    const neighbourY = ES_LANE_PITCH + 100;
    const out = resolve(3 * ES_GRID_CELL + 9 - START.x, neighbourY - START.y, {
      elements: [note('drag', 1000, 1000), note('n', 900, neighbourY)],
    });
    // x came from the grid…
    expect(START.x + out.tx).toBe(3 * ES_GRID_CELL);
    expect(out.lane).toEqual({ laneIndex: null, cellIndex: 3 });
    // …and y from the neighbour's top edge, with its guide still drawn.
    expect(START.y + out.ty).toBe(neighbourY);
    expect(out.guides.every((g) => g.axis === 'y')).toBe(true);
  });

  it('stands down entirely under free placement', () => {
    const out = resolve(9, 7, { noSnap: true });
    expect(out).toEqual({ tx: 9, ty: 7, guides: [], distGuides: [], lane: null });
  });

  it('is absent when the caller passes no timeline', () => {
    const out = resolve(3 * ES_GRID_CELL + 9 - START.x, ES_LANE_PITCH + 7 - START.y, {
      timeline: null,
    });
    expect(out.lane).toBeNull();
    expect(START.x + out.tx).toBe(3 * ES_GRID_CELL + 9);
  });
});
