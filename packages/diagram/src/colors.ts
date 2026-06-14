import {
  DEFAULT_BACKGROUND_COLOR,
  DEFAULT_PATTERN_COLOR,
  type BoxedElement,
  type Element,
  type FreehandElement,
  type Padding,
  type ShapeElement,
  type TextAlignX,
  type TextAlignY,
} from './index';

// Per-type default padding bucket (was beside the Padding type).
export function defaultPadding(element: BoxedElement): Padding {
  switch (element.type) {
    case 'shape':
      return 'sm';
    case 'text':
      return 'none';
    case 'sticky':
      return 'md';
    case 'image':
      return 'none';
    case 'freehand':
      return 'none';
    case 'table':
      return 'sm';
    case 'annotation':
      return 'none';
    case 'link-card':
      return 'none';
  }
}

// --- Colour derivation ----------------------------------------------------

// Standard hex → rgb / rgb → hex / brightness math used to derive colours
// for new elements when the tab background or pattern colour has been
// customised. Failsafe: returns design defaults on unparseable input.

type RGB = { r: number; g: number; b: number };

function hexToRgb(hex: string): RGB | null {
  const m = /^#?([a-fA-F\d]{2})([a-fA-F\d]{2})([a-fA-F\d]{2})$/.exec(hex);
  if (!m) return null;
  return { r: parseInt(m[1]!, 16), g: parseInt(m[2]!, 16), b: parseInt(m[3]!, 16) };
}

function rgbToHex({ r, g, b }: RGB): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return '#' + [clamp(r), clamp(g), clamp(b)].map((v) => v.toString(16).padStart(2, '0')).join('');
}

function mixWithWhite(rgb: RGB, amount: number): RGB {
  return {
    r: rgb.r + (255 - rgb.r) * amount,
    g: rgb.g + (255 - rgb.g) * amount,
    b: rgb.b + (255 - rgb.b) * amount,
  };
}

function darken(rgb: RGB, amount: number): RGB {
  return { r: rgb.r * (1 - amount), g: rgb.g * (1 - amount), b: rgb.b * (1 - amount) };
}

export function isLightColor(hex: string): boolean {
  const rgb = hexToRgb(hex);
  if (!rgb) return true;
  // Perceived-brightness (NTSC weighted) — < 155 reads as dark.
  return (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000 > 155;
}

// For new shapes on a customised tab: stroke = pattern colour as the accent;
// fill = a very light tint of that colour; text = a deep version of it.
// On a default-coloured tab, returns null to defer to the design system.
export function deriveShapeColours(
  patternColor: string,
  backgroundColor: string,
): { fill: string; stroke: string; text: string } | null {
  if (patternColor === DEFAULT_PATTERN_COLOR && backgroundColor === DEFAULT_BACKGROUND_COLOR) {
    return null;
  }
  const rgb = hexToRgb(patternColor);
  if (!rgb) return null;
  return {
    fill: rgbToHex(mixWithWhite(rgb, 0.85)),
    stroke: rgbToHex(rgb),
    text: rgbToHex(darken(rgb, 0.45)),
  };
}

// For new text elements: just a label colour that contrasts with the bg.
export function deriveTextColorForBg(backgroundColor: string): string {
  return isLightColor(backgroundColor) ? '#1e293b' : '#f1f5f9'; // slate-800 / slate-100
}

export function defaultTextColor(element: BoxedElement): string {
  switch (element.type) {
    case 'shape':
      return '#075985'; // brand-800
    case 'sticky':
      return '#451a03'; // amber-950-ish
    case 'text':
      return '#1e293b'; // slate-800
    case 'image':
      return '#1e293b'; // slate-800 (only used for alt-text rendering)
    case 'freehand':
      return '#1e293b'; // slate-800 (no inline label today, future-proof)
    case 'table':
      return '#1e293b'; // slate-800
    case 'annotation':
      return '#075985'; // brand-800 (no inline label; declared for parity)
    case 'link-card':
      return '#1e293b'; // slate-800 — card title text
  }
}

export function defaultTextAlign(element: BoxedElement): { x: TextAlignX; y: TextAlignY } {
  if (element.type === 'sticky') return { x: 'left', y: 'top' };
  return { x: 'center', y: 'middle' };
}

// Default fill / stroke colours per boxed element type. Used when the element
// doesn't override them with explicit `fillColor` / `strokeColor` fields.
// Hex strings so they can also seed the colour picker UI.
export function defaultFillColor(element: BoxedElement): string {
  switch (element.type) {
    case 'shape':
      return '#f0f9ff'; // brand-50
    case 'sticky':
      return '#fef3c7'; // amber-100
    case 'text':
      return 'transparent';
    case 'image':
      return 'transparent';
    case 'freehand':
      // Closed freehand paths fill with a faint brand tint to match
      // the shape default; open paths render stroke-only so the
      // fill is visually inert there.
      return '#f0f9ff';
    case 'table':
      return 'transparent';
    case 'annotation':
      return '#e0f2fe'; // brand-100 — a touch deeper than a shape so the marker reads as a chip
    case 'link-card':
      return '#ffffff'; // white card surface
  }
}

export function defaultStrokeColor(element: BoxedElement): string {
  switch (element.type) {
    case 'shape':
      return '#0ea5e9'; // brand-500
    case 'sticky':
      return '#fde68a'; // amber-200
    case 'text':
      return 'transparent';
    case 'image':
      return 'transparent';
    case 'freehand':
      return '#0ea5e9'; // brand-500, same accent as shapes
    case 'table':
      return '#94a3b8'; // slate-400 grid lines
    case 'annotation':
      return '#0ea5e9'; // brand-500 — ring + note glyph tint
    case 'link-card':
      return '#e2e8f0'; // slate-200 — card border
  }
}

export function supportsColours(element: Element): boolean {
  return (
    element.type === 'shape' ||
    element.type === 'sticky' ||
    element.type === 'arrow' ||
    element.type === 'freehand' ||
    element.type === 'table' ||
    element.type === 'annotation' ||
    element.type === 'link-card'
  );
}

// Whether the element renders a stroke thickness + dash pattern
// (the Border accordion's strength + pattern rows). Same surface
// is used by both the per-element setters (useElementStyle) and the
// `paletteSelection.borderStroke / borderStyle` Canvas derivation;
// every consumer keying off "is this element border-styleable" goes
// through here, so a future element variant that paints a stroke
// only needs to be added in one place (was four before this
// predicate landed).
//
// Type-predicate (`element is ShapeElement | FreehandElement`) so
// callers get TypeScript narrowing too: the `strokeWidth` / `strokeStyle`
// fields are typed as BorderStroke / BorderStyle on these two,
// distinct from ArrowElement's `strokeWidth: number` (raw px). A
// non-narrowing predicate would let setters that write a BorderStroke
// land on arrows, which TS would (correctly) reject.
export function supportsBorder(element: Element): element is ShapeElement | FreehandElement {
  return element.type === 'shape' || element.type === 'freehand';
}

// Whether the element exposes the Border CONTROLS (strength / pattern /
// radius) in the editor UI — distinct from supportsBorder, which also gates
// stroke-field writes + type narrowing. A boolean visibility gate: it adds
// tables (which carry borders) and drops the `actor`, a stick figure with no
// enclosing outline for which a border is meaningless.
export function supportsBorderControls(element: Element): boolean {
  if (element.type === 'table') return true;
  if (!supportsBorder(element)) return false;
  return !(element.type === 'shape' && element.shape === 'actor');
}

// Whether a shape can carry an INLINE icon beside its label — i.e. whether
// dropping a palette icon on it (or adding one while it's selected) folds
// the glyph INTO it. Regular shapes only: the dedicated `icon` shape IS a
// glyph, and a `frame` is a section container you place elements INSIDE,
// not decorate (spec/09 + spec/38). An icon dropped on those becomes a
// standalone `icon` element instead of attaching. One predicate so all
// three fold paths (palette drag-drop, add-while-selected, drag an
// existing icon onto a shape) agree.
export function acceptsInlineIcon(element: Element): element is ShapeElement {
  return element.type === 'shape' && element.shape !== 'icon' && element.shape !== 'frame';
}

// Whether an element exposes a user-adjustable corner radius. Only the
// free-corner rectangles qualify: the plain square and the browser
// frame, both of which render as a CSS rounded rectangle so a real
// pixel radius applies. Every other shape either bakes its rounding
// into the silhouette (circle / stadium / cloud / actor) or is an SVG
// outline (diamond / cylinder / hexagon / document / parallelogram and
// the monitor / laptop / phone / tablet device frames) where a corner
// radius is meaningless, so the Radius control is hidden for them.
export function supportsBorderRadius(element: Element): element is ShapeElement {
  return element.type === 'shape' && (element.shape === 'square' || element.shape === 'browser');
}

// Default arrow stroke colour when the element has no explicit one set.
// Picked out as a helper so the Selected Element controls can show the
// effective colour in the swatch when no override exists.
export function defaultArrowStrokeColor(): string {
  return 'rgb(51 65 85)'; // slate-700, same as ArrowView's fallback
}
