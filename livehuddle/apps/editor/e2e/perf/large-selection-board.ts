// The large-selection board (docs/specs/008-canvas/canvas-performance.md "Dragging a very large
// selection"): 1,770 elements, 900 labelled shapes in a 30 × 30 grid and 870 arrows, each pinned from a
// shape to its right-hand neighbour. Select all and drag it, and every arrow moves with the selection;
// drag a few and only the arrows leaving them re-route. Deterministic: the same board on every run.

import { createPinnedArrow, createShape, type Element } from '@livehuddle/document';

export const LARGE_GRID = 30;
export const LARGE_NODE_COUNT = LARGE_GRID * LARGE_GRID;
export const LARGE_ARROW_COUNT = (LARGE_GRID - 1) * LARGE_GRID;
const STEP_X = 200;
const STEP_Y = 140;

export const largeNodeId = (row: number, col: number) => `n-${row}-${col}`;

export function buildLargeSelectionBoard(): Element[] {
  const nodes: Element[] = [];
  const arrows: Element[] = [];
  for (let row = 0; row < LARGE_GRID; row++)
    for (let col = 0; col < LARGE_GRID; col++) {
      const shape = createShape('square', col * STEP_X, row * STEP_Y);
      nodes.push({ ...shape, id: largeNodeId(row, col), label: `Step ${row * LARGE_GRID + col}` });
      if (col > 0)
        arrows.push({
          ...createPinnedArrow(largeNodeId(row, col - 1), 'e', largeNodeId(row, col), 'w'),
          id: `a-${row}-${col}`,
        });
    }
  return [...nodes, ...arrows];
}
