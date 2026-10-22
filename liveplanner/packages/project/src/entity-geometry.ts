// A record box's geometry (docs/specs/009-elements/entity.md), one copy for everything that draws or
// sizes one: the canvas (EntityView), the SVG export (svgEntityRows), graph
// authoring and the MCP (a box tall enough for its rows).

import { rotatePoint } from './geometry-primitives';
import { labelFontPx } from './label-font';
import type { TextSize } from './index';

// A field row: an 11 px name at the `leading-tight` 1.25, with a 3 px gap
// between rows, inside 6 px of padding above and below the list.
export const ENTITY_ROW_TEXT_PX = 11 * 1.25;
export const ENTITY_ROW_GAP_PX = 3;
export const ENTITY_BODY_PAD_PX = 6;

/**
 * Height of the title bar, which has to follow the TITLE's size.
 *
 * It was a flat 30px, which is right for the default 16px label and wrong for
 * every other setting: at `lg` the title is a 32px font and simply overflowed
 * the band, so the rule cut through the text instead of sitting under it.
 *
 * Same px table the label itself uses, so the two can't disagree, times the
 * `leading-tight` line height, plus the label's own vertical padding. The 30px
 * floor keeps existing diagrams at the default size pixel-identical.
 */
export function entityHeaderHeight(textSize: TextSize | undefined): number {
  return Math.max(30, Math.round(labelFontPx(textSize ?? 'scale') * 1.25) + 10);
}

// The height that shows every row and no more: the title bar, the list's
// padding, the rows and the gaps between them. Rows past the box are not drawn,
// so a shorter box silently loses fields.
export function entityHeight(rows: number, textSize: TextSize | undefined): number {
  const list =
    rows > 0
      ? rows * ENTITY_ROW_TEXT_PX + (rows - 1) * ENTITY_ROW_GAP_PX + 2 * ENTITY_BODY_PAD_PX
      : 0;
  return Math.ceil(entityHeaderHeight(textSize) + list);
}

// The key gutter (docs/specs/009-elements/entity.md "How it looks"): the column left of the names that
// holds the key glyphs, open only when some field has a key; wider when a PK FK pair has to fit.
export const ENTITY_KEY_GUTTER_PX = 15;
export const ENTITY_KEY_PAIR_GUTTER_PX = 25;
// Where the glyphs start, from the left edge.
export const ENTITY_KEY_GLYPH_INSET_PX = 8;
// The list's side padding: the names start this far in from the left edge, the types end this far in
// from the right one (`px-2` on canvas).
export const ENTITY_SIDE_PAD_PX = 8;

// The pitch from one row's top to the next one's.
const ROW_PITCH = ENTITY_ROW_TEXT_PX + ENTITY_ROW_GAP_PX;

type EntityBox = { x: number; y: number; width: number; height: number; textSize?: TextSize };

// The top of field row `index`, in canvas px (the box unrotated).
export function entityRowTop(el: EntityBox, index: number): number {
  return el.y + entityHeaderHeight(el.textSize) + ENTITY_BODY_PAD_PX + index * ROW_PITCH;
}

// Whether field row `index` shows inside the box: rows past the bottom are clipped (D24), and an end
// pinned to one falls back to its plain anchor rather than pointing below the box.
export function entityRowShows(el: EntityBox, index: number): boolean {
  return entityRowTop(el, index) + ENTITY_ROW_TEXT_PX <= el.y + el.height + 0.5;
}

// The point a field-pinned end meets (docs/specs/009-elements/entity.md "Field to field"): the left or
// right edge, level with the row's middle. Null when the row is not drawn (past the last field or the
// box) or the side is neither left nor right; the caller then uses the plain anchor. Unrotated.
export function entityFieldPoint(
  el: EntityBox,
  side: 'w' | 'e',
  index: number,
  fieldCount: number,
): { x: number; y: number } | null {
  if (!Number.isInteger(index) || index < 0 || index >= fieldCount) return null;
  if (!entityRowShows(el, index)) return null;
  return {
    x: side === 'w' ? el.x : el.x + el.width,
    y: entityRowTop(el, index) + ENTITY_ROW_TEXT_PX / 2,
  };
}

// What part of an entity a canvas point is over, the box unrotated: its title bar, one of its field rows,
// the empty body below the last row, or outside it (null). Each row's band takes half the gap on either
// side, so the rows tile the list with no dead lines between them.
export type EntityPart = { kind: 'title' } | { kind: 'field'; index: number } | { kind: 'below' };

export function entityPartAt(
  el: EntityBox,
  fieldCount: number,
  point: { x: number; y: number },
): EntityPart | null {
  if (point.x < el.x || point.x > el.x + el.width) return null;
  if (point.y < el.y || point.y > el.y + el.height) return null;
  const header = el.y + entityHeaderHeight(el.textSize);
  if (point.y < header) return { kind: 'title' };
  const index = Math.floor(
    (point.y - header - ENTITY_BODY_PAD_PX + ENTITY_ROW_GAP_PX / 2) / ROW_PITCH,
  );
  if (index < 0) return fieldCount > 0 ? { kind: 'field', index: 0 } : { kind: 'below' };
  if (index < fieldCount && entityRowShows(el, index)) return { kind: 'field', index };
  return { kind: 'below' };
}

// The field row an arrow end being dragged pins to (docs/specs/009-elements/entity.md "Field to field"):
// the topmost entity whose field row is under `cursor`, on the side facing `toward` (the arrow's other
// end), with the point the end then meets. `skipId` is the entity holding the other end: a field end on
// the entity it starts from is not offered. Null when no field row is under the cursor.
export function snapToEntityField(
  cursor: { x: number; y: number },
  elements: readonly {
    id: string;
    type: string;
    shape?: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    rotation?: number;
    textSize?: TextSize;
    entityFields?: readonly unknown[];
  }[],
  toward: { x: number; y: number },
  skipId: string | null,
): { elementId: string; anchor: 'w' | 'e'; field: number; point: { x: number; y: number } } | null {
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i]!;
    if (el.type !== 'shape' || el.shape !== 'entity' || el.id === skipId) continue;
    const box = {
      x: el.x ?? 0,
      y: el.y ?? 0,
      width: el.width ?? 0,
      height: el.height ?? 0,
      ...(el.textSize ? { textSize: el.textSize } : {}),
    };
    const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const local = unrotate(cursor, centre, el.rotation ?? 0);
    const count = el.entityFields?.length ?? 0;
    const part = entityPartAt(box, count, local);
    if (!part) continue;
    // The topmost entity under the pointer decides: over its title or empty body there is no field.
    if (part.kind !== 'field') return null;
    const side = unrotate(toward, centre, el.rotation ?? 0).x < centre.x ? 'w' : 'e';
    const at = entityFieldPoint(box, side, part.index, count)!;
    return {
      elementId: el.id,
      anchor: side,
      field: part.index,
      point: el.rotation ? rotatePoint(at, centre, el.rotation) : at,
    };
  }
  return null;
}

const unrotate = (p: { x: number; y: number }, c: { x: number; y: number }, deg: number) =>
  deg ? rotatePoint(p, c, -deg) : p;
