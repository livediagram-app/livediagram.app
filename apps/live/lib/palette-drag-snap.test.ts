import { describe, expect, it } from 'vitest';
import {
  ES_NOTE_GAP,
  ES_LANE_PITCH,
  laneCentre,
  type Element,
  type EsTimeline,
} from '@livediagram/diagram';
import { paletteDragSnapAt } from './palette-drag-snap';

// Alignment help BEFORE the drop (spec/139): while a palette tile is dragged
// over the canvas, the ghost snaps to its neighbours' edges / centres and the
// same faint guide lines a move shows appear. The geometry is pure — the
// cursor's canvas point + the footprint that will land, against the tab's
// elements — so it can be reasoned about here rather than through a drag.
describe('paletteDragSnapAt', () => {
  const neighbour = {
    id: 'n1',
    type: 'sticky',
    x: 100,
    y: 100,
    width: 200,
    height: 200,
  } as Element;

  const dragged = { width: 200, height: 200 };

  it('snaps the ghost onto a neighbour’s left edge when it is within reach', () => {
    // Cursor centre at (204, 400) => box x = 104, four px right of the
    // neighbour's left edge (100). Within the threshold, so it pulls left.
    const { dx, dy, guides } = paletteDragSnapAt({
      canvasX: 204,
      canvasY: 400,
      ...dragged,
      elements: [neighbour],
    });
    expect(dx).toBe(-4);
    expect(dy).toBe(0);
    expect(guides.length).toBeGreaterThan(0);
  });

  it('leaves a far-away ghost alone and shows no guides', () => {
    const { dx, dy, guides } = paletteDragSnapAt({
      canvasX: 900,
      canvasY: 900,
      ...dragged,
      elements: [neighbour],
    });
    expect({ dx, dy }).toEqual({ dx: 0, dy: 0 });
    expect(guides).toEqual([]);
  });

  it('snaps both axes at once (a corner latch)', () => {
    // Centre at (203, 203) => box (103, 103): 3px off the neighbour's
    // top-left corner on both axes.
    const { dx, dy } = paletteDragSnapAt({
      canvasX: 203,
      canvasY: 203,
      ...dragged,
      elements: [neighbour],
    });
    expect({ dx, dy }).toEqual({ dx: -3, dy: -3 });
  });

  // Equal-spacing (distribution) helpers ride along exactly as they do for a
  // move: they fill the axes alignment didn't already claim, so a dragged-in
  // note lands evenly spaced in a row rather than merely edge-aligned.
  it('snaps to equal spacing between two neighbours, and reports its guide', () => {
    // Two 200-wide notes at x=0 and x=600 (gap 400 — 200 clear between
    // them). A third dropped between them is evenly spaced when its box
    // sits at x=300. Aim the centre 4px off that.
    const a = { id: 'a', type: 'sticky', x: 0, y: 0, width: 200, height: 200 } as Element;
    const b = { id: 'b', type: 'sticky', x: 600, y: 0, width: 200, height: 200 } as Element;
    const { dx, distGuides } = paletteDragSnapAt({
      canvasX: 300 + 100 + 4,
      canvasY: 100,
      ...dragged,
      elements: [a, b],
    });
    expect(dx).toBe(-4);
    expect(distGuides.length).toBeGreaterThan(0);
  });

  it('lets alignment win the axis when both are in range (the move-drag rule)', () => {
    const a = { id: 'a', type: 'sticky', x: 0, y: 0, width: 200, height: 200 } as Element;
    // Aiming at a's own left edge: alignment claims x, so no distribution
    // guide may be reported for that axis.
    const { dx, distGuides } = paletteDragSnapAt({
      canvasX: 100 + 3,
      canvasY: 400,
      ...dragged,
      elements: [a],
    });
    expect(dx).toBe(-3);
    expect(distGuides.filter((g) => g.axis === 'x')).toEqual([]);
  });

  it('reports guides for the SNAPPED box, not the raw cursor box', () => {
    // A 4px-off box produces no guide of its own; only after the snap do
    // the shared edges line up — so a guide proves the snapped geometry
    // was measured.
    const { guides } = paletteDragSnapAt({
      canvasX: 204,
      canvasY: 400,
      ...dragged,
      elements: [neighbour],
    });
    expect(guides.some((g) => g.axis === 'x')).toBe(true);
  });
});

// Timeline lanes (spec/139 Phase 6): the same rungs the note-drag resolver
// applies, so a note dragged in from the palette joins the row the board has
// already committed to and lines up with the notes already in it.
describe('paletteDragSnapAt — timeline lanes', () => {
  const TIMELINE: EsTimeline = { originX: 0, originY: 0, enabled: true };
  const dragged = { width: 200, height: 200 };
  const neighbour = (x: number, y: number) =>
    ({ id: 'n', type: 'sticky', x, y, width: 200, height: 200 }) as Element;

  it('centres the note on the lane and lines it up with the note below', () => {
    const column = 200 + ES_NOTE_GAP;
    const out = paletteDragSnapAt({
      canvasX: column + 5 + 100,
      canvasY: ES_LANE_PITCH + 7 + 100,
      ...dragged,
      elements: [neighbour(column, 2 * ES_LANE_PITCH)],
      timeline: TIMELINE,
    });
    expect(column + 5 + out.dx).toBe(column);
    expect(ES_LANE_PITCH + 7 + 100 + out.dy).toBe(laneCentre(1, TIMELINE));
    expect(out.lane).toMatchObject({ laneIndex: 1 });
    // The offer is drawn where the drop will land.
    expect(out.lane!.ghost).toMatchObject({ x: column, y: laneCentre(1, TIMELINE) - 100 });
  });

  it('joins a row one gutter clear of the note already in it', () => {
    const beside = neighbour(0, ES_LANE_PITCH);
    const out = paletteDragSnapAt({
      canvasX: 200 + ES_NOTE_GAP + 6 + 100,
      canvasY: ES_LANE_PITCH + 7 + 100,
      ...dragged,
      elements: [beside],
      timeline: TIMELINE,
    });
    expect(200 + ES_NOTE_GAP + 6 + out.dx).toBe(200 + ES_NOTE_GAP);
  });

  it('takes the lane and leaves x alone on an empty board', () => {
    const out = paletteDragSnapAt({
      canvasX: 937 + 100,
      canvasY: ES_LANE_PITCH + 7 + 100,
      ...dragged,
      elements: [],
      timeline: TIMELINE,
    });
    expect(out.dx).toBe(0);
    expect(out.lane).toMatchObject({ laneIndex: 1 });
  });

  it('is inert without a timeline, exactly as every other board behaves', () => {
    const out = paletteDragSnapAt({
      canvasX: 305 + 100,
      canvasY: ES_LANE_PITCH + 7 + 100,
      ...dragged,
      elements: [],
    });
    expect(out).toEqual({ dx: 0, dy: 0, guides: [], distGuides: [], lane: null });
  });

  it('stands every other snap down: no lane, no slot, no guides', () => {
    // A neighbour whose TOP edge sits mid-way between two lanes: no lane can
    // claim y, so nothing is offered — and on a lanes board the ordinary
    // alignment snap does not step in, because it offers positions the
    // rhythm does not have.
    const neighbourY = ES_LANE_PITCH + 100;
    const out = paletteDragSnapAt({
      canvasX: 900 + 100,
      canvasY: neighbourY + 100 + 3,
      ...dragged,
      elements: [neighbour(900, neighbourY)],
      timeline: TIMELINE,
    });
    expect(out.lane).toBeNull();
    expect(out.dx).toBe(0);
    expect(out.dy).toBe(0);
    expect(out.guides).toEqual([]);
  });
});
