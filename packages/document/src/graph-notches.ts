// No notch in a straight line (docs/specs/015-api/mcp-server.md §4.7 "The graph look"): an elbow whose ends sit
// within NOTCH_MAX of one line, across a middle run shorter than KINK_RUN, is drawn straight. Two boxes of different
// widths centred a pixel or two apart, or two anchors a pixel off, gave an elbow whose middle run was a 2 px step: a
// notch a reader sees, where a slant of a few pixels over the edge's length cannot be seen. Graph input only, the
// last pass over its routed arrows.

import { arrowPolyline } from './arrow-path-hits';
import { buildElementIndex } from './geometry';
import type { Element, Endpoint } from './index';

// How far apart an elbow's ends may sit across its line and still be drawn straight, in px.
export const NOTCH_MAX = 6;
// A run between two turns shorter than this, with length, reads as a notch rather than a bend.
export const KINK_RUN = 12;

// An arrow end as a key, for a pinned end: arrows sharing one join a bus there.
const endKey = (end: Endpoint) => (end.kind === 'pinned' ? `${end.elementId}:${end.anchor}` : null);

export function withoutNotches(elements: Element[]): Element[] {
  const index = buildElementIndex(elements);
  // A step at a bus's junction is the bus joining, hidden where the other arrow's run arrives: left as it is, as a
  // straight slant there would cross that run.
  const shared = new Map<string, number>();
  for (const el of elements)
    if (el.type === 'arrow')
      for (const key of [endKey(el.from), endKey(el.to)])
        if (key) shared.set(key, (shared.get(key) ?? 0) + 1);
  const onBus = (end: Endpoint) => (shared.get(endKey(end) ?? '') ?? 0) > 1;
  // How many arrows meet each box, and the boxes moved to true a line up.
  const attached = new Map<string, number>();
  for (const el of elements)
    if (el.type === 'arrow')
      for (const end of [el.from, el.to])
        if (end.kind === 'pinned')
          attached.set(end.elementId, (attached.get(end.elementId) ?? 0) + 1);
  const moves = new Map<string, { x: number; y: number }>();
  const out = elements.map((el) => {
    if (el.type !== 'arrow' || el.arrowStyle !== 'angled' || !el.curvePoints?.length) return el;
    if (onBus(el.from) || onBus(el.to)) return el;
    const points = arrowPolyline(el, index);
    const notched = points.some((p, i) => {
      if (i < 2 || i > points.length - 2) return false;
      const run = Math.hypot(p.x - points[i - 1]!.x, p.y - points[i - 1]!.y);
      return run >= 0.5 && run < KINK_RUN;
    });
    if (!notched) return el;
    const [start, end] = [points[0]!, points[points.length - 1]!];
    const [dx, dy] = [end.x - start.x, end.y - start.y];
    if (Math.min(Math.abs(dx), Math.abs(dy)) > NOTCH_MAX) return el;
    // A box no other line meets moves across by the step, so the line runs true: drawn straight between ends a few
    // pixels apart, a store's drop read as a slant (an evaluator saw 5 px over 250).
    const step = Math.abs(dx) < Math.abs(dy) ? { x: dx, y: 0 } : { x: 0, y: dy };
    const leaf = [
      { end: el.to, by: { x: -step.x, y: -step.y } },
      { end: el.from, by: step },
    ].find(({ end }) => end.kind === 'pinned' && (attached.get(end.elementId) ?? 0) === 1);
    if (leaf && leaf.end.kind === 'pinned' && !moves.has(leaf.end.elementId))
      moves.set(leaf.end.elementId, leaf.by);
    const { curvePoints: _bends, ...straight } = el;
    return { ...straight, arrowStyle: 'straight' as const };
  });
  if (moves.size === 0) return out;
  return out.map((el) => {
    const by = moves.get(el.id);
    return by && el.type !== 'arrow' && 'x' in el ? { ...el, x: el.x + by.x, y: el.y + by.y } : el;
  });
}
