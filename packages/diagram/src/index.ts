// Shared domain types for diagrams. Consumed by the live app's canvas today,
// and (later) by the persistence store, API workers, and any other code that
// handles diagram data. See specs/05-diagram-structure.md and
// specs/09-canvas-and-command-palette.md.

// Documentary type aliases for ids that internal helpers thread
// around. Not exported because no caller outside this package
// imports them by name (they all just use plain `string`); keeping
// them internal lets the public surface stay focused on the rich
// element + tab types below without trailing along three trivial
// `string` aliases.
export type DiagramId = string;
export type TabId = string;
export type ElementId = string;

// --- Shared boxed-element fields ------------------------------------------

export type TextSize = 'scale' | 'sm' | 'md' | 'lg';

// Padding between the element's box and its label. Stored as a t-shirt
// size for round-trip simplicity; the renderer converts to px.
export type Padding = 'none' | 'sm' | 'md' | 'lg';

export const PADDING_PX: Record<Padding, number> = {
  none: 0,
  sm: 6,
  md: 14,
  lg: 24,
};

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
  }
}

export type TextAlignX = 'left' | 'center' | 'right';
export type TextAlignY = 'top' | 'middle' | 'bottom';

export type BackgroundPattern =
  | 'grid'
  | 'blank'
  | 'lines'
  | 'crosshatch'
  | 'graph'
  | 'confetti'
  | 'stripes'
  | 'diagonal'
  | 'waves'
  | 'bricks'
  | 'plus'
  | 'stars';

export const DEFAULT_BACKGROUND_COLOR = '#ffffff';
export const DEFAULT_PATTERN_COLOR = '#cbd5e1'; // slate-300

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
  }
}

export function supportsColours(element: Element): boolean {
  return (
    element.type === 'shape' ||
    element.type === 'sticky' ||
    element.type === 'arrow' ||
    element.type === 'freehand'
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

// Default arrow stroke colour when the element has no explicit one set.
// Picked out as a helper so the Selected Element controls can show the
// effective colour in the swatch when no override exists.
export function defaultArrowStrokeColor(): string {
  return 'rgb(51 65 85)'; // slate-700, same as ArrowView's fallback
}

// --- Shapes ---------------------------------------------------------------

export type ShapeKind =
  | 'square'
  | 'circle'
  | 'diamond'
  | 'cylinder'
  | 'parallelogram'
  | 'hexagon'
  | 'document'
  | 'stadium'
  | 'actor'
  | 'cloud'
  // UI device frames (wireframing). See spec/09 "Devices" accordion.
  | 'browser'
  | 'monitor'
  | 'laptop'
  | 'phone'
  | 'tablet';

export type ShapeElement = {
  id: ElementId;
  type: 'shape';
  shape: ShapeKind;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  locked?: boolean;
  groupId?: ElementId;
  textSize?: TextSize;
  textAlignX?: TextAlignX;
  textAlignY?: TextAlignY;
  // Inline label styling. Each is independent so you can combine
  // bold + italic + underline + strikethrough however you like.
  // Stored on the element (not derived from a className) so saved
  // diagrams round-trip the formatting.
  textBold?: boolean;
  textItalic?: boolean;
  textUnderline?: boolean;
  textStrikethrough?: boolean;
  fillColor?: string;
  strokeColor?: string;
  textColor?: string;
  // Border styling (shapes + stickies). Each is a preset bucket so
  // saved diagrams round-trip without carrying arbitrary numeric
  // values; the renderer maps to pixel widths / SVG dasharrays /
  // border-radius pixels (BORDER_STROKE_PX, BORDER_DASH_ARRAY,
  // BORDER_RADIUS_PX further down).
  strokeWidth?: BorderStroke;
  strokeStyle?: BorderStyle;
  borderRadius?: BorderRadius;
  aspectLocked?: boolean;
  opacity?: number; // 0..1, defaults to 1
  link?: ElementLink;
  commentThread?: CommentThread;
  // Optional plain-text note. Distinct from `commentThread`: one
  // note per element, no author / timestamp / multi-message
  // structure, just a multi-line paragraph the user can leave on
  // any shape / text / sticky to capture private context. Empty
  // string strips the field on commit (see `setNote` in
  // editor-page.tsx) so persisted JSON stays clean.
  note?: string;
  padding?: Padding;
};

// Border styling presets. Keep these as small unions so the
// CommandPalette can render them as 3-to-4-button icon rows that
// match the Pointer accordion's pattern (Line thickness /
// Arrowhead size / etc).
export type BorderStroke = 'none' | 'thin' | 'medium' | 'thick' | 'extra-thick';
export type BorderStyle = 'solid' | 'dashed' | 'dotted';
export type BorderRadius = 'none' | 'sm' | 'md' | 'lg';

export const BORDER_STROKE_PX: Record<BorderStroke, number> = {
  none: 0,
  thin: 1,
  medium: 2,
  thick: 4,
  'extra-thick': 7,
};

// Default for shapes that don't carry a strokeWidth field. Picked to
// match what the renderer was hardcoding before this field existed
// so old diagrams render exactly the same.
export const DEFAULT_BORDER_STROKE: BorderStroke = 'medium';

// Dash patterns in user units, expanded by the renderer with the
// active stroke width so dashes scale with thickness. 'solid' maps
// to no dasharray (omit the attribute) so the default solid stroke
// path stays the same.
export const BORDER_DASH_ARRAY: Record<BorderStyle, string | null> = {
  solid: null,
  dashed: '6 4',
  dotted: '1 3',
};

export const DEFAULT_BORDER_STYLE: BorderStyle = 'solid';

// Corner radius in pixels. Only meaningful on shapes whose silhouette
// has user-visible corners (square / stadium and the device frames);
// the SVG-overlay shapes (diamond, hexagon, cloud etc) ignore it.
export const BORDER_RADIUS_PX: Record<BorderRadius, number> = {
  none: 0,
  sm: 4,
  md: 12,
  lg: 24,
};

// --- Text ------------------------------------------------------------------

export type TextElement = {
  id: ElementId;
  type: 'text';
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  locked?: boolean;
  groupId?: ElementId;
  textSize?: TextSize;
  textAlignX?: TextAlignX;
  textAlignY?: TextAlignY;
  // Inline label styling. Each is independent so you can combine
  // bold + italic + underline + strikethrough however you like.
  // Stored on the element (not derived from a className) so saved
  // diagrams round-trip the formatting.
  textBold?: boolean;
  textItalic?: boolean;
  textUnderline?: boolean;
  textStrikethrough?: boolean;
  fillColor?: string;
  strokeColor?: string;
  textColor?: string;
  aspectLocked?: boolean;
  opacity?: number; // 0..1, defaults to 1
  link?: ElementLink;
  commentThread?: CommentThread;
  // Optional plain-text note. Distinct from `commentThread`: one
  // note per element, no author / timestamp / multi-message
  // structure, just a multi-line paragraph the user can leave on
  // any shape / text / sticky to capture private context. Empty
  // string strips the field on commit (see `setNote` in
  // editor-page.tsx) so persisted JSON stays clean.
  note?: string;
  padding?: Padding;
};

// --- Sticky notes ----------------------------------------------------------

export type StickyElement = {
  id: ElementId;
  type: 'sticky';
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  locked?: boolean;
  groupId?: ElementId;
  textSize?: TextSize;
  textAlignX?: TextAlignX;
  textAlignY?: TextAlignY;
  // Inline label styling. Each is independent so you can combine
  // bold + italic + underline + strikethrough however you like.
  // Stored on the element (not derived from a className) so saved
  // diagrams round-trip the formatting.
  textBold?: boolean;
  textItalic?: boolean;
  textUnderline?: boolean;
  textStrikethrough?: boolean;
  fillColor?: string;
  strokeColor?: string;
  textColor?: string;
  aspectLocked?: boolean;
  opacity?: number; // 0..1, defaults to 1
  link?: ElementLink;
  commentThread?: CommentThread;
  // Optional plain-text note. Distinct from `commentThread`: one
  // note per element, no author / timestamp / multi-message
  // structure, just a multi-line paragraph the user can leave on
  // any shape / text / sticky to capture private context. Empty
  // string strips the field on commit (see `setNote` in
  // editor-page.tsx) so persisted JSON stays clean.
  note?: string;
  padding?: Padding;
};

// --- Images ---------------------------------------------------------------

// See specs/19-images.md. A boxed element that renders user-uploaded
// image bytes inside its bounding box. The bytes themselves live in
// R2 (server-side); the element carries only the opaque id the API
// resolves to a `GET /api/images/<id>` URL, so the diagram payload
// stays small + a future "delete from gallery" can break the
// reference without rewriting every diagram.
export type ImageElement = {
  id: ElementId;
  type: 'image';
  x: number;
  y: number;
  width: number;
  height: number;
  // R2 object key for the uploaded bytes. Null when the user has
  // dropped a placeholder but not yet picked an image: the canvas
  // renders the dashed empty-state thumbnail in that case.
  imageId: string | null;
  // Captured at upload from the file's natural dimensions. Drives
  // the aspect-lock default + the "Reset to natural size" context-
  // menu action; the element's own width/height drive layout.
  naturalWidth?: number;
  naturalHeight?: number;
  // Optional alt text (accessibility + future export-to-markdown).
  // Aliases as the element's `label` so the surrounding "boxed
  // element has a label" code paths (change log, Markdown export,
  // search index) all see the alt text without needing an
  // ImageElement-specific branch.
  alt?: string;
  // Shared boxed-element fields. ImageElement doesn't render text
  // or borders inside the image (the bitmap fills the box), but the
  // shape / sticky / text variants do, and a wide swath of code
  // (change log, format painter, Markdown / canvas export, Editor
  // panel state plumbing in Canvas.tsx) reads these fields off
  // every BoxedElement. Declaring them here as always-undefined
  // optionals keeps the TS union ergonomic without forcing every
  // call site to gate on `el.type !== 'image'`. Setting them on an
  // image is a no-op visually (the renderer ignores them).
  label?: string;
  textSize?: TextSize;
  textAlignX?: TextAlignX;
  textAlignY?: TextAlignY;
  textBold?: boolean;
  textItalic?: boolean;
  textUnderline?: boolean;
  textStrikethrough?: boolean;
  textColor?: string;
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: BorderStroke;
  strokeStyle?: BorderStyle;
  borderRadius?: BorderRadius;
  padding?: Padding;
  locked?: boolean;
  groupId?: ElementId;
  aspectLocked?: boolean;
  opacity?: number;
  link?: ElementLink;
  commentThread?: CommentThread;
  note?: string;
};

// Freehand "pencil tool" element (spec/09 Pencil (freehand)
// subsection). A polyline sampled during a pointer drag, simplified
// + smoothed at commit, rendered as an inline SVG path inside the
// element's bounding box. Points are stored normalised into [0..1]
// across the box so resize scales the path proportionally;
// `closed: true` adds the closing segment + a theme fill (the
// "sketch a custom shape" path) when the user released near where
// they started.
export type FreehandElement = {
  id: ElementId;
  type: 'freehand';
  x: number;
  y: number;
  width: number;
  height: number;
  // Smoothed, normalised polyline. Each point is { nx, ny } in
  // [0, 1] relative to the bounding box's top-left. Two values per
  // sample (not flat-array form) so JSON shape is debuggable.
  points: { nx: number; ny: number }[];
  // True when the path auto-closes (release-near-start). The
  // renderer adds `Z` + a fill; open paths render stroke-only.
  closed: boolean;
  // Shared boxed-element fields, see ImageElement above for the
  // rationale: the union code paths (change log, format painter,
  // export, Editor panel) all read these uniformly. Labels render
  // on top of the SVG path (BoxedElementView), fill / stroke /
  // border-width / border-style follow the Colours + Border
  // accordions, and the rest of the bag (lock, group, opacity,
  // link, comment, note) flows through the generic boxed-element
  // machinery; persisting the fields keeps copy / paste /
  // format-paint symmetrical with the other boxed kinds.
  label?: string;
  textSize?: TextSize;
  textAlignX?: TextAlignX;
  textAlignY?: TextAlignY;
  textBold?: boolean;
  textItalic?: boolean;
  textUnderline?: boolean;
  textStrikethrough?: boolean;
  textColor?: string;
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: BorderStroke;
  strokeStyle?: BorderStyle;
  borderRadius?: BorderRadius;
  padding?: Padding;
  locked?: boolean;
  groupId?: ElementId;
  aspectLocked?: boolean;
  opacity?: number;
  link?: ElementLink;
  commentThread?: CommentThread;
  note?: string;
};

// --- Arrows ----------------------------------------------------------------

export type Anchor = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

export const ALL_ANCHORS: Anchor[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];

export type Endpoint =
  | { kind: 'free'; x: number; y: number }
  | { kind: 'pinned'; elementId: ElementId; anchor: Anchor };

// Cross-tab link on any element. `tab` jumps to another tab on the same
// diagram; `diagram` navigates to a different diagram entirely (with
// the diagram's name cached on the element so the picker / badge can
// show it without a round-trip). Element-specific linking
// (jump-and-focus a specific element) is in the spec but not in the
// UI yet.
export type ElementLink =
  | { kind: 'tab'; tabId: TabId }
  | { kind: 'element'; tabId: TabId; elementId: ElementId }
  | { kind: 'diagram'; diagramId: string; name: string };

// Which endpoint(s) of an arrow get an arrowhead marker. 'to' (default)
// is the conventional one-way arrow; 'from' flips it; 'both' makes a
// two-headed connector. There's no 'none' yet — a line with no
// direction is rare enough to defer.
export type ArrowEnds = 'from' | 'to' | 'both' | 'none';

export type ArrowElement = {
  id: ElementId;
  type: 'arrow';
  from: Endpoint;
  to: Endpoint;
  locked?: boolean;
  // Stroke colour for the line + arrowhead. Falls through to the
  // default arrow slate when unset. There's no fill or text on an
  // arrow so this is the only colour field.
  strokeColor?: string;
  opacity?: number; // 0..1, defaults to 1
  link?: ElementLink;
  arrowEnds?: ArrowEnds;
  // Stroke width in px. Defaults to the medium preset when unset so
  // existing arrows render unchanged. Presets surface via the Palette;
  // the underlying field is a free number so future inputs (sliders,
  // numeric entry) work without a schema migration.
  strokeWidth?: number;
  // Line pattern preset (solid / dashed / dotted). Shares the
  // BorderStyle union with the shape Border accordion so a future
  // pattern addition lands on both. Defaults to 'solid' (no
  // dasharray) so existing arrows render unchanged.
  strokeStyle?: BorderStyle;
  // Arrowhead size preset. Lives separately from `strokeWidth` so a
  // thin line can carry a chunky arrowhead and vice versa. Snapped
  // to a named preset for the toggle UI (see `arrowheadSizeOf`).
  arrowheadSize?: ArrowheadSize;
  // Path shape. 'straight' is the default and matches every arrow
  // authored before the field existed. 'curved' bows the line out
  // perpendicular to the from→to chord (smooth quadratic Bezier).
  // 'angled' renders the connector as an axis-aligned L-shape with
  // a single right-angle bend. See `arrowStyleOf`.
  arrowStyle?: ArrowStyle;
  // Optional override for the curve control point. Stored as a
  // delta from the chord midpoint (canvas coords) so the curve
  // translates with the arrow when an endpoint moves: the chord
  // midpoint shifts, the offset stays the same, and the user's
  // chosen bow direction + magnitude is preserved. Only consulted
  // when `arrowStyle === 'curved'`; the auto perpendicular bow is
  // used whenever this field is absent so existing curved arrows
  // render unchanged. Setting it back to undefined "resets" the
  // curve to its default shape.
  curveOffset?: { dx: number; dy: number };
  // Optional override for the angled-arrow elbow position. Stored
  // as a delta from the auto-computed elbow (the right-angle corner
  // a default angled arrow draws at `(to.x, from.y)` or `(from.x,
  // to.y)`). Lets the user drag the visible elbow handle to bend
  // the arrow somewhere other than the default corner. Only
  // consulted when `arrowStyle === 'angled'`; the auto right-angle
  // applies when this field is absent so existing angled arrows
  // render unchanged.
  elbowOffset?: { dx: number; dy: number };
  // Optional label rendered next to the arrow's midpoint. Empty /
  // missing → no label is drawn. Double-click on the arrow opens an
  // inline editor for this field. Placement is computed at render
  // time to dodge nearby boxed elements (right → below → left →
  // above of midpoint).
  label?: string;
};

// Named thickness presets exposed via the Palette. Storing the raw px
// in `strokeWidth` keeps the schema flexible while the UI sticks to a
// constrained set of sensible widths.
export type ArrowThickness = 'thin' | 'medium' | 'thick' | 'extra-thick';

export const ARROW_THICKNESS_PX: Record<ArrowThickness, number> = {
  thin: 1,
  medium: 2,
  thick: 4,
  'extra-thick': 7,
};

export const DEFAULT_ARROW_THICKNESS: ArrowThickness = 'medium';

export function arrowThicknessOf(arrow: ArrowElement): ArrowThickness {
  const w = arrow.strokeWidth;
  if (w === undefined) return DEFAULT_ARROW_THICKNESS;
  // Snap to the closest preset so the UI's toggle group always lights
  // up exactly one option, even for arrows created before the field
  // existed or copied from other tools.
  let best: ArrowThickness = DEFAULT_ARROW_THICKNESS;
  let bestDelta = Number.POSITIVE_INFINITY;
  for (const [name, px] of Object.entries(ARROW_THICKNESS_PX) as [ArrowThickness, number][]) {
    const delta = Math.abs(px - w);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = name;
    }
  }
  return best;
}

// Arrowhead size preset. Decoupled from line thickness so users can
// tune the head separately (e.g. a thin line with a bold arrowhead).
// Numbers are SVG marker viewport sizes — wider/taller markers render
// chunkier arrowheads regardless of the line's stroke width because
// of how `marker-end` scales independently from the path's stroke.
export type ArrowheadSize = 'small' | 'medium' | 'large' | 'extra-large';
export const ARROWHEAD_SIZE_PX: Record<ArrowheadSize, number> = {
  small: 4,
  medium: 6,
  large: 8.5,
  'extra-large': 12,
};
export const DEFAULT_ARROWHEAD_SIZE: ArrowheadSize = 'medium';

export function arrowheadSizeOf(arrow: ArrowElement): ArrowheadSize {
  return arrow.arrowheadSize ?? DEFAULT_ARROWHEAD_SIZE;
}

// Path geometry preset. Straight is the existing behaviour; curved
// adds a perpendicular bow via a quadratic Bezier; angled draws an
// axis-aligned right-angle elbow between the two endpoints. Stored
// as a named preset so the renderer can swap geometries without
// touching the data model.
export type ArrowStyle = 'straight' | 'curved' | 'angled';
const DEFAULT_ARROW_STYLE: ArrowStyle = 'straight';
export function arrowStyleOf(arrow: ArrowElement): ArrowStyle {
  return arrow.arrowStyle ?? DEFAULT_ARROW_STYLE;
}

// The quadratic-Bezier control point a curved arrow uses. When
// `curveOffset` is set, the user has dragged the curve handle and
// the control point is `chordMidpoint + curveOffset`. When unset,
// the historical auto-bow applies (¼-chord-length perpendicular to
// the chord). Exposed as its own helper so the renderer + the
// curve drag handle agree on the same point.
export function curveControlPoint(
  from: { x: number; y: number },
  to: { x: number; y: number },
  curveOffset?: { dx: number; dy: number },
): { x: number; y: number } {
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  if (curveOffset) return { x: mx + curveOffset.dx, y: my + curveOffset.dy };
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len < 0.5) return { x: mx, y: my };
  const nx = -dy / len;
  const ny = dx / len;
  const offset = len * 0.25;
  return { x: mx + nx * offset, y: my + ny * offset };
}

// Build the SVG `d` attribute for an arrow at the given resolved
// endpoint positions. Pure geometry (no DOM dependency) so the
// editor's `<ArrowView>` and any future export / embedded-viewer
// route can share the same line.
//
// Straight is a single line. Curved bows the chord perpendicular
// to its midpoint by ¼ of its length (quadratic Bezier), or, when
// `curveOffset` is set, runs the curve through the user-chosen
// control point. Angled drops one right-angle bend; the leg that
// runs first is chosen from the from-endpoint's anchor side when
// available so a pinned arrow leaves its element along its anchor
// direction.
export function arrowPathD(
  style: ArrowStyle,
  from: { x: number; y: number },
  to: { x: number; y: number },
  fromEp: Endpoint,
  toEp: Endpoint,
  curveOffset?: { dx: number; dy: number },
  elbowOffset?: { dx: number; dy: number },
): string {
  if (style === 'straight') return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
  if (style === 'curved') {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy);
    if (len < 0.5 && !curveOffset) return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
    const c = curveControlPoint(from, to, curveOffset);
    return `M ${from.x} ${from.y} Q ${c.x} ${c.y} ${to.x} ${to.y}`;
  }
  const elbow = angledElbow(from, to, fromEp, toEp, elbowOffset);
  return `M ${from.x} ${from.y} L ${elbow.x} ${elbow.y} L ${to.x} ${to.y}`;
}

// Auto-computed elbow position for an angled arrow, plus any
// user-dragged offset. The auto position is the right-angle corner
// the renderer would draw without input: (to.x, from.y) for
// horizontal-first, (from.x, to.y) for vertical-first. `elbowOffset`
// (set by dragging the elbow handle, see Canvas + useEditorDrag)
// translates the corner so the user can place the bend wherever they
// want. The result loses strict axis-alignment when offset is set,
// matching the "drag the bend" mental model from Lucid / draw.io.
export function angledElbow(
  from: { x: number; y: number },
  to: { x: number; y: number },
  fromEp: Endpoint,
  toEp: Endpoint,
  elbowOffset?: { dx: number; dy: number },
): { x: number; y: number } {
  const horizontalFirst = angledHorizontalFirst(from, to, fromEp, toEp);
  const baseX = horizontalFirst ? to.x : from.x;
  const baseY = horizontalFirst ? from.y : to.y;
  if (!elbowOffset) return { x: baseX, y: baseY };
  return { x: baseX + elbowOffset.dx, y: baseY + elbowOffset.dy };
}

// The point on the rendered path that a label should anchor to.
// Curves return the t=0.5 point of the quadratic Bezier; angled
// arrows return the elbow vertex; straight arrows return the chord
// midpoint.
export function arrowPathMidpoint(
  style: ArrowStyle,
  from: { x: number; y: number },
  to: { x: number; y: number },
  fromEp: Endpoint,
  toEp: Endpoint,
  curveOffset?: { dx: number; dy: number },
  elbowOffset?: { dx: number; dy: number },
): { x: number; y: number } {
  if (style === 'angled') {
    return angledElbow(from, to, fromEp, toEp, elbowOffset);
  }
  if (style === 'curved') {
    const c = curveControlPoint(from, to, curveOffset);
    // t=0.5 point on the quadratic Bezier B(0.5) = 0.25*P0 + 0.5*P1
    // + 0.25*P2.
    return {
      x: 0.25 * from.x + 0.5 * c.x + 0.25 * to.x,
      y: 0.25 * from.y + 0.5 * c.y + 0.25 * to.y,
    };
  }
  return { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
}

// Which leg of an angled arrow runs first. Pinned endpoints carry
// an intrinsic direction (E/W anchors leave horizontally; N/S leave
// vertically); free endpoints fall back to "travel along the longer
// axis first" so the elbow sits closer to the destination side.
function angledHorizontalFirst(
  from: { x: number; y: number },
  to: { x: number; y: number },
  fromEp: Endpoint,
  toEp: Endpoint,
): boolean {
  if (fromEp.kind === 'pinned') {
    if (fromEp.anchor === 'e' || fromEp.anchor === 'w') return true;
    if (fromEp.anchor === 'n' || fromEp.anchor === 's') return false;
  }
  if (toEp.kind === 'pinned') {
    if (toEp.anchor === 'n' || toEp.anchor === 's') return true;
    if (toEp.anchor === 'e' || toEp.anchor === 'w') return false;
  }
  return Math.abs(to.x - from.x) >= Math.abs(to.y - from.y);
}

// --- Element union ---------------------------------------------------------

export type BoxedElement =
  | ShapeElement
  | TextElement
  | StickyElement
  | ImageElement
  | FreehandElement;
export type Element = BoxedElement | ArrowElement;

export type Tab = {
  id: TabId;
  name: string;
  elements: Element[];
  backgroundPattern?: BackgroundPattern;
  backgroundColor?: string;
  // 0..1, defaults to 1. Applied to backgroundColor as the alpha
  // channel so the canvas can sit over a transparent / lower-opacity
  // backdrop (useful when embedded or layered on a theme).
  backgroundOpacity?: number;
  patternColor?: string;
  // Selected preset theme name (see apps/live/lib/themes.ts). Setting
  // a theme via the palette repaints every existing element on the tab
  // to match (sticky notes keep their amber palette). Newly added
  // elements inherit the same theme colours by default. Unset = brand
  // defaults.
  theme?: string;
  // Set to true once the user has explicitly chosen a starting template
  // (including "Blank"), so the template picker doesn't reappear on this tab.
  templateChosen?: boolean;
  // True when the tab is locked: every element becomes read-only,
  // adds via the palette are blocked, theme / background mutations
  // are blocked, and the Activity panel hides its Revert + Undo
  // buttons for as long as this tab is active. Toggled from the
  // tab ellipsis menu.
  locked?: boolean;
};

export type Diagram = {
  id: DiagramId;
  name: string;
  tabs: Tab[];
  createdAt: string;
  updatedAt: string;
};

// --- Comments --------------------------------------------------------------

// A single comment inside a thread. The author is the participant who
// wrote it (per `apps/live/lib/identity.ts`). The participant model is
// local-session-only today; the comment carries a denormalised copy of
// the name + colour so the badge keeps rendering even if the participant
// list later evolves (e.g. user renames themselves mid-session).
export type Comment = {
  id: string;
  text: string;
  createdAt: number; // unix ms
  authorName: string;
  authorColor: string;
};

// Threads live on elements (currently boxed only). `resolved` is sticky:
// users can resolve and unresolve a thread without losing the comments.
export type CommentThread = {
  comments: Comment[];
  resolved: boolean;
};

export function createComment(text: string, author: { name: string; color: string }): Comment {
  return {
    id: crypto.randomUUID(),
    text,
    createdAt: Date.now(),
    authorName: author.name,
    authorColor: author.color,
  };
}

// Count of comments shown on the badge. Resolved threads return 0 so the
// badge hides — the comments still exist and reappear on unresolve.
export function activeCommentCount(thread: CommentThread | undefined): number {
  if (!thread || thread.resolved) return 0;
  return thread.comments.length;
}

// --- Type guards -----------------------------------------------------------

export function isBoxed(element: Element): element is BoxedElement {
  return (
    element.type === 'shape' ||
    element.type === 'text' ||
    element.type === 'sticky' ||
    element.type === 'image' ||
    element.type === 'freehand'
  );
}

// --- Re-exported resource modules -----------------------------------------

export * from './factories';

export * from './geometry';

export * from './groups';

// Pencil-tool shape recognition (spec/09 Pencil (freehand)
// subsection's recognise mode). Re-exported so callers import
// from the package root the same way they do every other helper
// here.
export { recogniseShape, type RecognisedShape, type RecognisedShapeKind } from './recognise-shape';
