import { describe, expect, it } from 'vitest';
import {
  pageSnapBoxes,
  layOutPages,
  pageMargin,
  type StickyElement,
} from '@livedocuments/document';
import { keepCentreOn, resolveBoxedMove } from './boxed-drag-resolve';

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

// docs/specs/007-editor/pages-mode.md "Stacked infographics": on a stack, a moved box never lands on a page hidden
// behind the page in front.
describe('a move on a stack', () => {
  const front = { x: 0, y: 0, width: 800, height: 1000 };
  const box = { x: 300, y: 400, width: 200, height: 200 };

  it('holds the box’s centre on the page in front, half hanging off its edge at most', () => {
    expect(keepCentreOn(front, box, 5000, 0)).toEqual({ dx: 400, dy: 0 });
    expect(keepCentreOn(front, box, -5000, -5000)).toEqual({ dx: -400, dy: -500 });
    expect(keepCentreOn(front, box, 50, 60)).toEqual({ dx: 50, dy: 60 });
  });

  it('leaves a box placed off the page before the tab was stacked free to move', () => {
    expect(keepCentreOn(front, { ...box, x: 2000 }, 300, 0)).toEqual({ dx: 300, dy: 0 });
  });

  it('stops the move at the edge, snapping or not, with no guides', () => {
    for (const noSnap of [false, true]) {
      const out = resolveBoxedMove({
        elements: [note('drag', box.x, box.y)],
        startBounds: new Map([['drag', box]]),
        primaryId: 'drag',
        dx: 3000,
        dy: 0,
        noSnap,
        guidesOn: true,
        keepOn: front,
      });
      expect(out).toEqual({ tx: 400, ty: 0, guides: [], distGuides: [] });
    }
  });
});
