// draw.io's BPMN stencils as livediagram's BPMN elements (docs/specs/020-import-export/drawio-import.md "BPMN
// stencils"): an event, task, gateway or data shape lands as its kind wearing the BPMN mark its style keys name,
// rather than a labelled box. A marker livediagram does not draw lands as its family's plain symbol, approximated.

import { bpmnKindOf, isBpmnSymbol, type BpmnSymbol, type ShapeKind } from '@livediagram/document';
import type { DrawioStyle } from './style';

export type BpmnStencil = { shape: ShapeKind; bpmn: BpmnSymbol; approximated: boolean };

// An event's `outline`: where in the process it sits.
const OUTLINE_BASE: Readonly<Record<string, 'start' | 'intermediate' | 'end'>> = {
  standard: 'start',
  eventNonint: 'start',
  eventInt: 'start',
  catching: 'intermediate',
  throwing: 'intermediate',
  boundInt: 'intermediate',
  boundNonint: 'intermediate',
  end: 'end',
};

const TASK_MARKERS: Readonly<Record<string, BpmnSymbol>> = {
  abstract: 'task',
  user: 'task-user',
  service: 'task-service',
  script: 'task-script',
  manual: 'task-manual',
  send: 'task-send',
  receive: 'task-receive',
  businessRule: 'task-business-rule',
};

// A gateway's `gwType` (gateway2), or the old `mxgraph.bpmn.shape` rhombus's `symbol`.
const GATEWAY_TYPES: Readonly<Record<string, BpmnSymbol>> = {
  exclusive: 'gateway-exclusive',
  exclusiveGw: 'gateway-exclusive',
  parallel: 'gateway-parallel',
  parallelGw: 'gateway-parallel',
  inclusive: 'gateway-inclusive',
  inclusiveGw: 'gateway-inclusive',
  complex: 'gateway-complex',
  complexGw: 'gateway-complex',
  eventBased: 'gateway-event',
  eventGw: 'gateway-event',
};

const stencil = (bpmn: BpmnSymbol, approximated = false): BpmnStencil => ({
  shape: bpmnKindOf(bpmn),
  bpmn,
  approximated,
});

function event(style: DrawioStyle): BpmnStencil {
  const known = OUTLINE_BASE[style.str('outline') ?? 'standard'];
  const base = known ?? 'start';
  const symbol = style.str('symbol') ?? 'general';
  if (symbol === 'general') return stencil(base, !known);
  const marked = `${base}-${symbol}`;
  return isBpmnSymbol(marked) ? stencil(marked) : stencil(base, true);
}

function gateway(style: DrawioStyle, key: 'gwType' | 'symbol'): BpmnStencil {
  const type = style.str(key) ?? '';
  if (type === '' || type === 'general') return stencil('gateway');
  const symbol = GATEWAY_TYPES[type];
  return symbol ? stencil(symbol) : stencil('gateway', true);
}

/** The BPMN element a draw.io shape name and style map to; null for a shape that is not a BPMN stencil. */
export function bpmnStencil(name: string, style: DrawioStyle): BpmnStencil | null {
  switch (name) {
    case 'mxgraph.bpmn.event':
      return event(style);
    case 'mxgraph.bpmn.task':
    case 'mxgraph.bpmn.task2': {
      if (style.flag('isLoopSub')) return stencil('subprocess');
      const marker = style.str('taskMarker') ?? 'abstract';
      const symbol = TASK_MARKERS[marker];
      return symbol ? stencil(symbol) : stencil('task', true);
    }
    case 'mxgraph.bpmn.gateway2':
      return gateway(style, 'gwType');
    case 'mxgraph.bpmn.shape':
      // The old BPMN palette's one shape: its perimeter says which.
      if (style.str('perimeter') === 'rhombusPerimeter') return gateway(style, 'symbol');
      if (style.str('perimeter') === 'ellipsePerimeter') return event(style);
      return stencil('task', true);
    case 'mxgraph.bpmn.data':
    case 'mxgraph.bpmn.data2':
      return stencil('data-object');
    case 'datastore':
      return stencil('data-store');
    default:
      return null;
  }
}
