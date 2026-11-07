// The order a tab's elements paint in, back to front (docs/specs/006-document/layers.md "Stacking"): the tab's
// `elements` array, with backdrops first and attached marks last. Every renderer (canvas, exports, snapshots,
// thumbnails) paints in this order, so an export stacks like the canvas.
// TYPE-only import, written as `import type` so it is erased: `./index` re-exports this module.
import type { Element } from './index';
import { isFloorShape } from './office';
import { isRetiredBackdrop } from './retired-kinds';

// The paint tier of an element, back to front:
// - boundaries and stacks, an office's rooms and rugs, and a stored Frame's placeholder are backdrops that paint
//   below everything else, the larger first, and a Window last among them, so its light falls on the floor under the
//   furniture whichever was placed first;
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
      // A Window (docs/specs/009-elements/room-builder.md "Window"): its patch of light lies on the floor.
      el.shape === 'window' ||
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

// Within the backdrops: grass first, then the garden paths in array order, then the other floors larger first, then the
// windows in array order (docs/specs/006-document/layers.md "Stacking"), so a path laid later lies on one laid earlier
// whatever their sizes, and a window's frame and light lie over the room it sits in.
function backdropRank(el: Element): number {
  if (el.type !== 'shape') return 2;
  if (el.shape === 'grass') return 0;
  if (el.shape === 'window') return 3;
  return el.shape === 'garden-path' ? 1 : 2;
}

// A stable sort by tier. Returns the SAME array when it is already in tier
// order, which is every tab without backdrops or attached chips out of place.
// Runs on every render: one pass fills three typed arrays, and the sort runs only when something is out of place.
export function paintOrder(elements: Element[]): Element[] {
  const n = elements.length;
  const tiers = new Uint8Array(n);
  const ranks = new Uint8Array(n);
  // Among the backdrops the larger paints first, so a boundary nested in another is never hidden behind it; the garden
  // paths and the windows keep their array order among themselves (backdropRank), so their area is left at 0.
  const areas = new Float64Array(n);
  for (let i = 0; i < n; i += 1) {
    const el = elements[i]!;
    const tier = paintTier(el);
    tiers[i] = tier;
    if (tier !== 0) continue;
    const rank = backdropRank(el);
    ranks[i] = rank;
    if (rank !== 1 && rank !== 3 && 'width' in el && 'height' in el)
      areas[i] = el.width * el.height;
  }
  const before = (a: number, b: number) =>
    tiers[a]! - tiers[b]! || ranks[a]! - ranks[b]! || areas[b]! - areas[a]! || a - b;
  let inOrder = true;
  for (let i = 1; i < n && inOrder; i += 1) inOrder = before(i - 1, i) <= 0;
  if (inOrder) return elements;
  return Array.from({ length: n }, (_, i) => i)
    .sort(before)
    .map((i) => elements[i]!);
}
