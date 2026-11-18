// Where the standing pieces show on the screen (docs/specs/008-canvas/3d-view.md "Pieces stand up": clicking one),
// read from their boxes once per press, never per frame: the pieces turned up now (`data-space-near`), each with its
// box on the floor from the board and its drawing's rect from the browser, which projects the 3D transform for us.

import type { Element } from '@livehuddle/document';
import { SPACE_NEAR_ATTR, standsIn3D, type StandingOnScreen } from './space-3d-pieces';

export function standingPiecesOnScreen(
  root: ParentNode,
  elements: readonly Element[],
): StandingOnScreen[] {
  const nodes = root.querySelectorAll<HTMLElement>(`[${SPACE_NEAR_ATTR}]`);
  if (nodes.length === 0) return [];
  const byId = new Map<string, Extract<Element, { type: 'shape' }>>();
  for (const el of elements) if (standsIn3D(el)) byId.set(el.id, el);
  const out: StandingOnScreen[] = [];
  for (const node of nodes) {
    const el = byId.get(node.getAttribute('data-element-id') ?? '');
    if (!el) continue;
    const r = node.getBoundingClientRect();
    out.push({
      box: { x: el.x, y: el.y, width: el.width, height: el.height },
      rect: { left: r.left, top: r.top, width: r.width, height: r.height },
      rotated: node.getAttribute('data-space-stands') === 'centre',
    });
  }
  return out;
}

/**
 * The canvas point a press on a doorway stands for (3d-view.md "Doorways": clicking a door), or null: its Door's
 * middle, when the press is on the doorway's frame or its open leaf as the browser projects them, so a door standing
 * up is clicked where you see it, never on the floor behind it.
 */
export function doorPointAt(
  root: ParentNode,
  elements: readonly Element[],
  client: { x: number; y: number },
): { x: number; y: number } | null {
  for (const node of root.querySelectorAll<HTMLElement>('[data-space-door-id]')) {
    const r = node.getBoundingClientRect();
    if (client.x < r.left || client.x > r.right || client.y < r.top || client.y > r.bottom)
      continue;
    const id = node.getAttribute('data-space-door-id');
    const door = elements.find((el) => el.id === id);
    if (door && door.type === 'shape')
      return { x: door.x + door.width / 2, y: door.y + door.height / 2 };
  }
  return null;
}
