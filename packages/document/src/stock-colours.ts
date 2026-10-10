// The stock colours, first-class (docs/specs/007-editor/editor-modes.md "One look"): Ink and the
// eight hued colours are stored by name on any element and drawn in the version tuned for the
// canvas they sit on. Every renderer resolves them here, so the canvas, every export, thumbnail
// and MCP image draw the same element in the same colour, in either editor mode.
import type { CanvasSurface } from './colors';
import { penColourHex, type PenColourName } from './pen-colours';
import type { Element } from './index';

type Named = {
  penColour?: PenColourName;
  strokeColor?: string;
  fillColor?: string;
  type?: string;
  closed?: boolean;
  strokeWidth?: string;
  penTextColour?: PenColourName;
  textColor?: string;
};

// An explicit `strokeColor` / `textColor` wins over its name. Returns `el` itself when nothing
// resolves, so a caller can keep element identity.
export function resolveStockColours<T extends Element>(el: T, surface: CanvasSurface): T {
  const named = el as T & Named;
  const line =
    named.penColour !== undefined && named.strokeColor === undefined
      ? { strokeColor: penColourHex(named.penColour, surface) }
      : null;
  const text =
    named.penTextColour !== undefined && named.textColor === undefined
      ? { textColor: penColourHex(named.penTextColour, surface) }
      : null;
  // A pen stroke's area as a path (merged by Mirror, or Combined: docs/specs/007-editor/logo-pages.md)
  // is a closed path with no outline: its pen colour names its fill.
  const area =
    named.type === 'path' &&
    named.closed === true &&
    named.strokeWidth === 'none' &&
    named.penColour !== undefined &&
    named.fillColor === undefined
      ? { fillColor: penColourHex(named.penColour, surface) }
      : null;
  if (!line && !text && !area) return el;
  return { ...el, ...line, ...text, ...area };
}
