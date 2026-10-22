// Two-way edges in a laid-out graph (docs/specs/008-canvas/layout-cleanup.md "Two-way edges bow
// apart"). A state diagram's Private -> Shared and Shared -> Private are two
// straight arrows between the same two boxes: they drew on top of each other,
// only the fan-out's few pixels apart, and their labels collided. Each pair is
// bowed into two curves, one to each side of the line between the boxes, so
// both arrows and both labels read.

import { isBoxed, type ArrowElement, type Element } from './index';

// How far each curve bows from the straight line, in canvas units, at least.
export const RECIPROCAL_BOW = 36;
// A curve's midpoint, where its label sits, moves half the bow. Labels side by
// side (a vertical pair) need their half-widths of room, so a labelled pair
// bows further, up to a cap that keeps the loop from ballooning.
const LABEL_CHAR_PX = 6.5;
const LABEL_GAP_PX = 12;
const MAX_BOW = 140;
const labelHalf = (a: ArrowElement) => ((a.label ?? '').trim().length * LABEL_CHAR_PX) / 2;

type Pinned = ArrowElement & {
  from: { kind: 'pinned'; elementId: string };
  to: { kind: 'pinned'; elementId: string };
};

const isPinned = (el: Element): el is Pinned =>
  el.type === 'arrow' && el.from.kind === 'pinned' && el.to.kind === 'pinned';

// `elements` with every straight two-way pair curved apart. Arrows that
// already carry a curve or a routing of their own are left alone.
export function bowReciprocalEdges(elements: Element[]): Element[] {
  const centre = new Map(
    elements.filter(isBoxed).map((b) => [b.id, { x: b.x + b.width / 2, y: b.y + b.height / 2 }]),
  );
  const straight = elements.filter(
    (el): el is Pinned =>
      isPinned(el) &&
      (el.arrowStyle ?? 'straight') === 'straight' &&
      el.from.elementId !== el.to.elementId,
  );
  const byEnds = new Map(straight.map((a) => [`${a.from.elementId}>${a.to.elementId}`, a]));
  const bow = new Map<string, { dx: number; dy: number }>();
  for (const a of straight) {
    const back = byEnds.get(`${a.to.elementId}>${a.from.elementId}`);
    if (!back || bow.has(a.id)) continue;
    const p = centre.get(a.from.elementId);
    const q = centre.get(a.to.elementId);
    if (!p || !q) continue;
    const len = Math.hypot(q.x - p.x, q.y - p.y);
    if (len < 1) continue;
    // Perpendicular to a's direction; the pair's reversed chord makes the
    // opposite offset land on the other side.
    const ux = -(q.y - p.y) / len;
    const uy = (q.x - p.x) / len;
    // The labels sit apart by the bow along the perpendicular; how much of
    // their width that has to clear depends on how sideways it runs.
    const clear = Math.abs(ux) * (labelHalf(a) + labelHalf(back) + LABEL_GAP_PX);
    const size = Math.min(MAX_BOW, Math.max(RECIPROCAL_BOW, clear));
    const nx = ux * size;
    const ny = uy * size;
    bow.set(a.id, { dx: nx, dy: ny });
    bow.set(back.id, { dx: -nx, dy: -ny });
  }
  if (bow.size === 0) return elements;
  return elements.map((el) => {
    const curveOffset = bow.get(el.id);
    return curveOffset && el.type === 'arrow'
      ? { ...el, arrowStyle: 'curved' as const, curveOffset }
      : el;
  });
}
