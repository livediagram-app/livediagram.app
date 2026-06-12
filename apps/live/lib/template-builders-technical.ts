// Technical / developer-diagram templates lifted out of
// template-builders.ts: system architecture (request path through a
// small service topology), ER diagram (entity tables wired by
// relationship arrows), and sequence diagram (participant lifelines
// with request / response messages). They share a building-block
// vocabulary the rest of the catalogue already ships — cylinders for
// datastores, the table element for entities, dashed arrows for
// lifelines / returns — so they slot into the same recolour + theme
// pipeline as every other template.
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

// A small but complete request path: a client hitting an API gateway
// that fans out to two services, which in turn read a database and a
// cache. Boxes carry an inline glyph (globe / server / lock) so the
// roles read at a glance; the two datastores use the cylinder shape so
// they're unmistakable. Colours are left to the theme — the topology
// reads from the labels, icons and arrows.
export function buildSystemArchitecture(cx: number, cy: number): Element[] {
  const boxW = 200;
  const boxH = 92;
  const svcW = 184;
  const dbW = 132;
  const dbH = 152;
  const colGap = 150; // half-distance between the two side-by-side columns

  // Vertical bands, top to bottom: client → gateway → services → data.
  const clientY = cy - 300;
  const gatewayY = cy - 150;
  const serviceY = cy + 0;
  const dataY = cy + 200;

  const boxed = (
    centerX: number,
    centerY: number,
    w: number,
    h: number,
    label: string,
    shape: 'square' | 'cylinder',
    iconId?: string,
  ): Element => ({
    ...createShape(shape, centerX - w / 2, centerY - h / 2),
    width: w,
    height: h,
    label,
    textSize: 'md',
    ...(iconId ? { iconId, iconPosition: 'left' as const } : {}),
  });

  const client = boxed(cx, clientY, boxW, boxH, 'Client', 'square', 'globe');
  const gateway = boxed(cx, gatewayY, boxW, boxH, 'API Gateway', 'square', 'server');
  const auth = boxed(cx - colGap, serviceY, svcW, boxH, 'Auth Service', 'square', 'lock');
  const app = boxed(cx + colGap, serviceY, svcW, boxH, 'App Service', 'square', 'server');
  const db = boxed(cx - colGap, dataY, dbW, dbH, 'Database', 'cylinder');
  const cache = boxed(cx + colGap, dataY, dbW, dbH, 'Cache', 'cylinder');

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
