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
    expect(out.lane).toMatchObject({ laneIndex: 0 });
    // …and the offer was drawn there before the drop.
    expect(out.lane!.ghost).toEqual({ x: 200 + ES_NOTE_GAP, y: 0, width: 200, height: 200 });
  });

  it('offers the BRICK stagger under the gutter between two events', () => {
    const pair = [note('l', 0, 0), note('r', 200 + ES_NOTE_GAP, 0)];
    const brick = (200 + ES_NOTE_GAP) / 2;
    // Dropped 40px off the brick position — inside the capture radius, and
    // nowhere near close enough for the old 12px snap.
    const out = resolve(brick + 40 - START.x, ES_LANE_PITCH + 7 - START.y, {
      elements: [note('drag', 1000, 1000), ...pair],
    });
    expect(START.x + out.tx).toBe(brick);
    expect(out.lane!.ghost).toMatchObject({ x: brick });
  });

  it('lines a WIDE note up on an edge, with no brick offered', () => {
    // Different silhouettes line up left-to-left or right-to-right; the brick
    // is for two squares only.
    const pair = [note('l', 0, 0), note('r', 200 + ES_NOTE_GAP, 0)];
    const wide: ShapeBounds = { x: 1000, y: 1000, width: 300, height: 180 };
    const out = resolveBoxedMove({
      elements: [
        { id: 'drag', type: 'sticky', x: 1000, y: 1000, width: 300, height: 180 } as Element,
        ...pair,
      ],
      startBounds: new Map([['drag', wide]]),
      primaryId: 'drag',
      dx: 30 - 1000,
      dy: ES_LANE_PITCH + 12 - 1000,
      noSnap: false,
      guidesOn: true,
      timeline: TIMELINE,
    });
    expect(1000 + out.tx).toBe(0);
    expect(out.lane!.ghost).toMatchObject({ x: 0, width: 300, height: 180 });
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

  it('draws no alignment guides when lane and slot have claimed both axes', () => {
    // Into the lane below a note, on its column: both axes are answered.
    const out = resolve(4 - START.x, ES_LANE_PITCH + 7 - START.y, {
      elements: [note('drag', 1000, 1000), note('n', 0, 0)],
    });
    expect(out.guides).toEqual([]);
    expect(out.distGuides).toEqual([]);
  });

  it('offers nothing at all when no lane claims the note', () => {
    // y parked between two lanes: nothing is offered, and x is the hand's.
    const midY = ES_LANE_PITCH + 100;
    const out = resolve(4 - START.x, midY - START.y, {
      elements: [note('drag', 1000, 1000), note('n', 0, midY)],
    });
    expect(out.lane).toBeNull();
    expect(START.y + out.ty).toBe(midY);
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
