import { describe, expect, it } from 'vitest';
import {
  ES_NOTE_GAP,
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
// reached at all), then the lane (y) and the neighbours (x), then alignment /
// distribution for whatever is left.

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
  const ROW_Y = ES_LANE_PITCH;

  it('pulls the note onto the lane, and lines it up with the note below', () => {
    // The operator's case: a row built at the board's own gutter, and a note
    // in the lane above dropped a few px off the one below it. Under the old
    // column lattice this landed 28px to the right, every time.
    const below = note('below', 200 + ES_NOTE_GAP, ROW_Y);
    const out = resolve(200 + ES_NOTE_GAP + 5 - START.x, 7 - START.y, {
      elements: [note('drag', 1000, 1000), below],
    });
    expect(START.x + out.tx).toBe(200 + ES_NOTE_GAP);
    expect(START.y + out.ty).toBe(laneCentre(0, TIMELINE) - 100);
    expect(out.lane).toEqual({ laneIndex: 0 });
  });

  it('sits one gutter clear of the note beside it', () => {
    const beside = note('beside', 0, 0);
    const out = resolve(200 + ES_NOTE_GAP + 6 - START.x, 7 - START.y, {
      elements: [note('drag', 1000, 1000), beside],
    });
    expect(START.x + out.tx).toBe(200 + ES_NOTE_GAP);
  });

  it('leaves x alone in open space — the gutter is an offer, not a rail', () => {
    const out = resolve(937 - START.x, 7 - START.y, { elements: [note('drag', 1000, 1000)] });
    expect(START.x + out.tx).toBe(937);
    expect(START.y + out.ty).toBe(laneCentre(0, TIMELINE) - 100);
    expect(out.lane).toEqual({ laneIndex: 0 });
  });

  it('draws no alignment guides when lane and neighbour have claimed both axes', () => {
    const out = resolve(-1000 + 4, -1000 + 7, {
      elements: [note('drag', 1000, 1000), note('n', 0, 0)],
    });
    expect(out.guides).toEqual([]);
    expect(out.distGuides).toEqual([]);
  });

  it('leaves the axis the lane did not claim to alignment', () => {
    // y far from any lane, x on a neighbour's edge.
    const neighbourY = ES_LANE_PITCH + 100;
    const out = resolve(4 - START.x, neighbourY - START.y, {
      elements: [note('drag', 1000, 1000), note('n', 0, neighbourY)],
    });
    expect(START.x + out.tx).toBe(0);
    expect(out.lane).toBeNull();
    expect(START.y + out.ty).toBe(neighbourY);
    expect(out.guides.every((g) => g.axis === 'y')).toBe(true);
  });

  it('stands down entirely under free placement', () => {
    const out = resolve(9, 7, { noSnap: true });
    expect(out).toEqual({ tx: 9, ty: 7, guides: [], distGuides: [], lane: null });
  });

  it('is absent when the caller passes no timeline', () => {
    const out = resolve(305 - START.x, ES_LANE_PITCH + 7 - START.y, { timeline: null });
    expect(out.lane).toBeNull();
    expect(START.x + out.tx).toBe(305);
  });
});
