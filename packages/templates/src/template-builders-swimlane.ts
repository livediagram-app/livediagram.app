// The swimlane flowchart template builder (docs/specs/008-canvas/canvas-and-palette.md "Templates").
// Pure: (cx, cy) -> Element[], centred on (cx, cy). Its process siblings
// (approval workflow, decision tree, data flow) live in their own
// template-builders-*.ts files, re-exported from template-builders-flows.

import {
  createPinnedArrow,
  createShape,
  createText,
  type Anchor,
  type Element,
  type ShapeKind,
} from '@livediagram/document';
import { swimlaneKey, type LaneHue } from './template-swimlane-kit';

const MUTED = '#64748b';
const INK = '#334155';

type Role = LaneHue & { name: string; blurb: string; icon: string };
const ROLES: Role[] = [
  {
    name: 'Customer',
    blurb: 'Orders and waits',
    icon: 'user',
    band: '#faf5ff',
    header: '#f3e8ff',
    line: '#d8b4fe',
    node: '#a855f7',
    tint: '#f3e8ff',
    ink: '#6b21a8',
  },
  {
    name: 'Sales',
    blurb: 'Checks the order',
    icon: 'cart',
    band: '#f0f9ff',
    header: '#e0f2fe',
    line: '#bae6fd',
    node: '#0ea5e9',
    tint: '#e0f2fe',
    ink: '#075985',
  },
  {
    name: 'Warehouse',
    blurb: 'Picks and packs',
    icon: 'package',
    band: '#fffbeb',
    header: '#fef3c7',
    line: '#fde68a',
    node: '#f59e0b',
    tint: '#fef3c7',
    ink: '#92400e',
  },
  {
    name: 'Courier',
    blurb: 'Brings it to the door',
    icon: 'map-pin',
    band: '#ecfdf5',
    header: '#d1fae5',
    line: '#a7f3d0',
    node: '#10b981',
    tint: '#d1fae5',
    ink: '#065f46',
  },
];

// Swimlane flowchart: one FreshBox order's journey from click to doorstep
// across four role lanes (Customer / Sales / Warehouse / Courier). Each lane
// is a LANE element (docs/specs/009-elements/lane.md) in its own hue, its
// gutter naming the role over one line of what they do, with the role's
// glyph beneath; every step is outlined in its lane's hue, so whose desk a
// step is on reads before its words do.
//
// Every step sits on a shared column grid, one column per step, so each
// hand-off is either a straight run inside a lane or an angled run that
// drops or climbs through EMPTY columns: no diagonal cuts across a lane and
// no arrow passes behind a step. The lanes stand apart with a gap, so a
// label on a line that changes lanes sits in open canvas between them, never
// on a border.
//
// The flow demonstrates every swimlane idiom: hand-off (the order drops into
// Sales), branch (In stock?), detour + rejoin (Restock back into Pick &
// pack), notify (a tracking text climbing to the customer) and the round
// trip (the delivery climbing back to the lane the process started in).
export function buildSwimlane(cx: number, cy: number): Element[] {
  const gutter = 176;
  const cols = 8;
  const colW = 172;
  const stepW = 148;
  const stepH = 60;
  const pad = 24;
  const laneW = gutter + pad * 2 + (cols - 1) * colW + stepW;
  const laneH = 120;
  const laneGap = 36;
  const titleH = 44;
  const captionH = 28;
  const headGap = 24;
  const keyGap = 28;
  const keyH = 28;
  const lanesH = ROLES.length * laneH + (ROLES.length - 1) * laneGap;
  const totalH = titleH + captionH + headGap + lanesH + keyGap + keyH;
  const left = cx - laneW / 2;
  const top = cy - totalH / 2;
  const lanesTop = top + titleH + captionH + headGap;
  const laneTop = (i: number) => lanesTop + i * (laneH + laneGap);
  const laneCY = (i: number) => laneTop(i) + laneH / 2;
  const colX = (col: number) => left + gutter + pad + stepW / 2 + col * colW;

  const els: Element[] = [
    {
      ...createText(left, top),
      width: laneW,
      height: titleH,
      label: 'FreshBox · one order, click to doorstep',
      textSize: 'lg',
      textBold: true,
      textAlignX: 'left',
    },
    {
      ...createText(left, top + titleH),
      width: laneW,
      height: captionH,
      label:
        'One lane per team. Read left to right; a line that changes lanes is a hand-off, and every hand-off is where orders get stuck.',
      textSize: 'sm',
      textColor: MUTED,
      textAlignX: 'left',
    },
  ];
  ROLES.forEach((role, i) => {
    const y = laneTop(i);
    els.push(
      {
        ...createShape('lane', left, y),
        width: laneW,
        height: laneH,
        label: role.name,
        textSize: 'md',
        textBold: true,
        textColor: role.ink,
        textAlignX: 'left',
        textAlignY: 'top',
        fillColor: role.band,
        strokeColor: role.line,
        headerFill: role.header,
        headerSize: gutter,
      },
      {
        ...createText(left + 26, y + 50),
        width: gutter - 40,
        height: 24,
        label: role.blurb,
        textSize: 'sm',
        textColor: MUTED,
        textAlignX: 'left',
      },
      {
        ...createShape('icon', left + 26, y + laneH - 40),
        width: 22,
        height: 22,
        iconId: role.icon,
        strokeColor: role.ink,
      },
    );
  });

  type Step = Extract<Element, { type: 'shape' }>;
  const step = (label: string, col: number, lane: number, look: Partial<Step> = {}): Step => ({
    ...createShape('square' as ShapeKind, colX(col) - stepW / 2, laneCY(lane) - stepH / 2),
    width: stepW,
    height: stepH,
    label,
    textSize: 'sm',
    fillColor: '#ffffff',
    strokeColor: ROLES[lane]!.node,
    textColor: INK,
    ...look,
  });
  const customer = ROLES[0]!;
  // The start is the one filled step, the finish its soft echo.
  const order = step('Place order', 0, 0, {
    shape: 'stadium',
    fillColor: customer.node,
    strokeColor: '#7e22ce',
    textColor: '#ffffff',
    textBold: true,
  });
  const check = step('Check payment', 1, 1);
  const inStock = step('In stock?', 2, 1, {
    shape: 'diamond',
    x: colX(2) - 75,
    y: laneCY(1) - 44,
    width: 150,
    height: 88,
    fillColor: ROLES[1]!.tint,
  });
  // The detour sits directly below the gate: dashed, it is the exception.
  const restock = step('Restock item', 2, 2, { strokeStyle: 'dashed' });
  const pick = step('Pick & pack', 3, 2);
  const book = step('Book courier', 4, 2);
  const collect = step('Collect parcel', 5, 3);
  const deliver = step('Deliver to door', 6, 3);
  const track = step('Track the van', 4, 0);
  const received = step('Order received', 7, 0, {
    shape: 'stadium',
    fillColor: customer.tint,
    textBold: true,
  });

  const link = (
    from: Step,
    fa: Anchor,
    to: Step,
    ta: Anchor,
    extra: Partial<Extract<Element, { type: 'arrow' }>> = {},
  ): Element => ({ ...createPinnedArrow(from.id, fa, to.id, ta), ...extra });
  const inLane = (i: number) => ({ textColor: ROLES[i]!.ink, labelFill: ROLES[i]!.band });
  const arrows: Element[] = [
    // Down into Sales, then across into the check.
    link(order, 's', check, 'w', { arrowStyle: 'angled' }),
    link(check, 'e', inStock, 'w'),
    link(inStock, 'e', pick, 'n', {
      arrowStyle: 'angled',
      label: 'Yes',
      ...inLane(1),
      labelOffset: { t: 0.22, offset: 12 },
    }),
    // The No drops through the gap between the lanes, where its label sits.
    link(inStock, 's', restock, 'n', { label: 'No' }),
    link(restock, 'e', pick, 'w'),
    link(pick, 'e', book, 'w'),
    link(book, 'e', collect, 'n', { arrowStyle: 'angled' }),
    link(collect, 'e', deliver, 'w'),
    // Booking the courier texts the customer a tracking link: the line climbs
    // straight up through Sales' empty column. Crossing a lane it has no end
    // in, it stays drawn over it.
    link(book, 'n', track, 's', {
      label: 'Tracking text',
      ...inLane(1),
      strokeStyle: 'dashed',
      routeBehind: false,
      labelOffset: { t: 0.5, offset: 0 },
    }),
    link(track, 'e', received, 'w'),
    // The round trip: the delivery climbs back to the lane it started in.
    link(deliver, 'e', received, 's', { arrowStyle: 'angled', routeBehind: false }),
  ];

  const keyY = lanesTop + lanesH + keyGap;
  els.push(...swimlaneKey(left, keyY, keyH));

  return [
    ...els,
    ...arrows,
    order,
    check,
    inStock,
    restock,
    pick,
    book,
    collect,
    deliver,
    track,
    received,
  ];
}
