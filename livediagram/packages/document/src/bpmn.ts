// BPMN (docs/specs/009-elements/bpmn.md): the common subset of BPMN 2.0 as existing shape kinds carrying a `bpmn`
// mark. One vocabulary for the model, the palette's variants, the menu that changes a symbol, both importers and the
// two renderers: the canvas (BpmnMarkLayer) and the export (svg-render-bpmn) draw the mark from `bpmnMarkParts`
// here, so they cannot disagree. Pure.

import type { ArrowElement } from './arrow-types';
import type { ShapeElement } from './element-types';
import type { ShapeKind } from './shape-kind';
import type { ShapeGeometry } from './shape-geometry';

export const BPMN_EVENT_SYMBOLS = [
  'start',
  'start-message',
  'start-timer',
  'intermediate',
  'intermediate-message',
  'intermediate-timer',
  'intermediate-error',
  'end',
  'end-message',
  'end-error',
  'end-terminate',
] as const;

export const BPMN_TASK_SYMBOLS = [
  'task',
  'task-user',
  'task-service',
  'task-script',
  'task-manual',
  'task-send',
  'task-receive',
  'task-business-rule',
  'subprocess',
] as const;

export const BPMN_GATEWAY_SYMBOLS = [
  'gateway',
  'gateway-exclusive',
  'gateway-parallel',
  'gateway-inclusive',
  'gateway-event',
  'gateway-complex',
] as const;

export const BPMN_DATA_SYMBOLS = ['data-object', 'data-store'] as const;

export const BPMN_SYMBOLS = [
  ...BPMN_EVENT_SYMBOLS,
  ...BPMN_TASK_SYMBOLS,
  ...BPMN_GATEWAY_SYMBOLS,
  ...BPMN_DATA_SYMBOLS,
] as const;

export type BpmnSymbol = (typeof BPMN_SYMBOLS)[number];
export type BpmnFamily = 'event' | 'task' | 'gateway' | 'data';

const SYMBOL_SET: ReadonlySet<string> = new Set(BPMN_SYMBOLS);

export const isBpmnSymbol = (v: unknown): v is BpmnSymbol =>
  typeof v === 'string' && SYMBOL_SET.has(v);

const EVENTS: ReadonlySet<string> = new Set(BPMN_EVENT_SYMBOLS);
const TASKS: ReadonlySet<string> = new Set(BPMN_TASK_SYMBOLS);
const GATEWAYS: ReadonlySet<string> = new Set(BPMN_GATEWAY_SYMBOLS);

/** The family a symbol belongs to: what the menu offers to change it to. */
export function bpmnFamilyOf(symbol: BpmnSymbol): BpmnFamily {
  if (EVENTS.has(symbol)) return 'event';
  if (TASKS.has(symbol)) return 'task';
  if (GATEWAYS.has(symbol)) return 'gateway';
  return 'data';
}

export const BPMN_FAMILY_SYMBOLS: Readonly<Record<BpmnFamily, readonly BpmnSymbol[]>> = {
  event: BPMN_EVENT_SYMBOLS,
  task: BPMN_TASK_SYMBOLS,
  gateway: BPMN_GATEWAY_SYMBOLS,
  data: BPMN_DATA_SYMBOLS,
};

/** The kind a symbol is drawn on. */
export function bpmnKindOf(symbol: BpmnSymbol): ShapeKind {
  switch (bpmnFamilyOf(symbol)) {
    case 'event':
      return 'circle';
    case 'task':
      return 'square';
    case 'gateway':
      return 'diamond';
    case 'data':
      return symbol === 'data-store' ? 'cylinder' : 'document';
  }
}

/** The shape's BPMN symbol, when it carries one on its own kind; undefined otherwise, so a stray value never draws a
 *  ring on the wrong silhouette. */
export function bpmnSymbolOf(el: { shape?: string; bpmn?: unknown }): BpmnSymbol | undefined {
  const symbol = el.bpmn;
  return isBpmnSymbol(symbol) && bpmnKindOf(symbol) === el.shape ? symbol : undefined;
}

/** What each symbol is called: the menu's tiles, the report's lines. */
export const BPMN_SYMBOL_LABELS: Readonly<Record<BpmnSymbol, string>> = {
  start: 'Start',
  'start-message': 'Message Start',
  'start-timer': 'Timer Start',
  intermediate: 'Intermediate',
  'intermediate-message': 'Message',
  'intermediate-timer': 'Timer',
  'intermediate-error': 'Error',
  end: 'End',
  'end-message': 'Message End',
  'end-error': 'Error End',
  'end-terminate': 'Terminate',
  task: 'Task',
  'task-user': 'User Task',
  'task-service': 'Service Task',
  'task-script': 'Script Task',
  'task-manual': 'Manual Task',
  'task-send': 'Send Task',
  'task-receive': 'Receive Task',
  'task-business-rule': 'Business Rule',
  subprocess: 'Sub-Process',
  gateway: 'Gateway',
  'gateway-exclusive': 'Exclusive',
  'gateway-parallel': 'Parallel',
  'gateway-inclusive': 'Inclusive',
  'gateway-event': 'Event-Based',
  'gateway-complex': 'Complex',
  'data-object': 'Data Object',
  'data-store': 'Data Store',
};

/** Whether BPMN writes this symbol's name under it rather than inside (an event, a gateway, a data element). */
export const bpmnNameSitsUnder = (symbol: BpmnSymbol): boolean => bpmnFamilyOf(symbol) !== 'task';

/** `el` with its BPMN symbol changed to `symbol` (docs/specs/009-elements/bpmn.md "Changing the symbol"): only a BPMN
 *  element of the same family changes, keeping its size, colours and name; a data object and a data store are
 *  different kinds, so switching between them changes the kind too. Anything else comes back as it was. */
export function withBpmnSymbol<E extends { type: string; shape?: string; bpmn?: unknown }>(
  el: E,
  symbol: BpmnSymbol,
): E {
  if (el.type !== 'shape') return el;
  const current = bpmnSymbolOf(el);
  if (!current || current === symbol || bpmnFamilyOf(current) !== bpmnFamilyOf(symbol)) return el;
  return { ...el, bpmn: symbol, shape: bpmnKindOf(symbol) };
}

// ---------------------------------------------------------------------------------------------------------------
// Sizes and the palette's variants
// ---------------------------------------------------------------------------------------------------------------

/** The size each family lands at: an event 48 round, a gateway 56, a task 128 × 80, a data object 44 × 56, a data
 *  store 60 × 56. */
export function bpmnSize(symbol: BpmnSymbol): { width: number; height: number } {
  switch (bpmnFamilyOf(symbol)) {
    case 'event':
      return { width: 48, height: 48 };
    case 'gateway':
      return { width: 56, height: 56 };
    case 'task':
      return { width: 128, height: 80 };
    case 'data':
      return symbol === 'data-store' ? { width: 60, height: 56 } : { width: 44, height: 56 };
  }
}

/** The fields a symbol's element takes on top of its kind's: the mark, its size, a task's corners, no label. */
export function bpmnFields(symbol: BpmnSymbol): Partial<ShapeElement> {
  return {
    bpmn: symbol,
    ...bpmnSize(symbol),
    label: '',
    ...(bpmnFamilyOf(symbol) === 'task' ? { borderRadius: 'md' as const } : {}),
  };
}

/** A pool: a lane with its title upright in a narrow left gutter. */
export const BPMN_POOL_FIELDS: Partial<ShapeElement> = {
  width: 640,
  height: 200,
  label: 'Pool',
  textAlignX: 'left',
  textAlignY: 'middle',
  titleOrientation: 'upright',
  headerSize: 40,
};

// The palette's BPMN tiles (docs/specs/009-elements/bpmn.md "The palette"): a variant of the symbol's kind each.
const BPMN_VARIANT_SYMBOLS: Readonly<Record<string, BpmnSymbol>> = {
  'bpmn-start': 'start',
  'bpmn-intermediate': 'intermediate',
  'bpmn-end': 'end',
  'bpmn-task': 'task',
  'bpmn-user-task': 'task-user',
  'bpmn-subprocess': 'subprocess',
  'bpmn-exclusive': 'gateway-exclusive',
  'bpmn-parallel': 'gateway-parallel',
  'bpmn-inclusive': 'gateway-inclusive',
  'bpmn-data-object': 'data-object',
  'bpmn-data-store': 'data-store',
};

/** `el` placed as a BPMN tile's variant; null when `variant` is not a BPMN one or names another kind than `el`'s. */
export function applyBpmnVariant<E extends { shape: string }>(
  el: E,
  variant: string | undefined,
): E | null {
  if (!variant) return null;
  if (variant === 'bpmn-pool') return el.shape === 'lane' ? { ...el, ...BPMN_POOL_FIELDS } : null;
  if (!Object.hasOwn(BPMN_VARIANT_SYMBOLS, variant)) return null;
  const symbol = BPMN_VARIANT_SYMBOLS[variant]!;
  if (bpmnKindOf(symbol) !== el.shape) return null;
  return { ...el, ...bpmnFields(symbol) };
}

// ---------------------------------------------------------------------------------------------------------------
// Flows
// ---------------------------------------------------------------------------------------------------------------

export type BpmnFlow = 'message' | 'association';
export const BPMN_FLOWS: readonly BpmnFlow[] = ['message', 'association'];
export const isBpmnFlow = (v: unknown): v is BpmnFlow => v === 'message' || v === 'association';

/** The two non-default flows as arrow fields (docs/specs/009-elements/bpmn.md "Lines"); a sequence flow is the
 *  default arrow. */
export const BPMN_FLOW_LOOKS: Readonly<Record<BpmnFlow, Partial<ArrowElement>>> = {
  message: {
    strokeStyle: 'dashed',
    arrowEnds: 'both',
    arrowheadStartShape: 'circle-hollow',
    arrowheadShape: 'triangle-hollow',
  },
  association: { strokeStyle: 'dotted', arrowEnds: 'none' },
};

// ---------------------------------------------------------------------------------------------------------------
// The data object's page
// ---------------------------------------------------------------------------------------------------------------

/** The data object's silhouette: a page with its top-right corner folded, in place of the `document` kind's wave. */
export const BPMN_DATA_OBJECT_GEOMETRY: ShapeGeometry = {
  viewBox: '0 0 100 100',
  preserveAspectRatio: 'none',
  strokeInside: true,
  parts: [
    { tag: 'path', role: 'main', d: 'M 0 0 L 70 0 L 100 24 L 100 100 L 0 100 Z' },
    { tag: 'path', role: 'limb', d: 'M 70 0 L 70 24 L 100 24' },
  ],
};

/** The silhouette a shape draws in place of its kind's, when its BPMN symbol has one. */
export function bpmnBodyGeometry(el: { shape?: string; bpmn?: unknown }): ShapeGeometry | null {
  return bpmnSymbolOf(el) === 'data-object' ? BPMN_DATA_OBJECT_GEOMETRY : null;
}

// ---------------------------------------------------------------------------------------------------------------
// The mark
// ---------------------------------------------------------------------------------------------------------------

/**
 * One stroke or fill of a mark, in element px:
 * - `line`: stroked in the line colour, unfilled;
 * - `solid`: filled with the shape's fill and stroked in the line colour (a marker drawn over the shape's face);
 * - `ink`: filled with the line colour, unstroked (a throwing marker);
 * - `knock`: stroked in the shape's fill colour (the flap cut into a filled envelope).
 */
export type BpmnMarkPart = { d: string; paint: 'line' | 'solid' | 'ink' | 'knock'; width: number };

const n2 = (v: number) => Math.round(v * 100) / 100;

// A 24-unit glyph grid centred on (cx, cy) at `size` px.
function grid(cx: number, cy: number, size: number) {
  const k = size / 24;
  const X = (x: number) => n2(cx + (x - 12) * k);
  const Y = (y: number) => n2(cy + (y - 12) * k);
  const P = (x: number, y: number) => `${X(x)} ${Y(y)}`;
  const circle = (x: number, y: number, r: number) => {
    const rr = n2(r * k);
    return `M ${n2(X(x) - rr)} ${Y(y)} a ${rr} ${rr} 0 1 0 ${n2(2 * rr)} 0 a ${rr} ${rr} 0 1 0 ${n2(-2 * rr)} 0 Z`;
  };
  return { k, P, circle };
}

const ringPath = (cx: number, cy: number, r: number) =>
  `M ${n2(cx - r)} ${n2(cy)} a ${n2(r)} ${n2(r)} 0 1 0 ${n2(2 * r)} 0 a ${n2(r)} ${n2(r)} 0 1 0 ${n2(-2 * r)} 0 Z`;

type Glyph = ReturnType<typeof grid>;

const envelopeBody = (g: Glyph) =>
  `M ${g.P(3, 6)} L ${g.P(21, 6)} L ${g.P(21, 18)} L ${g.P(3, 18)} Z`;
const envelopeFlap = (g: Glyph) => `M ${g.P(3, 6)} L ${g.P(12, 13)} L ${g.P(21, 6)}`;

function envelope(g: Glyph, thrown: boolean, w: number): BpmnMarkPart[] {
  return thrown
    ? [
        { d: envelopeBody(g), paint: 'ink', width: 0 },
        { d: envelopeFlap(g), paint: 'knock', width: w },
      ]
    : [
        { d: envelopeBody(g), paint: 'solid', width: w },
        { d: envelopeFlap(g), paint: 'line', width: w },
      ];
}

function clock(g: Glyph, w: number): BpmnMarkPart[] {
  const ticks = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
    .map((i) => {
      const a = (i * Math.PI) / 6;
      const [s, c] = [Math.sin(a), Math.cos(a)];
      return `M ${g.P(12 + 7 * s, 12 - 7 * c)} L ${g.P(12 + 8.6 * s, 12 - 8.6 * c)}`;
    })
    .join(' ');
  return [
    { d: g.circle(12, 12, 9.5), paint: 'solid', width: w },
    { d: ticks, paint: 'line', width: w * 0.7 },
    { d: `M ${g.P(12, 6.5)} L ${g.P(12, 12)} L ${g.P(16, 14)}`, paint: 'line', width: w },
  ];
}

const boltPath = (g: Glyph) =>
  `M ${g.P(4, 19)} L ${g.P(8.5, 6)} L ${g.P(13, 13)} L ${g.P(16.5, 5)} L ${g.P(20, 18)} L ${g.P(15.5, 11.5)} L ${g.P(11.5, 18.5)} Z`;

function eventMark(symbol: BpmnSymbol, w: number, h: number): BpmnMarkPart[] {
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) / 2;
  const out: BpmnMarkPart[] = [];
  if (symbol.startsWith('intermediate')) {
    out.push({ d: ringPath(cx, cy, Math.max(1, r - 4.5)), paint: 'line', width: 1.5 });
  } else if (symbol.startsWith('end')) {
    out.push({ d: ringPath(cx, cy, Math.max(1, r - 2.5)), paint: 'line', width: 3 });
  }
  const g = grid(cx, cy, r * 1.15);
  const stroke = Math.max(1.25, r / 16);
  const thrown = symbol.startsWith('end');
  if (symbol.endsWith('-message')) out.push(...envelope(g, thrown, stroke));
  else if (symbol.endsWith('-timer')) out.push(...clock(g, stroke));
  else if (symbol.endsWith('-error')) {
    out.push(
      thrown
        ? { d: boltPath(g), paint: 'ink', width: 0 }
        : { d: boltPath(g), paint: 'solid', width: stroke },
    );
  } else if (symbol === 'end-terminate') {
    out.push({ d: g.circle(12, 12, 8), paint: 'ink', width: 0 });
  }
  return out;
}

function gatewayMark(symbol: BpmnSymbol, w: number, h: number): BpmnMarkPart[] {
  const side = Math.min(w, h);
  const g = grid(w / 2, h / 2, side * 0.55);
  const heavy = Math.max(2.5, side / 14);
  const thin = Math.max(1.25, side / 40);
  const cross = `M ${g.P(6.5, 6.5)} L ${g.P(17.5, 17.5)} M ${g.P(17.5, 6.5)} L ${g.P(6.5, 17.5)}`;
  const plus = `M ${g.P(12, 4.5)} L ${g.P(12, 19.5)} M ${g.P(4.5, 12)} L ${g.P(19.5, 12)}`;
  switch (symbol) {
    case 'gateway-exclusive':
      return [{ d: cross, paint: 'line', width: heavy }];
    case 'gateway-parallel':
      return [{ d: plus, paint: 'line', width: heavy }];
    case 'gateway-inclusive':
      return [{ d: g.circle(12, 12, 7), paint: 'line', width: heavy * 0.85 }];
    case 'gateway-complex':
      return [{ d: `${cross} ${plus}`, paint: 'line', width: heavy * 0.8 }];
    case 'gateway-event': {
      const pentagon = [0, 1, 2, 3, 4]
        .map((i) => {
          const a = (i * 2 * Math.PI) / 5;
          return `${i === 0 ? 'M' : 'L'} ${g.P(12 + 4.8 * Math.sin(a), 12.4 - 4.8 * Math.cos(a))}`;
        })
        .join(' ');
      return [
        { d: g.circle(12, 12, 10), paint: 'line', width: thin },
        { d: g.circle(12, 12, 8.2), paint: 'line', width: thin },
        { d: `${pentagon} Z`, paint: 'line', width: thin },
      ];
    }
    default:
      return [];
  }
}

function gear(g: Glyph): string {
  const pts: string[] = [];
  for (let tooth = 0; tooth < 8; tooth++) {
    const a = (tooth * Math.PI) / 4;
    for (const [da, rad] of [
      [-0.3, 7.2],
      [-0.17, 10],
      [0.17, 10],
      [0.3, 7.2],
    ] as const) {
      const t = a + da;
      pts.push(g.P(12 + rad * Math.sin(t), 12 - rad * Math.cos(t)));
    }
  }
  return `M ${pts.join(' L ')} Z`;
}

function taskMark(symbol: BpmnSymbol, w: number, h: number): BpmnMarkPart[] {
  const stroke = 1.25;
  if (symbol === 'subprocess') {
    const s = 14;
    const x = w / 2 - s / 2;
    const y = h - s - 4;
    const g = grid(w / 2, y + s / 2, s);
    return [
      {
        d: `M ${n2(x)} ${n2(y)} L ${n2(x + s)} ${n2(y)} L ${n2(x + s)} ${n2(y + s)} L ${n2(x)} ${n2(y + s)} Z`,
        paint: 'solid',
        width: stroke,
      },
      {
        d: `M ${g.P(12, 5)} L ${g.P(12, 19)} M ${g.P(5, 12)} L ${g.P(19, 12)}`,
        paint: 'line',
        width: 1.5,
      },
    ];
  }
  // The task marker's corner: 18 px, 6 px in from the top-left.
  const g = grid(15, 15, 18);
  switch (symbol) {
    case 'task-user':
      return [
        {
          d: `M ${g.P(4, 22)} C ${g.P(4, 15.5)} ${g.P(8, 13.5)} ${g.P(12, 13.5)} C ${g.P(16, 13.5)} ${g.P(20, 15.5)} ${g.P(20, 22)} Z`,
          paint: 'solid',
          width: stroke,
        },
        { d: g.circle(12, 7.5, 4.5), paint: 'solid', width: stroke },
      ];
    case 'task-service':
      return [
        { d: gear(g), paint: 'solid', width: stroke },
        { d: g.circle(12, 12, 3.2), paint: 'line', width: stroke },
      ];
    case 'task-script':
      return [
        {
          d: `M ${g.P(7, 3)} L ${g.P(19, 3)} C ${g.P(16, 6)} ${g.P(16, 9)} ${g.P(18, 12)} C ${g.P(20, 15)} ${g.P(20, 18)} ${g.P(17, 21)} L ${g.P(5, 21)} C ${g.P(8, 18)} ${g.P(8, 15)} ${g.P(6, 12)} C ${g.P(4, 9)} ${g.P(4, 6)} ${g.P(7, 3)} Z`,
          paint: 'solid',
          width: stroke,
        },
        {
          d: `M ${g.P(8, 8)} L ${g.P(15, 8)} M ${g.P(9.5, 12)} L ${g.P(16.5, 12)} M ${g.P(9, 16)} L ${g.P(16, 16)}`,
          paint: 'line',
          width: stroke,
        },
      ];
    case 'task-manual':
      return [
        {
          d: `M ${g.P(2, 9)} L ${g.P(14, 9)} Q ${g.P(17, 9)} ${g.P(17, 11)} Q ${g.P(17, 13)} ${g.P(14, 13)} L ${g.P(20, 13)} Q ${g.P(22, 13)} ${g.P(22, 15)} Q ${g.P(22, 17)} ${g.P(20, 17)} L ${g.P(19, 17)} Q ${g.P(21, 17)} ${g.P(21, 19)} Q ${g.P(21, 21)} ${g.P(19, 21)} L ${g.P(6, 21)} Q ${g.P(2, 21)} ${g.P(2, 17)} Z`,
          paint: 'solid',
          width: stroke,
        },
        {
          d: `M ${g.P(14, 13)} L ${g.P(10, 13)} M ${g.P(19, 17)} L ${g.P(10, 17)}`,
          paint: 'line',
          width: stroke,
        },
      ];
    case 'task-send':
      return envelope(g, true, stroke);
    case 'task-receive':
      return envelope(g, false, stroke);
    case 'task-business-rule':
      return [
        {
          d: `M ${g.P(3, 5)} L ${g.P(21, 5)} L ${g.P(21, 19)} L ${g.P(3, 19)} Z`,
          paint: 'solid',
          width: stroke,
        },
        {
          d: `M ${g.P(3, 9.5)} L ${g.P(21, 9.5)} M ${g.P(3, 14.25)} L ${g.P(21, 14.25)} M ${g.P(8, 9.5)} L ${g.P(8, 19)}`,
          paint: 'line',
          width: stroke,
        },
      ];
    default:
      return [];
  }
}

/** What a shape's BPMN symbol draws over it, in element px (0..w, 0..h); empty for none. */
export function bpmnMarkParts(symbol: BpmnSymbol, w: number, h: number): BpmnMarkPart[] {
  if (!(w > 0) || !(h > 0)) return [];
  switch (bpmnFamilyOf(symbol)) {
    case 'event':
      return eventMark(symbol, w, h);
    case 'gateway':
      return gatewayMark(symbol, w, h);
    case 'task':
      return taskMark(symbol, w, h);
    case 'data':
      return [];
  }
}
