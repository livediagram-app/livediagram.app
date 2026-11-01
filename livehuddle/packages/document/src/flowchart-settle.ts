// Keeping a flowchart tidy through the editor's ordinary edits (docs/specs/009-elements/flowchart.md
// "The layout", "Swimlanes"; blueprint D171).
//
// The flowchart's own actions lay the chart out themselves, but most structural changes arrive through
// paths that know nothing about charts: an arrow drawn from one step to another, a step or lane
// deleted, a shape's kind changed, a step dragged into another lane. Rather than teach each of those
// paths, the commit runs this over every tab it changes: any chart whose structure differs between
// `before` and `after` is laid out again, in the same commit. The layout is idempotent, so a change
// that already laid its chart out costs one more layout that moves nothing.

import {
  decisionExitLabel,
  flowchartConnectors,
  flowchartIds,
  flowchartLanes,
  flowchartSteps,
  isFlowchartStep,
} from './flowchart';
import { relayoutFlowchart } from './flowchart-layout';
import type { ArrowElement, Element, ElementId, ShapeElement } from './index';

// What a chart's layout depends on, as one comparable string: its steps (and their kinds and lanes),
// its connectors and its lanes. Positions are deliberately absent: a drag is not a structural change.
function signature(elements: readonly Element[], id: string): string {
  const steps = flowchartSteps(elements, id)
    .map(
      (s) =>
        `${s.id}:${s.shape}:${s.width}x${s.height}:${s.flowLaneId ?? ''}:${s.flowDirection ?? ''}`,
    )
    .sort();
  const connectors = flowchartConnectors(elements, id)
    .map((c) =>
      c.from.kind === 'pinned' && c.to.kind === 'pinned'
        ? `${c.from.elementId}>${c.to.elementId}`
        : '',
    )
    .sort();
  const lanes = flowchartLanes(elements, id)
    .map((l) => l.id)
    .sort();
  return `${steps.join(',')}|${connectors.join(',')}|${lanes.join(',')}`;
}

const centre = (b: { x: number; y: number; width: number; height: number }) => ({
  x: b.x + b.width / 2,
  y: b.y + b.height / 2,
});

// The smallest of `lanes` holding `step`'s centre, as frames and lanes decide containment.
function laneHolding(step: ShapeElement, lanes: readonly ShapeElement[]): ShapeElement | undefined {
  const c = centre(step);
  return lanes
    .filter((l) => c.x >= l.x && c.x <= l.x + l.width && c.y >= l.y && c.y <= l.y + l.height)
    .sort((a, b) => a.width * a.height - b.width * b.height)[0];
}

/**
 * `after`, with every chart whose structure changed since `before` laid out again: a step dragged into
 * another of its chart's lanes joins that lane, and a connector newly drawn out of a Decision takes its
 * Yes / No label. Returns `after` itself when no chart needs anything.
 */
export function settleFlowcharts(
  before: readonly Element[],
  after: Element[],
  // What the layout must leave where it is, asked for only when there is a chart to lay out.
  lockedIds: () => ReadonlySet<ElementId> = () => new Set(),
): Element[] {
  if (before === after) return after;
  const charts = new Set([...flowchartIds(before), ...flowchartIds(after)]);
  if (charts.size === 0) return after;

  const prior = new Map<ElementId, Element>(before.map((el) => [el.id, el]));
  let next = after;
  const touched = new Set<string>();

  // A step that moved and whose centre now sits in another lane of its chart has been dragged there.
  const laneMoves = new Map<ElementId, ElementId>();
  for (const el of next) {
    if (!isFlowchartStep(el)) continue;
    const was = prior.get(el.id);
    if (!was || was.type !== 'shape' || (was.x === el.x && was.y === el.y)) continue;
    const lanes = flowchartLanes(next, el.flowchartId!);
    if (lanes.length === 0) continue;
    const current = lanes.some((l) => l.id === el.flowLaneId) ? el.flowLaneId : lanes[0]!.id;
    const holder = laneHolding(el, lanes);
    if (holder && holder.id !== current) laneMoves.set(el.id, holder.id);
  }
  if (laneMoves.size > 0)
    next = next.map((el) => {
      const lane = laneMoves.get(el.id);
      return lane && el.type === 'shape' ? { ...el, flowLaneId: lane } : el;
    });

  // A connector drawn out of a Decision says Yes, then No, as one grown from it does.
  const fresh = next.filter(
    (el): el is ArrowElement =>
      el.type === 'arrow' &&
      !prior.has(el.id) &&
      !el.label &&
      el.from.kind === 'pinned' &&
      el.to.kind === 'pinned',
  );
  for (const arrow of fresh) {
    if (arrow.from.kind !== 'pinned') continue;
    const source = next.find((e) => e.id === (arrow.from as { elementId: ElementId }).elementId);
    if (!source || !isFlowchartStep(source) || source.shape !== 'diamond') continue;
    const target = next.find((e) => e.id === (arrow.to as { elementId: ElementId }).elementId);
    if (!target || !isFlowchartStep(target) || target.flowchartId !== source.flowchartId) continue;
    const label = decisionExitLabel(
      next.filter((e) => e.id !== arrow.id),
      source.id,
    );
    if (label) next = next.map((e) => (e.id === arrow.id ? { ...arrow, label } : e));
  }

  for (const id of charts) if (signature(before, id) !== signature(next, id)) touched.add(id);
  if (touched.size === 0) return next;
  const locked = lockedIds();
  for (const id of touched) next = relayoutFlowchart(next, id, { lockedIds: locked });
  return next;
}
