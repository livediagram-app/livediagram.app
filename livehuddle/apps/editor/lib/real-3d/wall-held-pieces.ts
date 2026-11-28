// The pieces hung on each wall (docs/specs/008-canvas/3d-view.md "Walls in front of you are cut away"): a Screen, a
// Poster, a Whiteboard or a Room Sign hangs on the wall it stands against, so when that wall is cut down out of your
// way the piece goes with it, never left floating in the air where the wall was (the owner, 2026-11-27).
import { mountedFace, mountsOnWall, type Element } from '@livehuddle/document';

type Point = { x: number; y: number };
type Wall = { id: string; a: Point; b: Point };

/** Wall pieces that stand on the floor against their wall (they stay: nothing of them hangs in the air). */
const ON_THE_FLOOR: ReadonlySet<string> = new Set(['fireplace', 'bookshelf']);

/** How far from a face's line a wall's own line may run and still be that face's wall, in canvas px. */
const ON_LINE = 10;

/** Each wall's hung pieces, by wall id: those whose face runs along the wall and whose span overlaps it. */
export function wallHeldPieces(
  walls: readonly Wall[],
  elements: readonly Element[],
): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const el of elements) {
    if (el.type !== 'shape' || !mountsOnWall(el.shape) || ON_THE_FLOOR.has(el.shape)) continue;
    const face = mountedFace(el, elements);
    if (!face) continue;
    // The piece's span along its wall.
    const lo = face.vertical ? el.y : el.x;
    const hi = face.vertical ? el.y + el.height : el.x + el.width;
    for (const w of walls) {
      const across = face.vertical ? [w.a.x, w.b.x] : [w.a.y, w.b.y];
      if (Math.abs(across[0]! - face.line) > ON_LINE || Math.abs(across[1]! - face.line) > ON_LINE)
        continue;
      const along = face.vertical ? [w.a.y, w.b.y] : [w.a.x, w.b.x];
      const from = Math.min(along[0]!, along[1]!);
      const to = Math.max(along[0]!, along[1]!);
      if (to <= lo || from >= hi) continue;
      const list = out.get(w.id);
      if (list) list.push(el.id);
      else out.set(w.id, [el.id]);
    }
  }
  return out;
}
