// A fence placed on a lawn's edge fences that whole side (docs/specs/009-elements/fence.md "Placed on a lawn's edge"):
// the owner, 2026-11-27, wanted one click to cover a side of the grass in the perfect position. Pure, canvas px.

import type { Element } from '@livehuddle/document';

/** How near (canvas px) a fence's middle must come to a lawn's side to fence it. */
export const FENCE_GRASS_SNAP_PX = 64;

const FENCES: ReadonlySet<string> = new Set(['fence', 'garden-fence']);

/** The fence laid along the side of the upright Grass area its middle is nearest (within reach), or as it was. */
export function snapFenceToGrass<T extends Element>(
  el: T,
  elements: readonly Element[],
  reach = FENCE_GRASS_SNAP_PX,
): T {
  if (el.type !== 'shape' || !FENCES.has(el.shape) || el.rotation) return el;
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  const thick = Math.min(el.width, el.height);
  let best: { d: number; box: { x: number; y: number; width: number; height: number } } | null =
    null;
  const offer = (d: number, box: { x: number; y: number; width: number; height: number }) => {
    if (d <= reach && (!best || d < best.d)) best = { d, box };
  };
  for (const g of elements) {
    if (g.type !== 'shape' || g.shape !== 'grass' || g.rotation || g.id === el.id) continue;
    const alongX = cx >= g.x && cx <= g.x + g.width;
    const alongY = cy >= g.y && cy <= g.y + g.height;
    const w = g.width;
    const h = g.height;
    if (alongX) {
      offer(Math.abs(cy - g.y), { x: g.x, y: g.y, width: w, height: thick });
      offer(Math.abs(cy - (g.y + h)), { x: g.x, y: g.y + h - thick, width: w, height: thick });
    }
    if (alongY) {
      offer(Math.abs(cx - g.x), { x: g.x, y: g.y, width: thick, height: h });
      offer(Math.abs(cx - (g.x + w)), { x: g.x + w - thick, y: g.y, width: thick, height: h });
    }
  }
  const found = best as { box: { x: number; y: number; width: number; height: number } } | null;
  return found ? { ...el, ...found.box } : el;
}
