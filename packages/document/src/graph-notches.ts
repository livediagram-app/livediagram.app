// No notch in a straight line (docs/specs/015-api/mcp-server.md §4.7 "The graph look"): an elbow whose ends sit
// within NOTCH_MAX of one line, across a middle run shorter than KINK_RUN, is drawn straight. Two boxes of different
// widths centred a pixel or two apart, or two anchors a pixel off, gave an elbow whose middle run was a 2 px step: a
// notch a reader sees, where a slant of a few pixels over the edge's length cannot be seen. An elbow whose straight
// line would cross a box it was routed round keeps its bends. Graph input only, before its labels are placed.

import { arrowPolyline } from './arrow-path-hits';
import { buildElementIndex } from './geometry';
import { segmentHitsBox } from './graph-look';
import { isBoxed, type BoxedElement, type Element, type Endpoint } from './index';

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
  // The boxes a straightened line must miss: every box but the frames and lanes that hold them.
  const boxes = elements.filter(
    (el): el is BoxedElement =>
      isBoxed(el) && !(el.type === 'shape' && (el.shape === 'frame' || el.shape === 'lane')),
  );
  const pinned = (end: Endpoint) => (end.kind === 'pinned' ? end.elementId : null);
  return elements.map((el) => {
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
    if (Math.min(Math.abs(end.x - start.x), Math.abs(end.y - start.y)) > NOTCH_MAX) return el;
    const ends = new Set([pinned(el.from), pinned(el.to)]);
    if (boxes.some((b) => !ends.has(b.id) && segmentHitsBox(start, end, b))) return el;
    const { curvePoints: _bends, ...straight } = el;
    return { ...straight, arrowStyle: 'straight' as const };
  });
}
