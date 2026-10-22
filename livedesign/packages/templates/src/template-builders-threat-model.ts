// The Threat model template (docs/specs/008-canvas/canvas-and-palette.md "Templates"): a STRIDE threat model of
// Plateful's checkout. This builds its first tab, the drawing; the second, the Threat Register, is the companion
// Sheet (template-companions.ts) made from the same threats (@livepages/sheets THREAT_EXAMPLES), so every marker
// here names a row there with the same element and rating.
//
// The drawing is a data-flow diagram inside its trust boundaries (Internet, Plateful VPC and the PCI zone nested in
// it): external entities as squares, processes as circles, data stores as cylinders, flows as labelled arrows. Each
// threat is a numbered badge attached to what it threatens (travelling with it), coloured by its rating. Beside it:
// the STRIDE key, the three High threats as cards, and Shostack's four questions.
//
// Layers: "Model" is the boundaries, the DFD, its flows and the key; "Threats" the badges, cards and checklist.
//
// Pure: takes a centre (cx, cy), returns a fresh Element[].

import {
  createPinnedArrow,
  createShape,
  createText,
  type Element,
  type ShapeElement,
} from '@livepages/document';
import {
  STRIDE_CATEGORIES,
  THREAT_EXAMPLES,
  threatRating,
  type StrideCategory,
  type ThreatRating,
} from '@livepages/sheets';
import { techHeader, TECH_HEADER_H } from './template-builders-technical-kit';
import {
  CONTENT,
  INK,
  MUTED,
  PAPER,
  SCAFFOLD,
  SECTION_H,
  chipRow,
  sectionHeading,
} from './template-report-kit';

const TITLE = 'Plateful checkout · Threat model (STRIDE)';
const CAPTION =
  'Draw what you are building, mark what can go wrong on it, then track each threat on the Threat Register tab. Red dashed lines are trust boundaries.';

const DFD_W = 1500;
const DFD_H = 900;
const SIDE_GAP = 64;
const SIDE_W = 470;
const PROC = 150;
const BADGE_H = 30;

const BOUNDARY = '#dc2626';

// A rating's badge colours: fill and ink, AA on each other.
export const RATING_COLOURS: Record<ThreatRating, { fill: string; ink: string }> = {
  High: { fill: '#dc2626', ink: '#ffffff' },
  Medium: { fill: '#f59e0b', ink: '#451a03' },
  Low: { fill: '#16a34a', ink: '#ffffff' },
};

// Each STRIDE category: its letter's hue (white reads on each), the property it breaks and the question it asks.
const STRIDE: Record<StrideCategory, { hue: string; property: string; question: string }> = {
  Spoofing: {
    hue: '#dc2626',
    property: 'Authenticity',
    question: 'Can someone pretend to be someone else?',
  },
  Tampering: {
    hue: '#c2410c',
    property: 'Integrity',
    question: 'Can someone change data they should not?',
  },
  Repudiation: {
    hue: '#a16207',
    property: 'Non-repudiation',
    question: 'Can someone deny what they did?',
  },
  'Information disclosure': {
    hue: '#15803d',
    property: 'Confidentiality',
    question: 'Can someone see what they should not?',
  },
  'Denial of service': {
    hue: '#1d4ed8',
    property: 'Availability',
    question: 'Can someone stop it working?',
  },
  'Elevation of privilege': {
    hue: '#7e22ce',
    property: 'Authorisation',
    question: 'Can someone do more than they are allowed?',
  },
};

const FOUR_QUESTIONS = [
  { text: 'What are we working on?', done: true },
  { text: 'What can go wrong?', done: true },
  { text: 'What are we going to do about it?', done: false },
  { text: 'Did we do a good job?', done: false },
];

type Kind = 'entity' | 'process' | 'store';
// The diagram's elements, by the name the register uses, at their place in the DFD (top-left, DFD px).
const NODES: readonly { name: string; kind: Kind; x: number; y: number }[] = [
  { name: 'Customer app', kind: 'entity', x: 24, y: 150 },
  { name: 'Restaurant tablet', kind: 'entity', x: 24, y: 640 },
  { name: 'API gateway', kind: 'process', x: 370, y: 130 },
  { name: 'Order service', kind: 'process', x: 650, y: 130 },
  { name: 'Payment service', kind: 'process', x: 970, y: 130 },
  { name: 'Orders DB', kind: 'store', x: 620, y: 470 },
  { name: 'Card token vault', kind: 'store', x: 940, y: 420 },
  { name: 'Webhook handler', kind: 'process', x: 970, y: 680 },
  { name: 'Stripe', kind: 'entity', x: 1290, y: 470 },
];

const NODE_STYLE: Record<Kind, { w: number; h: number; fill: string; stroke: string }> = {
  entity: { w: 190, h: 90, fill: PAPER, stroke: INK },
  process: { w: PROC, h: PROC, fill: '#eff6ff', stroke: '#1d4ed8' },
  store: { w: 200, h: 120, fill: '#f8fafc', stroke: '#475569' },
};

// The flows: from, to, the data on it, and the anchors it leaves and arrives at.
const FLOWS: readonly (readonly [string, string, string])[] = [
  ['Customer app', 'API gateway', 'HTTPS order'],
  ['Restaurant tablet', 'API gateway', 'Order tickets'],
  ['API gateway', 'Order service', 'Order request'],
  ['Order service', 'Orders DB', 'SQL'],
  ['Order service', 'Payment service', 'Charge'],
  ['Payment service', 'Card token vault', 'Card token'],
  ['Payment service', 'Stripe', 'Payment intent'],
  ['Stripe', 'Webhook handler', 'Webhook event'],
  ['Webhook handler', 'Order service', 'Mark paid'],
];

// Where a flow leaves and arrives, by its two ends' names (the sides that face each other on this layout).
const FLOW_ANCHORS: Record<
  string,
  readonly [Parameters<typeof createPinnedArrow>[1], Parameters<typeof createPinnedArrow>[3]]
> = {
  'Customer app>API gateway': ['e', 'w'],
  'Restaurant tablet>API gateway': ['ne', 'sw'],
  'API gateway>Order service': ['e', 'w'],
  'Order service>Orders DB': ['s', 'n'],
  'Order service>Payment service': ['e', 'w'],
  'Payment service>Card token vault': ['s', 'n'],
  'Payment service>Stripe': ['e', 'n'],
  'Stripe>Webhook handler': ['s', 'e'],
  'Webhook handler>Order service': ['w', 'se'],
};

// Where a threat's badge sits on its host (a second threat on one host takes another corner).
const BADGE_AT = ['top-right', 'top-left', 'bottom-right'] as const;

export function buildThreatModel(cx: number, cy: number): Element[] {
  const width = DFD_W + SIDE_GAP + SIDE_W;
  const height = TECH_HEADER_H + 28 + DFD_H;
  const x0 = cx - width / 2;
  const y0 = cy - height / 2;
  const top = y0 + TECH_HEADER_H + 28;
  const high = THREAT_EXAMPLES.filter((t) => threatRating(t.likelihood * t.impact) === 'High');
  const nodes = new Map<string, ShapeElement>();
  for (const n of NODES) nodes.set(n.name, node(n, x0, top));
  const flows = FLOWS.map(([from, to, label]) => {
    const [fa, ta] = FLOW_ANCHORS[`${from}>${to}`]!;
    return {
      ...createPinnedArrow(nodes.get(from)!.id, fa, nodes.get(to)!.id, ta),
      label,
      strokeColor: '#475569',
      strokeWidth: 2,
      textColor: INK,
      labelFill: PAPER,
      ...(fa === 'e' && ta === 'w' ? {} : { arrowStyle: 'angled' as const }),
      ...SCAFFOLD,
    };
  });
  return [
    ...techHeader(x0, y0, width, TITLE, CAPTION, {
      title: CONTENT.layerId,
      caption: SCAFFOLD.layerId,
    }),
    ...chipRow(x0 + width, y0 + 10, [
      {
        w: 120,
        label: `${THREAT_EXAMPLES.length} threats`,
        fill: '#f1f5f9',
        stroke: '#cbd5e1',
        ink: '#334155',
      },
      { w: 96, label: `${high.length} high`, fill: '#fee2e2', stroke: '#fca5a5', ink: '#991b1b' },
    ]),
    ...boundaries(x0, top),
    ...nodes.values(),
    ...flows,
    ...badges(nodes),
    ...panel(x0 + DFD_W + SIDE_GAP, top, high),
  ];
}

// The trust boundaries, outermost first so each paints behind what it holds: the Internet, Plateful's VPC, and the
// PCI zone inside it.
function boundaries(x0: number, top: number): Element[] {
  const zone = (
    label: string,
    x: number,
    y: number,
    w: number,
    h: number,
    meta: string,
    inset = false,
  ) => ({
    ...createShape('boundary', x0 + x, top + y),
    width: w,
    height: h,
    label,
    pageSubtitle: meta,
    strokeColor: BOUNDARY,
    strokeStyle: 'dashed' as const,
    strokeWidth: 'medium' as const,
    iconId: 'shield',
    ...(inset ? { boundaryStyle: 'inset' as const } : {}),
    ...SCAFFOLD,
  });
  return [
    zone('Internet', 0, 20, 250, DFD_H - 20, 'Untrusted'),
    zone('Plateful VPC', 310, 20, 900, DFD_H - 20, 'Trusted'),
    zone('PCI zone', 880, 80, 310, 500, 'Card data', true),
  ];
}

function node(n: (typeof NODES)[number], x0: number, top: number): ShapeElement {
  const s = NODE_STYLE[n.kind];
  return {
    ...createShape(
      n.kind === 'entity' ? 'square' : n.kind === 'process' ? 'circle' : 'cylinder',
      x0 + n.x,
      top + n.y,
    ),
    width: s.w,
    height: s.h,
    label: n.name,
    textSize: 'sm',
    textBold: true,
    textColor: INK,
    fillColor: s.fill,
    strokeColor: s.stroke,
    strokeWidth: n.kind === 'entity' ? 'thick' : 'medium',
    themeLockFill: true,
    ...SCAFFOLD,
  };
}

const BADGE_W = (id: string) => 22 + id.length * 10;

function badgeStyle(rating: ThreatRating) {
  const c = RATING_COLOURS[rating];
  return { fillColor: c.fill, strokeColor: c.fill, textColor: c.ink, themeLockFill: true } as const;
}

// One badge per threat on what it threatens, attached so it travels with it; a threat to a flow sits loose by its
// line (an arrow is no host).
function badges(nodes: Map<string, ShapeElement>): Element[] {
  const used = new Map<string, number>();
  return THREAT_EXAMPLES.map((t): Element => {
    const rating = threatRating(t.likelihood * t.impact);
    const base = {
      ...createShape('badge', 0, 0),
      width: BADGE_W(t.id),
      height: BADGE_H,
      label: t.id,
      textSize: 'sm' as const,
      textBold: true,
      ...badgeStyle(rating),
      ...CONTENT,
    };
    const host = nodes.get(t.element);
    if (!host) {
      // The flow between two nodes: the badge rides above its middle.
      const [from, to] = t.element.split(' → ').map((n) => nodes.get(n)!);
      const mx = (from!.x + from!.width + to!.x) / 2;
      return { ...base, x: Math.round(mx - base.width / 2), y: from!.y + from!.height / 2 - 64 };
    }
    const k = used.get(t.element) ?? 0;
    used.set(t.element, k + 1);
    const at = BADGE_AT[k]!;
    const bx = at === 'top-left' ? host.x : host.x + host.width;
    const by = at === 'bottom-right' ? host.y + host.height : host.y;
    return {
      ...base,
      x: Math.round(bx - base.width / 2),
      y: Math.round(by - BADGE_H / 2),
      attachedTo: host.id,
      attachAt: at,
    };
  });
}

// Beside the diagram: the STRIDE key, the High threats as cards, and the four questions.
function panel(x: number, y: number, high: typeof THREAT_EXAMPLES): Element[] {
  const out: Element[] = [...sectionHeading(x, y, SIDE_W, 'shield', 'STRIDE', 'What can go wrong')];
  let row = y + SECTION_H + 10;
  const rowH = 60;
  const letter = 44;
  for (const cat of STRIDE_CATEGORIES) {
    const s = STRIDE[cat];
    out.push(
      {
        ...createShape('square', x, row + (rowH - letter) / 2 - 4),
        width: letter,
        height: letter,
        label: cat[0]!,
        textSize: 'lg',
        textBold: true,
        textColor: '#ffffff',
        fillColor: s.hue,
        strokeColor: s.hue,
        borderRadius: 'md',
        themeLockFill: true,
        ...SCAFFOLD,
      },
      {
        ...createText(x + letter + 14, row - 2),
        width: SIDE_W - letter - 14,
        height: 26,
        label: `${cat} · ${s.property}`,
        textSize: 'sm',
        textBold: true,
        textAlignX: 'left',
        ...SCAFFOLD,
      },
      {
        ...createText(x + letter + 14, row + 22),
        width: SIDE_W - letter - 14,
        height: 24,
        label: s.question,
        textSize: 'sm',
        textColor: MUTED,
        textAlignX: 'left',
        ...SCAFFOLD,
      },
    );
    row += rowH;
  }
  row += 18;
  out.push(...sectionHeading(x, row, SIDE_W, 'alert-triangle', 'Top threats', 'Score 15 and over'));
  row += SECTION_H + 10;
  const cardH = 122;
  for (const t of high) {
    const rating = threatRating(t.likelihood * t.impact);
    out.push(
      {
        ...createShape('square', x, row),
        width: SIDE_W,
        height: cardH,
        label: '',
        fillColor: '#fff1f2',
        strokeColor: '#fecdd3',
        borderRadius: 'md',
        themeLockFill: true,
        ...CONTENT,
      },
      {
        ...createShape('badge', x + 14, row + 14),
        width: BADGE_W(t.id),
        height: BADGE_H,
        label: t.id,
        textSize: 'sm',
        textBold: true,
        ...badgeStyle(rating),
        ...CONTENT,
      },
      {
        ...createText(x + 14 + BADGE_W(t.id) + 10, row + 12),
        width: SIDE_W - BADGE_W(t.id) - 38,
        height: 34,
        label: `${t.stride} · ${t.element}`,
        textSize: 'sm',
        textColor: '#9f1239',
        textBold: true,
        textAlignX: 'left',
        ...CONTENT,
      },
      {
        ...createText(x + 14, row + 48),
        width: SIDE_W - 28,
        height: cardH - 54,
        label: `${t.threat}.\nFix: ${t.mitigation}.`,
        textSize: 'sm',
        textColor: INK,
        textAlignX: 'left',
        textAlignY: 'top',
        ...CONTENT,
      },
    );
    row += cardH + 10;
  }
  row += 18;
  out.push(...sectionHeading(x, row, SIDE_W, 'help-circle', 'The four questions', 'Shostack'));
  row += SECTION_H + 8;
  out.push({
    ...createShape('checklist', x, row),
    width: SIDE_W,
    height: FOUR_QUESTIONS.length * 32 + 24,
    checklistItems: FOUR_QUESTIONS.map((q) => ({ ...q })),
    fillColor: PAPER,
    strokeColor: '#cbd5e1',
    textColor: INK,
    themeLockFill: true,
    ...CONTENT,
  });
  return out;
}
