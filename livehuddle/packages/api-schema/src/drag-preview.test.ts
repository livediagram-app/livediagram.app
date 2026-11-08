import { describe, expect, it } from 'vitest';
import {
  DRAG_PREVIEW_MAX_ELEMENTS,
  DRAG_PREVIEW_MAX_RIDE_IDS,
  isPresenceOpKind,
  parseDragPreviewPatches,
  parseDragPreviewRide,
} from './index';

// docs/specs/008-canvas/drag-preview.md "Live movement for collaborators": a dragger's preview travels
// as presence, carrying only geometry, validated before anyone draws it.

describe('drag-preview on the wire', () => {
  it('is presence: unordered, never logged or replayed', () => {
    expect(isPresenceOpKind('drag-preview')).toBe(true);
  });

  it('keeps a box patch, geometry only, and drops an arrow’s ends and bends', () => {
    const patches = parseDragPreviewPatches([
      {
        id: 'a',
        x: 1,
        y: 2,
        width: 30,
        height: 40,
        rotation: 5,
        label: 'dropped',
        fillColor: '#f00',
      },
      {
        id: 'ab',
        from: { kind: 'pinned', elementId: 'a', anchor: 'e' },
        to: { kind: 'free', x: 9, y: 9 },
        curveOffset: { dx: 0, dy: 12 },
      },
    ]);
    expect(patches).toEqual([
      { id: 'a', x: 1, y: 2, width: 30, height: 40, rotation: 5 },
      // An arrow never moves since part 4 of the element engine: nothing of it is drawn live.
      { id: 'ab' },
    ]);
  });

  it('refuses what is not a list of patches, or too many of them', () => {
    expect(parseDragPreviewPatches('nope')).toBeNull();
    expect(parseDragPreviewPatches([{ x: 1 }])).toBeNull();
    expect(parseDragPreviewPatches([{ id: 'a', x: 'far' }])).toBeNull();
    expect(parseDragPreviewPatches([{ id: 'a', x: Number.NaN }])).toBeNull();
    const many = Array.from({ length: DRAG_PREVIEW_MAX_ELEMENTS + 1 }, (_, i) => ({
      id: `e${i}`,
      x: i,
    }));
    expect(parseDragPreviewPatches(many)).toBeNull();
  });
});

describe('a ride on the wire', () => {
  it('keeps the offset, the ids when named, and the patches of what does not ride', () => {
    expect(
      parseDragPreviewRide({ dx: 4, dy: -2, ids: ['a', 'b'], patches: [{ id: 'c', x: 1 }] }),
    ).toEqual({
      dx: 4,
      dy: -2,
      ids: ['a', 'b'],
      patches: [{ id: 'c', x: 1 }],
    });
    expect(parseDragPreviewRide({ dx: 4, dy: -2 })).toEqual({ dx: 4, dy: -2, patches: [] });
  });

  it('refuses a ride without a finite offset, with bad ids, too many ids, or bad patches', () => {
    expect(parseDragPreviewRide(null)).toBeNull();
    expect(parseDragPreviewRide({ dx: 1 })).toBeNull();
    expect(parseDragPreviewRide({ dx: 1, dy: Number.POSITIVE_INFINITY })).toBeNull();
    expect(parseDragPreviewRide({ dx: 1, dy: 1, ids: 'a' })).toBeNull();
    expect(parseDragPreviewRide({ dx: 1, dy: 1, ids: [7] })).toBeNull();
    expect(parseDragPreviewRide({ dx: 1, dy: 1, ids: ['x'.repeat(201)] })).toBeNull();
    const ids = Array.from({ length: DRAG_PREVIEW_MAX_RIDE_IDS + 1 }, (_, i) => `e${i}`);
    expect(parseDragPreviewRide({ dx: 1, dy: 1, ids })).toBeNull();
    expect(parseDragPreviewRide({ dx: 1, dy: 1, patches: [{ x: 1 }] })).toBeNull();
  });
});
