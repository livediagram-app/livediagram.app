import { describe, expect, it } from 'vitest';
import { ES_LANES, laneCentre, type Element, type Tab } from '@livediagram/diagram';
import { stampPlacement, stampSizeFor } from './stamp-placement';

// Placing a fixed-size note from an armed tile (spec/139 Phase 4): the note is
// STAMPED at its own size, centred on the pointer, and on an event-storming
// board it meets the lanes the way a dragged note does. The ghost, the lane
// overlay and the drop all read this one answer.

const esBoard = { kind: 'event-storming', elements: [] } as unknown as Tab;
const plainBoard = { elements: [] } as unknown as Tab;

describe('stampSizeFor', () => {
  it('is the kind’s own silhouette for a workshop note, on any board', () => {
    expect(stampSizeFor({ type: 'sticky', esKind: 'policy' }, plainBoard)).toEqual({
      width: 300,
      height: 180,
    });
  });

  it('is the square note for a plain sticky on an event-storming board', () => {
    expect(stampSizeFor({ type: 'sticky' }, esBoard)).toEqual({ width: 200, height: 200 });
  });

  it('is nothing for a plain sticky elsewhere, or for any other tile', () => {
    expect(stampSizeFor({ type: 'sticky' }, plainBoard)).toBeNull();
    expect(stampSizeFor({ type: 'shape', kind: 'square' }, esBoard)).toBeNull();
  });
});

describe('stampPlacement', () => {
  const size = { width: 200, height: 200 };

  it('centres the note on the pointer in open space', () => {
    const out = stampPlacement(1000, 3000 + 7, size, plainBoard);
    expect(out.bounds).toEqual({ x: 900, y: 2907, width: 200, height: 200 });
    expect(out.lane).toBeNull();
  });

  it('lands on the nearest lane on an event-storming board', () => {
    const out = stampPlacement(1000, laneCentre(1, ES_LANES) + 9, size, esBoard);
    expect(out.bounds.y + out.bounds.height / 2).toBe(laneCentre(1, ES_LANES));
    expect(out.lane).toMatchObject({ laneIndex: 1 });
  });

  it('takes the slot beside a note in the row', () => {
    const neighbour = {
      id: 'n',
      type: 'sticky',
      x: 0,
      y: laneCentre(0, ES_LANES) - 100,
      width: 200,
      height: 200,
    } as Element;
    const board = { ...esBoard, elements: [neighbour] } as Tab;
    const out = stampPlacement(216 + 100 + 8, laneCentre(0, ES_LANES), size, board);
    expect(out.bounds.x).toBe(216);
  });
});
