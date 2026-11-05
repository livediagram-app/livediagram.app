// The order a tab's elements paint in, back to front (docs/specs/006-document/layers.md "Stacking"): the tab's
// `elements` array, with backdrops first and attached marks last. Every renderer (canvas, exports, snapshots,
// thumbnails) paints in this order, so an export stacks like the canvas.
// TYPE-only import, written as `import type` so it is erased: `./index` re-exports this module.
import type { Element } from './index';
import { isFloorShape } from './office';
import { isRetiredBackdrop } from './retired-kinds';

// The paint tier of an element, back to front:
// - boundaries and stacks, an office's rooms and rugs, and a stored Frame's placeholder are backdrops that paint
//   below everything else, the larger first;
// - attached badges, step numbers and pointer notes paint above everything else.
// Array order decides within a tier.
function paintTier(el: Element): number {
  // Boundaries are backdrops (docs/specs/009-elements/boundary.md "A container"), and so are a stored Frame (a retired
  // element, docs/specs/002-project-scope/not-in-livehuddle.md "The Frame") and an office's
  // floors (docs/specs/009-elements/office.md): a room and a rug lie under the furniture however they were added (drawn
  // to size, pasted, by an agent), and the larger paints first, so a rug lies on its room's floor.
  if (
    el.type === 'shape' &&
    (isRetiredBackdrop(el) ||
      el.shape === 'boundary' ||
      el.shape === 'stack' ||
      isFloorShape(el.shape))
  )
    return 0;
  // An attached badge or step number (docs/specs/009-elements/badge.md) sits above everything else, so a
  // later element never covers the mark on its host.
  if (
    el.type === 'shape' &&
    el.attachedTo &&
    (el.shape === 'badge' || el.shape === 'step' || el.shape === 'pointer-note')
  )
    return 2;
  return 1;
}

// A stable sort by tier. Returns the SAME array when it is already in tier
// order, which is every tab without backdrops or attached chips out of place.
export function paintOrder(elements: Element[]): Element[] {
  const tiers = elements.map(paintTier);
  // Among the backdrops the larger paints first, so a boundary nested in another is never hidden behind it.
  const area = (el: Element) => ('width' in el && 'height' in el ? el.width * el.height : 0);
  const backdropsInOrder = elements.every(
    (el, i) =>
      i === 0 || tiers[i] !== 0 || tiers[i - 1] !== 0 || area(elements[i - 1]!) >= area(el),
  );
  if (backdropsInOrder && tiers.every((t, i) => i === 0 || tiers[i - 1]! <= t)) return elements;
  return elements
    .map((el, i) => ({ el, i, tier: tiers[i]!, area: tiers[i] === 0 ? area(el) : 0 }))
    .sort((a, b) => a.tier - b.tier || b.area - a.area || a.i - b.i)
    .map((x) => x.el);
}
