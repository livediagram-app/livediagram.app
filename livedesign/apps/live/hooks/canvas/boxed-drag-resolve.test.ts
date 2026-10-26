import { describe, expect, it } from 'vitest';
import { pageSnapBoxes, layOutPages, pageMargin, type StickyElement } from '@livedesign/design';
import { resolveBoxedMove } from './boxed-drag-resolve';

function note(id: string, x: number, y: number): StickyElement {
  return { id, type: 'sticky', x, y, width: 200, height: 200 };
}

describe('resolveBoxedMove — Page lines', () => {
  // docs/specs/007-editor/pages-mode.md "Snapping to the page".
  const [page] = layOutPages([{ id: 'p', orientation: 'portrait' }]);
  const boxes = pageSnapBoxes([page!]);
  const m = pageMargin(page!);

  it('snaps an edge to the page margin and guides it', () => {
    const left = page!.rect.x + m;
    const out = resolveBoxedMove({
      elements: [note('drag', 0, 0)],
      startBounds: new Map([['drag', { x: 0, y: 0, width: 200, height: 200 }]]),
      primaryId: 'drag',
      dx: left + 3,
      dy: 0,
      noSnap: false,
      guidesOn: true,
      pageSnapBoxes: boxes,
    });
    expect(out.tx).toBe(left);
    expect(out.guides.some((g) => g.axis === 'x' && g.position === left)).toBe(true);
  });

  it('snaps the centre to the page centre line', () => {
    const out = resolveBoxedMove({
      elements: [note('drag', 0, 0)],
      startBounds: new Map([['drag', { x: 0, y: 0, width: 200, height: 200 }]]),
      primaryId: 'drag',
      dx: -104,
      dy: -97,
      noSnap: false,
      guidesOn: true,
      pageSnapBoxes: boxes,
    });
    expect([out.tx, out.ty]).toEqual([-100, -100]);
  });
});

// docs/specs/008-canvas/canvas-and-palette.md: the equal-spacing guide shows while the spacing snap is in effect,
// the move that lands exactly on even spacing included (its delta is 0, and the guide was dropped).
describe('resolveBoxedMove — equal spacing', () => {
  const box = (id: string, x: number, y: number, width = 100, height = 100): StickyElement => ({
    id,
    type: 'sticky',
    x,
    y,
    width,
    height,
  });
  const move = (dx: number) =>
    resolveBoxedMove({
      elements: [box('a', 0, 0), box('b', 400, 0), box('c', 0, 300, 100, 60)],
      startBounds: new Map([['c', { x: 0, y: 300, width: 100, height: 60 }]]),
      primaryId: 'c',
      dx,
      dy: -280,
      noSnap: false,
      guidesOn: true,
    });

  it('guides a move snapped onto even spacing', () => {
    const out = move(203);
    expect(out.tx).toBe(200);
    expect(out.distGuides.filter((g) => g.axis === 'x')).toHaveLength(1);
  });

  it('keeps the guide when the move lands exactly on even spacing', () => {
    const out = move(200);
    expect(out.tx).toBe(200);
    expect(out.distGuides.filter((g) => g.axis === 'x')).toHaveLength(1);
  });
});
