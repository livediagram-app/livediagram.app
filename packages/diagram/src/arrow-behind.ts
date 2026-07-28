// Arrows routing BEHIND intervening boxes (spec/90).
//
// With several boxes packed together — a parent fanning out to children —
// a straight arrow to a far child draws right over the children in
// between, and reads as though it belongs to the box it crosses. When
// `routeBehind` is on (the default), the renderer masks the line wherever
// it passes over an unrelated box, leaving a clean break a little before
// the box and resuming past it.
//
// This module picks WHICH boxes may cut an arrow. It deliberately does not
// work out where the path actually crosses: a mask hole over a box the
// arrow misses changes nothing on screen, so sampling the curve would buy
// precision nobody can see. Filtering to the arrow's bounding box is
// enough to keep the mask small.
//
// Related but separate: spec/77 bows a FRESHLY DRAWN arrow around an
// obstacle. That fires once, at creation, and changes the geometry. This
// is a render-time treatment that never moves the line. An arrow that
// bowed clear at draw time simply never crosses anything, so the two
// don't fight.

import { isBoxed, type ArrowElement, type BoxedElement, type Element } from './index';

export type Rect = { x: number; y: number; width: number; height: number };

// How far the break extends beyond the box, in canvas units. Fixed rather
// than scaled to the box or the stroke: every arrow crossing a given box
// breaks identically, which is what makes a fan of them look deliberate.
// Because it's canvas units, it scales with zoom like everything else.
export const ROUTE_BEHIND_MARGIN = 10;

// Is this arrow routing behind? Absent means yes — the default (spec/90),
// so only an explicit `false` opts out.
export function arrowRoutesBehind(arrow: ArrowElement): boolean {
  return arrow.routeBehind !== false;
}

// Which element kinds can cut an arrow.
//
// The exclusions matter more than the inclusions here, because the feature
// is ON by default and a wrong obstacle erases an arrow that should be
// visible:
//   - `frame` shapes are section BACKDROPS. Everything inside a frame sits
//     on top of it by design, so treating one as an obstacle would break
//     every arrow drawn within a section — the single worst failure this
//     feature could have.
//   - `text` and `annotation` have no fill to hide behind. Breaking a line
//     under a transparent label reads as a rendering fault, not as depth.
//   - freehand / arrows aren't boxes at all.
function isOccluder(el: Element): el is BoxedElement {
  if (!isBoxed(el)) return false;
  if (el.type === 'text' || el.type === 'annotation') return false;
  return !(el.type === 'shape' && el.shape === 'frame');
}

function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function contains(r: Rect, p: { x: number; y: number }): boolean {
  return p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;
}

// The rects to punch out of an arrow, already inflated by the margin.
// `from` / `to` are the arrow's resolved endpoints in canvas coords.
export function routeBehindHoles(
  arrow: ArrowElement,
  from: { x: number; y: number },
  to: { x: number; y: number },
  elements: Iterable<Element>,
): Rect[] {
  if (!arrowRoutesBehind(arrow)) return [];
  // The arrow's own bounding box, padded by the margin so a box just past
  // an endpoint still registers. A curve can bow outside this, which only
  // means a bow that swings wide of every obstacle keeps a hole it never
  // touches — invisible either way.
  const bounds: Rect = {
    x: Math.min(from.x, to.x) - ROUTE_BEHIND_MARGIN,
    y: Math.min(from.y, to.y) - ROUTE_BEHIND_MARGIN,
    width: Math.abs(to.x - from.x) + 2 * ROUTE_BEHIND_MARGIN,
    height: Math.abs(to.y - from.y) + 2 * ROUTE_BEHIND_MARGIN,
  };

  const holes: Rect[] = [];
  for (const el of elements) {
    if (!isOccluder(el)) continue;
    // Never cut the arrow on the elements it connects: the line has to
    // reach their edges, and the arrowhead sits on one of them.
    if (el.id === endpointId(arrow, 'from') || el.id === endpointId(arrow, 'to')) continue;
    const hole: Rect = {
      x: el.x - ROUTE_BEHIND_MARGIN,
      y: el.y - ROUTE_BEHIND_MARGIN,
      width: el.width + 2 * ROUTE_BEHIND_MARGIN,
      height: el.height + 2 * ROUTE_BEHIND_MARGIN,
    };
    // Test the endpoints against the INFLATED hole, not the raw box. An
    // arrow that stops just short of a box it isn't pinned to (a free
    // endpoint, or a gap left by the anchor) has its endpoint inside the
    // margin ring — and the arrowhead lives at that endpoint, so punching
    // the hole erased the head and left the line running into nothing.
    // Whatever we would cut is exactly what must not contain an endpoint.
    if (contains(hole, from) || contains(hole, to)) continue;
    if (!intersects(hole, bounds)) continue;
    holes.push(hole);
  }
  return holes;
}

// The element id an arrow end is pinned to, or null for the ends that
// aren't pinned to one: free points, arrow-to-arrow (spec/50), and group
// anchors (whose members are covered by the endpoint-containment rule).
function endpointId(arrow: ArrowElement, end: 'from' | 'to'): string | null {
  const a = arrow[end];
  return a.kind === 'pinned' ? a.elementId : null;
}
