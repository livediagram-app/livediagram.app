// Growing and reshaping a flowchart (docs/specs/009-elements/flowchart.md; blueprint flowchart.md
// "Growth", "Other changes").
//
// Every change here ends in the chart's layout, computed against the elements WITH the change, so
// one keystroke or one menu pick is one commit and one undo step, layout included. Growth returns a
// plan (the new step, its connector, the layout) because the editor needs the new step to select and
// scroll to; the rest return the changed element list, ready to drop into a commit.
//
// Shared by every product that holds flowcharts. The two changes that make a step or a lane take the
// product's own shape factory (flowchartGrowth), since a new shape carries that product's look; the
// rest only move and patch what is already there, generic so a caller keeps its own element type.

import { LAYER_GAP, SIBLING_GAP } from './auto-layout-shared';
import {
  FLOWCHART_STEP_KIND,
  FLOWCHART_STEP_SIZE,
  decisionExitLabel,
  flowchartStepMakers,
  flowchartConnectors,
  flowchartDirectionOf,
  flowchartExplicitDirection,
  flowchartLanes,
  flowchartSteps,
  isFlowchartLane,
  isFlowchartStep,
  type FlowchartDirection,
  type FlowchartShapeMaker,
  type FlowchartStepType,
} from './flowchart';
import {
  applyFlowchartLayout,
  layoutFlowchart,
  relayoutFlowchart,
  type FlowchartLayout,
  type FlowchartLayoutOptions,
} from './flowchart-layout';
import type { ArrowElement, Element, ElementId, ShapeElement } from './element';

export type FlowchartGrowth = 'next' | 'parallel';

/** A product's shape element, out of its element union. */
type ShapeOf<E> = Extract<E, { type: 'shape' }>;
/** A product's arrow element, out of its element union. */
type ArrowOf<E> = Extract<E, { type: 'arrow' }>;

export type FlowchartStepPlan<
  S extends ShapeElement = ShapeElement,
  A extends ArrowElement = ArrowElement,
> = {
  step: S;
  connector: A;
  /** The chart's layout with the step and its connector in it. */
  layout: FlowchartLayout;
  /** The step whose look the new one copies: the chart's latest of the same type. */
  styleFrom: S | null;
  /** The connector whose look the new one copies: the chart's latest. */
  connectorStyleFrom: A | null;
};

const stepOf = (elements: readonly Element[], id: ElementId) => {
  const el = elements.find((e) => e.id === id);
  return el && isFlowchartStep(el) ? el : undefined;
};

/**
 * Where a step grows FROM: the selected step for the next step; for a parallel one, the step the
 * selected one came from (its first incoming connector), else the selected step itself, since a step
 * nothing leads to has no branch to sit beside.
 */
function flowchartGrowthSource(
  elements: readonly Element[],
  from: ShapeElement,
  kind: FlowchartGrowth,
): ShapeElement {
  if (kind === 'next') return from;
  const into = flowchartConnectors(elements, from.flowchartId!).find(
    (a) => a.to.kind === 'pinned' && a.to.elementId === from.id,
  );
  const source =
    into && into.from.kind === 'pinned' ? stepOf(elements, into.from.elementId) : undefined;
  return source ?? from;
}

// Seeded one rank past the source and just past its furthest existing exit, so the layout's order
// puts the new step after its siblings: a Decision's Yes before its No.
function seedPosition(
  elements: readonly Element[],
  source: ShapeElement,
  size: { width: number; height: number },
  dir: FlowchartDirection,
): { x: number; y: number } {
  const exits = flowchartConnectors(elements, source.flowchartId!)
    .filter((a) => a.from.kind === 'pinned' && a.from.elementId === source.id)
    .flatMap((a) => (a.to.kind === 'pinned' ? [stepOf(elements, a.to.elementId)] : []))
    .filter((s): s is ShapeElement => s !== undefined);
  if (dir === 'down') {
    const y = source.y + source.height + LAYER_GAP;
    const x =
      exits.length > 0
        ? Math.max(...exits.map((s) => s.x + s.width)) + SIBLING_GAP
        : source.x + (source.width - size.width) / 2;
    return { x, y };
  }
  const x = source.x + source.width + LAYER_GAP;
  const y =
    exits.length > 0
      ? Math.max(...exits.map((s) => s.y + s.height)) + SIBLING_GAP
      : source.y + (source.height - size.height) / 2;
  return { x, y };
}

/** The chart's most recently added step of `type`, for the new step's look. */
function latestOfType(
  elements: readonly Element[],
  chartId: string,
  type: FlowchartStepType,
): ShapeElement | null {
  const same = flowchartSteps(elements, chartId).filter(
    (s) => s.shape === FLOWCHART_STEP_KIND[type],
  );
  return same[same.length - 1] ?? null;
}

// planFlowchartStep (flowchartGrowth, below), with the product's step factory.
function planStep(
  createFlowchartStep: (type: FlowchartStepType, x: number, y: number) => ShapeElement,
  elements: readonly Element[],
  fromId: ElementId,
  kind: FlowchartGrowth,
  ids: { step: ElementId; connector: ElementId },
  type: FlowchartStepType,
  opts: Pick<FlowchartLayoutOptions, 'lockedIds'>,
): FlowchartStepPlan | null {
  const from = stepOf(elements, fromId);
  if (!from) return null;
  const chartId = from.flowchartId!;
  const source = flowchartGrowthSource(elements, from, kind);
  const dir = flowchartDirectionOf(elements, chartId);
  const size = FLOWCHART_STEP_SIZE[type];
  const at = seedPosition(elements, source, size, dir);
  const step: ShapeElement = {
    ...createFlowchartStep(type, at.x, at.y),
    id: ids.step,
    flowchartId: chartId,
    ...(from.flowDirection ? { flowDirection: from.flowDirection } : {}),
    ...(from.flowLaneId ? { flowLaneId: from.flowLaneId } : {}),
  };
  const label = decisionExitLabel(elements, source.id);
  // A pinned arrow as every product's createPinnedArrow makes one, with the caller's id.
  const connector: ArrowElement = {
    id: ids.connector,
    type: 'arrow',
    from: { kind: 'pinned', elementId: source.id, anchor: dir === 'down' ? 's' : 'e' },
    to: { kind: 'pinned', elementId: step.id, anchor: dir === 'down' ? 'n' : 'w' },
    arrowStyle: 'angled',
    ...(label ? { label } : {}),
  };
  const existing = flowchartConnectors(elements, chartId);
  const layout = layoutFlowchart([...elements, step, connector], chartId, opts);
  return {
    step: { ...step, ...(layout.steps.get(step.id) ?? {}) },
    connector,
    layout,
    styleFrom: latestOfType(elements, chartId, type),
    connectorStyleFrom: existing[existing.length - 1] ?? null,
  };
}

/**
 * Land a growth plan: the step and its connector (dressed by the caller, if it likes), then the
 * layout over everything, so the new connector takes its route too.
 */
export function applyFlowchartStep<
  S extends ShapeElement,
  A extends ArrowElement,
  E extends Element = S | A,
>(
  elements: E[],
  plan: FlowchartStepPlan<S, A>,
  step: S = plan.step,
  connector: A = plan.connector,
): (E | S | A)[] {
  return applyFlowchartLayout<E | S | A>([...elements, step, connector], plan.layout);
}

/** A step's type changed (its kind and size, about its old centre), then the chart laid out. */
export function retypeFlowchartStep<E extends Element>(
  elements: E[],
  stepId: ElementId,
  type: FlowchartStepType,
  opts?: FlowchartLayoutOptions,
): E[] {
  const step = stepOf(elements, stepId);
  if (!step) return elements;
  const kind = FLOWCHART_STEP_KIND[type];
  const size = FLOWCHART_STEP_SIZE[type];
  if (step.shape === kind && step.width === size.width && step.height === size.height)
    return elements;
  const cx = step.x + step.width / 2;
  const cy = step.y + step.height / 2;
  const next = (elements as Element[]).map((el) =>
    el.id === stepId
      ? {
          ...step,
          shape: kind,
          ...size,
          x: Math.round(cx - size.width / 2),
          y: Math.round(cy - size.height / 2),
        }
      : el,
  ) as E[];
  return relayoutFlowchart(next, step.flowchartId!, opts);
}

/** Every step's direction set, then the chart laid out that way (its lanes turn with it). */
export function setFlowchartDirection<E extends Element>(
  elements: E[],
  chartId: string,
  direction: FlowchartDirection,
  opts?: FlowchartLayoutOptions,
): E[] {
  const next = (elements as Element[]).map((el) =>
    isFlowchartStep(el) && el.flowchartId === chartId ? { ...el, flowDirection: direction } : el,
  ) as E[];
  return relayoutFlowchart(next, chartId, { ...opts, direction });
}

/** What a new lane is titled: "Lane <n>". */
const flowchartLaneTitle = (n: number) => `Lane ${n}`;

// addFlowchartLane (flowchartGrowth, below), with the product's shape factory.
function addLane(
  createShape: FlowchartShapeMaker<ShapeElement>,
  elements: Element[],
  chartId: string,
  laneIds: readonly [ElementId, ElementId],
  opts?: FlowchartLayoutOptions,
): Element[] {
  const steps = flowchartSteps(elements, chartId);
  if (steps.length === 0) return elements;
  const lanes = flowchartLanes(elements, chartId);
  // A laned chart flows right unless it was set otherwise, so its lanes are rows unless it flows down.
  const rows = (flowchartExplicitDirection(elements, chartId) ?? 'right') === 'right';
  const boxes = [...steps, ...lanes];
  const left = Math.min(...steps.map((s) => s.x));
  const top = Math.min(...steps.map((s) => s.y));
  const right = Math.max(...boxes.map((b) => b.x + b.width));
  const bottom = Math.max(...boxes.map((b) => b.y + b.height));
  // Seeded where it reads in order (the first over the steps, a later one past everything); the
  // layout gives every lane its real geometry.
  const lane = (id: ElementId, n: number, at: 'start' | 'end'): ShapeElement => {
    const base = createShape('lane', 0, 0);
    const shape = rows
      ? { x: left, y: at === 'start' ? top : bottom + 1 }
      : { x: at === 'start' ? left : right + 1, y: top, width: base.height, height: base.width };
    return { ...base, ...shape, id, label: flowchartLaneTitle(n), flowchartId: chartId };
  };
  if (lanes.length > 0)
    return relayoutFlowchart(
      [lane(laneIds[0], lanes.length + 1, 'end'), ...elements],
      chartId,
      opts,
    );
  const first = lane(laneIds[0], 1, 'start');
  const inFirst = elements.map((el) =>
    isFlowchartStep(el) && el.flowchartId === chartId ? { ...el, flowLaneId: first.id } : el,
  );
  return relayoutFlowchart([first, lane(laneIds[1], 2, 'end'), ...inFirst], chartId, opts);
}

/** A step moved into another of its chart's lanes, then the chart laid out. */
export function moveStepToLane<E extends Element>(
  elements: E[],
  stepId: ElementId,
  laneId: ElementId,
  opts?: FlowchartLayoutOptions,
): E[] {
  const step = stepOf(elements, stepId);
  const lane = elements.find((e) => e.id === laneId);
  if (!step || !lane || !isFlowchartLane(lane) || lane.flowchartId !== step.flowchartId)
    return elements;
  if (step.flowLaneId === laneId) return elements;
  const next = (elements as Element[]).map((el) =>
    el.id === stepId ? { ...step, flowLaneId: laneId } : el,
  ) as E[];
  return relayoutFlowchart(next, step.flowchartId!, opts);
}

/**
 * The changes that make a step or a lane, bound to a product's own shape factory: Tab and Enter's
 * planFlowchartStep and Add Lane's addFlowchartLane, each typed with the product's elements.
 */
export function flowchartGrowth<E extends Element>(createShape: FlowchartShapeMaker<ShapeOf<E>>) {
  const { createFlowchartStep } = flowchartStepMakers(createShape);
  return {
    /**
     * Plan a step grown from `fromId` (Tab: the next step; Enter: a parallel one). `ids` are minted by
     * the caller so the plan is deterministic inside a state updater that may run twice.
     */
    planFlowchartStep: (
      elements: readonly E[],
      fromId: ElementId,
      kind: FlowchartGrowth,
      ids: { step: ElementId; connector: ElementId },
      type: FlowchartStepType = 'process',
      opts: Pick<FlowchartLayoutOptions, 'lockedIds'> = {},
    ) =>
      planStep(createFlowchartStep, elements, fromId, kind, ids, type, opts) as FlowchartStepPlan<
        ShapeOf<E>,
        ArrowOf<E>
      > | null,
    /**
     * Add Lane (docs/specs/009-elements/flowchart.md "Swimlanes"). A chart without lanes gets two, every
     * step in the first; a laned one gets the next at the end. `laneIds` supplies ids for the new lanes
     * (two at most). Lanes go to the BACK of the element list, under the steps they hold.
     */
    addFlowchartLane: (
      elements: E[],
      chartId: string,
      laneIds: readonly [ElementId, ElementId],
      opts?: FlowchartLayoutOptions,
    ) => addLane(createShape, elements, chartId, laneIds, opts) as E[],
  };
}
