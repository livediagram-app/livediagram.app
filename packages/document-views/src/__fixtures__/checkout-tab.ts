// The research's 30-element "Checkout platform" tab (docs/research/agent-cli/compact-representations.md
// §3.1, appendix), built from the document factories with every id, time and position pinned.
import {
  createComment,
  createPinnedArrow,
  createShape,
  createSticky,
  createTable,
  createText,
  type Anchor,
  type ArrowElement,
  type Comment,
  type Element,
  type ShapeElement,
  type ShapeKind,
  type Tab,
} from '@livediagram/document';

export const CHECKOUT_TAB_ID = '0b3481f3-59fb-4bd0-a21a-152f1ba9bba5';
export const CHECKOUT_REV = 41;
// 2026-09-27 09:00 UTC.
export const FIXED_EPOCH = Date.UTC(2026, 8, 27, 9, 0, 0);

// A fixed UUID whose first four characters are the research's prefix.
export function pinnedId(prefix: string, n: number): string {
  const tail = n.toString(16).padStart(12, '0');
  return `${prefix}0000-0000-4000-8000-${tail}`;
}

const ID = {
  title: pinnedId('98eb', 1),
  edge: pinnedId('048c', 2),
  services: pinnedId('c991', 3),
  data: pinnedId('ca76', 4),
  customer: pinnedId('b811', 5),
  web: pinnedId('a3cf', 6),
  gateway: pinnedId('649c', 7),
  auth: pinnedId('202b', 8),
  orders: pinnedId('146b', 9),
  payments: pinnedId('e4a8', 10),
  bus: pinnedId('6406', 11),
  inventory: pinnedId('12de', 12),
  notify: pinnedId('0556', 13),
  ordersDb: pinnedId('d41e', 14),
  inventoryDb: pinnedId('822f', 15),
  stripe: pinnedId('e6d7', 16),
  order: pinnedId('cb02', 17),
  slos: pinnedId('480a', 18),
  sticky: pinnedId('0c84', 19),
} as const;
export const CHECKOUT_IDS = ID;

function shape(
  kind: ShapeKind,
  id: string,
  label: string,
  box: [number, number, number, number],
  extra: Partial<ShapeElement> = {},
): ShapeElement {
  const [x, y, width, height] = box;
  return { ...createShape(kind, x, y), id, label, x, y, width, height, ...extra };
}

function comment(n: number, text: string, author: string): Comment {
  return {
    ...createComment(text, { id: `user_${author.toLowerCase()}`, name: author, color: '#2563eb' }),
    id: pinnedId('c0c0', n),
    createdAt: FIXED_EPOCH + n * 60_000,
  };
}

function arrow(
  prefix: string,
  n: number,
  from: string,
  to: string,
  extra: Partial<ArrowElement> = {},
  anchors: [Anchor, Anchor] = ['e', 'w'],
): ArrowElement {
  return {
    ...createPinnedArrow(from, anchors[0], to, anchors[1]),
    id: pinnedId(prefix, n),
    ...extra,
  };
}

export function checkoutElements(): Element[] {
  return [
    {
      ...createText(40, 20),
      id: ID.title,
      label: 'Checkout platform: production',
      width: 520,
      height: 48,
    },
    shape('frame', ID.edge, 'Edge', [40, 100, 300, 440]),
    shape('frame', ID.services, 'Services', [400, 100, 580, 440]),
    shape('frame', ID.data, 'Data', [1040, 100, 280, 440]),
    shape('actor', ID.customer, 'Customer', [150, 140, 80, 110]),
    shape('square', ID.web, 'Web app', [90, 290, 200, 72], { iconId: 'nextjs' }),
    shape('hexagon', ID.gateway, 'API gateway', [90, 420, 200, 72], {
      note: 'Kong. Terminates TLS, rate-limits per API key, forwards to the services.',
    }),
    shape('square', ID.auth, 'Auth service', [440, 150, 200, 72], { iconId: 'shield' }),
    shape('square', ID.orders, 'Orders service', [720, 150, 200, 72], {
      iconId: 'server',
      note: 'Owns the order lifecycle and is the source of truth for order state. Calls Payments synchronously; publishes OrderPlaced.',
    }),
    shape('square', ID.payments, 'Payments service', [720, 280, 200, 72], {
      iconId: 'credit-card',
      commentThread: {
        comments: [comment(1, 'Stripe webhooks retried by the gateway now.', 'Priya')],
        resolved: true,
      },
    }),
    shape('stadium', ID.bus, 'Event bus', [440, 280, 200, 72], {
      note: 'Kafka, 3 brokers, 7-day retention.',
    }),
    shape('square', ID.inventory, 'Inventory service', [440, 410, 200, 72], { iconId: 'package' }),
    shape('square', ID.notify, 'Notification worker', [720, 410, 200, 72], { iconId: 'mail' }),
    shape('cylinder', ID.ordersDb, 'Orders DB', [1080, 150, 200, 90], {
      note: 'Postgres 16, primary + 1 replica.',
    }),
    shape('cylinder', ID.inventoryDb, 'Inventory DB', [1080, 300, 200, 90]),
    shape('cloud', ID.stripe, 'Stripe', [1360, 150, 160, 90], {
      link: { kind: 'url', url: 'https://stripe.com/docs/api' },
    }),
    shape('entity', ID.order, 'Order', [40, 580, 220, 140], {
      entityFields: [
        { name: 'id', type: 'uuid PK' },
        { name: 'customer_id', type: 'uuid FK' },
        { name: 'status', type: 'text' },
        { name: 'total_cents', type: 'int' },
      ],
    }),
    {
      ...createTable(40, 760),
      id: ID.slos,
      width: 420,
      height: 160,
      cells: [
        ['Service', 'p99 latency', 'Availability'],
        ['Orders', '120 ms', '99.95%'],
        ['Payments', '340 ms', '99.9%'],
        ['Inventory', '80 ms', '99.99%'],
      ],
    },
    {
      ...createSticky(520, 760),
      id: ID.sticky,
      label: 'Payment retries are not idempotent yet!',
      width: 200,
      height: 200,
      commentThread: {
        comments: [
          comment(2, 'Retry storm last Friday double-charged 14 orders.', 'Sam'),
          comment(3, '@Priya can we add an idempotency key per order?', 'Webber'),
        ],
        resolved: false,
      },
    },
    arrow('c74b', 20, ID.customer, ID.web, {}, ['s', 'n']),
    arrow('6e71', 21, ID.web, ID.gateway, {}, ['s', 'n']),
    arrow('9c5e', 22, ID.gateway, ID.auth, { label: 'JWT' }),
    arrow('111e', 23, ID.gateway, ID.orders),
    arrow('c41d', 24, ID.orders, ID.payments, { label: 'charge', arrowStyle: 'angled' }, [
      's',
      'n',
    ]),
    arrow('8e70', 25, ID.payments, ID.stripe, { label: 'HTTPS', strokeStyle: 'dashed' }),
    arrow('892e', 26, ID.orders, ID.ordersDb),
    arrow('3462', 27, ID.orders, ID.bus, { label: 'OrderPlaced' }, ['w', 'n']),
    arrow('1434', 28, ID.bus, ID.inventory, {}, ['s', 'n']),
    arrow('0cee', 29, ID.bus, ID.notify, {}, ['e', 'w']),
    arrow('1fc0', 30, ID.inventory, ID.inventoryDb),
  ];
}

export function checkoutTab(): Tab {
  return { id: CHECKOUT_TAB_ID, name: 'Checkout platform', elements: checkoutElements() };
}
