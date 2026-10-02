import { describe, expect, it } from 'vitest';
import {
  buildElementGrid,
  buildElementIndex,
  createPinnedArrow,
  createShape,
} from '@livediagram/document';
import {
  arrowViewGeometry,
  deriveArrowViewFrame,
  sameArrowViewFrame,
  sameRects,
} from './arrow-view-frame';

// docs/specs/008-canvas/canvas-performance.md: an arrow view re-renders only when its own frame or
// holes change, so both compare by value.

const a = createShape('square', 0, 0);
const b = createShape('square', 400, 0);
const arrow = createPinnedArrow(a.id, 'e', b.id, 'w');

describe('sameArrowViewFrame', () => {
  it('treats a freshly derived equal frame as the same', () => {
    const index = buildElementIndex([a, b, arrow]);
    expect(
      sameArrowViewFrame(deriveArrowViewFrame(arrow, index), deriveArrowViewFrame(arrow, index)),
    ).toBe(true);
  });

  it('sees an end that moved', () => {
    const before = deriveArrowViewFrame(arrow, buildElementIndex([a, b, arrow]));
    const after = deriveArrowViewFrame(arrow, buildElementIndex([a, { ...b, y: 30 }, arrow]));
    expect(sameArrowViewFrame(before, after)).toBe(false);
  });
});

describe('arrowViewGeometry', () => {
  it('breaks the line around a box in its way, found through the grid', () => {
    const between = { ...createShape('square', 200, -20), fillColor: '#ffffff' };
    const els = [a, b, between, arrow];
    const { holes } = arrowViewGeometry(arrow, buildElementIndex(els), buildElementGrid(els));
    expect(holes).toHaveLength(1);
  });

  it('compares holes by value', () => {
    const r = { x: 1, y: 2, width: 3, height: 4 };
    expect(sameRects([r], [{ ...r }])).toBe(true);
    expect(sameRects([r], [{ ...r, x: 2 }])).toBe(false);
    expect(sameRects([], [r])).toBe(false);
  });
});
