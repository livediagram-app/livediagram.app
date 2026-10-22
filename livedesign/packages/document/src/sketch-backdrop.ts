// Sketch backdrops (docs/specs/008-canvas/finish.md "Sketch"): a shape that other elements sit on (a key's
// card, a panel behind a group, a box with captions over it) keeps a solid fill under Sketch (and Marker), because pencil
// hatching behind words and shapes makes them unreadable. Only a shape that stands alone is hatched.
//
// "Sits on" is: another element later in the drawing order has its centre inside the shape's box. One pass
// over the tab, shared by the canvas and every export so they agree. Sorted by centre x and binary searched,
// so a tab costs O(n log n + hits), not O(n^2): it reruns on every element change of a sketched tab.
import { finishHatchesKind, isHandDrawn, resolveFinish } from './finish';
import { isBoxed } from './index';
import type { Element } from './index';

type Centre = { x: number; y: number; order: number };

function lowerBound(sorted: readonly Centre[], x: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid]!.x < x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** The ids of the shapes drawn in Sketch that something sits on, in a tab whose own finish is `tabFinish`.
 *  Empty (and nearly free) when nothing on the tab is sketched. */
export function sketchBackdropIds(elements: readonly Element[], tabFinish: unknown): Set<string> {
  const out = new Set<string>();
  const candidates: number[] = [];
  elements.forEach((el, i) => {
    if (!finishHatchesKind(el)) return;
    if (!isHandDrawn(resolveFinish((el as { finish?: unknown }).finish, tabFinish))) return;
    candidates.push(i);
  });
  if (candidates.length === 0) return out;
  const centres: Centre[] = [];
  elements.forEach((el, order) => {
    if (isBoxed(el)) centres.push({ x: el.x + el.width / 2, y: el.y + el.height / 2, order });
  });
  centres.sort((a, b) => a.x - b.x);
  for (const i of candidates) {
    const box = elements[i]!;
    if (!isBoxed(box)) continue;
    const right = box.x + box.width;
    const bottom = box.y + box.height;
    for (let k = lowerBound(centres, box.x); k < centres.length; k++) {
      const c = centres[k]!;
      if (c.x > right) break;
      if (c.order > i && c.y >= box.y && c.y <= bottom) {
        out.add(box.id);
        break;
      }
    }
  }
  return out;
}
