// The Shapes flyout's search (docs/specs/023-draw-mode/draw-mode.md "What a whiteboard shows"): at
// most six of the whiteboard's shape catalogue, ranked the way the palette search ranks (exact
// name, name prefix, name substring, keyword), best match first; an empty field finds nothing (the
// flyout shows its slots). Never the full list. Plus the grid's arrow-key movement. Pure.
import { paletteRank } from '@livediagram/icons';
import {
  WHITEBOARD_SHAPE_CATALOGUE,
  type WhiteboardShapeEntry,
} from './whiteboard-shape-catalogue';

// The most results a typed query shows (the spec's six: one small grid, no scrolling).
export const SHAPE_SEARCH_LIMIT = 6;

// A rank the palette search treats as "no match".
const NO_MATCH = 4;

export function searchWhiteboardShapes(query: string): WhiteboardShapeEntry[] {
  const q = query.trim();
  if (!q) return [];
  return WHITEBOARD_SHAPE_CATALOGUE.map((e, i) => ({
    e,
    i,
    rank: paletteRank(q, { name: e.label, keywords: e.keywords }),
  }))
    .filter((m) => m.rank < NO_MATCH)
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
    .slice(0, SHAPE_SEARCH_LIMIT)
    .map((m) => m.e);
}

export type GridDirection = 'left' | 'right' | 'up' | 'down';

// The next index in a grid of groups, each group starting a new row of `cols`. Left and right walk
// the flat order (crossing groups); up and down go to the row above or below, keeping the column
// where that row is long enough and its last cell otherwise. Clamped at the ends.
export function gridStep(
  groupSizes: readonly number[],
  cols: number,
  index: number,
  dir: GridDirection,
): number {
  const total = groupSizes.reduce((a, b) => a + b, 0);
  if (total === 0) return index;
  if (dir === 'left') return Math.max(0, index - 1);
  if (dir === 'right') return Math.min(total - 1, index + 1);
  // Each visual row as [first flat index, length].
  const rows: [number, number][] = [];
  let start = 0;
  for (const size of groupSizes) {
    for (let r = 0; r < size; r += cols) rows.push([start + r, Math.min(cols, size - r)]);
    start += size;
  }
  const row = rows.findIndex(([first, len]) => index >= first && index < first + len);
  const target = rows[row + (dir === 'down' ? 1 : -1)];
  if (row < 0 || !target) return index;
  const col = index - rows[row]![0];
  return target[0] + Math.min(col, target[1] - 1);
}
