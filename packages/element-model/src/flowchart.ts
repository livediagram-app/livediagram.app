// The flowchart (docs/specs/009-elements/flowchart.md): what a step is, which chart it belongs to, the
// connectors between its steps, its first step and which way it flows. Shared by every product that
// holds flowcharts (livediagram, liveplanner); each product's own model package adds the factories that
// make a step of its own shape kinds.
//
// A step is an ordinary shape of one of the classic flowchart kinds carrying a `flowchartId`; a lane
// is an ordinary Lane carrying one. The connectors are the pinned arrows you can already see between
// two steps of the same chart, so a chart is a graph (merges and loops) rather than a tree, and
// nothing here keeps a second copy of it.
//
// Pure reads over the element list; the layout (flowchart-layout.ts) and each product's growth
// (flowchart-grow.ts) build on these. The reads that hand elements back are generic, so a caller keeps
// its product's precise element type.

import type { ArrowElement, Element, ElementId, ShapeElement } from './element';

export type FlowchartDirection = 'down' | 'right';

export const FLOWCHART_DIRECTIONS: readonly FlowchartDirection[] = ['down', 'right'];

export function isFlowchartDirection(v: unknown): v is FlowchartDirection {
  return v === 'down' || v === 'right';
}

/** Title Case, for the menu tiles. */
export const FLOWCHART_DIRECTION_LABEL: Record<FlowchartDirection, string> = {
  down: 'Down',
  right: 'Right',
};

export type FlowchartStepType =
  | 'terminator'
  | 'process'
  | 'decision'
  | 'io'
  | 'document'
  | 'database'
  | 'preparation'
  | 'connector';

/** In the order every menu lists them: the five a flow is mostly made of, then the rest. */
export const FLOWCHART_STEP_TYPES: readonly FlowchartStepType[] = [
  'terminator',
  'process',
  'decision',
  'io',
  'document',
  'database',
  'preparation',
  'connector',
];

/** The shape kinds a step draws: one per step type. */
export type FlowchartStepKind =
  | 'stadium'
  | 'square'
  | 'diamond'
  | 'parallelogram'
  | 'document'
  | 'cylinder'
  | 'hexagon'
  | 'circle';

// A step's type IS its shape kind (the spec's step type table); there is no separate field to
// disagree with the drawing.
export const FLOWCHART_STEP_KIND: Record<FlowchartStepType, FlowchartStepKind> = {
  terminator: 'stadium',
  process: 'square',
  decision: 'diamond',
  io: 'parallelogram',
  document: 'document',
  database: 'cylinder',
  preparation: 'hexagon',
  connector: 'circle',
};

export const FLOWCHART_STEP_SIZE: Record<FlowchartStepType, { width: number; height: number }> = {
  terminator: { width: 200, height: 64 },
  process: { width: 200, height: 72 },
  decision: { width: 200, height: 120 },
  io: { width: 220, height: 72 },
  document: { width: 200, height: 84 },
  database: { width: 160, height: 96 },
  preparation: { width: 200, height: 72 },
  connector: { width: 56, height: 56 },
};

export const FLOWCHART_STEP_LABEL: Record<FlowchartStepType, string> = {
  terminator: 'Start / End',
  process: 'Process',
  decision: 'Decision',
  io: 'Input / Output',
  document: 'Document',
  database: 'Database',
  preparation: 'Preparation',
  connector: 'Connector',
};

/** What a label reads on the first step the palette places. */
const FLOWCHART_START_LABEL = 'Start';

const TYPE_OF_KIND = new Map<string, FlowchartStepType>(
  FLOWCHART_STEP_TYPES.map((t) => [FLOWCHART_STEP_KIND[t], t]),
);

/** The step type a shape kind draws, or undefined for a kind no step can be. */
export function flowchartStepTypeOf(kind: string): FlowchartStepType | undefined {
  return TYPE_OF_KIND.get(kind);
}

/** A product's shape element, out of its element union. */
type ShapeOf<E> = Extract<E, { type: 'shape' }>;
/** A product's arrow element, out of its element union. */
type ArrowOf<E> = Extract<E, { type: 'arrow' }>;

const isStep = (el: Element): boolean =>
  el.type === 'shape' &&
  typeof el.flowchartId === 'string' &&
  el.flowchartId !== '' &&
  TYPE_OF_KIND.has(el.shape);

const isLane = (el: Element): boolean =>
  el.type === 'shape' &&
  el.shape === 'lane' &&
  typeof el.flowchartId === 'string' &&
  el.flowchartId !== '';

export function isFlowchartStep<E extends Element>(el: E): el is ShapeOf<E> {
  return isStep(el);
}

export function isFlowchartLane<E extends Element>(el: E): el is ShapeOf<E> {
  return isLane(el);
}

export function flowchartSteps<E extends Element>(
  elements: readonly E[],
  id: string,
): ShapeOf<E>[] {
  return elements.filter(
    (el): el is ShapeOf<E> => isStep(el) && (el as ShapeElement).flowchartId === id,
  );
}

export function flowchartLanes<E extends Element>(
  elements: readonly E[],
  id: string,
): ShapeOf<E>[] {
  return elements.filter(
    (el): el is ShapeOf<E> => isLane(el) && (el as ShapeElement).flowchartId === id,
  );
}

/** Every chart id on the tab, in the order its first member appears. */
export function flowchartIds(elements: readonly Element[]): string[] {
  const out = new Set<string>();
  for (const el of elements)
    if (isFlowchartStep(el) || isFlowchartLane(el)) out.add(el.flowchartId!);
  return [...out];
}

/**
 * The connectors of a chart: pinned arrows from one of its steps to another, never to itself. An
 * arrow between two charts belongs to neither.
 */
export function flowchartConnectors<E extends Element>(
  elements: readonly E[],
  id: string,
): ArrowOf<E>[] {
  const steps = new Set(flowchartSteps(elements, id).map((s) => s.id));
  return elements.filter(
    (el): el is ArrowOf<E> =>
      el.type === 'arrow' &&
      el.from.kind === 'pinned' &&
      el.to.kind === 'pinned' &&
      el.from.elementId !== el.to.elementId &&
      steps.has(el.from.elementId) &&
      steps.has(el.to.elementId),
  );
}

const readingOrder = (a: ShapeElement, b: ShapeElement) => a.y - b.y || a.x - b.x;

/**
 * The step that never moves: the one the chart was started from (its id is the chart's), else the
 * earliest in reading order.
 */
export function flowchartAnchor<S extends ShapeElement>(
  steps: readonly S[],
  id: string,
): S | undefined {
  return steps.find((s) => s.id === id) ?? [...steps].sort(readingOrder)[0];
}

/**
 * Which way the chart flows: its first step's say, else any step's, else right once it has lanes and
 * down without.
 */
export function flowchartDirectionOf(elements: readonly Element[], id: string): FlowchartDirection {
  const set = flowchartExplicitDirection(elements, id);
  if (set) return set;
  return flowchartLanes(elements, id).length > 0 ? 'right' : 'down';
}

/** The direction someone chose for the chart, if anyone did: its first step's, else any step's. */
export function flowchartExplicitDirection(
  elements: readonly Element[],
  id: string,
): FlowchartDirection | undefined {
  const steps = flowchartSteps(elements, id);
  return (
    flowchartAnchor(steps, id)?.flowDirection ?? steps.find((s) => s.flowDirection)?.flowDirection
  );
}

/** The chart a step or lane belongs to, if any. */
export function flowchartIdOf(
  elements: readonly Element[],
  elementId: ElementId,
): string | undefined {
  const el = elements.find((e) => e.id === elementId);
  return el && (isFlowchartStep(el) || isFlowchartLane(el)) ? el.flowchartId : undefined;
}

const sameWord = (label: string | undefined, word: string) =>
  (label ?? '').trim().toLowerCase() === word.toLowerCase();

/**
 * The label a new exit of `sourceId` takes (docs/specs/009-elements/flowchart.md "Connectors"): a
 * Decision's first exit says Yes, its second No, and any further one nothing.
 */
export function decisionExitLabel(
  elements: readonly Element[],
  sourceId: ElementId,
): 'Yes' | 'No' | undefined {
  const source = elements.find((el) => el.id === sourceId);
  if (!source || !isFlowchartStep(source) || source.shape !== 'diamond') return undefined;
  const exits = flowchartConnectors(elements, source.flowchartId!).filter(
    (a: ArrowElement) => a.from.kind === 'pinned' && a.from.elementId === sourceId,
  );
  if (!exits.some((a) => sameWord(a.label, 'Yes'))) return 'Yes';
  if (!exits.some((a) => sameWord(a.label, 'No'))) return 'No';
  return undefined;
}

/** A product's own shape factory: a shape of `kind` at (x, y), at the kind's size and in its look. */
export type FlowchartShapeMaker<S extends ShapeElement> = (
  kind: FlowchartStepKind | 'lane',
  x: number,
  y: number,
) => S;

/** The step factories, bound to a product's own shape factory. */
export function flowchartStepMakers<S extends ShapeElement>(createShape: FlowchartShapeMaker<S>) {
  /** A step of `type`, sized for it, with no chart yet. */
  const createFlowchartStep = (type: FlowchartStepType, x: number, y: number): S => ({
    ...createShape(FLOWCHART_STEP_KIND[type], x, y),
    ...FLOWCHART_STEP_SIZE[type],
  });
  /**
   * The first step the palette places, centred on (cx, cy): a Start / End reading "Start", whose id is
   * the new chart's.
   */
  const createFlowchartStart = (cx: number, cy: number): S => {
    const { width, height } = FLOWCHART_STEP_SIZE.terminator;
    const step = createFlowchartStep('terminator', cx - width / 2, cy - height / 2);
    return { ...step, label: FLOWCHART_START_LABEL, flowchartId: step.id };
  };
  return { createFlowchartStep, createFlowchartStart };
}
