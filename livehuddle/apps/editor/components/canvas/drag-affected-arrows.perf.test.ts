import { describe, expect, it } from 'vitest';
import {
  buildElementGrid,
  buildElementIndex,
  isBoxed,
  type ArrowElement,
  type Element,
} from '@livehuddle/document';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { overlayBetween } from '@/lib/drag-preview';
import { buildLargeSelectionBoard, LARGE_GRID } from '@/e2e/perf/large-selection-board';
import {
  affectedArrows,
  buildArrowLinks,
  movedBoxesGrid,
  previewArrowGeometry,
} from './drag-affected-arrows';

// docs/specs/008-canvas/canvas-performance.md "Dragging a very large selection": a drag frame's arrow work (which
// arrows the preview redraws, and each one's frame and holes) is linear in what moved, never arrows × moved. The
// 1,770-element board (900 shapes, 870 arrows), every shape moved, and the left half moved (its 15 boundary arrows
// re-route against unmoved shapes). Fastest of five after warm-up.

const BOARD = buildLargeSelectionBoard();
const INDEX = buildElementIndex(BOARD);
const GRID = buildElementGrid(BOARD);
const LINKS = buildArrowLinks(BOARD);

const movedBy = (dx: number, pick: (el: Element) => boolean) =>
  BOARD.map((el) => (isBoxed(el) && pick(el) ? { ...el, x: el.x + dx, y: el.y + dx / 2 } : el));

function frameWork(next: Element[]): number {
  const overlay = overlayBetween('t', next, BOARD);
  const ids = affectedArrows(overlay, BOARD, LINKS);
  const index = new Map(INDEX);
  for (const [id, el] of overlay.changed) index.set(id, el);
  const moved = movedBoxesGrid(overlay);
  for (const id of ids)
    previewArrowGeometry(index.get(id) as ArrowElement, index, GRID, overlay, moved);
  return ids.size;
}

function best(next: Element[]): number {
  for (let i = 0; i < 3; i++) frameWork(next);
  let fastest = Infinity;
  for (let i = 0; i < 5; i++)
    fastest = Math.min(
      fastest,
      cpuMsOf(() => frameWork(next)),
    );
  return fastest;
}

describe('a drag frame’s arrow work on the 1,770-element board', () => {
  it('redraws every arrow when the whole board moves, within budget', () => {
    const all = movedBy(12, () => true);
    expect(frameWork(all)).toBe(870);
    const ms = best(all);
    if (process.env.PERF_LOG) console.log(`arrow work, all moved ${ms.toFixed(2)} ms`);
    expect(ms).toBeLessThan(cpuBudgetMs(16));
  });

  it('stays linear when half the board moves', () => {
    const half = movedBy(12, (el) => (el as { x: number }).x < (LARGE_GRID / 2) * 200);
    const ms = best(half);
    if (process.env.PERF_LOG) console.log(`arrow work, half moved ${ms.toFixed(2)} ms`);
    expect(ms).toBeLessThan(cpuBudgetMs(16));
  });
});
