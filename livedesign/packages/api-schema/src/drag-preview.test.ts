import { describe, expect, it } from 'vitest';
import { DRAG_PREVIEW_MAX_ELEMENTS, isPresenceOpKind, parseDragPreviewPatches } from './index';

// docs/specs/008-canvas/drag-preview.md "Live movement for collaborators": a dragger's preview travels
// as presence, carrying only geometry, validated before anyone draws it.

describe('drag-preview on the wire', () => {
  it('is presence: unordered, never logged or replayed', () => {
    expect(isPresenceOpKind('drag-preview')).toBe(true);
  });

  it('keeps a box patch and an arrow patch, geometry only', () => {
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
      {
        id: 'ab',
        from: { kind: 'pinned', elementId: 'a', anchor: 'e' },
        to: { kind: 'free', x: 9, y: 9 },
        curveOffset: { dx: 0, dy: 12 },
      },
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
