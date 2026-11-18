// A read .bpmn file as livediagram elements (docs/specs/020-import-export/bpmn-import.md "The mapping"): every
// BPMNShape in its bounds as the BPMN element its semantic element maps to, every BPMNEdge pinned to the elements
// its flow joins and bent through its waypoints. Linear: one pass over the shapes, one over the edges, maps by id.

import {
  anchorPosition,
  BPMN_FLOW_LOOKS,
  bpmnFields,
  bpmnKindOf,
  createShape,
  createText,
  isBpmnSymbol,
  type ArrowElement,
  type BoxedElement,
  type BpmnSymbol,
  type Element,
  type Endpoint,
  type ShapeElement,
} from '@livediagram/document';
import {
  exitSide,
  nearestAnchor,
  routeShape,
  simplifyRoute,
  snapRouteEnds,
} from '@/lib/drawio/arrow-route';
import {
  BPMN_LANE_GUTTER_PX,
  BPMN_MAX_DRAWN,
  BPMN_NAME_HEIGHT_PX,
  BPMN_NAME_WIDTH_PX,
} from './limits';
import type { BpmnFile, BpmnNode, Bounds, DiShape, Pt } from './read';

export type BpmnTally = {
  shapes: number;
  lines: number;
  /** Symbols drawn as the nearest one of their family. */
  approximated: number;
  /** Vertical pools and lanes, their titles across the top. */
  vertical: number;
  /** Shapes of no family, by element type. */
  unmatched: Map<string, number>;
  /** Shapes and lines past the cap. */
  leftOut: number;
  /** Flows with fewer than two waypoints. */
  unrouted: number;
  /** Diagrams beyond the first. */
  otherDiagrams: number;
};

type Mapped =
  | { kind: 'symbol'; symbol: BpmnSymbol; approximated: boolean }
  | { kind: 'lane' }
  | { kind: 'frame'; approximated: boolean; dashed: boolean }
  | { kind: 'text' }
  | { kind: 'unmatched' };

const TASKS: Readonly<Record<string, BpmnSymbol>> = {
  task: 'task',
  userTask: 'task-user',
  serviceTask: 'task-service',
  scriptTask: 'task-script',
  manualTask: 'task-manual',
  sendTask: 'task-send',
  receiveTask: 'task-receive',
  businessRuleTask: 'task-business-rule',
};
const SUBPROCESSES = new Set(['subProcess', 'callActivity', 'adHocSubProcess', 'transaction']);
const GATEWAYS: Readonly<Record<string, BpmnSymbol>> = {
  parallelGateway: 'gateway-parallel',
  inclusiveGateway: 'gateway-inclusive',
  eventBasedGateway: 'gateway-event',
  complexGateway: 'gateway-complex',
};
const EVENT_BASES: Readonly<Record<string, 'start' | 'intermediate' | 'end'>> = {
  startEvent: 'start',
  intermediateCatchEvent: 'intermediate',
  intermediateThrowEvent: 'intermediate',
  boundaryEvent: 'intermediate',
  endEvent: 'end',
};
const EVENT_MARKERS: Readonly<Record<string, string>> = {
  messageEventDefinition: 'message',
  timerEventDefinition: 'timer',
  errorEventDefinition: 'error',
  terminateEventDefinition: 'terminate',
};
const DATA_OBJECTS = new Set(['dataObjectReference', 'dataObject', 'dataInput', 'dataOutput']);

/** What a shape's semantic element becomes. */
export function mapNode(node: BpmnNode | undefined, di: DiShape): Mapped {
  if (!node) return { kind: 'unmatched' };
  const t = node.type;
  const base = EVENT_BASES[t];
  if (base) {
    const def = node.definitions[0];
    if (!def) return { kind: 'symbol', symbol: base, approximated: false };
    const marker = EVENT_MARKERS[def];
    const symbol = marker ? `${base}-${marker}` : '';
    return isBpmnSymbol(symbol)
      ? { kind: 'symbol', symbol, approximated: false }
      : { kind: 'symbol', symbol: base, approximated: true };
  }
  const task = TASKS[t];
  if (task) return { kind: 'symbol', symbol: task, approximated: false };
  if (SUBPROCESSES.has(t)) {
    if (di.expanded) return { kind: 'frame', approximated: true, dashed: false };
    return { kind: 'symbol', symbol: 'subprocess', approximated: t !== 'subProcess' };
  }
  if (t === 'exclusiveGateway') {
    return {
      kind: 'symbol',
      symbol: di.markerVisible ? 'gateway-exclusive' : 'gateway',
      approximated: false,
    };
  }
  const gateway = GATEWAYS[t];
  if (gateway) return { kind: 'symbol', symbol: gateway, approximated: false };
  if (DATA_OBJECTS.has(t)) return { kind: 'symbol', symbol: 'data-object', approximated: false };
  if (t === 'dataStoreReference')
    return { kind: 'symbol', symbol: 'data-store', approximated: false };
  if (t === 'participant' || t === 'lane') return { kind: 'lane' };
  if (t === 'textAnnotation') return { kind: 'text' };
  if (t === 'group') return { kind: 'frame', approximated: false, dashed: true };
  return { kind: 'unmatched' };
}

const INK = '#334155';

function colours(di: DiShape): Partial<ShapeElement> {
  return {
    ...(di.fill ? { fillColor: di.fill } : {}),
    ...(di.stroke ? { strokeColor: di.stroke } : {}),
  };
}

// A name BPMN writes outside its symbol: in the file's label bounds, else centred under the symbol.
function nameUnder(name: string, b: Bounds, label: Bounds | undefined): Element {
  const at = label ?? {
    x: b.x + b.width / 2 - BPMN_NAME_WIDTH_PX / 2,
    y: b.y + b.height + 4,
    width: BPMN_NAME_WIDTH_PX,
    height: BPMN_NAME_HEIGHT_PX,
  };
  return {
    ...createText(at.x, at.y),
    width: Math.max(at.width, 40),
    height: Math.max(at.height, BPMN_NAME_HEIGHT_PX),
    label: name,
    textSize: 'sm',
  };
}

function buildShape(
  node: BpmnNode | undefined,
  di: DiShape,
  file: BpmnFile,
  tally: BpmnTally,
): { shape: Element; name?: Element } {
  const b = di.bounds;
  const name = node?.name.trim() ?? '';
  const mapped = mapNode(node, di);
  switch (mapped.kind) {
    case 'symbol': {
      if (mapped.approximated) tally.approximated += 1;
      const symbol = mapped.symbol;
      const kind = bpmnKindOf(symbol);
      const inside = symbol.startsWith('task') || symbol === 'subprocess';
      const shape: ShapeElement = {
        ...createShape(kind, b.x, b.y),
        ...bpmnFields(symbol),
        ...b,
        label: inside ? name : '',
        textSize: 'sm',
        ...colours(di),
      };
      return { shape, ...(!inside && name ? { name: nameUnder(name, b, di.label) } : {}) };
    }
    case 'lane': {
      const shape: ShapeElement = {
        ...createShape('lane', b.x, b.y),
        ...b,
        label: name,
        textSize: 'sm',
        textBold: true,
        ...(di.horizontal
          ? {
              textAlignX: 'left',
              textAlignY: 'middle',
              titleOrientation: 'upright',
              headerSize: BPMN_LANE_GUTTER_PX,
            }
          : { textAlignX: 'center', textAlignY: 'top' }),
        ...colours(di),
      };
      if (!di.horizontal) tally.vertical += 1;
      return { shape };
    }
    case 'frame': {
      if (mapped.approximated) tally.approximated += 1;
      const title = mapped.dashed
        ? (file.categoryValues.get(node?.categoryValueRef ?? '') ?? name)
        : name;
      const shape: ShapeElement = {
        ...createShape('frame', b.x, b.y),
        ...b,
        label: title,
        textSize: 'sm',
        textAlignX: 'left',
        textAlignY: 'top',
        ...(mapped.dashed ? { strokeStyle: 'dashed' as const } : {}),
        ...colours(di),
      };
      return { shape };
    }
    case 'text':
      return {
        shape: {
          ...createText(b.x, b.y),
          ...b,
          label: name,
          textSize: 'sm',
          textAlignX: 'left',
        },
      };
    case 'unmatched': {
      const type = node?.type ?? 'unknown';
      tally.unmatched.set(type, (tally.unmatched.get(type) ?? 0) + 1);
      return {
        shape: {
          ...createShape('square', b.x, b.y),
          ...b,
          label: name || type,
          textSize: 'sm',
          ...colours(di),
        },
      };
    }
  }
}

// A flow's two ends, by their semantic refs: a data input association ends on the activity it hangs under, a data
// output association starts there.
function flowEnds(node: BpmnNode): { source?: string; target?: string } {
  if (node.type === 'dataInputAssociation')
    return { source: node.sourceRef, target: node.parentId };
  if (node.type === 'dataOutputAssociation')
    return { source: node.parentId, target: node.targetRef };
  return { source: node.sourceRef, target: node.targetRef };
}

function flowLook(node: BpmnNode | undefined): Partial<ArrowElement> {
  switch (node?.type) {
    case 'messageFlow':
      return BPMN_FLOW_LOOKS.message;
    case 'association':
      return node.direction === 'One' || node.direction === 'Both'
        ? {
            ...BPMN_FLOW_LOOKS.association,
            arrowEnds: node.direction === 'Both' ? 'both' : 'to',
            arrowheadShape: 'line',
          }
        : BPMN_FLOW_LOOKS.association;
    case 'dataInputAssociation':
    case 'dataOutputAssociation':
      return { ...BPMN_FLOW_LOOKS.association, arrowEnds: 'to', arrowheadShape: 'line' };
    default:
      return {};
  }
}

const isAxisAligned = (pts: Pt[]) =>
  pts.every((p, i) => i === 0 || p.x === pts[i - 1]!.x || p.y === pts[i - 1]!.y);

function endpointAt(
  target: BoxedElement | undefined,
  at: Pt,
  next: Pt,
): { endpoint: Endpoint; at: Pt } {
  if (!target) return { endpoint: { kind: 'free', x: at.x, y: at.y }, at };
  const anchor = nearestAnchor(target, at, exitSide(at, next));
  return {
    endpoint: { kind: 'pinned', elementId: target.id, anchor },
    at: anchorPosition(target, anchor),
  };
}

function buildFlow(
  node: BpmnNode | undefined,
  waypoints: Pt[],
  drawn: Map<string, BoxedElement>,
  stroke: string | undefined,
): ArrowElement {
  const ends = node ? flowEnds(node) : {};
  const route = simplifyRoute(waypoints);
  const n = route.length;
  const from = endpointAt(drawn.get(ends.source ?? ''), route[0]!, route[1]!);
  const to = endpointAt(drawn.get(ends.target ?? ''), route[n - 1]!, route[n - 2]!);
  const points = snapRouteEnds(route, from.at, to.at, isAxisAligned(route));
  const shape = routeShape(points, false);
  const name = node?.type === 'sequenceFlow' ? node.name.trim() : '';
  return {
    id: crypto.randomUUID(),
    type: 'arrow',
    from: from.endpoint,
    to: to.endpoint,
    ...(from.endpoint.kind === 'pinned' ? { exactStart: true } : {}),
    ...(to.endpoint.kind === 'pinned' ? { exactEnd: true } : {}),
    routeBehind: false,
    strokeColor: stroke ?? INK,
    ...(shape.arrowStyle !== 'straight' ? { arrowStyle: shape.arrowStyle } : {}),
    ...(shape.curvePoints ? { curvePoints: shape.curvePoints } : {}),
    ...flowLook(node),
    ...(name ? { label: name, textSize: 'sm' as const } : {}),
  };
}

// Pools and lanes paint first, then frames, then the symbols; names and lines over them.
const LAYER: Readonly<Record<string, number>> = { lane: 0, frame: 1 };
const layerOf = (el: Element) => (el.type === 'shape' ? (LAYER[el.shape] ?? 2) : 2);

/** The file's first diagram as elements, with the tally the report reads. */
export function convertBpmn(file: BpmnFile): { elements: Element[]; tally: BpmnTally } {
  const tally: BpmnTally = {
    shapes: 0,
    lines: 0,
    approximated: 0,
    vertical: 0,
    unmatched: new Map(),
    leftOut: 0,
    unrouted: 0,
    otherDiagrams: Math.max(0, file.diagrams - 1),
  };
  let budget = BPMN_MAX_DRAWN;
  const shapes: Element[] = [];
  const names: Element[] = [];
  const drawn = new Map<string, BoxedElement>();
  for (const di of file.shapes) {
    if (budget <= 0) {
      tally.leftOut += 1;
      continue;
    }
    budget -= 1;
    const { shape, name } = buildShape(file.nodes.get(di.bpmnElement), di, file, tally);
    shapes.push(shape);
    if (name) names.push(name);
    if (shape.type === 'shape' || shape.type === 'text') drawn.set(di.bpmnElement, shape);
    tally.shapes += 1;
  }
  const lines: Element[] = [];
  for (const edge of file.edges) {
    if (edge.waypoints.length < 2) {
      tally.unrouted += 1;
      continue;
    }
    if (budget <= 0) {
      tally.leftOut += 1;
      continue;
    }
    budget -= 1;
    lines.push(buildFlow(file.nodes.get(edge.bpmnElement), edge.waypoints, drawn, edge.stroke));
    tally.lines += 1;
  }
  // A stable sort keeps each layer in file order (a lane after its pool).
  const ordered = shapes
    .map((el, i) => ({ el, i }))
    .sort((a, b) => layerOf(a.el) - layerOf(b.el) || a.i - b.i)
    .map(({ el }) => el);
  return { elements: [...ordered, ...lines, ...names], tally };
}
