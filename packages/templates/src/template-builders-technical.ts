// The system architecture template (docs/specs/008-canvas/canvas-and-palette.md "Templates"): the
// vendor-neutral logical sibling of the cloud architecture. The other
// technical starters (database schema, sequence diagram, cloud
// architecture) live in their own template-builders-*.ts files.
//
// The builder is pure: it takes a centre (cx, cy) and returns a fresh
// Element[]. Sizing constants live inline so the template is
// self-describing.

import { createPinnedArrow, createShape, type Anchor, type Element } from '@livediagram/document';
import { TEMPLATE_CONTENT_LAYER_ID, TEMPLATE_SCAFFOLD_LAYER_ID } from './template-layers';

// The LOGICAL architecture of a small shop: the vendor-neutral sibling of
// buildCloudArchitecture (template-builders-cloud.ts), which names real AWS services. Four tiered
// lanes (docs/specs/009-elements/lane.md), top to bottom, say where each
// part runs: Clients, Edge, Services, Data. Every node is a labelled box
// with a line-art icon INSIDE it, so the name sits on the node instead of
// hanging under a tile, and the icons only say what the role is (a key for
// auth, a cart for orders), never which vendor.
//
// The wiring is laid out so nothing crosses: requests fall straight down
// the columns, the web app joins the gateway from the east and fetches its
// assets from the CDN off its own east face, the gateway reaches the auth
// service with a single elbow off its west face, and the asynchronous path
// runs sideways along the services lane (orders publish to a queue a
// worker consumes, and the same events stream down into analytics). Each edge names its protocol, which is
// the detail an architecture review asks about first.
export function buildSystemArchitecture(cx: number, cy: number): Element[] {
  const tiers = ['Clients', 'Edge', 'Services', 'Data'];
  const gutter = 132; // LANE_GUTTER_PX: the lane's title strip
  const colPitch = 300;
  const nodeW = 216;
  const nodeH = 72;
  const laneH = 148;
  const laneGap = 14;
  const laneW = gutter + 4 * colPitch + 40;
  const left = cx - laneW / 2;
  const top = cy - (tiers.length * laneH + (tiers.length - 1) * laneGap) / 2;
  // Column centres sit in the lane body, clear of the gutter.
  const colX = (col: number) => left + gutter + 20 + colPitch / 2 + col * colPitch;
  const laneMid = (tier: number) => top + tier * (laneH + laneGap) + laneH / 2;

  const lanes: Element[] = tiers.map((label, i) => ({
    ...createShape('lane', left, top + i * (laneH + laneGap)),
    width: laneW,
    height: laneH,
    label,
    textSize: 'md',
    layerId: TEMPLATE_SCAFFOLD_LAYER_ID,
  }));

  type Node = Extract<Element, { type: 'shape' }>;
  const node = (
    label: string,
    iconId: string,
    col: number,
    tier: number,
    extra: Partial<Node> = {},
  ): Node => ({
    ...createShape('square', colX(col) - nodeW / 2, laneMid(tier) - nodeH / 2),
    width: nodeW,
    height: nodeH,
    label,
    iconId,
    iconPosition: 'left',
    textSize: 'sm',
    layerId: TEMPLATE_CONTENT_LAYER_ID,
    ...extra,
  });
  const store = (label: string, col: number): Node => ({
    ...createShape('cylinder', colX(col) - nodeW / 2, laneMid(3) - nodeH / 2 - 6),
    width: nodeW,
    height: nodeH + 12,
    label,
    textSize: 'sm',
    layerId: TEMPLATE_CONTENT_LAYER_ID,
  });

  const mobile = node('Mobile app', 'smartphone', 1, 0);
  const web = node('Web app', 'monitor', 2, 0);
  const cdn = node('CDN', 'globe', 3, 1);
  // Every request enters here, so it carries the hero preset.
  const gateway = node('API gateway', 'shield', 1, 1, { colorPreset: 'bold' });
  const auth = node('Auth service', 'key', 0, 2);
  const orders = node('Orders service', 'cart', 1, 2);
  const queue = node('Order events', 'layers', 2, 2, { colorPreset: 'soft' });
  const worker = node('Invoice worker', 'cpu', 3, 2);
  const usersDb = store('Users DB', 0);
  const ordersDb = store('Orders DB', 1);
  const analytics = store('Analytics', 2);
  const files = node('File storage', 'hard-drive', 3, 3);

  const edge = (
    from: Node,
    fromA: Anchor,
    to: Node,
    toA: Anchor,
    label: string,
    angled = false,
  ) => ({
    ...createPinnedArrow(from.id, fromA, to.id, toA),
    label,
    ...(angled ? { arrowStyle: 'angled' as const } : {}),
    layerId: TEMPLATE_CONTENT_LAYER_ID,
  });
  const arrows: Element[] = [
    edge(mobile, 's', gateway, 'n', 'HTTPS'),
    edge(web, 's', gateway, 'e', 'HTTPS', true),
    edge(web, 'e', cdn, 'n', 'assets', true),
    edge(gateway, 'w', auth, 'n', 'gRPC', true),
    edge(gateway, 's', orders, 'n', 'gRPC'),
    edge(orders, 'e', queue, 'w', 'publish'),
    edge(queue, 'e', worker, 'w', 'consume'),
    edge(auth, 's', usersDb, 'n', 'SQL'),
    edge(orders, 's', ordersDb, 'n', 'SQL'),
    edge(queue, 's', analytics, 'n', 'stream'),
    edge(worker, 's', files, 'n', 'PDF'),
  ];

  return [
    ...lanes,
    mobile,
    web,
    cdn,
    gateway,
    auth,
    orders,
    queue,
    worker,
    usersDb,
    ordersDb,
    analytics,
    files,
    ...arrows,
  ];
}
