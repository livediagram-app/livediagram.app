// The element defaults every product's `colors.ts` binds: the colours, padding and alignment an element wears when it
// stores none of its own, and which colour, border and icon controls it offers. One table for every product's kinds
// (a product holds a subset, so an entry for a kind it lacks is never reached). What only one product draws (a
// retired piece's placeholder card, a face of its own) stays in that product's `colors.ts`, which wraps these.
import type { Padding, TextAlignX, TextAlignY } from '@liveworkspace/model-core/basics';
import type { BorderRadius } from '@liveworkspace/model-core/border-style';
import type { CanvasSurface } from './colour-math';
import { isConceptShape } from './concept';
import type { BoxedElement, Element, ShapeElement } from './element';
import { PEN_INK } from './pen-colours';
import { SELF_PAINTING_SHAPES } from './self-painting';
import { ACCENT_BAR_TEXT, isAccentBarShape } from './web-components';

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
    case 'path':
      return 'none';
    case 'table':
      return 'sm';
    case 'annotation':
    case 'article-note':
      return 'none';
    case 'link-card':
    case 'video':
      return 'none';
  }
}

// The green that means FINISHED on the Collaborate cards: a resolved comment
// thread, a done action (docs/specs/012-collaboration/comment-pin.md, action-panel.md). One value, so the
// canvas and the export agree on what done looks like.
export const COLLAB_DONE_COLOR = '#16a34a';

// The ink for dark paper: the blue-slate set of the Default scheme's dark half
// (docs/specs/008-canvas/canvas-and-palette.md): fill a step above the backdrop, a slate-500 stroke
// at 3:1 or better on both, white text. Sticky notes, images, link cards
// and videos are absent on purpose: their colours are their identity, and they
// look the same on any paper.
export const DARK_INK = {
  fill: '#141b26',
  stroke: '#64748b',
  text: '#ffffff',
  // A shade above the shape fill, so a marker still reads as a chip ON a
  // shape rather than a hole in it (the light set does the same, brand-100
  // over brand-50).
  annotationFill: '#1c2533',
} as const;

// The Behaviour elements that look like controls store no colour
// (behaviour-skin.ts); these are their unstyled looks per surface. The
// buttons (mode, session: the timer, vote and poll; picker) wear a real UI
// button's skin, a light card on light paper and a raised slate one on dark,
// never the shape default, so they read as pressable before anyone styles
// them. The reveal cover paints itself; only its outline and label ink follow the paper.
// The Reveal cover's opaque base, from the PAPER under it rather than the
// app's appearance, so a dark theme in light mode still gets a dark cover
// (docs/specs/009-elements/reveal-zone.md "The look"). Shared by the canvas
// face and the headless renderer (exports, the minimap), so the two cannot
// drift: the renderer once hard-coded the light base and drew a white cover
// on a dark canvas's map.
export const REVEAL_COVER_BASE: Record<CanvasSurface, string> = {
  light: '#f1f5f9',
  dark: '#172131',
};
/** A control's skin on light paper: a real UI button's light card. */
export const CONTROL_SKIN_LIGHT = { fill: '#ffffff', stroke: '#cbd5e1', text: '#0f172a' } as const;
const CONTROL_SKIN_DARK = { fill: '#1e293b', stroke: '#475569', text: '#f1f5f9' } as const;
/** The outline and label ink of a piece that paints its own face, on light paper. */
export const OUTLINE_SKIN_LIGHT = { stroke: '#94a3b8', text: '#0f172a' } as const;

/** The three default colours of an element. */
export type ElementSkin = { fill: string; stroke: string; text: string };

function behaviourSkin(element: BoxedElement, surface: CanvasSurface): ElementSkin | null {
  if (element.type !== 'shape') return null;
  const kind = element.shape;
  if (kind === 'mode-button' || kind === 'session-button' || kind === 'picker') {
    return surface === 'dark' ? CONTROL_SKIN_DARK : CONTROL_SKIN_LIGHT;
  }
  if (kind === 'reveal') {
    if (surface === 'dark') {
      return { fill: 'transparent', stroke: DARK_INK.stroke, text: DARK_INK.text };
    }
    // The reveal cover's stroke is its ACCENT (docs/specs/009-elements/reveal-zone.md "The look"), so on
    // light paper it takes the shape accent.
    return { fill: 'transparent', stroke: '#0ea5e9', text: OUTLINE_SKIN_LIGHT.text };
  }
  return null;
}

export function defaultTextColor(element: BoxedElement, surface: CanvasSurface = 'light'): string {
  const skin = behaviourSkin(element, surface);
  if (skin) return skin.text;
  // Text with no colour of its own is written in Ink, on every theme and in either editor mode
  // (docs/specs/007-editor/editor-modes.md "One look").
  if (element.type === 'text') return PEN_INK[surface];
  // An accent-bar web component (docs/specs/009-elements/web-components-and-no-groups.md) writes white on its bar, on any
  // paper: the bar is the accent, not the surface.
  if (element.type === 'shape' && isAccentBarShape(element.shape)) return ACCENT_BAR_TEXT;
  if (surface === 'dark') {
    switch (element.type) {
      case 'shape':
      case 'image':
      case 'freehand':
      case 'path':
      case 'table':
      case 'annotation':
        return DARK_INK.text;
      case 'sticky':
      case 'link-card':
      case 'video':
      case 'article-note':
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
    case 'path':
      return '#1e293b'; // slate-800 (no inline label today, future-proof)
    case 'table':
      return '#1e293b'; // slate-800
    case 'annotation':
      return '#075985'; // brand-800 (no inline label; declared for parity)
    case 'article-note':
      return '#1e293b'; // slate-800 (no inline label; declared for parity)
    case 'link-card':
      return '#1e293b'; // slate-800: card title text
    case 'video':
      return '#e2e8f0'; // slate-200: caption over the dark player surface
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
export function unpaintedShapeInk(surface: CanvasSurface): ElementSkin {
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
  // A frame is a section BACKDROP you place elements inside (docs/specs/008-canvas/canvas-and-palette.md), so with
  // no explicit fill it is see-through on either surface, whatever the shape
  // default would be. It is still fillable: set `fillColor` and the frame
  // paints that behind its contents, which is safe because frames sort to the
  // front of their band and therefore paint below their band-mates (layers.ts).
  //
  // This used to be hardcoded as `fill="none"` in the canvas renderer instead,
  // which had two consequences: a background colour picked in the context menu
  // did nothing, and the headless renderer (exports, the minimap) never got
  // the memo and filled every frame with the shape default, so a frame that
  // was transparent on the canvas exported pale blue.
  // A boundary's face paints its tint, deeper as it nests (docs/specs/009-elements/boundary.md).
  // A stack is a target to drop into, drawn as an outline (docs/specs/009-elements/stack.md).
  if (
    element.type === 'shape' &&
    (element.shape === 'frame' || element.shape === 'boundary' || element.shape === 'stack')
  )
    return 'transparent';
  const skin = behaviourSkin(element, surface);
  if (skin) return skin.fill;
  if (surface === 'dark') {
    switch (element.type) {
      case 'shape':
      case 'freehand':
        return DARK_INK.fill;
      case 'annotation':
        return DARK_INK.annotationFill;
      case 'text':
      case 'image':
      case 'table':
      case 'sticky':
      case 'link-card':
      case 'video':
      case 'path':
      case 'article-note':
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
    // A path is plain ink, unfilled until a fill is chosen (docs/specs/023-draw-mode/path-tool.md "Style").
    case 'path':
      return 'transparent';
    case 'freehand':
      // Closed freehand paths fill with a faint brand tint to match
      // the shape default; open paths render stroke-only so the
      // fill is visually inert there.
      return '#f0f9ff';
    case 'table':
      return 'transparent';
    case 'annotation':
      return '#e0f2fe'; // brand-100: a touch deeper than a shape so the marker reads as a chip
    case 'article-note':
      return 'transparent'; // the margin note's chip paints its own colours
    case 'link-card':
      return '#ffffff'; // white card surface
    case 'video':
      return '#0f172a'; // slate-900: a player letterboxes against black, not white
  }
}

export function defaultStrokeColor(
  element: BoxedElement,
  surface: CanvasSurface = 'light',
): string {
  const skin = behaviourSkin(element, surface);
  if (skin) return skin.stroke;
  // A pen stroke with no colour of its own is drawn in Ink (docs/specs/007-editor/editor-modes.md
  // "One look"); a highlighter keeps its own recipe.
  if (element.type === 'freehand' && element.pen !== 'highlighter') return PEN_INK[surface];
  if (surface === 'dark') {
    switch (element.type) {
      case 'shape':
      case 'freehand':
      case 'path':
      case 'table':
      case 'annotation':
        return DARK_INK.stroke;
      case 'text':
      case 'image':
      case 'sticky':
      case 'link-card':
      case 'video':
      case 'article-note':
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
    case 'path':
      return '#0ea5e9'; // brand-500, same accent as shapes
    case 'table':
      return '#94a3b8'; // slate-400 grid lines
    case 'annotation':
      return '#0ea5e9'; // brand-500: ring + note glyph tint
    case 'article-note':
      return 'transparent'; // the margin note's chip paints its own border
    case 'link-card':
      return '#e2e8f0'; // slate-200: card border
    case 'video':
      return '#1e293b'; // slate-800: a hairline barely off the player surface
  }
}

// Whether an element exposes a BACKGROUND colour control. Text and images
// have no fill to expose; everything else does, including a frame, whose fill
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
  // A stored tab window draws its own still frame (docs/specs/009-elements/tab-window.md, retired).
  if (element.type === 'shape' && element.shape === 'tab-window') return false;
  return element.type !== 'text' && element.type !== 'image';
}

// Whether an element has a HEADING area distinct from its body, and so
// exposes a heading-background control: a table's header row and a lane's
// title gutter (docs/specs/009-elements/lane.md). Everything else is one surface.
export function hasHeadingBand(element: Element): boolean {
  if (element.type === 'table') return true;
  return element.type === 'shape' && element.shape === 'lane';
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
  // An instance's colours are its main's; it changes them through Overrides (docs/specs/009-elements/components.md).
  if (element.type === 'shape' && element.shape === 'instance') return false;
  return (
    element.type === 'shape' ||
    // A text element is its words (docs/specs/008-canvas/canvas-and-palette.md "Text element"):
    // the Colours category shows only its Text row (no fill, no border).
    element.type === 'text' ||
    element.type === 'sticky' ||
    element.type === 'arrow' ||
    element.type === 'freehand' ||
    element.type === 'path' ||
    element.type === 'table' ||
    element.type === 'annotation' ||
    element.type === 'link-card' ||
    element.type === 'video'
  );
}

/** The elements that draw a border: a shape, a pen stroke and a path. */
export type BorderedElement<E extends Element> = Extract<
  E,
  { type: 'shape' | 'freehand' | 'path' }
>;

// Whether the element renders a stroke thickness + dash pattern
// (the Border accordion's strength + pattern rows). Same surface
// is used by both the per-element setters (useElementStyle) and the
// `paletteSelection.borderStroke / borderStyle` Canvas derivation;
// every consumer keying off "is this element border-styleable" goes
// through here, so a future element variant that paints a stroke
// only needs to be added in one place (was four before this
// predicate landed).
//
// Type-predicate so callers get TypeScript narrowing too: the `strokeWidth` / `strokeStyle`
// fields are typed as BorderStroke / BorderStyle on these, distinct from
// ArrowElement's `strokeWidth: number` (raw px). A non-narrowing predicate
// would let setters that write a BorderStroke land on arrows, which TS would
// (correctly) reject.
export function supportsBorder<E extends Element>(element: E): element is BorderedElement<E> {
  return element.type === 'shape' || element.type === 'freehand' || element.type === 'path';
}

// Whether the element exposes the Border CONTROLS (strength / pattern /
// radius) in the editor UI: distinct from supportsBorder, which also gates
// stroke-field writes + type narrowing. A boolean visibility gate: it adds
// tables (which carry borders) and drops the shapes that draw their own body.
// The shape kinds that draw their own body (no border, no background, no border controls): one table for every
// product, @liveworkspace/element-model/self-painting.
export { SELF_PAINTING_SHAPES };

export function supportsBorderControls(element: Element): boolean {
  if (element.type === 'table') return true;
  if (!supportsBorder(element)) return false;
  return !(element.type === 'shape' && SELF_PAINTING_SHAPES.has(element.shape));
}

/** A product's kinds that draw a face of their own (the collaboration cards, the buttons, the picker...), whose face
 *  never renders an inline icon. A product with none passes nothing. */
export type OwnFace = (kind: string) => boolean;
const NO_OWN_FACE: OwnFace = () => false;

// Kinds that take an inline icon but place it themselves, so its position (`iconPosition`) is not the user's to set:
// a card's media slot and a callout's badge (docs/specs/009-elements/card.md), a header's logo, a boundary's tab
// (docs/specs/009-elements/boundary.md). Their Icon position controls would write a field nothing reads.
const SELF_PLACED_ICON_SHAPES: ReadonlySet<string> = new Set([
  'card',
  'callout',
  'site-header',
  'boundary',
]);

/** Whether a shape's inline icon goes where `iconPosition` says, so offering that choice does something. */
export function positionsInlineIcon(element: Element, ownFace: OwnFace = NO_OWN_FACE): boolean {
  return acceptsInlineIcon(element, ownFace) && !SELF_PLACED_ICON_SHAPES.has(element.shape);
}

// The kinds whose own face never draws an inline icon: a badge or step number (chip.ts, its number or text), a concept
// graphic (its rows), a sequence diagram, a Diagram key, a tab window, an instance (its main's face), and a mind node
// drawn as a person (its initials). The chip kinds are named here rather than read from chip.ts, which imports this.
function drawsNoInlineIcon(element: ShapeElement): boolean {
  return (
    element.shape === 'badge' ||
    element.shape === 'step' ||
    isConceptShape(element.shape) ||
    element.shape === 'sequence' ||
    element.shape === 'diagram-key' ||
    element.shape === 'tab-window' ||
    element.shape === 'instance' ||
    (element.shape === 'mind-node' && element.mindLook === 'person')
  );
}

// Whether a shape can carry an INLINE icon beside its label, i.e. whether
// dropping a palette icon on it (or adding one while it's selected) folds
// the glyph INTO it. Regular shapes only: the dedicated `icon` shape IS a
// glyph, and a `frame` or `stack` is a container you place elements INSIDE,
// not decorate (docs/specs/008-canvas/canvas-and-palette.md, docs/specs/009-elements/stack.md). An icon dropped on
// those becomes a standalone `icon` element instead of attaching. One predicate so all
// three fold paths (palette drag-drop, add-while-selected, drag an
// existing icon onto a shape) agree.
//
// Of the web components (docs/specs/009-elements/web-components-and-no-groups.md), the header takes the icon as its logo
// and the callout as its badge glyph; the banner, stat row and process have
// nowhere to put one, so an icon dropped on them stands alone.
//
// Nor do a product's elements that draw their own face (`ownFace`): their face never renders an inline icon, so one
// folded in would be invisible. Dropped on them, it stands alone too.
export function acceptsInlineIcon<E extends Element>(
  element: E,
  ownFace: OwnFace = NO_OWN_FACE,
): element is Extract<E, { type: 'shape' }> {
  return (
    element.type === 'shape' &&
    !ownFace(element.shape) &&
    // Faces drawn whole, with no place for an icon: a dropped one would vanish (docs/specs/009-elements).
    !drawsNoInlineIcon(element) &&
    element.shape !== 'icon' &&
    element.shape !== 'sticker' &&
    element.shape !== 'frame' &&
    element.shape !== 'stack' &&
    element.shape !== 'banner' &&
    element.shape !== 'stat-row' &&
    element.shape !== 'process' &&
    // A quote's portrait (livedocuments) is its media; an icon dropped on it stands alone.
    element.shape !== 'quote'
  );
}

// Whether an element exposes a user-adjustable corner radius. Only the
// free-corner rectangles qualify: the plain square and the browser
// frame, both of which render as a CSS rounded rectangle so a real
// pixel radius applies. Every other shape either bakes its rounding
// into the silhouette (circle / stadium / cloud / actor) or is an SVG
// outline (diamond / cylinder / hexagon / document / parallelogram and
// the monitor / laptop / phone / tablet device frames) where a corner
// radius is meaningless, so the Radius control is hidden for them.
//
// The web components with a rectangular surface (docs/specs/009-elements/web-components-and-no-groups.md) take it too: the
// banner and header bar, the callout card, and each of a stat row's cards.
//
// So does a mind node (docs/specs/009-elements/mind-node.md "Round nodes"): a CSS box like the
// square, whose corner the canvas and the export both read from `borderRadius`.
export function supportsBorderRadius<E extends Element>(
  element: E,
): element is Extract<E, { type: 'shape' }> {
  return element.type === 'shape' && RADIUS_SHAPES.has(element.shape);
}
const RADIUS_SHAPES = new Set<string>([
  'square',
  'browser',
  'banner',
  'callout',
  'card',
  'site-header',
  'stat-row',
  'mind-node',
  // livedocuments' quote card (docs/specs/009-elements/quote.md).
  'quote',
]);

// The corner preset the Radius control highlights: the element's own, else the preset nearest
// its kind's default corner (docs/specs/008-canvas/corner-radius.md). A mind node's 12 px default
// is Medium; every other kind shows Small.
export function shownBorderRadius(element: ShapeElement): BorderRadius {
  return element.borderRadius ?? (element.shape === 'mind-node' ? 'md' : 'sm');
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
