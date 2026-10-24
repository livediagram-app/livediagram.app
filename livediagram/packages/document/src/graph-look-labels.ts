// Labels on elbows, the graph look's last pass (docs/specs/015-api/mcp-server.md §4.7 "Flow lines are elbows"):
// split from graph-look.ts, whose routing passes lay the elbows these labels sit on.

import { arrowRoutePoints } from './arrow-label-layout';
import { frameHeadingRect } from './auto-layout-cluster-seats';
import { rectsIntersect, type Rect } from '@liveworkspace/document-core/geometry-primitives';
import type { Pt } from './graph-look';
import { isBoxed, type ArrowElement, type BoxedElement, type Element } from './index';

// Labels on elbows (docs/specs/015-api/mcp-server.md §4.7 "Flow lines are elbows"): an elbow's midpoint sits on the
// channel it shares with its neighbours, so their labels landed on one another. Each labelled elbow puts its label
// on a run that is its own, no other labelled arrow running along it: the drop into its target first, then the leg
// out of its source, then its longest; centred on the run, on the line. Every label is given the width of its text,
// so a short caption stays on one line on a vertical run.
// The end an arrow shares as a bus (exact, pinned), or null.
const busEnd = (a: ArrowElement) =>
  a.exactEnd && a.to.kind === 'pinned' ? `${a.to.elementId}:${a.to.anchor}` : null;

export function placeElbowLabels(elements: Element[]): Element[] {
  const labelled = elements.filter(
    (el): el is ArrowElement =>
      el.type === 'arrow' &&
      !!el.label &&
      ((el.arrowStyle === 'angled' && (el.curvePoints?.length ?? 0) > 0) ||
        // A straight line too (an elbow whose ends lined up, a staircase hand-off): one run, its middle tried first.
        (el.arrowStyle === 'straight' && el.from.kind === 'pinned' && el.to.kind === 'pinned')),
  );
  if (labelled.length === 0) return elements;
  // The route as it is drawn (the renderer's own points, bends squared onto the line), which the label's `t` measures.
  const pathOf = (a: ArrowElement): Pt[] => arrowRoutePoints(a, elements);
  const paths = new Map(labelled.map((a) => [a.id, pathOf(a)]));
  // Every line as drawn, the ones a label must keep off.
  const lines = elements
    .filter((el): el is ArrowElement => el.type === 'arrow')
    .map((el) => ({ id: el.id, pts: paths.get(el.id) ?? pathOf(el), end: busEnd(el) }));
  // The boxes a label must clear: every boxed element but the frames and lanes that hold them.
  const isHolder = (el: Element) =>
    el.type === 'shape' && (el.shape === 'frame' || el.shape === 'lane');
  const boxes = elements.filter((el): el is BoxedElement => isBoxed(el) && !isHolder(el));
  // The frames and lanes a label must not straddle, and the heading each reads by: a frame's title at its top left,
  // a lane's header strip down its left.
  const holders = elements
    .filter((el): el is BoxedElement => isBoxed(el) && isHolder(el))
    .map((h) => ({
      rect: h as Rect,
      heading:
        h.type === 'shape' && h.shape === 'lane'
          ? {
              x: h.x,
              y: h.y,
              width: (h as { headerSize?: number }).headerSize ?? 0,
              height: h.height,
            }
          : frameHeadingRect(h as { x: number; y: number; label?: string; textSize?: unknown }),
    }));
  const overlap = (p0: number, p1: number, q0: number, q1: number) =>
    Math.min(Math.max(p0, p1), Math.max(q0, q1)) > Math.max(Math.min(p0, p1), Math.min(q0, q1));
  // Whether a run (a to b) lies along a run of another labelled arrow: the same line within LABEL_CLEAR, overlapping.
  const shared = (id: string, a: Pt, b: Pt) =>
    labelled.some((o) => {
      if (o.id === id) return false;
      const q = paths.get(o.id)!;
      return q.slice(1).some((c, i) => {
        const d = q[i]!;
        if (Math.abs(a.x - b.x) < 1 && Math.abs(c.x - d.x) < 1 && Math.abs(a.x - c.x) < LABEL_CLEAR)
          return overlap(a.y, b.y, c.y, d.y);
        if (Math.abs(a.y - b.y) < 1 && Math.abs(c.y - d.y) < 1 && Math.abs(a.y - c.y) < LABEL_CLEAR)
          return overlap(a.x, b.x, c.x, d.x);
        return false;
      });
    });
  const placed = new Map<string, ArrowElement>();
  // The plates of the labels placed so far: a later label keeps off them (two "publish" labels off one bus stood
  // over each other).
  const plates: Rect[] = [];
  // A bus says its label once (§4.7 "The graph look"): the arrows merging into one node's end saying the same thing,
  // keyed here. The first places it on the drop they share; when that holds it the rest go unlabelled, else each keeps
  // its own on its leg.
  const busOf = (a: ArrowElement) =>
    a.exactEnd && a.to.kind === 'pinned'
      ? `${a.to.elementId}:${a.to.anchor}:${a.label!.trim().toLowerCase()}|${a.strokeStyle ?? 'solid'}`
      : null;
  const busSize = new Map<string, number>();
  for (const a of labelled) {
    const bus = busOf(a);
    if (bus) busSize.set(bus, (busSize.get(bus) ?? 0) + 1);
  }
  // How many arrows share each bus end, labelled or not.
  const endSize = new Map<string, number>();
  for (const el of elements)
    if (el.type === 'arrow') {
      const end = busEnd(el);
      if (end) endSize.set(end, (endSize.get(end) ?? 0) + 1);
    }
  const saidOnce = new Set<string>();
  const unlabelled = new Set<string>();
  for (const a of labelled) {
    const bus = busOf(a);
    if (bus && saidOnce.has(bus)) {
      unlabelled.add(a.id);
      continue;
    }
    const ownEnd = busEnd(a);
    // Runs on one line are one run: an elbow whose bends fall on its line draws straight, and a label needs the
    // whole of it, not either half.
    const pts = paths
      .get(a.id)!
      .filter(
        (p, i, all) => i === 0 || i === all.length - 1 || !collinear(all[i - 1]!, p, all[i + 1]!),
      );
    const lens = pts.slice(1).map((p, i) => Math.hypot(p.x - pts[i]!.x, p.y - pts[i]!.y));
    const total = lens.reduce((s, l) => s + l, 0);
    if (total <= 0) continue;
    const last = lens.length - 1;
    const byLength = lens.map((_, i) => i).sort((p, q) => lens[q]! - lens[p]!);
    // A run holds the label when its plate, centred on the run, touches no box: on a level run that also means the
    // run is long enough for it; on an upright one, that nothing stands beside it. A 126 px caption centred on a
    // 45 px drop into its target sat over the target.
    const width = labelWidth(a.label!);
    // Where along run i its label's plate, centred on the run, touches no box and straddles no frame or lane border:
    // its middle first, then a quarter or a third of the way from either end (a short drop between two lanes is
    // clear inside one of them, not across the gap). On a level run that also means the run is long enough; on an
    // upright one, that nothing stands beside it. Null when no point of the run holds it.
    const spot = (i: number, strict = true): number | null => {
      const level = Math.abs(pts[i]!.y - pts[i + 1]!.y) < 1;
      if (lens[i]! < (level ? width + LABEL_RUN_MARGIN : LABEL_CLEAR + LABEL_RUN_MARGIN))
        return null;
      // An upright run also tries the spots just clear of either end, a label tucked under its source or over its
      // target, inside that end's lane when the run's middle crosses into the next.
      const tucked = (LABEL_CLEAR / 2 + LABEL_TUCK) / lens[i]!;
      // And the middle of each gap between two frames or lanes it crosses, where a label touches neither border.
      const [y0, y1] = [pts[i]!.y, pts[i + 1]!.y];
      const edges = holders
        .flatMap(({ rect }) => [rect.y, rect.y + rect.height])
        .filter((y) => y > Math.min(y0, y1) && y < Math.max(y0, y1))
        .sort((p, q) => p - q);
      const gaps = edges
        .slice(1)
        .map((y, k) => [edges[k]!, y] as const)
        .filter(([top, bottom]) => bottom - top >= LABEL_CLEAR)
        .map(([top, bottom]) => ((top + bottom) / 2 - y0) / (y1 - y0));
      const spots = level ? LABEL_SPOTS : [...LABEL_SPOTS, ...gaps, tucked, 1 - tucked];
      for (const f of spots) {
        const cx = pts[i]!.x + (pts[i + 1]!.x - pts[i]!.x) * f;
        const cy = pts[i]!.y + (pts[i + 1]!.y - pts[i]!.y) * f;
        // Off the middle, a level run must still hold the whole plate.
        if (level && Math.min(f, 1 - f) * lens[i]! < width / 2 + LABEL_RUN_MARGIN / 2) continue;
        const plate = { x: cx - width / 2, y: cy - LABEL_CLEAR / 2, width, height: LABEL_CLEAR };
        const clear =
          !boxes.some(
            (b) =>
              Math.abs(cx - (b.x + b.width / 2)) < (width + b.width) / 2 &&
              Math.abs(cy - (b.y + b.height / 2)) < (LABEL_CLEAR + b.height) / 2,
          ) &&
          !holders.some(
            ({ rect, heading }) =>
              straddles(plate, rect) || (heading !== null && rectsIntersect(plate, heading)),
          ) &&
          // Strict, off every other line too, not only labelled ones: a neighbour's drop struck a label through. A line
          // of its own bus runs the shared drop with it, its own line there.
          (!strict ||
            !lines.some(
              (l) =>
                l.id !== a.id &&
                !(i === last && ownEnd !== null && l.end === ownEnd) &&
                l.pts.some((p, k) => k > 0 && segmentHitsRect(l.pts[k - 1]!, p, plate)),
            ));
        if (clear && !plates.some((r) => rectsIntersect(plate, r))) return f;
      }
      return null;
    };
    // Beside run i rather than on it: the plate just off the line, either side, where it touches no box, frame border
    // or heading, and no line at all. A wide label on a drop beside a neighbour's drop was struck through by it.
    // The offset is along the run's left-hand normal, as the renderer reads labelOffset.
    const besideSpot = (i: number): { f: number; offset: number } | null => {
      const [p, q] = [pts[i]!, pts[i + 1]!];
      if (lens[i]! < LABEL_CLEAR + LABEL_RUN_MARGIN) return null;
      const u = { x: (q.x - p.x) / lens[i]!, y: (q.y - p.y) / lens[i]! };
      const n = { x: -u.y, y: u.x };
      const reach =
        Math.abs(n.x) * (width / 2) + Math.abs(n.y) * (LABEL_CLEAR / 2) + LABEL_BESIDE_GAP;
      for (const f of LABEL_SPOTS)
        for (const sign of [1, -1]) {
          const cx = p.x + (q.x - p.x) * f + n.x * reach * sign;
          const cy = p.y + (q.y - p.y) * f + n.y * reach * sign;
          const plate = { x: cx - width / 2, y: cy - LABEL_CLEAR / 2, width, height: LABEL_CLEAR };
          const clear =
            !boxes.some((b) => rectsIntersect(plate, b)) &&
            !holders.some(
              ({ rect, heading }) =>
                straddles(plate, rect) || (heading !== null && rectsIntersect(plate, heading)),
            ) &&
            !lines.some((l) =>
              l.pts.some((pt, k) => k > 0 && segmentHitsRect(l.pts[k - 1]!, pt, plate)),
            );
          if (clear && !plates.some((r) => rectsIntersect(plate, r)))
            return { f, offset: Number((reach * sign).toFixed(2)) };
        }
      return null;
    };
    const holds = (i: number) => spot(i) !== null;
    // The first of a bus: its drop into the node, the stretch every arrow of the bus shares, or each keeps its own.
    const onBus =
      (bus && busSize.get(bus)! > 1) || (ownEnd !== null && endSize.get(ownEnd)! > 1)
        ? holds(last)
          ? { centred: last, beside: undefined }
          : besideSpot(last)
            ? { centred: undefined, beside: { i: last, at: besideSpot(last) } }
            : null
        : null;
    if (onBus && bus) saidOnce.add(bus);
    const centred = onBus
      ? onBus.centred
      : ([last, 0, ...byLength].find((i) => holds(i) && !shared(a.id, pts[i]!, pts[i + 1]!)) ??
        // Beside another labelled line is better than over a box.
        byLength.find(holds));
    // No run holds it on the line: beside one, clear of every line, before over another line or a box.
    const beside =
      onBus?.beside ??
      (centred === undefined
        ? byLength.map((i) => ({ i, at: besideSpot(i) })).find(({ at }) => at !== null)
        : undefined);
    const seg =
      centred ?? beside?.i ?? byLength.find((i) => spot(i, false) !== null) ?? byLength[0]!;
    const before = lens.slice(0, seg).reduce((s, l) => s + l, 0);
    const f = beside?.at?.f ?? spot(seg) ?? spot(seg, false) ?? 0.5;
    const along = f * lens[seg]!;
    {
      const [p, q] = [pts[seg]!, pts[seg + 1]!];
      const u =
        lens[seg]! > 0
          ? { x: (q.x - p.x) / lens[seg]!, y: (q.y - p.y) / lens[seg]! }
          : { x: 1, y: 0 };
      const off = beside?.at?.offset ?? 0;
      const cx = p.x + (q.x - p.x) * f - u.y * off;
      const cy = p.y + (q.y - p.y) * f + u.x * off;
      // Stored at the text's own width, its clearing margin off: a later plate with its margin then keeps one margin
      // from it, not two (two "items picked"-wide margins pushed a label off the only spot it had).
      plates.push({
        x: cx - width / 2 + LABEL_WIDTH_MARGIN / 2,
        y: cy - LABEL_CLEAR / 2,
        width: Math.max(1, width - LABEL_WIDTH_MARGIN),
        height: LABEL_CLEAR,
      });
    }
    placed.set(a.id, {
      ...a,
      labelOffset: {
        t: Number(((before + along) / total).toFixed(4)),
        offset: beside?.at?.offset ?? 0,
      },
      labelMaxWidth: Math.ceil(width),
    });
  }
  return elements.map((el) => {
    if (!unlabelled.has(el.id)) return placed.get(el.id) ?? el;
    const { label: _label, ...rest } = el as ArrowElement;
    return rest;
  });
}

// How far a label's plate keeps off a frame's or lane's border, in px: inside by a pixel, "HTTPS" read as sitting
// on the Clients frame's edge.
const LABEL_BORDER_CLEAR = 6;
// Whether a plate, grown by LABEL_BORDER_CLEAR, crosses a frame's or lane's border: neither wholly inside it nor clear.
const straddles = (plate: Rect, rect: Rect) => {
  const near = {
    x: plate.x - LABEL_BORDER_CLEAR,
    y: plate.y - LABEL_BORDER_CLEAR,
    width: plate.width + 2 * LABEL_BORDER_CLEAR,
    height: plate.height + 2 * LABEL_BORDER_CLEAR,
  };
  return rectsIntersect(near, rect) && !rectWithin(near, rect);
};
// Whether a segment passes through a rectangle (its interior; touching an edge does not count).
function segmentHitsRect(a: Pt, b: Pt, r: Rect): boolean {
  const [x0, x1, y0, y1] = [r.x, r.x + r.width, r.y, r.y + r.height];
  let [t0, t1] = [0, 1];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  for (const [p, q] of [
    [-dx, a.x - x0],
    [dx, x1 - a.x],
    [-dy, a.y - y0],
    [dy, y1 - a.y],
  ] as const) {
    if (p === 0) {
      if (q <= 0) return false;
      continue;
    }
    const t = q / p;
    if (p < 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
    if (t0 >= t1) return false;
  }
  return true;
}
const rectWithin = (a: Rect, b: Rect) =>
  a.x >= b.x && a.y >= b.y && a.x + a.width <= b.x + b.width && a.y + a.height <= b.y + b.height;

// How close two runs may be before a label on one would sit on the other: a label's height and some.
const LABEL_CLEAR = 22;
// The points along a run a label is tried at, as fractions of it: the middle, then a quarter and a third in from
// either end.
const LABEL_SPOTS = [0.5, 0.25, 0.75, 1 / 3, 2 / 3] as const;
// The gap a tucked label keeps from the box at its run's end.
const LABEL_TUCK = 4;
// How far a label set beside its line keeps off it, in px.
const LABEL_BESIDE_GAP = 6;
// Room a run keeps beyond its label, so the label clears the boxes at the run's ends.
const LABEL_RUN_MARGIN = 16;

// Whether b lies on the line from a to c: the same row or the same column within a pixel.
const collinear = (a: Pt, b: Pt, c: Pt) =>
  (Math.abs(a.y - b.y) < 1 && Math.abs(b.y - c.y) < 1) ||
  (Math.abs(a.x - b.x) < 1 && Math.abs(b.x - c.x) < 1);

// A caption's one-line width at the arrow label's default size, with room for its plate.
// The room a label's plate takes beyond its text, keeping it clear of what it sits beside, in px.
const LABEL_WIDTH_MARGIN = 18;
// The width an elbow label is given (its text's estimate and a clearing margin), at most 260.
export const labelWidth = (label: string) =>
  Math.min(260, label.length * 12 * 0.56 + LABEL_WIDTH_MARGIN);
