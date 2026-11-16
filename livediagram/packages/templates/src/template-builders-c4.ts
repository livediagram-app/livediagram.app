// The C4 model's first two levels (docs/specs/008-canvas/canvas-and-palette.md "Templates"), drawn for Plateful, the
// food-delivery app every technical starter describes (template-builders-technical-kit.ts):
//   - C4 System Context: the people who use the ordering platform along the top, the platform in the middle, the
//     systems it depends on along the bottom, every relationship a labelled arrow saying what flows and how.
//   - C4 Container Diagram: the same platform opened up, a system boundary holding its apps, services and stores, each
//     naming its technology, with the order's path drawn flowing.
// C4's own palette: people a deep blue, the system in focus a mid blue, everything outside it grey. Every card keeps
// its fill under a dark theme (themeLockFill), so its white text always has its blue or grey behind it. The key, the
// header and the boundary are the scaffold; the cards and arrows the content.
//
// Pure: takes a centre (cx, cy), returns a fresh Element[].

import {
  createPinnedArrow,
  createShape,
  createText,
  type Anchor,
  type Element,
} from '@livediagram/document';
import { TEMPLATE_CONTENT_LAYER_ID, TEMPLATE_SCAFFOLD_LAYER_ID } from './template-layers';
import { TECH_HEADER_H, TECH_MUTED, techHeader } from './template-builders-technical-kit';

type Node = Extract<Element, { type: 'shape' }>;

// C4's palette: fill, edge and the ink on it.
export const C4 = {
  person: { fill: '#08427b', edge: '#052e56', ink: '#ffffff', icon: 'user' },
  system: { fill: '#1168bd', edge: '#0b4884', ink: '#ffffff', icon: 'box' },
  container: { fill: '#438dd5', edge: '#2e6295', ink: '#ffffff', icon: 'box' },
  external: { fill: '#8a8a8a', edge: '#6b6b6b', ink: '#ffffff', icon: 'globe' },
} as const;
type C4Kind = keyof typeof C4;

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
  const hue = C4[kind];
  return {
    ...base,
    width: w,
    height: h,
    cardMedia: 'badge',
    iconId,
    pageTitle: name,
    pageSubtitle: type,
    label: body,
    textSize: 'sm',
    textAlignX: 'left',
    fillColor: hue.fill,
    strokeColor: hue.edge,
    textColor: hue.ink,
    themeLockFill: true,
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
function c4Key(x: number, y: number, kinds: readonly [C4Kind, string][]): Element[] {
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

const layered = (scaffold: Element[], content: Element[]): Element[] => [
  ...scaffold.map((el) => ({ ...el, layerId: TEMPLATE_SCAFFOLD_LAYER_ID })),
  ...content.map((el) => ({ ...el, layerId: TEMPLATE_CONTENT_LAYER_ID })),
];

// Level 1: who uses the platform and what it depends on. Three people above the platform's top anchors and three
// systems below its bottom ones, so every arrow drops straight; the fourth person and the fourth system sit level
// with it on either side.
export function buildC4Context(cx: number, cy: number): Element[] {
  const cardW = 264;
  const cardH = 132;
  const sysW = 1220;
  const sysH = 156;
  const sideGap = 150;
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

  const links: Element[] = [
    c4Link(customer, 's', platform, 'nnw', 'Places orders, tracks them · HTTPS'),
    c4Link(courier, 's', platform, 'n', 'Takes jobs, shares location · HTTPS'),
    c4Link(staff, 's', platform, 'nne', 'Accepts orders · HTTPS'),
    c4Link(support, 'e', platform, 'w', 'Refunds orders · HTTPS'),
    c4Link(platform, 'ssw', payments, 'n', 'Charges cards · REST'),
    c4Link(platform, 's', maps, 'n', 'Gets routes, ETAs · REST'),
    c4Link(platform, 'sse', messages, 'n', 'Sends updates · REST'),
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
  return layered(scaffold, [
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
  const boundH = band + 4 * rowPitch - (rowPitch - cardH) + pad;
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
  const store = (col: number, row: number, label: string): Node => ({
    ...createShape('cylinder', colX(col), rowY(row) - 8),
    width: cardW,
    height: cardH + 16,
    label,
    textSize: 'sm',
    fillColor: C4.container.fill,
    strokeColor: C4.container.edge,
    textColor: C4.container.ink,
    themeLockFill: true,
  });

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
  const db = store(0, 3, 'Orders database\nPostgreSQL');
  const events = store(1, 3, 'Order events\nKafka topic');
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
    c4Link(customer, 'ssw', web, 'n', 'Uses · HTTPS', angled),
    c4Link(customer, 'sse', mobile, 'n', 'Uses', angled),
    c4Link(courier, 's', courierApp, 'n', 'Uses'),
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

  const boundary: Node = {
    ...createShape('boundary', boundX, boundY),
    width: boundW,
    height: boundH,
    label: 'Plateful Ordering Platform',
    pageSubtitle: 'Software system',
    iconId: 'shopping-bag',
    boundaryStyle: 'inset',
    strokeColor: C4.system.fill,
    textColor: C4.system.fill,
  };
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
  return layered(scaffold, [
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
