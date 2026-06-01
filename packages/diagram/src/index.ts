// Shared domain types for diagrams. Consumed by the live app's canvas today,
// and (later) by the persistence store, API workers, and any other code that
// handles diagram data. See specs/05-diagram-structure.md and
// specs/09-canvas-and-command-palette.md.

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
  }
}

export function supportsColours(element: Element): boolean {
  return element.type === 'shape' || element.type === 'sticky' || element.type === 'arrow';
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

export const DEFAULT_BORDER_RADIUS: BorderRadius = 'sm';

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
export const DEFAULT_ARROW_STYLE: ArrowStyle = 'straight';
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
  const horizontalFirst = angledHorizontalFirst(from, to, fromEp, toEp);
  const bx = horizontalFirst ? to.x : from.x;
  const by = horizontalFirst ? from.y : to.y;
  return `M ${from.x} ${from.y} L ${bx} ${by} L ${to.x} ${to.y}`;
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
): { x: number; y: number } {
  if (style === 'angled') {
    const horizontalFirst = angledHorizontalFirst(from, to, fromEp, toEp);
    return horizontalFirst ? { x: to.x, y: from.y } : { x: from.x, y: to.y };
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

export type BoxedElement = ShapeElement | TextElement | StickyElement;
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
  return element.type === 'shape' || element.type === 'text' || element.type === 'sticky';
}

// --- Factories -------------------------------------------------------------

// Default size per shape kind. Uniform 120 for square / circle / diamond,
// natural aspect ratios for the flowchart-vocabulary shapes (cylinder
// taller than wide, parallelogram + hexagon + document wider than tall).
const SHAPE_DEFAULT_SIZE: Record<ShapeKind, { width: number; height: number }> = {
  square: { width: 120, height: 120 },
  circle: { width: 120, height: 120 },
  diamond: { width: 120, height: 120 },
  cylinder: { width: 100, height: 140 },
  parallelogram: { width: 160, height: 100 },
  hexagon: { width: 140, height: 120 },
  document: { width: 140, height: 110 },
  // Stadium / pill — the conventional flowchart "Start / End" terminator
  // shape. Wider than tall by default; the CSS `border-radius: 9999px`
  // render path means the ends stay perfectly semicircular at any
  // aspect ratio the user resizes to.
  stadium: { width: 160, height: 64 },
  // Actor (UML stickman): line-art figure with its label below. Taller
  // than wide and aspect-locked on create so the figure never distorts.
  // Default size hugs the figure tightly — earlier 90×150 left a 38-
  // unit band below the legs which read as wasted padding under bare
  // (unlabelled) stickmen. 90×130 keeps room for a short label
  // (y 112..130) without dominating the box.
  actor: { width: 90, height: 130 },
  // Cloud: a container shape (networking / architecture). Stretches to
  // fit its label like the other flowchart shapes.
  cloud: { width: 180, height: 140 },
  // UI device frames. Sized to evoke each device's natural aspect
  // ratio at a glance: browser + monitor land on a 4:3-ish landscape
  // (with the monitor a touch taller to leave room for its stand);
  // laptop is wider with a flatter total profile (screen + keyboard
  // base stacked); phone + tablet are portrait at typical phone /
  // tablet ratios.
  browser: { width: 240, height: 160 },
  monitor: { width: 220, height: 170 },
  laptop: { width: 240, height: 150 },
  phone: { width: 90, height: 170 },
  tablet: { width: 140, height: 180 },
};

// New boxed elements default to Medium text size per spec 09 ("Text size").
export function createShape(kind: ShapeKind, x: number, y: number): ShapeElement {
  const { width, height } = SHAPE_DEFAULT_SIZE[kind];
  const base: ShapeElement = {
    id: crypto.randomUUID(),
    type: 'shape',
    shape: kind,
    x,
    y,
    width,
    height,
    textSize: 'md',
  };
  // The actor is a figure with its label beneath the legs, not text
  // inside a box. Lock the aspect ratio so resizing never warps the
  // stickman, and default the label to the bottom band.
  if (kind === 'actor') {
    return { ...base, aspectLocked: true, textAlignY: 'bottom' };
  }
  return base;
}

export function createText(x: number, y: number): TextElement {
  return {
    id: crypto.randomUUID(),
    type: 'text',
    x,
    y,
    width: 220,
    height: 64,
    label: 'Text',
    textSize: 'md',
  };
}

export function createSticky(x: number, y: number): StickyElement {
  return {
    id: crypto.randomUUID(),
    type: 'sticky',
    x,
    y,
    width: 200,
    height: 200,
    textSize: 'md',
  };
}

export function createArrow(fromX: number, fromY: number, toX: number, toY: number): ArrowElement {
  return {
    id: crypto.randomUUID(),
    type: 'arrow',
    from: { kind: 'free', x: fromX, y: fromY },
    to: { kind: 'free', x: toX, y: toY },
  };
}

export function createPinnedArrow(
  fromId: ElementId,
  fromAnchor: Anchor,
  toId: ElementId,
  toAnchor: Anchor,
): ArrowElement {
  return {
    id: crypto.randomUUID(),
    type: 'arrow',
    from: { kind: 'pinned', elementId: fromId, anchor: fromAnchor },
    to: { kind: 'pinned', elementId: toId, anchor: toAnchor },
  };
}

// Duplicate a boxed element with a new id and a position offset.
export function duplicateBoxed<T extends BoxedElement>(element: T, dx: number, dy: number): T {
  return { ...element, id: crypto.randomUUID(), x: element.x + dx, y: element.y + dy };
}

// Duplicate every element whose id is in `ids`:
// - Boxed elements get fresh ids and a position offset of (dx, dy).
// - Arrows whose both endpoints are pinned to ids inside the set get fresh
//   ids with endpoints remapped to the duplicates.
// - If more than one boxed element is duplicated, the copies share a new
//   `groupId` so they form a sibling group.
//
// Returns the new elements plus a map of old → new ids so callers can wire
// extra arrows (e.g. a connector from the original to the duplicate).
export function duplicateGroupedElements(
  elements: Element[],
  ids: Set<ElementId>,
  dx: number,
  dy: number,
): { newElements: Element[]; idMap: Map<ElementId, ElementId> } {
  const idMap = new Map<ElementId, ElementId>();
  const newBoxed: BoxedElement[] = [];

  for (const el of elements) {
    if (!ids.has(el.id) || !isBoxed(el)) continue;
    const newId = crypto.randomUUID();
    idMap.set(el.id, newId);
    newBoxed.push({ ...el, id: newId, x: el.x + dx, y: el.y + dy });
  }

  const sharedGroupId = newBoxed.length > 1 ? crypto.randomUUID() : undefined;
  const finalBoxed: Element[] = newBoxed.map((el) =>
    sharedGroupId ? { ...el, groupId: sharedGroupId } : el,
  );

  const newArrows: ArrowElement[] = [];
  for (const el of elements) {
    if (el.type !== 'arrow') continue;
    if (el.from.kind !== 'pinned' || el.to.kind !== 'pinned') continue;
    const newFromId = idMap.get(el.from.elementId);
    const newToId = idMap.get(el.to.elementId);
    if (!newFromId || !newToId) continue;
    newArrows.push({
      id: crypto.randomUUID(),
      type: 'arrow',
      from: { kind: 'pinned', elementId: newFromId, anchor: el.from.anchor },
      to: { kind: 'pinned', elementId: newToId, anchor: el.to.anchor },
      ...(el.locked === true ? { locked: true } : {}),
    });
  }

  return { newElements: [...finalBoxed, ...newArrows], idMap };
}

// --- Geometry helpers ------------------------------------------------------

export type Point = { x: number; y: number };

// Works on any boxed element since they share x/y/width/height.
export function anchorPosition(element: BoxedElement, anchor: Anchor): Point {
  const { x, y, width, height } = element;
  switch (anchor) {
    case 'nw':
      return { x, y };
    case 'n':
      return { x: x + width / 2, y };
    case 'ne':
      return { x: x + width, y };
    case 'e':
      return { x: x + width, y: y + height / 2 };
    case 'se':
      return { x: x + width, y: y + height };
    case 's':
      return { x: x + width / 2, y: y + height };
    case 'sw':
      return { x, y: y + height };
    case 'w':
      return { x, y: y + height / 2 };
  }
}

// Pick the anchor on `element` that faces `towards` most naturally.
// Used during drag to keep an arrow visually attached as one of its
// connected elements moves: e.g. if A's arrow ends at B's west side,
// and the user drags B to be above and right of A, the arrow's
// endpoint should re-pin to B's south-west or south so the line
// still arrives at a sensible face.
//
// Biased toward cardinals (n / e / s / w): if either axis dominates
// the direction by 2x or more, we pick the matching cardinal even
// though the corner anchor is geometrically closer. Cardinals read
// as the "middle of a side", which the user has explicitly preferred
// over corners.
// Re-pin arrows whose either endpoint is anchored to a moved box,
// pointing each end at the face that now reads most naturally
// (cardinals preferred via bestAnchorTowards). Pure: takes the
// already-translated element list and the set of ids that just
// moved, returns the same list with each affected arrow's
// from/to anchors recomputed.
//
// Only re-anchors arrows where BOTH ends are pinned to a box.
// from/to pairs that mix free + pinned (one floating end) keep
// their anchors as-is; the freely-positioned end already
// dictates the visual direction, and rebinding the pinned end
// against a free point would jitter as the user drags.
export function rebindArrowAnchorsAfterMove(
  elements: Element[],
  movingIds: ReadonlySet<ElementId> | Map<ElementId, unknown>,
): Element[] {
  const includes = (id: ElementId) =>
    movingIds instanceof Map ? movingIds.has(id) : movingIds.has(id);
  return elements.map((el) => {
    if (el.type !== 'arrow') return el;
    const fromMoved = el.from.kind === 'pinned' && includes(el.from.elementId);
    const toMoved = el.to.kind === 'pinned' && includes(el.to.elementId);
    if (!fromMoved && !toMoved) return el;
    if (el.from.kind !== 'pinned' || el.to.kind !== 'pinned') return el;
    const fromEnd = el.from;
    const toEnd = el.to;
    const fromEl = elements.find((e) => e.id === fromEnd.elementId);
    const toEl = elements.find((e) => e.id === toEnd.elementId);
    if (!fromEl || !isBoxed(fromEl) || !toEl || !isBoxed(toEl)) return el;
    const toCenter = { x: toEl.x + toEl.width / 2, y: toEl.y + toEl.height / 2 };
    const fromCenter = { x: fromEl.x + fromEl.width / 2, y: fromEl.y + fromEl.height / 2 };
    return {
      ...el,
      from: { ...fromEnd, anchor: bestAnchorTowards(fromEl, toCenter) },
      to: { ...toEnd, anchor: bestAnchorTowards(toEl, fromCenter) },
    };
  });
}

export function bestAnchorTowards(element: BoxedElement, towards: Point): Anchor {
  const cx = element.x + element.width / 2;
  const cy = element.y + element.height / 2;
  const dx = towards.x - cx;
  const dy = towards.y - cy;
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  // Cardinal-dominant zones: one axis at least 2x the other.
  if (ax >= 2 * ay) return dx >= 0 ? 'e' : 'w';
  if (ay >= 2 * ax) return dy >= 0 ? 's' : 'n';
  // Diagonal: pick the corner matching the quadrant.
  if (dx >= 0 && dy >= 0) return 'se';
  if (dx >= 0 && dy < 0) return 'ne';
  if (dx < 0 && dy >= 0) return 'sw';
  return 'nw';
}

export function endpointPosition(endpoint: Endpoint, elements: Element[]): Point {
  if (endpoint.kind === 'free') return { x: endpoint.x, y: endpoint.y };
  const target = elements.find((el) => el.id === endpoint.elementId);
  if (!target || !isBoxed(target)) return { x: 0, y: 0 };
  return anchorPosition(target, endpoint.anchor);
}

export function elementBounds(
  element: Element,
  elements: Element[],
): { x: number; y: number; width: number; height: number } {
  if (isBoxed(element)) {
    return { x: element.x, y: element.y, width: element.width, height: element.height };
  }
  const from = endpointPosition(element.from, elements);
  const to = endpointPosition(element.to, elements);
  return {
    x: Math.min(from.x, to.x),
    y: Math.min(from.y, to.y),
    width: Math.abs(to.x - from.x),
    height: Math.abs(to.y - from.y),
  };
}

// Alignment snapping: when dragging an element, snap its edges/centre to
// match nearby OTHER elements' edges/centres on the same axis. Returns the
// delta (dx, dy) to apply to the candidate position.
//
// Considers six lines per element: left / centre-x / right (X axis) and
// top / centre-y / bottom (Y axis). For each axis, picks the nearest
// candidate-target pair within `threshold` pixels.
export function snapToAlignment(
  candidate: { x: number; y: number; width: number; height: number },
  elements: Element[],
  excludeIds: Set<ElementId>,
  threshold: number,
): { dx: number; dy: number } {
  const xs = [candidate.x, candidate.x + candidate.width / 2, candidate.x + candidate.width];
  const ys = [candidate.y, candidate.y + candidate.height / 2, candidate.y + candidate.height];

  let bestX: number | null = null;
  let bestY: number | null = null;

  for (const el of elements) {
    if (!isBoxed(el) || excludeIds.has(el.id)) continue;
    const targetXs = [el.x, el.x + el.width / 2, el.x + el.width];
    const targetYs = [el.y, el.y + el.height / 2, el.y + el.height];
    for (const cx of xs) {
      for (const tx of targetXs) {
        const delta = tx - cx;
        if (Math.abs(delta) <= threshold && (bestX === null || Math.abs(delta) < Math.abs(bestX))) {
          bestX = delta;
        }
      }
    }
    for (const cy of ys) {
      for (const ty of targetYs) {
        const delta = ty - cy;
        if (Math.abs(delta) <= threshold && (bestY === null || Math.abs(delta) < Math.abs(bestY))) {
          bestY = delta;
        }
      }
    }
  }

  return { dx: bestX ?? 0, dy: bestY ?? 0 };
}

// Snap candidate bounds during a resize to align with other elements'
// edges and centres. Mirrors `snapToAlignment` but only nudges the
// edges that the active resize handle actually moves — the opposite
// corner is anchored and must not drift. Threshold is in canvas px.
//
// `mode` is the corner being dragged ("se" = bottom-right handle =
// right + bottom edges move; etc.).
export function snapResizeBounds(
  candidate: { x: number; y: number; width: number; height: number },
  mode: 'se' | 'sw' | 'ne' | 'nw',
  elements: Element[],
  excludeIds: Set<ElementId>,
  threshold: number,
  minSize: number,
): { x: number; y: number; width: number; height: number } {
  const movesRight = mode === 'se' || mode === 'ne';
  const movesLeft = mode === 'sw' || mode === 'nw';
  const movesBottom = mode === 'se' || mode === 'sw';
  const movesTop = mode === 'ne' || mode === 'nw';

  // Anchored coordinates — the corner that should NOT move.
  const anchorRight = movesLeft ? candidate.x + candidate.width : null;
  const anchorLeft = movesRight ? candidate.x : null;
  const anchorBottom = movesTop ? candidate.y + candidate.height : null;
  const anchorTop = movesBottom ? candidate.y : null;

  // The active edge positions we'll try to snap.
  const activeX = movesRight ? candidate.x + candidate.width : candidate.x;
  const activeY = movesBottom ? candidate.y + candidate.height : candidate.y;

  let bestDx: number | null = null;
  let bestDy: number | null = null;

  for (const el of elements) {
    if (!isBoxed(el) || excludeIds.has(el.id)) continue;
    const targetXs = [el.x, el.x + el.width / 2, el.x + el.width];
    const targetYs = [el.y, el.y + el.height / 2, el.y + el.height];
    if (movesLeft || movesRight) {
      for (const tx of targetXs) {
        const delta = tx - activeX;
        if (
          Math.abs(delta) <= threshold &&
          (bestDx === null || Math.abs(delta) < Math.abs(bestDx))
        ) {
          bestDx = delta;
        }
      }
    }
    if (movesTop || movesBottom) {
      for (const ty of targetYs) {
        const delta = ty - activeY;
        if (
          Math.abs(delta) <= threshold &&
          (bestDy === null || Math.abs(delta) < Math.abs(bestDy))
        ) {
          bestDy = delta;
        }
      }
    }
  }

  let { x, y, width, height } = candidate;
  if (bestDx !== null) {
    if (movesRight && anchorLeft !== null) {
      width = Math.max(minSize, activeX + bestDx - anchorLeft);
    } else if (movesLeft && anchorRight !== null) {
      const newX = activeX + bestDx;
      const newWidth = Math.max(minSize, anchorRight - newX);
      x = anchorRight - newWidth;
      width = newWidth;
    }
  }
  if (bestDy !== null) {
    if (movesBottom && anchorTop !== null) {
      height = Math.max(minSize, activeY + bestDy - anchorTop);
    } else if (movesTop && anchorBottom !== null) {
      const newY = activeY + bestDy;
      const newHeight = Math.max(minSize, anchorBottom - newY);
      y = anchorBottom - newHeight;
      height = newHeight;
    }
  }
  return { x, y, width, height };
}

// Nearest boxed-element anchor to a canvas point. Returns the pinning
// reference if one is within `threshold` pixels; otherwise null.
export function snapToAnchor(
  point: Point,
  elements: Element[],
  threshold: number,
): { elementId: ElementId; anchor: Anchor } | null {
  let best: { elementId: ElementId; anchor: Anchor; dist: number } | null = null;
  for (const el of elements) {
    if (!isBoxed(el)) continue;
    for (const anchor of ALL_ANCHORS) {
      const pos = anchorPosition(el, anchor);
      const dist = Math.hypot(pos.x - point.x, pos.y - point.y);
      if (dist <= threshold && (best === null || dist < best.dist)) {
        best = { elementId: el.id, anchor, dist };
      }
    }
  }
  if (!best) return null;
  return { elementId: best.elementId, anchor: best.anchor };
}

// --- Layer order -----------------------------------------------------------

export function bringToFront(elements: Element[], id: ElementId): Element[] {
  const el = elements.find((e) => e.id === id);
  if (!el) return elements;
  return [...elements.filter((e) => e.id !== id), el];
}

export function sendToBack(elements: Element[], id: ElementId): Element[] {
  const el = elements.find((e) => e.id === id);
  if (!el) return elements;
  return [el, ...elements.filter((e) => e.id !== id)];
}

export function bringManyToFront(elements: Element[], ids: Set<ElementId>): Element[] {
  const members = elements.filter((e) => ids.has(e.id));
  const others = elements.filter((e) => !ids.has(e.id));
  return [...others, ...members];
}

export function sendManyToBack(elements: Element[], ids: Set<ElementId>): Element[] {
  const members = elements.filter((e) => ids.has(e.id));
  const others = elements.filter((e) => !ids.has(e.id));
  return [...members, ...others];
}

// --- Groups ----------------------------------------------------------------

// All element ids that should be treated as one selection when `id` is clicked:
// the element itself, plus any other boxed element with the same groupId.
export function selectionMembers(elements: Element[], id: ElementId): ElementId[] {
  const target = elements.find((el) => el.id === id);
  if (!target) return [];
  if (!isBoxed(target) || !target.groupId) return [target.id];
  const gid = target.groupId;
  return elements.filter((el) => isBoxed(el) && el.groupId === gid).map((el) => el.id);
}

// Union bounding box of multiple boxed elements. Returns null if no boxed
// elements were found.
export function unionBoxedBounds(
  elements: Element[],
  ids: Set<ElementId>,
): { x: number; y: number; width: number; height: number } | null {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  let found = false;
  for (const el of elements) {
    if (!ids.has(el.id) || !isBoxed(el)) continue;
    found = true;
    if (el.x < minX) minX = el.x;
    if (el.y < minY) minY = el.y;
    if (el.x + el.width > maxX) maxX = el.x + el.width;
    if (el.y + el.height > maxY) maxY = el.y + el.height;
  }
  if (!found) return null;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

// Merge the groups containing `sourceId` and `targetId` into one fresh group.
// Returns elements unchanged if either id is missing, non-boxed, or they're
// already in the same group.
export function joinGroups(
  elements: Element[],
  sourceId: ElementId,
  targetId: ElementId,
): Element[] {
  if (sourceId === targetId) return elements;
  const source = elements.find((el) => el.id === sourceId);
  const target = elements.find((el) => el.id === targetId);
  if (!source || !target || !isBoxed(source) || !isBoxed(target)) return elements;
  if (source.groupId && source.groupId === target.groupId) return elements;
  // Prefer source's existing group id when extending an existing group so we
  // don't churn ids on every "Click another element to group it".
  const newGroupId = source.groupId ?? target.groupId ?? crypto.randomUUID();
  return elements.map((el) => {
    if (!isBoxed(el)) return el;
    const isSource = el.id === source.id;
    const isTarget = el.id === target.id;
    const inSourceGroup = source.groupId !== undefined && el.groupId === source.groupId;
    const inTargetGroup = target.groupId !== undefined && el.groupId === target.groupId;
    if (isSource || isTarget || inSourceGroup || inTargetGroup) {
      return { ...el, groupId: newGroupId };
    }
    return el;
  });
}

export function ungroup(elements: Element[], groupId: ElementId): Element[] {
  return elements.map((el) => {
    if (!isBoxed(el) || el.groupId !== groupId) return el;
    const { groupId: _drop, ...rest } = el;
    return rest as typeof el;
  });
}
