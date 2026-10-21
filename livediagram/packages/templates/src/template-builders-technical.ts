// The system architecture template (docs/specs/008-canvas/canvas-and-palette.md "Templates"): the
// vendor-neutral logical sibling of the cloud architecture. The other
// technical starters (database schema, sequence diagram, cloud
// architecture) live in their own template-builders-*.ts files.
//
// The builder is pure: it takes a centre (cx, cy) and returns a fresh
// Element[]. Sizing constants live inline so the template is
// self-describing.

import {
  diagramKeyHeight,
  keyRowsOf,
  createPinnedArrow,
  createShape,
  createText,
  type Anchor,
  type Element,
} from '@livediagram/document';
import { TEMPLATE_CONTENT_LAYER_ID, TEMPLATE_SCAFFOLD_LAYER_ID } from './template-layers';
import { rake } from './template-rake';

const MUTED = '#64748b';
const INK = '#334155';

// One hue per tier, so where a part runs reads before its name does. The
// band is the lane body, the header its gutter, the stroke the outline of
// every node in the tier and the ink its title.
type Tier = {
  name: string;
  blurb: string;
  icon: string;
  band: string;
  header: string;
  line: string;
  node: string;
  ink: string;
};
const TIERS: Tier[] = [
  {
    name: 'Clients',
    blurb: 'Where people are',
    icon: 'users',
    band: '#faf5ff',
    header: '#f3e8ff',
    line: '#d8b4fe',
    node: '#a855f7',
    ink: '#6b21a8',
  },
  {
    name: 'Edge',
    blurb: 'The front door',
    icon: 'shield',
    band: '#f0f9ff',
    header: '#e0f2fe',
    line: '#bae6fd',
    node: '#0ea5e9',
    ink: '#075985',
  },
  {
    name: 'Services',
    blurb: 'Where the work happens',
    icon: 'cpu',
    band: '#ecfdf5',
    header: '#d1fae5',
    line: '#a7f3d0',
    node: '#10b981',
    ink: '#065f46',
  },
  {
    name: 'Data',
    blurb: 'What we keep',
    icon: 'database',
    band: '#fffbeb',
    header: '#fef3c7',
    line: '#fde68a',
    node: '#f59e0b',
    ink: '#92400e',
  },
];

// Plateful's ordering platform, drawn LOGICALLY: the vendor-neutral sibling
// of buildCloudArchitecture (template-builders-cloud.ts), which names the real
// AWS services. Four tier lanes (docs/specs/009-elements/lane.md), top to
// bottom, say where each part runs, each in its own hue with the tier named
// in its gutter over one line of what lives there. Every node is a labelled
// box with a line-art icon INSIDE it; the icons say what the role is (a key
// for sign-in, a cart for orders), never which vendor.
//
// The lanes stand apart with a wide gap, and every vertical hop crosses that
// gap, so each edge's protocol label sits in open canvas between two tiers
// rather than on a lane border. Two grammars of line, keyed under the lanes:
// a SOLID line is a request that waits for its reply, a DASHED line an event
// nobody waits for. The synchronous path falls straight down the middle
// (app to gateway to orders to its database); the asynchronous path runs
// along the services lane (orders publish, dispatch consumes) and climbs the
// right-hand column back up to the courier's phone as a push notification.
export function buildSystemArchitecture(cx: number, cy: number): Element[] {
  const gutter = 176;
  const colPitch = 300;
  const nodeW = 216;
  const nodeH = 72;
  const laneH = 140;
  const laneGap = 48;
  const titleH = 44;
  const captionH = 28;
  const headGap = 28;
  const keyGap = 32;
  // The key's two rows, solid and dashed (diagramKeyHeight).
  const keyH = diagramKeyHeight(2);
  const laneW = gutter + 4 * colPitch + 24;
  const lanesH = TIERS.length * laneH + (TIERS.length - 1) * laneGap;
  const totalH = titleH + captionH + headGap + lanesH + keyGap + keyH;
  const left = cx - laneW / 2;
  const top = cy - totalH / 2;
  const lanesTop = top + titleH + captionH + headGap;
  const laneTop = (tier: number) => lanesTop + tier * (laneH + laneGap);
  const laneMid = (tier: number) => laneTop(tier) + laneH / 2;
  // Column centres sit in the lane body, clear of the gutter.
  const colX = (col: number) => left + gutter + 12 + colPitch / 2 + col * colPitch;

  const scaffold: Element[] = [
    {
      ...createText(left, top),
      width: laneW,
      height: titleH,
      label: 'Plateful · ordering platform',
      textSize: 'lg',
      textBold: true,
      textAlignX: 'left',
    },
    {
      ...createText(left, top + titleH),
      width: laneW,
      height: captionH,
      label:
        'Requests fall through four tiers, top to bottom. Solid lines wait for a reply; dashed lines are events nobody waits for.',
      textSize: 'sm',
      textColor: MUTED,
      textAlignX: 'left',
    },
  ];

  TIERS.forEach((tier, i) => {
    const y = laneTop(i);
    scaffold.push(
      {
        ...createShape('lane', left, y),
        width: laneW,
        height: laneH,
        label: tier.name,
        textSize: 'md',
        textBold: true,
        textColor: tier.ink,
        textAlignX: 'left',
        textAlignY: 'top',
        fillColor: tier.band,
        strokeColor: tier.line,
        headerFill: tier.header,
        headerSize: gutter,
      },
      {
        ...createText(left + 26, y + 52),
        width: gutter - 36,
        height: 40,
        label: tier.blurb,
        textSize: 'sm',
        textColor: MUTED,
        textAlignX: 'left',
        textAlignY: 'top',
      },
      {
        ...createShape('icon', left + 26, y + laneH - 46),
        width: 26,
        height: 26,
        iconId: tier.icon,
        strokeColor: tier.ink,
      },
    );
  });

  type Node = Extract<Element, { type: 'shape' }>;
  const node = (
    label: string,
    iconId: string,
    col: number,
    tier: number,
    extra: Partial<Node> = {},
  ): Node => {
    // Each node is a Card (docs/specs/009-elements/card.md): its glyph in a tile, its name as the title, and an
    // accent edge in its tier's hue, so where a part runs reads before its name does.
    const {
      pageSubtitle: _meta,
      tags: _tags,
      ...base
    } = createShape('card', colX(col) - nodeW / 2, laneMid(tier) - nodeH / 2);
    return {
      ...base,
      width: nodeW,
      height: nodeH,
      cardMedia: 'tile',
      iconId,
      pageTitle: label,
      label: '',
      fillColor: '#ffffff',
      strokeColor: TIERS[tier]!.node,
      textColor: INK,
      accentEdge: 'left',
      ...extra,
    };
  };
  const store = (label: string, col: number): Node => ({
    ...createShape('cylinder', colX(col) - nodeW / 2, laneMid(3) - nodeH / 2 - 6),
    width: nodeW,
    height: nodeH + 12,
    label,
    textSize: 'sm',
    fillColor: '#ffffff',
    strokeColor: TIERS[3]!.node,
    textColor: INK,
  });

  const customerApp = node('Customer app', 'smartphone', 0, 0);
  const webShop = node('Web shop', 'monitor', 1, 0);
  const kitchen = node('Kitchen tablet', 'clipboard', 2, 0);
  const courierApp = node('Courier app', 'map-pin', 3, 0);
  const cdn = node('CDN', 'globe', 0, 1);
  // Every request enters here, so it is the one filled node.
  const gateway = node('API gateway', 'shield', 1, 1, {
    // A badge disc keeps its glyph white on the filled card.
    cardMedia: 'badge',
    fillColor: '#0284c7',
    strokeColor: '#075985',
    textColor: '#ffffff',
    strokeWidth: 'thick',
    textBold: true,
  });
  const push = node('Push service', 'bell', 3, 1);
  const auth = node('Sign-in service', 'key', 0, 2);
  const orders = node('Orders service', 'cart', 1, 2);
  // A queue, not a service: tinted so it reads as the pipe between them.
  const events = node('Order events', 'layers', 2, 2, { fillColor: '#d1fae5' });
  const dispatch = node('Dispatch worker', 'send', 3, 2);
  const usersDb = store('Users DB', 0);
  const ordersDb = store('Orders DB', 1);
  const analytics = store('Analytics', 2);
  const locations = store('Courier locations', 3);

  const edge = (
    from: Node,
    fromA: Anchor,
    to: Node,
    toA: Anchor,
    label: string,
    style: { async?: boolean; angled?: boolean; inLane?: number } = {},
  ): Element => ({
    ...createPinnedArrow(from.id, fromA, to.id, toA),
    label,
    ...(style.async ? { strokeStyle: 'dashed' as const } : {}),
    ...(style.angled ? { arrowStyle: 'angled' as const } : {}),
    // A label inside a lane sits on a plate of the lane's own tint, in the
    // tier's ink, so it reads the same in every theme.
    ...(style.inLane !== undefined
      ? { textColor: TIERS[style.inLane]!.ink, labelFill: TIERS[style.inLane]!.band }
      : {}),
  });
  // The gateway fans out to sign-in and orders through the gap under the
  // edge lane: down, across, down, so the line never runs along a border.
  const gatewayExit = { x: gateway.x + nodeW / 4, y: gateway.y + nodeH };
  const toAuth: Element = {
    ...edge(gateway, 'ssw', auth, 'n', 'verify', { angled: true }),
    curvePoints: rake(gatewayExit, { x: auth.x + nodeW / 2, y: auth.y }),
  } as Element;
  const arrows: Element[] = [
    edge(customerApp, 's', cdn, 'n', 'HTTPS'),
    edge(cdn, 'e', gateway, 'w', '/api', { inLane: 1 }),
    edge(webShop, 's', gateway, 'n', 'HTTPS'),
    // The kitchen holds a socket open for new orders: down into the empty
    // edge cell beside the gateway, then in through its east face.
    edge(kitchen, 's', gateway, 'e', 'WebSocket', { angled: true, inLane: 1 }),
    toAuth,
    edge(gateway, 's', orders, 'n', 'gRPC'),
    edge(orders, 'e', events, 'w', 'publish', { async: true, inLane: 2 }),
    edge(events, 'e', dispatch, 'w', 'consume', { async: true, inLane: 2 }),
    edge(dispatch, 'n', push, 's', 'job offer', { async: true }),
    edge(push, 'n', courierApp, 's', 'notify', { async: true }),
    edge(auth, 's', usersDb, 'n', 'SQL'),
    edge(orders, 's', ordersDb, 'n', 'SQL'),
    edge(events, 's', analytics, 'n', 'stream', { async: true }),
    edge(dispatch, 's', locations, 'n', 'nearest'),
  ];

  // The key (docs/specs/009-elements/diagram-key.md): one row per line pattern the arrows use, each with its
  // meaning, under the lanes. Its rows are derived here as the editor would on load, so a thumbnail shows them.
  const keyY = lanesTop + lanesH + keyGap;
  const keyRows = keyRowsOf(arrows);
  scaffold.push({
    ...createShape('diagram-key', left, keyY),
    width: 360,
    height: diagramKeyHeight(keyRows.length),
    keyRows,
    keyMeanings: {
      'line:solid': 'Request: waits for the reply',
      'line:dashed': 'Event: fire and forget',
    },
  });

  const content: Element[] = [
    customerApp,
    webShop,
    kitchen,
    courierApp,
    cdn,
    gateway,
    push,
    auth,
    orders,
    events,
    dispatch,
    usersDb,
    ordersDb,
    analytics,
    locations,
    ...arrows,
  ];
  return [
    ...scaffold.map((el) => ({ ...el, layerId: TEMPLATE_SCAFFOLD_LAYER_ID })),
    ...content.map((el) => ({ ...el, layerId: TEMPLATE_CONTENT_LAYER_ID })),
  ];
}
