// The C4 model's first two levels (docs/specs/008-canvas/canvas-and-palette.md "Templates"), drawn for Plateful, the
// food-delivery app every technical starter describes (template-builders-technical-kit.ts):
//   - C4 System Context: the people who use the ordering platform along the top, the platform in the middle, the
//     systems it depends on along the bottom, every relationship a labelled arrow saying what flows and how.
//   - C4 Container Diagram: the same platform opened up, a system boundary holding its apps, services and stores, each
//     naming its technology, with the order's path drawn flowing.
// The third level, the Component Diagram, is template-builders-c4-component.ts, built from the parts exported here.
// C4's own palette (c4-look.ts): people a deep blue, the system in focus a mid blue, everything outside it grey. Every
// card keeps its fill and its ink under every theme (themeLockFill, themeLockText), so its text always reads. The key, the
// header and the boundary are the scaffold; the cards and arrows the content.
//
// Pure: takes a centre (cx, cy), returns a fresh Element[].

import {
  C4_LOOK,
  c4CardFields,
  c4DatabaseFields,
  createPinnedArrow,
  createShape,
  createText,
  type Anchor,
  type Element,
} from '@livediagram/document';
import { TEMPLATE_CONTENT_LAYER_ID, TEMPLATE_SCAFFOLD_LAYER_ID } from './template-layers';
import { TECH_HEADER_H, TECH_MUTED, techHeader } from './template-builders-technical-kit';

type Node = Extract<Element, { type: 'shape' }>;

// C4's palette, one copy for the templates, the palette's C4 tiles and a graph's c4 style (@livediagram/document).
export const C4 = C4_LOOK;
type C4Kind = Exclude<keyof typeof C4, 'database'>;

// One C4 element: a card with its glyph in a badge, its name as the title, its type as the meta line ("Person",
// "Go", a container's technology) and what it does as the body.
export function c4Card(
  kind: C4Kind,
  x: number,
  y: number,
  w: number,
  h: number,
  name: string,
  type: string,
  body: string,
  iconId: string = C4[kind].icon,
): Node {
  const { tags: _tags, ...base } = createShape('card', x, y);
  return { ...base, width: w, height: h, ...c4CardFields(kind, name, type, body, iconId) };
}

// A store drawn as a cylinder, as C4 draws a database or a queue: its name over its technology.
export function c4Store(
  x: number,
  y: number,
  w: number,
  h: number,
  name: string,
  tech: string,
): Node {
  return { ...createShape('cylinder', x, y), width: w, height: h, ...c4DatabaseFields(name, tech) };
}

// A C4 boundary: a system opened into its containers, or a container into its components. Its name sits bold in the
// bottom-left corner over its type in brackets, as the C4 model draws one, so the builder leaves C4_BOUNDARY_FOOT
// clear under its last row.
export const C4_BOUNDARY_FOOT = 80;
export function c4Boundary(
  x: number,
  y: number,
  w: number,
  h: number,
  name: string,
  type: string,
): Node {
  return {
    ...createShape('boundary', x, y),
    width: w,
    height: h,
    label: name,
    pageSubtitle: type,
    boundaryStyle: 'c4',
    strokeStyle: 'long-dash',
    strokeColor: C4.system.fill,
    textColor: C4.system.fill,
  };
}

// A relationship: a pinned arrow labelled with what flows, then how ("Places orders · HTTPS").
export function c4Link(
  from: Node,
  fromA: Anchor,
  to: Node,
  toA: Anchor,
  label: string,
  extra: Partial<Extract<Element, { type: 'arrow' }>> = {},
): Element {
  return {
    ...createPinnedArrow(from.id, fromA, to.id, toA),
    label,
    textSize: 'sm',
    ...extra,
  };
}

// The key: a swatch per kind of element with its name, as scaffold (a sample is no node left out).
export function c4Key(
  x: number,
  y: number,
  kinds: readonly [keyof typeof C4, string][],
): Element[] {
  const sw = 40;
  const pitch = 196;
  return [
    {
      ...createText(x, y),
      width: 120,
      height: 28,
      label: 'Key',
      textSize: 'sm',
      textBold: true,
      textColor: TECH_MUTED,
      textAlignX: 'left',
    },
    ...kinds.flatMap(([kind, name], i): Element[] => [
      {
        ...createShape('square', x + i * pitch, y + 34),
        width: sw,
        height: 24,
        fillColor: C4[kind].fill,
        strokeColor: C4[kind].edge,
        themeLockFill: true,
      },
      {
        ...createText(x + i * pitch + sw + 10, y + 32),
        width: pitch - sw - 20,
        height: 28,
        label: name,
        textSize: 'sm',
        textAlignX: 'left',
      },
    ]),
  ];
}

export const c4Layered = (scaffold: Element[], content: Element[]): Element[] => [
  ...scaffold.map((el) => ({ ...el, layerId: TEMPLATE_SCAFFOLD_LAYER_ID })),
  ...content.map((el) => ({ ...el, layerId: TEMPLATE_CONTENT_LAYER_ID })),
];

// A short relationship label's own wrap width: wide enough for "Gets routes, ETAs · REST" at 12px (141px measured)
// on one line, narrow enough to sit clear of the next arrow.
export const C4_ONE_LINE_LABEL = 160;

// Level 1: who uses the platform and what it depends on. Three people above the platform's top anchors and three
// systems below its bottom ones, so every arrow drops straight; the fourth person and the fourth system sit level
// with it on either side.
export function buildC4Context(cx: number, cy: number): Element[] {
  const cardW = 264;
  const cardH = 132;
  const sysW = 1220;
  const sysH = 156;
  // Room for a one-line label on the sideways arrows ("Prints tickets · webhook", 135px measured).
  const sideGap = 200;
  const rowGap = 150;
  const headGap = 36;
  const keyGap = 56;
  const totalW = cardW + sideGap + sysW + sideGap + cardW;
  const totalH = TECH_HEADER_H + headGap + cardH + rowGap + sysH + rowGap + cardH + keyGap + 60;
  const left = cx - totalW / 2;
  const top = cy - totalH / 2;
  const peopleY = top + TECH_HEADER_H + headGap;
  const sysX = left + cardW + sideGap;
  const sysY = peopleY + cardH + rowGap;
  const extY = sysY + sysH + rowGap;
  // The platform's top and bottom anchors sit at a quarter, a half and three quarters of its width.
  const at = (share: number) => sysX + sysW * share - cardW / 2;

  const platform = c4Card(
    'system',
    sysX,
    sysY,
    sysW,
    sysH,
    'Plateful Ordering Platform',
    'Software system',
    'Lets customers order from local restaurants, sends each order to the kitchen and a courier, and tracks it to the door.',
    'shopping-bag',
  );
  const customer = c4Card(
    'person',
    at(0.25),
    peopleY,
    cardW,
    cardH,
    'Customer',
    'Person',
    'Orders food on the app or the web.',
  );
  const courier = c4Card(
    'person',
    at(0.5),
    peopleY,
    cardW,
    cardH,
    'Courier',
    'Person',
    'Picks orders up and delivers them.',
  );
  const staff = c4Card(
    'person',
    at(0.75),
    peopleY,
    cardW,
    cardH,
    'Restaurant staff',
    'Person',
    'Accepts orders and marks them ready.',
  );
  const support = c4Card(
    'person',
    left,
    sysY + (sysH - cardH) / 2,
    cardW,
    cardH,
    'Support agent',
    'Person',
    'Sorts out refunds and late orders.',
  );
  const payments = c4Card(
    'external',
    at(0.25),
    extY,
    cardW,
    cardH,
    'Payments provider',
    'External system',
    'Takes card payments and refunds.',
    'credit-card',
  );
  const maps = c4Card(
    'external',
    at(0.5),
    extY,
    cardW,
    cardH,
    'Routing API',
    'External system',
    'Gives routes and arrival times.',
    'map',
  );
  const messages = c4Card(
    'external',
    at(0.75),
    extY,
    cardW,
    cardH,
    'Email and SMS',
    'External system',
    'Sends receipts and updates.',
    'mail',
  );
  const pos = c4Card(
    'external',
    sysX + sysW + sideGap,
    sysY + (sysH - cardH) / 2,
    cardW,
    cardH,
    'Restaurant POS',
    'External system',
    'The till each kitchen already runs.',
    'receipt',
  );

  // A short label stays on one line: an up-and-down arrow's label wraps at 120px by default, which left "REST" or
  // "HTTPS" alone on a second line.
  const oneLine = { labelMaxWidth: C4_ONE_LINE_LABEL };
  const links: Element[] = [
    c4Link(customer, 's', platform, 'nnw', 'Places orders, tracks them · HTTPS'),
    c4Link(courier, 's', platform, 'n', 'Takes jobs, shares location · HTTPS'),
    c4Link(staff, 's', platform, 'nne', 'Accepts orders · HTTPS', oneLine),
    c4Link(support, 'e', platform, 'w', 'Refunds orders · HTTPS'),
    c4Link(platform, 'ssw', payments, 'n', 'Charges cards · REST', oneLine),
    c4Link(platform, 's', maps, 'n', 'Gets routes, ETAs · REST', oneLine),
    c4Link(platform, 'sse', messages, 'n', 'Sends updates · REST', oneLine),
    c4Link(platform, 'e', pos, 'w', 'Prints tickets · webhook'),
  ];

  const scaffold: Element[] = [
    ...techHeader(
      left,
      top,
      totalW,
      'Plateful · system context',
      'Level 1 of the C4 model. People at the top, the system in the middle, what it depends on below. Every arrow says what flows and how.',
    ),
    ...c4Key(left, extY + cardH + keyGap, [
      ['person', 'Person'],
      ['system', 'Software system'],
      ['external', 'External system'],
    ]),
  ];
  return c4Layered(scaffold, [
    platform,
    customer,
    courier,
    staff,
    support,
    payments,
    maps,
    messages,
    pos,
    ...links,
  ]);
}

// Level 2: the platform opened up. A system boundary holds the apps, the gateway, the services and the stores in
// three columns; the Customer and the Courier stand above it, the two external systems either side of the services.
// The order's path (mobile app, gateway, order service, events, dispatch) flows.
export function buildC4Container(cx: number, cy: number): Element[] {
  const cardW = 280;
  const cardH = 124;
  const pitch = 380;
  const rowPitch = 236;
  const sideGap = 150;
  const pad = 56;
  const band = 64;
  const headGap = 36;
  const keyGap = 48;
  const innerW = 2 * pitch + cardW;
  const boundW = innerW + 2 * pad;
  const totalW = cardW + sideGap + boundW + sideGap + cardW;
  const boundH = band + 4 * rowPitch - (rowPitch - cardH) + C4_BOUNDARY_FOOT;
  const totalH = TECH_HEADER_H + headGap + cardH + 120 + boundH + keyGap + 60;
  const left = cx - totalW / 2;
  const top = cy - totalH / 2;
  const peopleY = top + TECH_HEADER_H + headGap;
  const boundX = left + cardW + sideGap;
  const boundY = peopleY + cardH + 120;
  const colX = (col: number) => boundX + pad + col * pitch;
  const rowY = (row: number) => boundY + band + row * rowPitch;

  const container = (
    col: number,
    row: number,
    name: string,
    tech: string,
    body: string,
    icon: string,
  ): Node => c4Card('container', colX(col), rowY(row), cardW, cardH, name, tech, body, icon);
  // A store is drawn as a cylinder, as C4 draws a database or a queue.
  const store = (col: number, row: number, name: string, tech: string): Node =>
    c4Store(colX(col), rowY(row) - 8, cardW, cardH + 16, name, tech);

  const customer = c4Card(
    'person',
    colX(0.5),
    peopleY,
    cardW,
    cardH,
    'Customer',
    'Person',
    'Orders food and tracks it.',
  );
  const courier = c4Card(
    'person',
    colX(2),
    peopleY,
    cardW,
    cardH,
    'Courier',
    'Person',
    'Delivers orders.',
  );
  const web = container(0, 0, 'Web app', 'Next.js', 'Menus and checkout.', 'monitor');
  const mobile = container(
    1,
    0,
    'Mobile app',
    'React Native',
    'Orders and live tracking.',
    'smartphone',
  );
  const courierApp = container(
    2,
    0,
    'Courier app',
    'React Native',
    'Jobs and directions.',
    'map-pin',
  );
  const gateway = container(
    1,
    1,
    'API gateway',
    'Node.js',
    'Signs requests in, routes them.',
    'shield',
  );
  const orders = container(
    0,
    2,
    'Order service',
    'Go',
    'Prices, charges, records orders.',
    'shopping-bag',
  );
  const dispatch = container(
    2,
    2,
    'Dispatch service',
    'Go',
    'Matches orders to couriers.',
    'truck',
  );
  const db = store(0, 3, 'Orders database', 'PostgreSQL');
  const events = store(1, 3, 'Order events', 'Kafka topic');
  const payments = c4Card(
    'external',
    left,
    rowY(2),
    cardW,
    cardH,
    'Payments provider',
    'External system',
    'Card payments.',
    'credit-card',
  );
  const maps = c4Card(
    'external',
    boundX + boundW + sideGap,
    rowY(2),
    cardW,
    cardH,
    'Routing API',
    'External system',
    'Routes and ETAs.',
    'map',
  );

  const flowing = { flow: 'dots' } as const;
  const angled = { arrowStyle: 'angled' } as const;
  const links: Element[] = [
    // Labels sit above the boundary, clear of its name.
    c4Link(customer, 'ssw', web, 'n', 'Uses · HTTPS', {
      ...angled,
      labelOffset: { t: 0.3, offset: 0 },
    }),
    c4Link(customer, 'sse', mobile, 'n', 'Uses', { ...angled, labelOffset: { t: 0.3, offset: 0 } }),
    c4Link(courier, 's', courierApp, 'n', 'Uses', { labelOffset: { t: 0.3, offset: 0 } }),
    c4Link(web, 's', gateway, 'w', 'JSON · HTTPS', angled),
    c4Link(mobile, 's', gateway, 'n', 'JSON · HTTPS', flowing),
    c4Link(courierApp, 's', gateway, 'e', 'JSON · HTTPS', angled),
    c4Link(gateway, 'sw', orders, 'n', 'Place order · gRPC', { ...angled, ...flowing }),
    c4Link(gateway, 'se', dispatch, 'n', 'Job updates · gRPC', angled),
    c4Link(orders, 's', db, 'n', 'Reads, writes · SQL'),
    c4Link(orders, 'e', events, 'n', 'OrderPlaced', { ...angled, ...flowing }),
    c4Link(events, 'e', dispatch, 's', 'Consumes', { ...angled, ...flowing }),
    c4Link(orders, 'w', payments, 'e', 'Charges · REST'),
    c4Link(dispatch, 'e', maps, 'w', 'Routes · REST'),
  ];

  // The C4 boundary: the platform's name in its bottom-left corner, under the stores. The Order service card links to
  // the C4 Component Diagram's boundary of the same name when both are in one document (c4-levels.ts).
  const boundary = c4Boundary(
    boundX,
    boundY,
    boundW,
    boundH,
    'Plateful Ordering Platform',
    'Software system',
  );
  const scaffold: Element[] = [
    ...techHeader(
      left,
      top,
      totalW,
      'Plateful · containers',
      'Level 2 of the C4 model: the apps, services and stores inside the platform, each with its technology. The order’s path flows.',
    ),
    boundary,
    ...c4Key(left, boundY + boundH + keyGap, [
      ['person', 'Person'],
      ['container', 'Container'],
      ['external', 'External system'],
    ]),
  ];
  return c4Layered(scaffold, [
    customer,
    courier,
    web,
    mobile,
    courierApp,
    gateway,
    orders,
    dispatch,
    db,
    events,
    payments,
    maps,
    ...links,
  ]);
}
