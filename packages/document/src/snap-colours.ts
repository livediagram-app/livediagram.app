// Snap colours (docs/specs/023-whiteboard/whiteboard.md "Snap colours"): every custom colour of a
// board held in a field that has a stock counterpart becomes its nearest stock colour (or the ink),
// so it adapts to light and dark boards. Pure; the field table says which kinds take part.
import type { Element } from './index';
import { isCustomPenColour, nearestPenColour } from './pen-colours';

/** One kind's colour field that can hold a custom hex or a stock name. */
export type SnapColourField = {
  applies: (el: Element) => boolean;
  // The custom colour, an exact `#rrggbb`.
  hex: 'strokeColor';
  // The stock colour by name; absent is the ink.
  named: 'penColour';
  // Bindings that would re-derive a hex over the stock colour.
  clear: readonly 'strokeSwatch'[];
};

const STROKE = { hex: 'strokeColor', named: 'penColour', clear: ['strokeSwatch'] } as const;

// A kind gaining a named colour (a text colour, a path's stroke) adds one row here.
export const SNAP_COLOUR_FIELDS: readonly SnapColourField[] = [
  // Marker strokes; a highlighter's recipe owns its colour, a pencil stroke has no stock colours.
  {
    applies: (el) =>
      el.type === 'freehand' && el.penWidth !== undefined && el.pen !== 'highlighter',
    ...STROKE,
  },
  { applies: (el) => el.type === 'shape', ...STROKE },
  { applies: (el) => el.type === 'arrow', ...STROKE },
];

type Fields = Record<string, unknown>;

const isProtected = (el: Element, skip: ReadonlySet<string> | undefined) =>
  el.locked === true || (skip?.has(el.id) ?? false);

// The custom colours an element would give up, by row.
function customFieldsOf(el: Element): { row: SnapColourField; hex: string }[] {
  const out: { row: SnapColourField; hex: string }[] = [];
  for (const row of SNAP_COLOUR_FIELDS) {
    if (!row.applies(el)) continue;
    const value = (el as Fields)[row.hex];
    if (isCustomPenColour(value)) out.push({ row, hex: value.toLowerCase() });
  }
  return out;
}

/**
 * The distinct custom colours (lower-cased) a snap would convert, most recently drawn first. Locked
 * elements and the `skip` ids (hidden or locked layers) are left out.
 */
export function snappableCustomColours(
  elements: readonly Element[],
  skip?: ReadonlySet<string>,
): string[] {
  const out = new Set<string>();
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i]!;
    if (isProtected(el, skip)) continue;
    for (const { hex } of customFieldsOf(el)) out.add(hex);
  }
  return [...out];
}

/**
 * Every snappable custom colour converted: the hex and its bindings removed, the stock name set (or
 * removed, for the ink). Untouched elements come back by identity; `colours` counts the distinct
 * colours converted, `changed` the elements.
 */
export function snapTabColours(
  elements: readonly Element[],
  skip?: ReadonlySet<string>,
): { elements: Element[]; colours: number; changed: number } {
  const colours = new Set<string>();
  let changed = 0;
  const next = elements.map((el) => {
    if (isProtected(el, skip)) return el;
    const fields = customFieldsOf(el);
    if (fields.length === 0) return el;
    const patched: Fields = { ...el };
    for (const { row, hex } of fields) {
      const target = nearestPenColour(hex)!;
      delete patched[row.hex];
      for (const key of row.clear) delete patched[key];
      if (target === 'ink') delete patched[row.named];
      else patched[row.named] = target;
      colours.add(hex);
    }
    changed++;
    return patched as Element;
  });
  return { elements: next, colours: colours.size, changed };
}
