// Door pairing + travel geometry (spec/104): pure helpers for the portal.
//
// A door carries `doorTarget`, the id of the door it leads to. Resolution is
// deliberately forgiving — a target that has been deleted, re-pointed at a
// non-door, or points at itself resolves to "unpaired" rather than throwing —
// because a diagram is edited in any order and a half-wired portal is a normal
// intermediate state, not corrupt data.

import type { Element, ShapeElement } from '@livediagram/diagram';

export type Doorway = { x: number; y: number; width: number; height: number; label?: string };

// Every door on the tab, in element order — the candidate list the "where does
// this door lead?" picker offers.
export function doorsOnTab(elements: Element[]): ShapeElement[] {
  return elements.filter((el): el is ShapeElement => el.type === 'shape' && el.shape === 'door');
}

// A door's display name for menus and tooltips: its own label, else a stable
// positional name ("Door 2") so an unlabelled pair is still tellable apart.
export function doorName(elements: Element[], door: ShapeElement): string {
  const label = door.label?.trim();
  if (label) return label;
  const index = doorsOnTab(elements).findIndex((d) => d.id === door.id);
  return index >= 0 ? `Door ${index + 1}` : 'Door';
}

// The door `door` leads to, or null when it is unpaired / mis-paired. Never
// returns the door itself: a portal to where you already are is a no-op, and
// silently doing nothing on click is the confusing case we're avoiding.
export function resolveDoorTarget(elements: Element[], door: ShapeElement): ShapeElement | null {
  if (!door.doorTarget || door.doorTarget === door.id) return null;
  const target = elements.find((el) => el.id === door.doorTarget);
  if (!target || target.type !== 'shape' || target.shape !== 'door') return null;
  return target;
}

// Where a character stands when it comes OUT of a door: centred on the doorway,
// at its threshold (the bottom edge), since the avatar's position is its feet.
export function doorExitPoint(door: Doorway): { x: number; y: number } {
  return { x: door.x + door.width / 2, y: door.y + door.height };
}

// The viewport offset that centres `door` in a viewport of `size` at `zoom`.
// The canvas transform is `scale(zoom) translate(offset)`, so the offset is in
// canvas px and the centring maths divides the viewport by the zoom.
export function viewportOffsetCentredOn(
  door: Doorway,
  size: { width: number; height: number },
  zoom: number,
): { x: number; y: number } {
  const z = zoom > 0 ? zoom : 1;
  return {
    x: size.width / (2 * z) - (door.x + door.width / 2),
    y: size.height / (2 * z) - (door.y + door.height / 2),
  };
}
