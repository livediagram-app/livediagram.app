// The C4 model's third level (docs/specs/008-canvas/canvas-and-palette.md "Templates", C4 Component Diagram): one
// container of Plateful's ordering platform, the Order service, opened up into the components it is built from.
// A C4 container boundary holds six components in three rows: the Order API that takes the call, Checkout that runs
// the order with Pricing and the Payment client beside it, and the Order repository and Event publisher under it, the
// repository in the corner column clear of the boundary's name, which the last row leaves room for. The
// container that calls in (the API gateway) stands above the boundary, the stores it writes to (the Orders database and
// the Order events topic) below, and the payments provider outside to the right. The order's path flows.
//
// Built from the Context and Container levels' parts (template-builders-c4.ts), so the three levels read as one set.
// Pure: takes a centre (cx, cy), returns a fresh Element[].

import type { Element } from '@livediagram/document';
import { TECH_HEADER_H, techHeader } from './template-builders-technical-kit';
import {
  C4_BOUNDARY_FOOT,
  c4Boundary,
  c4Card,
  c4Key,
  c4Layered,
  c4Link,
  c4Store,
} from './template-builders-c4';

export function buildC4Component(cx: number, cy: number): Element[] {
  const cardW = 280;
  const cardH = 124;
  const pitch = 400;
  const rowPitch = 236;
  const sideGap = 150;
  const pad = 56;
  const band = 56;
  const headGap = 36;
  const storeGap = 150;
  const keyGap = 48;
  const innerW = 2 * pitch + cardW;
  const boundW = innerW + 2 * pad;
  const boundH = band + 2 * rowPitch + cardH + C4_BOUNDARY_FOOT;
  const storeH = cardH + 16;
  const totalW = boundW + sideGap + cardW;
  const totalH = TECH_HEADER_H + headGap + cardH + 120 + boundH + storeGap + storeH + keyGap + 60;
  const left = cx - totalW / 2;
  const top = cy - totalH / 2;
  const callerY = top + TECH_HEADER_H + headGap;
  const boundX = left;
  const boundY = callerY + cardH + 120;
  const storeY = boundY + boundH + storeGap;
  const colX = (col: number) => boundX + pad + col * pitch;
  const rowY = (row: number) => boundY + band + row * rowPitch;

  const component = (
    col: number,
    row: number,
    name: string,
    tech: string,
    body: string,
    icon: string,
  ) => c4Card('component', colX(col), rowY(row), cardW, cardH, name, tech, body, icon);

  const gateway = c4Card(
    'container',
    colX(1),
    callerY,
    cardW,
    cardH,
    'API gateway',
    'Node.js',
    'Signs requests in, routes them.',
    'shield',
  );
  const api = component(
    1,
    0,
    'Order API',
    'gRPC handler',
    'Takes PlaceOrder and GetOrder calls.',
    'code',
  );
  const pricing = component(
    0,
    1,
    'Pricing',
    'Go package',
    'Totals items, fees and promo codes.',
    'percent',
  );
  const checkout = component(
    1,
    1,
    'Checkout',
    'Go package',
    'Runs an order from basket to paid.',
    'shopping-bag',
  );
  const paymentClient = component(
    2,
    1,
    'Payment client',
    'Go package',
    'Wraps the payments provider’s API.',
    'credit-card',
  );
  const repository = component(
    0,
    2,
    'Order repository',
    'Go package',
    'Reads and writes orders.',
    'database',
  );
  const publisher = component(
    1,
    2,
    'Event publisher',
    'Go package',
    'Publishes OrderPlaced events.',
    'send',
  );
  const payments = c4Card(
    'external',
    boundX + boundW + sideGap,
    rowY(1),
    cardW,
    cardH,
    'Payments provider',
    'External system',
    'Card payments.',
    'credit-card',
  );
  const db = c4Store(colX(0), storeY, cardW, storeH, 'Orders database', 'PostgreSQL');
  const events = c4Store(colX(1), storeY, cardW, storeH, 'Order events', 'Kafka topic');

  const flowing = { flow: 'dots' } as const;
  const links: Element[] = [
    c4Link(gateway, 's', api, 'n', 'PlaceOrder · gRPC', flowing),
    c4Link(api, 's', checkout, 'n', 'Places order', flowing),
    c4Link(checkout, 'w', pricing, 'e', 'Prices basket'),
    c4Link(checkout, 'e', paymentClient, 'w', 'Charges card'),
    // Labels below the boundary or right of it sit clear of its dashed edge.
    c4Link(paymentClient, 'e', payments, 'w', 'Charges · REST', {
      labelOffset: { t: 0.62, offset: 0 },
    }),
    // The order's path runs straight down the middle column; the repository takes a short diagonal across the gap.
    c4Link(checkout, 's', publisher, 'n', 'OrderPlaced', flowing),
    c4Link(checkout, 'sw', repository, 'ne', 'Saves order'),
    c4Link(repository, 's', db, 'n', 'Reads, writes · SQL', {
      labelOffset: { t: 0.68, offset: 0 },
    }),
    c4Link(publisher, 's', events, 'n', 'Publishes · Kafka', {
      ...flowing,
      labelOffset: { t: 0.68, offset: 0 },
    }),
  ];

  // The container boundary: the Order service's name in its bottom-left corner, under the repository and left of its
  // line down to the database. It links back up to the Container Diagram's Order service card when both are in one
  // document (c4-levels.ts).
  const boundary = c4Boundary(boundX, boundY, boundW, boundH, 'Order service', 'Container: Go');
  const scaffold: Element[] = [
    ...techHeader(
      left,
      top,
      totalW,
      'Plateful · order service components',
      'Level 3 of the C4 model: the Order service opened up, each component with what it does and what it is built with. The order’s path flows.',
    ),
    boundary,
    ...c4Key(left, storeY + storeH + keyGap, [
      ['container', 'Container'],
      ['component', 'Component'],
      ['external', 'External system'],
    ]),
  ];
  return c4Layered(scaffold, [
    gateway,
    api,
    pricing,
    checkout,
    paymentClient,
    repository,
    publisher,
    payments,
    db,
    events,
    ...links,
  ]);
}
