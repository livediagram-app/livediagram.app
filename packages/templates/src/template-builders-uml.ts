// The UML class diagram template (docs/specs/008-canvas/canvas-and-palette.md "Templates"). Its sibling,
// the state machine, lives in template-builders-state-machine.ts; both
// draw the same Plateful order the other technical starters describe.
//
// Pure: takes a centre (cx, cy), returns a fresh Element[].

import {
  createArrow,
  createPinnedArrow,
  createShape,
  createText,
  entityHeight,
  type Anchor,
  type ArrowheadShape,
  type Element,
  type EntityField,
} from '@livediagram/document';
import { techHeader, TECH_HEADER_H, TECH_MUTED } from './template-builders-technical-kit';

// Plateful's order domain model in real UML class notation, laid out as a
// plus around Order so every relationship is one straight line.
//
// Each class is one Entity element (docs/specs/009-elements/entity.md): the
// class name in the title bar, then its members, attributes first and
// operations after. Every member carries its visibility (+ public,
// - private, # protected) and its type sits in the type column, so an
// operation shows its return type there (`+ total()` | `Money`). The
// abstract Payment's name is italic and stereotyped, as UML draws it, and
// OrderStatus is an «enumeration» whose literals are the states the state
// machine template walks through.
//
// The relationships are the ones a class diagram exists to tell apart:
// - generalisation (hollow triangle at the parent): Card and Wallet
//   payments are Payments;
// - composition (filled diamond at the whole): an Order is made of its
//   OrderLines, which do not outlive it;
// - aggregation (hollow diamond at the whole): a Restaurant has MenuItems;
// - association (open head, the navigable direction): a Customer places
//   Orders, an Order is paid by Payments and received by a Restaurant, an
//   OrderLine refers to a MenuItem.
// Each association and whole-part line is labelled with its role and both
// multiplicities, in the order the line runs ("places · 1 : 0..*"). A key
// in the free top-left corner shows the four line ends, so a newcomer can
// read the diagram without a UML reference open.
type Klass = {
  name: string;
  col: number;
  row: number;
  fields: EntityField[];
  italic?: boolean;
  width?: number;
  dx?: number;
};

const f = (name: string, type?: string): EntityField => (type ? { name, type } : { name });

const CLASSES: Klass[] = [
  {
    name: 'Customer',
    col: 1,
    row: 0,
    fields: [f('- id', 'UUID'), f('- email', 'Email'), f('+ placeOrder(basket)', 'Order')],
  },
  {
    name: '«abstract» Payment',
    col: 0,
    row: 1,
    italic: true,
    fields: [
      f('# amount', 'Money'),
      f('# status', 'PaymentStatus'),
      f('+ authorise()', 'Boolean'),
      f('+ refund()', 'void'),
    ],
  },
  {
    name: 'Order',
    col: 1,
    row: 1,
    fields: [
      f('- id', 'UUID'),
      f('- status', 'OrderStatus'),
      f('- placedAt', 'Instant'),
      f('+ total()', 'Money'),
      f('+ accept(prepMins)', 'void'),
      f('+ cancel(reason)', 'void'),
    ],
  },
  {
    name: 'Restaurant',
    col: 2,
    row: 1,
    fields: [f('- name', 'String'), f('- isOpen', 'Boolean'), f('+ decline(order)', 'void')],
  },
  {
    name: 'CardPayment',
    col: 0,
    row: 2,
    width: 204,
    dx: -116,
    fields: [f('- last4', 'String'), f('+ authorise()', 'Boolean')],
  },
  {
    name: 'WalletPayment',
    col: 0,
    row: 2,
    width: 204,
    dx: 116,
    fields: [f('- provider', 'Wallet'), f('+ authorise()', 'Boolean')],
  },
  {
    name: 'OrderLine',
    col: 1,
    row: 2,
    fields: [f('- quantity', 'Integer'), f('- unitPrice', 'Money'), f('+ subtotal()', 'Money')],
  },
  {
    name: 'MenuItem',
    col: 2,
    row: 2,
    fields: [f('- name', 'String'), f('- price', 'Money'), f('- available', 'Boolean')],
  },
  {
    name: '«enumeration» OrderStatus',
    col: 2,
    row: 0,
    width: 320,
    fields: [
      'PLACED',
      'ACCEPTED',
      'PREPARING',
      'READY',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
      'REJECTED',
      'CANCELLED',
    ].map((literal) => f(literal)),
  },
];

// [from, anchor, to, anchor, head at `to`, label]
const LINKS: [string, Anchor, string, Anchor, ArrowheadShape, string?][] = [
  ['Customer', 's', 'Order', 'n', 'line', 'places · 1 : 0..*'],
  ['Order', 'w', '«abstract» Payment', 'e', 'line', 'paid by · 1 : 1..*'],
  ['Order', 'e', 'Restaurant', 'w', 'line', 'received by · 0..* : 1'],
  ['OrderLine', 'n', 'Order', 's', 'diamond', 'lines · 1..* : 1'],
  ['MenuItem', 'n', 'Restaurant', 's', 'diamond-hollow', 'menu · 0..* : 1'],
  ['OrderLine', 'e', 'MenuItem', 'w', 'line', 'of · 0..* : 1'],
  ['CardPayment', 'n', '«abstract» Payment', 's', 'triangle-hollow'],
  ['WalletPayment', 'n', '«abstract» Payment', 's', 'triangle-hollow'],
];

// The key: one short line per relationship kind, head on the right.
const KEY: [ArrowheadShape, string][] = [
  ['triangle-hollow', 'is a kind of (inherits)'],
  ['diamond', 'is made of (composition)'],
  ['diamond-hollow', 'has (aggregation)'],
  ['line', 'knows about (association)'],
];

export function buildUmlClass(cx: number, cy: number): Element[] {
  const classW = 260;
  const colPitch = 440;
  const vGap = 110;
  const heightOf = (k: Klass) => entityHeight(k.fields.length, 'md');
  const rowHalf = [0, 1, 2].map((r) =>
    Math.max(...CLASSES.filter((k) => k.row === r).map((k) => heightOf(k) / 2)),
  );
  const gridW = 2 * colPitch + classW + 2 * 16;
  const gridH = 2 * (rowHalf[0]! + rowHalf[1]! + rowHalf[2]!) + 2 * vGap;
  const headGap = 28;
  const left = cx - gridW / 2;
  const top = cy - (TECH_HEADER_H + headGap + gridH) / 2;
  const gridTop = top + TECH_HEADER_H + headGap;
  const colX = (c: number) => left + 16 + classW / 2 + c * colPitch;
  const rowMid = [
    gridTop + rowHalf[0]!,
    gridTop + 2 * rowHalf[0]! + vGap + rowHalf[1]!,
    gridTop + 2 * (rowHalf[0]! + rowHalf[1]!) + 2 * vGap + rowHalf[2]!,
  ];

  const elements: Element[] = techHeader(
    left,
    top,
    gridW,
    'Plateful · order domain model',
    'Members read visibility name | type (+ public, - private, # protected). Lines are labelled role · multiplicity at each end, in the direction they run.',
  );

  const idByName = new Map<string, string>();
  for (const k of CLASSES) {
    const w = k.width ?? classW;
    const h = heightOf(k);
    const box: Element = {
      ...createShape('entity', colX(k.col) + (k.dx ?? 0) - w / 2, rowMid[k.row]! - h / 2),
      width: w,
      height: h,
      label: k.name,
      textSize: 'md',
      entityFields: k.fields,
      ...(k.italic ? { textItalic: true } : {}),
      // The aggregate root carries the hero preset.
      ...(k.name === 'Order' ? { colorPreset: 'soft' } : {}),
    };
    idByName.set(k.name, box.id);
    elements.push(box);
  }

  for (const [from, fromA, to, toA, head, label] of LINKS) {
    elements.push({
      ...createPinnedArrow(idByName.get(from)!, fromA, idByName.get(to)!, toA),
      arrowheadShape: head,
      arrowheadSize: 'large',
      ...(label ? { label } : {}),
    });
  }

  // The key, in the free top-left cell.
  const keyX = colX(0) - classW / 2;
  const keyTop = gridTop + 8;
  elements.push({
    ...createText(keyX, keyTop),
    width: classW,
    height: 28,
    label: 'Reading the lines',
    textSize: 'sm',
    textBold: true,
    textAlignX: 'left',
  });
  KEY.forEach(([head, meaning], i) => {
    const y = keyTop + 44 + i * 30;
    elements.push(
      {
        ...createArrow(keyX, y, keyX + 52, y),
        arrowheadShape: head,
        arrowheadSize: 'large',
      },
      {
        ...createText(keyX + 66, y - 12),
        width: classW - 66,
        height: 24,
        label: meaning,
        textSize: 'sm',
        textColor: TECH_MUTED,
        textAlignX: 'left',
      },
    );
  });

  return elements;
}
