// A colour field that is not a colour, dropped where stored elements enter (./stored-elements): from storage, a peer,
// a paste, a file or an agent's write. The canvas paints element colours into CSS, several of them inside a
// `background` or a gradient (a card's wash, a reveal's glow, a mood bar), where a value carrying `url(...)` makes
// every viewer's browser fetch an outside address. Nothing in livediagram loads from outside the document
// (docs/specs/009-elements/images.md "External-URL images"), so a colour that could is refused once, at the door,
// rather than at each of the sinks. The element then paints with that colour's default, as if it had none.

import type { Element } from './index';

// The fields that hold a colour, wherever they sit in an element (on it, or on one of its rows, series or notes).
const COLOUR_FIELDS = new Set([
  'accent',
  'accentEdgeColor',
  'arrowheadColor',
  'authorColor',
  'backgroundColor',
  'color',
  'colour',
  'fill',
  'fillColor',
  'headerFill',
  'headerTextColor',
  'ink',
  'inkSoft',
  'labelColor',
  'labelFill',
  'latestAuthorColor',
  'onFill',
  'overFill',
  'patternColor',
  'stroke',
  'strokeColor',
  'textColor',
]);

// What no colour contains: a way out of a CSS value (a quote, a semicolon, a brace, an escape), or a function that
// loads something. Every colour CSS has (hex, a name, rgb(), hsl(), oklch(), color-mix(), var()) passes.
const NOT_A_COLOUR = /[\\;{}<>"'`]|url|image|src\s*\(|element\s*\(|cross-fade|paint\s*\(/i;

/** Whether a stored colour is safe to paint into CSS. */
export function isSafeColourValue(value: string): boolean {
  return !NOT_A_COLOUR.test(value);
}

// How deep the walk looks into an element's own objects (its rows, its series): colours sit one or two levels down.
const MAX_DEPTH = 4;

// The value with every unsafe colour field taken out; the same value when it had none.
function withoutUnsafeColours<T>(value: T, depth: number): T {
  if (depth > MAX_DEPTH || typeof value !== 'object' || value === null) return value;
  if (Array.isArray(value)) {
    // A list of numbers or points (a stroke's) holds no colour: skipped without a walk.
    if (value.length === 0 || typeof value[0] !== 'object' || Array.isArray(value[0])) return value;
    let changed = false;
    const next = value.map((item: unknown) => {
      const clean = withoutUnsafeColours(item, depth + 1);
      if (clean !== item) changed = true;
      return clean;
    });
    return (changed ? next : value) as T;
  }
  let out: Record<string, unknown> | null = null;
  for (const [key, field] of Object.entries(value as Record<string, unknown>)) {
    if (typeof field === 'string') {
      if (COLOUR_FIELDS.has(key) && !isSafeColourValue(field)) {
        out ??= { ...(value as Record<string, unknown>) };
        delete out[key];
      }
      continue;
    }
    if (typeof field !== 'object' || field === null) continue;
    const clean = withoutUnsafeColours(field, depth + 1);
    if (clean !== field) {
      out ??= { ...(value as Record<string, unknown>) };
      out[key] = clean;
    }
  }
  return (out ?? value) as T;
}

export function dropUnsafeColours(elements: Element[]): Element[] {
  let changed = false;
  const next = elements.map((el) => {
    const clean = withoutUnsafeColours(el, 0);
    if (clean !== el) changed = true;
    return clean;
  });
  if (!changed) return elements;
  console.warn('[colours] unsafe colour dropped');
  return next;
}
