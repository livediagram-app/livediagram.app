// The Architecture Decision Record (docs/specs/008-canvas/canvas-and-palette.md "Templates"): one decision on one
// page, in Michael Nygard's order, for Plateful (the food-delivery app every technical starter describes). The header
// carries the number, the title and a status chip; then Context and Decision drivers side by side, the options scored
// in a table with the chosen row tinted, the Decision as the one filled card beside a before and after sketch of what
// changes, and Consequences (what gets better, what it costs) beside the Follow-ups checklist.
//
// The panels, their headings and the sketch's stage labels are the "Record" scaffold; the writing, table, stickies,
// sketch and checklist the "Decision" content. Every fill is a pale tint with dark ink set on it, so it reads the same
// under a dark theme. Pure: takes a centre (cx, cy), returns a fresh Element[].

import {
  createPinnedArrow,
  createShape,
  createSticky,
  createTable,
  createText,
  type Element,
  type TableCellStyle,
} from '@livediagram/document';
import { TEMPLATE_CONTENT_LAYER_ID, TEMPLATE_SCAFFOLD_LAYER_ID } from './template-layers';
import { TECH_HEADER_H, TECH_MUTED, techHeader } from './template-builders-technical-kit';

const INK = '#0f172a';
const PAPER = { fill: '#f8fafc', stroke: '#cbd5e1' };
const CHOSEN = { bg: '#dbeafe', ink: '#172554' };
const GOOD = { fill: '#bbf7d0', text: '#052e16' };
const COST = { fill: '#fde68a', text: '#451a03' };

const OPTIONS = [
  ['Option', 'Kitchen outage', 'Coupling', 'Effort', 'Running cost'],
  ['Keep direct calls', 'Orders fail', 'Tight', 'None', '£0'],
  ['Publish to a queue (Kafka)', 'Orders wait, then flow', 'Loose', '3 weeks', '£420 a month'],
  ['Nightly batch export', 'Orders wait a day', 'Loose', '1 week', '£40 a month'],
];
const CHOSEN_ROW = 2;
const HEAD: TableCellStyle = { bg: '#e2e8f0', textColor: INK, bold: true };

type Node = Extract<Element, { type: 'shape' }>;

export function buildArchitectureDecisionRecord(cx: number, cy: number): Element[] {
  const W = 1400;
  const gap = 32;
  const pad = 24;
  const headH = 40;
  const halfW = (W - gap) / 2;
  const row1H = 236;
  const tableRowH = 46;
  const tableH = OPTIONS.length * tableRowH;
  const row3H = 300;
  const row4H = 300;
  const headGap = 28;
  const totalH = TECH_HEADER_H + headGap + row1H + gap + headH + tableH + gap + row3H + gap + row4H;
  const left = cx - W / 2;
  const top = cy - totalH / 2;
  const row1Y = top + TECH_HEADER_H + headGap;
  const tableY = row1Y + row1H + gap;
  const row3Y = tableY + headH + tableH + gap;
  const row4Y = row3Y + row3H + gap;

  const scaffold: Element[] = [];
  const content: Element[] = [];
  const panel = (x: number, y: number, w: number, h: number, title: string) => {
    scaffold.push(
      {
        ...createShape('square', x, y),
        width: w,
        height: h,
        fillColor: PAPER.fill,
        strokeColor: PAPER.stroke,
        themeLockFill: true,
      },
      heading(x + pad, y + pad - 6, w - pad * 2, title),
    );
  };
  // A heading in a panel takes the panel's dark ink; one straight on the canvas takes the theme's, so it reads dark.
  const heading = (x: number, y: number, w: number, label: string, onCanvas = false): Element => ({
    ...createText(x, y),
    width: w,
    height: headH,
    label,
    textSize: 'md',
    textBold: true,
    ...(onCanvas ? {} : { textColor: INK }),
    textAlignX: 'left',
  });
  const body = (x: number, y: number, w: number, h: number, label: string): Element => ({
    ...createText(x, y),
    width: w,
    height: h,
    label,
    textSize: 'sm',
    textColor: '#334155',
    textAlignX: 'left',
    textAlignY: 'top',
  });

  // The header and its status chip.
  scaffold.push(
    ...techHeader(
      left,
      top,
      W - 200,
      'ADR 012 · Publish order events to a queue',
      'Accepted on 3 March by Priya (platform), Tom (orders) and Ana (dispatch). Supersedes ADR 007.',
    ),
  );
  content.push({
    ...createShape('stadium', left + W - 160, top + 6),
    width: 160,
    height: 40,
    label: '✓ Accepted',
    textSize: 'md',
    textBold: true,
    fillColor: '#dcfce7',
    strokeColor: '#16a34a',
    textColor: '#14532d',
    themeLockFill: true,
  });

  // Context and Decision drivers.
  panel(left, row1Y, halfW, row1H, 'Context');
  content.push(
    body(
      left + pad,
      row1Y + pad + headH,
      halfW - pad * 2,
      row1H - pad * 2 - headH,
      'The order service calls the kitchen and dispatch services directly and waits for both. On Friday 14 February the kitchen service went down for 22 minutes, and every order placed in that time failed: 1,180 customers saw an error at checkout. Adding a third consumer (loyalty points) means changing the order service again.',
    ),
  );
  panel(left + halfW + gap, row1Y, halfW, row1H, 'Decision drivers');
  content.push(
    body(
      left + halfW + gap + pad,
      row1Y + pad + headH,
      halfW - pad * 2,
      row1H - pad * 2 - headH,
      '1. An order is never lost because another service is down.\n2. A new consumer joins without a change to the order service.\n3. The kitchen sees a new order within 2 seconds.\n4. The team can run it: we already operate Kafka for analytics.',
    ),
  );

  // The options, scored, the chosen row tinted.
  scaffold.push(heading(left, tableY, W, 'Options considered', true));
  content.push({
    ...createTable(left, tableY + headH),
    width: W,
    height: tableH,
    cells: OPTIONS.map((row) => [...row]),
    cellStyles: OPTIONS.map((row, r) =>
      row.map((_, c): TableCellStyle | null => {
        if (r === 0) return HEAD;
        if (r === CHOSEN_ROW) return { bg: CHOSEN.bg, textColor: CHOSEN.ink, bold: c === 0 };
        return c === 0 ? { ...HEAD, bg: '#f1f5f9' } : null;
      }),
    ),
    headerRow: true,
    headerColumn: true,
    colWidths: [360, null, null, null, null],
  });

  // The decision, and the sketch of what changes.
  const decisionW = 460;
  content.push({
    ...createShape('card', left, row3Y),
    width: decisionW,
    height: row3H,
    cardHeader: true,
    headerFill: '#1d4ed8',
    pageTitle: 'Decision',
    pageSubtitle: 'Option 2',
    label:
      'The order service publishes an OrderPlaced event to the order-events topic and stops calling other services. The kitchen and dispatch services each read the topic at their own pace, and a new consumer subscribes without asking.',
    textSize: 'sm',
    textAlignX: 'left',
    fillColor: '#eff6ff',
    strokeColor: '#1d4ed8',
    textColor: '#172554',
    strokeWidth: 'thick',
    themeLockFill: true,
  });
  const sketchX = left + decisionW + gap;
  const sketchW = W - decisionW - gap;
  panel(sketchX, row3Y, sketchW, row3H, 'What changes');
  const nodeW = 170;
  const nodeH = 52;
  const svc = (x: number, y: number, label: string, store = false): Node => ({
    ...createShape(store ? 'cylinder' : 'square', x, y),
    width: nodeW,
    height: store ? nodeH + 12 : nodeH,
    label,
    textSize: 'sm',
    fillColor: store ? '#fef3c7' : '#ffffff',
    strokeColor: store ? '#d97706' : '#64748b',
    textColor: INK,
    themeLockFill: true,
  });
  const half = (sketchW - pad * 3) / 2;
  const stageY = row3Y + pad + headH;
  const before = sketchX + pad;
  const after = sketchX + pad * 2 + half;
  const stage = (x: number, label: string, ink: string): Element => ({
    ...createText(x, stageY),
    width: half,
    height: 28,
    label,
    textSize: 'sm',
    textBold: true,
    textColor: ink,
    textAlignX: 'left',
  });
  scaffold.push(
    stage(before, 'Before: calls both and waits', '#b91c1c'),
    stage(after, 'After: one event, read by both', '#15803d'),
  );
  const rowA = stageY + 52;
  const rowB = rowA + 130;
  const bOrder = svc(before, rowA + 64, 'Order service');
  const bKitchen = svc(before + half - nodeW, rowA, 'Kitchen service');
  const bDispatch = svc(before + half - nodeW, rowB, 'Dispatch service');
  const aOrder = svc(after, rowA + 64, 'Order service');
  const aTopic = svc(after + (half - nodeW) / 2 + 30, rowA + 58, 'order-events', true);
  const aKitchen = svc(after + half - nodeW + 60, rowA - 10, 'Kitchen');
  const aDispatch = svc(after + half - nodeW + 60, rowB + 10, 'Dispatch');
  // The sketch stays small: the "after" side's last column narrows to fit beside the topic.
  for (const n of [aTopic, aKitchen, aDispatch]) n.width = 130;
  aTopic.x = after + nodeW + 40;
  aKitchen.x = after + half - 130;
  aDispatch.x = after + half - 130;
  content.push(
    bOrder,
    bKitchen,
    bDispatch,
    aOrder,
    aTopic,
    aKitchen,
    aDispatch,
    { ...createPinnedArrow(bOrder.id, 'e', bKitchen.id, 'w'), strokeColor: '#b91c1c' },
    { ...createPinnedArrow(bOrder.id, 'e', bDispatch.id, 'w'), strokeColor: '#b91c1c' },
    { ...createPinnedArrow(aOrder.id, 'e', aTopic.id, 'w'), flow: 'dots' },
    { ...createPinnedArrow(aTopic.id, 'e', aKitchen.id, 'w'), flow: 'dots' },
    { ...createPinnedArrow(aTopic.id, 'e', aDispatch.id, 'w'), flow: 'dots' },
  );

  // Consequences, and what to do next.
  const consW = W - 460 - gap;
  panel(left, row4Y, consW, row4H, 'Consequences');
  const colW = (consW - pad * 3) / 2;
  const noteH = 92;
  const notesY = row4Y + pad + headH + 36;
  const sub = (x: number, label: string, ink: string): Element => ({
    ...createText(x, row4Y + pad + headH),
    width: colW,
    height: 28,
    label,
    textSize: 'sm',
    textBold: true,
    textColor: ink,
    textAlignX: 'left',
  });
  scaffold.push(
    sub(left + pad, 'Gets better', '#15803d'),
    sub(left + pad * 2 + colW, 'Costs us', '#b45309'),
  );
  const sticky = (x: number, y: number, label: string, hue: { fill: string; text: string }) => ({
    ...createSticky(x, y),
    width: colW,
    height: noteH,
    label,
    textSize: 'sm' as const,
    fillColor: hue.fill,
    textColor: hue.text,
  });
  content.push(
    sticky(left + pad, notesY, 'Checkout keeps working when the kitchen service is down', GOOD),
    sticky(
      left + pad,
      notesY + noteH + 14,
      'Loyalty points can subscribe without touching orders',
      GOOD,
    ),
    sticky(
      left + pad * 2 + colW,
      notesY,
      'Eventual consistency: a new order reaches the kitchen in about a second, not at once',
      COST,
    ),
    sticky(
      left + pad * 2 + colW,
      notesY + noteH + 14,
      'One more thing to run on call: topic lag needs an alert',
      COST,
    ),
  );
  const followX = left + consW + gap;
  panel(followX, row4Y, 460, row4H, 'Follow-ups');
  content.push({
    ...createShape('checklist', followX + pad, row4Y + pad + headH),
    width: 460 - pad * 2,
    height: 4 * 40 + 24,
    checklistItems: [
      { text: 'Create the order-events topic · Priya · 10 Mar', done: true },
      { text: 'Publish OrderPlaced from checkout · Tom · 17 Mar', done: false },
      { text: 'Move the kitchen to the topic · Ana · 24 Mar', done: false },
      { text: 'Alert on topic lag over 30 s · Priya · 24 Mar', done: false },
    ],
  });
  // A muted line under the follow-ups saying where the record goes next.
  content.push({
    ...body(
      followX + pad,
      row4Y + pad + headH + 4 * 40 + 36,
      460 - pad * 2,
      44,
      'Review in June, once loyalty points has joined.',
    ),
    textColor: TECH_MUTED,
  });

  return [
    ...scaffold.map((el) => ({ ...el, layerId: TEMPLATE_SCAFFOLD_LAYER_ID })),
    ...content.map((el) => ({ ...el, layerId: TEMPLATE_CONTENT_LAYER_ID })),
  ];
}
