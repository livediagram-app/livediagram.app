// The More shapes search (docs/specs/023-whiteboard/whiteboard.md "What a whiteboard shows"): the
// whiteboard's shape catalogue, ranked the way the palette search ranks (exact name, name prefix,
// name substring, keyword), best match first; an empty field is the whole catalogue, grouped as in
// the palette. Plus the grid's arrow-key movement. Pure.
import { paletteRank } from './search';
import {
  WHITEBOARD_SHAPE_CATALOGUE,
  WHITEBOARD_SHAPE_GROUPS,
  type WhiteboardShapeEntry,
} from './whiteboard-shape-catalogue';

export type ShapeSearchGroup = { id: string; label: string; entries: WhiteboardShapeEntry[] };

export type ShapeSearchView = {
  // False for an empty field: the groups are the palette's, with headings.
  searching: boolean;
  groups: ShapeSearchGroup[];
};

// A rank the palette search treats as "no match".
const NO_MATCH = 4;

export function searchWhiteboardShapes(query: string): ShapeSearchView {
  const q = query.trim();
  if (!q) {
    return {
      searching: false,
      groups: WHITEBOARD_SHAPE_GROUPS.map((g) => ({
        ...g,
        entries: WHITEBOARD_SHAPE_CATALOGUE.filter((e) => e.group === g.id),
      })),
    };
  }
  const entries = WHITEBOARD_SHAPE_CATALOGUE.map((e, i) => ({
    e,
    i,
    rank: paletteRank(q, { name: e.label, keywords: e.keywords }),
  }))
    .filter((m) => m.rank < NO_MATCH)
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
    .map((m) => m.e);
  return {
    searching: true,
    groups: entries.length > 0 ? [{ id: 'matches', label: 'Matches', entries }] : [],
  };
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
