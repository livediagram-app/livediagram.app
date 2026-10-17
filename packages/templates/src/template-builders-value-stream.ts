// The Value stream map template (docs/specs/008-canvas/canvas-and-palette.md "Templates"): how a change gets from an
// idea to production at Plateful. This builds its first tab, the drawing; the second, Flow Data, is the companion
// Sheet (template-companions.ts) worked from the same steps (@livediagram/sheets VALUE_STREAM_STEPS,
// valueStreamTotals), so every time and total here is one that sheet works out.
//
// The classic notation, left to right: the information flow along the top (ideas into the Product team, the Jira
// backlog, a weekly planning push), the customer (the people waiting for the change) top right; six process boxes,
// each a header over a data box of its process time, % complete and accurate and the people on it; an inventory
// triangle before each with its queue and wait; push arrows between them; and the timeline ladder underneath, waits on
// the high rungs and process times on the low ones, summed at its end into the totals. Kaizen bursts mark the worst
// waits with their fix, and a Future state card sets the target.
//
// Layers: "Map" holds the notation, ladder rungs and legend; "Stream" the figures, bursts and notes.
//
// Pure: takes a centre (cx, cy), returns a fresh Element[].

import {
  createArrow,
  createPinnedArrow,
  createShape,
  createText,
  runsPlainText,
  type Element,
  type ShapeElement,
  type TextRun,
} from '@livediagram/document';
import {
  VALUE_STREAM_HOURS_PER_DAY,
  VALUE_STREAM_STEPS,
  valueStreamTotals,
} from '@livediagram/sheets';
import { techHeader, TECH_HEADER_H } from './template-builders-technical-kit';
import { CONTENT, INK, MUTED, PAPER, SCAFFOLD, chipRow } from './template-report-kit';
import { CANVAS_TONES } from './template-inks';

const TITLE = 'Plateful · Value stream: idea to production';
const CAPTION =
  'Each step’s process time is the work; the triangles before it are the waiting. The ladder adds both up: the gap between them is the flow to win back. The numbers match the Flow Data tab.';

const LEFT = 40;
const SLOT = 330; // a step: its inventory triangle, then its box
const TRI_W = 120;
const BOX_W = SLOT - TRI_W;
const HEAD_H = 54;
const DATA_H = 112;
const TOTALS_W = 250;

const TEAL = { deep: '#0f766e', head: '#115e59', soft: '#ccfbf1', line: '#5eead4' };
const QUEUE = { fill: '#fef3c7', stroke: '#d97706', ink: '#78350f' };
const BURST = { fill: '#fee2e2', stroke: '#dc2626', ink: '#991b1b' };

// The two worst waits and their fixes, by step.
const BURSTS: readonly { step: string; text: string }[] = [
  { step: 'Code review', text: 'Waits 3 days: pair, or a 4-hour review SLA' },
  { step: 'QA', text: 'Batches weekly: automate the regression suite' },
];

const FUTURE = {
  title: 'Future state',
  lines: [
    'Lead time 10 days (from 27)',
    'Review inside 4 hours',
    'Release on every merge',
    'Refine weekly, not monthly',
  ],
};

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const hours = (h: number) => `${fmt(h)} h`;
const days = (d: number) => `${fmt(d)} d`;

export function buildValueStreamMap(cx: number, cy: number): Element[] {
  const n = VALUE_STREAM_STEPS.length;
  const width = LEFT + n * SLOT + 40 + TOTALS_W;
  const top0 = 0;
  const infoH = 96;
  const burstsH = 110;
  const procY0 = top0 + infoH + burstsH;
  const ladderY0 = procY0 + HEAD_H + DATA_H + 64;
  const height = TECH_HEADER_H + 28 + ladderY0 + 60 + 70 + 150;
  const x0 = cx - width / 2;
  const y0 = cy - height / 2;
  const top = y0 + TECH_HEADER_H + 28;
  const procY = top + procY0;
  const ladderY = top + ladderY0;
  const slotX = (i: number) => x0 + LEFT + i * SLOT;
  const totals = valueStreamTotals();

  const out: Element[] = [
    ...techHeader(x0, y0, width, TITLE, CAPTION, {
      title: CONTENT.layerId,
      caption: SCAFFOLD.layerId,
    }),
    ...chipRow(x0 + width, y0 + 10, [
      {
        w: 170,
        label: `Lead time ${days(totals.leadDays)}`,
        fill: '#ccfbf1',
        stroke: '#5eead4',
        ink: '#134e4a',
      },
      {
        w: 200,
        label: `Flow efficiency ${Math.round(totals.flowEfficiency * 100)}%`,
        fill: '#fee2e2',
        stroke: '#fca5a5',
        ink: '#991b1b',
      },
    ]),
  ];
  const boxes: ShapeElement[] = [];
  VALUE_STREAM_STEPS.forEach((s, i) => {
    const bx = slotX(i) + TRI_W;
    const head: ShapeElement = {
      ...createShape('square', bx, procY),
      width: BOX_W,
      height: HEAD_H,
      label: s.step,
      textSize: 'md',
      textBold: true,
      textColor: '#ffffff',
      fillColor: TEAL.head,
      strokeColor: TEAL.head,
      themeLockFill: true,
      ...SCAFFOLD,
    };
    const runs: TextRun[] = [
      { text: `PT ${hours(s.processHours)}`, bold: true },
      { text: `\n%C&A ${Math.round(s.completeAccurate * 100)}%`, size: 'sm' },
      { text: `\n${s.people} ${s.people === 1 ? 'person' : 'people'} · ${s.owner}`, size: 'sm' },
    ];
    boxes.push(head);
    out.push(head, {
      ...createShape('square', bx, procY + HEAD_H),
      width: BOX_W,
      height: DATA_H,
      label: runsPlainText(runs),
      richText: runs,
      textSize: 'md',
      textColor: INK,
      textAlignX: 'left',
      fillColor: PAPER,
      strokeColor: TEAL.line,
      themeLockFill: true,
      ...CONTENT,
    });
    // The queue before the step: a triangle with its count, and its wait under it.
    const tx = slotX(i) + (TRI_W - 76) / 2;
    const ty = procY + HEAD_H + 6;
    out.push(
      {
        ...createShape('triangle', tx, ty),
        width: 76,
        height: 64,
        label: String(s.queued),
        textSize: 'sm',
        textBold: true,
        textAlignY: 'bottom',
        textColor: QUEUE.ink,
        fillColor: QUEUE.fill,
        strokeColor: QUEUE.stroke,
        strokeWidth: 'medium',
        themeLockFill: true,
        ...CONTENT,
      },
      {
        ...createText(slotX(i), ty + 70),
        width: TRI_W,
        height: 22,
        label: `waits ${days(s.waitDays)}`,
        textSize: 'sm',
        textColor: MUTED,
        ...CONTENT,
      },
    );
  });
  // Push arrows between the steps, over the triangles.
  for (let i = 1; i < n; i++)
    out.push({
      ...createPinnedArrow(boxes[i - 1]!.id, 'e', boxes[i]!.id, 'w'),
      strokeColor: INK,
      arrowheadColor: INK,
      strokeWidth: 4,
      strokeStyle: 'dashed',
      ...SCAFFOLD,
    });
  out.push(...information(x0, slotX, top, boxes));
  out.push(...bursts(slotX, procY, burstsH));
  out.push(...ladder(slotX, ladderY, n));
  out.push(...totalsBox(slotX(n) + 40, ladderY - 40, totals));
  out.push(...footer(x0, ladderY + 120, width));
  return out;
}

// The information flow, right to left as the notation runs it: the people waiting send requests and ideas to the
// Product team's backlog, and a weekly planning push hands them to the first step.
function information(
  _x0: number,
  slotX: (i: number) => number,
  top: number,
  boxes: ShapeElement[],
): Element[] {
  const card = (x: number, w: number, label: string, iconId: string): ShapeElement => ({
    ...createShape('square', x, top),
    width: w,
    height: 72,
    label,
    iconId,
    textSize: 'sm',
    textBold: true,
    textColor: INK,
    fillColor: '#f8fafc',
    strokeColor: '#475569',
    strokeWidth: 'medium',
    borderRadius: 'md',
    themeLockFill: true,
    ...SCAFFOLD,
  });
  const product = card(slotX(2) + TRI_W, BOX_W + 60, 'Product team · Jira backlog', 'layers');
  const customer = card(slotX(5) + TRI_W, BOX_W, 'People waiting for the change', 'heart');
  const info = {
    strokeColor: '#475569',
    strokeWidth: 2,
    strokeStyle: 'dashed' as const,
    textColor: INK,
  };
  return [
    product,
    customer,
    {
      ...createPinnedArrow(customer.id, 'w', product.id, 'e'),
      label: 'Requests and ideas',
      ...info,
      ...SCAFFOLD,
    },
    {
      ...createPinnedArrow(product.id, 'w', boxes[0]!.id, 'n'),
      label: 'Weekly planning',
      arrowStyle: 'angled',
      ...info,
      ...SCAFFOLD,
    },
    {
      ...createPinnedArrow(boxes.at(-1)!.id, 'n', customer.id, 's'),
      label: 'Shipped',
      textColor: INK,
      strokeColor: TEAL.deep,
      strokeWidth: 3,
      ...SCAFFOLD,
    },
  ];
}

// A kaizen burst over each worst wait, its fix beside it.
function bursts(slotX: (i: number) => number, procY: number, h: number): Element[] {
  return BURSTS.flatMap((b): Element[] => {
    const i = VALUE_STREAM_STEPS.findIndex((s) => s.step === b.step);
    const x = slotX(i) + 20;
    const y = procY - h + 6;
    return [
      {
        ...createShape('star', x, y),
        width: 84,
        height: 84,
        label: '',
        fillColor: BURST.fill,
        strokeColor: BURST.stroke,
        strokeWidth: 'medium',
        themeLockFill: true,
        ...CONTENT,
      },
      {
        ...createText(x + 90, y + 14),
        width: SLOT - 120,
        height: 56,
        label: b.text,
        textSize: 'sm',
        textBold: true,
        // Beside the burst, on the canvas: the burst's deep red ink sank into the dark one.
        textColor: CANVAS_TONES.red,
        textAlignX: 'left',
        ...CONTENT,
      },
    ];
  });
}

// The timeline ladder: each step's wait on the high rung over its triangle, its process time on the low rung under
// its box, joined into one square wave.
function ladder(slotX: (i: number) => number, y: number, n: number): Element[] {
  const low = y + 48;
  const out: Element[] = [];
  const rung = (x1: number, y1: number, x2: number, y2: number): Element => ({
    ...createArrow(x1, y1, x2, y2),
    arrowEnds: 'none',
    strokeColor: INK,
    strokeWidth: 2.5,
    ...SCAFFOLD,
  });
  VALUE_STREAM_STEPS.forEach((s, i) => {
    const a = slotX(i);
    const b = a + TRI_W;
    const c = a + SLOT;
    out.push(rung(a, y, b, y), rung(b, y, b, low), rung(b, low, c, low));
    if (i < n - 1) out.push(rung(c, low, c, y));
    out.push(
      {
        ...createText(a, y - 30),
        width: TRI_W,
        height: 26,
        label: days(s.waitDays),
        textSize: 'sm',
        textBold: true,
        textColor: '#b45309',
        ...CONTENT,
      },
      {
        ...createText(b, low + 6),
        width: BOX_W,
        height: 26,
        label: hours(s.processHours),
        textSize: 'sm',
        textBold: true,
        textColor: TEAL.deep,
        ...CONTENT,
      },
    );
  });
  return out;
}

function totalsBox(x: number, y: number, t: ReturnType<typeof valueStreamTotals>): Element[] {
  const runs: TextRun[] = [
    { text: 'Totals', bold: true },
    { text: `\nLead time  ${days(t.leadDays)}`, size: 'sm' },
    {
      text: `\nProcess time  ${days(t.processDays)} (${VALUE_STREAM_HOURS_PER_DAY} h days)`,
      size: 'sm',
    },
    { text: `\nFlow efficiency  ${Math.round(t.flowEfficiency * 100)}%`, size: 'sm', bold: true },
    { text: `\nRolled %C&A  ${Math.round(t.rolledCompleteAccurate * 100)}%`, size: 'sm' },
  ];
  return [
    {
      ...createShape('square', x, y),
      width: TOTALS_W,
      height: 150,
      label: runsPlainText(runs),
      richText: runs,
      textSize: 'md',
      textColor: '#134e4a',
      textAlignX: 'left',
      fillColor: '#f0fdfa',
      strokeColor: TEAL.deep,
      strokeWidth: 'medium',
      borderRadius: 'md',
      themeLockFill: true,
      ...CONTENT,
    },
  ];
}

// Under the ladder: the key to the notation, and the future state.
function footer(x: number, y: number, width: number): Element[] {
  const out: Element[] = [];
  const keyY = y + 20;
  const item = (i: number, sample: Element, label: string) => {
    out.push(sample, {
      ...createText(x + LEFT + i * 250 + 80, keyY + 8),
      width: 160,
      height: 26,
      label,
      textSize: 'sm',
      textAlignX: 'left',
      ...SCAFFOLD,
    });
  };
  const sx = (i: number) => x + LEFT + i * 250;
  item(
    0,
    {
      ...createShape('square', sx(0), keyY),
      width: 64,
      height: 40,
      label: '',
      fillColor: TEAL.head,
      strokeColor: TEAL.head,
      themeLockFill: true,
      ...SCAFFOLD,
    },
    'Process',
  );
  item(
    1,
    {
      ...createShape('triangle', sx(1) + 10, keyY),
      width: 46,
      height: 40,
      label: '',
      fillColor: QUEUE.fill,
      strokeColor: QUEUE.stroke,
      themeLockFill: true,
      ...SCAFFOLD,
    },
    'Queue (waiting)',
  );
  item(
    2,
    {
      ...createArrow(sx(2), keyY + 20, sx(2) + 64, keyY + 20),
      strokeColor: INK,
      strokeWidth: 4,
      strokeStyle: 'dashed',
      ...SCAFFOLD,
    },
    'Push',
  );
  item(
    3,
    {
      ...createShape('star', sx(3) + 12, keyY - 2),
      width: 44,
      height: 44,
      label: '',
      fillColor: BURST.fill,
      strokeColor: BURST.stroke,
      themeLockFill: true,
      ...SCAFFOLD,
    },
    'Kaizen burst',
  );
  const futW = 420;
  const runs: TextRun[] = [
    { text: FUTURE.title, bold: true },
    ...FUTURE.lines.map((l) => ({ text: `\n· ${l}`, size: 'sm' as const })),
  ];
  out.push({
    ...createShape('square', x + width - futW, y),
    width: futW,
    height: 140,
    label: runsPlainText(runs),
    richText: runs,
    textSize: 'md',
    textColor: INK,
    textAlignX: 'left',
    fillColor: '#ecfeff',
    strokeColor: '#06b6d4',
    strokeWidth: 'medium',
    strokeStyle: 'dashed',
    borderRadius: 'md',
    themeLockFill: true,
    ...CONTENT,
  });
  return out;
}
