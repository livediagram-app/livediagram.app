// Technical / developer-diagram templates lifted out of
// template-builders.ts: system architecture (request path through a
// small service topology), cloud architecture (its managed-cloud
// sibling), ER diagram (entity tables wired by relationship arrows),
// and sequence diagram (participant lifelines with request / response
// messages). They share a building-block
// vocabulary the rest of the catalogue already ships — full-colour
// Technology icons (spec/41) for the infrastructure nodes, the table
// element for entities, dashed arrows for lifelines / returns — so they
// slot into the same recolour + theme pipeline as every other template.
//
// Each builder is pure: it takes a centre (cx, cy) and returns a fresh
// Element[]. Sizing constants live inline so each template is
// self-describing. See spec/09 "Templates" for the catalogue.

import {
  createArrow,
  createPinnedArrow,
  createShape,
  createTable,
  createText,
  type Element,
} from '@livediagram/diagram';
import { isTechIconId } from '@livediagram/icons';

// A small but complete request path: a client hitting an API gateway
// that fans out to two services, which in turn read a database and a
// cache. Each infrastructure node is a full-colour Technology icon tile
// (spec/41) — Nginx gateway, Docker / Kubernetes services, PostgreSQL
// database, Redis cache — chosen from the vendor-neutral "Generic" set
// so the starter reads on any stack rather than pinning one cloud. The
// caller (the user) hitting the system is a stroke-tinted line glyph
// (there's no brand mark for "a browser"), so it adopts the theme like
// the rest of the catalogue while the branded tiles carry their own
// fixed colours. Labels caption each tile (icon on top, role beneath —
// the architecture-diagram convention createShape('icon') bakes in);
// pinned arrows wire the flow.
export function buildSystemArchitecture(cx: number, cy: number): Element[] {
  const tile = 128; // square side for every node tile (icons are aspect-locked)
  const colGap = 170; // half-distance between the two side-by-side columns

  // Vertical bands, top to bottom: client → gateway → services → data.
  // Evenly spaced (~190px pitch) so each tile's caption clears the tile
  // below it — captions render beneath the icon, so tight bands collide.
  const clientY = cy - 345;
  const gatewayY = cy - 155;
  const serviceY = cy + 35;
  const dataY = cy + 225;

  // An icon tile centred on (centerX, centerY): the glyph fills the box
  // with the role label captioned beneath. `iconId` keys the tech-icon
  // registry for branded tiles (rendered coloured) or the line-art
  // catalogue for the client glyph (stroke-tinted by the theme).
  const node = (centerX: number, centerY: number, label: string, iconId: string): Element => ({
    ...createShape('icon', centerX - tile / 2, centerY - tile / 2),
    width: tile,
    height: tile,
    label,
    iconId,
    textSize: 'sm',
    // Branded tiles render at a fixed mark size (spec/41), so they drop
    // unlocked like every other tech icon; the line-art client glyph keeps
    // the lock so it can't warp.
    ...(isTechIconId(iconId) ? { aspectLocked: false } : {}),
  });

  const client = node(cx, clientY, 'Client', 'globe');
  const gateway = node(cx, gatewayY, 'API Gateway', 'nginx');
  const auth = node(cx - colGap, serviceY, 'Auth Service', 'docker');
  const app = node(cx + colGap, serviceY, 'App Service', 'k8s');
  const db = node(cx - colGap, dataY, 'Database', 'postgres');
  const cache = node(cx + colGap, dataY, 'Cache', 'redis');

  const arrows = [
    createPinnedArrow(client.id, 's', gateway.id, 'n'),
    createPinnedArrow(gateway.id, 's', auth.id, 'n'),
    createPinnedArrow(gateway.id, 's', app.id, 'n'),
    createPinnedArrow(auth.id, 's', db.id, 'n'),
    createPinnedArrow(app.id, 's', db.id, 'n'),
    createPinnedArrow(app.id, 's', cache.id, 'n'),
  ];

  return [client, gateway, auth, app, db, cache, ...arrows];
}

// A managed-cloud topology, the vendor-flavoured sibling of the
// generic system architecture above: traffic arrives through DNS + CDN,
// crosses an API gateway into container + serverless compute, and lands
// in managed data services, with monitoring watching from the side. AWS
// marks (spec/41) because they're the most widely recognised cloud
// iconography; swapping tiles for another provider is a per-node iconId
// edit. Same conventions as buildSystemArchitecture: branded tiles keep
// their own colours, captions ride beneath, pinned arrows wire the
// request path, and dashed edges carry the control-plane relationships
// (DNS resolution, metrics).
export function buildCloudArchitecture(cx: number, cy: number): Element[] {
  const tile = 128;
  const colGap = 170; // half-distance between the two service columns
  const wideGap = 340; // data-tier column offset

  const usersY = cy - 480;
  const edgeY = cy - 290;
  const gatewayY = cy - 100;
  const serviceY = cy + 90;
  const dataY = cy + 280;

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
  const rowH = 34;
  const titleH = 34;
  const titleGap = 8;
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
    const tableX = centerX - tableW / 2;
    // The header row labels the two columns; the entity name rides a
    // bold title directly above, grouped with the table so they drag
    // together.
    const cells: string[][] = [['Field', 'Type'], ...entity.fields];
    const tableH = cells.length * rowH;
    const tableY = centerY - tableH / 2;
    const groupId = crypto.randomUUID();

    elements.push({
      ...createText(tableX, tableY - titleH - titleGap),
      width: tableW,
      height: titleH,
      label: entity.name,
      textSize: 'md',
      textBold: true,
      textAlignX: 'center',
      groupId,
    });

    const table = {
      ...createTable(tableX, tableY),
      width: tableW,
      height: tableH,
      cells,
      headerRow: true,
      textSize: 'sm' as const,
      groupId,
    };
    tableIdByName.set(entity.name, table.id);
    elements.push(table);
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

  // Participant headers + their dashed lifelines.
  participants.forEach((name, i) => {
    const centerX = centerXFor(i);
    elements.push({
      ...createShape('square', centerX - headerW / 2, headerTopY),
      width: headerW,
      height: headerH,
      label: name,
      textSize: 'md',
      textBold: true,
    });
    elements.push({
      ...createArrow(centerX, lifelineTop, centerX, lifelineBottom),
      arrowEnds: 'none',
      strokeStyle: 'dashed',
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
