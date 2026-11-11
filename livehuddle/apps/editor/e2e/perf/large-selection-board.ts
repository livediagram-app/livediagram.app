// The large-selection board (docs/specs/008-canvas/canvas-performance.md "Dragging a very large
// selection"): 1,770 elements, 900 labelled shapes in a 30 × 30 grid and 870 text captions, one in each gap
// between a shape and its right-hand neighbour. Only kinds livehuddle still makes: arrows left with the element
// engine's part 4 (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine"). Deterministic: the
// same board on every run.

import { createSticky, createText, type Element } from '@livehuddle/document';

export const LARGE_GRID = 30;
export const LARGE_NODE_COUNT = LARGE_GRID * LARGE_GRID;
export const LARGE_CAPTION_COUNT = (LARGE_GRID - 1) * LARGE_GRID;
const STEP_X = 200;
const STEP_Y = 140;
// A caption sits in the gap a square's 120 width leaves before the next one.
const CAPTION_W = 36;
const CAPTION_H = 20;

export const largeNodeId = (row: number, col: number) => `n-${row}-${col}`;

export function buildLargeSelectionBoard(): Element[] {
  const nodes: Element[] = [];
  const captions: Element[] = [];
  for (let row = 0; row < LARGE_GRID; row++)
    for (let col = 0; col < LARGE_GRID; col++) {
      const shape = createSticky(col * STEP_X, row * STEP_Y);
      nodes.push({ ...shape, id: largeNodeId(row, col), label: `Step ${row * LARGE_GRID + col}` });
      if (col > 0)
        captions.push({
          ...createText(col * STEP_X - CAPTION_W, row * STEP_Y + 4),
          id: `a-${row}-${col}`,
          width: CAPTION_W,
          height: CAPTION_H,
          label: 'next',
        });
    }
  return [...nodes, ...captions];
}
