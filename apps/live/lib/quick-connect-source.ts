// Which member of the selection a quick-connect arrow should pin to.
// For a lone element that's trivially the element itself; for a
// multi-member group the plus buttons sit on the union bounding box, so
// the arrow pins to the member whose matching side sits closest to the
// clicked plus — the shape the arrow visually leaves from. See spec/09.
import { isBoxed, selectionMembers, unionBoxedBounds, type Element } from '@livediagram/diagram';
import type { QuickConnectDirection } from '@/lib/canvas';

type Bounds = { x: number; y: number; width: number; height: number };

// The mid-point of a bounds' side facing `direction` — where the plus
// button sits on the union box, and the comparable point on each member.
function sideMidpoint(b: Bounds, direction: QuickConnectDirection) {
  return {
    x: direction === 'right' ? b.x + b.width : direction === 'left' ? b.x : b.x + b.width / 2,
    y: direction === 'below' ? b.y + b.height : direction === 'above' ? b.y : b.y + b.height / 2,
  };
}

export function quickConnectSourceId(
  elements: Element[],
  selectedId: string,
  direction: QuickConnectDirection,
): string {
  const memberIds = selectionMembers(elements, selectedId);
  if (memberIds.length <= 1) return selectedId;
  const bounds = unionBoxedBounds(elements, new Set(memberIds));
  if (!bounds) return selectedId;
  const target = sideMidpoint(bounds, direction);
  let best = selectedId;
  let bestDistance = Infinity;
  for (const id of memberIds) {
    const el = elements.find((e) => e.id === id);
    if (!el || !isBoxed(el)) continue;
    const p = sideMidpoint(el, direction);
    const d = (p.x - target.x) ** 2 + (p.y - target.y) ** 2;
    if (d < bestDistance) {
      bestDistance = d;
      best = id;
    }
  }
  return best;
}
