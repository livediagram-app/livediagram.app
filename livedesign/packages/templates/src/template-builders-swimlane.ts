// The swimlane flowchart template builder (docs/specs/008-canvas/canvas-and-palette.md "Templates").
// Pure: (cx, cy) -> Element[], centred on (cx, cy). Its process siblings
// (approval workflow, decision tree, data flow) live in their own
// template-builders-*.ts files, re-exported from template-builders-flows.

import {
  createPinnedArrow,
  createShape,
  createText,
  type ArrowElement,
  type Element,
  type ShapeElement,
} from '@livedesign/document';
import { liveFlowchart } from './template-flowchart-live';
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
// It is a live flowchart (docs/specs/009-elements/flowchart.md "Templates"): the lanes and steps are
// one chart flowing right, laid out by the flowchart layout, so each step sits in its lane's band, a
// column of steps lines up through every lane, and Tab and Enter grow it in place.
//
// The flow demonstrates every swimlane idiom: hand-off (the order drops into
// Sales), branch (In stock?), detour + rejoin (Restock back into Pick &
// pack), notify (a tracking text climbing to the customer) and the round
// trip (the delivery climbing back to the lane the process started in).
export function buildSwimlane(cx: number, cy: number): Element[] {
  const gutter = 176;
  const stepW = 148;
  const stepH = 60;
  const titleH = 44;
  const captionH = 28;
  const headGap = 24;
  const keyGap = 28;
  const keyH = 28;

  // Seed positions: a lane per row, a column per step. They fix the order the layout reads; it
  // places everything.
  const seedLaneH = 160;
  const lanes: ShapeElement[] = ROLES.map((role, i) => ({
    ...createShape('lane', 0, i * seedLaneH),
    width: 1200,
    height: seedLaneH,
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
  }));

  const step = (
    label: string,
    col: number,
    lane: number,
    look: Partial<ShapeElement> = {},
  ): ShapeElement => ({
    ...createShape('square', gutter + col * 172, lane * seedLaneH + 50),
    width: stepW,
    height: stepH,
    label,
    textSize: 'sm',
    fillColor: '#ffffff',
    strokeColor: ROLES[lane]!.node,
    textColor: INK,
    flowLaneId: lanes[lane]!.id,
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
    width: 150,
    height: 88,
    fillColor: ROLES[1]!.tint,
  });
  // The detour: dashed, it is the exception.
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
  const steps = [order, check, inStock, restock, pick, book, collect, deliver, track, received];

  const link = (
    from: ShapeElement,
    to: ShapeElement,
    extra: Partial<ArrowElement> = {},
  ): ArrowElement => ({
    ...createPinnedArrow(from.id, 'e', to.id, 'w'),
    arrowStyle: 'angled',
    ...extra,
  });
  const inLane = (i: number) => ({ textColor: ROLES[i]!.ink, labelFill: ROLES[i]!.band });
  const connectors: ArrowElement[] = [
    link(order, check),
    link(check, inStock),
    link(inStock, pick, { label: 'Yes', ...inLane(1) }),
    link(inStock, restock, { label: 'No', ...inLane(2) }),
    link(restock, pick),
    link(pick, book),
    link(book, collect),
    link(collect, deliver),
    // Booking the courier texts the customer a tracking link. Crossing lanes it has no end in, it
    // stays drawn over them.
    link(book, track, {
      label: 'Tracking text',
      ...inLane(1),
      strokeStyle: 'dashed',
      routeBehind: false,
    }),
    link(track, received),
    // The round trip: the delivery climbs back to the lane it started in.
    link(deliver, received, { routeBehind: false }),
  ];

  // Laid out once to learn its size, then placed so the whole composition centres on (cx, cy).
  const probe = liveFlowchart(steps, connectors, {
    direction: 'right',
    lanes,
    left: 0,
    top: 0,
  }).bounds;
  const totalH = titleH + captionH + headGap + probe.height + keyGap + keyH;
  const left = Math.round(cx - probe.width / 2);
  const top = Math.round(cy - totalH / 2);
  const lanesTop = top + titleH + captionH + headGap;
  const chart = liveFlowchart(steps, connectors, {
    direction: 'right',
    lanes,
    left,
    top: lanesTop,
  });

  const els: Element[] = [
    {
      ...createText(left, top),
      width: probe.width,
      height: titleH,
      label: 'FreshBox · one order, click to doorstep',
      textSize: 'lg',
      textBold: true,
      textAlignX: 'left',
    },
    {
      ...createText(left, top + titleH),
      width: probe.width,
      height: captionH,
      label:
        'One lane per team. Read left to right; a line that changes lanes is a hand-off, and every hand-off is where orders get stuck.',
      textSize: 'sm',
      textColor: MUTED,
      textAlignX: 'left',
    },
  ];

  // Each lane's gutter: what the role does, under its name, and the role's glyph at the foot.
  const gutterBits: Element[] = ROLES.flatMap((role, i) => {
    const lane = chart.elements.find((e) => e.id === lanes[i]!.id) as ShapeElement;
    return [
      {
        ...createText(lane.x + 26, lane.y + 50),
        width: gutter - 40,
        height: 24,
        label: role.blurb,
        textSize: 'sm' as const,
        textColor: MUTED,
        textAlignX: 'left' as const,
      },
      {
        ...createShape('icon', lane.x + 26, lane.y + lane.height - 40),
        width: 22,
        height: 22,
        iconId: role.icon,
        strokeColor: role.ink,
      },
    ];
  });

  const keyY = lanesTop + probe.height + keyGap;
  return [...els, ...chart.elements, ...gutterBits, ...swimlaneKey(left, keyY, keyH)];
}
