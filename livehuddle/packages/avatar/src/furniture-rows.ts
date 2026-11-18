// Pieces the 3D view builds row by row rather than standing up whole (livehuddle docs/specs/008-canvas/3d-view.md
// "Tables are built, not stood"): a drawing written as groups, each a row, so its paint order is the flat plan's and
// the 3D view knows which parts stand where. Pure.

import type { FurniturePart, FurnitureRow3D } from './furniture-art';

export { rowed, type FurnitureGroup } from './furniture-art';

type Bounds = { left: number; top: number; right: number; bottom: number };

// A path's extent from its numbers: absolute points (M, L, Q, C), H and V runs, and relative l, h and v runs.
function pathBounds(d: string): Bounds {
  let x = 0;
  let y = 0;
  const b: Bounds = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
  const at = () => {
    b.left = Math.min(b.left, x);
    b.right = Math.max(b.right, x);
    b.top = Math.min(b.top, y);
    b.bottom = Math.max(b.bottom, y);
  };
  for (const m of d.matchAll(/([MLHVQCZmlhvqcz])([^MLHVQCZmlhvqcz]*)/g)) {
    const n = (m[2]!.match(/-?[\d.]+/g) ?? []).map(Number);
    const c = m[1]!;
    if (c === 'M' || c === 'L' || c === 'Q' || c === 'C') {
      for (let i = 0; i + 1 < n.length; i += 2) {
        x = n[i]!;
        y = n[i + 1]!;
        at();
      }
    } else if (c === 'm' || c === 'l') {
      for (let i = 0; i + 1 < n.length; i += 2) {
        x += n[i]!;
        y += n[i + 1]!;
        at();
      }
    } else if (c === 'H' || c === 'V' || c === 'h' || c === 'v') {
      for (const v of n) {
        if (c === 'H') x = v;
        else if (c === 'V') y = v;
        else if (c === 'h') x += v;
        else y += v;
        at();
      }
    }
  }
  return b;
}

/** A part's extent on its drawing's grid. */
export function partBounds(p: FurniturePart): Bounds {
  if (p.tag === 'rect') return { left: p.x, top: p.y, right: p.x + p.w, bottom: p.y + p.h };
  if (p.tag === 'ellipse')
    return { left: p.cx - p.rx, top: p.cy - p.ry, right: p.cx + p.rx, bottom: p.cy + p.ry };
  return pathBounds(p.d);
}

function boundsOf(parts: readonly FurniturePart[], indices: readonly number[]): Bounds {
  const b: Bounds = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
  for (const i of indices) {
    const p = partBounds(parts[i]!);
    b.left = Math.min(b.left, p.left);
    b.top = Math.min(b.top, p.top);
    b.right = Math.max(b.right, p.right);
    b.bottom = Math.max(b.bottom, p.bottom);
  }
  return b;
}

/**
 * A row as the 3D view lays it out, on the drawing's grid: its parts, where it meets the floor (`foot`, its lowest
 * point) and, for a top, how far its slab rises (`lift`: from the top of its front edge to the floor) and the slab's
 * parts. `box` is the whole row's extent, which a sitter on it is found by.
 */
export type RowLayout = {
  parts: readonly number[];
  foot: number;
  lift: number;
  slab: readonly number[];
  box: Bounds;
};

export function rowLayouts(
  parts: readonly FurniturePart[],
  rows: readonly FurnitureRow3D[],
): RowLayout[] {
  return rows.map((r) => {
    if (r.kind === 'stand') {
      const box = boundsOf(parts, r.parts);
      return { parts: r.parts, foot: box.bottom, lift: 0, slab: [], box };
    }
    const skirt = boundsOf(parts, r.skirt);
    const all = [...r.slab, ...r.skirt];
    return {
      parts: r.skirt,
      foot: skirt.bottom,
      lift: skirt.bottom - skirt.top,
      slab: r.slab,
      box: boundsOf(parts, all),
    };
  });
}
