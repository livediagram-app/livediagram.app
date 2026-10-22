// The Metric tree template (docs/specs/008-canvas/canvas-and-palette.md "Templates"): Plateful's north star, on-time
// orders a week, broken into the inputs teams own. This builds its first tab, the drawing; the second, the Driver
// Model, is the companion Sheet (template-companions.ts) worked from the same inputs (@livedesign/sheets
// DRIVER_BASELINE, driverTree), so every value on a card here is a figure that sheet works out.
//
// The tree reads top-down: the north star (violet, with a progress ring towards its goal), the outputs it is made
// from (sky) and the inputs a team moves directly (green, tagged Input). Each card shows its value, a trend badge
// (green up, red down) and the team that owns it; a round operator between a card's children says how they combine.
// Faint bands name each level in a left rail, and a card spells out the biggest levers, which the sheet works out.
//
// Layers: "Levels" holds the bands and rail; "Tree" the cards, operators, connectors, badges and levers.
//
// Pure: takes a centre (cx, cy), returns a fresh Element[].

import {
  createPinnedArrow,
  createShape,
  createText,
  runsPlainText,
  type Element,
  type ShapeElement,
  type TextRun,
} from '@livedesign/document';
import {
  DRIVER_BASELINE,
  DRIVER_LEVERS,
  DRIVER_ROWS,
  driverTree,
  leverGain,
  type DriverInputKey,
} from '@livedesign/sheets';
import { rake } from './template-rake';
import { techHeader, TECH_HEADER_H } from './template-builders-technical-kit';
import { CONTENT, INK, MUTED, PAPER, SCAFFOLD, chipRow } from './template-report-kit';

const TITLE = 'Plateful · Metric tree: on-time orders a week';
const CAPTION =
  'The north star at the top, what it is made of underneath, and the inputs teams can move at the leaves. The numbers match the Driver Model tab: try a what-if there.';
// The north star's goal, for its progress ring.
export const NORTH_STAR_GOAL = 55_000;

const RAIL_W = 200;
const CARD_W = 250;
const PITCH = 310; // a leaf's slot: its card and the gap after it
const LEVEL_GAP = 92;
const LEVEL_H = [150, 130, 130, 176];
// A card's height under the north star, centred in its level's band.
const CARD_H = 124;
const OP = 36;
const BADGE_H = 28;

type Kind = 'north' | 'output' | 'input' | 'carried';
const KIND_STYLE: Record<Kind, { fill: string; stroke: string; ink: string; soft: string }> = {
  north: { fill: '#6d28d9', stroke: '#5b21b6', ink: '#ffffff', soft: '#ede9fe' },
  output: { fill: '#e0f2fe', stroke: '#7dd3fc', ink: '#0c4a6e', soft: '#0369a1' },
  input: { fill: '#dcfce7', stroke: '#86efac', ink: '#14532d', soft: '#15803d' },
  carried: { fill: '#f1f5f9', stroke: '#cbd5e1', ink: '#334155', soft: '#64748b' },
};

type Node = {
  id: string;
  name: string;
  value: string;
  owner: string;
  trend: number; // change on last month, a fraction
  kind: Kind;
  level: number;
  // The card's centre, in leaf slots from the tree's left edge.
  slot: number;
  parent?: string;
};

const num = (v: number) => Math.round(v).toLocaleString('en-GB');
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const OWNER: Record<DriverInputKey, string> = Object.fromEntries(
  DRIVER_ROWS.map((r) => [r.key, r.owner]),
) as Record<DriverInputKey, string>;

// The tree, each node at its level and slot; operators say how a parent's children combine.
function nodes(): Node[] {
  const t = driverTree(DRIVER_BASELINE);
  const b = DRIVER_BASELINE;
  return [
    {
      id: 'ns',
      name: 'On-time orders / week',
      value: num(t.northStar),
      owner: 'Leadership',
      trend: 0.06,
      kind: 'north',
      level: 0,
      slot: 4.05,
    },
    {
      id: 'actives',
      name: 'Active customers',
      value: num(t.actives),
      owner: 'Growth and Lifecycle',
      trend: 0.021,
      kind: 'output',
      level: 1,
      slot: 1.5,
      parent: 'ns',
    },
    {
      id: 'orders',
      name: 'Orders per active customer',
      value: b.ordersPerCustomer.toFixed(2),
      owner: OWNER.ordersPerCustomer,
      trend: 0.018,
      kind: 'input',
      level: 1,
      slot: 4.05,
      parent: 'ns',
    },
    {
      id: 'ontime',
      name: 'On-time rate',
      value: pct(t.onTimeRate),
      owner: 'Operations',
      trend: -0.006,
      kind: 'output',
      level: 1,
      slot: 6.15,
      parent: 'ns',
    },
    {
      id: 'new',
      name: 'New customers',
      value: num(t.newCustomers),
      owner: 'Growth',
      trend: 0.04,
      kind: 'output',
      level: 2,
      slot: 0.5,
      parent: 'actives',
    },
    {
      id: 'returning',
      name: 'Returning customers',
      value: num(t.returning),
      owner: 'Lifecycle',
      trend: 0.017,
      kind: 'output',
      level: 2,
      slot: 2.5,
      parent: 'actives',
    },
    {
      id: 'kitchen',
      name: 'Kitchen on time',
      value: pct(b.kitchenOnTime),
      owner: OWNER.kitchenOnTime,
      trend: 0.004,
      kind: 'input',
      level: 2,
      slot: 5.6,
      parent: 'ontime',
    },
    {
      id: 'courier',
      name: 'Courier on time',
      value: pct(b.courierOnTime),
      owner: OWNER.courierOnTime,
      trend: -0.011,
      kind: 'input',
      level: 2,
      slot: 6.7,
      parent: 'ontime',
    },
    {
      id: 'visitors',
      name: 'Visitors / week',
      value: num(b.visitors),
      owner: OWNER.visitors,
      trend: 0.052,
      kind: 'input',
      level: 3,
      slot: 0,
      parent: 'new',
    },
    {
      id: 'conversion',
      name: 'Visit-to-order conversion',
      value: pct(b.conversion),
      owner: OWNER.conversion,
      trend: -0.01,
      kind: 'input',
      level: 3,
      slot: 1,
      parent: 'new',
    },
    {
      id: 'last',
      name: 'Last week’s actives',
      value: num(b.lastActives),
      owner: 'Carried over',
      trend: 0.012,
      kind: 'carried',
      level: 3,
      slot: 2,
      parent: 'returning',
    },
    {
      id: 'retention',
      name: 'Retention',
      value: pct(b.retention),
      owner: OWNER.retention,
      trend: 0.005,
      kind: 'input',
      level: 3,
      slot: 3,
      parent: 'returning',
    },
  ];
}

// How each parent's children combine.
const OPERATOR: Record<string, '×' | '+'> = {
  ns: '×',
  actives: '+',
  ontime: '×',
  new: '×',
  returning: '×',
};

export function buildMetricTree(cx: number, cy: number): Element[] {
  const treeW = 7 * PITCH + CARD_W; // slots 0 to 7, the last card's width past the last slot
  const width = RAIL_W + treeW;
  const levelsH = LEVEL_H.reduce((a, b) => a + b, 0) + LEVEL_GAP * (LEVEL_H.length - 1);
  const height = TECH_HEADER_H + 28 + levelsH;
  const x0 = cx - width / 2;
  const y0 = cy - height / 2;
  const treeX = x0 + RAIL_W;
  const levelY: number[] = [];
  let y = y0 + TECH_HEADER_H + 28;
  for (const h of LEVEL_H) {
    levelY.push(y);
    y += h + LEVEL_GAP;
  }
  const tree = nodes();
  const ns = tree[0]!;
  const out: Element[] = [
    ...techHeader(x0, y0, width, TITLE, CAPTION, {
      title: CONTENT.layerId,
      caption: SCAFFOLD.layerId,
    }),
    ...chipRow(x0 + width, y0 + 10, [
      {
        w: 190,
        label: `Goal ${num(NORTH_STAR_GOAL)} by June`,
        fill: '#ede9fe',
        stroke: '#c4b5fd',
        ink: '#4c1d95',
      },
    ]),
    ...levels(x0, width, levelY),
  ];
  const cards = new Map<string, ShapeElement>();
  for (const n of tree) {
    const w = n.kind === 'north' ? 420 : CARD_W;
    const x = treeX + n.slot * PITCH + CARD_W / 2 - w / 2;
    const h = n.kind === 'north' ? LEVEL_H[0]! : CARD_H;
    const card = card_(n, x, levelY[n.level]! + (LEVEL_H[n.level]! - h) / 2, w, h);
    cards.set(n.id, card);
    out.push(card, trendBadge(n, card));
    if (n.kind === 'input' || n.kind === 'carried') out.push(tag(n, card));
  }
  out.push(...ring(cards.get(ns.id)!));
  out.push(...connectors(tree, cards), ...operators(tree, cards));
  out.push(
    ...levers(
      treeX + 4 * PITCH + 40,
      levelY[3]!,
      treeX + treeW - (treeX + 4 * PITCH + 40),
      LEVEL_H[3]!,
    ),
  );
  return out;
}

// A faint band a level, its name in the rail.
function levels(x: number, width: number, levelY: number[]): Element[] {
  const names = [
    ['North star', 'The one number'],
    ['Level 1', 'What makes it'],
    ['Level 2', 'What makes those'],
    ['Level 3', 'Inputs at the root'],
  ];
  return levelY.flatMap((y, i): Element[] => [
    {
      ...createShape('square', x, y - 16),
      width,
      height: LEVEL_H[i]! + 32,
      label: '',
      fillColor: i % 2 === 0 ? '#f8fafc' : '#f1f5f9',
      strokeColor: i % 2 === 0 ? '#f8fafc' : '#f1f5f9',
      borderRadius: 'md',
      themeLockFill: true,
      ...SCAFFOLD,
    },
    {
      ...createText(x + 18, y + LEVEL_H[i]! / 2 - 28),
      width: RAIL_W - 30,
      height: 28,
      label: names[i]![0]!,
      textSize: 'md',
      textBold: true,
      textColor: INK,
      textAlignX: 'left',
      ...SCAFFOLD,
    },
    {
      ...createText(x + 18, y + LEVEL_H[i]! / 2),
      width: RAIL_W - 30,
      height: 24,
      label: names[i]![1]!,
      textSize: 'sm',
      textColor: '#475569',
      textAlignX: 'left',
      ...SCAFFOLD,
    },
  ]);
}

function card_(n: Node, x: number, y: number, w: number, h: number): ShapeElement {
  const s = KIND_STYLE[n.kind];
  const runs: TextRun[] = [
    { text: n.name, bold: true, size: 'sm' },
    { text: `\n${n.value}`, bold: true, size: 'lg' },
    { text: `\n${n.owner}`, size: 'sm', color: s.soft },
  ];
  return {
    ...createShape('square', Math.round(x), y),
    width: w,
    height: h,
    label: runsPlainText(runs),
    richText: runs,
    textSize: n.kind === 'north' ? 'lg' : 'md',
    textColor: s.ink,
    textAlignX: 'left',
    fillColor: s.fill,
    strokeColor: s.stroke,
    strokeWidth: n.kind === 'north' ? 'thick' : 'medium',
    borderRadius: 'md',
    themeLockFill: true,
    ...CONTENT,
  };
}

// The change on last month, green up or red down, on the card's top-right corner (it travels with the card).
function trendBadge(n: Node, card: ShapeElement): Element {
  const up = n.trend >= 0;
  const label = `${up ? '▲' : '▼'} ${Math.abs(n.trend * 100).toFixed(1)}%`;
  const w = 84;
  return {
    ...createShape('badge', card.x + card.width - w / 2, card.y - BADGE_H / 2),
    width: w,
    height: BADGE_H,
    label,
    textSize: 'sm',
    textBold: true,
    fillColor: up ? '#dcfce7' : '#fee2e2',
    strokeColor: up ? '#16a34a' : '#dc2626',
    textColor: up ? '#14532d' : '#7f1d1d',
    themeLockFill: true,
    attachedTo: card.id,
    attachAt: 'top-right',
    ...CONTENT,
  };
}

// "Input" (a team moves it) or "Carried over" (last week's figure) on the card's bottom-right corner.
function tag(n: Node, card: ShapeElement): Element {
  const input = n.kind === 'input';
  const w = input ? 64 : 112;
  return {
    ...createShape('badge', card.x + card.width - w / 2, card.y + card.height - BADGE_H / 2),
    width: w,
    height: BADGE_H - 4,
    label: input ? 'Input' : 'Carried over',
    textSize: 'sm',
    fillColor: input ? '#15803d' : '#64748b',
    strokeColor: input ? '#15803d' : '#64748b',
    textColor: '#ffffff',
    themeLockFill: true,
    attachedTo: card.id,
    attachAt: 'bottom-right',
    ...CONTENT,
  };
}

// The north star's progress to its goal.
function ring(card: ShapeElement): Element[] {
  const d = 96;
  const progress = Math.round((driverTree(DRIVER_BASELINE).northStar / NORTH_STAR_GOAL) * 100);
  return [
    {
      ...createShape('progress-ring', card.x + card.width - d - 22, card.y + (card.height - d) / 2),
      width: d,
      height: d,
      progress,
      fillColor: '#ffffff',
      strokeColor: '#a78bfa',
      textColor: '#ffffff',
      themeLockFill: true,
      ...CONTENT,
    },
  ];
}

const LINE = {
  arrowEnds: 'none',
  arrowStyle: 'angled',
  strokeColor: '#64748b',
  strokeWidth: 2,
} as const;

function connectors(tree: Node[], cards: Map<string, ShapeElement>): Element[] {
  return tree.flatMap((n): Element[] => {
    if (!n.parent) return [];
    const p = cards.get(n.parent)!;
    const c = cards.get(n.id)!;
    return [
      {
        ...createPinnedArrow(p.id, 's', c.id, 'n'),
        ...LINE,
        curvePoints: rake(
          { x: p.x + p.width / 2, y: p.y + p.height },
          { x: c.x + c.width / 2, y: c.y },
        ),
        exactStart: true,
        ...CONTENT,
      },
    ];
  });
}

// The operator between each pair of siblings, level with their middles.
function operators(tree: Node[], cards: Map<string, ShapeElement>): Element[] {
  const out: Element[] = [];
  for (const [parent, op] of Object.entries(OPERATOR)) {
    const kids = tree.filter((n) => n.parent === parent).map((n) => cards.get(n.id)!);
    for (let i = 1; i < kids.length; i++) {
      const a = kids[i - 1]!;
      const b = kids[i]!;
      out.push({
        ...createShape(
          'circle',
          Math.round((a.x + a.width + b.x) / 2 - OP / 2),
          Math.round(a.y + a.height / 2 - OP / 2),
        ),
        width: OP,
        height: OP,
        label: op,
        textSize: 'lg',
        textBold: true,
        textColor: INK,
        fillColor: PAPER,
        strokeColor: '#94a3b8',
        themeLockFill: true,
        ...CONTENT,
      });
    }
  }
  return out;
}

// What a quarter's work on each lever buys, the biggest first (the Driver Model's levers table).
function levers(x: number, y: number, w: number, h: number): Element[] {
  const ranked = DRIVER_LEVERS.map((l) => ({ name: l.name, gain: leverGain(l) })).sort(
    (a, b) => b.gain - a.gain,
  );
  const runs: TextRun[] = [
    { text: 'Biggest levers', bold: true },
    ...ranked.slice(0, 3).map((l, i) => ({
      text: `\n${i + 1}. ${l.name}: +${num(l.gain)} a week`,
      size: 'sm' as const,
    })),
    {
      text: `\nWeakest: ${ranked.at(-1)!.name} (+${num(ranked.at(-1)!.gain)})`,
      size: 'sm',
      color: MUTED,
    },
  ];
  return [
    {
      ...createShape('square', Math.round(x), y),
      width: Math.round(w),
      height: h,
      label: runsPlainText(runs),
      richText: runs,
      textSize: 'md',
      textColor: INK,
      textAlignX: 'left',
      fillColor: '#eef2ff',
      strokeColor: '#a5b4fc',
      strokeWidth: 'medium',
      borderRadius: 'md',
      themeLockFill: true,
      ...CONTENT,
    },
  ];
}
