// Technical / developer-diagram templates lifted out of
// template-builders.ts: system architecture (request path through a
// small service topology), cloud architecture (its managed-cloud
// sibling), ER diagram (entity tables wired by relationship arrows),
// and sequence diagram (participant lifelines with request / response
// messages). They share a building-block
// vocabulary the rest of the catalogue already ships — full-colour
// Technology icons (docs/specs/010-palette/technology-icons.md) for the infrastructure nodes, the table
// element for entities, dashed arrows for lifelines / returns — so they
// slot into the same recolour + theme pipeline as every other template.
//
// Each builder is pure: it takes a centre (cx, cy) and returns a fresh
// Element[]. Sizing constants live inline so each template is
// self-describing. See docs/specs/008-canvas/canvas-and-palette.md "Templates" for the catalogue.

import {
  createArrow,
  createPinnedArrow,
  createShape,
  type Anchor,
  type Element,
} from '@livediagram/diagram';
import { isTechIconId } from '@livediagram/icons';
import { TEMPLATE_CONTENT_LAYER_ID, TEMPLATE_SCAFFOLD_LAYER_ID } from './template-layers';

// The LOGICAL architecture of a small shop: the vendor-neutral sibling of
// buildCloudArchitecture below, which names real AWS services. Four tiered
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

// A managed-cloud topology, the vendor-flavoured sibling of the
// generic system architecture above: traffic arrives through DNS + CDN,
// crosses an API gateway into container + serverless compute, and lands
// in managed data services, with monitoring watching from the side. AWS
// marks (docs/specs/010-palette/technology-icons.md) because they're the most widely recognised cloud
// iconography; swapping tiles for another provider is a per-node iconId
// edit. Same conventions as buildSystemArchitecture: branded tiles keep
// their own colours, captions ride beneath, pinned arrows wire the
// request path, and dashed edges carry the control-plane relationships
// (DNS resolution, metrics).
export function buildCloudArchitecture(cx: number, cy: number): Element[] {
  const tile = 128;
  const colGap = 170; // half-distance between the two service columns
  const wideGap = 340; // data-tier column offset

  // Five ranks symmetric about cy (190px pitch) so the topology centres
  // on the canvas point; the old bands were biased ~100px upward.
  const usersY = cy - 380;
  const edgeY = cy - 190;
  const gatewayY = cy;
  const serviceY = cy + 190;
  const dataY = cy + 380;

  const node = (centerX: number, centerY: number, label: string, iconId: string): Element => ({
    ...createShape('icon', centerX - tile / 2, centerY - tile / 2),
    width: tile,
    height: tile,
    label,
    iconId,
    textSize: 'sm',
    ...(isTechIconId(iconId) ? { aspectLocked: false } : {}),
  });

  const users = node(cx, usersY, 'Users', 'users');
  const cdn = node(cx, edgeY, 'CDN', 'aws-cloudfront');
  const dns = node(cx - wideGap, edgeY, 'DNS', 'aws-route53');
  const gateway = node(cx, gatewayY, 'API Gateway', 'aws-apigateway');
  const monitoring = node(cx + wideGap, gatewayY, 'Monitoring', 'aws-cloudwatch');
  const app = node(cx - colGap, serviceY, 'App Service', 'aws-ecs');
  const worker = node(cx + colGap, serviceY, 'Jobs Worker', 'aws-lambda');
  const db = node(cx - wideGap, dataY, 'Database', 'aws-rds');
  const queue = node(cx, dataY, 'Job Queue', 'aws-sqs');
  const storage = node(cx + wideGap, dataY, 'Object Storage', 'aws-s3');

  const arrows: Element[] = [
    // Request path.
    createPinnedArrow(users.id, 's', cdn.id, 'n'),
    createPinnedArrow(cdn.id, 's', gateway.id, 'n'),
    createPinnedArrow(gateway.id, 's', app.id, 'n'),
    createPinnedArrow(gateway.id, 's', worker.id, 'n'),
    createPinnedArrow(app.id, 's', db.id, 'n'),
    { ...createPinnedArrow(app.id, 's', queue.id, 'n'), label: 'enqueue' },
    { ...createPinnedArrow(queue.id, 'e', worker.id, 's'), label: 'consume' },
    createPinnedArrow(worker.id, 's', storage.id, 'n'),
    // Control plane, dashed so it reads as supporting relationships.
    { ...createPinnedArrow(dns.id, 'e', cdn.id, 'w'), strokeStyle: 'dashed', label: 'resolves' },
    {
      ...createPinnedArrow(gateway.id, 'e', monitoring.id, 'w'),
      strokeStyle: 'dashed',
      label: 'metrics',
    },
  ];

  return [users, dns, cdn, gateway, monitoring, app, worker, db, queue, storage, ...arrows];
}

// A canonical e-commerce schema: Users place Orders, Orders contain
// OrderItems, and each OrderItem points at a Product. Four entities in a
// 2×2 grid, each a title + a field/type table (grouped so the pair moves
// as one), wired by relationship arrows carrying their cardinality.
export function buildErDiagram(cx: number, cy: number): Element[] {
  const tableW = 250;
  // Entity row + title-band heights (docs/specs/009-elements/entity.md), not the old table's 34px row:
  // an entity draws 11px rows on a 3px gap, so a table-sized row left a band
  // of empty box under the last field.
  const rowH = 26;
  const titleH = 34;
  const colHalfGap = 340; // half-distance between the two entity columns
  const rowHalfGap = 250; // half-distance between the two entity rows

  type Entity = {
    name: string;
    col: 0 | 1;
    row: 0 | 1;
    fields: [string, string][];
  };

  const entities: Entity[] = [
    {
      name: 'Users',
      col: 0,
      row: 0,
      fields: [
        ['id', 'uuid PK'],
        ['name', 'text'],
        ['email', 'text'],
        ['created_at', 'timestamptz'],
      ],
    },
    {
      name: 'Orders',
      col: 1,
      row: 0,
      fields: [
        ['id', 'uuid PK'],
        ['user_id', 'uuid FK'],
        ['status', 'text'],
        ['total', 'numeric'],
        ['created_at', 'timestamptz'],
      ],
    },
    {
      name: 'Products',
      col: 0,
      row: 1,
      fields: [
        ['id', 'uuid PK'],
        ['name', 'text'],
        ['sku', 'text'],
        ['price', 'numeric'],
      ],
    },
    {
      name: 'OrderItems',
      col: 1,
      row: 1,
      fields: [
        ['id', 'uuid PK'],
        ['order_id', 'uuid FK'],
        ['product_id', 'uuid FK'],
        ['quantity', 'int'],
      ],
    },
  ];

  const elements: Element[] = [];
  const tableIdByName = new Map<string, string>();

  for (const entity of entities) {
    const centerX = cx + (entity.col === 0 ? -colHalfGap : colHalfGap);
    const centerY = cy + (entity.row === 0 ? -rowHalfGap : rowHalfGap);
    // One ENTITY element per table (docs/specs/009-elements/entity.md), not a bold text label grouped
    // with a two-column table. That was three objects pretending to be one,
    // held together by a groupId, and the field rows could not be edited as
    // fields — only as table cells that happened to be laid out like fields.
    const height = titleH + entity.fields.length * rowH;
    const box = {
      ...createShape('entity', centerX - tableW / 2, centerY - height / 2),
      width: tableW,
      height,
      label: entity.name,
      entityFields: entity.fields.map(([name, type]) => ({ name, type })),
    };
    tableIdByName.set(entity.name, box.id);
    elements.push(box);
  }

  // Relationships, each a "one-to-many" crow's-foot read as a labelled
  // arrow from the parent entity to the child that carries its FK.
  const rel = (from: string, fromAnchor: 'e' | 's', to: string, toAnchor: 'w' | 'n') =>
    Object.assign(
      createPinnedArrow(tableIdByName.get(from)!, fromAnchor, tableIdByName.get(to)!, toAnchor),
      { label: '1 : N' },
    );
  elements.push(rel('Users', 'e', 'Orders', 'w'));
  elements.push(rel('Orders', 's', 'OrderItems', 'n'));
  elements.push(rel('Products', 'e', 'OrderItems', 'w'));

  return elements;
}

// A login flow as a sequence diagram: participant headers across the
// top, a dashed lifeline dropping from each, and request / response
// messages stepping down between them. Messages are free arrows pinned
// to nothing (a sequence diagram's geometry is the point), with returns
// dashed to read as responses.
export function buildSequenceDiagram(cx: number, cy: number): Element[] {
  const participants = ['User', 'Web App', 'API Server', 'Database'];
  const spacing = 260;
  const headerW = 170;
  const headerH = 58;
  const headerTopY = cy - 300;
  const lifelineTop = headerTopY + headerH;
  const lifelineBottom = cy + 300;

  const centerXFor = (i: number) => cx + (i - (participants.length - 1) / 2) * spacing;

  const elements: Element[] = [];

  // Participant headers + their dashed lifelines: the stationary
  // skeleton, so they ride the scaffold layer (docs/specs/006-diagram/layers.md) while the
  // messages users add and reorder live on the content layer above.
  participants.forEach((name, i) => {
    const centerX = centerXFor(i);
    elements.push({
      ...createShape('square', centerX - headerW / 2, headerTopY),
      width: headerW,
      height: headerH,
      label: name,
      textSize: 'md',
      textBold: true,
      layerId: TEMPLATE_SCAFFOLD_LAYER_ID,
    });
    elements.push({
      ...createArrow(centerX, lifelineTop, centerX, lifelineBottom),
      arrowEnds: 'none',
      strokeStyle: 'dashed',
      layerId: TEMPLATE_SCAFFOLD_LAYER_ID,
    });
  });

  // Messages step down the page. `return` messages dash to read as
  // responses travelling back up the stack.
  const messages: { from: number; to: number; label: string; reply?: boolean }[] = [
    { from: 0, to: 1, label: 'Enter credentials' },
    { from: 1, to: 2, label: 'POST /api/login' },
    { from: 2, to: 3, label: 'SELECT * FROM users' },
    { from: 3, to: 2, label: 'user record', reply: true },
    { from: 2, to: 1, label: '200 OK + session token', reply: true },
    { from: 1, to: 0, label: 'Render dashboard', reply: true },
  ];
  const firstMessageY = lifelineTop + 64;
  const stepGap = 78;
  messages.forEach((msg, i) => {
    const y = firstMessageY + i * stepGap;
    elements.push({
      ...createArrow(centerXFor(msg.from), y, centerXFor(msg.to), y),
      layerId: TEMPLATE_CONTENT_LAYER_ID,
      label: msg.label,
      // Lift the label clear of the line (default centres it ON the
      // arrow). The perpendicular direction flips with the arrow's
      // direction, so a negative offset reads as "above" for the
      // rightward requests and a positive one for the leftward replies.
      labelOffset: { t: 0.5, offset: msg.reply ? 18 : -18 },
      ...(msg.reply ? { strokeStyle: 'dashed' as const } : {}),
    });
  });

  return elements;
}
