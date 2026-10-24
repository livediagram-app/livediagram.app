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
import type { BorderRadius } from '@liveworkspace/document-core/border-style';
import { ACCENT_BAR_TEXT, isAccentBarShape } from './web-components';
import { PEN_INK } from './pen-colours';
import { isConceptShape } from './concept';

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
    case 'article-note':
      return 'none';
    case 'link-card':
    case 'video':
      return 'none';
  }
}

// --- Colour derivation ----------------------------------------------------

// Standard hex → rgb / rgb → hex / brightness math used to derive colours
// for new elements when the tab background or pattern colour has been
// customised. Failsafe: returns design defaults on unparseable input.

export type RGB = { r: number; g: number; b: number };

// `#rrggbb` (the `#` optional) to 0-255 channels, or null for anything else
// (shorthand, a CSS name, an rgb() string). The one hex parser: callers that
// know their input is a catalogue hex assert it rather than re-parsing.
export function hexToRgb(hex: string): RGB | null {
  const m = /^#?([a-fA-F\d]{2})([a-fA-F\d]{2})([a-fA-F\d]{2})$/.exec(hex);
  if (!m) return null;
  return { r: parseInt(m[1]!, 16), g: parseInt(m[2]!, 16), b: parseInt(m[3]!, 16) };
}

// WCAG 2.2 SC 1.4.3: the minimum contrast for normal-size text (AA).
export const MIN_TEXT_CONTRAST = 4.5;

// WCAG 2.2 contrast ratio of two `#rrggbb` colours, in [1, 21] and
// order-independent. NaN for any other input, so a `>=` threshold check
// can never pass on a colour it could not read.
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  if (la === null || lb === null) return NaN;
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function relativeLuminance(hex: string): number | null {
  if (!hex.startsWith('#')) return null;
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

// Channels back to `#rrggbb`, rounded and clamped into 0-255 first.
export function rgbToHex({ r, g, b }: RGB): string {
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

// Hex-level tint (mix toward white) / shade (toward black) by `amount`
// in 0..1. Used to spin a single theme hue into a light → base → dark
// ramp for the colour-picker presets so the user has several on-theme
// versions to apply without opening the full swatch. Failsafe: returns
// the input unchanged on unparseable hex.
export function tint(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  return rgb ? rgbToHex(mixWithWhite(rgb, amount)) : hex;
}

export function shade(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  return rgb ? rgbToHex(darken(rgb, amount)) : hex;
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

// Whichever of a dark and a light ink contrasts more with `fill`. A brightness cut-off (isLightColor) gave mid-tones
// light text they could not carry (orange, #f97316, at 2.6:1 under slate-100 where slate-800 reads 5.4:1); off the
// mid-tones the two rules agree. An unparseable colour reads as light, as isLightColor has it, so it takes the dark ink.
export function bestInk(fill: string, dark: string, light: string): string {
  if (!hexToRgb(fill)) return dark;
  return contrastRatio(dark, fill) >= contrastRatio(light, fill) ? dark : light;
}

// For new text elements: a label colour that contrasts with the bg (slate-800 or slate-100).
export function deriveTextColorForBg(backgroundColor: string): string {
  return bestInk(backgroundColor, '#1e293b', '#f1f5f9');
}

// Which paper an element is being drawn on. NOT the same thing as the
// viewer's Appearance (docs/specs/007-editor/editor-app.md): a Midnight-schemed tab is dark paper in
// light chrome, and the Default scheme is whichever paper the viewer's
// appearance resolves to. The element defaults below take it because an
// element with no colour of its own has nothing else to read — and a Default
// tab deliberately stores no element colours, so this IS the colour.
export type CanvasSurface = 'light' | 'dark';

/** The paper a canvas colour amounts to. Unset / unparseable is the white default. */
export function canvasSurface(backgroundColor: string | undefined | null): CanvasSurface {
  if (!backgroundColor || !backgroundColor.startsWith('#')) return 'light';
  return isLightColor(backgroundColor) ? 'light' : 'dark';
}

// The ink that reads on a SOLID fill of `color`: whichever of white and the app's near-black reads better
// (bestInk), so a pale theme accent never carries white text.
export function inkOn(color: string): string {
  return bestInk(color, '#0f172a', '#ffffff');
}

// The ink for dark paper: the blue-slate set of the Default scheme's dark half
// (docs/specs/008-canvas/canvas-and-palette.md) — fill a step above the backdrop, a slate-500 stroke
// at 3:1 or better on both, white text. Sticky notes, images, link cards
// and videos are absent on purpose: their colours are their identity, and they
// look the same on any paper.
export const DARK_INK = {
  fill: '#141b26',
  stroke: '#64748b',
  text: '#ffffff',
} as const;

export function defaultTextColor(element: BoxedElement, surface: CanvasSurface = 'light'): string {
  // Text with no colour of its own is written in Ink, on every theme
  // (docs/specs/008-canvas/canvas-and-palette.md "Colours").
  if (element.type === 'text') return PEN_INK[surface];
  // An accent-bar web component (docs/specs/009-elements/web-components-and-no-groups.md) writes white on its bar, on any
  // paper: the bar is the accent, not the surface.
  if (element.type === 'shape' && isAccentBarShape(element.shape)) return ACCENT_BAR_TEXT;
  if (surface === 'dark') {
    switch (element.type) {
      case 'shape':
      case 'image':
      case 'freehand':
      case 'table':
        return DARK_INK.text;
      case 'sticky':
      case 'article-note':
      case 'link-card':
      case 'video':
        break; // keeps its own ink on any paper
    }
  }
  switch (element.type) {
    case 'shape':
      return '#075985'; // brand-800
    case 'sticky':
      return '#451a03'; // amber-950-ish
    case 'image':
      return '#1e293b'; // slate-800 (only used for alt-text rendering)
    case 'freehand':
      return '#1e293b'; // slate-800 (no inline label today, future-proof)
    case 'table':
      return '#1e293b'; // slate-800
    case 'article-note':
      return '#1e293b'; // slate-800 (no inline label; declared for parity)
    case 'link-card':
      return '#1e293b'; // slate-800 — card title text
    case 'video':
      return '#e2e8f0'; // slate-200 — caption over the dark player surface
  }
}

// The ink a plain shape wears when it carries no colour of its own, on the
// given paper: what the Default scheme's elements look like, and so what a
// "theme default" swatch shows there (docs/specs/008-canvas/quick-style-panel.md).
const PLAIN_SHAPE: ShapeElement = {
  id: '',
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 0,
  height: 0,
};
export function unpaintedShapeInk(surface: CanvasSurface): {
  fill: string;
  stroke: string;
  text: string;
} {
  return {
    fill: defaultFillColor(PLAIN_SHAPE, surface),
    stroke: defaultStrokeColor(PLAIN_SHAPE, surface),
    text: defaultTextColor(PLAIN_SHAPE, surface),
  };
}

export function defaultTextAlign(element: BoxedElement): { x: TextAlignX; y: TextAlignY } {
  if (element.type === 'sticky') return { x: 'left', y: 'top' };
  return { x: 'center', y: 'middle' };
}

// Default fill / stroke colours per boxed element type. Used when the element
// doesn't override them with explicit `fillColor` / `strokeColor` fields.
// Hex strings so they can also seed the colour picker UI.
export function defaultFillColor(element: BoxedElement, surface: CanvasSurface = 'light'): string {
  // A stack is a target to drop into, drawn as an outline (docs/specs/009-elements/stack.md): see-through
  // with no explicit fill, on either surface.
  if (element.type === 'shape' && element.shape === 'stack') return 'transparent';
  if (surface === 'dark') {
    switch (element.type) {
      case 'shape':
      case 'freehand':
        return DARK_INK.fill;
      case 'text':
      case 'article-note':
      case 'image':
      case 'table':
      case 'sticky':
      case 'link-card':
      case 'video':
        break; // transparent, or a fill that is the element's identity
    }
  }
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
    case 'article-note':
      return 'transparent'; // the margin note's chip paints its own colours
    case 'link-card':
      return '#ffffff'; // white card surface
    case 'video':
      return '#0f172a'; // slate-900 — a player letterboxes against black, not white
  }
}

export function defaultStrokeColor(
  element: BoxedElement,
  surface: CanvasSurface = 'light',
): string {
  // A pen stroke with no colour of its own is drawn in Ink; a highlighter keeps its own recipe.
  if (element.type === 'freehand' && element.pen !== 'highlighter') return PEN_INK[surface];
  if (surface === 'dark') {
    switch (element.type) {
      case 'shape':
      case 'freehand':
      case 'table':
        return DARK_INK.stroke;
      case 'text':
      case 'article-note':
      case 'image':
      case 'sticky':
      case 'link-card':
      case 'video':
        break; // transparent, or a border that is the element's identity
    }
  }
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
    case 'article-note':
      return 'transparent'; // the margin note's chip paints its own border
    case 'link-card':
      return '#e2e8f0'; // slate-200 — card border
    case 'video':
      return '#1e293b'; // slate-800 — a hairline barely off the player surface
  }
}

// Whether an element exposes a BACKGROUND colour control. Text and images
// have no fill to expose; everything else does, including a stack, whose fill
// merely defaults to transparent.
//
// Call sites used to ask `defaultFillColor(el) !== 'transparent'` as a proxy
// for this, which was the same question right up until a fillable element
// defaulted to transparent, at which point the proxy hid the very control
// that would set it.
export function supportsFillColor(element: Element): boolean {
  if (!supportsColours(element)) return false;
  // An icon is a glyph, not a box: the wrapper is in SELF_PAINTING_SHAPES, so
  // it paints no background, and neither icon renderer reads fillColor (a
  // Technology mark carries its own tile, a line-art glyph is stroke-tinted).
  // The control was inert on both, and picking a colour still wrote to the
  // element, autosaved, logged a change and broadcast an op for nothing.
  if (element.type === 'shape' && element.shape === 'icon') return false;
  // A tab window's ground is the paper of the tab it shows (docs/specs/009-elements/tab-window.md).
  if (element.type === 'shape' && element.shape === 'tab-window') return false;
  return element.type !== 'text' && element.type !== 'image';
}

// Whether an element has a HEADING area distinct from its body, and so
// exposes a heading-background control: a table's header row. Everything else is one surface.
export function hasHeadingBand(element: Element): boolean {
  return element.type === 'table';
}

export function supportsColours(element: Element): boolean {
  // A sticker's colours are the sticker (docs/specs/010-palette/stickers.md): a green APPROVED that
  // could be recoloured violet would be a worse APPROVED, and there is no
  // fill or stroke on a die-cut plate to expose anyway.
  if (element.type === 'shape' && element.shape === 'sticker') return false;
  // A code block is an editor window (docs/specs/009-elements/code-block.md): it paints its card from its
  // own colour scheme and ignores fill / stroke / theme entirely, so every
  // swatch in the Colours category was inert on one. Picking a scheme is the
  // control it actually has (Presets, see code-themes.ts).
  if (element.type === 'shape' && element.shape === 'code-block') return false;
  return (
    element.type === 'shape' ||
    // A text element is its words (docs/specs/008-canvas/canvas-and-palette.md "Text element"):
    // the Colours category shows only its Text row (no fill, no border).
    element.type === 'text' ||
    element.type === 'sticky' ||
    element.type === 'arrow' ||
    element.type === 'freehand' ||
    element.type === 'table' ||
    element.type === 'link-card' ||
    element.type === 'video'
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
// Shape kinds that DRAW THEIR OWN BODY, so the wrapper carries no border or
// background and every border control is dead for them. One list, exported,
// because the renderer and the menu were each keeping their own and drifted:
// the menu still offered Border on a code block and a checklist long after the
// renderer stopped painting one.
//
// Icons and stickers are here for a different reason — a glyph and a die-cut
// plate have no enclosing outline to stroke — but the outcome is the same, so
// they share the predicate rather than a second condition.
export const SELF_PAINTING_SHAPES = new Set<string>([
  // Badge and Step number (docs/specs/009-elements/badge.md): the face paints the pill / disc in its look.
  'badge',
  'step',
  // Concept graphics (docs/specs/009-elements/concept-graphics.md): rows, tiers and discs, no box.
  'layer-stack',
  'pyramid',
  'cycle',
  'hub',
  'onion',
  'chevrons',
  'icon',
  // A sticker paints its own plate, shadow and content (docs/specs/010-palette/stickers.md).
  'sticker',
  // Progress bar / ring: ProgressView draws the track and the fill itself with
  // its own hardcoded arc stroke, and never reads the element's strokeWidth or
  // strokeStyle. They were the drift this list was created to stop, recurring:
  // added to isSelfDrawingShape and not here, so the Border accordion kept
  // offering Strength and Pattern on them. Not merely inert — the pick was
  // committed, so it wrote to the element, autosaved and broadcast an op to every peer in the room, for no visual change
  // at any zoom.
  'progress-bar',
  'progress-ring',
  'timeline-rail',
  'rating',
  'pie-chart',
  'bar-chart',
  'line-chart',
  'code-block',
  'checklist',
  // Legend (docs/specs/009-elements/pie-chart.md): LegendView paints its own card and rows.
  'legend',
  // Sankey (docs/specs/009-elements/sankey.md): nodes and bands, coloured per node; no box to stroke.
  'sankey',
  // A tab window (docs/specs/009-elements/tab-window.md) draws its own rounded frame round the tab it shows.
  'tab-window',
  // Web components (docs/specs/009-elements/web-components-and-no-groups.md) that lay out their own surfaces: an accent bar
  // (banner, header), a row of cards, circles and connectors. A callout is
  // NOT here: its card is an ordinary bordered box with content inside.
  'banner',
  'site-header',
  'stat-row',
  'process',
]);

export function supportsBorderControls(element: Element): boolean {
  if (element.type === 'table') return true;
  if (!supportsBorder(element)) return false;
  return !(element.type === 'shape' && SELF_PAINTING_SHAPES.has(element.shape));
}

// Whether a shape can carry an INLINE icon beside its label — i.e. whether
// dropping a palette icon on it (or adding one while it's selected) folds
// the glyph INTO it. Regular shapes only: the dedicated `icon` shape IS a
// glyph, and a `stack` is a container you place elements INSIDE, not
// decorate (docs/specs/009-elements/stack.md). An icon dropped on those becomes a
// standalone `icon` element instead of attaching. One predicate so all
// three fold paths (palette drag-drop, add-while-selected, drag an
// existing icon onto a shape) agree.
//
// Of the web components (docs/specs/009-elements/web-components-and-no-groups.md), the header takes the icon as its logo
// and the callout as its badge glyph; the banner, stat row and process have
// nowhere to put one, so an icon dropped on them stands alone.

// Kinds that take an inline icon but place it themselves, so its position (`iconPosition`) is not the user's to set:
// a card's media slot and a callout's badge (docs/specs/009-elements/card.md), a header's logo. Their Icon position
// controls would write a field nothing reads.
const SELF_PLACED_ICON_SHAPES: ReadonlySet<string> = new Set(['card', 'site-header']);

/** Whether a shape's inline icon goes where `iconPosition` says, so offering that choice does something. */
export function positionsInlineIcon(element: Element): boolean {
  return acceptsInlineIcon(element) && !SELF_PLACED_ICON_SHAPES.has(element.shape);
}

// The kinds whose own face never draws an inline icon: a badge or step number (chip.ts, its number or text), a concept
// graphic (its rows) and a tab window.
// The chip kinds are named here rather than read from chip.ts, which imports this file.
function drawsNoInlineIcon(element: ShapeElement): boolean {
  return (
    element.shape === 'badge' ||
    element.shape === 'step' ||
    isConceptShape(element.shape) ||
    element.shape === 'tab-window'
  );
}

export function acceptsInlineIcon(element: Element): element is ShapeElement {
  return (
    element.type === 'shape' &&
    // Faces drawn whole, with no place for an icon: a dropped one would vanish (docs/specs/009-elements).
    !drawsNoInlineIcon(element) &&
    element.shape !== 'icon' &&
    element.shape !== 'sticker' &&
    element.shape !== 'stack' &&
    element.shape !== 'banner' &&
    element.shape !== 'stat-row' &&
    element.shape !== 'process'
  );
}

// Whether an element exposes a user-adjustable corner radius. Only the
// free-corner rectangles qualify: the plain square and the browser
// frame, both of which render as a CSS rounded rectangle so a real
// pixel radius applies. Every other shape either bakes its rounding
// into the silhouette (circle / stadium / cloud) or is an SVG
// outline (diamond / cylinder / hexagon / document / parallelogram and
// the monitor / laptop / phone / tablet device frames) where a corner
// radius is meaningless, so the Radius control is hidden for them.
//
// The web components with a rectangular surface (docs/specs/009-elements/web-components-and-no-groups.md) take it too: the
// banner and header bar, the callout card, and each of a stat row's cards.

export function supportsBorderRadius(element: Element): element is ShapeElement {
  return element.type === 'shape' && RADIUS_SHAPES.has(element.shape);
}
const RADIUS_SHAPES = new Set<string>([
  'square',
  'browser',
  'banner',
  'card',
  'site-header',
  'stat-row',
]);

// The corner preset the Radius control highlights: the element's own, else the preset nearest
// its kind's default corner (docs/specs/008-canvas/corner-radius.md): Small.
export function shownBorderRadius(element: ShapeElement): BorderRadius {
  return element.borderRadius ?? 'sm';
}

// Default arrow stroke colour when the element has no explicit one set.
// Picked out as a helper so the Selected Element controls can show the
// effective colour in the swatch when no override exists.
export function defaultArrowStrokeColor(surface: CanvasSurface = 'light'): string {
  if (surface === 'dark') return DARK_INK.stroke; // matches the shapes it connects
  return 'rgb(51 65 85)'; // slate-700, same as ArrowView's fallback
}

// slate-400: on dark paper an uncoloured arrow's caption is a step lighter than
// its line, so the words read before the wire.
const DARK_ARROW_LABEL_COLOR = '#94a3b8';

// The colour an arrow caption is painted in, for the canvas and the export
// alike. A caption with its own colour keeps it; otherwise it follows the line,
// except an uncoloured arrow on dark paper, whose caption is DARK_ARROW_LABEL_COLOR.
export function defaultArrowLabelColor(
  arrow: { strokeColor?: string; textColor?: string },
  surface: CanvasSurface = 'light',
): string {
  if (arrow.textColor) return arrow.textColor;
  if (arrow.strokeColor) return arrow.strokeColor;
  return surface === 'dark' ? DARK_ARROW_LABEL_COLOR : defaultArrowStrokeColor(surface);
}
