// The database schema (ER diagram) template (docs/specs/008-canvas/canvas-and-palette.md "Templates"),
// split out of template-builders-technical.ts once it grew past four boxes.
//
// Pure: takes a centre (cx, cy), returns a fresh Element[].

import {
  createPinnedArrow,
  createShape,
  createSticky,
  entityFieldView,
  entityHeight,
  type Anchor,
  type ErShape,
  type Element,
} from '@livehuddle/document';
import { techHeader, TECH_HEADER_H } from './template-builders-technical-kit';

// Plateful's orders schema: the six Postgres tables every order touches,
// laid out as a plus around the `orders` hub so every relationship is one
// straight line and none cross. Customers place orders from above;
// restaurants receive them from the left and offer menu items below;
// couriers deliver them from the right; each order contains order items,
// which point back at the menu item they were ordered as.
//
// Each table is one Entity element (docs/specs/009-elements/entity.md): the
// title is the table name and every row is `column | type`. The key role is
// written the way a DBA reads it (`uuid PK`, `uuid FK`, `text UK`, and `PK FK`
// for order_items' composite key) and stored as the field's key
// (entityFieldView), so the boxes draw key glyphs. Boxes
// are exactly as tall as their rows (entityHeight), so none trails empty
// space.
//
// Every relationship is a pinned line from the ONE side to the MANY side,
// with an ER end at each table (one, zero or one, zero or many, one or many)
// that says the multiplicity, and the verb as its label. The only optional
// one-side is the courier (0..1: an order has no courier until pickup).
//
// The free corners carry what a schema review needs next to the boxes: the
// order_status enum as a SQL code block (the same states the state-machine
// template draws) and a sticky with the open question on an index, flagged
// in review.
type Table = { name: string; col: number; row: number; fields: [string, string][] };

const TABLES: Table[] = [
  {
    name: 'customers',
    col: 1,
    row: 0,
    fields: [
      ['id', 'uuid PK'],
      ['email', 'text UK'],
      ['name', 'text'],
      ['phone', 'text'],
      ['created_at', 'timestamptz'],
    ],
  },
  {
    name: 'restaurants',
    col: 0,
    row: 1,
    fields: [
      ['id', 'uuid PK'],
      ['name', 'text'],
      ['cuisine', 'text'],
      ['rating', 'numeric(2,1)'],
      ['is_open', 'boolean'],
    ],
  },
  {
    name: 'orders',
    col: 1,
    row: 1,
    fields: [
      ['id', 'uuid PK'],
      ['customer_id', 'uuid FK'],
      ['restaurant_id', 'uuid FK'],
      ['courier_id', 'uuid FK, null'],
      ['status', 'order_status'],
      ['total_pence', 'integer'],
      ['placed_at', 'timestamptz'],
    ],
  },
  {
    name: 'couriers',
    col: 2,
    row: 1,
    fields: [
      ['id', 'uuid PK'],
      ['name', 'text'],
      ['vehicle', 'text'],
      ['on_shift', 'boolean'],
    ],
  },
  {
    name: 'menu_items',
    col: 0,
    row: 2,
    fields: [
      ['id', 'uuid PK'],
      ['restaurant_id', 'uuid FK'],
      ['name', 'text'],
      ['price_pence', 'integer'],
      ['is_available', 'boolean'],
    ],
  },
  {
    name: 'order_items',
    col: 1,
    row: 2,
    fields: [
      ['order_id', 'uuid PK FK'],
      ['menu_item_id', 'uuid PK FK'],
      ['quantity', 'smallint'],
      ['unit_price_pence', 'integer'],
      ['note', 'text'],
    ],
  },
];

// One-side -> many-side, with the anchors that keep each line straight, the verb, and the ER end at each
// table (docs/specs/009-elements/entity.md "Cardinality ends").
const RELATIONSHIPS: [string, Anchor, string, Anchor, string, ErShape, ErShape][] = [
  ['customers', 's', 'orders', 'n', 'places', 'one', 'zero-or-many'],
  ['restaurants', 'e', 'orders', 'w', 'receives', 'one', 'zero-or-many'],
  ['couriers', 'w', 'orders', 'e', 'delivers', 'zero-or-one', 'zero-or-many'],
  ['orders', 's', 'order_items', 'n', 'contains', 'one', 'one-or-many'],
  ['restaurants', 's', 'menu_items', 'n', 'offers', 'one', 'zero-or-many'],
  ['menu_items', 'e', 'order_items', 'w', 'ordered as', 'one', 'zero-or-many'],
];

const ORDER_STATUS_SQL = `CREATE TYPE order_status AS ENUM (
  'placed', 'accepted', 'preparing',
  'ready', 'out_for_delivery',
  'delivered', 'rejected', 'cancelled'
);`;

export function buildErDiagram(cx: number, cy: number): Element[] {
  const tableW = 260;
  const colPitch = 420;
  const vGap = 96; // clear space between rows, where the vertical labels sit
  const heightOf = (t: Table) => entityHeight(t.fields.length, 'md');
  const rowHalf = [0, 1, 2].map((r) =>
    Math.max(...TABLES.filter((t) => t.row === r).map((t) => heightOf(t) / 2)),
  );
  const gridW = 2 * colPitch + tableW;
  const gridH = 2 * rowHalf[0]! + 2 * rowHalf[1]! + 2 * rowHalf[2]! + 2 * vGap;
  const headGap = 28;
  const left = cx - gridW / 2;
  const top = cy - (TECH_HEADER_H + headGap + gridH) / 2;
  const gridTop = top + TECH_HEADER_H + headGap;
  const colX = (c: number) => left + tableW / 2 + c * colPitch;
  const rowMid = [
    gridTop + rowHalf[0]!,
    gridTop + 2 * rowHalf[0]! + vGap + rowHalf[1]!,
    gridTop + 2 * rowHalf[0]! + 2 * rowHalf[1]! + 2 * vGap + rowHalf[2]!,
  ];

  const elements: Element[] = techHeader(
    left,
    top,
    gridW,
    'Plateful · orders schema',
    "Every line runs from the one side to the many side; its crow's-foot ends say how many at each table. Keys show beside each column.",
  );

  const idByName = new Map<string, string>();
  for (const t of TABLES) {
    const h = heightOf(t);
    const box: Element = {
      ...createShape('entity', colX(t.col) - tableW / 2, rowMid[t.row]! - h / 2),
      width: tableW,
      height: h,
      label: t.name,
      textSize: 'md',
      entityFields: t.fields.map(([name, type]) => entityFieldView({ name, type })),
      // The hub every relationship meets carries the hero preset.
      ...(t.name === 'orders' ? { colorPreset: 'soft' } : {}),
    };
    idByName.set(t.name, box.id);
    elements.push(box);
  }

  for (const [from, fromA, to, toA, label, start, end] of RELATIONSHIPS) {
    elements.push({
      ...createPinnedArrow(idByName.get(from)!, fromA, idByName.get(to)!, toA),
      arrowEnds: 'both',
      arrowheadStartShape: start,
      arrowheadShape: end,
      arrowheadSize: 'large',
      label,
    });
  }

  // Top-right corner: the enum behind orders.status.
  const cornerW = tableW + 60;
  const cornerX = colX(2) - cornerW / 2;
  elements.push({
    ...createShape('code-block', cornerX, gridTop),
    width: cornerW,
    height: 2 * rowHalf[0]!,
    code: ORDER_STATUS_SQL,
    codeLanguage: 'sql',
  });

  // Bottom-right corner: the open question a schema review leaves behind.
  const noteH = 2 * rowHalf[2]!;
  const noteX = colX(2) - tableW / 2;
  elements.push({
    ...createSticky(noteX, rowMid[2]! - noteH / 2),
    width: tableW,
    height: noteH,
    label:
      'Kitchen screen lists live orders per restaurant: add an index on orders (restaurant_id, status)? · Priya',
    textSize: 'sm',
  });
  const badgeH = 28;
  elements.push({
    ...createShape('sticker', noteX + tableW - badgeH * 2.2, rowMid[2]! - noteH / 2 - badgeH / 2),
    width: badgeH * 2.5,
    height: badgeH,
    stickerId: 'badge-in-review',
    rotation: 3,
  });

  return elements;
}
