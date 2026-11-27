import { describe, expect, it } from 'vitest';
import {
  pageSnapBoxes,
  layOutPages,
  pageMargin,
  type StickyElement,
} from '@livedocuments/document';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
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

// Work Tracker 1499: on a stack, alignment worked only until a move's delta failed the round trip through the box's
// centre (`(cx + dx) - cx`), which most fractional deltas do: every such frame read as held at the page's edge and
// came back with no snap and no guides. The numbers are a real drag's (a stat row on the third page).
describe('snapping on a stack (Work Tracker 1499)', () => {
  const pages = layOutPages([
    { id: 'a', orientation: 'portrait' },
    { id: 'b', orientation: 'portrait' },
    { id: 'c', orientation: 'portrait' },
  ]);
  const front = pages[2]!.rect;
  const stat = { x: front.x + 56, y: front.y + 369.5, width: 682, height: 123 };

  it('gives a move that stays on the page back exactly as it came', () => {
    for (const [dx, dy] of [
      [6.73037574622498, 4.37475450478462],
      [10.09556361933747, 6.562106082830973],
      [0.1, 0.2],
      [-13.46075149244996, -8.74950900956924],
    ] as const)
      expect(keepCentreOn(front, stat, dx, dy)).toEqual({ dx, dy });
  });

  it('snaps and guides a move on the page in front, against that page alone', () => {
    // A box on the page in front to line up with, and its twins on the pages behind, which never count.
    const twins = pages.map((p, i) => note(`n${i}`, p.rect.x + 100, stat.y - 300));
    const start = { x: stat.x, y: stat.y, width: 200, height: 200 };
    const out = resolveBoxedMove({
      elements: [...twins, note('drag', start.x, start.y)],
      startBounds: new Map([['drag', start]]),
      primaryId: 'drag',
      dx: front.x + 100 - start.x + 3.37,
      dy: 0.43,
      noSnap: false,
      guidesOn: true,
      pages,
      pageSnapBoxes: pageSnapBoxes(pages),
      keepOn: front,
    });
    // Snapped onto the box's left edge (to the float: the snap adds its pull to the pointer's delta).
    expect(out.tx).toBeCloseTo(front.x + 100 - start.x, 6);
    expect(
      out.guides.some((g) => g.axis === 'x' && Math.abs(g.position - (front.x + 100)) < 1e-6),
    ).toBe(true);
  });
});

// The move frame on a large stack: 60 pages of 40 boxes (2,400 elements), snapping against the page in front alone.
// Measured 0.46 ms a frame (2026-11-27; a row of the same size costs the same); held well under a frame's share, with
// room for a slow runner.
describe('a stacked move frame stays cheap', () => {
  const PAGES = 60;
  const PER_PAGE = 40;
  const FRAMES = 100;
  const FRAME_BUDGET_MS = 4;

  it(`resolves ${FRAMES} frames on ${PAGES * PER_PAGE} elements within budget`, () => {
    const pages = layOutPages(
      Array.from({ length: PAGES }, (_, i) => ({ id: `p${i}`, orientation: 'portrait' as const })),
    );
    const els: StickyElement[] = pages.flatMap((p) =>
      Array.from({ length: PER_PAGE }, (_, j) =>
        note(
          `${p.id}-${j}`,
          p.rect.x + 40 + (j % 5) * 140,
          p.rect.y + 40 + Math.floor(j / 5) * 130,
        ),
      ),
    );
    const front = pages[PAGES - 1]!;
    const start = { x: front.rect.x + 300, y: front.rect.y + 500, width: 120, height: 90 };
    const boxes = pageSnapBoxes(pages);
    const frame = (i: number) =>
      resolveBoxedMove({
        elements: els,
        startBounds: new Map([['drag', start]]),
        primaryId: 'drag',
        dx: i * 0.37,
        dy: i * 0.21,
        noSnap: false,
        guidesOn: true,
        pages,
        pageSnapBoxes: boxes,
        keepOn: front.rect,
      });
    frame(0);
    const ms = cpuMsOf(() => {
      for (let i = 1; i <= FRAMES; i++) frame(i);
    });
    expect(ms / FRAMES).toBeLessThan(cpuBudgetMs(FRAME_BUDGET_MS));
  });
});
