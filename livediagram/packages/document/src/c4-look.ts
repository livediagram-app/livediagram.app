// The C4 model's look (docs/specs/008-canvas/canvas-and-palette.md "Templates", the C4 levels;
// docs/specs/010-palette/build-category.md "The C4 model"; docs/specs/015-api/mcp-server.md §4.7 `c4`): one palette
// and one card for every place that draws a C4 element, so the templates, the palette's C4 tiles and a graph's c4
// style can never drift apart.
//
// C4's own colours: people a deep blue, the software system in focus a mid blue, its containers a lighter blue, their
// components lighter still with dark ink, and everything outside the system grey. Every element keeps its fill under
// a dark theme (themeLockFill), so its text always has its own colour behind it. Pure.

import { createShape } from './shape-factory';
import type { Element } from './index';

type Shape = Extract<Element, { type: 'shape' }>;

export const C4_KINDS = [
  'person',
  'system',
  'container',
  'component',
  'database',
  'external',
] as const;
export type C4Kind = (typeof C4_KINDS)[number];

export const isC4Kind = (v: unknown): v is C4Kind => C4_KINDS.includes(v as C4Kind);

// Each kind's fill, edge and the ink on it, the glyph it carries and what a key or a meta line calls it.
export const C4_LOOK: Readonly<
  Record<C4Kind, { fill: string; edge: string; ink: string; icon: string; name: string }>
> = {
  person: { fill: '#08427b', edge: '#052e56', ink: '#ffffff', icon: 'user', name: 'Person' },
  system: {
    fill: '#1168bd',
    edge: '#0b4884',
    ink: '#ffffff',
    icon: 'box',
    name: 'Software system',
  },
  container: { fill: '#438dd5', edge: '#2e6295', ink: '#ffffff', icon: 'box', name: 'Container' },
  component: {
    fill: '#85bbf0',
    edge: '#5d82a8',
    ink: '#0b2540',
    icon: 'package',
    name: 'Component',
  },
  database: {
    fill: '#438dd5',
    edge: '#2e6295',
    ink: '#ffffff',
    icon: 'database',
    name: 'Database',
  },
  external: {
    fill: '#8a8a8a',
    edge: '#6b6b6b',
    ink: '#ffffff',
    icon: 'globe',
    name: 'External system',
  },
};

// A C4 card is this wide; its height grows with its description (c4CardHeight).
export const C4_CARD_W = 280;
// A card with no description: the badge, the name and the meta line.
const C4_CARD_BARE_H = 84;
// Each line of description adds this much, up to C4_BODY_MAX_LINES.
const C4_BODY_LINE_H = 20;
const C4_BODY_MAX_LINES = 4;
// About how many characters of the card's small body text fit one line of a C4_CARD_W card.
const C4_BODY_CHARS_PER_LINE = 30;
// A database's cylinder, as the Container Diagram draws a store.
export const C4_DATABASE_H = 140;

// A name wider than the card would be cut with an ellipsis: the card widens for it, up to C4_CARD_MAX_W. The title
// sets bold at about 9.5 px a character after the badge's 70 px.
const C4_CARD_MAX_W = 420;
const C4_TITLE_CHAR_PX = 9.5;
const C4_TITLE_LEAD_PX = 94;

/** How wide a C4 card is for its name: C4_CARD_W, wider for a long name, up to 420. */
export function c4CardWidth(name: string): number {
  const need = Math.ceil(C4_TITLE_LEAD_PX + [...name.trim()].length * C4_TITLE_CHAR_PX);
  return Math.min(C4_CARD_MAX_W, Math.max(C4_CARD_W, need));
}

/** How tall a C4 card is for a description at a width: the bare card plus a line per line of text, up to four. */
export function c4CardHeight(body: string, width: number = C4_CARD_W): number {
  const text = body.trim();
  if (!text) return C4_CARD_BARE_H;
  const perLine = Math.round((C4_BODY_CHARS_PER_LINE * width) / C4_CARD_W);
  const lines = Math.min(C4_BODY_MAX_LINES, Math.ceil(text.length / perLine));
  return C4_CARD_BARE_H + lines * C4_BODY_LINE_H;
}

/** The fields that dress a card as a C4 element: its glyph in a badge, its name as the title, its type or technology
 *  as the meta line and what it does as the body, in its kind's colours. */
export function c4CardFields(
  kind: Exclude<C4Kind, 'database'>,
  name: string,
  meta: string,
  body: string,
  iconId: string = C4_LOOK[kind].icon,
): Partial<Shape> {
  const hue = C4_LOOK[kind];
  return {
    cardMedia: 'badge',
    iconId,
    pageTitle: name,
    pageSubtitle: meta,
    label: body,
    textSize: 'sm',
    textAlignX: 'left',
    fillColor: hue.fill,
    strokeColor: hue.edge,
    textColor: hue.ink,
    themeLockFill: true,
  };
}

/** The fields that dress a cylinder as a C4 database: its name over its technology, in the container blue. */
export function c4DatabaseFields(name: string, tech: string): Partial<Shape> {
  const hue = C4_LOOK.database;
  return {
    label: tech ? `${name}\n${tech}` : name,
    textSize: 'sm',
    fillColor: hue.fill,
    strokeColor: hue.edge,
    textColor: hue.ink,
    themeLockFill: true,
  };
}

// The palette's C4 tiles (docs/specs/010-palette/build-category.md "The C4 model"): a Card or Cylinder variant each,
// starting from a worked example so the tile shows what goes where.
const C4_VARIANTS: Readonly<
  Record<string, { kind: C4Kind; name: string; meta: string; body: string }>
> = {
  'c4-person': {
    kind: 'person',
    name: 'Customer',
    meta: 'Person',
    body: 'Orders food on the app.',
  },
  'c4-system': {
    kind: 'system',
    name: 'Ordering platform',
    meta: 'Software system',
    body: 'Takes orders and tracks them to the door.',
  },
  'c4-container': {
    kind: 'container',
    name: 'Order service',
    meta: 'Go',
    body: 'Prices, charges and records orders.',
  },
  'c4-component': {
    kind: 'component',
    name: 'Pricing',
    meta: 'Go package',
    body: 'Totals items, fees and promo codes.',
  },
  'c4-external': {
    kind: 'external',
    name: 'Payments provider',
    meta: 'External system',
    body: 'Takes card payments.',
  },
  'c4-database': { kind: 'database', name: 'Orders database', meta: 'PostgreSQL', body: '' },
};

/** Whether `variant` is one of the C4 tiles' variants. */
export const isC4Variant = (variant: string | undefined): boolean =>
  !!variant && Object.hasOwn(C4_VARIANTS, variant);

/** `el` placed as a C4 variant: a card dressed as its kind, or a cylinder as a database. Null when `variant` is not a
 *  C4 one or names another kind of shape than `el`. */
export function applyC4Variant<E extends { shape: string }>(
  el: E,
  variant: string | undefined,
): E | null {
  if (!variant || !isC4Variant(variant)) return null;
  const v = C4_VARIANTS[variant]!;
  if (v.kind === 'database') {
    if (el.shape !== 'cylinder') return null;
    return {
      ...el,
      width: C4_CARD_W,
      height: C4_DATABASE_H,
      ...c4DatabaseFields(v.name, v.meta),
    } as E;
  }
  if (el.shape !== 'card') return null;
  const { tags: _tags, ...rest } = el as E & { tags?: unknown };
  return {
    ...rest,
    width: C4_CARD_W,
    height: c4CardHeight(v.body),
    ...c4CardFields(v.kind, v.name, v.meta, v.body),
  } as unknown as E;
}

/** `el` with its C4 variant's colours put back after the tab's theme and remembered style dressed it, as the Warning
 *  badge keeps its rose. Null when `variant` is not a C4 one. */
export function withC4VariantColours<E extends object>(
  el: E,
  variant: string | undefined,
): E | null {
  if (!variant || !isC4Variant(variant)) return null;
  const hue = C4_LOOK[C4_VARIANTS[variant]!.kind];
  const {
    colorPreset: _p,
    fillSwatch: _f,
    strokeSwatch: _s,
    textSwatch: _t,
    ...rest
  } = el as E & {
    colorPreset?: string;
    fillSwatch?: number;
    strokeSwatch?: number;
    textSwatch?: number;
  };
  return {
    ...rest,
    fillColor: hue.fill,
    strokeColor: hue.edge,
    textColor: hue.ink,
    themeLockFill: true,
  } as E;
}

// A graph node drawn in the c4 style (graph-c4.ts) carries its C4 spec under this key: a symbol, so no JSON a caller
// sends can set it, and graphToElements (graph-authoring.ts) honours it only where the c4 style put it.
export const C4_NODE: unique symbol = Symbol('c4-node');
export type C4NodeSpec = { kind: C4Kind; meta: string; body: string; icon?: string };

/** A graph node as a C4 element at the origin, its id kept: a card of its kind sized to its name and description, or
 *  a database's cylinder. The layout places it and keeps its size. */
export function c4NodeElement(id: string, name: string, spec: C4NodeSpec): Shape {
  if (spec.kind === 'database') {
    return {
      ...createShape('cylinder', 0, 0),
      id,
      width: c4CardWidth(name),
      height: C4_DATABASE_H,
      ...c4DatabaseFields(name, spec.meta),
    } as Shape;
  }
  const { tags: _tags, ...card } = createShape('card', 0, 0);
  const width = c4CardWidth(name);
  return {
    ...card,
    id,
    width,
    height: c4CardHeight(spec.body, width),
    ...c4CardFields(spec.kind, name, spec.meta, spec.body, spec.icon),
  } as Shape;
}
