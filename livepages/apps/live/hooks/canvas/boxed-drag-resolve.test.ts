import { describe, expect, it } from 'vitest';
import { pageSnapBoxes, layOutPages, pageMargin, type StickyElement } from '@livepages/document';
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
