import { describe, expect, it } from 'vitest';
import type { Element, StickyElement } from '@livehuddle/document';
import type { ShapeBounds } from '@/lib/canvas';
import { resolveBoxedMove } from './boxed-drag-resolve';

// The move resolver (docs/specs/008-canvas/canvas-and-palette.md): free placement stands down every snap, else
// alignment and distribution answer the frame.

function note(id: string, x: number, y: number): StickyElement {
  return { id, type: 'sticky', x, y, width: 200, height: 200 };
}

const START: ShapeBounds = { x: 1000, y: 1000, width: 200, height: 200 };

function resolve(dx: number, dy: number, over: { noSnap?: boolean; elements?: Element[] } = {}) {
  return resolveBoxedMove({
    elements: over.elements ?? [note('drag', 1000, 1000)],
    startBounds: new Map([['drag', START]]),
    primaryId: 'drag',
    dx,
    dy,
    noSnap: over.noSnap === true,
    guidesOn: true,
  });
}

describe('resolveBoxedMove', () => {
  it('stands down entirely under free placement', () => {
    expect(resolve(9, 7, { noSnap: true })).toEqual({ tx: 9, ty: 7, guides: [], distGuides: [] });
  });

  it('snaps an edge into line with a neighbour, and draws the guide', () => {
    // Held 3px off the neighbour's left edge.
    const out = resolve(503 - START.x, 1600 - START.y, {
      elements: [note('drag', 1000, 1000), note('n', 500, 0)],
    });
    expect(START.x + out.tx).toBe(500);
    expect(out.guides.some((g) => g.axis === 'x')).toBe(true);
  });

  it('leaves the hand alone in open space', () => {
    const out = resolve(4321 - START.x, 1234 - START.y);
    expect(START.x + out.tx).toBe(4321);
    expect(START.y + out.ty).toBe(1234);
  });
});
