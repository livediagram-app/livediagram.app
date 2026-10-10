// The selection (docs/specs/029-sheets/sheet.md "Selection", "Keyboard"): ranges of positions with an active cell
// and an anchor (where Shift extends from). Moves skip hidden rows and columns and treat a merge as one cell.
import { normaliseRange, rangeContains, type CellPos, type GridRange } from './address';

export type Selection = { ranges: GridRange[]; active: CellPos; anchor: CellPos };

export type Grid = {
  rows: number;
  cols: number;
  hiddenRow(r: number): boolean;
  hiddenCol(c: number): boolean;
  filled(r: number, c: number): boolean;
  // The merge covering a cell, as positions, if any.
  mergeAt(r: number, c: number): GridRange | null;
};

export type Dir = 'up' | 'down' | 'left' | 'right';

const STEP: Record<Dir, [number, number]> = {
  up: [-1, 0],
  down: [1, 0],
  left: [0, -1],
  right: [0, 1],
};

export function single(pos: CellPos): Selection {
  return { ranges: [normaliseRange(pos, pos)], active: pos, anchor: pos };
}

// Grow a range until it holds every merge it touches.
export function expandForMerges(range: GridRange, grid: Grid): GridRange {
  let r = { ...range };
  for (let pass = 0; pass < 8; pass++) {
    let grown = false;
    for (let i = r.r1; i <= r.r2; i++)
      for (const j of [r.c1, r.c2]) grown = growBy(r, grid.mergeAt(i, j)) || grown;
    for (let j = r.c1; j <= r.c2; j++)
      for (const i of [r.r1, r.r2]) grown = growBy(r, grid.mergeAt(i, j)) || grown;
    if (!grown) break;
    r = { ...r };
  }
  return r;
}

function growBy(r: GridRange, m: GridRange | null): boolean {
  if (!m) return false;
  const before = `${r.r1},${r.c1},${r.r2},${r.c2}`;
  r.r1 = Math.min(r.r1, m.r1);
  r.c1 = Math.min(r.c1, m.c1);
  r.r2 = Math.max(r.r2, m.r2);
  r.c2 = Math.max(r.c2, m.c2);
  return before !== `${r.r1},${r.c1},${r.r2},${r.c2}`;
}

function clamp(pos: CellPos, grid: Grid): CellPos {
  return {
    r: Math.max(0, Math.min(grid.rows - 1, pos.r)),
    c: Math.max(0, Math.min(grid.cols - 1, pos.c)),
  };
}

// One step in a direction, past hidden rows and columns and out of a merge.
export function stepFrom(pos: CellPos, dir: Dir, grid: Grid): CellPos {
  const [dr, dc] = STEP[dir];
  const m = grid.mergeAt(pos.r, pos.c);
  let r = pos.r;
  let c = pos.c;
  if (m) {
    if (dr > 0) r = m.r2;
    if (dr < 0) r = m.r1;
    if (dc > 0) c = m.c2;
    if (dc < 0) c = m.c1;
  }
  for (;;) {
    const nr = r + dr;
    const nc = c + dc;
    if (nr < 0 || nc < 0 || nr >= grid.rows || nc >= grid.cols) return pos;
    r = nr;
    c = nc;
    if ((dr !== 0 && grid.hiddenRow(r)) || (dc !== 0 && grid.hiddenCol(c))) continue;
    const target = grid.mergeAt(r, c);
    return target ? { r: target.r1, c: target.c1 } : { r, c };
  }
}

// Ctrl + arrow: to the edge of the filled run, or to the next filled cell, or to the sheet's edge.
export function jumpFrom(pos: CellPos, dir: Dir, grid: Grid): CellPos {
  let cur = pos;
  let next = stepFrom(cur, dir, grid);
  if (next.r === cur.r && next.c === cur.c) return cur;
  if (grid.filled(cur.r, cur.c) && grid.filled(next.r, next.c)) {
    for (;;) {
      const after = stepFrom(next, dir, grid);
      if ((after.r === next.r && after.c === next.c) || !grid.filled(after.r, after.c)) return next;
      next = after;
    }
  }
  cur = next;
  for (;;) {
    if (grid.filled(cur.r, cur.c)) return cur;
    const after = stepFrom(cur, dir, grid);
    if (after.r === cur.r && after.c === cur.c) return cur;
    cur = after;
  }
}

export function moveSelection(sel: Selection, dir: Dir, grid: Grid, jump = false): Selection {
  const to = jump ? jumpFrom(sel.active, dir, grid) : stepFrom(sel.active, dir, grid);
  return single(to);
}

// Shift + arrow: the far corner from the anchor moves; the active cell stays.
export function extendSelection(sel: Selection, dir: Dir, grid: Grid, jump = false): Selection {
  const range = sel.ranges[sel.ranges.length - 1]!;
  const far: CellPos = {
    r: sel.anchor.r === range.r1 ? range.r2 : range.r1,
    c: sel.anchor.c === range.c1 ? range.c2 : range.c1,
  };
  const to = jump ? jumpFrom(far, dir, grid) : stepFrom(far, dir, grid);
  return extendTo(sel, to, grid);
}

export function extendTo(sel: Selection, to: CellPos, grid: Grid): Selection {
  const range = expandForMerges(normaliseRange(sel.anchor, clamp(to, grid)), grid);
  return { ...sel, ranges: [...sel.ranges.slice(0, -1), range] };
}

// Ctrl/⌘ + click: another range, its own active cell.
export function addRange(sel: Selection, pos: CellPos, grid: Grid): Selection {
  const m = grid.mergeAt(pos.r, pos.c);
  const range = m ?? normaliseRange(pos, pos);
  return { ranges: [...sel.ranges, range], active: pos, anchor: pos };
}

export function selectRows(r1: number, r2: number, grid: Grid): Selection {
  const range = { r1: Math.min(r1, r2), c1: 0, r2: Math.max(r1, r2), c2: grid.cols - 1 };
  return { ranges: [range], active: { r: range.r1, c: 0 }, anchor: { r: r1, c: 0 } };
}

export function selectCols(c1: number, c2: number, grid: Grid): Selection {
  const range = { r1: 0, c1: Math.min(c1, c2), r2: grid.rows - 1, c2: Math.max(c1, c2) };
  return { ranges: [range], active: { r: 0, c: range.c1 }, anchor: { r: 0, c: c1 } };
}

export function selectAllCells(grid: Grid): Selection {
  return {
    ranges: [{ r1: 0, c1: 0, r2: grid.rows - 1, c2: grid.cols - 1 }],
    active: { r: 0, c: 0 },
    anchor: { r: 0, c: 0 },
  };
}

// The filled block around a cell (Ctrl+A's first press): grown while any edge's neighbour line holds something.
export function currentRegion(pos: CellPos, grid: Grid): GridRange {
  const r: GridRange = { r1: pos.r, c1: pos.c, r2: pos.r, c2: pos.c };
  const lineFilled = (fixed: number, from: number, to: number, isRow: boolean) => {
    for (let k = Math.max(0, from); k <= Math.min(to, (isRow ? grid.cols : grid.rows) - 1); k++)
      if (isRow ? grid.filled(fixed, k) : grid.filled(k, fixed)) return true;
    return false;
  };
  for (let guard = 0; guard < 100_000; guard++) {
    let grown = false;
    if (r.r1 > 0 && lineFilled(r.r1 - 1, r.c1 - 1, r.c2 + 1, true)) {
      r.r1--;
      grown = true;
    }
    if (r.r2 < grid.rows - 1 && lineFilled(r.r2 + 1, r.c1 - 1, r.c2 + 1, true)) {
      r.r2++;
      grown = true;
    }
    if (r.c1 > 0 && lineFilled(r.c1 - 1, r.r1, r.r2, false)) {
      r.c1--;
      grown = true;
    }
    if (r.c2 < grid.cols - 1 && lineFilled(r.c2 + 1, r.r1, r.r2, false)) {
      r.c2++;
      grown = true;
    }
    if (!grown) break;
  }
  return r;
}

// Ctrl+A: the region around the active cell, then (pressed again, or on an empty cell) the whole sheet.
export function selectAll(sel: Selection, grid: Grid): Selection {
  const region = currentRegion(sel.active, grid);
  const current = sel.ranges[sel.ranges.length - 1]!;
  const alone =
    region.r1 === region.r2 && region.c1 === region.c2 && !grid.filled(region.r1, region.c1);
  const same =
    current.r1 === region.r1 &&
    current.c1 === region.c1 &&
    current.r2 === region.r2 &&
    current.c2 === region.c2;
  if (alone || same) return { ...selectAllCells(grid), active: sel.active };
  return { ranges: [region], active: sel.active, anchor: { r: region.r1, c: region.c1 } };
}

// Page Up / Page Down: `rows` visible rows away.
export function pageSelection(sel: Selection, rows: number, grid: Grid): Selection {
  let pos = sel.active;
  const dir: Dir = rows < 0 ? 'up' : 'down';
  for (let i = 0; i < Math.abs(rows); i++) pos = stepFrom(pos, dir, grid);
  return single(pos);
}

// Home / End and Ctrl+Home / Ctrl+End.
export function homeEnd(
  sel: Selection,
  which: 'home' | 'end',
  toSheet: boolean,
  grid: Grid,
  lastFilled: CellPos,
): Selection {
  if (toSheet) return single(which === 'home' ? { r: 0, c: 0 } : lastFilled);
  return single({ r: sel.active.r, c: which === 'home' ? 0 : Math.max(0, grid.cols - 1) });
}

export function inSelection(sel: Selection, r: number, c: number): boolean {
  return sel.ranges.some((range) => rangeContains(range, r, c));
}

// Does the selection hold more than one cell? A merge is one cell, so a clicked merge (its range the merge's) is a
// single cell: Enter edits it and Tab moves on, rather than walking into the cells it covers.
export function selectsSeveral(sel: Selection, grid: Grid): boolean {
  const range = primaryRange(sel);
  const { r, c } = sel.active;
  const one = grid.mergeAt(r, c) ?? { r1: r, c1: c, r2: r, c2: c };
  return range.r1 < one.r1 || range.c1 < one.c1 || range.r2 > one.r2 || range.c2 > one.c2;
}

// The range Enter and Tab move within, when more than one cell is selected.
export function primaryRange(sel: Selection): GridRange {
  return sel.ranges[sel.ranges.length - 1]!;
}

// Enter / Tab inside a selection of more than one cell: the active cell walks the range and wraps.
export function cycleInRange(
  sel: Selection,
  dir: 'next-row' | 'prev-row' | 'next-col' | 'prev-col',
): Selection {
  const range = primaryRange(sel);
  let { r, c } = sel.active;
  const width = range.c2 - range.c1 + 1;
  const height = range.r2 - range.r1 + 1;
  if (dir === 'next-row' || dir === 'prev-row') {
    const step = dir === 'next-row' ? 1 : -1;
    r += step;
    if (r > range.r2) {
      r = range.r1;
      c = range.c1 + ((c - range.c1 + 1) % width);
    }
    if (r < range.r1) {
      r = range.r2;
      c = range.c1 + ((c - range.c1 - 1 + width) % width);
    }
  } else {
    const step = dir === 'next-col' ? 1 : -1;
    c += step;
    if (c > range.c2) {
      c = range.c1;
      r = range.r1 + ((r - range.r1 + 1) % height);
    }
    if (c < range.c1) {
      c = range.c2;
      r = range.r1 + ((r - range.r1 - 1 + height) % height);
    }
  }
  return { ...sel, active: { r, c } };
}
