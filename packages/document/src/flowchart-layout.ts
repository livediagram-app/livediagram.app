// Laying out a flowchart (docs/specs/009-elements/flowchart.md "The layout", "Swimlanes"; blueprint
// flowchart.md "Layout").
//
// A chart is laid out again after every structural change, so this is the whole of "tidy": the
// layered layout Auto Layout uses (ranks along the flow, loops ignored for ranking, crossings
// reduced, connectors on the flow's faces), with three differences. Every step keeps its own size,
// since a Decision normalised down to a Process is no longer a Decision. The first step stays where it
// is, so a growing chart never jumps away from where it was started. And a laned chart keeps every
// step inside its lane's band, the ranks shared across lanes so a column of steps lines up through
// every lane.
//
// Returned as a plan (where each step and lane goes, which faces each connector takes) rather than
// applied, so the editor lands it in the same commit as the change that caused it, against the
// elements as they stand in that commit.

import { autoLayoutElements, layerComponent } from './auto-layout';
import {
  COMPONENT_GAP,
  LAYER_GAP,
  SIBLING_GAP,
  buildEdges,
  reanchorArrow,
  type Pt,
} from './auto-layout-shared';
import {
  flowchartAnchor,
  flowchartConnectors,
  flowchartDirectionOf,
  flowchartLanes,
  flowchartSteps,
  type FlowchartDirection,
} from './flowchart';
import { laneSizeOfElement } from './lane-gutter';
import { orthogonalBends } from './arrow-orthogonal';
import type {
  Anchor,
  ArrowElement,
  Element,
  ElementId,
  ShapeElement,
  TextAlignX,
  TextAlignY,
} from './index';

/** Clear of a lane's border on every side of its body (blueprint D169). */
export const FLOWCHART_LANE_PAD = 32;
/** A lane is never thinner than a lane's default height. */
export const FLOWCHART_LANE_MIN = 200;
/** A lane shorter than this along the flow reads as a box (blueprint D170). */
export const FLOWCHART_LANE_MIN_LENGTH = 600;

export type FlowchartLaneRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  textAlignX: TextAlignX;
  textAlignY: TextAlignY;
};

export type FlowchartConnectorRoute = {
  from: Anchor;
  to: Anchor;
  // Absent: the connector keeps its own (a curved one is the author's to shape).
  arrowStyle?: 'straight' | 'angled';
  curvePoints?: { dx: number; dy: number }[];
};

export type FlowchartLayout = {
  /** New top-lefts of the steps that move. */
  steps: Map<ElementId, Pt>;
  /** New geometry and title alignment of the chart's lanes. */
  lanes: Map<ElementId, FlowchartLaneRect>;
  /** New route of the chart's connectors: faces, and for a straight or angled one its style and bends. */
  connectors: Map<ElementId, FlowchartConnectorRoute>;
};

export type FlowchartLayoutOptions = {
  /** Lay out in this direction rather than the chart's own (a direction change). */
  direction?: FlowchartDirection;
  /** Elements that keep their place: locked ones and everything on a locked layer. */
  lockedIds?: ReadonlySet<ElementId>;
};

const readingOrder = (a: ShapeElement, b: ShapeElement) => a.y - b.y || a.x - b.x;
const centreOf = (s: { x: number; y: number; width: number; height: number }): Pt => ({
  x: s.x + s.width / 2,
  y: s.y + s.height / 2,
});

// A lane reads as a row when it is wider than tall: that is how its current order is read.
const isRowLane = (lane: ShapeElement) => lane.width >= lane.height;

/** Lay out chart `id` as it stands, or in `opts.direction`. Holds only what changes. */
export function layoutFlowchart(
  elements: readonly Element[],
  id: string,
  opts: FlowchartLayoutOptions = {},
): FlowchartLayout {
  const out: FlowchartLayout = { steps: new Map(), lanes: new Map(), connectors: new Map() };
  const locked = (el: Element) => el.locked === true || opts.lockedIds?.has(el.id) === true;
  const all = flowchartSteps(elements, id);
  const steps = all.filter((s) => !locked(s));
  if (steps.length === 0) return out;
  const dir = opts.direction ?? flowchartDirectionOf(elements, id);
  const connectors = flowchartConnectors(elements, id);
  const lanes = flowchartLanes(elements, id).filter((l) => !locked(l));

  const anchor = flowchartAnchor(all, id);
  // The reference that keeps its top-left: the first step, unless it is locked (then it does not
  // move at all, and the earliest movable step holds the rest in place).
  const reference = anchor && steps.includes(anchor) ? anchor : [...steps].sort(readingOrder)[0]!;

  const placed =
    lanes.length > 0
      ? layoutLaned(steps, connectors, lanes, dir, reference)
      : layoutUnlaned(steps, connectors, dir, reference, anchor);

  const round = (p: Pt): Pt => ({ x: Math.round(p.x), y: Math.round(p.y) });
  for (const s of steps) {
    const p = placed.steps.get(s.id);
    if (!p) continue;
    const r = round(p);
    if (r.x !== s.x || r.y !== s.y) out.steps.set(s.id, r);
  }
  for (const lane of lanes) {
    const rect = placed.lanes.get(lane.id);
    if (!rect) continue;
    const r = {
      ...rect,
      ...round(rect),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    };
    if (
      r.x !== lane.x ||
      r.y !== lane.y ||
      r.width !== lane.width ||
      r.height !== lane.height ||
      r.textAlignX !== lane.textAlignX ||
      r.textAlignY !== lane.textAlignY
    )
      out.lanes.set(lane.id, r);
  }

  // Faces from the final centres, on the flow's axis; then the route between them. A straight or
  // angled connector is the layout's to route ("Angled lines bend twice" in layout-cleanup.md): down
  // to halfway, across, then down into the step, or one straight run when its ends line up (an angled
  // style with nothing to bend draws a zero-length elbow and turns its head sideways).
  const centres = new Map<ElementId, Pt>();
  for (const s of all) {
    const p = out.steps.get(s.id) ?? { x: s.x, y: s.y };
    centres.set(s.id, centreOf({ ...s, ...p }));
  }
  const axis = dir === 'down' ? 'TB' : 'LR';
  const faced = new Map<ElementId, ArrowElement>();
  for (const c of connectors) {
    if (locked(c) || c.from.kind !== 'pinned' || c.to.kind !== 'pinned') continue;
    const re = reanchorArrow(c, centres, axis);
    if (re.from.kind !== 'pinned' || re.to.kind !== 'pinned') continue;
    // reanchorArrow straightens every arrow it touches; the style is decided below instead.
    faced.set(c.id, { ...c, from: re.from, to: re.to });
  }
  const laid = (elements as Element[]).map((el) => {
    const p = out.steps.get(el.id);
    if (p && el.type === 'shape') return { ...el, ...p };
    return faced.get(el.id) ?? el;
  });
  for (const c of connectors) {
    const f = faced.get(c.id);
    if (!f || f.from.kind !== 'pinned' || f.to.kind !== 'pinned') continue;
    const route: FlowchartConnectorRoute = { from: f.from.anchor, to: f.to.anchor };
    const side = decisionSideExit(f, all, centres, dir);
    if (side && c.arrowStyle !== 'curved') {
      // Out of the Decision's side corner, across, and into the step: one bend, an L.
      route.from = side;
      route.arrowStyle = 'angled';
    } else if (c.arrowStyle !== 'curved') {
      const bends = orthogonalBends(f, laid, axis);
      route.arrowStyle = bends ? 'angled' : 'straight';
      if (bends)
        route.curvePoints = bends.map((b) => ({ dx: Math.round(b.dx), dy: Math.round(b.dy) }));
    }
    if (!sameRoute(c, route)) out.connectors.set(c.id, route);
  }
  return out;
}

/**
 * A Decision's exit that does not carry straight on leaves by a side corner
 * (docs/specs/009-elements/flowchart.md "Connectors"): the corner facing its step across the flow. The
 * exit lined up with the Decision keeps the flow's face, and a loop back up keeps the face it has.
 */
function decisionSideExit(
  c: ArrowElement,
  steps: readonly ShapeElement[],
  centres: Map<ElementId, Pt>,
  dir: FlowchartDirection,
): Anchor | undefined {
  if (c.from.kind !== 'pinned' || c.to.kind !== 'pinned') return undefined;
  const fromId = c.from.elementId;
  const source = steps.find((s) => s.id === fromId);
  if (!source || source.shape !== 'diamond') return undefined;
  const a = centres.get(fromId);
  const b = centres.get(c.to.elementId);
  if (!a || !b) return undefined;
  const ahead = dir === 'down' ? b.y - a.y : b.x - a.x;
  const across = dir === 'down' ? b.x - a.x : b.y - a.y;
  if (ahead <= 0 || Math.abs(across) < 1) return undefined;
  if (dir === 'down') return across < 0 ? 'w' : 'e';
  return across < 0 ? 'n' : 's';
}

const sameBends = (a: ArrowElement['curvePoints'], b: FlowchartConnectorRoute['curvePoints']) =>
  (a ?? []).length === (b ?? []).length &&
  (a ?? []).every((p, i) => p.dx === b![i]!.dx && p.dy === b![i]!.dy);

function sameRoute(c: ArrowElement, r: FlowchartConnectorRoute): boolean {
  if (c.from.kind !== 'pinned' || c.to.kind !== 'pinned') return false;
  if (c.from.anchor !== r.from || c.to.anchor !== r.to) return false;
  if (r.arrowStyle === undefined) return true;
  return (c.arrowStyle ?? 'straight') === r.arrowStyle && sameBends(c.curvePoints, r.curvePoints);
}

type Placed = { steps: Map<ElementId, Pt>; lanes: Map<ElementId, FlowchartLaneRect> };

// The layered layout of the connected steps, sizes fixed, translated so the reference keeps its
// place; unconnected steps line up beside the block (a column flowing down, a row flowing right).
function layoutUnlaned(
  steps: ShapeElement[],
  arrows: ArrowElement[],
  dir: FlowchartDirection,
  reference: ShapeElement,
  anchor: ShapeElement | undefined,
): Placed {
  const ids = new Set(steps.map((s) => s.id));
  const edges = buildEdges(arrows, ids);
  const connected = new Set<ElementId>();
  for (const e of edges) {
    connected.add(e.from);
    connected.add(e.to);
  }
  const pos = new Map<ElementId, Pt>();
  const linked = steps.filter((s) => connected.has(s.id));
  if (linked.length > 0) {
    const laid = autoLayoutElements([...linked, ...arrows], {
      style: 'flow',
      direction: dir === 'down' ? 'TB' : 'LR',
      fixedSizeIds: new Set(linked.map((s) => s.id)),
    });
    for (const el of laid)
      if (connected.has(el.id) && 'x' in el) pos.set(el.id, { x: el.x, y: el.y });
    // The block keeps the reference's place, or (the reference unconnected) its own earliest step's.
    const holder = connected.has(reference.id) ? reference : [...linked].sort(readingOrder)[0]!;
    const at = pos.get(holder.id)!;
    const dx = holder.x - at.x;
    const dy = holder.y - at.y;
    for (const [k, p] of pos) pos.set(k, { x: p.x + dx, y: p.y + dy });
  }

  // The unconnected steps, bar the first step (which never moves).
  const loose = steps.filter((s) => !connected.has(s.id) && s.id !== anchor?.id).sort(readingOrder);
  if (loose.length === 0) return { steps: pos, lanes: new Map() };
  const block = [...pos.entries()].map(([k, p]) => {
    const s = steps.find((x) => x.id === k)!;
    return { ...p, width: s.width, height: s.height };
  });
  if (anchor && !connected.has(anchor.id) && ids.has(anchor.id)) block.push(anchor);
  if (block.length === 0) block.push(loose[0]!);
  const left = Math.min(...block.map((b) => b.x));
  const top = Math.min(...block.map((b) => b.y));
  const right = Math.max(...block.map((b) => b.x + b.width));
  const bottom = Math.max(...block.map((b) => b.y + b.height));
  let cursor = dir === 'down' ? top : left;
  for (const s of loose) {
    if (dir === 'down') {
      pos.set(s.id, { x: right + COMPONENT_GAP, y: cursor });
      cursor += s.height + SIBLING_GAP;
    } else {
      pos.set(s.id, { x: cursor, y: bottom + COMPONENT_GAP });
      cursor += s.width + SIBLING_GAP;
    }
  }
  return { steps: pos, lanes: new Map() };
}

// Ranks shared across the lanes; each lane a flush band as thick as its tallest stack of steps.
function layoutLaned(
  steps: ShapeElement[],
  connectors: ArrowElement[],
  lanes: ShapeElement[],
  dir: FlowchartDirection,
  reference: ShapeElement,
): Placed {
  const down = dir === 'down';
  // Lanes in the order they are drawn, read along the way they currently run.
  const order = [...lanes].sort((a, b) => {
    const ka = isRowLane(a) ? a.y : a.x;
    const kb = isRowLane(b) ? b.y : b.x;
    return ka - kb || readingOrder(a, b);
  });
  const align: { textAlignX: TextAlignX; textAlignY: TextAlignY } = down
    ? { textAlignX: 'center', textAlignY: 'top' }
    : { textAlignX: 'left', textAlignY: 'middle' };
  const gutter = Math.max(...order.map((l) => laneSizeOfElement({ ...l, ...align })));
  const laneIds = new Set(order.map((l) => l.id));
  const laneOf = (s: ShapeElement) =>
    s.flowLaneId !== undefined && laneIds.has(s.flowLaneId) ? s.flowLaneId : order[0]!.id;

  const ids = steps.map((s) => s.id);
  const edges = buildEdges(connectors, new Set(ids));
  const rank = layerComponent(ids, edges);
  const ranks = Math.max(0, ...rank.values()) + 1;

  const main = (s: ShapeElement) => (down ? s.height : s.width);
  const cross = (s: ShapeElement) => (down ? s.width : s.height);
  const crossCentre = (s: ShapeElement) => (down ? s.x + s.width / 2 : s.y + s.height / 2);

  const rankSize = Array.from({ length: ranks }, () => 0);
  for (const s of steps) rankSize[rank.get(s.id)!] = Math.max(rankSize[rank.get(s.id)!]!, main(s));
  const rankStart: number[] = [];
  let m = gutter + FLOWCHART_LANE_PAD;
  for (let r = 0; r < ranks; r += 1) {
    rankStart.push(m);
    m += rankSize[r]! + LAYER_GAP;
  }
  const length = Math.max(FLOWCHART_LANE_MIN_LENGTH, m - LAYER_GAP + FLOWCHART_LANE_PAD);

  // Each lane's stacks, one per rank, in the order their steps are drawn now.
  const stacks = new Map<ElementId, ShapeElement[][]>(
    order.map((l) => [l.id, Array.from({ length: ranks }, () => [] as ShapeElement[])]),
  );
  for (const s of steps) stacks.get(laneOf(s))![rank.get(s.id)!]!.push(s);
  const stackSize = (st: ShapeElement[]) =>
    st.reduce((sum, s) => sum + cross(s), 0) + SIBLING_GAP * Math.max(0, st.length - 1);

  const local = new Map<ElementId, Pt>();
  const laneRects = new Map<ElementId, FlowchartLaneRect>();
  let c = 0;
  for (const lane of order) {
    const byRank = stacks.get(lane.id)!;
    for (const st of byRank) st.sort((a, b) => crossCentre(a) - crossCentre(b));
    const thick = Math.max(
      FLOWCHART_LANE_MIN,
      Math.max(0, ...byRank.map(stackSize)) + 2 * FLOWCHART_LANE_PAD,
    );
    byRank.forEach((st, r) => {
      let at = c + (thick - stackSize(st)) / 2;
      for (const s of st) {
        const mainPos = rankStart[r]! + (rankSize[r]! - main(s)) / 2;
        local.set(s.id, down ? { x: at, y: mainPos } : { x: mainPos, y: at });
        at += cross(s) + SIBLING_GAP;
      }
    });
    laneRects.set(lane.id, {
      ...(down
        ? { x: c, y: 0, width: thick, height: length }
        : { x: 0, y: c, width: length, height: thick }),
      ...align,
    });
    c += thick;
  }

  const ref = local.get(reference.id)!;
  const dx = reference.x - ref.x;
  const dy = reference.y - ref.y;
  const shift = <T extends Pt>(p: T): T => ({ ...p, x: p.x + dx, y: p.y + dy });
  return {
    steps: new Map([...local].map(([k, p]) => [k, shift(p)])),
    lanes: new Map([...laneRects].map(([k, r]) => [k, shift(r)])),
  };
}

/**
 * Apply a layout as PATCHES: position on a step, geometry and title alignment on a lane, route on a
 * connector, nothing else. Run inside the commit against the elements as they stand then, so a label
 * committed a moment earlier is never overwritten by the copy the layout was computed from.
 */
export function applyFlowchartLayout(elements: Element[], layout: FlowchartLayout): Element[] {
  if (layout.steps.size === 0 && layout.lanes.size === 0 && layout.connectors.size === 0)
    return elements;
  return elements.map((el) => {
    const p = layout.steps.get(el.id);
    if (p && el.type === 'shape') return { ...el, x: p.x, y: p.y };
    const lane = layout.lanes.get(el.id);
    if (lane && el.type === 'shape') return { ...el, ...lane };
    const route = layout.connectors.get(el.id);
    if (route && el.type === 'arrow' && el.from.kind === 'pinned' && el.to.kind === 'pinned') {
      const next: ArrowElement = {
        ...el,
        from: { ...el.from, anchor: route.from },
        to: { ...el.to, anchor: route.to },
      };
      if (route.arrowStyle === undefined) return next;
      next.arrowStyle = route.arrowStyle;
      if (route.curvePoints) next.curvePoints = route.curvePoints;
      else delete next.curvePoints;
      return next;
    }
    return el;
  });
}

/** The layout of chart `id`, applied: Tidy Flowchart, and every re-layout after a change. */
export function relayoutFlowchart(
  elements: Element[],
  id: string,
  opts?: FlowchartLayoutOptions,
): Element[] {
  return applyFlowchartLayout(elements, layoutFlowchart(elements, id, opts));
}
